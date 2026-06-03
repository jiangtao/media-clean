import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const desktopDir = path.join(repoRoot, 'apps', 'desktop');
const artifactsDir = path.join(repoRoot, 'artifacts', 'desktop-release');
const productName = 'Media Clean';
const executableName = productName;
const bundleId = 'com.mediaclean.desktop';
const keptLocales = new Set(['en', 'zh_CN']);
const require = createRequire(import.meta.url);

const args = parseArgs(process.argv.slice(2));
const desktopPackagePath = path.join(desktopDir, 'package.json');
const desktopPackage = JSON.parse(fs.readFileSync(desktopPackagePath, 'utf8'));
const version = args.version || process.env.DESKTOP_VERSION || desktopPackage.version;
const channel = args.channel || process.env.DESKTOP_RELEASE_CHANNEL || 'stable';
const arch = args.arch || normalizedArch();
const buildAt = new Date().toISOString();
const appName = `${productName}.app`;
const artifactPrefix = `media-clean-desktop-v${version}-mac-${arch}`;
const workDir = path.join(artifactsDir, '.work');
const appTarget = path.join(workDir, appName);
const appResources = path.join(appTarget, 'Contents', 'Resources');
const asarPath = path.join(appResources, 'app.asar');
const sourceDir = path.join(workDir, 'app-source');
const zipPath = path.join(artifactsDir, `${artifactPrefix}.zip`);
const dmgPath = path.join(artifactsDir, `${artifactPrefix}.dmg`);
const metadataPath = path.join(artifactsDir, `media-clean-desktop-v${version}.metadata.json`);
const sizeReportJsonPath = path.join(artifactsDir, `media-clean-desktop-v${version}.size-report.json`);
const sizeReportMarkdownPath = path.join(artifactsDir, `media-clean-desktop-v${version}.size-report.md`);
const checksumPath = path.join(artifactsDir, `media-clean-desktop-v${version}.sha256`);
const updateManifestPath = path.join(artifactsDir, `media-clean-desktop-update-${channel}-mac-${arch}.json`);
const latestMacYamlPath = path.join(artifactsDir, 'latest-mac.yml');

if (process.platform !== 'darwin') {
  throw new Error('Desktop release packaging currently targets macOS and must run on a macOS runner.');
}

if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error(`Invalid desktop version: ${version}`);
}

if (!/^[a-z][a-z0-9-]*$/i.test(channel)) {
  throw new Error(`Invalid desktop release channel: ${channel}`);
}

assertFile(path.join(desktopDir, 'renderer', 'dist', 'index.html'), 'renderer build is missing. Run npm --prefix apps/desktop run renderer:build first.');
assertFile(path.join(repoRoot, 'packages', 'media-clean-engine', 'native', 'mc_recognition_node.node'), 'native engine is missing. Run npm run engine:napi:build first.');
assertFile(path.join(desktopDir, 'node_modules', 'electron', 'dist', 'Electron.app'), 'Electron runtime is missing. Run npm install --prefix apps/desktop first.');

fs.rmSync(artifactsDir, { recursive: true, force: true });
fs.mkdirSync(workDir, { recursive: true });

copyElectronApp();
await createAppAsar();
copyRuntimeResources();
patchInfoPlist();
pruneRuntimeResources();

const signing = signAndNotarizeIfConfigured();
createArchives(signing);

const zipSha256 = sha256File(zipPath);
const dmgSha256 = sha256File(dmgPath);
const sizeReport = writeSizeReport({ zipSha256, dmgSha256, signing });
const metadata = writeMetadata({ zipSha256, dmgSha256, signing, sizeReport });
writeUpdateManifests({ zipSha256, dmgSha256, metadata });
writeChecksums({ zipSha256, dmgSha256 });

fs.rmSync(workDir, { recursive: true, force: true });

console.log(JSON.stringify({
  ok: true,
  version,
  channel,
  arch,
  signed: signing.signed,
  adHocSigned: signing.adHocSigned,
  notarized: signing.notarized,
  distribution: macosDistribution(signing),
  artifacts: {
    zip: relative(zipPath),
    dmg: relative(dmgPath),
    metadata: relative(metadataPath),
    sizeReport: relative(sizeReportJsonPath),
    updateManifest: relative(updateManifestPath),
  },
}, null, 2));

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      parsed[key] = '1';
      continue;
    }
    parsed[key] = next;
    index += 1;
  }
  return parsed;
}

function normalizedArch() {
  const archName = os.arch();
  if (archName === 'arm64') return 'arm64';
  if (archName === 'x64') return 'x64';
  return archName.replace(/[^a-z0-9_-]/gi, '-');
}

