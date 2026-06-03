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
const executableName = `${productName}.exe`;
const keptLocalePaks = new Set(['en-US.pak', 'en.pak', 'zh-CN.pak']);
const require = createRequire(import.meta.url);

const args = parseArgs(process.argv.slice(2));
const desktopPackagePath = path.join(desktopDir, 'package.json');
const desktopPackage = JSON.parse(fs.readFileSync(desktopPackagePath, 'utf8'));
const version = args.version || process.env.DESKTOP_VERSION || desktopPackage.version;
const channel = args.channel || process.env.DESKTOP_RELEASE_CHANNEL || 'stable';
const arch = args.arch || normalizedArch();
const buildAt = new Date().toISOString();
const artifactPrefix = `media-clean-desktop-v${version}-win-${arch}`;
const workDir = path.join(artifactsDir, '.work-win');
const packageDir = path.join(workDir, `${productName}-win-${arch}`);
const appResources = path.join(packageDir, 'resources');
const asarPath = path.join(appResources, 'app.asar');
const sourceDir = path.join(workDir, 'app-source');
const zipPath = path.join(artifactsDir, `${artifactPrefix}.zip`);
const metadataPath = path.join(artifactsDir, `${artifactPrefix}.metadata.json`);
const sizeReportJsonPath = path.join(artifactsDir, `${artifactPrefix}.size-report.json`);
const sizeReportMarkdownPath = path.join(artifactsDir, `${artifactPrefix}.size-report.md`);
const checksumPath = path.join(artifactsDir, `${artifactPrefix}.sha256`);
const updateManifestPath = path.join(artifactsDir, `media-clean-desktop-update-${channel}-win-${arch}.json`);
const latestWinYamlPath = path.join(artifactsDir, 'latest-win.yml');

if (process.platform !== 'win32') {
  throw new Error('Windows desktop release packaging must run on a Windows runner.');
}

if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error(`Invalid desktop version: ${version}`);
}

if (!/^[a-z][a-z0-9-]*$/i.test(channel)) {
  throw new Error(`Invalid desktop release channel: ${channel}`);
}

assertFile(path.join(desktopDir, 'renderer', 'dist', 'index.html'), 'renderer build is missing. Run npm --prefix apps/desktop run renderer:build first.');
assertFile(path.join(repoRoot, 'packages', 'media-clean-engine', 'native', 'mc_recognition_node.node'), 'native engine is missing. Run npm run engine:napi:build first.');
assertFile(path.join(desktopDir, 'node_modules', 'electron', 'dist', 'electron.exe'), 'Windows Electron runtime is missing. Run npm install --prefix apps/desktop on a Windows runner first.');
assertFile(path.join(desktopDir, 'assets', 'icon.ico'), 'Windows launch icon is missing: apps/desktop/assets/icon.ico');

fs.rmSync(artifactsDir, { recursive: true, force: true });
fs.mkdirSync(workDir, { recursive: true });

copyElectronRuntime();
await createAppAsar();
copyRuntimeResources();
patchWindowsRuntime();
pruneWindowsRuntimeResources();
createZipArchive();

const zipSha256 = sha256File(zipPath);
const signing = {
  required: false,
  signed: false,
  notarized: false,
  status: 'reserved',
  installer: 'reserved',
};
const sizeReport = writeSizeReport({ zipSha256, signing });
const metadata = writeMetadata({ zipSha256, signing, sizeReport });
writeUpdateManifests({ zipSha256, metadata });
writeChecksums({ zipSha256 });

fs.rmSync(workDir, { recursive: true, force: true });

