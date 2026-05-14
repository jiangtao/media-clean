import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const fixtureRoot = path.join(repoRoot, '.tmp', 'rust-parity-fixture');
const artifactRoot = path.join(repoRoot, 'artifacts', 'scan', 'parity');
const rustSessionPath = path.join(artifactRoot, 'rust-session.json');
const goSessionPath = path.join(artifactRoot, 'go-session.json');
const androidBaselinePath = path.join(repoRoot, 'fixtures', 'media-clean-result', 'golden-session.json');
const parityReportPath = path.join(artifactRoot, 'parity-report.json');

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
fs.mkdirSync(fixtureRoot, { recursive: true });
fs.mkdirSync(artifactRoot, { recursive: true });
fs.writeFileSync(path.join(fixtureRoot, 'dark-photo.png'), solidPng(12, 12, [4, 4, 4]));

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
  rustSessionPath,
  '--session-id',
  'rust-parity-fixture',
]);
run(
  'go',
  [
    'run',
    './cmd/media-clean-scan',
    '--root',
    fixtureRoot,
    '--out',
    goSessionPath,
    '--session-id',
    'desktop-go-parity-fixture',
  ],
  { cwd: path.join(repoRoot, 'engines', 'desktop-go') },
);
run('node', ['scripts/scan/verify-media-clean-result-schema.mjs', rustSessionPath, goSessionPath, androidBaselinePath]);

const rustSession = readJson(rustSessionPath);
const goSession = readJson(goSessionPath);
const androidBaseline = readJson(androidBaselinePath);

const report = {
  generatedAt: new Date().toISOString(),
  comparedSessions: [
    { engine: rustSession.engine.kind, path: path.relative(repoRoot, rustSessionPath) },
    { engine: goSession.engine.kind, path: path.relative(repoRoot, goSessionPath) },
    { engine: androidBaseline.engine.kind, path: path.relative(repoRoot, androidBaselinePath) },
  ],
  checks: [],
};

function addCheck(name, pass, details = {}) {
  report.checks.push({ name, pass, details });
  assert(pass, `${name} failed: ${JSON.stringify(details)}`);
}

addCheck('schema versions align', rustSession.schemaVersion === goSession.schemaVersion, {
  rust: rustSession.schemaVersion,
  go: goSession.schemaVersion,
});
addCheck('rust exposes comparable asset metrics', rustSession.assets.every((asset) => asset.metrics && asset.hashes), {
  rustAssetCount: rustSession.assets.length,
});
addCheck('go exposes comparable asset metrics', goSession.assets.every((asset) => asset.metrics && asset.hashes), {
  goAssetCount: goSession.assets.length,
});
addCheck('android baseline exposes comparable asset metrics', androidBaseline.assets.every((asset) => asset.metrics && asset.hashes), {
  androidAssetCount: androidBaseline.assets.length,
});
addCheck('rust cleanup plans are review-gated', rustSession.cleanupPlans.every((plan) => plan.requiresConfirmation), {
  rustPlanCount: rustSession.cleanupPlans.length,
});

fs.writeFileSync(parityReportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`rust/go/android parity ok: ${path.relative(repoRoot, parityReportPath)}`);