function assertFile(filePath, message) {
  if (!fs.existsSync(filePath)) throw new Error(message);
}

function copyElectronApp() {
  const electronApp = path.join(desktopDir, 'node_modules', 'electron', 'dist', 'Electron.app');
  run('ditto', [electronApp, appTarget]);
  const electronExecutable = path.join(appTarget, 'Contents', 'MacOS', 'Electron');
  if (fs.existsSync(electronExecutable)) {
    fs.renameSync(electronExecutable, path.join(appTarget, 'Contents', 'MacOS', executableName));
  }
}

function createAppAsar() {
  fs.mkdirSync(sourceDir, { recursive: true });
  const packagedPackage = {
    ...desktopPackage,
    version,
    main: 'main.cjs',
  };
  fs.writeFileSync(path.join(sourceDir, 'package.json'), `${JSON.stringify(packagedPackage, null, 2)}\n`);

  for (const fileName of ['main.cjs', 'preload.cjs']) {
    fs.copyFileSync(path.join(desktopDir, fileName), path.join(sourceDir, fileName));
  }

  fs.mkdirSync(path.join(sourceDir, 'renderer'), { recursive: true });
  fs.cpSync(path.join(desktopDir, 'renderer', 'dist'), path.join(sourceDir, 'renderer', 'dist'), { recursive: true });
  fs.cpSync(path.join(desktopDir, 'assets'), path.join(sourceDir, 'assets'), { recursive: true });

  const asar = require(require.resolve('@electron/asar', { paths: [desktopDir] }));
  fs.mkdirSync(appResources, { recursive: true });
  return asar.createPackageWithOptions(sourceDir, asarPath, {});
}

function copyRuntimeResources() {
  fs.copyFileSync(path.join(desktopDir, 'scan-worker.cjs'), path.join(appResources, 'scan-worker.cjs'));
  fs.cpSync(path.join(desktopDir, 'assets'), path.join(appResources, 'assets'), { recursive: true });

  const engineSource = path.join(repoRoot, 'packages', 'media-clean-engine');
  const engineTarget = path.join(appResources, 'media-clean-engine');
  fs.mkdirSync(engineTarget, { recursive: true });
  for (const fileName of ['package.json', 'index.cjs', 'index.d.ts']) {
    fs.copyFileSync(path.join(engineSource, fileName), path.join(engineTarget, fileName));
  }
  fs.cpSync(path.join(engineSource, 'native'), path.join(engineTarget, 'native'), { recursive: true });
}

function pruneRuntimeResources() {
  for (const fileName of ['default_app.asar', 'electron.icns']) {
    fs.rmSync(path.join(appResources, fileName), { recursive: true, force: true });
  }

  pruneLocaleDirectories(appResources);
  pruneLocaleDirectories(path.join(appTarget, 'Contents', 'Frameworks', 'Electron Framework.framework', 'Versions', 'A', 'Resources'));
}

function pruneLocaleDirectories(rootDir) {
  if (!fs.existsSync(rootDir)) return;
  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.endsWith('.lproj')) continue;
    const locale = entry.name.slice(0, -'.lproj'.length);
    if (keptLocales.has(locale)) continue;
    fs.rmSync(path.join(rootDir, entry.name), { recursive: true, force: true });
  }
}

function patchInfoPlist() {
  const plistPath = path.join(appTarget, 'Contents', 'Info.plist');
  const iconSource = path.join(desktopDir, 'assets', 'icon.icns');
  const iconTarget = path.join(appResources, 'icon.icns');
  fs.copyFileSync(iconSource, iconTarget);

  setPlist(plistPath, 'CFBundleName', productName);
  setPlist(plistPath, 'CFBundleDisplayName', productName);
  setPlist(plistPath, 'CFBundleIdentifier', bundleId);
  setPlist(plistPath, 'CFBundleExecutable', executableName);
  setPlist(plistPath, 'CFBundleShortVersionString', version);
  setPlist(plistPath, 'CFBundleVersion', buildVersion(version));
  setPlist(plistPath, 'CFBundleIconFile', 'icon');
}

function setPlist(plistPath, key, value) {
  try {
    execFileSync('/usr/libexec/PlistBuddy', ['-c', `Set :${key} ${value}`, plistPath], { stdio: 'ignore' });
  } catch {
    execFileSync('/usr/libexec/PlistBuddy', ['-c', `Add :${key} string ${value}`, plistPath], { stdio: 'ignore' });
  }
}

