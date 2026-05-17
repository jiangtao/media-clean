import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const fixtureRoot = path.join(repoRoot, '.tmp', 'rust-benchmark-fixture');
const artifactRoot = path.join(repoRoot, 'artifacts', 'scan', 'benchmark');
const sessionPath = path.join(artifactRoot, 'session.json');
const reportPath = path.join(artifactRoot, 'benchmark-report.json');

function run(command, args) {
  const startedAt = performance.now();
  execFileSync(command, args, { cwd: repoRoot, stdio: 'inherit' });
  return performance.now() - startedAt;
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

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

fs.rmSync(fixtureRoot, { recursive: true, force: true });
fs.rmSync(artifactRoot, { recursive: true, force: true });
fs.mkdirSync(fixtureRoot, { recursive: true });
fs.mkdirSync(artifactRoot, { recursive: true });

for (let index = 0; index < 12; index += 1) {
  fs.writeFileSync(path.join(fixtureRoot, `dark-photo-${String(index).padStart(2, '0')}.png`), solidPng(12, 12, [4, 4, 4]));
}

run('cargo', ['test', '--manifest-path', 'engines/recognition/Cargo.toml']);
const scanDurationMs = run('cargo', [
  'run',
  '--release',
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
  'rust-benchmark-fixture',
]);

const session = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
const report = {
  generatedAt: new Date().toISOString(),
  fixtureRoot,
  assetCount: session.assets.length,
  scanDurationMs: Math.round(scanDurationMs * 100) / 100,
  averageAssetDurationMs: Math.round((scanDurationMs / Math.max(1, session.assets.length)) * 100) / 100,
  engine: session.engine,
};

assert(report.assetCount === 12, `expected 12 benchmark assets, got ${report.assetCount}`);
assert(Number.isFinite(report.scanDurationMs) && report.scanDurationMs > 0, 'scan duration must be positive');

fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`rust core benchmark ok: ${path.relative(repoRoot, reportPath)}`);
