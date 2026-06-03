const {
  app,
  BrowserWindow,
  Notification,
  Tray,
  dialog,
  ipcMain,
  nativeImage,
  protocol,
  screen,
  shell,
  systemPreferences,
} = require('electron');
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { Readable } = require('node:stream');
const { fileURLToPath, pathToFileURL } = require('node:url');
const zlib = require('node:zlib');

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
    },
  },
]);

const repoRoot = path.resolve(__dirname, '..', '..');
const rendererSourceRoot = path.join(__dirname, 'renderer');
const rendererDistRoot = path.join(rendererSourceRoot, 'dist');
const rendererRoot = fs.existsSync(path.join(rendererDistRoot, 'index.html'))
  ? rendererDistRoot
  : rendererSourceRoot;
const reportPort = String(process.env.MC_REPORT_PORT || '4310');
const reportOrigin = `http://127.0.0.1:${reportPort}`;
const reportUrl = `${reportOrigin}/`;
const packagedLike = process.env.MC_DESKTOP_PACKAGED_LIKE === '1' || process.env.MC_DESKTOP_PACKAGE_SMOKE === '1';
const requestedRendererMode = process.env.MC_DESKTOP_RENDERER_MODE || process.env.MC_DESKTOP_RENDERER || '';
const rendererMode = requestedRendererMode === 'server' && !packagedLike ? 'server' : 'static';
const smokeMode = process.env.MC_DESKTOP_SMOKE === '1';
const pollIntervalMs = Number(process.env.MC_DESKTOP_POLL_MS || '1500');
const trayPopoverWidth = 720;
const trayPopoverMaxHeight = 760;
const trayPopoverFadeDurationMs = 150;
const appIconAssetPath = resolveIconAssetPath();
const productName = 'Media Clean';
const productBundleId = 'com.mediaclean.desktop';
let trayPopoverFadeTimer = null;
const mainCopy = {
  'zh-CN': {
    noActiveScan: '无活跃扫描',
    scanningCount: (count, percent) => `扫描中 ${count} 个 · ${percent}%`,
    completedCount: (count) => `已完成 ${count} 个`,
    failedCount: (count) => `失败 ${count} 个`,
    updatePlaceholder: '当前先显示本机桌面版信息；有可用更新时会在这里提示。',
    scanNotificationTitle: 'Media Clean 扫描通知',
    scanNotificationProbe: '通知已准备好。可以在系统设置中管理扫描提醒。',
    selectedDirectory: '所选目录',
    scanCompletedReady: (directoryName, reviewCount) => `${directoryName} 已准备好，${reviewCount} 个项目可审阅。`,
    scanCompletedNoCandidates: (directoryName) => `${directoryName} 已完成扫描，审阅结果已准备好。`,
    scanStartFailedTitle: '扫描任务启动失败',
    chooseDirectoriesTitle: '选择要扫描的媒体目录',
  },
  'en-US': {
    noActiveScan: 'No active scan',
    scanningCount: (count, percent) => `${count} scanning · ${percent}%`,
    completedCount: (count) => `${count} completed`,
    failedCount: (count) => `${count} failed`,
    updatePlaceholder: 'This version is ready to use. Available desktop updates will appear here.',
    scanNotificationTitle: 'Media Clean scan notification',
    scanNotificationProbe: 'Notifications are ready. You can manage scan alerts in System Settings.',
    selectedDirectory: 'Selected folder',
    scanCompletedReady: (directoryName, reviewCount) => `${directoryName} is ready with ${reviewCount} items to review.`,
    scanCompletedNoCandidates: (directoryName) => `${directoryName} finished scanning and review results are ready.`,
    scanStartFailedTitle: 'Scan task failed to start',
    chooseDirectoriesTitle: 'Choose media folders to scan',
  },
};

let mainWindow = null;
let trayPopoverWindow = null;
let trayPopoverLoadPromise = null;
let tray = null;
let reportProcess = null;
let pollTimer = null;
let database = null;
let lastJobs = [];
let notifiedCompletedJobs = new Set();
let isQuitting = false;
let lastTrayIconKey = '';
let lastTrayIconImage = null;

const jobs = new Map();

app.setName(productName);

app
  .whenReady()
  .then(async () => {
    applyProductIdentity();
    registerIpcHandlers();
    registerAppProtocol();
    if (rendererMode === 'server') {
      await ensureReportServer();
    }
    await createMainWindow();
    createTray();
    if (smokeMode) {
      await ensureTrayPopoverWindow();
    }
    startScanPolling();

    if (smokeMode) {
      await runSmokeCheck();
      app.quit();
    }
  })
  .catch((error) => {
    console.error('[media-clean-desktop] startup failed', error);
    app.exit(1);
  });

function applyProductIdentity() {
  app.setName(productName);
  app.setAppUserModelId(productBundleId);
  if (process.platform !== 'darwin' || !app.dock) return;

  const image = appIconImage(256);
  if (!image.isEmpty()) app.dock.setIcon(image);
}

app.on('activate', () => {
  if (!mainWindow) {
    void createMainWindow();
    return;
  }
  showMainWindow();
});

app.on('before-quit', () => {
  isQuitting = true;
  markIntentionalQuit();
  if (pollTimer) clearInterval(pollTimer);
  if (reportProcess && !reportProcess.killed) {
    reportProcess.kill('SIGTERM');
  }
  for (const job of jobs.values()) {
    if (job.worker && !job.worker.killed) job.worker.kill('SIGTERM');
  }
  if (database) {
    database.close?.();
    database = null;
  }
});

async function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 920,
    minWidth: 1280,
    minHeight: 680,
    show: !smokeMode,
    title: 'Media Clean',
    backgroundColor: '#edf4ff',
    icon: appIconImage(256),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.on('close', (event) => {
    if (smokeMode || isQuitting) return;
    event.preventDefault();
    mainWindow.hide();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('app://')) return { action: 'allow' };
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  await mainWindow.loadURL(rendererMode === 'server' ? reportUrl : 'app://app/index.html');
  return mainWindow;
}

function createTray() {
  try {
    tray = new Tray(trayIconImage([]));
    tray.setToolTip(productName);
	    tray.on('click', () => {
	      void toggleTrayPopover();
	    });
	    tray.on('right-click', () => {
	      void toggleTrayPopover();
	    });
	    updateTrayIndicator([]);
  } catch (error) {
    console.warn(
      '[media-clean-desktop] tray unavailable:',
      error instanceof Error ? error.message : String(error),
    );
  }
}

async function toggleTrayPopover() {
  if (!tray) return;
  try {
    const popover = await ensureTrayPopoverWindow();
    if (popover.isVisible()) {
      hideTrayPopover();
      return;
    }
    await showTrayPopover(popover);
	  } catch (error) {
	    console.warn(
	      '[media-clean-desktop] tray popover unavailable:',
	      error instanceof Error ? error.message : String(error),
	    );
	    showMainWindow();
	  }
	}

async function ensureTrayPopoverWindow() {
  if (trayPopoverWindow && !trayPopoverWindow.isDestroyed()) {
    if (trayPopoverLoadPromise) await trayPopoverLoadPromise;
    return trayPopoverWindow;
  }

  trayPopoverWindow = new BrowserWindow({
    width: trayPopoverWidth,
    height: trayPopoverMaxHeight,
    show: false,
    frame: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    transparent: false,
    hasShadow: true,
    roundedCorners: true,
    title: 'Media Clean Tray',
    backgroundColor: '#fbfdff',
    icon: appIconImage(128),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  trayPopoverWindow.setSkipTaskbar(true);
  trayPopoverWindow.setAlwaysOnTop(true, 'floating');
  trayPopoverWindow.on('blur', () => {
    if (!smokeMode) hideTrayPopover();
  });
  trayPopoverWindow.on('closed', () => {
    trayPopoverWindow = null;
    trayPopoverLoadPromise = null;
  });
  trayPopoverWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'Escape') {
      event.preventDefault();
      hideTrayPopover();
    }
  });
  trayPopoverWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('app://')) return { action: 'allow' };
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  trayPopoverLoadPromise = trayPopoverWindow
    .loadURL(trayPopoverUrl())
    .then(() => {
      trayPopoverWindow?.webContents.send('tray:changed', buildTrayState());
    })
    .catch((error) => {
      if (trayPopoverWindow && !trayPopoverWindow.isDestroyed()) {
        trayPopoverWindow.destroy();
      }
      throw error;
    })
    .finally(() => {
      trayPopoverLoadPromise = null;
    });
  await trayPopoverLoadPromise;
  return trayPopoverWindow;
}

async function showTrayPopover(popover = trayPopoverWindow) {
  if (!popover || popover.isDestroyed()) return;
  popover.webContents.send('tray:changed', buildTrayState());
  await resizeAndPositionTrayPopover(popover);
  clearTrayPopoverFade();
  const reduceMotion = shouldReduceTrayPopoverMotion();
  popover.setOpacity(reduceMotion ? 1 : 0);
  if (popover.isMinimized()) popover.restore();
  popover.show();
  popover.focus();
  popover.webContents.send('tray:shown');
  if (!reduceMotion) fadeInTrayPopover(popover);
}

function hideTrayPopover() {
  if (!trayPopoverWindow || trayPopoverWindow.isDestroyed()) return false;
  clearTrayPopoverFade();
  trayPopoverWindow.setOpacity(1);
  trayPopoverWindow.hide();
  return true;
}

function clearTrayPopoverFade() {
  if (trayPopoverFadeTimer == null) return;
  clearTimeout(trayPopoverFadeTimer);
  trayPopoverFadeTimer = null;
}

function shouldReduceTrayPopoverMotion() {
  if (smokeMode) return true;
  if (process.platform !== 'darwin') return false;
  try {
    return Boolean(systemPreferences.getUserDefault('com.apple.AccessibilityReduceMotion', 'boolean'));
  } catch {
    return false;
  }
}

function fadeInTrayPopover(popover) {
  const startedAt = Date.now();
  const step = () => {
    if (!popover || popover.isDestroyed() || !popover.isVisible()) {
      trayPopoverFadeTimer = null;
      return;
    }
    const elapsed = Date.now() - startedAt;
    const progress = Math.min(1, elapsed / trayPopoverFadeDurationMs);
    const eased = 1 - Math.pow(1 - progress, 4);
    popover.setOpacity(eased);
    if (progress >= 1) {
      popover.setOpacity(1);
      trayPopoverFadeTimer = null;
      return;
    }
    trayPopoverFadeTimer = setTimeout(step, 16);
  };
  step();
}

function positionTrayPopover(popover) {
  resizeAndPositionTrayPopover(popover).catch((error) => {
    console.warn(
      '[media-clean-desktop] tray popover resize failed:',
      error instanceof Error ? error.message : String(error),
    );
  });
}

async function resizeAndPositionTrayPopover(popover) {
  if (!popover || popover.isDestroyed()) return;
  const size = await preferredTrayPopoverSize(popover);
  const display = tray ? screen.getDisplayMatching(tray.getBounds()) : screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const workArea = display.workArea;
  const anchor = tray?.getBounds();
  const fallbackPoint = screen.getCursorScreenPoint();
  const anchorX = Number.isFinite(anchor?.x) ? anchor.x : fallbackPoint.x;
  const anchorY = Number.isFinite(anchor?.y) ? anchor.y : fallbackPoint.y;
  const anchorWidth = Number.isFinite(anchor?.width) ? anchor.width : 0;
  const anchorHeight = Number.isFinite(anchor?.height) ? anchor.height : 0;
  const margin = 8;
  const unclampedX = Math.round(anchorX + anchorWidth / 2 - size.width / 2);
  const topAnchored = anchorY < workArea.y + workArea.height / 2;
  const unclampedY = topAnchored
    ? Math.round(anchorY + anchorHeight + margin)
    : Math.round(anchorY - size.height - margin);
  const x = clamp(unclampedX, workArea.x + margin, workArea.x + workArea.width - size.width - margin);
  const y = clamp(unclampedY, workArea.y + margin, workArea.y + workArea.height - size.height - margin);
  popover.setBounds({ x, y, width: size.width, height: size.height });
}