function buildVersion(input) {
  const match = String(input).match(/^(\d+)\.(\d+)\.(\d+)/);
  return match ? `${match[1]}.${match[2]}.${match[3]}` : '0.0.0';
}

function signAndNotarizeIfConfigured() {
  const signingIdentity = process.env.MACOS_CODESIGN_IDENTITY || '';
  const requireSigning = process.env.MC_DESKTOP_REQUIRE_SIGNING === '1';
  const entitlements = path.join(desktopDir, 'build', 'entitlements.mac.plist');
  const result = {
    required: requireSigning,
    signed: false,
    adHocSigned: false,
    notarized: false,
    identity: signingIdentity || null,
  };

  if (requireSigning && !signingIdentity) {
    throw new Error('MC_DESKTOP_REQUIRE_SIGNING=1 requires MACOS_CODESIGN_IDENTITY.');
  }

  if (!signingIdentity) {
    run('codesign', ['--force', '--deep', '--sign', '-', appTarget]);
    result.adHocSigned = true;
    return result;
  }

  run('codesign', [
    '--force',
    '--deep',
    '--timestamp',
    '--options',
    'runtime',
    '--entitlements',
    entitlements,
    '--sign',
    signingIdentity,
    appTarget,
  ]);
  run('codesign', ['--verify', '--deep', '--strict', '--verbose=2', appTarget]);
  result.signed = true;
  return result;
}

function createArchives(signing) {
  run('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', appName, zipPath], { cwd: workDir });
  run('hdiutil', ['create', '-volname', productName, '-srcfolder', appTarget, '-ov', '-format', 'UDZO', dmgPath]);

  const signingIdentity = process.env.MACOS_CODESIGN_IDENTITY || '';
  if (signingIdentity) {
    run('codesign', ['--force', '--timestamp', '--sign', signingIdentity, dmgPath]);
    signing.notarized = notarizeDmgIfConfigured();
  }
}

function notarizeDmgIfConfigured() {
  const appleId = process.env.APPLE_ID || '';
  const teamId = process.env.APPLE_TEAM_ID || '';
  const password = process.env.APPLE_APP_SPECIFIC_PASSWORD || '';
  const requireSigning = process.env.MC_DESKTOP_REQUIRE_SIGNING === '1';
  if (!appleId || !teamId || !password) {
    if (requireSigning) {
      throw new Error('Signed desktop releases require APPLE_ID, APPLE_TEAM_ID, and APPLE_APP_SPECIFIC_PASSWORD for notarization.');
    }
    return false;
  }

  run('xcrun', [
    'notarytool',
    'submit',
    dmgPath,
    '--apple-id',
    appleId,
    '--team-id',
    teamId,
    '--password',
    password,
    '--wait',
  ]);
  run('xcrun', ['stapler', 'staple', dmgPath]);
  return true;
}

