const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const engine = require('./index.cjs');
const repoRoot = path.resolve(__dirname, '..', '..');
const fixtureRoot = path.join(repoRoot, '.tmp', 'media-clean-engine-smoke');
const sessionDir = path.join(repoRoot, '.mc', 'media-clean-engine-smoke');
const sessionPath = path.join(sessionDir, 'session.json');
const cleanupPlanPath = path.join(sessionDir, 'cleanup-plan.json');

fs.rmSync(fixtureRoot, { recursive: true, force: true });
fs.mkdirSync(fixtureRoot, { recursive: true });
fs.writeFileSync(path.join(fixtureRoot, 'tiny-a.png'), solidPng(16, 16, [30, 60, 90]));
fs.writeFileSync(path.join(fixtureRoot, 'tiny-b.png'), solidPng(16, 16, [30, 60, 90]));

const result = engine.scanDirectory({
  root: fixtureRoot,
  sessionId: 'media-clean-engine-smoke',
  sessionPath,
  cleanupPlanPath,
  mediaType: 'all',
  progress: false,
});

if (result.mode !== 'napi') throw new Error('expected napi mode');
if (result.assetCount !== 2) throw new Error(`expected 2 assets, got ${result.assetCount}`);
if (!fs.existsSync(sessionPath)) throw new Error('session.json was not written');
if (!fs.existsSync(cleanupPlanPath)) throw new Error('cleanup-plan.json was not written');

const session = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
if (session.engine?.name !== 'mc-rust-napi') {
  throw new Error(`expected mc-rust-napi engine, got ${session.engine?.name}`);
}

console.log(JSON.stringify({ ok: true, result }));

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
  return Buffer.concat([signature, pngChunk('IHDR', ihdr), pngChunk('IDAT', zlib.deflateSync(raw)), pngChunk('IEND', Buffer.alloc(0))]);
}

function pngChunk(type, data) {
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
