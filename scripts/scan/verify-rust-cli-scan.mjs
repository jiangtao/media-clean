import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const fixtureRoot = path.join(repoRoot, '.tmp', 'rust-cli-fixture');
const artifactRoot = path.join(repoRoot, 'artifacts', 'scan', 'rust-cli');
const sessionPath = path.join(artifactRoot, 'session.json');
const planPath = path.join(artifactRoot, 'cleanup-plan.json');
const quarantinePath = path.join(artifactRoot, 'quarantine-dry-run.json');
const reportRoot = path.join(artifactRoot, 'report');
const defaultSessionId = 'rust-cli-default-layout';
const defaultSessionRoot = path.join(repoRoot, '.mc', defaultSessionId);
const defaultSessionPath = path.join(defaultSessionRoot, 'session.json');
const defaultPlanPath = path.join(defaultSessionRoot, 'cleanup-plan.json');
const defaultReportRoot = path.join(defaultSessionRoot, 'report');

function run(command, args, options = {}) {
  execFileSync(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    ...options,
  });
}

function solidPng(width, height, [red, green, blue]) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const offset = row + 1 + x * 4;
      raw[offset] = red;
      raw[offset + 1] = green;
      raw[offset + 2] = blue;
      raw[offset + 3] = 255;
    }
  }
  return pngBuffer(width, height, raw);
}

function pngBuffer(width, height, raw) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([signature, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

fs.rmSync(fixtureRoot, { recursive: true, force: true });
fs.rmSync(artifactRoot, { recursive: true, force: true });
fs.rmSync(defaultSessionRoot, { recursive: true, force: true });
fs.mkdirSync(fixtureRoot, { recursive: true });
fs.writeFileSync(path.join(fixtureRoot, 'dark-photo.png'), solidPng(12, 12, [4, 4, 4]));
fs.writeFileSync(path.join(fixtureRoot, 'metadata-only-video.mp4'), Buffer.from('not-a-real-video-fixture\n'));

run('cargo', ['test', '--manifest-path', 'engines/recognition/Cargo.toml']);
run('cargo', [
  'run',
  '--manifest-path',
  'engines/recognition/Cargo.toml',
  '-p',
  'mc-cli',
  '--',
  'scan',
  fixtureRoot,
  '--format',
  'json',
  '--out',
  sessionPath,
  '--session-id',
  'rust-cli-fixture',
]);
run('node', ['scripts/scan/verify-media-clean-result-schema.mjs', sessionPath]);

run('cargo', [
  'run',
  '--manifest-path',
  'engines/recognition/Cargo.toml',
  '-p',
  'mc-cli',
  '--',
  'plan',
  sessionPath,
  '--out',
  planPath,
]);
run('cargo', [
  'run',
  '--manifest-path',
  'engines/recognition/Cargo.toml',
  '-p',
  'mc-cli',
  '--',
  'report',
  sessionPath,
  '--out',
  reportRoot,
]);
run('cargo', [
  'run',
  '--manifest-path',
  'engines/recognition/Cargo.toml',
  '-p',
  'mc-cli',
  '--',
  'quarantine',
  planPath,
  '--dry-run',
  '--format',
  'json',
  '--out',
  quarantinePath,
]);

const session = readJson(sessionPath);
const plan = readJson(planPath);
const quarantine = readJson(quarantinePath);

assert(session.engine.kind === 'desktop-rust', `expected desktop-rust engine, got ${session.engine.kind}`);
assert(session.assets.length === 2, `expected two fixture assets, got ${session.assets.length}`);
assert(session.assets.some((asset) => asset.mediaType === 'photo'), 'expected a photo asset');
assert(session.assets.some((asset) => asset.mediaType === 'video'), 'expected a video asset');
assert(
  session.diagnostics?.some((diagnostic) => diagnostic.code === 'video-frame-unavailable'),
  'expected video-frame-unavailable diagnostic',
);
assert(Array.isArray(plan.plans), 'cleanup plan artifact must include plans');
assert(
  quarantine.actions?.every((action) => action.mode === 'dry-run' && action.status === 'planned'),
  'quarantine must remain dry-run and planned',
);
const reportHtml = fs.readFileSync(path.join(reportRoot, 'index.html'), 'utf8');
assert(reportHtml.includes('id="mc-report-data"'), 'report must inject JSON data into index.html');
assert(reportHtml.includes('JSON.parse'), 'report must render injected data in the browser');
assert(!fs.existsSync(path.join(reportRoot, 'contact-sheet')), 'report must not create contact-sheet directory');
assert(!fs.existsSync(path.join(reportRoot, 'assets')), 'report must not create assets directory');

run('cargo', [
  'run',
  '--manifest-path',
  'engines/recognition/Cargo.toml',
  '-p',
  'mc-cli',
  '--',
  'scan',
  fixtureRoot,
  '--format',
  'json',
  '--session-id',
  defaultSessionId,
  '--no-progress',
]);
assert(fs.existsSync(defaultSessionPath), 'scan without --out must write .mc/<session-id>/session.json');
run('cargo', [
  'run',
  '--manifest-path',
  'engines/recognition/Cargo.toml',
  '-p',
  'mc-cli',
  '--',
  'plan',
  defaultSessionPath,
]);
assert(fs.existsSync(defaultPlanPath), 'plan without --out must write .mc/<session-id>/cleanup-plan.json');
run('cargo', [
  'run',
  '--manifest-path',
  'engines/recognition/Cargo.toml',
  '-p',
  'mc-cli',
  '--',
  'report',
  defaultSessionPath,
]);
assert(
  fs.existsSync(path.join(defaultReportRoot, 'index.html')),
  'report without --out must write .mc/<session-id>/report/index.html',
);
assert(
  !fs.existsSync(path.join(defaultReportRoot, 'contact-sheet')),
  'default report must not create contact-sheet directory',
);
assert(!fs.existsSync(path.join(defaultReportRoot, 'assets')), 'default report must not create assets directory');

console.log(`rust CLI fixture ok: ${path.relative(repoRoot, sessionPath)}`);