async function preferredTrayPopoverSize(popover) {
  try {
    const size = await popover.webContents.executeJavaScript(
      `(async () => {
        await new Promise((resolve) => setTimeout(resolve, 32));
        const island = document.querySelector('.tray-island');
        if (!island) return null;
        const rect = island.getBoundingClientRect();
        return {
          width: Math.ceil(Math.max(rect.width, island.scrollWidth || 0)),
          height: Math.ceil(Math.max(rect.height, island.scrollHeight || 0))
        };
      })()`,
      true,
    );
    return {
      width: trayPopoverWidth,
      height: clamp(Math.ceil(Number(size?.height) || trayPopoverMaxHeight), 360, trayPopoverMaxHeight),
    };
  } catch {
    return { width: trayPopoverWidth, height: trayPopoverMaxHeight };
  }
}

function trayPopoverUrl() {
  return rendererMode === 'server' ? `${reportUrl}?surface=tray` : 'app://app/index.html?surface=tray';
}

function registerIpcHandlers() {
  ipcMain.handle('desktop:version', () => electronAppVersion());
  ipcMain.handle('desktop:renderer-mode', () => rendererMode);
  ipcMain.handle('desktop:update-check', () => checkForUpdate());
  ipcMain.handle('desktop:notification-status', () => notificationStatus());
  ipcMain.handle('desktop:open-notification-settings', () => openNotificationSettings());
  ipcMain.handle('desktop:open-home', () => {
    showMainWindow();
    mainWindow?.webContents.send('desktop:navigate-home');
  });
  ipcMain.handle('tray:state', () => buildTrayState());
  ipcMain.handle('tray:open-workbench', () => {
    hideTrayPopover();
    showMainWindow();
    return buildTrayState();
  });
  ipcMain.handle('tray:open-review', () => {
    hideTrayPopover();
    showReviewWindow();
    return buildTrayState();
  });
  ipcMain.handle('tray:open-job-review', (_event, input) => {
    hideTrayPopover();
    showReportWindow(input);
    return buildTrayState();
  });
  ipcMain.handle('tray:choose-and-scan', async () => {
    hideTrayPopover();
    await chooseDirectoriesAndScan();
    return buildTrayState();
  });
  ipcMain.handle('tray:pause', () => {
    cancelActiveScanJobs();
    return buildTrayState();
  });
  ipcMain.handle('tray:notification-status', () => notificationStatus());
  ipcMain.handle('tray:open-notification-settings', () => openNotificationSettings());
  ipcMain.handle('tray:quit', () => {
    app.quit();
  });
  ipcMain.handle('tray:close', () => hideTrayPopover());
  ipcMain.handle('dialog:choose-directories', chooseDirectories);
  ipcMain.handle('directories:list', (_event, input = {}) => listDirectories(input.path));
  ipcMain.handle('scan:start', (_event, input) => startScan(input));
  ipcMain.handle('scan:list', () => listScanJobs());
  ipcMain.handle('scan:cancel', (_event, jobId) => cancelScanJob(jobId));
  ipcMain.handle('sessions:list', (_event, input = {}) => listSessions(input.limit));
  ipcMain.handle('sessions:delete', (_event, input) => deleteSession(input));
  ipcMain.handle('report:load', (_event, input) => loadReport(input));
  ipcMain.handle('trash:confirm', (_event, input) => confirmTrash(input));
  ipcMain.handle('media:url', (_event, assetId) => mediaUrl(assetId));
  ipcMain.handle('media:poster-url', (_event, assetId) => posterUrl(assetId));
}

function registerAppProtocol() {
  protocol.handle('app', async (request) => {
    const url = new URL(request.url);
    if (url.hostname === 'media') return mediaResponse(decodeURIComponent(url.pathname.slice(1)), request);
    if (url.hostname === 'poster') return posterResponse(decodeURIComponent(url.pathname.slice(1)));
    return staticResponse(url);
  });
}

