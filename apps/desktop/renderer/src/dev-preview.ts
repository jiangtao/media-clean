import { aggregateJobPercent } from './lib';
import type {
  DesktopBridge,
  ReportPayload,
  ScanJob,
  ScanStartInput,
  SessionRecord,
  TrashInput,
  TrayState,
} from './types';

interface PreviewStore {
  jobs: ScanJob[];
  sessions: SessionRecord[];
  report: ReportPayload;
  scanListeners: Set<(jobs: ScanJob[]) => void>;
  trayListeners: Set<(state: TrayState) => void>;
}

let previewStore: PreviewStore | null = null;
let previewTicker: number | null = null;

export function installDesktopPreviewBridge() {
  if (typeof window === 'undefined') return;
  if (window.mediaCleanDesktop || window.mediaClean) return;
  if (!isDesktopPreviewMode()) return;

  previewStore = createPreviewStore();
  const bridge = createPreviewBridge(previewStore);
  window.mediaCleanDesktop = bridge;
  window.mediaClean = bridge;
  document.documentElement.dataset.desktopPreview = 'true';
  startPreviewTicker(previewStore);
}

export function isDesktopPreviewMode() {
  if (typeof window === 'undefined') return false;
  try {
    const params = new URL(window.location.href).searchParams;
    return import.meta.env.DEV || params.get('preview') === '1' || params.get('preview') === 'true';
  } catch {
    return Boolean(import.meta.env.DEV);
  }
}

function createPreviewBridge(store: PreviewStore): DesktopBridge {
  return {
    version: async () => '0.0.1-preview',
    rendererMode: async () => 'codex-preview',
    updateCheck: async () => ({
      source: 'electron-app',
      status: 'reserved',
      provider: 'pending-release-workflow',
      releaseChannel: 'stable',
      workflow: '桌面版更新提醒',
      repo: 'Media Clean',
      currentVersion: '0.0.1-preview',
      latestVersion: null,
      latestTag: null,
      releaseUrl: null,
      canUpdate: false,
      checkedAt: new Date().toISOString(),
      message: '当前先显示本机桌面版信息；有可用更新时会在这里提示。',
    }),
    notificationStatus: async () => previewNotificationStatus(),
    openNotificationSettings: async () => true,
    openHome: async () => undefined,
    chooseDirectories: async () => ({
      paths: ['/Users/jt/Pictures/旅行', '/Users/jt/Downloads', '/Volumes/Camera Import'],
    }),
    directoriesList: async () => ({ items: [] }),
    scanStart: async (input) => {
      const started = previewStartScanJobs(store, input);
      emitPreviewState(store);
      return started;
    },
    scanList: async () => clone(store.jobs),
    scanCancel: async (jobId) => {
      const job = store.jobs.find((item) => item.jobId === jobId || item.id === jobId);
      if (job) {
        job.status = 'canceled';
        job.phase = 'canceled';
        job.updatedAt = new Date().toISOString();
      }
      emitPreviewState(store);
      return clone(job || store.jobs[0]);
    },
    scanSubscribe: (listener) => {
      store.scanListeners.add(listener);
      listener(clone(store.jobs));
      return () => store.scanListeners.delete(listener);
    },
    sessionsList: async () => clone(store.sessions),
    sessionsDelete: async (input) => {
      const target = input.sessionId || input.sessionPath;
      store.sessions = store.sessions.filter((session) => session.sessionId !== target && session.sessionPath !== target);
    },
    reportLoad: async () => clone(store.report),
    trashConfirm: async (input: TrashInput) => ({
      mode: input.mode === 'delete' || input.permanent ? 'delete-preview' : 'preview',
      planCount: input.assetIds.length,
      assetCount: input.assetIds.length,
      actions: input.assetIds.map((assetId) => ({
        assetId,
        status: input.mode === 'delete' || input.permanent ? 'deleted' : 'dry-run',
      })),
    }),
    trayState: async () => buildPreviewTrayState(store.jobs),
    trayOpenWorkbench: async () => buildPreviewTrayState(store.jobs),
    trayOpenReview: async () => buildPreviewTrayState(store.jobs),
    trayOpenJobReview: async () => buildPreviewTrayState(store.jobs),
    trayChooseAndScan: async () => {
      previewStartScanJobs(store, {
        roots: ['/Users/jt/Pictures/新导入'],
        mediaType: 'all',
        sessionId: `preview-${Date.now()}`,
      });
      emitPreviewState(store);
      return buildPreviewTrayState(store.jobs);
    },
    trayPause: async () => {
      for (const job of store.jobs) {
        if (['queued', 'scanning', 'analyzing', 'planning', 'running'].includes(String(job.status))) {
          job.status = 'canceled';
          job.phase = 'canceled';
          job.updatedAt = new Date().toISOString();
        }
      }
      emitPreviewState(store);
      return buildPreviewTrayState(store.jobs);
    },
    trayNotificationStatus: async () => previewNotificationStatus(),
    trayOpenNotificationSettings: async () => true,
    trayQuit: async () => undefined,
    trayClose: async () => true,
    traySubscribe: (listener) => {
      store.trayListeners.add(listener);
      listener(buildPreviewTrayState(store.jobs));
      return () => store.trayListeners.delete(listener);
    },
    mediaUrl: (assetId) => previewImageDataUrl(assetId),
    posterUrl: (assetId) => previewImageDataUrl(assetId),
  };
}

