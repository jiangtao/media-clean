import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const defaultApkPath = path.join(repoRoot, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
const artifactDir = path.join(repoRoot, 'artifacts', 'android-release');
const checksumPath = path.join(artifactDir, 'app-release.sha256');
const metadataPath = path.join(artifactDir, 'release-metadata.json');
const appJsonPath = path.join(repoRoot, 'app.json');
const sizeReportPath = path.join(artifactDir, 'apk-size-report.json');

function sha256(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function main() {
  const apkPath = path.resolve(process.argv[2] ?? defaultApkPath);
  if (!fs.existsSync(apkPath)) {
    throw new Error(`APK not found: ${apkPath}`);
  }

  const appConfig = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
  const expoConfig = appConfig.expo ?? {};
  const androidConfig = expoConfig.android ?? {};
  const checksum = sha256(apkPath);

  fs.mkdirSync(artifactDir, { recursive: true });
  fs.writeFileSync(checksumPath, `${checksum}  ${path.basename(apkPath)}\n`);

  const metadata = {
    generatedAt: new Date().toISOString(),
    artifactType: 'apk',
    artifactPath: path.relative(repoRoot, apkPath),
    checksumSha256: checksum,
    version: expoConfig.version ?? null,
    versionCode: androidConfig.versionCode ?? null,
    packageName: androidConfig.package ?? null,
    releaseArchitectures: (process.env.ANDROID_RELEASE_ARCHITECTURES ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
    signingReportPath: path.relative(repoRoot, path.join(artifactDir, 'app-release.signing.txt')),
    sizeReportPath: fs.existsSync(sizeReportPath) ? path.relative(repoRoot, sizeReportPath) : null,
    documentation: {
      zh: 'docs/release/android.md',
      en: 'docs/release/android.en.md',
    },
  };

  fs.writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
}

main();
