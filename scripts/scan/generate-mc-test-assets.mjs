import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const defaultAssetRoot = process.env.MC_TEST_ASSETS ?? '/Users/jt/places/personal/mc-test-assets';

const args = parseArgs(process.argv.slice(2));
const assetRoot = path.resolve(args.out ?? defaultAssetRoot);
const totalCount = positiveInt(args.count ?? process.env.MC_TEST_ASSET_COUNT ?? '20000', 'count');
const videoCount = Math.min(
  positiveInt(args.videos ?? process.env.MC_TEST_ASSET_VIDEOS ?? '0', 'videos'),
  totalCount,
);
const validVideoCount = Math.min(
  positiveInt(args.validVideos ?? process.env.MC_TEST_ASSET_VALID_VIDEOS ?? '0', 'valid-videos'),
  videoCount,
);
const imageCount = totalCount - videoCount;
const clean = Boolean(args.clean);

if (imageCount < 100) {
  throw new Error(`count must leave at least 100 images after videos; got images=${imageCount}`);
}

if (clean) {
  assertSafeCleanRoot(assetRoot);
  fs.rmSync(assetRoot, { recursive: true, force: true });
}

fs.mkdirSync(assetRoot, { recursive: true });

const startedAt = Date.now();
const imagePlan = makeImagePlan(imageCount);
const videoPlan = makeVideoPlan(videoCount, validVideoCount);

console.log(
  `generating mc test assets: ${totalCount} files (${imageCount} images, ${videoCount} videos) -> ${assetRoot}`,
);

writeImages(assetRoot, imagePlan);
writeVideos(assetRoot, videoPlan);
writeManifest(assetRoot, {
  generatedAt: new Date().toISOString(),
  generator: path.relative(repoRoot, fileURLToPath(import.meta.url)),
  profile: 'scale-recognition-v1',
  counts: {
    total: totalCount,
    images: imageCount,
    videos: videoCount,
    validVideos: validVideoCount,
    metadataOnlyVideos: videoCount - validVideoCount,
    ...imagePlan.counts,
  },
  categories: {
    duplicate:
      'Exact-byte duplicate PNG groups. Expected to form duplicate clusters by content hash.',
    nearSimilar:
      'Small visual mutations within each PNG group. Expected to form near_similar clusters.',
    lowValue:
      'Low-brightness noisy PNGs. Expected to produce low_value candidates without relying on exact duplicates.',
    control:
      'High-variation PNG controls. Expected to mostly stay outside cleanup clusters.',
    validVideo:
      'Tiny valid MP4 clips generated with ffmpeg. Expected to exercise ffprobe and representative frame extraction.',
    metadataOnlyVideo:
      'Small intentionally non-decodable MP4 fixtures. Expected to exercise video metadata fallback at scale.',
  },
});

const elapsedSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);
console.log(`mc test assets ready in ${elapsedSeconds}s`);

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--clean') {
      parsed.clean = true;
      continue;
    }
    if (!value.startsWith('--')) {
      throw new Error(`unexpected argument: ${value}`);
    }
    const key = value.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      throw new Error(`missing value for ${value}`);
    }
    parsed[key] = next;
    index += 1;
  }
  return parsed;
}