function writeSizeReport({ zipSha256, dmgSha256, signing }) {
  const resourcesSize = directorySize(appResources);
  const engineSize = directorySize(path.join(appResources, 'media-clean-engine'));
  const appSize = directorySize(appTarget);
  const files = [
    artifactEntry(zipPath, zipSha256),
    artifactEntry(dmgPath, dmgSha256),
    {
      name: 'Media Clean.app',
      path: `${appName}/`,
      bytes: appSize,
      mib: toMiB(appSize),
    },
    {
      name: 'app.asar',
      path: `${appName}/Contents/Resources/app.asar`,
      bytes: fs.statSync(asarPath).size,
      mib: toMiB(fs.statSync(asarPath).size),
    },
    {
      name: 'resources',
      path: `${appName}/Contents/Resources/`,
      bytes: resourcesSize,
      mib: toMiB(resourcesSize),
    },
    {
      name: 'media-clean-engine',
      path: `${appName}/Contents/Resources/media-clean-engine/`,
      bytes: engineSize,
      mib: toMiB(engineSize),
    },
  ];
  const report = {
    product: productName,
    version,
    channel,
    platform: 'darwin',
    arch,
    generatedAt: buildAt,
    signed: signing.signed,
    adHocSigned: signing.adHocSigned,
    notarized: signing.notarized,
    distribution: macosDistribution(signing),
    budgets: {
      zipWarningMiB: 180,
      zipFailMiB: 220,
      dmgWarningMiB: 190,
      dmgFailMiB: 240,
      asarWarningMiB: 25,
      asarFailMiB: 40,
      resourcesWarningMiB: 60,
      resourcesFailMiB: 100,
    },
    files,
  };

  fs.writeFileSync(sizeReportJsonPath, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(sizeReportMarkdownPath, markdownSizeReport(report));
  return report;
}

function writeMetadata({ zipSha256, dmgSha256, signing, sizeReport }) {
  const metadata = {
    product: productName,
    bundleId,
    version,
    channel,
    platform: 'darwin',
    arch,
    builtAt: buildAt,
    signed: signing.signed,
    adHocSigned: signing.adHocSigned,
    notarized: signing.notarized,
    distribution: macosDistribution(signing),
    signingIdentity: signing.identity,
    artifacts: {
      zip: artifactEntry(zipPath, zipSha256),
      dmg: artifactEntry(dmgPath, dmgSha256),
      sizeReport: {
        path: relative(sizeReportJsonPath),
        bytes: fs.statSync(sizeReportJsonPath).size,
      },
    },
    budgets: sizeReport.budgets,
  };
  fs.writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
  return metadata;
}

function writeUpdateManifests({ zipSha256, dmgSha256, metadata }) {
  const updateManifest = {
    product: productName,
    version,
    channel,
    platform: 'darwin',
    arch,
    publishedAt: buildAt,
    releaseNotesUrl: null,
    signed: metadata.signed,
    adHocSigned: metadata.adHocSigned,
    notarized: metadata.notarized,
    distribution: metadata.distribution,
    files: [
      {
        type: 'zip',
        url: path.basename(zipPath),
        sha256: zipSha256,
        size: metadata.artifacts.zip.bytes,
      },
      {
        type: 'dmg',
        url: path.basename(dmgPath),
        sha256: dmgSha256,
        size: metadata.artifacts.dmg.bytes,
      },
    ],
  };
  fs.writeFileSync(updateManifestPath, `${JSON.stringify(updateManifest, null, 2)}\n`);
  fs.writeFileSync(latestMacYamlPath, [
    `version: ${version}`,
    `channel: ${channel}`,
    `path: ${path.basename(zipPath)}`,
    `sha256: ${zipSha256}`,
    `releaseDate: ${buildAt}`,
    'files:',
    `  - url: ${path.basename(zipPath)}`,
    `    sha256: ${zipSha256}`,
    `    size: ${metadata.artifacts.zip.bytes}`,
    `  - url: ${path.basename(dmgPath)}`,
    `    sha256: ${dmgSha256}`,
    `    size: ${metadata.artifacts.dmg.bytes}`,
    '',
  ].join('\n'));
}

function writeChecksums({ zipSha256, dmgSha256 }) {
  fs.writeFileSync(checksumPath, [
    `${zipSha256}  ${path.basename(zipPath)}`,
    `${dmgSha256}  ${path.basename(dmgPath)}`,
    '',
  ].join('\n'));
}

function artifactEntry(filePath, sha256) {
  const stats = fs.statSync(filePath);
  return {
    name: path.basename(filePath),
    path: relative(filePath),
    bytes: stats.size,
    mib: toMiB(stats.size),
    sha256,
  };
}

function markdownSizeReport(report) {
  const rows = report.files
    .map((file) => `| ${file.name} | ${file.mib.toFixed(3)} | ${file.bytes} | ${file.sha256 || ''} |`)
    .join('\n');
  return [
    `# Media Clean Desktop ${version} Size Report`,
    '',
    `- Channel: ${channel}`,
    `- Platform: darwin-${arch}`,
    `- Signed: ${report.signed ? 'yes' : 'no'}`,
    `- Ad-hoc signed: ${report.adHocSigned ? 'yes' : 'no'}`,
    `- Notarized: ${report.notarized ? 'yes' : 'no'}`,
    `- Distribution: ${report.distribution}`,
    `- Generated at: ${buildAt}`,
    '',
    '| Artifact | MiB | Bytes | SHA256 |',
    '| --- | ---: | ---: | --- |',
    rows,
    '',
  ].join('\n');
}

function macosDistribution(signing) {
  if (signing.notarized) {
    return 'signed-notarized';
  }
  if (signing.signed) {
    return 'signed-unnotarized';
  }
  if (signing.adHocSigned) {
    return 'ad-hoc';
  }
  return 'unsigned';
}

function directorySize(dir) {
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      total += directorySize(entryPath);
    } else if (entry.isFile()) {
      total += fs.statSync(entryPath).size;
    }
  }
  return total;
}

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function toMiB(bytes) {
  return bytes / 1024 / 1024;
}

function run(command, commandArgs, options = {}) {
  execFileSync(command, commandArgs, {
    cwd: options.cwd || repoRoot,
    env: process.env,
    stdio: 'inherit',
  });
}

function relative(filePath) {
  return path.relative(repoRoot, filePath).replaceAll(path.sep, '/');
}
