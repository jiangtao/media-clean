import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const assetRoot = process.env.MC_TEST_ASSETS ?? '/Users/jt/places/personal/mc-test-assets';
const args = parseArgs(process.argv.slice(2));
const mode = args.mode ?? 'full';

if (!['image', 'video', 'full'].includes(mode)) {
  throw new Error(`--mode must be image, video, or full; got ${mode}`);
}

const artifactRoot = path.join(repoRoot, 'artifacts', 'scan', `case-${mode}`);
const sessionPath = path.join(artifactRoot, 'session.json');
const planPath = path.join(artifactRoot, 'cleanup-plan.json');
const reportRoot = path.join(artifactRoot, 'report');
const quarantinePath = path.join(artifactRoot, 'quarantine-dry-run.json');
const summaryPath = path.join(artifactRoot, 'case-summary.json');
const mcBin = path.join(repoRoot, 'engines', 'recognition', 'target', 'debug', 'mc');

fs.rmSync(artifactRoot, { recursive: true, force: true });
fs.mkdirSync(artifactRoot, { recursive: true });

run('cargo', ['build', '--manifest-path', 'engines/recognition/Cargo.toml', '-p', 'mc-cli']);

const startedAt = Date.now();
run(mcBin, [
  'scan',
  assetRoot,
  '--format',
  'json',
  '--out',
  sessionPath,
  '--session-id',
  `rust-cli-case-${mode}`,
  '--media-type',
  mediaTypeForMode(mode),
]);
const scanSeconds = Number(((Date.now() - startedAt) / 1000).toFixed(2));

run('node', ['scripts/scan/verify-media-clean-result-schema.mjs', sessionPath]);
run(mcBin, ['plan', sessionPath, '--out', planPath]);
run(mcBin, ['report', sessionPath, '--out', reportRoot]);
run(mcBin, [
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
const reportHtml = fs.readFileSync(path.join(reportRoot, 'index.html'), 'utf8');
assert(reportHtml.includes('id="mc-report-data"'), 'case report must inject JSON data into index.html');
assert(!fs.existsSync(path.join(reportRoot, 'assets')), 'case report must not create assets directory');
assert(!fs.existsSync(path.join(reportRoot, 'contact-sheet')), 'case report must not create contact-sheet directory');
assert(quarantine.actions?.every((action) => action.mode === 'dry-run'), 'case quarantine must be dry-run only');

const media = countBy(session.assets, (asset) => asset.mediaType);
const clusterCategories = countBy(session.clusters, (cluster) => cluster.category);
const nearSimilarAssets = new Set(
  session.clusters
    .filter((cluster) => cluster.category === 'near_similar')
    .flatMap((cluster) => cluster.assetIds),
).size;

if (mode === 'image') {
  assert((media.photo ?? 0) > 0, 'image case must scan photo assets');
  assert(!media.video, 'image case must not scan video assets');
}
if (mode === 'video') {
  assert((media.video ?? 0) > 0, 'video case must scan video assets');
  assert(!media.photo, 'video case must not scan photo assets');
}
if (mode === 'full') {
  assert((media.photo ?? 0) > 0, 'full case must scan photo assets');
  assert((media.video ?? 0) > 0, 'full case must scan video assets');
}

const summary = {
  generatedAt: new Date().toISOString(),
  mode,
  assetRoot,
  scanSeconds,
  artifacts: {
    session: path.relative(repoRoot, sessionPath),
    cleanupPlan: path.relative(repoRoot, planPath),
    report: path.relative(repoRoot, path.join(reportRoot, 'index.html')),
    quarantineDryRun: path.relative(repoRoot, quarantinePath),
  },
  summary: {
    assets: session.assets.length,
    media,
    clusters: session.clusters.length,
    clusterCategories,
    nearSimilarAssets,
    cleanupPlans: session.cleanupPlans.length,
    diagnostics: session.diagnostics?.length ?? 0,
    dryRunActions: quarantine.actions?.length ?? 0,
  },
};

fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
console.log(`rust CLI ${mode} case ok: ${path.relative(repoRoot, summaryPath)}`);

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith('--')) {
      throw new Error(`unexpected argument: ${value}`);
    }
    const key = value.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      throw new Error(`missing value for ${value}`);
    }
    parsed[key] = next;
    index += 1;
  }
  return parsed;
}

function mediaTypeForMode(value) {
  if (value === 'image') return 'photo';
  if (value === 'video') return 'video';
  return 'all';
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

function countBy(items, getKey) {
  return items.reduce((counts, item) => {
    const key = getKey(item);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}