function previewNotificationStatus() {
  return {
    source: 'electron-notification' as const,
    channel: 'scan' as const,
    mode: 'dry-run' as const,
    supported: false,
    canShow: false,
    suppressed: true,
    suppressedInSmoke: true,
    suppressedReason: 'smoke' as const,
    appBundleId: 'com.mediaclean.desktop',
    settingsTarget: 'x-apple.systempreferences:com.apple.Notifications-Settings.extension?id=com.mediaclean.desktop',
    clickTarget: 'review-result-or-workbench' as const,
    title: 'Media Clean 扫描通知',
  };
}

function createPreviewStore(): PreviewStore {
  const now = new Date();
  return {
    jobs: [
      previewJob('preview-travel', '/Users/jt/Pictures/旅行', 'analyzing', 8420, 12840, 1205, now),
      previewJob('preview-downloads', '/Users/jt/Downloads', 'completed', 3260, 3260, 84, now, -140),
      previewJob('preview-camera', '/Volumes/Camera Import', 'queued', 0, 1905, 0, now, -260),
      {
        ...previewJob('preview-vault', '/Users/jt/Private/Vault', 'failed', 0, 0, 0, now, -400),
        error: '目录权限需要重新授权',
      },
    ],
    sessions: [
      previewSession('preview-travel', '/Users/jt/Pictures/旅行', 12840, 1205, now),
      previewSession('preview-downloads', '/Users/jt/Downloads', 3260, 84, now, -140),
      previewSession('preview-camera', '/Volumes/Camera Import', 1905, 0, now, -260),
    ],
    report: previewReport(),
    scanListeners: new Set(),
    trayListeners: new Set(),
  };
}

function previewJob(id: string, root: string, status: string, processed: number, total: number, candidates: number, now: Date, offsetSeconds = 0): ScanJob {
  const percent = total > 0 ? Math.round((processed / total) * 100) : status === 'completed' ? 100 : 0;
  const updatedAt = new Date(now.getTime() + offsetSeconds * 1000).toISOString();
  return {
    jobId: `job-${id}`,
    sessionId: id,
    root,
    mediaType: 'all',
    status,
    phase: status,
    session: `/preview/${id}/session.json`,
    cleanupPlan: `/preview/${id}/cleanup-plan.json`,
    progress: { processed, total, percent },
    assetCount: total,
    clusterCount: candidates,
    cleanupPlanCount: candidates,
    diagnosticCount: status === 'failed' ? 1 : 0,
    workerMode: 'codex-preview',
    startedAt: new Date(now.getTime() + (offsetSeconds - 90) * 1000).toISOString(),
    updatedAt,
    completedAt: status === 'completed' ? updatedAt : undefined,
  };
}

function previewSession(id: string, root: string, assets: number, candidates: number, now: Date, offsetSeconds = 0): SessionRecord {
  return {
    id,
    sessionId: id,
    sessionPath: `/preview/${id}/session.json`,
    cleanupPlanPath: `/preview/${id}/cleanup-plan.json`,
    root,
    source: 'preview',
    platform: 'desktop',
    generatedAt: new Date(now.getTime() + offsetSeconds * 1000).toISOString(),
    assetCount: assets,
    clusterCount: candidates,
    cleanupPlanCount: candidates,
    diagnosticCount: 0,
    cleanupHistory: { assetCount: id === 'preview-downloads' ? 12 : 0, fileSize: id === 'preview-downloads' ? 184_000_000 : 0 },
  };
}

function previewReport(): ReportPayload {
  const assets = Array.from({ length: 12 }, (_, index) => {
    const id = `preview-asset-${index + 1}`;
    return {
      id,
      uri: `/Users/jt/Pictures/旅行/IMG_${String(2048 + index).padStart(4, '0')}.jpg`,
      mediaType: 'photo',
      fileSize: 1_400_000 + index * 175_000,
      width: 3024,
      height: 4032,
      metrics: {
        brightness: 0.36 + index * 0.015,
        blur: 0.18 + index * 0.02,
      },
    };
  });
  const clusters = [
    { id: 'cluster-duplicate', category: 'duplicate', assetIds: ['preview-asset-1', 'preview-asset-2', 'preview-asset-3'], reasons: ['内容一致', '同一时间导入'], score: 98 },
    { id: 'cluster-similar', category: 'near_similar', assetIds: ['preview-asset-4', 'preview-asset-5', 'preview-asset-6', 'preview-asset-7'], reasons: ['构图相近', '连拍照片'], score: 86 },
    { id: 'cluster-low-value', category: 'low_value', assetIds: ['preview-asset-8', 'preview-asset-9'], reasons: ['偏暗', '模糊'], score: 74 },
  ];
  const cleanupPlans = clusters.map((cluster) => ({
    id: `plan-${cluster.id}`,
    clusterId: cluster.id,
    category: cluster.category,
    action: 'review',
    assetIds: cluster.assetIds.slice(1),
    reasons: cluster.reasons,
    score: cluster.score,
  }));
  return {
    session: {
      sessionId: 'preview-travel',
      source: { root: '/Users/jt/Pictures/旅行' },
      assets,
      clusters,
      cleanupPlans,
      diagnostics: [],
    },
    paths: {
      session: '/preview/preview-travel/session.json',
      cleanupPlan: '/preview/preview-travel/cleanup-plan.json',
    },
    cleanupHistory: { assetCount: 0, fileSize: 0 },
    summary: {
      assetCount: assets.length,
      clusterCount: clusters.length,
      cleanupPlanCount: cleanupPlans.length,
      diagnosticCount: 0,
    },
  };
}

