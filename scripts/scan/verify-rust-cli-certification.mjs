import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const assetRoot = process.env.MC_TEST_ASSETS ?? '/Users/jt/places/personal/mc-test-assets';
const artifactRoot = path.join(repoRoot, 'artifacts', 'scan', 'certification');
const sessionPath = path.join(artifactRoot, 'session.json');
const planPath = path.join(artifactRoot, 'cleanup-plan.json');
const quarantinePath = path.join(artifactRoot, 'quarantine-dry-run.json');
const reportRoot = path.join(artifactRoot, 'report');
const certificationPath = path.join(artifactRoot, 'certification.json');

const samples = [
  {
    fileName: 'sample-photo.png',
    urls: [
      'https://placehold.co/64x64/png',
      'https://picsum.photos/64/64.jpg',
      'https://httpbin.org/image/png',
    ],
  },
  {
    fileName: 'sample-video.mp4',
    urls: [
      'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
      'https://samplelib.com/lib/preview/mp4/sample-5s.mp4',
    ],
  },
];

async function downloadIfMissing(sample) {
  const target = path.join(assetRoot, sample.fileName);
  if (fs.existsSync(target) && fs.statSync(target).size > 0) {
    return { ...sample, target, reused: true };
  }

  const errors = [];
  for (const url of sample.urls) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!response.ok) {
        errors.push(`${url}: ${response.status}`);
        continue;
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      fs.writeFileSync(target, bytes);
      return { ...sample, url, target, reused: false, bytes: bytes.length };
    } catch (error) {
      errors.push(`${url}: ${error.message}`);
    }
  }
  throw new Error(`download failed for ${sample.fileName}: ${errors.join('; ')}`);
}

