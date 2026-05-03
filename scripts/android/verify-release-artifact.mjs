import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const repoRoot = process.cwd();
const defaultApkPath = path.join(repoRoot, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
const artifactDir = path.join(repoRoot, 'artifacts', 'android-release');
const reportPath = path.join(artifactDir, 'app-release.signing.txt');

function findApkSignerCandidates() {
  const candidates = [];
  const sdkRoot = process.env.ANDROID_SDK_ROOT || process.env.ANDROID_HOME;

  if (sdkRoot) {
    const buildToolsDir = path.join(sdkRoot, 'build-tools');
    if (fs.existsSync(buildToolsDir)) {
      const versions = fs
        .readdirSync(buildToolsDir)
        .sort((left, right) => right.localeCompare(left, undefined, { numeric: true }));

      for (const version of versions) {
        const candidate = path.join(
          buildToolsDir,
          version,
          os.platform() === 'win32' ? 'apksigner.bat' : 'apksigner',
        );
        if (fs.existsSync(candidate)) {
          candidates.push(candidate);
        }
      }
    }
  }

  const direct = spawnSync('apksigner', ['version'], { encoding: 'utf8' });
  if (direct.status === 0) {
    candidates.push('apksigner');
  }

  return [...new Set(candidates)];
}

function hasSignerDetails(report) {
  return /Signer\s*#?\s*1\s+certificate/i.test(report);
}

function collectSigningReport(apkPath) {
  const candidates = findApkSignerCandidates();
  if (candidates.length === 0) {
    throw new Error('Could not locate `apksigner`. Set ANDROID_SDK_ROOT or ANDROID_HOME.');
  }

  const attempts = [];

  for (const apksigner of candidates) {
    const result = spawnSync(apksigner, ['verify', '--verbose', '--print-certs', apkPath], {
      encoding: 'utf8',
    });
    const report = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();

    if (result.status === 0 && hasSignerDetails(report)) {
      return report;
    }

    attempts.push({
      apksigner,
      status: result.status,
      report,
    });
  }

  const diagnostics = attempts
    .map(({ apksigner, status, report }) => {
      const preview = report ? report.slice(0, 400) : '<empty>';
      return `${apksigner} (exit=${status ?? 'null'}): ${preview}`;
    })
    .join('\n---\n');

  throw new Error(`Signing report did not contain signer certificate details.\n${diagnostics}`);
}

function main() {
  const apkPath = path.resolve(process.argv[2] ?? defaultApkPath);
  if (!fs.existsSync(apkPath)) {
    throw new Error(`APK not found: ${apkPath}`);
  }

  const report = collectSigningReport(apkPath);

  if (/Android Debug/i.test(report)) {
    throw new Error('Release APK is still signed with the Android Debug certificate.');
  }

  fs.mkdirSync(artifactDir, { recursive: true });
  fs.writeFileSync(reportPath, `${report}\n`);
}

main();