function previewStartScanJobs(store: PreviewStore, input: ScanStartInput) {
  const now = new Date();
  const roots = input.roots?.length ? input.roots : ['/Users/jt/Pictures/新导入'];
  const started = roots.map((root, index) =>
    previewJob(`${input.sessionId || 'preview-scan'}-${index + 1}`, root, index === 0 ? 'scanning' : 'queued', index === 0 ? 420 : 0, 2400 + index * 300, 0, now),
  );
  store.jobs = [...started, ...store.jobs].slice(0, 20);
  return clone(started);
}

function startPreviewTicker(store: PreviewStore) {
  if (previewTicker != null) return;
  previewTicker = window.setInterval(() => {
    let changed = false;
    for (const job of store.jobs) {
      if (!['scanning', 'analyzing', 'running'].includes(String(job.status))) continue;
      const total = Number(job.progress?.total || job.total || 0);
      const processed = Number(job.progress?.processed || job.processed || 0);
      if (total <= 0 || processed >= total * 0.92) continue;
      const nextProcessed = Math.min(total * 0.92, processed + Math.max(25, Math.round(total * 0.015)));
      job.progress = {
        processed: Math.round(nextProcessed),
        total,
        percent: Math.round((nextProcessed / total) * 100),
      };
      job.updatedAt = new Date().toISOString();
      changed = true;
    }
    if (changed) emitPreviewState(store);
  }, 1800);
}

function emitPreviewState(store: PreviewStore) {
  const jobs = clone(store.jobs);
  for (const listener of store.scanListeners) listener(jobs);
  const trayState = buildPreviewTrayState(store.jobs);
  for (const listener of store.trayListeners) listener(trayState);
}

function buildPreviewTrayState(jobs: ScanJob[]): TrayState {
  const activeJobs = jobs.filter((job) => ['queued', 'scanning', 'analyzing', 'planning', 'running'].includes(String(job.status)));
  const completedJobs = jobs.filter((job) => job.status === 'completed');
  const failedJobs = jobs.filter((job) => job.status === 'failed');
  return {
    source: 'listScanJobs',
    updatedAt: new Date().toISOString(),
    jobs: clone(jobs),
    activeJobs: clone(activeJobs),
    completedJobs: clone(completedJobs),
    failedJobs: clone(failedJobs),
    activeCount: activeJobs.length,
    completedCount: completedJobs.length,
    failedCount: failedJobs.length,
    scanJobs: jobs.length,
    aggregatePercent: aggregateJobPercent(activeJobs),
    isScanning: activeJobs.length > 0,
    canPause: activeJobs.length > 0,
    canReview: completedJobs.length > 0,
    latestCompletedJob: clone(completedJobs[0] || null),
    trayIcon: {
      source: 'desktop-tray-icon',
      mode: 'brand',
      taskCount: 0,
      jobs: [],
      key: 'preview:brand',
      fallback: true,
      assetPath: null,
    },
  };
}

function previewImageDataUrl(assetId: string) {
  const hash = Array.from(String(assetId)).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const hue = 190 + (hash % 90);
  const label = String(assetId).replace(/^preview-asset-/, 'IMG ');
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200" viewBox="0 0 900 1200">',
    `<rect width="900" height="1200" fill="oklch(0.88 0.05 ${hue})"/>`,
    `<rect x="70" y="80" width="760" height="1040" rx="44" fill="oklch(0.98 0.012 ${hue})" opacity="0.88"/>`,
    `<circle cx="650" cy="280" r="130" fill="oklch(0.7 0.12 ${hue})" opacity="0.62"/>`,
    `<path d="M110 930 C260 710 360 780 470 620 C560 500 680 620 805 430 L805 1120 L110 1120 Z" fill="oklch(0.62 0.14 ${hue})" opacity="0.75"/>`,
    `<text x="450" y="590" text-anchor="middle" font-family="Arial, sans-serif" font-size="64" font-weight="700" fill="oklch(0.28 0.08 ${hue})">${escapeSvg(label)}</text>`,
    '</svg>',
  ].join('');
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function clone<T>(value: T): T {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function escapeSvg(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;',
  }[char] || char));
}