function run(command, args) {
  execFileSync(command, args, { cwd: repoRoot, stdio: 'inherit' });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

fs.mkdirSync(assetRoot, { recursive: true });
fs.rmSync(artifactRoot, { recursive: true, force: true });
fs.mkdirSync(artifactRoot, { recursive: true });

const generated = writeEffectSamples();
const downloaded = [];
for (const sample of samples) {
  downloaded.push(await downloadIfMissing(sample));
}

run('cargo', [
  'run',
  '--manifest-path',
  'engines/recognition/Cargo.toml',
  '-p',
  'mc-cli',
  '--',
  'scan',
  assetRoot,
  '--format',
  'json',
  '--out',
  sessionPath,
  '--session-id',
  'rust-cli-certification',
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
const quarantine = readJson(quarantinePath);

assert(session.assets.some((asset) => asset.mediaType === 'photo'), 'certification requires at least one photo asset');
assert(session.assets.some((asset) => asset.mediaType === 'video'), 'certification requires at least one video asset');
assertClusterContains(session, 'duplicate', ['effect-duplicate-a.png', 'effect-duplicate-b.png']);
assertClusterContains(session, 'near_similar', ['effect-similar-a.png', 'effect-similar-b.png']);
assertClusterContains(session, 'low_value', ['effect-dark.png']);
const reportHtml = fs.readFileSync(path.join(reportRoot, 'index.html'), 'utf8');
assert(reportHtml.includes('id="mc-report-data"'), 'certification report must inject JSON data into index.html');
assert(reportHtml.includes('JSON.parse'), 'certification report must render injected data in the browser');
assert(!fs.existsSync(path.join(reportRoot, 'contact-sheet')), 'certification report must not create contact-sheet directory');
assert(!fs.existsSync(path.join(reportRoot, 'assets')), 'certification report must not create assets directory');
assert(
  quarantine.actions?.every((action) => action.mode === 'dry-run'),
  'certification quarantine must be dry-run only',
);

const certification = {
  generatedAt: new Date().toISOString(),
  assetRoot,
  samples: [...generated, ...downloaded].map((sample) => ({
    fileName: sample.fileName,
    url: sample.url ?? sample.urls?.[0],
    reused: sample.reused,
    generated: sample.generated ?? false,
    size: fs.statSync(sample.target).size,
  })),
  artifacts: {
    session: path.relative(repoRoot, sessionPath),
    cleanupPlan: path.relative(repoRoot, planPath),
    quarantineDryRun: path.relative(repoRoot, quarantinePath),
    report: path.relative(repoRoot, path.join(reportRoot, 'index.html')),
  },
  summary: {
    assetCount: session.assets.length,
    clusterCount: session.clusters.length,
    cleanupPlanCount: session.cleanupPlans.length,
    diagnosticCount: session.diagnostics?.length ?? 0,
  },
};

fs.writeFileSync(certificationPath, `${JSON.stringify(certification, null, 2)}\n`);
console.log(`rust CLI certification ok: ${path.relative(repoRoot, certificationPath)}`);

function writeEffectSamples() {
  const duplicateBytes = solidPng(64, 64, [128, 128, 128]);
  const effectSamples = [
    {
      fileName: 'effect-duplicate-a.png',
      bytes: duplicateBytes,
      kind: 'duplicate-positive',
    },
    {
      fileName: 'effect-duplicate-b.png',
      bytes: duplicateBytes,
      kind: 'duplicate-positive',
    },
    {
      fileName: 'effect-similar-a.png',
      bytes: gradientPng(),
      kind: 'near-similar-positive',
    },
    {
      fileName: 'effect-similar-b.png',
      bytes: gradientPng({ x: 7, y: 7, color: [255, 0, 0, 255] }),
      kind: 'near-similar-positive',
    },
    {
      fileName: 'effect-dark.png',
      bytes: solidPng(64, 64, [3, 3, 3]),
      kind: 'low-value-positive',
    },
    {
      fileName: 'effect-normal.png',
      bytes: checkerPng(64, 64),
      kind: 'negative-control',
    },
  ];

  return effectSamples.map((sample) => {
    const target = path.join(assetRoot, sample.fileName);
    fs.writeFileSync(target, sample.bytes);
    return {
      fileName: sample.fileName,
      url: `generated:${sample.kind}`,
      target,
      reused: false,
      generated: true,
    };
  });
}

function assertClusterContains(session, category, expectedFileNames) {
  const assetById = new Map(session.assets.map((asset) => [asset.id, asset]));
  const expected = new Set(expectedFileNames);
  const found = session.clusters.some((cluster) => {
    if (cluster.category !== category) return false;
    const names = new Set(
      cluster.assetIds
        .map((assetId) => assetById.get(assetId))
        .filter(Boolean)
        .map((asset) => fileNameFromAsset(asset)),
    );
    return [...expected].every((fileName) => names.has(fileName));
  });
  assert(found, `expected ${category} cluster containing ${expectedFileNames.join(', ')}`);
}

function fileNameFromAsset(asset) {
  const decoded = decodeURIComponent(asset.uri);
  return decoded.slice(decoded.lastIndexOf('/') + 1);
}

function gradientPng(mutation) {
  const width = 64;
  const height = 64;
  const rgba = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      rgba[offset] = (x * 3 + y) % 255;
      rgba[offset + 1] = (y * 4 + x) % 255;
      rgba[offset + 2] = ((x + y) * 2) % 255;
      rgba[offset + 3] = 255;
    }
  }
  if (mutation) {
    const offset = (mutation.y * width + mutation.x) * 4;
    rgba[offset] = mutation.color[0];
    rgba[offset + 1] = mutation.color[1];
    rgba[offset + 2] = mutation.color[2];
    rgba[offset + 3] = mutation.color[3];
  }
  return rgbaPng(width, height, rgba);
}

function checkerPng(width, height) {
  const rgba = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const value = (Math.floor(x / 4) + Math.floor(y / 4)) % 2 === 0 ? 240 : 24;
      const offset = (y * width + x) * 4;
      rgba[offset] = value;
      rgba[offset + 1] = value;
      rgba[offset + 2] = value;
      rgba[offset + 3] = 255;
    }
  }
  return rgbaPng(width, height, rgba);
}

function solidPng(width, height, [red, green, blue]) {
  const rgba = Buffer.alloc(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    const offset = index * 4;
    rgba[offset] = red;
    rgba[offset + 1] = green;
    rgba[offset + 2] = blue;
    rgba[offset + 3] = 255;
  }
  return rgbaPng(width, height, rgba);
}

function rgbaPng(width, height, rgba) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rawOffset = y * (width * 4 + 1);
    raw[rawOffset] = 0;
    rgba.copy(raw, rawOffset + 1, y * width * 4, (y + 1) * width * 4);
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
