import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const repoRoot = process.cwd();
const defaultApkPath = path.join(repoRoot, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
const artifactDir = path.join(repoRoot, 'artifacts', 'android-debug');
const reportPath = path.join(artifactDir, 'app-debug.signing.txt');

function findApkSigner() {
  const direct = spawnSync('apksigner', ['version'], { encoding: 'utf8' });
  if (direct.status === 0) {
    return 'apksigner';
  }

  const sdkRoot = process.env.ANDROID_SDK_ROOT || process.env.ANDROID_HOME;
  if (!sdkRoot) {
    throw new Error('Could not locate `apksigner`. Set ANDROID_SDK_ROOT or ANDROID_HOME.');
  }

  const buildToolsDir = path.join(sdkRoot, 'build-tools');
  const versions = fs
    .readdirSync(buildToolsDir)
    .sort((left, right) => right.localeCompare(left, undefined, { numeric: true }));

  for (const version of versions) {
    const candidate = path.join(buildToolsDir, version, os.platform() === 'win32' ? 'apksigner.bat' : 'apksigner');
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(`Could not find apksigner inside ${buildToolsDir}`);
}

function main() {
  const apkPath = path.resolve(process.argv[2] ?? defaultApkPath);
  if (!fs.existsSync(apkPath)) {
    throw new Error(`APK not found: ${apkPath}`);
  }

  const apksigner = findApkSigner();
  const result = spawnSync(apksigner, ['verify', '--print-certs', apkPath], {
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'apksigner verify failed');
  }

  const report = result.stdout.trim();
  if (!report.includes('Signer #1 certificate')) {
    throw new Error('Signing report did not contain signer certificate details.');
  }

  fs.mkdirSync(artifactDir, { recursive: true });
  fs.writeFileSync(reportPath, `${report}\n`);
}

main();
