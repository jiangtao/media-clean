import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(packageRoot, '..', '..');
const manifestPath = path.join(repoRoot, 'engines/recognition/crates/node/Cargo.toml');
const targetDir = path.join(repoRoot, 'engines/recognition/target');
const releaseBuild = process.argv.includes('--release') || process.env.MC_NATIVE_RELEASE === '1';

const cargoArgs = ['build', '--manifest-path', manifestPath, '-p', 'mc-recognition-node'];
if (releaseBuild) cargoArgs.push('--release');

const result = spawnSync('cargo', cargoArgs, {
  cwd: repoRoot,
  stdio: 'inherit',
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

const source = nativeLibraryPath(targetDir);
const outputDir = path.join(packageRoot, 'native');
const output = path.join(outputDir, 'mc_recognition_node.node');
fs.mkdirSync(outputDir, { recursive: true });
fs.copyFileSync(source, output);
stripNativeLibrary(output);
console.log(`native engine copied: ${path.relative(repoRoot, output)} (${releaseBuild ? 'release' : 'debug'})`);

function nativeLibraryPath(targetRoot) {
  const profileDir = path.join(targetRoot, releaseBuild ? 'release' : 'debug');
  if (process.platform === 'darwin') {
    return path.join(profileDir, 'libmc_recognition_node.dylib');
  }
  if (process.platform === 'win32') {
    return path.join(profileDir, 'mc_recognition_node.dll');
  }
  return path.join(profileDir, 'libmc_recognition_node.so');
}

function stripNativeLibrary(filePath) {
  if (!releaseBuild || process.env.MC_NATIVE_SKIP_STRIP === '1') return;
  const stripArgs = process.platform === 'darwin'
    ? ['-x', filePath]
    : process.platform === 'win32'
      ? null
      : ['--strip-unneeded', filePath];
  if (!stripArgs) return;
  const result = spawnSync('strip', stripArgs, { stdio: 'inherit' });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