function positiveInt(value, name) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer, got ${value}`);
  }
  return parsed;
}

function assertSafeCleanRoot(root) {
  const normalized = path.resolve(root);
  if (path.basename(normalized) !== 'mc-test-assets') {
    throw new Error(`refusing --clean outside a mc-test-assets directory: ${normalized}`);
  }
  if (normalized === path.parse(normalized).root || normalized === os.homedir()) {
    throw new Error(`refusing unsafe --clean root: ${normalized}`);
  }
}

function makeImagePlan(count) {
  const duplicateCount = Math.floor(count * 0.4);
  const nearSimilarCount = Math.floor(count * 0.3);
  const lowValueCount = Math.floor(count * 0.15);
  const controlCount = count - duplicateCount - nearSimilarCount - lowValueCount;

  return {
    counts: {
      duplicateImages: duplicateCount,
      nearSimilarImages: nearSimilarCount,
      lowValueImages: lowValueCount,
      controlImages: controlCount,
    },
    duplicateCount,
    nearSimilarCount,
    lowValueCount,
    controlCount,
  };
}

function makeVideoPlan(count, validCount) {
  return {
    validCount,
    metadataOnlyCount: count - validCount,
  };
}

function writeImages(root, plan) {
  writeDuplicateImages(root, plan.duplicateCount);
  writeNearSimilarImages(root, plan.nearSimilarCount);
  writeLowValueImages(root, plan.lowValueCount);
  writeControlImages(root, plan.controlCount);
}

function writeDuplicateImages(root, count) {
  const dir = path.join(root, 'photos', 'duplicate');
  fs.mkdirSync(dir, { recursive: true });
  const groupSize = 4;
  const groupCount = Math.ceil(count / groupSize);
  let written = 0;
  for (let group = 0; group < groupCount && written < count; group += 1) {
    const bytes = patternedPng(48, 48, group, { mode: 'duplicate' });
    for (let member = 0; member < groupSize && written < count; member += 1) {
      fs.writeFileSync(
        path.join(dir, `dup-${pad(group, 5)}-${member}.png`),
        bytes,
      );
      written += 1;
    }
  }
}

function writeNearSimilarImages(root, count) {
  const dir = path.join(root, 'photos', 'near-similar');
  fs.mkdirSync(dir, { recursive: true });
  const groupSize = 3;
  const groupCount = Math.ceil(count / groupSize);
  let written = 0;
  for (let group = 0; group < groupCount && written < count; group += 1) {
    for (let member = 0; member < groupSize && written < count; member += 1) {
      fs.writeFileSync(
        path.join(dir, `near-${pad(group, 5)}-${member}.png`),
        patternedPng(48, 48, group, {
          mode: 'near',
          mutationIndex: member,
        }),
      );
      written += 1;
    }
  }
}

function writeLowValueImages(root, count) {
  const dir = path.join(root, 'photos', 'low-value');
  fs.mkdirSync(dir, { recursive: true });
  for (let index = 0; index < count; index += 1) {
    fs.writeFileSync(
      path.join(dir, `low-${pad(index, 5)}.png`),
      patternedPng(48, 48, index, { mode: 'low' }),
    );
  }
}

function writeControlImages(root, count) {
  const dir = path.join(root, 'photos', 'control');
  fs.mkdirSync(dir, { recursive: true });
  for (let index = 0; index < count; index += 1) {
    fs.writeFileSync(
      path.join(dir, `control-${pad(index, 5)}.png`),
      patternedPng(48, 48, index, { mode: 'control' }),
    );
  }
}

function writeVideos(root, plan) {
  const validDir = path.join(root, 'videos', 'valid');
  const metadataDir = path.join(root, 'videos', 'metadata-only');
  fs.mkdirSync(validDir, { recursive: true });
  fs.mkdirSync(metadataDir, { recursive: true });

  const validSeed = maybeCreateValidVideoSeed();
  for (let index = 0; index < plan.validCount; index += 1) {
    if (validSeed) {
      fs.copyFileSync(validSeed, path.join(validDir, `clip-${pad(index, 5)}.mp4`));
    } else {
      fs.writeFileSync(
        path.join(metadataDir, `clip-fallback-${pad(index, 5)}.mp4`),
        pseudoVideoBytes(index, 'valid-video-fallback'),
      );
    }
  }
  if (validSeed) {
    fs.rmSync(validSeed, { force: true });
  }

  for (let index = 0; index < plan.metadataOnlyCount; index += 1) {
    fs.writeFileSync(
      path.join(metadataDir, `metadata-${pad(index, 5)}.mp4`),
      pseudoVideoBytes(index, 'metadata-only'),
    );
  }
}

function maybeCreateValidVideoSeed() {
  if (!commandExists('ffmpeg')) {
    console.warn('ffmpeg unavailable; valid video fixtures will use metadata-only fallback');
    return null;
  }
  const seed = path.join(
    os.tmpdir(),
    `mc-valid-video-seed-${process.pid}-${Date.now()}.mp4`,
  );
  execFileSync(
    'ffmpeg',
    [
      '-v',
      'error',
      '-f',
      'lavfi',
      '-i',
      'testsrc=size=48x48:rate=5:duration=0.6',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      '-y',
      seed,
    ],
    { stdio: 'inherit' },
  );
  return seed;
}

function commandExists(command) {
  try {
    execFileSync(command, ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function pseudoVideoBytes(index, label) {
  return Buffer.from(
    [
      `mc ${label} fixture`,
      `index=${index}`,
      'This file intentionally has an mp4 extension but is not decodable video.',
      'It keeps large-scale video fallback scans fast and deterministic.',
      '',
    ].join('\n'),
  );
}

function patternedPng(width, height, seed, options) {
  const rng = mulberry32(seed + modeSalt(options.mode));
  const rgba = Buffer.alloc(width * height * 4);
  const baseA = Math.floor(rng() * 255);
  const baseB = Math.floor(rng() * 255);
  const baseC = Math.floor(rng() * 255);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      if (options.mode === 'low') {
        const value = (x * 3 + y * 5 + seed * 7 + Math.floor(rng() * 9)) % 22;
        rgba[offset] = value;
        rgba[offset + 1] = Math.max(0, value - 3);
        rgba[offset + 2] = Math.min(24, value + 2);
      } else if (options.mode === 'near') {
        const familyOffset = seed % 251;
        rgba[offset] = (x * 3 + y + familyOffset) % 255;
        rgba[offset + 1] = (y * 4 + x + familyOffset) % 255;
        rgba[offset + 2] = ((x + y) * 2 + familyOffset) % 255;
      } else {
        const stripe = ((Math.floor(x / 6) + Math.floor(y / 6) + seed) % 2) * 92;
        rgba[offset] = (baseA + x * 5 + y * 3 + stripe) % 255;
        rgba[offset + 1] = (baseB + x * 2 + y * 7 + stripe) % 255;
        rgba[offset + 2] = (baseC + x * 9 + y * 4 + stripe) % 255;
      }
      rgba[offset + 3] = 255;
    }
  }

  if (options.mode === 'near' && options.mutationIndex > 0) {
    mutateSmallPatch(rgba, width, height, seed, options.mutationIndex);
  }

  return rgbaPng(width, height, rgba);
}

function mutateSmallPatch(rgba, width, height, seed, mutationIndex) {
  const startX = (seed * 11 + mutationIndex * 5) % (width - 4);
  const startY = (seed * 7 + mutationIndex * 3) % (height - 4);
  for (let y = startY; y < startY + 3; y += 1) {
    for (let x = startX; x < startX + 3; x += 1) {
      const offset = (y * width + x) * 4;
      rgba[offset] = (rgba[offset] + mutationIndex * 17) % 255;
      rgba[offset + 1] = (rgba[offset + 1] + mutationIndex * 11) % 255;
      rgba[offset + 2] = (rgba[offset + 2] + mutationIndex * 7) % 255;
    }
  }
}

function modeSalt(mode) {
  switch (mode) {
    case 'low':
      return 100_000;
    case 'near':
      return 200_000;
    case 'control':
      return 300_000;
    case 'duplicate':
      return 400_000;
    default:
      return 0;
  }
}

function mulberry32(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let mixed = value;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
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
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
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

function writeManifest(root, manifest) {
  fs.writeFileSync(
    path.join(root, '_mc-test-assets-manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
}

function pad(value, width) {
  return String(value).padStart(width, '0');
}
