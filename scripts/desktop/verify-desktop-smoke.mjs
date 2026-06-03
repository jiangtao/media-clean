import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const desktopDir = path.join(repoRoot, 'apps/desktop');
const require = createRequire(import.meta.url);
const args = new Set(process.argv.slice(2));
const staticOnly = args.has('--static-only');
const packageNoServer = args.has('--package-no-server');

const baseRequiredFiles = [
  'apps/desktop/package.json',
  'apps/desktop/main.cjs',
  'apps/desktop/preload.cjs',
  'scripts/desktop/build-release.mjs',
  'scripts/desktop/build-windows-release.mjs',
  'scripts/desktop/install-launch-agent.mjs',
  '.github/workflows/release-desktop.yml',
  '.github/workflows/desktop-release-on-label.yml',
];

const desktopIconRequiredFiles = [
  'apps/desktop/assets/icon.svg',
  'apps/desktop/assets/icon.png',
  'apps/desktop/assets/icon.icns',
  'apps/desktop/assets/icon.ico',
  'apps/desktop/assets/icons/16x16.png',
  'apps/desktop/assets/icons/32x32.png',
  'apps/desktop/assets/icons/48x48.png',
  'apps/desktop/assets/icons/64x64.png',
  'apps/desktop/assets/icons/128x128.png',
  'apps/desktop/assets/icons/256x256.png',
  'apps/desktop/assets/icons/512x512.png',
  'apps/desktop/assets/icons/1024x1024.png',
  'apps/desktop/renderer/public/icon.png',
];

const legacySmokeRequiredFiles = [
  'apps/report/package.json',
  'apps/report/app/page.tsx',
  'apps/report/components/report-workbench.tsx',
  'apps/report/components/scan-workbench.tsx',
  'engines/recognition/Cargo.toml',
];

const packageSmokeRequiredFiles = [
  'apps/desktop/renderer/index.html',
  'engines/recognition/Cargo.toml',
];

assertRequiredFiles([...baseRequiredFiles, ...desktopIconRequiredFiles]);
assertDesktopIconAssetsReuseLogo();

const desktopPackage = JSON.parse(fs.readFileSync(path.join(repoRoot, 'apps/desktop/package.json'), 'utf8'));
for (const scriptName of ['dev', 'smoke', 'build', 'package:smoke']) {
  if (!desktopPackage.scripts?.[scriptName]) {
    throw new Error(`apps/desktop/package.json missing script: ${scriptName}`);
  }
}

assertDesktopBridgeSourceContracts();
assertDesktopReleaseContracts();

if (packageNoServer) {
  assertRequiredFiles(packageSmokeRequiredFiles);
  assertPackageSmokeScripts(desktopPackage);
  assertPackageNoServerSource();

  if (!fs.existsSync(path.join(repoRoot, 'apps/desktop/node_modules/electron'))) {
    throw new Error('Electron is not installed. Run: npm install --prefix apps/desktop');
  }

  const result = await runElectronSmoke({ packageLike: true });
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);

  if (result.code !== 0) {
    throw new Error(`desktop package smoke failed with code ${result.code}`);
  }

  const smoke = parseSmokeJson(result.stdout);
  assertPackageSmokeJson(smoke);
  assertNoForbiddenServerCommand(result);
  console.log('[desktop package smoke] no-server electron checks passed');
  process.exit(0);
}

if (staticOnly) {
  assertRequiredFiles(legacySmokeRequiredFiles);
  console.log('[desktop smoke] static checks passed');
  process.exit(0);
}

assertRequiredFiles(legacySmokeRequiredFiles);

if (!fs.existsSync(path.join(repoRoot, 'apps/desktop/node_modules/electron'))) {
  throw new Error('Electron is not installed. Run: npm install --prefix apps/desktop');
}

const result = await runElectronSmoke({ packageLike: false });
process.stdout.write(result.stdout);
process.stderr.write(result.stderr);

if (result.code !== 0) {
  throw new Error(`desktop smoke failed with code ${result.code}`);
}

const smoke = parseSmokeJson(result.stdout);
if (smoke.ok !== true) {
  throw new Error('desktop smoke did not report ok=true');
}
assertIconSmokeJson(smoke.icon);

console.log('[desktop smoke] electron checks passed');

function assertRequiredFiles(requiredFiles) {
  for (const relativePath of requiredFiles) {
    const absolutePath = path.join(repoRoot, relativePath);
    if (!fs.existsSync(absolutePath)) {
      throw new Error(`missing required desktop dependency: ${relativePath}`);
    }
  }
}

function assertDesktopIconAssetsReuseLogo() {
  const desktopRuntimeIcon = fs.readFileSync(path.join(repoRoot, 'apps/desktop/assets/icon.png'));
  const desktopRendererIcon = fs.readFileSync(path.join(repoRoot, 'apps/desktop/renderer/public/icon.png'));
  if (!desktopRuntimeIcon.equals(desktopRendererIcon)) {
    throw new Error('desktop renderer and Electron runtime must reuse the same rounded product logo PNG');
  }

  const productLogoSvg = fs.readFileSync(path.join(repoRoot, 'page/public/apps/icons/logo.svg'), 'utf8').trim();
  const desktopSvg = fs.readFileSync(path.join(repoRoot, 'apps/desktop/assets/icon.svg'), 'utf8').trim();
  if (desktopSvg !== productLogoSvg) {
    throw new Error('apps/desktop/assets/icon.svg must reuse page/public/apps/icons/logo.svg');
  }

  for (const size of [16, 32, 48, 64, 128, 256, 512, 1024]) {
    const iconPath = path.join(repoRoot, `apps/desktop/assets/icons/${size}x${size}.png`);
    const iconBytes = fs.readFileSync(iconPath);
    if (iconBytes.length < 200) {
      throw new Error(`desktop Linux launch icon appears invalid: apps/desktop/assets/icons/${size}x${size}.png`);
    }
  }
}