function startScanPolling() {
  const poll = () => {
    try {
	      const jobs = listScanJobs();
	      lastJobs = jobs;
	      updateTrayIndicator(jobs);
	      updateWindowProgress(jobs);
      notifyCompletedJobs(jobs);
      broadcastScanState(jobs);
    } catch (error) {
      if (tray) {
        tray.setToolTip(
          `${productName}\nscan state unavailable: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  };

  poll();
  pollTimer = setInterval(poll, pollIntervalMs);
}

function broadcastScanState(jobs = listScanJobs()) {
  const trayState = buildTrayState(jobs);
  for (const window of [mainWindow, trayPopoverWindow]) {
    if (!window || window.isDestroyed()) continue;
    window.webContents.send('scan:changed', jobs);
    window.webContents.send('tray:changed', trayState);
  }
  if (trayPopoverWindow && !trayPopoverWindow.isDestroyed() && trayPopoverWindow.isVisible()) {
    void resizeAndPositionTrayPopover(trayPopoverWindow);
  }
}

function updateTrayIndicator(jobs) {
  if (!tray) return;

  const activeJobs = jobs.filter((job) => isRunning(job.status));
  const completedJobs = jobs.filter((job) => job.status === 'completed');
  const failedJobs = jobs.filter((job) => job.status === 'failed');
  const aggregatePercent = aggregateProgress(activeJobs);
  const trayTitle = activeJobs.length > 0 ? `MC ${aggregatePercent}%` : '';
  const copy = getMainCopy();

  try {
    tray.setImage(trayIconImage(jobs));
  } catch (error) {
    console.warn(
      '[media-clean-desktop] tray icon update failed:',
      error instanceof Error ? error.message : String(error),
    );
  }

  if (process.platform === 'darwin') {
    tray.setTitle(trayTitle);
  }

  tray.setToolTip(
    [
      productName,
      activeJobs.length > 0 ? copy.scanningCount(activeJobs.length, aggregatePercent) : copy.noActiveScan,
      completedJobs.length > 0 ? copy.completedCount(completedJobs.length) : null,
      failedJobs.length > 0 ? copy.failedCount(failedJobs.length) : null,
    ]
	      .filter(Boolean)
	      .join('\n'),
	  );
}

function showReviewWindow() {
  showMainWindow();
  mainWindow?.webContents.send('desktop:navigate-review');
}

function showReportWindow(input) {
  showMainWindow();
  mainWindow?.webContents.send('desktop:open-report', normalizeReportInput(input));
}

function normalizeReportInput(input = {}) {
  return {
    sessionId: input.sessionId || input.id || null,
    sessionPath: input.sessionPath || input.session || input.path || null,
    cleanupPlanPath: input.cleanupPlanPath || input.cleanupPlan || input.planPath || null,
  };
}

function electronAppVersion() {
  const appVersion = app.getVersion();
  if (appVersion) return String(appVersion);

  const candidates = [
    path.join(__dirname, 'package.json'),
    path.join(repoRoot, 'apps', 'desktop', 'package.json'),
  ];
  for (const candidate of candidates) {
    try {
      if (!fs.existsSync(candidate)) continue;
      const parsed = JSON.parse(fs.readFileSync(candidate, 'utf8'));
      if (parsed?.version) return String(parsed.version);
    } catch {
      // Keep the bridge stable if Electron metadata is unavailable in smoke builds.
    }
  }
  return '0.0.0';
}

function getMainCopy() {
  const locale = normalizeDesktopLocale(app.getLocale?.() || Intl.DateTimeFormat().resolvedOptions().locale);
  return mainCopy[locale];
}

function normalizeDesktopLocale(locale) {
  const normalized = String(locale || '').replace('_', '-').toLowerCase();
  if (normalized.startsWith('en')) return 'en-US';
  return 'zh-CN';
}

function checkForUpdate() {
  const currentVersion = electronAppVersion();
  const checkedAt = new Date().toISOString();
  return {
    source: 'electron-app',
    status: 'reserved',
    provider: 'pending-release-workflow',
    releaseChannel: 'stable',
    currentVersion,
    latestVersion: null,
    latestTag: null,
    releaseUrl: null,
    workflow: null,
    canUpdate: false,
    checkedAt,
    message: getMainCopy().updatePlaceholder,
  };
}

async function openNotificationSettings() {
  primeNotificationRegistration();
  for (const settingsUrl of notificationSettingsUrls()) {
    try {
      await shell.openExternal(settingsUrl);
      return true;
    } catch {
      // Try the next platform URL or the app fallback below.
    }
  }
  if (process.platform === 'darwin') {
    await shell.openPath('/System/Applications/System Settings.app');
    return true;
  }
  return false;
}

function notificationSettingsUrls() {
  if (process.platform === 'darwin') {
    return [
      `x-apple.systempreferences:com.apple.Notifications-Settings.extension?id=${encodeURIComponent(productBundleId)}`,
      'x-apple.systempreferences:com.apple.preference.notifications',
    ];
  }
  if (process.platform === 'win32') return ['ms-settings:notifications'];
  return [];
}

function primeNotificationRegistration() {
  if (!canShowProductNotification()) return false;
  const notification = new Notification({
    title: getMainCopy().scanNotificationTitle,
    body: getMainCopy().scanNotificationProbe,
    icon: appIconImage(64),
    silent: true,
  });
  notification.show();
  return true;
}

function markIntentionalQuit() {
  if (smokeMode) return;
  try {
    const userData = app.getPath('userData');
    fs.mkdirSync(userData, { recursive: true });
    fs.writeFileSync(path.join(userData, 'intentional-quit'), String(Date.now()), 'utf8');
  } catch (error) {
    console.warn(
      '[media-clean-desktop] failed to write intentional quit marker:',
      error instanceof Error ? error.message : String(error),
    );
  }
}

function buildTrayState(jobs = listScanJobs()) {
  const activeJobs = jobs.filter((job) => isRunning(job.status));
  const completedJobs = jobs.filter((job) => job.status === 'completed');
  const failedJobs = jobs.filter((job) => job.status === 'failed');
  const latestCompletedJob = completedJobs[0] ?? null;
  return {
    source: 'listScanJobs',
    updatedAt: new Date().toISOString(),
    jobs,
    activeJobs,
    completedJobs,
    failedJobs,
    activeCount: activeJobs.length,
    completedCount: completedJobs.length,
    failedCount: failedJobs.length,
    scanJobs: jobs.length,
    aggregatePercent: aggregateProgress(activeJobs),
    isScanning: activeJobs.length > 0,
    canPause: activeJobs.length > 0,
    canReview: completedJobs.length > 0,
    latestCompletedJob,
    trayIcon: buildTrayIconSummary(jobs),
  };
}

function cancelActiveScanJobs() {
  for (const job of lastJobs) {
    if (isRunning(job.status) && job.jobId) cancelScanJob(job.jobId);
  }
	  lastJobs = listScanJobs();
	  updateTrayIndicator(lastJobs);
	  broadcastScanState(lastJobs);
	}

function updateWindowProgress(jobs) {
  const activeJobs = jobs.filter((job) => isRunning(job.status));
  if (!mainWindow) return;
  if (activeJobs.length === 0) {
    mainWindow.setProgressBar(-1);
    if (process.platform === 'darwin' && app.dock) app.dock.setBadge('');
    return;
  }

  const percent = aggregateProgress(activeJobs);
  mainWindow.setProgressBar(percent / 100);
  if (process.platform === 'darwin' && app.dock) {
    app.dock.setBadge(String(activeJobs.length));
  }
}

function notifyCompletedJobs(jobs) {
  for (const job of jobs) {
    const key = scanNotificationKey(job);
    if (job.status !== 'completed' || notifiedCompletedJobs.has(key)) continue;
    notifiedCompletedJobs.add(key);
    showScanCompletedNotification(job);
  }
}

function scanNotificationKey(job) {
  return String(job.jobId || job.sessionId || job.session || job.root || `completed-${notifiedCompletedJobs.size}`);
}

function notificationSuppressedReason(supported = Notification.isSupported()) {
  if (smokeMode) return 'smoke';
  if (process.env.CI === 'true') return 'ci';
  if (process.env.MC_DESKTOP_NOTIFICATIONS === '0') return 'disabled';
  if (!supported) return 'unsupported';
  return null;
}

function canShowProductNotification(supported = Notification.isSupported()) {
  return notificationSuppressedReason(supported) === null;
}

function notificationStatus() {
  const supported = Notification.isSupported();
  const suppressedReason = notificationSuppressedReason(supported);
  return {
    source: 'electron-notification',
    channel: 'scan',
    mode: 'dry-run',
    supported,
    canShow: suppressedReason === null,
    suppressed: suppressedReason !== null,
    suppressedInSmoke: smokeMode,
    suppressedReason,
    appBundleId: productBundleId,
    settingsTarget: notificationSettingsUrls()[0] || null,
    clickTarget: 'review-result-or-workbench',
    title: getMainCopy().scanNotificationTitle,
  };
}

function showScanCompletedNotification(job) {
  if (!canShowProductNotification()) return false;

  const notification = new Notification({
    title: getMainCopy().scanNotificationTitle,
    body: scanCompletedNotificationBody(job),
    icon: appIconImage(64),
  });
  notification.on('click', () => {
    if (job.session || job.cleanupPlan || job.sessionPath || job.cleanupPlanPath) {
      showReportWindow(job);
      return;
    }
    showReviewWindow();
  });
  notification.show();
  return true;
}

function scanCompletedNotificationBody(job) {
  const copy = getMainCopy();
  const directoryName = path.basename(job.root || job.path || job.directory || copy.selectedDirectory);
  const reviewCount = Number(job.cleanupPlanCount ?? job.clusterCount ?? 0);
  if (reviewCount > 0) return copy.scanCompletedReady(directoryName, reviewCount);
  return copy.scanCompletedNoCandidates(directoryName);
}

async function chooseDirectoriesAndScan() {
  const roots = await chooseDirectories();
  if (roots.length === 0) return;

  showMainWindow();
  for (let index = 0; index < roots.length; index += 1) {
    try {
      startScanJob({
        root: roots[index],
        sessionId: desktopSessionId(index),
        mediaType: 'all',
      });
    } catch (error) {
      dialog.showErrorBox(
        getMainCopy().scanStartFailedTitle,
        `${roots[index]}\n${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

function startScan(input = {}) {
  const roots = Array.isArray(input.roots) && input.roots.length > 0 ? input.roots : [input.root];
  const filteredRoots = roots.map((root) => String(root || '').trim()).filter(Boolean);
  if (filteredRoots.length === 0) throw new Error('scan root is required');
  const jobs = filteredRoots.map((root, index) =>
    startScanJob({
      ...input,
      root,
      sessionId:
        filteredRoots.length > 1
          ? `${safeSessionId(input.sessionId || desktopSessionId(0))}-${index + 1}`
          : input.sessionId,
    }),
  );
  return jobs.length === 1 ? jobs[0] : jobs;
}

async function chooseDirectories() {
  const result = await dialog.showOpenDialog({
    title: getMainCopy().chooseDirectoriesTitle,
    properties: ['openDirectory', 'multiSelections', 'createDirectory'],
  });
  return result.canceled ? [] : result.filePaths;
}

function showMainWindow() {
  if (!mainWindow) {
    void createMainWindow();
    return;
  }
  if (process.platform === 'darwin' && app.dock) app.dock.show();
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function startScanJob(input = {}) {
  const root = resolveInputPath(String(input.root || '').trim());
  const stat = fs.statSync(root);
  if (!stat.isDirectory()) {
    throw new Error(`scan root must be a directory: ${root}`);
  }

  const sessionId = safeSessionId(input.sessionId || `mc-desktop-${Date.now()}`);
  const jobId = `job-${sessionId}-${Date.now().toString(36)}`;
  const sessionDir = path.join(sessionArtifactsRoot(), sessionId);
  const now = new Date().toISOString();
  const job = {
    jobId,
    sessionId,
    root,
    mediaType: input.mediaType || 'all',
    status: 'queued',
    phase: 'queued',
    session: path.join(sessionDir, 'session.json'),
    cleanupPlan: path.join(sessionDir, 'cleanup-plan.json'),
    progress: { processed: 0, total: 0, percent: 0 },
    logs: [],
    startedAt: now,
    updatedAt: now,
  };

  jobs.set(jobId, job);
  persistDesktopJob(job);
  setImmediate(() => {
    void runScanJob(job);
  });
  return snapshotJob(job);
}

async function runScanJob(job) {
  let worker = null;
  try {
    fs.mkdirSync(path.dirname(job.session), { recursive: true });
    updateJob(job, {
      status: 'scanning',
      phase: 'scanning',
      workerMode: 'child-process',
    });

    const workerInput = {
      root: job.root,
      sessionId: job.sessionId,
      sessionPath: job.session,
      cleanupPlanPath: job.cleanupPlan,
      mediaType: job.mediaType,
      enginePackagePath: enginePackageRoot(),
    };

    worker = spawn(process.execPath, [scanWorkerPath(), Buffer.from(JSON.stringify(workerInput), 'utf8').toString('base64')], {
      cwd: repoRoot,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        MC_ENGINE_PACKAGE_PATH: workerInput.enginePackagePath,
      },
      stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
    });
    job.worker = worker;
    const result = await waitForScanWorker(job, worker);

    if (job.status === 'canceled') return;

    const session = readJson(job.session);
    const cleanupPlan = readJson(job.cleanupPlan);
    persistReportRuntime({
      sessionPath: job.session,
      cleanupPlanPath: job.cleanupPlan,
      session,
      cleanupPlan,
      source: 'mc',
      cleanupHistory: { assetCount: 0, fileSize: 0 },
    });

    updateJob(job, {
      assetCount: result.assetCount ?? session.assets.length,
      clusterCount: result.clusterCount ?? session.clusters.length,
      cleanupPlanCount: result.cleanupPlanCount ?? cleanupPlan.plans.length,
      diagnosticCount: result.diagnosticCount ?? session.diagnostics?.length ?? 0,
      progress: {
        processed: session.assets.length,
        total: session.assets.length,
        percent: 100,
      },
      status: 'completed',
      phase: 'completed',
      workerMode: 'child-process',
      completedAt: new Date().toISOString(),
    });
  } catch (error) {
    if (job.status === 'canceled') return;
    updateJob(job, {
      status: 'failed',
      phase: 'failed',
      error: error instanceof Error ? error.message : String(error),
      completedAt: new Date().toISOString(),
    });
  } finally {
    if (worker && job.worker === worker) job.worker = null;
  }
}

function updateJob(job, patch) {
  Object.assign(job, patch, { updatedAt: new Date().toISOString() });
  persistDesktopJob(job);
  broadcastScanState(listScanJobs());
}

function waitForScanWorker(job, worker) {
  return new Promise((resolve, reject) => {
    let finalResult = null;
    let finalError = null;
    let stderrBuffer = '';

    worker.on('message', (message) => {
      if (!message || typeof message !== 'object') return;
      if (message.type === 'complete') {
        finalResult = message.result || {};
      } else if (message.type === 'error') {
        finalError = new Error(message.error || 'scan worker failed');
      }
    });

    worker.stderr?.on('data', (chunk) => {
      stderrBuffer += chunk.toString();
      const lines = stderrBuffer.split(/\r?\n/);
      stderrBuffer = lines.pop() || '';
      for (const line of lines) updateScanProgressFromLog(job, line);
    });

    worker.on('error', reject);
    worker.on('close', (code, signal) => {
      if (stderrBuffer.trim()) updateScanProgressFromLog(job, stderrBuffer.trim());
      if (job.status === 'canceled') {
        resolve({});
        return;
      }
      if (finalError) {
        reject(finalError);
        return;
      }
      if (code === 0) {
        resolve(finalResult || {});
        return;
      }
      reject(new Error(`scan worker exited with ${signal || code}`));
    });
  });
}

function updateScanProgressFromLog(job, line) {
  const text = String(line || '').trim();
  if (!text) return;
  job.logs = [...(job.logs || []), text].slice(-40);

  const processedMatch = /processed=(\d+)\/(\d+).*assets=(\d+).*diagnostics=(\d+)/.exec(text);
  if (processedMatch) {
    const processed = Number(processedMatch[1]);
    const total = Number(processedMatch[2]);
    job.assetCount = Number(processedMatch[3]);
    job.diagnosticCount = Number(processedMatch[4]);
    const percent = total > 0 ? Math.min(99, Math.round((processed / total) * 100)) : 0;
    updateJobProgress(job, {
      processed,
      total,
      percent,
    });
    return;
  }

  const rootMatch = /root=.*assets=(\d+)/.exec(text);
  if (rootMatch) {
    const total = Number(rootMatch[1]);
    updateJobProgress(job, {
      processed: 0,
      total,
      percent: 0,
    });
    return;
  }

  const analyzeMatch = /\[mc scan\] build request complete assets=(\d+) diagnostics=(\d+)/.exec(text);
  if (analyzeMatch) {
    const total = Number(analyzeMatch[1]);
    job.assetCount = total;
    job.diagnosticCount = Number(analyzeMatch[2]);
    updateJobProgress(job, {
      processed: total,
      total,
      percent: total > 0 ? 99 : 0,
    });
    updateJob(job, {
      status: 'analyzing',
      phase: 'analyzing',
      assetCount: job.assetCount,
      diagnosticCount: job.diagnosticCount,
      progress: { ...job.progress },
      logs: job.logs || [],
    });
    return;
  }

  const now = Date.now();
  if (now - Number(job.lastLogPersistAt || 0) > 1500) {
    job.lastLogPersistAt = now;
    updateJob(job, {
      logs: job.logs,
    });
  }
}

function updateJobProgress(job, progress) {
  job.progress = {
    ...(job.progress || {}),
    ...progress,
  };
  const now = Date.now();
  if (job.progress.percent < 100 && now - Number(job.lastProgressPersistAt || 0) < 500) {
    return;
  }
  job.lastProgressPersistAt = now;
  updateJob(job, {
    phase: 'scanning',
    progress: { ...job.progress },
    logs: job.logs || [],
  });
}

function listScanJobs() {
  const memoryJobs = [...jobs.values()]
    .sort((left, right) => right.startedAt.localeCompare(left.startedAt))
    .map(snapshotJob);
  const seen = new Set(memoryJobs.map((job) => job.jobId));
  const stored = getDb()
    .prepare('SELECT * FROM desktop_scan_job ORDER BY started_at DESC LIMIT 30')
    .all()
    .filter((job) => !seen.has(String(job.job_id)))
    .map(scanJobFromRow);
  return [...memoryJobs, ...stored].slice(0, 30);
}

function cancelScanJob(jobId) {
  const job = jobs.get(String(jobId));
  if (!job) return null;
  if (job.status === 'completed' || job.status === 'failed' || job.status === 'canceled') return snapshotJob(job);
  if (job.worker && !job.worker.killed) {
    job.worker.kill('SIGTERM');
  }
  updateJob(job, {
    status: 'canceled',
    phase: 'canceled',
    completedAt: new Date().toISOString(),
  });
  return snapshotJob(job);
}

function persistDesktopJob(job) {
  const db = getDb();
  db.prepare(
    `INSERT INTO desktop_scan_job (
      job_id, session_id, root, media_type, status, phase, session_path, cleanup_plan_path,
      processed, total, percent, asset_count, cluster_count, cleanup_plan_count, diagnostic_count,
      error, logs_json, started_at, updated_at, completed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(job_id) DO UPDATE SET
      status=excluded.status,
      phase=excluded.phase,
      processed=excluded.processed,
      total=excluded.total,
      percent=excluded.percent,
      asset_count=excluded.asset_count,
      cluster_count=excluded.cluster_count,
      cleanup_plan_count=excluded.cleanup_plan_count,
      diagnostic_count=excluded.diagnostic_count,
      error=excluded.error,
      logs_json=excluded.logs_json,
      updated_at=excluded.updated_at,
      completed_at=excluded.completed_at`,
  ).run(
    job.jobId,
    job.sessionId,
    job.root,
    job.mediaType,
    job.status,
    job.phase,
    job.session,
    job.cleanupPlan,
    job.progress?.processed ?? 0,
    job.progress?.total ?? 0,
    job.progress?.percent ?? 0,
    job.assetCount ?? null,
    job.clusterCount ?? null,
    job.cleanupPlanCount ?? null,
    job.diagnosticCount ?? null,
    job.error ?? null,
    JSON.stringify(job.logs ?? []),
    job.startedAt,
    job.updatedAt,
    job.completedAt ?? null,
  );
  db.prepare(
    `INSERT INTO scan_job (
      job_id, phase, progress_current, progress_total, processed_count, candidate_count,
      started_at, last_heartbeat_at, current_file_name, last_processed_asset_id, last_error, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(job_id) DO UPDATE SET
      phase=excluded.phase,
      progress_current=excluded.progress_current,
      progress_total=excluded.progress_total,
      processed_count=excluded.processed_count,
      candidate_count=excluded.candidate_count,
      last_heartbeat_at=excluded.last_heartbeat_at,
      last_error=excluded.last_error,
      updated_at=excluded.updated_at`,
  ).run(
    job.jobId,
    job.phase,
    job.progress?.processed ?? 0,
    job.progress?.total ?? 0,
    job.progress?.processed ?? 0,
    job.cleanupPlanCount ?? job.clusterCount ?? 0,
    timestampMs(job.startedAt),
    timestampMs(job.updatedAt),
    null,
    null,
    job.error ?? null,
    timestampMs(job.updatedAt),
  );
}

function persistReportRuntime(input) {
  const db = getDb();
  const now = Date.now();
  db.exec('BEGIN IMMEDIATE');
  try {
    upsertReportSession(db, input);
    saveScanBatch(db, input, now);
    saveAssets(db, input.session, now);
    saveCandidateView(db, input.session, input.cleanupPlan, now);
    saveRecognitionGroups(db, input.session, now);
    refreshCleanupReport(db, now);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

function upsertReportSession(db, input) {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO report_session (
      session_path, cleanup_plan_path, session_id, generated_at, root, platform, source,
      asset_count, cluster_count, cleanup_plan_count, diagnostic_count,
      cleanup_asset_count, cleanup_file_size, session_json, cleanup_plan_json, indexed_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(session_path) DO UPDATE SET
      cleanup_plan_path=excluded.cleanup_plan_path,
      generated_at=excluded.generated_at,
      root=excluded.root,
      platform=excluded.platform,
      source=excluded.source,
      asset_count=excluded.asset_count,
      cluster_count=excluded.cluster_count,
      cleanup_plan_count=excluded.cleanup_plan_count,
      diagnostic_count=excluded.diagnostic_count,
      cleanup_asset_count=excluded.cleanup_asset_count,
      cleanup_file_size=excluded.cleanup_file_size,
      session_json=excluded.session_json,
      cleanup_plan_json=excluded.cleanup_plan_json,
      updated_at=excluded.updated_at`,
  ).run(
    input.sessionPath,
    input.cleanupPlanPath,
    input.session.sessionId,
    input.session.generatedAt,
    input.session.source.root,
    input.session.source.platform,
    input.source,
    input.session.assets.length,
    input.session.clusters.length,
    input.cleanupPlan?.plans.length ?? input.session.cleanupPlans.length,
    input.session.diagnostics?.length ?? 0,
    input.cleanupHistory?.assetCount ?? 0,
    input.cleanupHistory?.fileSize ?? 0,
    JSON.stringify(input.session),
    input.cleanupPlan ? JSON.stringify(input.cleanupPlan) : null,
    now,
    now,
  );
}

function saveScanBatch(db, input, now) {
  db.prepare(
    `INSERT INTO scan_batch (
      batch_id, mode, window_days, range_start_at, range_end_at, phase, progress_current,
      progress_total, enumerated_count, dirty_count, analyzed_count, candidate_count,
      started_at, last_heartbeat_at, completed_at, last_error, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(batch_id) DO UPDATE SET
      phase=excluded.phase,
      progress_current=excluded.progress_current,
      progress_total=excluded.progress_total,
      enumerated_count=excluded.enumerated_count,
      dirty_count=excluded.dirty_count,
      analyzed_count=excluded.analyzed_count,
      candidate_count=excluded.candidate_count,
      last_heartbeat_at=excluded.last_heartbeat_at,
      completed_at=excluded.completed_at,
      updated_at=excluded.updated_at`,
  ).run(
    input.session.sessionId,
    input.session.source.kind,
    null,
    null,
    null,
    'completed',
    input.session.assets.length,
    input.session.assets.length,
    input.session.assets.length,
    input.session.assets.length,
    input.session.assets.length,
    input.session.clusters.length,
    timestampMs(input.session.generatedAt),
    now,
    now,
    null,
    now,
  );
  db.prepare('DELETE FROM scan_batch_item WHERE batch_id = ?').run(input.session.sessionId);
  const statement = db.prepare(
    `INSERT INTO scan_batch_item (
      batch_id, asset_id, media_type, stage, dirty_reason, attempt_count,
      worker_slot, last_heartbeat_at, last_error, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const asset of input.session.assets) {
    statement.run(input.session.sessionId, asset.id, asset.mediaType, 'completed', 'desktop-scan', 1, null, now, null, now);
  }
}

function saveAssets(db, session, now) {
  const manifest = db.prepare(
    `INSERT INTO asset_manifest (
      asset_id, content_uri, media_type, mime_type, width, height, orientation, aspect_ratio,
      duration_ms, file_size_bytes, date_taken, date_modified, bucket_id, bucket_name,
      is_screenshot, bitrate, frame_rate, codec, first_seen_at, last_seen_at, is_deleted,
      dirty_reason, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(asset_id) DO UPDATE SET
      content_uri=excluded.content_uri,
      media_type=excluded.media_type,
      mime_type=excluded.mime_type,
      width=excluded.width,
      height=excluded.height,
      duration_ms=excluded.duration_ms,
      file_size_bytes=excluded.file_size_bytes,
      last_seen_at=excluded.last_seen_at,
      is_deleted=excluded.is_deleted,
      dirty_reason=excluded.dirty_reason,
      updated_at=excluded.updated_at`,
  );
  const analysis = db.prepare(
    `INSERT INTO media_analysis (
      asset_id, signature, preview_uri, fingerprint, difference_hash, content_hash,
      frame_fingerprints_json, metrics_json, status, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(asset_id) DO UPDATE SET
      signature=excluded.signature,
      preview_uri=excluded.preview_uri,
      fingerprint=excluded.fingerprint,
      difference_hash=excluded.difference_hash,
      content_hash=excluded.content_hash,
      frame_fingerprints_json=excluded.frame_fingerprints_json,
      metrics_json=excluded.metrics_json,
      status=excluded.status,
      updated_at=excluded.updated_at`,
  );
  for (const asset of session.assets) {
    const filePath = fileUriToPathSafe(asset.uri);
    const dir = filePath ? path.dirname(filePath) : session.source.root;
    const createdAt = timestampMs(asset.createdAt);
    manifest.run(
      asset.id,
      asset.uri,
      asset.mediaType,
      contentTypeForPath(filePath || asset.uri),
      asset.width,
      asset.height,
      null,
      asset.height > 0 ? asset.width / asset.height : null,
      Math.round((asset.duration ?? 0) * 1000),
      asset.fileSize,
      createdAt,
      createdAt,
      dir,
      path.basename(dir),
      filePath && /screenshot|screen_shot/i.test(filePath) ? 1 : 0,
      null,
      null,
      null,
      createdAt,
      now,
      0,
      null,
      now,
    );
    analysis.run(
      asset.id,
      asset.hashes?.contentHash ?? asset.hashes?.perceptualHash ?? asset.hashes?.differenceHash ?? asset.id,
      asset.uri,
      asset.hashes?.perceptualHash ?? null,
      asset.hashes?.differenceHash ?? null,
      asset.hashes?.contentHash ?? null,
      JSON.stringify(asset.hashes?.frameHashes ?? []),
      JSON.stringify(asset.metrics ?? {}),
      'ready',
      now,
    );
  }
}

function saveCandidateView(db, session, cleanupPlan, now) {
  const planByClusterId = new Map((cleanupPlan?.plans ?? session.cleanupPlans).map((plan) => [plan.clusterId, plan]));
  const assetById = new Map(session.assets.map((asset) => [asset.id, asset]));
  db.prepare('DELETE FROM candidate_view').run();
  db.prepare('DELETE FROM candidate_view_meta').run();
  db.prepare('INSERT INTO candidate_view_meta (id, summary_json, updated_at) VALUES (1, ?, ?)').run(
    JSON.stringify({
      scannedAt: now,
      source: 'desktop-main',
      totalAssets: session.assets.length,
      totalCandidates: session.clusters.length,
    }),
    now,
  );
  const statement = db.prepare(
    `INSERT INTO candidate_view (
      asset_id, batch_id, rank, score, confidence, primary_issue_type, candidate_json, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  session.clusters.forEach((cluster, index) => {
    const representative = assetById.get(cluster.representativeAssetId);
    if (!representative) return;
    statement.run(
      representative.id,
      session.sessionId,
      index,
      cluster.score,
      confidenceForScore(cluster.score),
      cluster.category,
      JSON.stringify({
        id: cluster.id,
        asset: representative,
        score: cluster.score,
        confidence: confidenceForScore(cluster.score),
        primaryIssueType: cluster.category,
        reasons: cluster.reasons,
        relatedAssets: cluster.assetIds.map((assetId) => assetById.get(assetId)).filter(Boolean),
        cleanupPlan: planByClusterId.get(cluster.id) ?? null,
      }),
      now,
    );
  });
}

function saveRecognitionGroups(db, session, now) {
  const assetById = new Map(session.assets.map((asset) => [asset.id, asset]));
  db.prepare('DELETE FROM recognition_member').run();
  db.prepare('DELETE FROM recognition_group').run();
  const group = db.prepare(
    `INSERT INTO recognition_group (
      group_id, relation, size, similarity, representative_asset_id, representative_reason,
      representative_width, representative_height, representative_file_size, representative_creation_time, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const member = db.prepare(
    'INSERT INTO recognition_member (group_id, asset_id, candidate_id, role, updated_at) VALUES (?, ?, ?, ?, ?)',
  );
  for (const cluster of session.clusters) {
    const representative = assetById.get(cluster.representativeAssetId);
    if (!representative) continue;
    group.run(
      cluster.id,
      cluster.category,
      cluster.assetIds.length,
      cluster.score > 1 ? cluster.score / 100 : cluster.score,
      representative.id,
      cluster.reasons?.[0] ?? cluster.category,
      representative.width,
      representative.height,
      representative.fileSize,
      timestampMs(representative.createdAt),
      now,
    );
    for (const assetId of cluster.assetIds) {
      member.run(cluster.id, assetId, cluster.id, assetId === representative.id ? 'representative' : 'member', now);
    }
  }
}

function loadReport(input = {}) {
  const row = findSessionRow(input);
  if (!row) throw new Error('session not found');
  const session = JSON.parse(row.session_json);
  const cleanupPlan = row.cleanup_plan_json ? JSON.parse(row.cleanup_plan_json) : null;
  const trashed = readTrashedAssetIds();
  const pruned = pruneReport(session, cleanupPlan, trashed);
  return {
    session: cleanupPlan ? { ...pruned.session, cleanupPlans: [] } : pruned.session,
    cleanupPlan: pruned.cleanupPlan ? { ...pruned.cleanupPlan, assets: [] } : null,
    paths: {
      session: row.session_path,
      cleanupPlan: row.cleanup_plan_path ?? null,
    },
    cleanupHistory: summarizeCleanupHistory(session, trashed),
    summary: {
      assetCount: pruned.session.assets.length,
      clusterCount: pruned.session.clusters.length,
      cleanupPlanCount: pruned.cleanupPlan?.plans.length ?? pruned.session.cleanupPlans.length,
      diagnosticCount: pruned.session.diagnostics?.length ?? 0,
    },
  };
}

async function confirmTrash(input = {}) {
  const row = findSessionRow(input);
  if (!row) throw new Error('session not found for trash confirmation');
  const session = JSON.parse(row.session_json);
  const cleanupPlan = row.cleanup_plan_json ? JSON.parse(row.cleanup_plan_json) : null;
  if (!cleanupPlan) throw new Error('cleanup plan not found');
  const operation = input.mode === 'delete' || input.permanent === true
    ? 'delete'
    : input.mode === 'trash' || input.confirm
      ? 'trash'
      : 'dry-run';

  const requestedAssetIds = new Set(input.assetIds?.length ? input.assetIds : []);
  if (requestedAssetIds.size === 0) {
    const planIds = new Set(input.planIds?.length ? input.planIds : cleanupPlan.plans.map((plan) => plan.id));
    for (const plan of cleanupPlan.plans) {
      if (!planIds.has(plan.id)) continue;
      for (const assetId of plan.assetIds) requestedAssetIds.add(assetId);
    }
  }

  const assetById = new Map(session.assets.map((asset) => [asset.id, asset]));
  const actions = [];
  for (const assetId of requestedAssetIds) {
    const asset = assetById.get(assetId);
    if (!asset) {
      actions.push({ assetId, status: 'missing' });
      continue;
    }
    if (operation === 'dry-run') {
      actions.push({ assetId, status: 'dry-run' });
      continue;
    }
    try {
      const filePath = fileUriToPath(asset.uri);
      if (fs.existsSync(filePath)) {
        if (operation === 'delete') {
          await fsp.unlink(filePath);
        } else {
          await shell.trashItem(filePath);
        }
      }
      markAssetTrashed(row.session_path, asset, operation === 'delete' ? 'desktop-permanent-delete' : 'desktop-confirm');
      actions.push({ assetId, path: filePath, status: operation === 'delete' ? 'deleted' : 'trashed' });
    } catch (error) {
      actions.push({
        assetId,
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return {
    mode: operation,
    planCount: input.planIds?.length ?? 1,
    assetCount: requestedAssetIds.size,
    actions,
  };
}

function listSessions(limit = 40) {
  return getDb()
    .prepare('SELECT * FROM report_session ORDER BY generated_at DESC LIMIT ?')
    .all(Math.max(1, Math.min(100, Number(limit) || 40)))
    .map((row) => ({
      sessionPath: row.session_path,
      cleanupPlanPath: row.cleanup_plan_path ?? null,
      sessionId: row.session_id,
      generatedAt: row.generated_at,
      root: row.root,
      platform: row.platform,
      assetCount: Number(row.asset_count),
      clusterCount: Number(row.cluster_count),
      cleanupPlanCount: Number(row.cleanup_plan_count),
      diagnosticCount: Number(row.diagnostic_count),
      cleanupHistory: {
        assetCount: Number(row.cleanup_asset_count ?? 0),
        fileSize: Number(row.cleanup_file_size ?? 0),
      },
      source: row.source,
    }));
}

function deleteSession(input = {}) {
  const row = findSessionRow(input);
  if (!row) throw new Error('session not found');
  getDb().prepare('DELETE FROM report_session WHERE session_path = ?').run(row.session_path);
  try {
    fs.rmSync(path.dirname(row.session_path), { recursive: true, force: true });
  } catch {
    // SQLite deletion is the source of truth for desktop history.
  }
  return { deleted: true, sessionPath: row.session_path };
}

function findSessionRow(input = {}) {
  const db = getDb();
  if (input.sessionPath || input.session) {
    const sessionPath = resolveInputPath(input.sessionPath || input.session);
    const row = db.prepare('SELECT * FROM report_session WHERE session_path = ?').get(sessionPath);
    if (row) return row;
    if (fs.existsSync(sessionPath)) return importSessionJson(sessionPath);
  }
  if (input.sessionId) {
    return db.prepare('SELECT * FROM report_session WHERE session_id = ? ORDER BY generated_at DESC LIMIT 1').get(input.sessionId);
  }
  return db.prepare('SELECT * FROM report_session ORDER BY generated_at DESC LIMIT 1').get();
}

function importSessionJson(sessionPath) {
  const cleanupPlanPath = path.join(path.dirname(sessionPath), 'cleanup-plan.json');
  const session = readJson(sessionPath);
  const cleanupPlan = fs.existsSync(cleanupPlanPath) ? readJson(cleanupPlanPath) : null;
  persistReportRuntime({
    sessionPath,
    cleanupPlanPath: cleanupPlan ? cleanupPlanPath : null,
    session,
    cleanupPlan,
    source: sessionPath.includes('/artifacts/scan/') ? 'artifact' : 'mc',
    cleanupHistory: { assetCount: 0, fileSize: 0 },
  });
  return getDb().prepare('SELECT * FROM report_session WHERE session_path = ?').get(sessionPath);
}

function markAssetTrashed(sourcePath, asset, source) {
  const db = getDb();
  const now = Date.now();
  db.prepare(
    `INSERT INTO recycle_bin_state (asset_id, recycled_at, expires_at, source, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(asset_id) DO UPDATE SET
       recycled_at=excluded.recycled_at,
       source=excluded.source,
       updated_at=excluded.updated_at`,
  ).run(asset.id, now, null, source, now);
  db.prepare(
    `INSERT INTO user_decision (
      asset_id, candidate_id, decision, source, reason, decided_at, updated_at, snapshot_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(asset_id) DO UPDATE SET
      decision=excluded.decision,
      source=excluded.source,
      reason=excluded.reason,
      decided_at=excluded.decided_at,
      updated_at=excluded.updated_at,
      snapshot_json=excluded.snapshot_json`,
  ).run(
    asset.id,
    null,
    'trash',
    source,
    'confirmed-cleanup',
    now,
    now,
    JSON.stringify({ sourcePath, fileSize: asset.fileSize }),
  );
  refreshCleanupReport(db, now);
  refreshReportSessionCleanupCounts(db);
}

function readTrashedAssetIds() {
  return new Set(getDb().prepare('SELECT asset_id FROM recycle_bin_state').all().map((row) => String(row.asset_id)));
}

function pruneReport(session, cleanupPlan, omittedAssetIds) {
  const assets = session.assets.filter((asset) => !omittedAssetIds.has(asset.id));
  const clusters = session.clusters
    .map((cluster) => {
      const assetIds = cluster.assetIds.filter((assetId) => !omittedAssetIds.has(assetId));
      return {
        ...cluster,
        assetIds,
        representativeAssetId: assetIds.includes(cluster.representativeAssetId)
          ? cluster.representativeAssetId
          : assetIds[0] ?? cluster.representativeAssetId,
      };
    })
    .filter((cluster) => cluster.assetIds.length >= (cluster.category === 'low_value' ? 1 : 2));
  const keptClusterIds = new Set(clusters.map((cluster) => cluster.id));
  const cleanupPlans = session.cleanupPlans
    .map((plan) => ({ ...plan, assetIds: plan.assetIds.filter((assetId) => !omittedAssetIds.has(assetId)) }))
    .filter((plan) => plan.assetIds.length > 0 && keptClusterIds.has(plan.clusterId));
  const nextCleanupPlan = cleanupPlan
    ? {
        ...cleanupPlan,
        assets: cleanupPlan.assets.filter((asset) => !omittedAssetIds.has(asset.id)),
        plans: cleanupPlan.plans
          .map((plan) => ({ ...plan, assetIds: plan.assetIds.filter((assetId) => !omittedAssetIds.has(assetId)) }))
          .filter((plan) => plan.assetIds.length > 0 && keptClusterIds.has(plan.clusterId)),
      }
    : null;
  return {
    session: { ...session, assets, clusters, cleanupPlans },
    cleanupPlan: nextCleanupPlan,
  };
}

function summarizeCleanupHistory(session, trashedAssetIds) {
  const assets = session.assets.filter((asset) => trashedAssetIds.has(asset.id));
  return {
    assetCount: assets.length,
    fileSize: assets.reduce((total, asset) => total + asset.fileSize, 0),
  };
}

function refreshCleanupReport(db, updatedAt) {
  const row = db
    .prepare(
      `SELECT
        COUNT(recycle_bin_state.asset_id) AS count,
        COALESCE(SUM(asset_manifest.file_size_bytes), 0) AS bytes,
        MAX(recycle_bin_state.recycled_at) AS last_cleaned_at
      FROM recycle_bin_state
      LEFT JOIN asset_manifest ON asset_manifest.asset_id = recycle_bin_state.asset_id`,
    )
    .get();
  db.prepare(
    `INSERT INTO cleanup_report (id, cleaned_item_count, cleaned_bytes, last_cleaned_at, updated_at)
     VALUES (1, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       cleaned_item_count=excluded.cleaned_item_count,
       cleaned_bytes=excluded.cleaned_bytes,
       last_cleaned_at=excluded.last_cleaned_at,
       updated_at=excluded.updated_at`,
  ).run(Number(row?.count ?? 0), Number(row?.bytes ?? 0), row?.last_cleaned_at ?? null, updatedAt);
}

function refreshReportSessionCleanupCounts(db) {
  const trashed = readTrashedAssetIds();
  const update = db.prepare(
    'UPDATE report_session SET cleanup_asset_count = ?, cleanup_file_size = ?, updated_at = ? WHERE session_path = ?',
  );
  const updatedAt = new Date().toISOString();
  const rows = db.prepare('SELECT session_path, session_json FROM report_session').all();
  for (const row of rows) {
    if (!row.session_json) continue;
    const session = JSON.parse(row.session_json);
    const cleanedAssets = session.assets.filter((asset) => trashed.has(asset.id));
    update.run(
      cleanedAssets.length,
      cleanedAssets.reduce((total, asset) => total + asset.fileSize, 0),
      updatedAt,
      row.session_path,
    );
  }
}

function listDirectories(inputPath) {
  const currentPath = inputPath ? resolveInputPath(inputPath) : defaultDirectory();
  const entries = fs.readdirSync(currentPath, { withFileTypes: true });
  return {
    current: currentPath,
    parent: path.dirname(currentPath) === currentPath ? null : path.dirname(currentPath),
    roots: quickRoots(),
    directories: entries
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
      .map((entry) => ({ name: entry.name, path: path.join(currentPath, entry.name) }))
      .sort((left, right) => left.name.localeCompare(right.name)),
  };
}

function getDb() {
  if (database) return database;
  const sqlite = loadNodeSqlite();
  const dbPath = desktopDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  database = new sqlite.DatabaseSync(dbPath);
  migrateLegacyScanJob(database);
  ensureSchema(database);
  return database;
}

function ensureSchema(db) {
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS schema_meta (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS desktop_scan_job (
      job_id TEXT PRIMARY KEY NOT NULL,
      session_id TEXT NOT NULL,
      root TEXT NOT NULL,
      media_type TEXT NOT NULL,
      status TEXT NOT NULL,
      phase TEXT NOT NULL,
      session_path TEXT NOT NULL,
      cleanup_plan_path TEXT NOT NULL,
      processed INTEGER NOT NULL,
      total INTEGER NOT NULL,
      percent INTEGER NOT NULL,
      asset_count INTEGER,
      cluster_count INTEGER,
      cleanup_plan_count INTEGER,
      diagnostic_count INTEGER,
      error TEXT,
      logs_json TEXT NOT NULL,
      started_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      completed_at TEXT
    );
    CREATE TABLE IF NOT EXISTS report_session (
      session_path TEXT PRIMARY KEY NOT NULL,
      cleanup_plan_path TEXT,
      session_id TEXT NOT NULL,
      generated_at TEXT NOT NULL,
      root TEXT NOT NULL,
      platform TEXT NOT NULL,
      source TEXT NOT NULL CHECK (source IN ('mc', 'artifact')),
      asset_count INTEGER NOT NULL,
      cluster_count INTEGER NOT NULL,
      cleanup_plan_count INTEGER NOT NULL,
      diagnostic_count INTEGER NOT NULL,
      cleanup_asset_count INTEGER NOT NULL DEFAULT 0,
      cleanup_file_size INTEGER NOT NULL DEFAULT 0,
      session_json TEXT,
      cleanup_plan_json TEXT,
      indexed_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS media_analysis (
      asset_id TEXT PRIMARY KEY NOT NULL,
      signature TEXT NOT NULL,
      preview_uri TEXT NOT NULL,
      fingerprint TEXT,
      difference_hash TEXT,
      content_hash TEXT,
      frame_fingerprints_json TEXT NOT NULL,
      metrics_json TEXT NOT NULL,
      status TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS recycle_bin_state (
      asset_id TEXT PRIMARY KEY NOT NULL,
      recycled_at INTEGER NOT NULL,
      expires_at INTEGER,
      source TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS cleanup_report (
      id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
      cleaned_item_count INTEGER NOT NULL,
      cleaned_bytes INTEGER NOT NULL,
      last_cleaned_at INTEGER,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS scan_job (
      job_id TEXT PRIMARY KEY NOT NULL,
      phase TEXT NOT NULL,
      progress_current INTEGER NOT NULL,
      progress_total INTEGER NOT NULL,
      processed_count INTEGER NOT NULL,
      candidate_count INTEGER NOT NULL,
      started_at INTEGER NOT NULL,
      last_heartbeat_at INTEGER NOT NULL,
      current_file_name TEXT,
      last_processed_asset_id TEXT,
      last_error TEXT,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS scan_batch (
      batch_id TEXT PRIMARY KEY NOT NULL,
      mode TEXT NOT NULL,
      window_days INTEGER,
      range_start_at INTEGER,
      range_end_at INTEGER,
      phase TEXT NOT NULL,
      progress_current INTEGER NOT NULL,
      progress_total INTEGER NOT NULL,
      enumerated_count INTEGER NOT NULL,
      dirty_count INTEGER NOT NULL,
      analyzed_count INTEGER NOT NULL,
      candidate_count INTEGER NOT NULL,
      started_at INTEGER NOT NULL,
      last_heartbeat_at INTEGER NOT NULL,
      completed_at INTEGER,
      last_error TEXT,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS scan_batch_item (
      batch_id TEXT NOT NULL,
      asset_id TEXT NOT NULL,
      media_type TEXT NOT NULL,
      stage TEXT NOT NULL,
      dirty_reason TEXT,
      attempt_count INTEGER NOT NULL,
      worker_slot TEXT,
      last_heartbeat_at INTEGER,
      last_error TEXT,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (batch_id, asset_id)
    );
    CREATE TABLE IF NOT EXISTS asset_manifest (
      asset_id TEXT PRIMARY KEY NOT NULL,
      content_uri TEXT NOT NULL,
      media_type TEXT NOT NULL,
      mime_type TEXT,
      width INTEGER NOT NULL,
      height INTEGER NOT NULL,
      orientation INTEGER,
      aspect_ratio REAL,
      duration_ms INTEGER NOT NULL,
      file_size_bytes INTEGER,
      date_taken INTEGER,
      date_modified INTEGER,
      bucket_id TEXT,
      bucket_name TEXT,
      is_screenshot INTEGER,
      bitrate INTEGER,
      frame_rate REAL,
      codec TEXT,
      first_seen_at INTEGER NOT NULL,
      last_seen_at INTEGER NOT NULL,
      is_deleted INTEGER NOT NULL,
      dirty_reason TEXT,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS candidate_view_meta (
      id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
      summary_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS candidate_view (
      asset_id TEXT PRIMARY KEY NOT NULL,
      batch_id TEXT,
      rank INTEGER NOT NULL,
      score REAL NOT NULL,
      confidence TEXT NOT NULL,
      primary_issue_type TEXT NOT NULL,
      candidate_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS recognition_group (
      group_id TEXT PRIMARY KEY NOT NULL,
      relation TEXT NOT NULL,
      size INTEGER NOT NULL,
      similarity REAL NOT NULL,
      representative_asset_id TEXT NOT NULL,
      representative_reason TEXT NOT NULL,
      representative_width INTEGER NOT NULL,
      representative_height INTEGER NOT NULL,
      representative_file_size INTEGER NOT NULL,
      representative_creation_time INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS recognition_member (
      group_id TEXT NOT NULL,
      asset_id TEXT NOT NULL,
      candidate_id TEXT NOT NULL,
      role TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (group_id, asset_id)
    );
    CREATE TABLE IF NOT EXISTS user_decision (
      asset_id TEXT PRIMARY KEY NOT NULL,
      candidate_id TEXT,
      decision TEXT NOT NULL,
      source TEXT NOT NULL,
      reason TEXT,
      decided_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      snapshot_json TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_asset_manifest_deleted_last_seen
      ON asset_manifest (is_deleted, last_seen_at DESC, asset_id ASC);
    CREATE INDEX IF NOT EXISTS idx_candidate_view_rank
      ON candidate_view (rank ASC, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_recognition_member_asset
      ON recognition_member (asset_id, group_id);
  `);
  ensureReportSessionColumns(db);
  db.prepare(
    `INSERT INTO schema_meta (key, value, updated_at)
     VALUES ('schemaVersion', 'media-clean-desktop-store/v0.1', ?)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`,
  ).run(new Date().toISOString());
}

function migrateLegacyScanJob(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS desktop_scan_job (
    job_id TEXT PRIMARY KEY NOT NULL,
    session_id TEXT NOT NULL,
    root TEXT NOT NULL,
    media_type TEXT NOT NULL,
    status TEXT NOT NULL,
    phase TEXT NOT NULL,
    session_path TEXT NOT NULL,
    cleanup_plan_path TEXT NOT NULL,
    processed INTEGER NOT NULL,
    total INTEGER NOT NULL,
    percent INTEGER NOT NULL,
    asset_count INTEGER,
    cluster_count INTEGER,
    cleanup_plan_count INTEGER,
    diagnostic_count INTEGER,
    error TEXT,
    logs_json TEXT NOT NULL,
    started_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    completed_at TEXT
  );`);
  const columns = tableColumns(db, 'scan_job');
  if (columns.size === 0 || columns.has('progress_current')) return;
  if (!columns.has('session_id') || !columns.has('session_path')) return;
  db.exec(`
    INSERT OR REPLACE INTO desktop_scan_job (
      job_id, session_id, root, media_type, status, phase, session_path, cleanup_plan_path,
      processed, total, percent, asset_count, cluster_count, cleanup_plan_count, diagnostic_count,
      error, logs_json, started_at, updated_at, completed_at
    )
    SELECT
      job_id, session_id, root, media_type, status, phase, session_path, cleanup_plan_path,
      processed, total, percent, asset_count, cluster_count, cleanup_plan_count, diagnostic_count,
      error, logs_json, started_at, updated_at, completed_at
    FROM scan_job;
    DROP TABLE scan_job;
  `);
}

function ensureReportSessionColumns(db) {
  const columns = tableColumns(db, 'report_session');
  if (columns.size === 0) return;
  if (!columns.has('session_json')) db.exec('ALTER TABLE report_session ADD COLUMN session_json TEXT');
  if (!columns.has('cleanup_plan_json')) db.exec('ALTER TABLE report_session ADD COLUMN cleanup_plan_json TEXT');
}

function tableColumns(db, table) {
  try {
    return new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((row) => String(row.name)));
  } catch {
    return new Set();
  }
}

async function staticResponse(url) {
  const requested = url.hostname === 'app' ? decodeURIComponent(url.pathname) : '/index.html';
  const normalized = requested === '/' || requested === '' ? '/index.html' : requested;
  const filePath = safeJoin(rendererRoot, normalized);
  const finalPath = fs.existsSync(filePath) && fs.statSync(filePath).isFile()
    ? filePath
    : path.join(rendererRoot, 'index.html');
  if (!isPathInside(rendererRoot, finalPath) || !fs.existsSync(finalPath)) {
    return new Response('desktop renderer not found', { status: 404 });
  }
  const bytes = await fsp.readFile(finalPath);
  return new Response(bytes, {
    headers: {
      'Content-Type': contentTypeForPath(finalPath),
      'Cache-Control': 'no-store',
    },
  });
}

function mediaUrl(assetId) {
  return `app://media/${encodeURIComponent(String(assetId))}`;
}

function posterUrl(assetId) {
  return `app://poster/${encodeURIComponent(String(assetId))}`;
}

async function mediaResponse(assetId, request) {
  const asset = getDb().prepare('SELECT * FROM asset_manifest WHERE asset_id = ?').get(assetId);
  if (!asset) return new Response('asset not found', { status: 404 });
  const filePath = fileUriToPath(asset.content_uri);
  if (!fs.existsSync(filePath)) return new Response('media not found', { status: 404 });
  const stat = fs.statSync(filePath);
  const range = request.headers.get('range');
  if (range) {
    const match = /bytes=(\d+)-(\d*)/.exec(range);
    if (!match) {
      return new Response('invalid range', { status: 416 });
    }
    const start = Number(match[1]);
    const end = match[2] ? Number(match[2]) : stat.size - 1;
    if (start >= stat.size || end >= stat.size || start > end) {
      return new Response('range not satisfiable', {
        status: 416,
        headers: { 'Content-Range': `bytes */${stat.size}` },
      });
    }
    const stream = fs.createReadStream(filePath, { start, end });
    return new Response(Readable.toWeb(stream), {
      status: 206,
      headers: {
        'Accept-Ranges': 'bytes',
        'Content-Length': String(end - start + 1),
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Content-Type': asset.mime_type || contentTypeForPath(filePath),
      },
    });
  }
  const stream = fs.createReadStream(filePath);
  return new Response(Readable.toWeb(stream), {
    headers: {
      'Accept-Ranges': 'bytes',
      'Content-Length': String(stat.size),
      'Content-Type': asset.mime_type || contentTypeForPath(filePath),
    },
  });
}

async function posterResponse(assetId) {
  const asset = getDb().prepare('SELECT * FROM asset_manifest WHERE asset_id = ?').get(assetId);
  if (!asset) return new Response('asset not found', { status: 404 });
  if (String(asset.media_type) !== 'video') {
    return mediaResponse(assetId, new Request(`app://media/${encodeURIComponent(assetId)}`));
  }
  return new Response('poster unavailable', { status: 404 });
}

async function ensureReportServer() {
  if (await isReportServerHealthy()) return;

  reportProcess = spawn('npm', ['--prefix', 'apps/report', 'run', 'dev', '--', '--port', reportPort], {
    cwd: repoRoot,
    env: {
      ...process.env,
      MC_REPO_ROOT: repoRoot,
      MC_REPORT_PORT: reportPort,
    },
    stdio: smokeMode ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });

  if (smokeMode) {
    reportProcess.stdout?.on('data', (chunk) => process.stdout.write(chunk));
    reportProcess.stderr?.on('data', (chunk) => process.stderr.write(chunk));
  }

  await waitForReportServer();
}

async function isReportServerHealthy() {
  try {
    await request('GET', '/', null, 2_000);
    return true;
  } catch {
    return false;
  }
}

async function waitForReportServer() {
  const startedAt = Date.now();
  let lastError = null;
  while (Date.now() - startedAt < 45_000) {
    try {
      await request('GET', '/', null, 3_000);
      return;
    } catch (error) {
      lastError = error;
      await delay(500);
    }
  }
  throw new Error(`report server did not become ready: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

async function runSmokeCheck() {
  const packageScan = process.env.MC_DESKTOP_PACKAGE_SMOKE === '1' ? await runPackageSmokeScan() : null;
  const renderer = await rendererSmokeState();
  const tray = await traySmokeState();
  const scanJobs = listScanJobs();
  const sessions = listSessions(1);
  console.log(
    JSON.stringify({
      ok: true,
      rendererMode,
      packagedLike,
      packageSmoke: process.env.MC_DESKTOP_PACKAGE_SMOKE === '1',
      reportOrigin: rendererMode === 'server' ? reportOrigin : null,
      appPath: app.getAppPath(),
      renderer,
      tray,
      icon: iconSmokeState(),
      notifications: notificationSmokeState(),
      scanJobs: scanJobs.length,
      sessions: sessions.length,
      dbPath: desktopDbPath(),
      packageScan,
    }),
  );
}

async function rendererSmokeState() {
  if (!mainWindow) throw new Error('desktop smoke renderer window is missing');
	const state = await mainWindow.webContents.executeJavaScript(
	  `(async () => {
	      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        const validTaskNav = new Set(['扫描|识别|审阅', 'Scan|Identify|Review']);
        const hasAuxNav = (value) => value.includes('关于与状态') || value.includes('About & Status');
	      let root = document.querySelector('#root');
	      let text = root?.textContent || '';
	      let navLabels = Array.from(document.querySelectorAll('.task-nav-item strong')).map((item) => item.textContent?.trim());
	      const deadline = Date.now() + 5000;
	      while (Date.now() < deadline && (!validTaskNav.has(navLabels.join('|')) || !hasAuxNav(text))) {
	        await wait(100);
	        root = document.querySelector('#root');
	        text = root?.textContent || '';
	        navLabels = Array.from(document.querySelectorAll('.task-nav-item strong')).map((item) => item.textContent?.trim());
	      }
	      const updateCheck = await window.mediaCleanDesktop?.updateCheck?.();
	      const notificationStatus = await window.mediaCleanDesktop?.notificationStatus?.();
	      return {
	        url: location.href,
	        hasRoot: Boolean(root),
	        hasTaskNavigation: validTaskNav.has(navLabels.join('|')),
		        hasAuxNavigation: hasAuxNav(text),
		        hasBridge: Boolean(window.mediaCleanDesktop?.scanStart && window.mediaCleanDesktop?.scanCancel && window.mediaCleanDesktop?.reportLoad && window.mediaCleanDesktop?.trashConfirm && window.mediaCleanDesktop?.updateCheck && window.mediaCleanDesktop?.notificationStatus),
        hasUpdatePlaceholder: updateCheck?.source === 'electron-app' && updateCheck?.status === 'reserved' && updateCheck?.canUpdate === false && updateCheck?.releaseUrl === null,
        hasNotificationStatus: notificationStatus?.source === 'electron-notification' && notificationStatus?.channel === 'scan' && notificationStatus?.mode === 'dry-run',
        notificationStatus,
        updateCheck
      };
    })()`,
    true,
  );
  if (!state?.hasRoot || !state?.hasTaskNavigation || !state?.hasAuxNavigation || !state?.hasBridge || !state?.hasUpdatePlaceholder || !state?.hasNotificationStatus) {
    throw new Error(`desktop smoke renderer did not mount correctly: ${JSON.stringify(state)}`);
  }
  return state;
}

async function traySmokeState() {
  const popover = await ensureTrayPopoverWindow();
  await popover.webContents.executeJavaScript(
    `(async () => {
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const deadline = Date.now() + 5000;
      let root = document.querySelector('#root');
      let island = document.querySelector('.tray-island');
      let logo = document.querySelector('.tray-progress-logo');
      while (Date.now() < deadline && (!root || !island || !logo)) {
        await wait(100);
        root = document.querySelector('#root');
        island = document.querySelector('.tray-island');
        logo = document.querySelector('.tray-progress-logo');
      }
      return Boolean(root && island && logo);
    })()`,
    true,
  );
  await showTrayPopover(popover);
  const state = await popover.webContents.executeJavaScript(
    `(async () => {
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const params = new URLSearchParams(location.search);
      const methods = [
        'trayState',
        'trayOpenWorkbench',
        'trayOpenReview',
        'trayOpenJobReview',
        'trayChooseAndScan',
        'trayPause',
        'trayNotificationStatus',
        'trayOpenNotificationSettings',
        'trayQuit',
        'trayClose'
      ];
      const deadline = Date.now() + 5000;
      let root = document.querySelector('#root');
      let island = document.querySelector('.tray-island');
      let logo = document.querySelector('.tray-progress-logo');
      let revealKey = Number(island?.getAttribute('data-reveal-key') || 0);
      while (Date.now() < deadline && (!root || !island || !logo || revealKey < 1)) {
        await wait(100);
        root = document.querySelector('#root');
        island = document.querySelector('.tray-island');
        logo = document.querySelector('.tray-progress-logo');
        revealKey = Number(island?.getAttribute('data-reveal-key') || 0);
      }
      const islandRect = island?.getBoundingClientRect();
      return {
        url: location.href,
        surface: params.get('surface'),
        hasRoot: Boolean(root),
        hasPopoverEntry: location.href === 'app://app/index.html?surface=tray',
        hasBridge: methods.every((name) => typeof window.mediaCleanDesktop?.[name] === 'function'),
        bridgeMethods: Object.fromEntries(methods.map((name) => [name, typeof window.mediaCleanDesktop?.[name] === 'function'])),
        hasProgressLogo: Boolean(logo),
        hasProgressRing: Boolean(document.querySelector('.tray-progress-ring')),
        islandWidth: islandRect ? Math.round(islandRect.width) : 0,
        revealKey,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight
      };
    })()`,
    true,
  );
  const bounds = popover.getBounds();
  const trayState = buildTrayState();
  const iconImage = trayIconImage(trayState.jobs);
  const iconSize = iconImage.getSize();
  const canLoadSurface = state?.hasRoot === true && state?.surface === 'tray';
  const ciScrollbarGutter = process.env.CI && (process.platform === 'linux' || process.platform === 'win32') ? 16 : 2;
  const hasExpectedPopoverSize = bounds.width >= trayPopoverWidth - ciScrollbarGutter && bounds.width <= trayPopoverWidth && bounds.height > 0 && bounds.height <= trayPopoverMaxHeight;
  const hasRendererIslandWidth = Number(state?.islandWidth || 0) >= trayPopoverWidth - ciScrollbarGutter;
  const hasNoTransparentShellGap = Math.abs(Number(state?.viewportWidth || 0) - Number(state?.islandWidth || 0)) <= ciScrollbarGutter;
  const hasBrandLogo = state?.hasProgressLogo === true && state?.hasProgressRing === false;
  const hasTrayOpenReveal = Number(state?.revealKey || 0) >= 1;
  const diagnostics = {
    ...state,
    popoverBounds: bounds,
    ciScrollbarGutter,
    canLoadSurface,
    hasExpectedPopoverSize,
    hasRendererIslandWidth,
    hasNoTransparentShellGap,
    hasBrandLogo,
    hasTrayOpenReveal,
  };
  if (!canLoadSurface || state?.hasBridge !== true || state?.hasPopoverEntry !== true || !hasExpectedPopoverSize || !hasRendererIslandWidth || !hasNoTransparentShellGap || !hasBrandLogo || !hasTrayOpenReveal) {
    throw new Error(`desktop smoke tray popover did not mount correctly: ${JSON.stringify(diagnostics)}`);
  }
  return {
    ...diagnostics,
    stateSource: trayState.source,
    stateScanJobs: trayState.scanJobs,
    stateActiveCount: trayState.activeCount,
    stateCompletedCount: trayState.completedCount,
    trayIcon: trayState.trayIcon,
    trayIconImageIsEmpty: iconImage.isEmpty(),
    trayIconSize: iconSize,
  };
}

async function runPackageSmokeScan() {
  const fixtureRoot = path.join(repoRoot, '.tmp', 'desktop-package-smoke-fixture');
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
  const firstRoot = path.join(fixtureRoot, 'first');
  const secondRoot = path.join(fixtureRoot, 'second');
  fs.mkdirSync(firstRoot, { recursive: true });
  fs.mkdirSync(secondRoot, { recursive: true });
  fs.writeFileSync(path.join(firstRoot, 'tiny-a.png'), solidPng(16, 16, [20, 80, 150]));
  fs.writeFileSync(path.join(firstRoot, 'tiny-b.png'), solidPng(16, 16, [20, 80, 150]));
  fs.writeFileSync(path.join(secondRoot, 'tiny-c.png'), solidPng(16, 16, [70, 120, 30]));
  fs.writeFileSync(path.join(secondRoot, 'tiny-d.png'), solidPng(16, 16, [70, 120, 30]));

  const started = startScan({
    roots: [firstRoot, secondRoot],
    sessionId: `desktop-package-smoke-${Date.now()}`,
    mediaType: 'all',
  });
  const startedJobs = Array.isArray(started) ? started : [started];
  if (startedJobs.length !== 2) {
    throw new Error(`package smoke expected two scan jobs for two roots, got ${startedJobs.length}`);
  }
  const completedJobs = await Promise.all(startedJobs.map((job) => waitForJob(job.jobId, 20_000)));
  for (const completedJob of completedJobs) {
    if (completedJob.status !== 'completed') {
      throw new Error(`package smoke scan did not complete: ${completedJob.status} ${completedJob.error || ''}`);
    }
    if (completedJob.workerMode !== 'child-process') {
      throw new Error(`package smoke scan must use child process worker, got ${completedJob.workerMode || '<missing>'}`);
    }
  }
  const completed = completedJobs[0];

  const report = loadReport({ sessionPath: completed.session });
  const firstAsset = report.session.assets[0];
  const secondAsset = report.session.assets[1];
  if (!firstAsset || !secondAsset) {
    throw new Error(`package smoke expected at least two scanned assets, got ${report.session.assets.length}`);
  }

  const media = await mediaResponse(firstAsset.id, new Request(mediaUrl(firstAsset.id)));
  if (media.status !== 200) {
    throw new Error(`package smoke media protocol returned ${media.status}`);
  }
  await media.arrayBuffer();

  const trash = await confirmTrash({
    sessionPath: completed.session,
    assetIds: [secondAsset.id],
    confirm: false,
  });
  if (trash.actions?.[0]?.status !== 'dry-run') {
    throw new Error(`package smoke cleanup dry-run failed: ${JSON.stringify(trash.actions || [])}`);
  }

  return {
    status: completed.status,
    assetCount: completed.assetCount,
    clusterCount: completed.clusterCount,
    session: completed.session,
    reportAssetCount: report.summary.assetCount,
    reportClusterCount: report.summary.clusterCount,
    mediaStatus: media.status,
    trashStatus: trash.actions[0].status,
    engineSource: enginePackageRoot(),
    workerMode: completed.workerMode,
    jobCount: completedJobs.length,
    workerModes: completedJobs.map((job) => job.workerMode),
  };
}

async function waitForJob(jobId, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const job = jobs.get(jobId);
    if (!job) throw new Error(`scan job missing: ${jobId}`);
    if (job.status === 'completed' || job.status === 'failed' || job.status === 'canceled') {
      return snapshotJob(job);
    }
    await delay(150);
  }
  const job = jobs.get(jobId);
  throw new Error(`scan job timed out: ${jobId} ${job?.status || 'unknown'}`);
}

function solidPng(width, height, [red, green, blue]) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const row = y * (width * 4 + 1);
    raw[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const offset = row + 1 + x * 4;
      raw[offset] = red;
      raw[offset + 1] = green;
      raw[offset + 2] = blue;
      raw[offset + 3] = 255;
    }
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
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function pngChunk(type, data) {
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

function request(method, pathname, body, timeoutMs, headers = {}) {
  return new Promise((resolve, reject) => {
    const requestBody = body ? Buffer.from(body) : null;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: Number(reportPort),
        path: pathname,
        method,
        timeout: timeoutMs,
        headers: {
          ...headers,
          ...(requestBody ? { 'content-length': requestBody.length } : {}),
        },
      },
      (res) => {
        let chunks = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          chunks += chunk;
        });
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ statusCode: res.statusCode, body: chunks });
            return;
          }
          reject(new Error(`HTTP ${res.statusCode}: ${chunks.slice(0, 240)}`));
        });
      },
    );
    req.on('timeout', () => {
      req.destroy(new Error(`request timeout: ${method} ${pathname}`));
    });
    req.on('error', reject);
    if (requestBody) req.write(requestBody);
    req.end();
  });
}

function aggregateProgress(activeJobs) {
  if (activeJobs.length === 0) return 0;
  const total = activeJobs.reduce((sum, job) => sum + Math.max(0, Number(job.progress?.total ?? 0)), 0);
  const processed = activeJobs.reduce((sum, job) => sum + Math.max(0, Number(job.progress?.processed ?? 0)), 0);
  if (total > 0) return Math.max(0, Math.min(100, Math.round((processed / total) * 100)));
  const percent =
    activeJobs.reduce((sum, job) => sum + Math.max(0, Number(job.progress?.percent ?? 0)), 0) / activeJobs.length;
  return Math.max(0, Math.min(100, Math.round(percent)));
}

function isRunning(status) {
  return status === 'queued' || status === 'scanning' || status === 'analyzing' || status === 'planning';
}

function scanJobFromRow(row) {
  const logs = row.logs_json ? JSON.parse(row.logs_json) : [];
  return {
    jobId: String(row.job_id),
    sessionId: String(row.session_id),
    root: String(row.root),
    mediaType: String(row.media_type),
    status: String(row.status),
    phase: String(row.phase),
    session: String(row.session_path),
    cleanupPlan: String(row.cleanup_plan_path),
    progress: {
      processed: Number(row.processed),
      total: Number(row.total),
      percent: Number(row.percent),
    },
    assetCount: optionalNumber(row.asset_count),
    clusterCount: optionalNumber(row.cluster_count),
    cleanupPlanCount: optionalNumber(row.cleanup_plan_count),
    diagnosticCount: optionalNumber(row.diagnostic_count),
    error: row.error ? String(row.error) : undefined,
    logs: Array.isArray(logs) ? logs.map(String) : [],
    startedAt: String(row.started_at),
    updatedAt: String(row.updated_at),
    completedAt: row.completed_at ? String(row.completed_at) : undefined,
  };
}

function snapshotJob(job) {
  const { worker, lastProgressPersistAt, lastLogPersistAt, ...serializable } = job;
  return JSON.parse(JSON.stringify(serializable));
}

function desktopSessionId(index) {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
  const suffix = index > 0 ? `-${index + 1}` : '';
  return `mc-desktop-${stamp}${suffix}`;
}

function safeSessionId(value) {
  return String(value).replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 96) || `mc-desktop-${Date.now()}`;
}

function sessionArtifactsRoot() {
  if (process.env.MC_DESKTOP_SESSION_ROOT) return path.normalize(process.env.MC_DESKTOP_SESSION_ROOT);
  if (isPackagedRuntime()) return path.join(app.getPath('userData'), 'sessions');
  return path.join(repoRoot, '.mc');
}

function desktopDbPath() {
  if (process.env.MC_DESKTOP_DB_PATH) return process.env.MC_DESKTOP_DB_PATH;
  if (isPackagedRuntime()) return path.join(app.getPath('userData'), 'media-clean.sqlite');
  return path.join(repoRoot, '.mc', '_state', 'report-workbench.sqlite');
}

function enginePackageRoot() {
  if (process.env.MC_ENGINE_PACKAGE_PATH) return path.normalize(process.env.MC_ENGINE_PACKAGE_PATH);
  const packagedEngineRoot = path.join(process.resourcesPath || '', 'media-clean-engine');
  if (isPackagedRuntime() && fs.existsSync(path.join(packagedEngineRoot, 'index.cjs'))) {
    return packagedEngineRoot;
  }
  return path.join(repoRoot, 'packages', 'media-clean-engine');
}

function scanWorkerPath() {
  if (process.env.MC_DESKTOP_SCAN_WORKER_PATH) return path.normalize(process.env.MC_DESKTOP_SCAN_WORKER_PATH);
  const packagedWorkerPath = path.join(process.resourcesPath || '', 'scan-worker.cjs');
  if (isPackagedRuntime() && fs.existsSync(packagedWorkerPath)) return packagedWorkerPath;
  return path.join(__dirname, 'scan-worker.cjs');
}

function isPackagedRuntime() {
  if (app.isPackaged || packagedLike) return true;
  if (String(__dirname).includes('.asar')) return true;
  return fs.existsSync(path.join(process.resourcesPath || '', 'app.asar'));
}

function iconCandidatePaths() {
  const platformNames = process.platform === 'win32'
    ? ['icon.ico', 'icon.png']
    : process.platform === 'darwin'
      ? ['icon.png', 'icon.icns']
      : ['icon.png'];
  const candidateDirs = [
    path.join(__dirname, 'assets'),
    path.join(__dirname, 'icons'),
    path.join(process.resourcesPath || '', 'assets'),
    path.join(process.resourcesPath || '', 'icons'),
    path.join(repoRoot, 'apps', 'desktop', 'assets'),
    path.join(repoRoot, 'apps', 'desktop', 'icons'),
    path.join(repoRoot, 'assets'),
  ];
  return candidateDirs.flatMap((dir) => platformNames.map((name) => path.join(dir, name)));
}

function resolveIconAssetPath() {
  for (const candidate of iconCandidatePaths()) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {
      // Keep startup stable if a packaged resource path is not readable.
    }
  }
  return null;
}

function iconPath() {
  return appIconAssetPath;
}

function appIconImage(size = 256) {
  if (appIconAssetPath) {
    const image = nativeImage.createFromPath(appIconAssetPath);
    if (!image.isEmpty()) return size ? image.resize({ width: size, height: size }) : image;
  }
  return fallbackBrandIconImage(size);
}

function fallbackBrandIconImage(size = 64) {
  const svgImage = nativeImageFromSvg(brandIconSvg(size), size);
  if (svgImage && !svgImage.isEmpty()) return svgImage;
  const image = nativeImage.createFromBuffer(brandIconPngBuffer(size));
  return image.isEmpty() ? nativeImage.createEmpty() : image.resize({ width: size, height: size });
}

function trayIconImage(jobs = []) {
  const summary = buildTrayIconSummary(jobs);
  const key = summary.key;
  if (lastTrayIconKey === key && lastTrayIconImage && !lastTrayIconImage.isEmpty()) {
    return lastTrayIconImage;
  }

  let image = appIconImage(36);
  if (!image || image.isEmpty()) image = fallbackBrandIconImage(36);
  image = image.resize({ width: 18, height: 18 });
  if (typeof image.setTemplateImage === 'function') image.setTemplateImage(false);
  lastTrayIconKey = key;
  lastTrayIconImage = image;
  return image;
}

function nativeImageFromSvg(svg, size) {
  try {
    const image = nativeImage.createFromDataURL(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
    if (!image.isEmpty()) return image.resize({ width: size, height: size });
  } catch {
    // SVG decoding varies across Electron platforms; PNG fallback stays dependency-free.
  }
  return nativeImage.createEmpty();
}

function buildTrayIconSummary() {
  const key = `brand:${appIconAssetPath || 'fallback'}`;
  return {
    source: 'desktop-tray-icon',
    mode: 'brand',
    taskCount: 0,
    jobs: [],
    key,
    assetPath: appIconAssetPath,
    fallback: !appIconAssetPath,
  };
}

function brandIconSvg(size) {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">`,
    '<rect width="64" height="64" rx="15" fill="#f7fbff"/>',
    '<circle cx="32" cy="32" r="22" fill="none" stroke="#1683ff" stroke-width="8"/>',
    '<path d="M24 36c5-8 8-8 12 0 3-5 5-7 8-8" fill="none" stroke="#1683ff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>',
    '<circle cx="46" cy="18" r="7" fill="#1683ff"/>',
    '</svg>',
  ].join('');
}

function brandIconPngBuffer(size = 64) {
  const raw = transparentPngRaw(size, size);
  drawRect(raw, size, size, 0, 0, size, size, [247, 251, 255, 255]);
  const center = size / 2;
  const outer = size * 0.34;
  const inner = size * 0.24;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const distance = Math.hypot(x - center, y - center);
      if (distance <= outer && distance >= inner) setPngPixel(raw, size, size, x, y, [22, 131, 255, 255]);
    }
  }
  drawRect(raw, size, size, Math.round(size * 0.6), Math.round(size * 0.2), Math.round(size * 0.16), Math.round(size * 0.16), [22, 131, 255, 255]);
  return pngBuffer(size, size, raw);
}

function transparentPngRaw(width, height) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) raw[y * (width * 4 + 1)] = 0;
  return raw;
}

function drawRect(raw, width, height, x, y, rectWidth, rectHeight, color) {
  const left = clamp(Math.round(x), 0, width);
  const top = clamp(Math.round(y), 0, height);
  const right = clamp(Math.round(x + rectWidth), 0, width);
  const bottom = clamp(Math.round(y + rectHeight), 0, height);
  for (let row = top; row < bottom; row += 1) {
    for (let column = left; column < right; column += 1) {
      setPngPixel(raw, width, height, column, row, color);
    }
  }
}

function setPngPixel(raw, width, height, x, y, [red, green, blue, alpha = 255]) {
  if (x < 0 || x >= width || y < 0 || y >= height) return;
  const offset = y * (width * 4 + 1) + 1 + x * 4;
  raw[offset] = red;
  raw[offset + 1] = green;
  raw[offset + 2] = blue;
  raw[offset + 3] = alpha;
}

function iconSmokeState() {
  const candidates = iconCandidatePaths();
  const desktopAssetCandidates = candidates.filter(isDesktopOwnedIconAsset);
  const selectedDesktopOwned = Boolean(appIconAssetPath && isDesktopOwnedIconAsset(appIconAssetPath));
  const selectedNativeImage = appIconAssetPath ? nativeImage.createFromPath(appIconAssetPath) : nativeImage.createEmpty();
  const runtimeIconImage = appIconImage(32);
  return {
    selectedPath: appIconAssetPath,
    selectedExists: Boolean(appIconAssetPath && fs.existsSync(appIconAssetPath)),
    selectedDesktopOwned,
    selectedNativeImageEmpty: selectedNativeImage.isEmpty(),
    selectedNativeImageSize: selectedNativeImage.getSize(),
    runtimeImageEmpty: runtimeIconImage.isEmpty(),
    runtimeImageSize: runtimeIconImage.getSize(),
    fallbackAvailable: !fallbackBrandIconImage(32).isEmpty(),
    candidateCount: candidates.length,
    desktopAssetCandidates,
    desktopAssetExists: selectedDesktopOwned || desktopAssetCandidates.some((candidate) => fs.existsSync(candidate)),
  };
}

function isDesktopOwnedIconAsset(candidate) {
  const normalized = String(candidate || '').replaceAll('\\', '/');
  return /\/apps\/desktop\/assets\/icon\.(icns|png|ico)$/.test(normalized)
    || /\/app\.asar\/assets\/icon\.(icns|png|ico)$/.test(normalized);
}

function notificationSmokeState() {
  return notificationStatus();
}

function defaultDirectory() {
  return path.join(os.homedir(), 'places', 'personal', 'mc-test-assets');
}

function quickRoots() {
  return [
    { label: 'mc-test-assets', path: path.join(os.homedir(), 'places', 'personal', 'mc-test-assets') },
    { label: 'personal', path: path.join(os.homedir(), 'places', 'personal') },
    { label: 'places', path: path.join(os.homedir(), 'places') },
    { label: 'home', path: os.homedir() },
    { label: 'repo', path: repoRoot },
  ];
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function resolveInputPath(input) {
  if (path.isAbsolute(input)) return path.normalize(input);
  return path.resolve(repoRoot, input);
}

function fileUriToPath(uri) {
  if (!String(uri).startsWith('file://')) throw new Error(`only file:// media URIs are supported, got ${uri}`);
  return fileURLToPath(uri);
}

function fileUriToPathSafe(uri) {
  try {
    return fileUriToPath(uri);
  } catch {
    return null;
  }
}

function safeJoin(root, child) {
  return path.join(root, child.replace(/^[/\\]+/, ''));
}

function isPathInside(parent, child) {
  const relative = path.relative(parent, child);
  return relative === '' || (relative.length > 0 && !relative.startsWith('..') && !path.isAbsolute(relative));
}

function contentTypeForPath(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.html') return 'text/html; charset=utf-8';
  if (extension === '.css') return 'text/css; charset=utf-8';
  if (extension === '.js') return 'text/javascript; charset=utf-8';
  if (extension === '.svg') return 'image/svg+xml';
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  if (extension === '.png') return 'image/png';
  if (extension === '.webp') return 'image/webp';
  if (extension === '.gif') return 'image/gif';
  if (extension === '.mp4') return 'video/mp4';
  if (extension === '.mov') return 'video/quicktime';
  return 'application/octet-stream';
}

function loadNodeSqlite() {
  const loader = process.getBuiltinModule;
  if (loader) return loader('node:sqlite');
  return require('node:sqlite');
}

function timestampMs(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Date.parse(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function optionalNumber(value) {
  return value === null || value === undefined ? undefined : Number(value);
}

function confidenceForScore(score) {
  if (score >= 90) return 'high';
  if (score >= 70) return 'medium';
  return 'low';
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