console.log(JSON.stringify({
  ok: true,
  version,
  channel,
  arch,
  platform: 'win32',
  signed: signing.signed,
  artifacts: {
    zip: relative(zipPath),
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

function copyElectronRuntime() {
  const electronRuntime = path.join(desktopDir, 'node_modules', 'electron', 'dist');
  fs.cpSync(electronRuntime, packageDir, { recursive: true });
  const electronExe = path.join(packageDir, 'electron.exe');
  if (fs.existsSync(electronExe)) {
    fs.renameSync(electronExe, path.join(packageDir, executableName));
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
  fs.rmSync(path.join(appResources, 'default_app.asar'), { force: true });
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

function patchWindowsRuntime() {
  fs.copyFileSync(path.join(desktopDir, 'assets', 'icon.ico'), path.join(appResources, 'icon.ico'));
  const versionFile = path.join(appResources, 'desktop-release.json');
  fs.writeFileSync(versionFile, `${JSON.stringify({
    product: productName,
    version,
    channel,
    platform: 'win32',
    arch,
    builtAt: buildAt,
    executable: executableName,
    signing: {
      status: 'reserved',
      installer: 'reserved',
    },
  }, null, 2)}\n`);
}

function pruneWindowsRuntimeResources() {
  fs.rmSync(path.join(appResources, 'default_app.asar'), { recursive: true, force: true });
  pruneWindowsLocales(path.join(packageDir, 'locales'));
  pruneDebugArtifacts(packageDir);
}

function pruneWindowsLocales(localesDir) {
  if (!fs.existsSync(localesDir)) return;
  for (const entry of fs.readdirSync(localesDir, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.pak')) continue;
    if (keptLocalePaks.has(entry.name)) continue;
    fs.rmSync(path.join(localesDir, entry.name), { force: true });
  }
}

function pruneDebugArtifacts(rootDir) {
  if (!fs.existsSync(rootDir)) return;
  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    const entryPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      pruneDebugArtifacts(entryPath);
      continue;
    }
    if (/\.(pdb|ilk|exp|lib)$/i.test(entry.name)) {
      fs.rmSync(entryPath, { force: true });
    }
  }
}

function createZipArchive() {
  run('powershell.exe', [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-Command',
    'Compress-Archive -Path (Join-Path $env:MC_WIN_PACKAGE_DIR "*") -DestinationPath $env:MC_WIN_ZIP -Force',
  ], {
    env: {
      MC_WIN_PACKAGE_DIR: packageDir,
      MC_WIN_ZIP: zipPath,
    },
  });
}

function writeSizeReport({ zipSha256, signing }) {
  const resourcesSize = directorySize(appResources);
  const engineSize = directorySize(path.join(appResources, 'media-clean-engine'));
  const packageSize = directorySize(packageDir);
  const files = [
    artifactEntry(zipPath, zipSha256),
    {
      name: `${productName}-win-${arch}/`,
      path: `${productName}-win-${arch}/`,
      bytes: packageSize,
      mib: toMiB(packageSize),
    },
    {
      name: executableName,
      path: `${productName}-win-${arch}/${executableName}`,
      bytes: fs.statSync(path.join(packageDir, executableName)).size,
      mib: toMiB(fs.statSync(path.join(packageDir, executableName)).size),
    },
    {
      name: 'app.asar',
      path: `${productName}-win-${arch}/resources/app.asar`,
      bytes: fs.statSync(asarPath).size,
      mib: toMiB(fs.statSync(asarPath).size),
    },
    {
      name: 'resources',
      path: `${productName}-win-${arch}/resources/`,
      bytes: resourcesSize,
      mib: toMiB(resourcesSize),
    },
    {
      name: 'media-clean-engine',
      path: `${productName}-win-${arch}/resources/media-clean-engine/`,
      bytes: engineSize,
      mib: toMiB(engineSize),
    },
  ];
  const report = {
    product: productName,
    version,
    channel,
    platform: 'win32',
    arch,
    generatedAt: buildAt,
    signed: signing.signed,
    signingStatus: signing.status,
    installer: signing.installer,
    budgets: {
      zipWarningMiB: 190,
      zipFailMiB: 260,
      packageWarningMiB: 320,
      packageFailMiB: 420,
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

function writeMetadata({ zipSha256, signing, sizeReport }) {
  const metadata = {
    product: productName,
    version,
    channel,
    platform: 'win32',
    arch,
    builtAt: buildAt,
    signed: signing.signed,
    signingStatus: signing.status,
    installer: signing.installer,
    artifacts: {
      zip: artifactEntry(zipPath, zipSha256),
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

function writeUpdateManifests({ zipSha256, metadata }) {
  const updateManifest = {
    product: productName,
    version,
    channel,
    platform: 'win32',
    arch,
    publishedAt: buildAt,
    releaseNotesUrl: null,
    files: [
      {
        type: 'zip',
        url: path.basename(zipPath),
        sha256: zipSha256,
        size: metadata.artifacts.zip.bytes,
      },
    ],
  };
  fs.writeFileSync(updateManifestPath, `${JSON.stringify(updateManifest, null, 2)}\n`);
  fs.writeFileSync(latestWinYamlPath, [
    `version: ${version}`,
    `channel: ${channel}`,
    `path: ${path.basename(zipPath)}`,
    `sha256: ${zipSha256}`,
    `releaseDate: ${buildAt}`,
    'files:',
    `  - url: ${path.basename(zipPath)}`,
    `    sha256: ${zipSha256}`,
    `    size: ${metadata.artifacts.zip.bytes}`,
    '',
  ].join('\n'));
}

function writeChecksums({ zipSha256 }) {
  fs.writeFileSync(checksumPath, [
    `${zipSha256}  ${path.basename(zipPath)}`,
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
    `# Media Clean Desktop ${version} Windows Size Report`,
    '',
    `- Channel: ${channel}`,
    `- Platform: win32-${arch}`,
    `- Signed: ${report.signed ? 'yes' : 'no'}`,
    `- Signing status: ${report.signingStatus}`,
    `- Installer: ${report.installer}`,
    `- Generated at: ${buildAt}`,
    '',
    '| Artifact | MiB | Bytes | SHA256 |',
    '| --- | ---: | ---: | --- |',
    rows,
    '',
  ].join('\n');
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
    env: {
      ...process.env,
      ...(options.env || {}),
    },
    stdio: 'inherit',
  });
}

function relative(filePath) {
  return path.relative(repoRoot, filePath).replaceAll(path.sep, '/');
}