function assertPackageSmokeScripts(packageJson) {
  const packageSmokeScript = String(packageJson.scripts?.['package:smoke'] || '');
  if (!packageSmokeScript.includes('--package-no-server')) {
    throw new Error('apps/desktop package:smoke must run verify-desktop-smoke.mjs --package-no-server');
  }

  assertCommandDoesNotDependOnNextServer('apps/desktop package:smoke script', packageSmokeScript);
}

function assertPackageNoServerSource() {
  const mainSource = fs.readFileSync(path.join(repoRoot, 'apps/desktop/main.cjs'), 'utf8');
  const packageSmokeScript = String(desktopPackage.scripts?.['package:smoke'] || '');

  if (!/\bMC_DESKTOP_(PACKAGED_LIKE|PACKAGE_SMOKE|RENDERER_MODE)\b/.test(mainSource)) {
    throw new Error('apps/desktop/main.cjs must support a packaged-like smoke env var before package smoke can run');
  }

  const loadsLocalHttpRenderer = (
    /\.loadURL\s*\(\s*['"`]http:\/\/127\.0\.0\.1[:/]/.test(mainSource)
    || (/\.loadURL\s*\(\s*reportUrl\s*\)/.test(mainSource) && /http:\/\/127\.0\.0\.1/.test(mainSource))
  );
  const hasStaticRendererLoad = (
    /\.loadFile\s*\(/.test(mainSource)
    || /protocol\.(handle|register\w*Protocol)\s*\(\s*['"`]app['"`]/.test(mainSource)
    || /rendererMode[^;\n]*static/.test(mainSource)
  );

  if (loadsLocalHttpRenderer && !hasStaticRendererLoad) {
    throw new Error('apps/desktop/main.cjs package path must load ASAR/static renderer assets instead of only http://127.0.0.1');
  }

  assertCommandDoesNotDependOnNextServer('desktop package smoke verifier', packageSmokeScript);
}

function assertDesktopBridgeSourceContracts() {
  const mainSource = fs.readFileSync(path.join(repoRoot, 'apps/desktop/main.cjs'), 'utf8');
  const preloadSource = fs.readFileSync(path.join(repoRoot, 'apps/desktop/preload.cjs'), 'utf8');
  const typesSource = fs.readFileSync(path.join(repoRoot, 'apps/desktop/renderer/src/types.ts'), 'utf8');
  const rendererSource = fs.readFileSync(path.join(repoRoot, 'apps/desktop/renderer/src/App.tsx'), 'utf8');
  const rendererStyles = fs.readFileSync(path.join(repoRoot, 'apps/desktop/renderer/src/desktop.less'), 'utf8');
  const rendererLib = fs.readFileSync(path.join(repoRoot, 'apps/desktop/renderer/src/lib.ts'), 'utf8');
  const rendererPreview = fs.readFileSync(path.join(repoRoot, 'apps/desktop/renderer/src/dev-preview.ts'), 'utf8');
  const rendererI18nPath = path.join(repoRoot, 'apps/desktop/renderer/src/desktop-i18n.ts');
  const rendererI18n = fs.existsSync(rendererI18nPath) ? fs.readFileSync(rendererI18nPath, 'utf8') : '';

  if (/\bsetContextMenu\s*\(/.test(mainSource) || /\bMenu\.buildFromTemplate\b/.test(mainSource)) {
    throw new Error('desktop tray must use the renderer island instead of a native context menu');
  }
  if (/api\.github\.com|MC_DESKTOP_UPDATE_REPO|github-releases/.test(mainSource)) {
    throw new Error('desktop update-check must be an Electron app version placeholder, not a GitHub Releases check');
  }
  if (!/source:\s*['"]electron-app['"]/.test(mainSource) || !/status:\s*['"]reserved['"]/.test(mainSource)) {
    throw new Error('desktop update-check must return an electron-app reserved placeholder result');
  }
  if (!/function\s+appIconImage\b/.test(mainSource) || !/function\s+fallbackBrandIconImage\b/.test(mainSource)) {
    throw new Error('desktop main must provide stable app icon loading with a fallback image');
  }
  if (!/minWidth:\s*1280\b/.test(mainSource)) {
    throw new Error('desktop main window must keep a product-safe minimum width of 1280px');
  }
  if (!/app\.dock\.setIcon\s*\(/.test(mainSource)) {
    throw new Error('desktop main must apply the product icon to the macOS Dock in dev and packaged runs');
  }
  if (!/function\s+showScanCompletedNotification\b/.test(mainSource) || !/notification\.on\(['"]click['"]/.test(mainSource)) {
    throw new Error('desktop main must show product scan notifications with a click target');
  }
  if (!/function\s+notificationStatus\b/.test(mainSource) || !/scanNotificationTitle/.test(mainSource) || /scanCompletedTitle/.test(mainSource)) {
    throw new Error('desktop main must expose a dry-run scan notification status with product scan-notification copy');
  }
  if (!/Notifications-Settings\.extension\?id=/.test(mainSource) || !/primeNotificationRegistration/.test(mainSource) || !/setAppUserModelId/.test(mainSource)) {
    throw new Error('desktop notification settings must register the app and open the product-specific system settings target');
  }
  if (!/function\s+scanWorkerPath\b/.test(mainSource) || !/process\.resourcesPath[^;\n]*scan-worker\.cjs/.test(mainSource)) {
    throw new Error('desktop packaged runtime must load scan-worker.cjs from process.resourcesPath');
  }
  if (!/const\s+trayPopoverWidth\s*=\s*720\b/.test(mainSource) || !/const\s+trayPopoverMaxHeight\s*=\s*760\b/.test(mainSource)) {
    throw new Error('desktop tray popover must use a tight 720px island-aligned window with a 760px max height');
  }
  if (/transparent:\s*true/.test(mainSource) || /backgroundColor:\s*['"]#00000000['"]/.test(mainSource)) {
    throw new Error('desktop tray popover must not use a transparent native window background');
  }
  if (!/function\s+resizeAndPositionTrayPopover\b/.test(mainSource) || !/function\s+preferredTrayPopoverSize\b/.test(mainSource)) {
    throw new Error('desktop tray popover must resize to island content before showing');
  }
  if (!/function\s+isPackagedRuntime\b/.test(mainSource) || !/app\.asar/.test(mainSource) || !/app\.getPath\(['"]userData['"]\)/.test(mainSource) || !/MC_DESKTOP_SESSION_ROOT/.test(mainSource)) {
    throw new Error('desktop packaged runtime must store mutable state under userData, even when Electron app.isPackaged is false');
  }
  if (!/function\s+markIntentionalQuit\b/.test(mainSource) || !/intentional-quit/.test(mainSource)) {
    throw new Error('desktop main must write an intentional quit marker for LaunchAgent guardian mode');
  }
  if (!/smokeMode/.test(mainSource) || !/function\s+canShowProductNotification\b/.test(mainSource)) {
    throw new Error('desktop notifications must be suppressed during smoke/test runs');
  }
  if (/trayTaskChart|task-chart/.test(mainSource)) {
    throw new Error('desktop tray icon must use the product logo instead of generating a task chart');
  }
  if (!/function\s+trayIconImage\b/.test(mainSource) || !/appIconImage\s*\(\s*36\s*\)/.test(mainSource)) {
    throw new Error('desktop tray icon must render the product app icon');
  }
  if (!/desktop:update-check/.test(preloadSource) || !/desktop:notification-status/.test(preloadSource) || !/desktop:open-notification-settings/.test(preloadSource)) {
    throw new Error('desktop preload must expose update check, notification status, and notification settings bridge methods');
  }
  if (!/tray:notification-status/.test(preloadSource)) {
    throw new Error('desktop tray preload bridge must expose dry-run scan notification status');
  }
  if (!/source:\s*'electron-app'/.test(typesSource) || !/status\??:\s*'reserved'/.test(typesSource)) {
    throw new Error('desktop renderer types must describe the Electron app update-check placeholder');
  }
  if (!/interface\s+NotificationStatusResult\b/.test(typesSource) || !/notificationStatus\??/.test(typesSource) || !/trayNotificationStatus\??/.test(typesSource)) {
    throw new Error('desktop renderer types must describe dry-run scan notification status APIs');
  }
  if (!/previewNotificationStatus/.test(rendererPreview) || !/notificationStatus:\s*async/.test(rendererPreview) || !/trayNotificationStatus:\s*async/.test(rendererPreview)) {
    throw new Error('desktop dev preview bridge must expose dry-run scan notification status');
  }
  if (!/color-scheme:\s*light dark/.test(rendererStyles) || !/prefers-color-scheme:\s*dark/.test(rendererStyles)) {
    throw new Error('desktop renderer must follow system light/dark appearance with color-scheme and prefers-color-scheme');
  }
  if (!/navigator\.languages/.test(rendererI18n) || !/zh-CN/.test(rendererI18n) || !/en-US/.test(rendererI18n) || !/languagechange/.test(rendererSource)) {
    throw new Error('desktop renderer must provide zh-CN/en-US i18n and follow system language changes');
  }
  if (/扫描完成通知/.test(rendererI18n) || !/notificationSettings:\s*['"]扫描通知['"]/.test(rendererI18n)) {
    throw new Error('desktop renderer notification entry must use product copy "扫描通知"');
  }
  if (!/react-hotkeys-hook/.test(rendererSource) || !/useHotkeys/.test(rendererSource)) {
    throw new Error('desktop detail shortcuts must use the mature react-hotkeys-hook dependency');
  }
  if (!/delete,ctrl\+delete,meta\+delete,backspace,ctrl\+backspace,meta\+backspace/.test(rendererSource)) {
    throw new Error('desktop detail shortcuts must bind Delete and Ctrl/Meta+Delete cleanup actions');
  }
  if (!/mode:\s*TrashMode/.test(rendererSource) || !/mode\s*===\s*['"]delete['"]/.test(rendererSource) || !/setPermanentDeleteRequest/.test(rendererSource)) {
    throw new Error('desktop detail shortcuts must route permanent delete through an explicit confirmed delete mode');
  }
  if (/mode\s*===\s*['"]delete['"][^;\n]*window\.confirm/.test(rendererSource)) {
    throw new Error('desktop permanent delete must use the in-app alert dialog instead of window.confirm');
  }
  if (!/role=["']alertdialog["']/.test(rendererSource) || !/AlertConfirmDialog/.test(rendererSource) || !/detail-shortcuts/.test(rendererSource)) {
    throw new Error('desktop detail view must expose an in-app confirm dialog and visible shortcut help');
  }
  if (!/input\.mode\s*===\s*['"]delete['"]/.test(mainSource) || !/fsp\.unlink/.test(mainSource) || !/status:\s*operation\s*===\s*['"]delete['"]\s*\?\s*['"]deleted['"]/.test(mainSource)) {
    throw new Error('desktop trash bridge must support a permanent delete mode in addition to system Trash');
  }
  if (!/document\.documentElement\.lang/.test(rendererSource)) {
    throw new Error('desktop renderer must update the document lang attribute from the active desktop locale');
  }
  if (!/Intl\.NumberFormat\(\s*desktopLocale/.test(rendererLib) || !/Intl\.DateTimeFormat\(\s*desktopLocale/.test(rendererLib)) {
    throw new Error('desktop renderer number/date formatters must use the active desktop locale');
  }
  if (!/getMainCopy/.test(mainSource) || !/app\.getLocale/.test(mainSource)) {
    throw new Error('desktop main process user-facing tray, notification, and dialog copy must follow the system locale');
  }
}

function assertDesktopReleaseContracts() {
  const rootPackage = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8'));
  const buildReleaseSource = fs.readFileSync(path.join(repoRoot, 'scripts/desktop/build-release.mjs'), 'utf8');
  const buildWindowsReleaseSource = fs.readFileSync(path.join(repoRoot, 'scripts/desktop/build-windows-release.mjs'), 'utf8');
  const guardianSource = fs.readFileSync(path.join(repoRoot, 'scripts/desktop/install-launch-agent.mjs'), 'utf8');
  const workflowSource = fs.readFileSync(path.join(repoRoot, '.github/workflows/release-desktop.yml'), 'utf8');
  const labelWorkflowSource = fs.readFileSync(path.join(repoRoot, '.github/workflows/desktop-release-on-label.yml'), 'utf8');
  const zhReleaseDoc = fs.readFileSync(path.join(repoRoot, 'docs/release/electron-desktop.md'), 'utf8');
  const enReleaseDoc = fs.readFileSync(path.join(repoRoot, 'docs/release/electron-desktop.en.md'), 'utf8');

  for (const scriptName of ['desktop:release', 'desktop:release:windows', 'release-desktop', 'desktop:guardian:install', 'desktop:guardian:uninstall', 'desktop:guardian:status']) {
    if (!rootPackage.scripts?.[scriptName]) {
      throw new Error(`root package.json missing desktop release/guardian script: ${scriptName}`);
    }
  }
  if (!rootPackage.scripts?.['engine:napi:build:release'] || !/engine:napi:build:release/.test(rootPackage.scripts['desktop:release']) || !/engine:napi:build:release/.test(rootPackage.scripts['desktop:release:windows'])) {
    throw new Error('desktop release scripts must rebuild the native engine in release mode before packaging');
  }

  for (const required of ['.dmg', '.zip', 'sha256', 'metadata.json', 'size-report.json', 'latest-mac.yml']) {
    if (!buildReleaseSource.includes(required)) {
      throw new Error(`desktop release builder must produce ${required}`);
    }
  }

  if (!/CFBundleExecutable/.test(buildReleaseSource) || !/fs\.renameSync\(electronExecutable/.test(buildReleaseSource)) {
    throw new Error('desktop release builder must rename the macOS Electron runtime to the product executable');
  }
  if (!/function\s+pruneRuntimeResources\b/.test(buildReleaseSource) || !/default_app\.asar/.test(buildReleaseSource) || !/zh_CN/.test(buildReleaseSource)) {
    throw new Error('desktop release builder must prune unused Electron runtime resources and keep product locales');
  }

  if (!/codesign['"], \[['"]--force['"], ['"]--deep['"], ['"]--sign['"], ['"]-['"]/.test(buildReleaseSource)) {
    throw new Error('desktop local macOS release builder must ad-hoc re-sign after patching product identity');
  }

  if (!/MC_DESKTOP_REQUIRE_SIGNING/.test(buildReleaseSource) || !/notarytool/.test(buildReleaseSource) || !/stapler/.test(buildReleaseSource) || !/adHocSigned/.test(buildReleaseSource) || !/distribution/.test(buildReleaseSource)) {
    throw new Error('desktop release builder must support ad-hoc distribution and optional signed notarization');
  }

  for (const required of ['win32', '.zip', 'latest-win.yml', 'icon.ico', 'Compress-Archive', 'media-clean-desktop-update-${channel}-win-${arch}', 'signingStatus', 'installer']) {
    if (!buildWindowsReleaseSource.includes(required)) {
      throw new Error(`Windows desktop release builder must produce or reserve ${required}`);
    }
  }
  if (!/function\s+pruneWindowsRuntimeResources\b/.test(buildWindowsReleaseSource) || !/zh-CN\.pak/.test(buildWindowsReleaseSource) || !/pdb\|ilk\|exp\|lib/.test(buildWindowsReleaseSource)) {
    throw new Error('Windows desktop release builder must prune unused Electron locales and debug artifacts');
  }

  if (!/workflow_dispatch/.test(workflowSource) || !/release_tag/.test(workflowSource) || !/macos_distribution/.test(workflowSource) || !/signed-notarized/.test(workflowSource) || !/MACOS_CERTIFICATE_BASE64/.test(workflowSource) || !/MACOS_CODESIGN_IDENTITY/.test(workflowSource)) {
    throw new Error('release-desktop workflow must be a manual desktop release workflow with unsigned and signed-notarized macOS modes');
  }
  if (!/Building open-source ad-hoc signed macOS DMG/.test(workflowSource) || !/Control-click \/ Open/.test(workflowSource) || !/Open Anyway/.test(workflowSource)) {
    throw new Error('release-desktop workflow must document the open-source ad-hoc macOS distribution path');
  }
  if ((workflowSource.match(/engine:napi:build:release/g) || []).length < 2) {
    throw new Error('release-desktop workflow must build release native engines for macOS and Windows release artifacts');
  }

  for (const required of ['build-macos-release', 'build-windows-release', 'windows-latest', 'desktop-release-windows', 'publish-release', 'latest-mac.yml', 'latest-win.yml']) {
    if (!workflowSource.includes(required)) {
      throw new Error(`release-desktop workflow must publish multi-platform desktop assets: ${required}`);
    }
  }
  for (const required of ['media-clean-desktop-macos-', 'media-clean-desktop-windows-', 'media-clean-desktop-latest.sha256', 'releases/download']) {
    if (!workflowSource.includes(required)) {
      throw new Error(`release-desktop workflow must publish stable user download aliases: ${required}`);
    }
  }

  for (const required of ['pull_request', 'types: [closed]', 'desktop-release', 'github.event.pull_request.merged == true', 'actions: write', 'pull-requests: write', 'continue-on-error: true', 'apps/desktop/package.json', 'gh workflow run release-desktop.yml', 'macos_distribution="unsigned"']) {
    if (!labelWorkflowSource.includes(required)) {
      throw new Error(`desktop release-on-label workflow must trigger formal release after a merged desktop-release PR: ${required}`);
    }
  }

  if (!/KeepAlive/.test(guardianSource) || !/SuccessfulExit/.test(guardianSource) || !/intentional-quit/.test(guardianSource)) {
    throw new Error('desktop LaunchAgent guardian must use KeepAlive and intentional quit marker semantics');
  }

  if (!/不再使用透明大窗口/.test(zhReleaseDoc) || !/no longer uses a large transparent carrier window/.test(enReleaseDoc)) {
    throw new Error('desktop release docs must define the non-transparent tray island window contract');
  }

  if (/扫描完成通知/.test(zhReleaseDoc) || /scan-complete notification/i.test(enReleaseDoc)) {
    throw new Error('desktop release docs must use product scan-notification copy');
  }

  if (!/进程守护/.test(zhReleaseDoc) || !/Process Guardian/.test(enReleaseDoc)) {
    throw new Error('desktop release docs must define the process guardian contract');
  }

  if (!/Windows portable zip/.test(zhReleaseDoc) || !/Windows portable zip/.test(enReleaseDoc) || !/release-desktop/.test(zhReleaseDoc) || !/release-desktop/.test(enReleaseDoc)) {
    throw new Error('desktop release docs must define the release-desktop multi-platform Windows portable zip contract');
  }
  if (!/`desktop-release` 标签/.test(zhReleaseDoc) || !/`desktop-release` label/.test(enReleaseDoc) || !/\.github\/workflows\/desktop-release-on-label\.yml/.test(zhReleaseDoc) || !/\.github\/workflows\/desktop-release-on-label\.yml/.test(enReleaseDoc)) {
    throw new Error('desktop release docs must define the desktop-release label trigger contract');
  }
  for (const required of ['media-clean-desktop-macos-arm64.dmg', 'media-clean-desktop-windows-x64.zip', 'media-clean-desktop-latest.sha256', 'Gatekeeper', 'distribution: ad-hoc']) {
    if (!zhReleaseDoc.includes(required) || !enReleaseDoc.includes(required)) {
      throw new Error(`desktop release docs must define stable desktop download entries: ${required}`);
    }
  }
  if (!/开源免费分发/.test(zhReleaseDoc) || !/open-source free distribution/.test(enReleaseDoc)) {
    throw new Error('desktop release docs must define the open-source free macOS distribution path');
  }
  if (!/不能使用仓库级 `releases\/latest`/.test(zhReleaseDoc) || !/must not use the repository-level `releases\/latest`/.test(enReleaseDoc)) {
    throw new Error('desktop release docs must avoid taking over the Android repository-level latest release endpoint');
  }
}

function assertCommandDoesNotDependOnNextServer(label, command) {
  const forbidden = [
    /\bnext\s+(dev|start)\b/,
    /\breport:dev\b/,
    /apps[\/\\]report.*\brun\s+(dev|start)\b/,
  ];

  for (const pattern of forbidden) {
    if (pattern.test(command)) {
      throw new Error(`${label} must not depend on a Next dev/start server`);
    }
  }
}

async function runElectronSmoke({ packageLike }) {
  const smokeApp = packageLike ? await createPackageSmokeAsar() : null;
  return new Promise((resolve, reject) => {
    const fakeBinDir = packageLike ? createForbiddenServerBinDir() : null;
    const resourcesDir = packageLike ? createPackageSmokeResources() : null;
    const child = packageLike ? spawnPackageLikeElectron(fakeBinDir, resourcesDir, smokeApp) : spawnLegacySmoke();

    let stdout = '';
    let stderr = '';
    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`${packageLike ? 'desktop package smoke' : 'desktop smoke'} timed out`));
    }, packageLike ? 30_000 : 60_000);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (error) => {
      clearTimeout(timeout);
      cleanupFakeBin(fakeBinDir);
      cleanupPackageSmokeResources(resourcesDir);
      cleanupPackageSmokeAsar(smokeApp);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timeout);
      cleanupFakeBin(fakeBinDir);
      cleanupPackageSmokeResources(resourcesDir);
      cleanupPackageSmokeAsar(smokeApp);
      resolve({ code, stdout, stderr });
    });
  });
}

function spawnLegacySmoke() {
  return spawn('npm', ['run', 'smoke'], {
    cwd: desktopDir,
    env: {
      ...process.env,
      MC_DESKTOP_SMOKE: '1',
      MC_DESKTOP_POLL_MS: '500',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function spawnPackageLikeElectron(fakeBinDir, resourcesDir, smokeApp) {
  const electronCli = path.join(desktopDir, 'node_modules/electron/cli.js');
  const enginePackagePath = path.join(resourcesDir, 'media-clean-engine');
  const scanWorkerPath = path.join(resourcesDir, 'scan-worker.cjs');
  const smokeStateRoot = path.join(smokeApp.root, '.mc');
  const electronArgs = [electronCli];
  if (process.platform === 'linux' && process.env.CI) {
    electronArgs.push('--no-sandbox');
  }
  electronArgs.push(smokeApp.asarPath);

  return spawn(process.execPath, electronArgs, {
    cwd: smokeApp.root,
    env: {
      ...process.env,
      MC_DESKTOP_SMOKE: '1',
      MC_DESKTOP_PACKAGE_SMOKE: '1',
      MC_DESKTOP_PACKAGED_LIKE: '1',
      MC_DESKTOP_RENDERER_MODE: 'static',
      MC_DESKTOP_NO_SERVER: '1',
      MC_DESKTOP_RESOURCES_PATH: resourcesDir,
      MC_DESKTOP_SCAN_WORKER_PATH: scanWorkerPath,
      MC_DESKTOP_SESSION_ROOT: path.join(smokeStateRoot, 'sessions'),
      MC_DESKTOP_DB_PATH: path.join(smokeStateRoot, '_state', 'report-workbench.sqlite'),
      MC_ENGINE_PACKAGE_PATH: enginePackagePath,
      MC_DESKTOP_POLL_MS: '500',
      MC_REPORT_PORT: String(49_000 + (process.pid % 1_000)),
      PATH: `${fakeBinDir}${path.delimiter}${process.env.PATH || ''}`,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function createForbiddenServerBinDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-desktop-package-smoke-'));
  const script = [
    '#!/bin/sh',
    'echo "[desktop package smoke] forbidden server command: $0 $@" >&2',
    'exit 97',
    '',
  ].join('\n');

  for (const commandName of ['next', 'npm', 'npx', 'pnpm', 'yarn']) {
    const commandPath = path.join(dir, commandName);
    fs.writeFileSync(commandPath, script, 'utf8');
    fs.chmodSync(commandPath, 0o755);
  }

  return dir;
}

async function createPackageSmokeAsar() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-desktop-package-app-'));
  const source = path.join(root, 'source');
  const resources = path.join(root, 'resources');
  const asarPath = path.join(resources, 'app.asar');
  fs.mkdirSync(resources, { recursive: true });
  fs.mkdirSync(source, { recursive: true });
  for (const fileName of ['package.json', 'main.cjs', 'preload.cjs', 'scan-worker.cjs']) {
    fs.copyFileSync(path.join(desktopDir, fileName), path.join(source, fileName));
  }
  fs.cpSync(path.join(desktopDir, 'renderer'), path.join(source, 'renderer'), { recursive: true });
  for (const dirName of ['assets', 'icons']) {
    const dir = path.join(desktopDir, dirName);
    if (fs.existsSync(dir)) {
      fs.cpSync(dir, path.join(source, dirName), { recursive: true });
    }
  }

  const asar = require(require.resolve('@electron/asar', { paths: [desktopDir] }));
  await asar.createPackageWithOptions(source, asarPath, {});
  if (!fs.existsSync(asarPath)) {
    throw new Error('desktop package smoke failed to create app.asar');
  }
  return { root, asarPath };
}

function createPackageSmokeResources() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-desktop-package-resources-'));
  const source = path.join(repoRoot, 'packages/media-clean-engine');
  const target = path.join(dir, 'media-clean-engine');
  const nativePath = path.join(source, 'native/mc_recognition_node.node');
  if (!fs.existsSync(nativePath)) {
    throw new Error('native engine missing before package smoke. Run: npm run engine:napi:build');
  }
  fs.mkdirSync(target, { recursive: true });
  for (const fileName of ['package.json', 'index.cjs', 'index.d.ts']) {
    fs.copyFileSync(path.join(source, fileName), path.join(target, fileName));
  }
  fs.cpSync(path.join(source, 'native'), path.join(target, 'native'), { recursive: true });
  fs.copyFileSync(path.join(desktopDir, 'scan-worker.cjs'), path.join(dir, 'scan-worker.cjs'));
  return dir;
}

function cleanupFakeBin(fakeBinDir) {
  if (!fakeBinDir) return;
  fs.rmSync(fakeBinDir, { recursive: true, force: true });
}

function cleanupPackageSmokeResources(resourcesDir) {
  if (!resourcesDir) return;
  fs.rmSync(resourcesDir, { recursive: true, force: true });
}

function cleanupPackageSmokeAsar(smokeApp) {
  if (!smokeApp?.root) return;
  fs.rmSync(smokeApp.root, { recursive: true, force: true });
}

function parseSmokeJson(stdout) {
  const candidates = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('{') && line.endsWith('}'))
    .reverse();

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === 'object' && 'ok' in parsed) {
        return parsed;
      }
    } catch {
      // Continue looking for the smoke payload.
    }
  }

  throw new Error('desktop smoke did not print a JSON payload with ok');
}

function assertPackageSmokeJson(smoke) {
  if (smoke.ok !== true) {
    throw new Error('desktop package smoke did not report ok=true');
  }

  const hasStaticRenderer = smoke.rendererMode === 'static';
  const hasPackagedMarker = smoke.packagedLike === true || smoke.packageSmoke === true;
  if (!hasStaticRenderer && !hasPackagedMarker) {
    throw new Error('desktop package smoke JSON must include rendererMode="static" or packagedLike=true');
  }

  assertNonNegativeCount(smoke, 'scanJobs');
  assertNonNegativeCount(smoke, 'sessions');
  if (!smoke.appPath || !String(smoke.appPath).endsWith('.asar')) {
    throw new Error(`desktop package smoke must boot Electron from app.asar, got ${smoke.appPath || '<missing>'}`);
  }
  assertRendererSmokeJson(smoke.renderer);
  assertTraySmokeJson(smoke.tray, smoke.scanJobs);
  assertIconSmokeJson(smoke.icon);
  assertNotificationSmokeJson(smoke.notifications);

  if (!smoke.packageScan || typeof smoke.packageScan !== 'object') {
    throw new Error('desktop package smoke JSON must include packageScan verification results');
  }
  if (smoke.packageScan.status !== 'completed') {
    throw new Error(`desktop package smoke scan did not complete: ${smoke.packageScan.status}`);
  }
  assertNonNegativeCount(smoke.packageScan, 'assetCount');
  assertNonNegativeCount(smoke.packageScan, 'clusterCount');
  assertNonNegativeCount(smoke.packageScan, 'reportAssetCount');
  assertNonNegativeCount(smoke.packageScan, 'reportClusterCount');
  if (smoke.packageScan.mediaStatus !== 200) {
    throw new Error(`desktop package smoke media protocol returned ${smoke.packageScan.mediaStatus}`);
  }
  if (smoke.packageScan.trashStatus !== 'dry-run') {
    throw new Error(`desktop package smoke cleanup dry-run returned ${smoke.packageScan.trashStatus}`);
  }
  if (!smoke.packageScan.engineSource || typeof smoke.packageScan.engineSource !== 'string') {
    throw new Error('desktop package smoke JSON must include packageScan.engineSource');
  }
  if (smoke.packageScan.workerMode !== 'child-process') {
    throw new Error(`desktop package smoke must scan through child process worker, got ${smoke.packageScan.workerMode || '<missing>'}`);
  }
  if (smoke.packageScan.jobCount !== 2) {
    throw new Error(`desktop package smoke must verify multi-directory scan jobs, got ${smoke.packageScan.jobCount || '<missing>'}`);
  }
  if (!Array.isArray(smoke.packageScan.workerModes) || smoke.packageScan.workerModes.some((mode) => mode !== 'child-process')) {
    throw new Error(`desktop package smoke multi-directory worker modes are invalid: ${JSON.stringify(smoke.packageScan.workerModes || [])}`);
  }
  const engineSource = normalizePath(smoke.packageScan.engineSource);
  const repoEngineSource = normalizePath(path.join(repoRoot, 'packages/media-clean-engine'));
  if (engineSource.startsWith(repoEngineSource)) {
    throw new Error('desktop package smoke must load Rust NAPI wrapper from packaged resources, not repo packages/media-clean-engine');
  }
  if (/\/target\/debug(\/|$)/.test(engineSource)) {
    throw new Error('desktop package smoke must not load Rust NAPI directly from target/debug');
  }

  if (typeof smoke.reportOrigin === 'string' && /^http:\/\/127\.0\.0\.1[:/]/.test(smoke.reportOrigin)) {
    throw new Error('desktop package smoke JSON still reports a local HTTP renderer origin');
  }
}

function assertRendererSmokeJson(renderer) {
  if (!renderer || typeof renderer !== 'object') {
    throw new Error('desktop package smoke JSON must include renderer verification results');
  }
  if (!renderer.hasRoot || !renderer.hasTaskNavigation || !renderer.hasAuxNavigation || !renderer.hasBridge) {
    throw new Error(`desktop package smoke renderer verification failed: ${JSON.stringify(renderer)}`);
  }
  if (renderer.hasUpdatePlaceholder !== true || renderer.updateCheck?.source !== 'electron-app' || renderer.updateCheck?.status !== 'reserved') {
    throw new Error(`desktop package smoke update-check placeholder verification failed: ${JSON.stringify(renderer.updateCheck || renderer)}`);
  }
  if (renderer.hasNotificationStatus !== true || renderer.notificationStatus?.source !== 'electron-notification' || renderer.notificationStatus?.channel !== 'scan') {
    throw new Error(`desktop package smoke notification-status bridge verification failed: ${JSON.stringify(renderer.notificationStatus || renderer)}`);
  }
  if (renderer.url !== 'app://app/index.html') {
    throw new Error(`desktop package smoke renderer must load app://app/index.html, got ${renderer.url || '<missing>'}`);
  }
}

function assertTraySmokeJson(tray, scanJobs) {
  if (!tray || typeof tray !== 'object') {
    throw new Error('desktop package smoke JSON must include tray popover verification results');
  }
  if (tray.url !== 'app://app/index.html?surface=tray') {
    throw new Error(`desktop package smoke tray renderer must load app://app/index.html?surface=tray, got ${tray.url || '<missing>'}`);
  }
  if (tray.surface !== 'tray' || tray.canLoadSurface !== true || tray.hasPopoverEntry !== true || tray.hasRoot !== true) {
    throw new Error(`desktop package smoke tray surface verification failed: ${JSON.stringify(tray)}`);
  }
  if (tray.hasBridge !== true || !tray.bridgeMethods || typeof tray.bridgeMethods !== 'object') {
    throw new Error(`desktop package smoke tray bridge verification failed: ${JSON.stringify(tray)}`);
  }
  for (const method of [
	    'trayState',
	    'trayOpenWorkbench',
	    'trayOpenReview',
	    'trayOpenJobReview',
	    'trayChooseAndScan',
	    'trayPause',
    'trayNotificationStatus',
	    'trayOpenNotificationSettings',
	    'trayQuit',
    'trayClose',
  ]) {
    if (tray.bridgeMethods[method] !== true) {
      throw new Error(`desktop package smoke tray bridge missing method: ${method}`);
    }
  }
  if (tray.stateSource !== 'listScanJobs') {
    throw new Error(`desktop package smoke tray state must come from listScanJobs, got ${tray.stateSource || '<missing>'}`);
  }
  if (!Number.isInteger(tray.stateScanJobs) || tray.stateScanJobs !== scanJobs) {
    throw new Error(`desktop package smoke tray state job count mismatch: ${tray.stateScanJobs} !== ${scanJobs}`);
  }
  if (!tray.trayIcon || tray.trayIcon.source !== 'desktop-tray-icon') {
    throw new Error(`desktop package smoke tray icon summary missing: ${JSON.stringify(tray.trayIcon || null)}`);
  }
  if (tray.trayIcon.mode !== 'brand' || tray.trayIcon.taskCount !== 0 || !Array.isArray(tray.trayIcon.jobs) || tray.trayIcon.jobs.length !== 0) {
    throw new Error(`desktop package smoke tray icon must use the product logo, not a generated task chart: ${JSON.stringify(tray.trayIcon)}`);
  }
  if (!tray.trayIcon.assetPath || tray.trayIcon.fallback === true) {
    throw new Error(`desktop package smoke tray icon must resolve the product icon asset: ${JSON.stringify(tray.trayIcon)}`);
  }
  if (tray.trayIconImageIsEmpty === true || !tray.trayIconSize || tray.trayIconSize.width <= 0 || tray.trayIconSize.height <= 0) {
    throw new Error(`desktop package smoke tray icon image is invalid: ${JSON.stringify(tray)}`);
  }
}

function assertIconSmokeJson(icon) {
  if (!icon || typeof icon !== 'object') {
    throw new Error('desktop package smoke JSON must include icon verification results');
  }
  if (icon.selectedExists !== true) {
    throw new Error(`desktop smoke must select a real app icon asset: ${JSON.stringify(icon)}`);
  }
  if (icon.selectedDesktopOwned !== true) {
    throw new Error(`desktop smoke must select a desktop-owned app icon asset: ${JSON.stringify(icon)}`);
  }
  if (icon.selectedNativeImageEmpty === true || icon.runtimeImageEmpty === true) {
    throw new Error(`desktop smoke must load the selected product logo as a non-empty native image: ${JSON.stringify(icon)}`);
  }
  if (icon.desktopAssetExists !== true) {
    throw new Error(`desktop smoke must have desktop-owned app icon assets: ${JSON.stringify(icon)}`);
  }

  const selectedPath = normalizePath(icon.selectedPath || '');
  const selectedDesktopAsset = /\/apps\/desktop\/assets\/icon\.(icns|png|ico)$/.test(selectedPath);
  const selectedPackagedAsset = /\/app\.asar\/assets\/icon\.(icns|png|ico)$/.test(selectedPath);
  if (!selectedDesktopAsset && !selectedPackagedAsset) {
    throw new Error(`desktop smoke must use apps/desktop/assets or packaged assets for the app icon: ${JSON.stringify(icon)}`);
  }
  if (process.platform === 'darwin' && !/\/(?:apps\/desktop\/assets|app\.asar\/assets)\/icon\.png$/.test(selectedPath)) {
    throw new Error(`desktop smoke must use the PNG product logo at runtime on macOS; .icns is for bundle packaging: ${JSON.stringify(icon)}`);
  }
}

function assertNotificationSmokeJson(notifications) {
  if (!notifications || typeof notifications !== 'object') {
    throw new Error('desktop package smoke JSON must include notification verification results');
  }
  if (notifications.source !== 'electron-notification' || notifications.channel !== 'scan' || notifications.mode !== 'dry-run') {
    throw new Error(`desktop package smoke notification status contract is invalid: ${JSON.stringify(notifications)}`);
  }
  if (notifications.suppressedInSmoke !== true || notifications.suppressed !== true || notifications.canShow !== false || notifications.suppressedReason !== 'smoke') {
    throw new Error(`desktop package smoke must dry-run and suppress product scan notifications: ${JSON.stringify(notifications)}`);
  }
  if (notifications.appBundleId !== 'com.mediaclean.desktop') {
    throw new Error(`desktop package smoke notification app identity is invalid: ${JSON.stringify(notifications)}`);
  }
  const settingsTarget = String(notifications.settingsTarget || '');
  const requiresSettingsTarget = process.platform === 'darwin' || process.platform === 'win32';
  const hasPlatformSettingsTarget = /Notifications-Settings\.extension|ms-settings:notifications/.test(settingsTarget);
  if (requiresSettingsTarget && !hasPlatformSettingsTarget) {
    throw new Error(`desktop package smoke notification settings target is invalid: ${JSON.stringify(notifications)}`);
  }
  if (notifications.clickTarget !== 'review-result-or-workbench') {
    throw new Error(`desktop package smoke notification click target is invalid: ${JSON.stringify(notifications)}`);
  }
  if (!/扫描通知|scan notification/i.test(String(notifications.title || ''))) {
    throw new Error(`desktop package smoke notification title must use scan notification copy: ${JSON.stringify(notifications)}`);
  }
}

function assertNonNegativeCount(smoke, key) {
  if (!Number.isInteger(smoke[key]) || smoke[key] < 0) {
    throw new Error(`desktop package smoke JSON must include non-negative integer ${key}`);
  }
}

function assertNoForbiddenServerCommand(result) {
  const combined = `${result.stdout}\n${result.stderr}`;
  if (combined.includes('[desktop package smoke] forbidden server command:')) {
    throw new Error('desktop package smoke attempted to start a forbidden Next/server command');
  }
}

function normalizePath(input) {
  return path.resolve(String(input)).replaceAll(path.sep, '/');
}
