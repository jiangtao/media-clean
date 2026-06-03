import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const engineRoot = path.join(repoRoot, 'engines', 'desktop-go');
const fixtureRoot = path.join(repoRoot, '.tmp', 'desktop-go-fixture');
const outputPath = path.join(repoRoot, 'artifacts', 'scan', 'desktop-go-session.json');

const blackPngBase64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGBb9+k9QAAAABJRU5ErkJggg==';

fs.rmSync(fixtureRoot, { recursive: true, force: true });
fs.mkdirSync(fixtureRoot, { recursive: true });
fs.writeFileSync(path.join(fixtureRoot, 'dark-photo.png'), Buffer.from(blackPngBase64, 'base64'));

execFileSync(
  'go',
  [
    'run',
    './cmd/media-clean-scan',
    '--root',
    fixtureRoot,
    '--out',
    outputPath,
    '--session-id',
    'desktop-go-spike-fixture',
  ],
  {
    cwd: engineRoot,
    stdio: 'inherit',
  },
);

execFileSync('node', [path.join(repoRoot, 'scripts', 'scan', 'verify-media-clean-result-schema.mjs'), outputPath], {
  cwd: repoRoot,
  stdio: 'inherit',
});

const session = JSON.parse(fs.readFileSync(outputPath, 'utf8'));

if (session.engine.kind !== 'desktop-go') {
  throw new Error(`Expected desktop-go engine, received ${session.engine.kind}`);
}
if (session.source.kind !== 'desktop-filesystem') {
  throw new Error(`Expected desktop-filesystem source, received ${session.source.kind}`);
}
if (session.assets.length !== 1) {
  throw new Error(`Expected one fixture asset, received ${session.assets.length}`);
}
if (!session.clusters.length || !session.cleanupPlans.length || !session.quarantineActions.length) {
  throw new Error('Expected low-value dry-run cleanup artifacts for the dark fixture');
}
if (session.quarantineActions.some((action) => action.mode !== 'dry-run')) {
  throw new Error('Desktop Go spike must only emit dry-run quarantine actions');
}

console.log(`desktop-go spike fixture ok: ${path.relative(repoRoot, outputPath)}`);
