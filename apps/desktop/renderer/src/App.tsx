import {
  Activity,
  AlertTriangle,
  Bell,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Database,
  ExternalLink,
  Folder,
  FolderOpen,
  FolderSearch,
  Home,
  Info,
  ListChecks,
  Loader2,
  PackageCheck,
  Pause,
  Power,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import { type CSSProperties, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';

import { Badge, Button, Card, IconButton, Skeleton } from './components/ui';
import { isDesktopPreviewMode } from './dev-preview';
import { DESKTOP_COPY, detectDesktopLocale, getDesktopCopy, type DesktopCopy, type DesktopLocale } from './desktop-i18n';
import {
  aggregateJobPercent,
  CATEGORY_COPY,
  categoryLabel,
  cn,
  createSessionId,
  deriveCandidates,
  fileName,
  formatBytes,
  formatDate,
  formatDuration,
  formatMetric,
  formatNumber,
  getDesktopLocale,
  isRunning,
  jobKey,
  jobPercent,
  mergeJobs,
  normalizeDirectories,
  normalizeJobs,
  normalizeSessions,
  progressText,
  readableError,
  removeAssetsFromPayload,
  reportSummary,
  setDesktopLocale,
  successfulActionAssetIds,
} from './lib';
import type {
  DesktopBridge,
  NormalizedAsset,
  NormalizedCandidate,
  ReportInput,
  ReportPayload,
  ScanJob,
  SessionRecord,
  TrayState,
  UpdateCheckResult,
} from './types';

const PAGE_SIZE_OPTIONS = [60, 120, 240];
const PENDING_VIEW_KEY = 'media-clean-desktop:pending-view';
const TRAY_ROW_ACCENTS = [
  'oklch(0.62 0.2 255)',
  'oklch(0.62 0.18 150)',
  'oklch(0.64 0.18 302)',
];

type View = 'scan' | 'tasks' | 'review' | 'about';
type TrashMode = 'trash' | 'delete';
type ConfirmTrashOptions = {
  mode?: TrashMode;
  assetIds?: string[];
};
type PermanentDeleteRequest = {
  assetIds: string[];
};

export function DesktopApp() {
  const surface = getRendererSurface();
  const bridge = getBridge();
  const previewMode = isDesktopPreviewMode();
  const [locale, setLocale] = useState<DesktopLocale>(() => {
    const initialLocale = detectDesktopLocale();
    setDesktopLocale(initialLocale);
    return initialLocale;
  });
  const copy = DESKTOP_COPY[locale];
  const [activeView, setActiveView] = useState<View>(() => (surface === 'tray' ? 'scan' : readInitialView()));
  const [directories, setDirectories] = useState<string[]>([]);
  const [mediaType, setMediaType] = useState('all');
  const [jobs, setJobs] = useState<ScanJob[]>([]);
  const [trayState, setTrayState] = useState<TrayState | null>(null);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [desktopVersion, setDesktopVersion] = useState('--');
  const [rendererMode, setRendererMode] = useState('--');
  const [updateCheck, setUpdateCheck] = useState<UpdateCheckResult | null>(null);
  const [payload, setPayload] = useState<ReportPayload | null>(null);
  const [reportInput, setReportInput] = useState<ReportInput | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: 'error' | 'success' | 'warning'; message: string } | null>(null);
  const [activeCategory, setActiveCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(60);
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(() => new Set());
  const [selectionAnchorId, setSelectionAnchorId] = useState<string | null>(null);
  const [detailCandidate, setDetailCandidate] = useState<NormalizedCandidate | null>(null);
  const [detailIndex, setDetailIndex] = useState(0);
  const [detailAnchorAssetId, setDetailAnchorAssetId] = useState<string | null>(null);
  const [permanentDeleteRequest, setPermanentDeleteRequest] = useState<PermanentDeleteRequest | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [trayRevealKey, setTrayRevealKey] = useState(0);

  const candidates = useMemo(() => deriveCandidates(payload), [payload]);
  const summary = useMemo(() => reportSummary(payload, candidates), [payload, candidates]);
  const activeJobs = jobs.filter((job) => isRunning(job.status));
  const completedJobs = jobs.filter((job) => job.status === 'completed');
  const failedJobs = jobs.filter((job) => job.status === 'failed');
  const selectedAssets = useMemo(() => {
    const byId = new Map<string, NormalizedAsset>();
    for (const candidate of candidates) {
      for (const asset of candidate.assets) {
        if (selectedAssetIds.has(asset.id)) byId.set(asset.id, asset);
      }
    }
    return Array.from(byId.values());
  }, [candidates, selectedAssetIds]);
  const selectedGroupCount = useMemo(
    () => candidates.filter((candidate) => candidate.assets.some((asset) => selectedAssetIds.has(asset.id))).length,
    [candidates, selectedAssetIds],
  );
  const cleaned = payload?.cleanupHistory || {};
  const categoryTabs = useMemo(() => {
    const counts = new Map<string, number>([['all', candidates.length]]);
    for (const candidate of candidates) counts.set(candidate.category, (counts.get(candidate.category) || 0) + 1);
    const order = ['all', 'duplicate', 'near_similar', 'low_value', 'video'];
    return Array.from(counts.entries())
      .filter(([category, count]) => category === 'all' || count > 0)
      .sort(([left], [right]) => {
        const leftIndex = order.indexOf(left);
        const rightIndex = order.indexOf(right);
        return (leftIndex < 0 ? 99 : leftIndex) - (rightIndex < 0 ? 99 : rightIndex);
      });
  }, [candidates]);
  const filteredCandidates = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return candidates.filter((candidate) => {
      if (activeCategory !== 'all' && candidate.category !== activeCategory) return false;
      if (!normalized) return true;
      const haystack = [
        candidate.id,
        candidate.title,
        candidate.description,
        ...(candidate.reasons || []),
        ...candidate.assets.map((asset) => asset.uri || asset.id),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalized);
    });
  }, [activeCategory, candidates, query]);
  const pageCount = Math.max(1, Math.ceil(filteredCandidates.length / pageSize));
  const safePageIndex = Math.min(pageIndex, pageCount - 1);
  const visibleCandidates = filteredCandidates.slice(safePageIndex * pageSize, safePageIndex * pageSize + pageSize);

  useEffect(() => {
    const syncLocale = () => {
      const nextLocale = detectDesktopLocale();
      setDesktopLocale(nextLocale);
      setLocale(nextLocale);
    };
    window.addEventListener('languagechange', syncLocale);
    return () => window.removeEventListener('languagechange', syncLocale);
  }, []);

  useEffect(() => {
    setDesktopLocale(locale);
    document.documentElement.lang = locale;
  }, [locale]);

  const refreshJobs = useCallback(async (silent = false) => {
    if (!bridge?.scanList) return;
    try {
      const result = await bridge.scanList();
      setJobs(normalizeJobs(result));
    } catch (error) {
      if (!silent) setNotice({ kind: 'error', message: readableError(error) });
    }
  }, [bridge]);

  const refreshSessions = useCallback(async (silent = false) => {
    if (!bridge?.sessionsList) return;
    try {
      const result = await bridge.sessionsList({ limit: 40 });
      setSessions(normalizeSessions(result));
    } catch (error) {
      if (!silent) setNotice({ kind: 'error', message: readableError(error) });
    }
  }, [bridge]);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    await Promise.allSettled([refreshJobs(true), refreshSessions(true)]);
    setLoading(false);
  }, [refreshJobs, refreshSessions]);

  const checkUpdates = useCallback(async () => {
    if (!bridge?.updateCheck) {
      setUpdateCheck({
        source: 'electron-app',
        status: 'reserved',
        provider: 'pending-release-workflow',
        releaseChannel: 'stable',
        workflow: copy.update.workflow,
        repo: 'Media Clean',
        currentVersion: desktopVersion,
        latestVersion: null,
        latestTag: null,
        canUpdate: false,
        checkedAt: new Date().toISOString(),
        message: copy.update.reservedMessage,
      });
      return;
    }
    setBusy('update-check');
    try {
      setUpdateCheck(await bridge.updateCheck());
    } catch (error) {
      setUpdateCheck({
        source: 'electron-app',
        status: 'reserved',
        provider: 'pending-release-workflow',
        releaseChannel: 'stable',
        workflow: copy.update.workflow,
        repo: 'Media Clean',
        currentVersion: desktopVersion,
        latestVersion: null,
        latestTag: null,
        canUpdate: false,
        checkedAt: new Date().toISOString(),
        message: copy.update.failedMessage,
        error: readableError(error),
      });
    } finally {
      setBusy(null);
    }
  }, [bridge, copy, desktopVersion]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    let cancelled = false;
    async function loadDesktopMeta() {
      const [versionResult, rendererResult] = await Promise.allSettled([
        bridge?.version?.(),
        bridge?.rendererMode?.(),
      ]);
      if (cancelled) return;
      if (versionResult.status === 'fulfilled' && versionResult.value) setDesktopVersion(versionResult.value);
      if (rendererResult.status === 'fulfilled' && rendererResult.value) setRendererMode(rendererResult.value);
    }
    void loadDesktopMeta();
    return () => {
      cancelled = true;
    };
  }, [bridge]);

  useEffect(() => {
    if (!bridge?.scanSubscribe) return undefined;
    return bridge.scanSubscribe((nextJobs) => setJobs(normalizeJobs(nextJobs)));
  }, [bridge]);

  useEffect(() => {
    if (surface !== 'tray' || !bridge?.trayState) return undefined;
    let cancelled = false;
    async function loadTrayState() {
      try {
        const nextState = await bridge?.trayState?.();
        if (cancelled || !nextState) return;
        setTrayState(nextState);
        setJobs(normalizeJobs(nextState.jobs));
      } catch (error) {
        if (!cancelled) setNotice({ kind: 'error', message: readableError(error) });
      }
    }
    void loadTrayState();
    return () => {
      cancelled = true;
    };
  }, [bridge, surface]);

  useEffect(() => {
    if (surface !== 'tray' || !bridge?.traySubscribe) return undefined;
    return bridge.traySubscribe((nextState) => {
      setTrayState(nextState);
      setJobs(normalizeJobs(nextState.jobs));
    });
  }, [bridge, surface]);

  useEffect(() => {
    if (surface !== 'tray') return undefined;
    const handleTrayShown = () => setTrayRevealKey((current) => current + 1);
    window.addEventListener('media-clean:tray-shown', handleTrayShown);
    return () => window.removeEventListener('media-clean:tray-shown', handleTrayShown);
  }, [surface]);

  useEffect(() => {
    const timer = window.setInterval(() => void refreshJobs(true), 1500);
    return () => window.clearInterval(timer);
  }, [refreshJobs]);

  useEffect(() => {
    const handleHome = () => setActiveView('scan');
    const handleReview = () => setActiveView('review');
    window.addEventListener('media-clean:navigate-home', handleHome);
    window.addEventListener('media-clean:navigate-review', handleReview);
    return () => {
      window.removeEventListener('media-clean:navigate-home', handleHome);
      window.removeEventListener('media-clean:navigate-review', handleReview);
    };
  }, []);

  useEffect(() => {
    if (surface === 'tray') return undefined;
    const applyPendingView = () => {
      const nextView = consumePendingView();
      if (nextView) setActiveView(nextView);
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === PENDING_VIEW_KEY) applyPendingView();
    };
    applyPendingView();
    window.addEventListener('storage', handleStorage);
    window.addEventListener('focus', applyPendingView);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', applyPendingView);
    };
  }, [surface]);

  useEffect(() => {
    if (activeCategory !== 'all' && !categoryTabs.some(([category]) => category === activeCategory)) setActiveCategory('all');
  }, [activeCategory, categoryTabs]);

  useEffect(() => {
    if (activeView === 'about' && !updateCheck && desktopVersion !== '--') void checkUpdates();
  }, [activeView, checkUpdates, desktopVersion, updateCheck]);

  useEffect(() => {
    if (activeView !== 'review') return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || isEditableKeyTarget(event.target)) return;
      if (detailCandidate) {
        if (event.key === 'Escape') {
          event.preventDefault();
          setDetailCandidate(null);
        }
        return;
      }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        setPageIndex((current) => {
          if (event.key === 'ArrowLeft') return Math.max(0, current - 1);
          return Math.min(pageCount - 1, current + 1);
        });
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [activeView, detailCandidate, pageCount]);

  const chooseDirectories = async () => {
    if (!bridge?.chooseDirectories) {
      setNotice({ kind: 'error', message: copy.bridge.missingChooseDirectories });
      return;
    }
    try {
      const result = await bridge.chooseDirectories();
      const next = normalizeDirectories(result);
      if (next.length === 0) return;
      setDirectories((current) => Array.from(new Set([...current, ...next])));
      setActiveView('scan');
      setNotice({ kind: 'success', message: copy.notice.directoriesSelected(formatNumber(next.length)) });
    } catch (error) {
      setNotice({ kind: 'error', message: readableError(error) });
    }
  };

  const startScan = async () => {
    if (!bridge?.scanStart || directories.length === 0) return;
    setBusy('scan');
    try {
      const result = await bridge.scanStart({
        roots: directories,
        mediaType,
        sessionId: createSessionId(),
      });
      setJobs((current) => mergeJobs(current, normalizeJobs(result)));
      setActiveView('tasks');
      setNotice({ kind: 'success', message: copy.notice.scanSubmitted });
      await refreshJobs(true);
    } catch (error) {
      setNotice({ kind: 'error', message: readableError(error) });
    } finally {
      setBusy(null);
    }
  };

  const openReport = useCallback(async (input: ReportInput) => {
    if (!bridge?.reportLoad) return;
    setBusy('report');
    setLoading(true);
    try {
      const nextPayload = await bridge.reportLoad(input);
      setPayload(nextPayload);
      setReportInput(input);
      setSelectedAssetIds(new Set());
      setActiveCategory('all');
      setQuery('');
      setPageIndex(0);
      setDetailCandidate(null);
      setActiveView('review');
      setNotice({ kind: 'success', message: copy.notice.reportOpened });
    } catch (error) {
      setNotice({ kind: 'error', message: readableError(error) });
    } finally {
      setBusy(null);
      setLoading(false);
    }
  }, [bridge, copy]);

  useEffect(() => {
    if (!previewMode || surface === 'tray' || activeView !== 'review' || payload || busy === 'report' || !bridge?.reportLoad) return;
    void openReport({ sessionId: 'preview-travel' });
  }, [activeView, bridge, busy, openReport, payload, previewMode, surface]);

  useEffect(() => {
    const handleOpenReport = (event: Event) => {
      const input = (event as CustomEvent<ReportInput>).detail;
      if (input) void openReport(input);
    };
    window.addEventListener('media-clean:open-report', handleOpenReport);
    return () => window.removeEventListener('media-clean:open-report', handleOpenReport);
  }, [openReport]);

  const deleteSession = async (session: SessionRecord) => {
    if (!bridge?.sessionsDelete) return;
    const sessionId = session.sessionId || session.id || '';
    if (!window.confirm(copy.notice.deleteSessionConfirm(sessionId))) return;
    try {
      await bridge.sessionsDelete({ sessionId, sessionPath: session.sessionPath || session.path || null });
      setSessions((current) => current.filter((item) => item !== session));
    } catch (error) {
      setNotice({ kind: 'error', message: readableError(error) });
    }
  };

  const executeTrash = async (mode: TrashMode, assetIds: string[]) => {
    const targetAssetIds = uniqueAssetIds(assetIds);
    if (!bridge?.trashConfirm || !payload || targetAssetIds.length === 0) return;
    const session = payload.session || {};
    const input = {
      sessionId: session.sessionId || reportInput?.sessionId || null,
      sessionPath: payload.paths?.session || reportInput?.sessionPath || null,
      cleanupPlanPath: payload.paths?.cleanupPlan || reportInput?.cleanupPlanPath || null,
      assetIds: targetAssetIds,
      confirm: true,
      mode,
    };
    setBusy(mode);
    try {
      const result = await bridge.trashConfirm(input);
      const removed = successfulActionAssetIds(result);
      const removedIds = removed.size > 0 ? removed : new Set(targetAssetIds);
      setPayload((current) => removeAssetsFromPayload(current, removedIds));
      setSelectedAssetIds(new Set());
      setNotice({
        kind: 'success',
        message: mode === 'delete'
          ? copy.notice.permanentDeleted(formatNumber(removedIds.size))
          : copy.notice.trashMoved(formatNumber(removedIds.size)),
      });
    } catch (error) {
      setNotice({ kind: 'error', message: readableError(error) });
    } finally {
      setBusy(null);
    }
  };

  const confirmTrash = async (options: ConfirmTrashOptions = {}) => {
    const targetAssetIds = options.assetIds?.length ? uniqueAssetIds(options.assetIds) : Array.from(selectedAssetIds);
    const mode: TrashMode = options.mode || 'trash';
    if (mode === 'delete') {
      setPermanentDeleteRequest({ assetIds: targetAssetIds });
      return;
    }
    await executeTrash(mode, targetAssetIds);
  };

  const confirmPermanentDelete = async () => {
    const request = permanentDeleteRequest;
    if (!request) return;
    setPermanentDeleteRequest(null);
    await executeTrash('delete', request.assetIds);
  };

  const cancelJob = async (job: ScanJob) => {
    const jobId = job.jobId || job.id;
    if (!bridge?.scanCancel || !jobId) return;
    setBusy(`cancel:${jobId}`);
    try {
      const result = await bridge.scanCancel(jobId);
      setJobs((current) => mergeJobs(current, normalizeJobs(result ? [result] : [])));
      setNotice({ kind: 'success', message: copy.notice.scanPaused });
      await refreshJobs(true);
    } catch (error) {
      setNotice({ kind: 'error', message: readableError(error) });
    } finally {
      setBusy(null);
    }
  };

  const cancelRunningJobs = async () => {
    const runningJobs = trayState?.activeJobs?.length
      ? normalizeJobs(trayState.activeJobs)
      : jobs.filter((job) => isRunning(job.status) && (job.jobId || job.id));
    if (runningJobs.length === 0) return;
    setBusy('cancel-all');
    try {
      if (surface === 'tray' && bridge?.trayPause) {
        const nextState = await bridge.trayPause();
        setTrayState(nextState);
        setJobs(normalizeJobs(nextState.jobs));
        setNotice({ kind: 'success', message: copy.notice.runningPaused(formatNumber(runningJobs.length)) });
        return;
      }
      if (!bridge?.scanCancel) return;
      const results = await Promise.all(runningJobs.map((job) => bridge.scanCancel?.(String(job.jobId || job.id))));
      setJobs((current) => mergeJobs(current, normalizeJobs(results.filter(Boolean))));
      setNotice({ kind: 'success', message: copy.notice.runningPaused(formatNumber(runningJobs.length)) });
      await refreshJobs(true);
    } catch (error) {
      setNotice({ kind: 'error', message: readableError(error) });
    } finally {
      setBusy(null);
    }
  };

  const openWorkbenchView = async (view: View) => {
    setPendingView(view);
    try {
      if (surface === 'tray') {
        if (view === 'review' && bridge?.trayOpenReview) {
          await bridge.trayOpenReview();
          return;
        }
        if (bridge?.trayOpenWorkbench) {
          await bridge.trayOpenWorkbench();
          return;
        }
      }
      setActiveView(view);
      await bridge?.openHome?.();
    } catch (error) {
      setNotice({ kind: 'error', message: readableError(error) });
    }
  };

  const openTrayJobReview = async (job: ScanJob) => {
    const input = reportInputFromJob(job);
    setPendingView('review');
    try {
      if (surface === 'tray' && input && bridge?.trayOpenJobReview) {
        await bridge.trayOpenJobReview(input);
        return;
      }
      if (input && bridge?.reportLoad) {
        await openReport(input);
        return;
      }
      await openWorkbenchView('review');
    } catch (error) {
      setNotice({ kind: 'error', message: readableError(error) });
    }
  };

  const openNotificationSettings = async () => {
    try {
      const opener = surface === 'tray'
        ? bridge?.trayOpenNotificationSettings
        : bridge?.openNotificationSettings;
      if (!opener) {
        setNotice({ kind: 'warning', message: copy.notice.notificationUnavailable });
        return;
      }
      const opened = await opener();
      setNotice(opened === false
        ? { kind: 'warning', message: copy.notice.notificationOpenFailed }
        : { kind: 'success', message: copy.notice.notificationOpened });
    } catch (error) {
      setNotice({ kind: 'error', message: readableError(error) });
    }
  };

  const chooseAndScanFromTray = async () => {
    if (!bridge?.trayChooseAndScan) {
      await openWorkbenchView('scan');
      return;
    }
    setBusy('tray-choose-scan');
    try {
      const nextState = await bridge.trayChooseAndScan();
      setTrayState(nextState);
      setJobs(normalizeJobs(nextState.jobs));
    } catch (error) {
      setNotice({ kind: 'error', message: readableError(error) });
    } finally {
      setBusy(null);
    }
  };

  const toggleCandidate = (candidate: NormalizedCandidate, range: boolean) => {
    setSelectedAssetIds((current) => {
      const next = new Set(current);
      const shouldSelect = !candidate.assets.every((asset) => next.has(asset.id));
      const targetCandidates = range && selectionAnchorId
        ? candidateRange(visibleCandidates, selectionAnchorId, candidate.id)
        : [candidate];
      for (const item of targetCandidates) {
        for (const asset of item.assets) {
          if (shouldSelect) next.add(asset.id);
          else next.delete(asset.id);
        }
      }
      return next;
    });
    setSelectionAnchorId(candidate.id);
  };

  const toggleAsset = (assetId: string, selected: boolean) => {
    setSelectedAssetIds((current) => {
      const next = new Set(current);
      if (selected) next.add(assetId);
      else next.delete(assetId);
      return next;
    });
  };

  const toggleDetailRange = (assetId: string) => {
    if (!detailCandidate) return;
    setSelectedAssetIds((current) => {
      const next = new Set(current);
      const anchor = detailAnchorAssetId || detailCandidate.assets[detailIndex]?.id || assetId;
      const anchorIndex = Math.max(0, detailCandidate.assets.findIndex((asset) => asset.id === anchor));
      const targetIndex = detailCandidate.assets.findIndex((asset) => asset.id === assetId);
      if (targetIndex < 0) return next;
      const shouldSelect = !next.has(assetId);
      const start = Math.min(anchorIndex, targetIndex);
      const end = Math.max(anchorIndex, targetIndex);
      for (const asset of detailCandidate.assets.slice(start, end + 1)) {
        if (shouldSelect) next.add(asset.id);
        else next.delete(asset.id);
      }
      return next;
    });
    setDetailAnchorAssetId(assetId);
  };

  const selectedStatus = copy.review.selectedStatus(formatNumber(selectedAssets.length), formatNumber(selectedGroupCount));
  const sidebarStatus = activeJobs.length > 0
    ? copy.sidebar.scanningStatus(formatNumber(activeJobs.length))
    : completedJobs.length > 0
      ? copy.sidebar.completedStatus(formatNumber(completedJobs.length))
      : copy.sidebar.idleStatus;

  if (surface === 'tray') {
    return (
      <>
        {previewMode ? <DevPreviewDock copy={copy} /> : null}
        <TraySurface
          jobs={jobs}
          trayState={trayState}
          bridge={bridge}
          copy={copy}
          busy={busy}
          notice={notice}
          onCancelJob={cancelJob}
          onCancelRunningJobs={cancelRunningJobs}
          onOpenWorkbench={() => openWorkbenchView('scan')}
          onOpenReview={() => openWorkbenchView('review')}
          onOpenJobReview={openTrayJobReview}
          onChooseAndScan={chooseAndScanFromTray}
          onOpenNotificationSettings={openNotificationSettings}
          onClose={() => bridge?.trayClose?.() ?? window.close()}
          onQuit={() => bridge?.trayQuit?.() ?? window.close()}
          revealKey={trayRevealKey}
        />
      </>
    );
  }

  return (
    <main className={cn('desktop-app-shell', sidebarCollapsed && 'sidebar-collapsed')}>
      {previewMode ? <DevPreviewDock copy={copy} /> : null}
      <aside className={cn('desktop-sidebar', sidebarCollapsed && 'collapsed')} aria-label={copy.app.navigation}>
        <div className="sidebar-brand">
          <div className="sidebar-brand-main">
            <span className="brand-mark" aria-hidden="true" />
            <div className="sidebar-label">
              <strong>Media Clean</strong>
              <span>{copy.app.platform}</span>
            </div>
          </div>
          <button
            className="sidebar-toggle"
            type="button"
            aria-expanded={!sidebarCollapsed}
            aria-label={sidebarCollapsed ? copy.sidebar.collapsedExpand : copy.sidebar.collapsedCollapse}
            title={sidebarCollapsed ? copy.sidebar.collapsedExpand : copy.sidebar.collapsedCollapse}
            onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
          >
            {sidebarCollapsed ? <ChevronRight /> : <ChevronLeft />}
          </button>
        </div>
        <div className="sidebar-status">
          <p>{copy.sidebar.workbench}</p>
          <strong>{sidebarStatus}</strong>
          <span>{bridge ? copy.bridge.ready : copy.bridge.waiting}</span>
        </div>
        <nav className="task-nav" aria-label={copy.app.workbenchViews}>
          <NavButton active={activeView === 'scan'} icon={<FolderSearch />} title={copy.nav.scan.title} desc={copy.nav.scan.desc} onClick={() => setActiveView('scan')} />
          <NavButton active={activeView === 'tasks'} icon={<Clock3 />} title={copy.nav.tasks.title} desc={copy.nav.tasks.desc} onClick={() => setActiveView('tasks')} />
          <NavButton active={activeView === 'review'} icon={<Check />} title={copy.nav.review.title} desc={copy.nav.review.desc} onClick={() => setActiveView('review')} />
        </nav>
        <div className="sidebar-secondary">
          <SecondaryNavButton active={activeView === 'about'} icon={<Info />} title={copy.common.aboutStatus} onClick={() => setActiveView('about')} />
        </div>
      </aside>

      <section className="desktop-main">
        <header className="hero-panel">
          <div>
            <p className="eyebrow">{copy.hero.eyebrow}</p>
            <h1>{copy.hero.title}</h1>
            <p className="muted">{copy.hero.desc}</p>
          </div>
          <div className="hero-actions">
            <Button onClick={() => setActiveView('scan')} type="button">
              <Home /> {copy.common.home}
            </Button>
            <Button onClick={refreshAll} type="button" disabled={loading}>
              <RefreshCw /> {copy.common.refresh}
            </Button>
            <Button variant="primary" onClick={chooseDirectories} type="button" disabled={!bridge?.chooseDirectories}>
              <FolderOpen /> {copy.common.chooseDirectory}
            </Button>
          </div>
        </header>

        {notice ? <div className={cn('notice', notice.kind)}>{notice.message}</div> : null}
        {loading ? <DesktopSkeleton view={activeView} /> : null}

        {activeView === 'scan' || activeView === 'tasks' || activeView === 'review' ? (
          <FlowStrip activeView={activeView} directories={directories} jobs={jobs} candidates={candidates} selectedCount={selectedAssets.length} cleanedCount={Number(cleaned.assetCount || 0)} copy={copy} />
        ) : null}

        {activeView === 'scan' ? (
          <ScanView
            directories={directories}
            mediaType={mediaType}
            sessions={sessions}
            busy={busy}
            bridge={bridge}
            copy={copy}
            onChooseDirectories={chooseDirectories}
            onClearDirectories={() => setDirectories([])}
            onRemoveDirectory={(directory) => setDirectories((current) => current.filter((item) => item !== directory))}
            onMediaTypeChange={setMediaType}
            onStartScan={startScan}
            onRefreshSessions={() => refreshSessions(false)}
            onOpenReport={openReport}
            onDeleteSession={deleteSession}
          />
        ) : null}

        {activeView === 'tasks' ? (
          <TasksView
            jobs={jobs}
            bridge={bridge}
            busy={busy}
            copy={copy}
            onCancelJob={cancelJob}
            onCancelRunningJobs={cancelRunningJobs}
            onOpenReport={openReport}
            onOpenReview={() => setActiveView('review')}
          />
        ) : null}

        {activeView === 'review' ? (
          <ReviewView
            payload={payload}
            reportInput={reportInput}
            summary={summary}
            candidates={candidates}
            copy={copy}
            categoryTabs={categoryTabs}
            activeCategory={activeCategory}
            query={query}
            pageIndex={safePageIndex}
            pageCount={pageCount}
            pageSize={pageSize}
            filteredCount={filteredCandidates.length}
            visibleCandidates={visibleCandidates}
            selectedAssetIds={selectedAssetIds}
            selectedStatus={selectedStatus}
            historyText={`历史已清理 ${formatNumber(Number(cleaned.assetCount || 0))} 个 · ${formatBytes(Number(cleaned.fileSize || 0))}`}
            busy={busy}
            bridge={bridge}
            onCategoryChange={(category) => {
              setActiveCategory(category);
              setPageIndex(0);
            }}
            onQueryChange={(value) => {
              setQuery(value);
              setPageIndex(0);
            }}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPageIndex(0);
            }}
            onPageChange={setPageIndex}
            onSelectVisible={() => setSelectedAssetIds((current) => addVisibleAssets(current, visibleCandidates))}
            onClearVisible={() => setSelectedAssetIds((current) => clearVisibleAssets(current, visibleCandidates))}
            onToggleCandidate={toggleCandidate}
            onOpenDetail={(candidate, index) => {
              setDetailCandidate(candidate);
              setDetailIndex(index);
              setDetailAnchorAssetId(candidate.assets[index]?.id || null);
            }}
            onReload={() => reportInput && openReport(reportInput)}
            onBackToScan={() => setActiveView('scan')}
            onConfirmTrash={confirmTrash}
          />
        ) : null}

        {activeView === 'about' ? (
          <AboutView
            bridge={bridge}
            version={desktopVersion}
            rendererMode={rendererMode}
            jobs={jobs}
            sessions={sessions}
            copy={copy}
            updateCheck={updateCheck}
            busy={busy}
            onCheckUpdates={checkUpdates}
            onOpenNotificationSettings={openNotificationSettings}
          />
        ) : null}
      </section>

      {detailCandidate ? (
        <DetailDialog
          candidate={detailCandidate}
          reviewCandidates={candidates}
          index={detailIndex}
          selectedAssetIds={selectedAssetIds}
          bridge={bridge}
          copy={copy}
          busy={busy}
          onClose={() => setDetailCandidate(null)}
          onIndexChange={(index) => {
            setDetailIndex(index);
            setDetailAnchorAssetId(detailCandidate.assets[index]?.id || null);
          }}
          onOpenCandidateAsset={(candidate, index) => {
            setDetailCandidate(candidate);
            setDetailIndex(index);
            setDetailAnchorAssetId(candidate.assets[index]?.id || null);
          }}
          onToggleAsset={toggleAsset}
          onToggleRange={toggleDetailRange}
          onSelectCurrent={(candidate, index) => {
            const current = candidate.assets[index];
            if (!current) return;
            setSelectedAssetIds((existing) => {
              const next = new Set(existing);
              for (const asset of candidate.assets) next.delete(asset.id);
              next.add(current.id);
              return next;
            });
          }}
          onSelectGroup={(candidate) => {
            setSelectedAssetIds((existing) => {
              const next = new Set(existing);
              for (const asset of candidate.assets) next.add(asset.id);
              return next;
            });
          }}
          onSelectOthers={(candidate, index) => {
            const current = candidate.assets[index];
            setSelectedAssetIds((existing) => {
              const next = new Set(existing);
              for (const asset of candidate.assets) {
                if (asset.id !== current?.id) next.add(asset.id);
              }
              return next;
            });
          }}
          onConfirmTrash={confirmTrash}
        />
      ) : null}
      <AlertConfirmDialog
        open={Boolean(permanentDeleteRequest)}
        title={copy.dialog.permanentDeleteTitle}
        description={copy.dialog.permanentDeleteDescription(formatNumber(permanentDeleteRequest?.assetIds.length || 0))}
        cancelLabel={copy.common.cancel}
        confirmLabel={copy.common.permanentDelete}
        busy={busy === 'delete'}
        onCancel={() => setPermanentDeleteRequest(null)}
        onConfirm={confirmPermanentDelete}
      />
    </main>
  );
}

function ScanView({
  directories,
  mediaType,
  sessions,
  busy,
  bridge,
  copy,
  onChooseDirectories,
  onClearDirectories,
  onRemoveDirectory,
  onMediaTypeChange,
  onStartScan,
  onRefreshSessions,
  onOpenReport,
  onDeleteSession,
}: {
  directories: string[];
  mediaType: string;
  sessions: SessionRecord[];
  busy: string | null;
  bridge: DesktopBridge | null;
  copy: DesktopCopy;
  onChooseDirectories: () => void;
  onClearDirectories: () => void;
  onRemoveDirectory: (directory: string) => void;
  onMediaTypeChange: (value: string) => void;
  onStartScan: () => void;
  onRefreshSessions: () => void;
  onOpenReport: (input: ReportInput) => void;
  onDeleteSession: (session: SessionRecord) => void;
}) {
  return (
    <section className="workspace-grid scan-layout">
      <Card>
        <PanelHeader kicker={copy.scan.kicker} title={copy.scan.title} desc={copy.scan.desc} />
        <div className="directory-grid">
          {directories.length === 0 ? (
            <EmptyState text={copy.scan.empty} />
          ) : (
            directories.map((directory) => (
              <article className="directory-card" key={directory}>
                <div className="directory-card-header">
                  <div className="min-w-0">
                    <Badge tone="blue">{copy.scan.localDirectory}</Badge>
                    <h3>{fileName(directory) || directory}</h3>
                  </div>
                  <IconButton type="button" onClick={() => onRemoveDirectory(directory)} aria-label={copy.scan.removeDirectory}>
                    <X />
                  </IconButton>
                </div>
                <p className="path">{directory}</p>
                <div className="directory-facts">
                  <Badge>{copy.scan.readable}</Badge>
                  <Badge>{copy.scan.resumable}</Badge>
                  <Badge>{copy.scan.independentTask}</Badge>
                </div>
              </article>
            ))
          )}
        </div>
        <div className="scan-controls">
          <label className="field">
            <span>{copy.scan.range}</span>
            <select value={mediaType} onChange={(event) => onMediaTypeChange(event.target.value)}>
              <option value="all">{copy.scan.allMedia}</option>
              <option value="photo">{copy.scan.photos}</option>
              <option value="video">{copy.scan.videos}</option>
            </select>
          </label>
          <div className="panel-actions">
            <Button type="button" onClick={onClearDirectories} disabled={directories.length === 0}>
              {copy.common.clear}
            </Button>
            <Button type="button" onClick={onChooseDirectories} disabled={!bridge?.chooseDirectories}>
              <Folder /> {copy.common.appendDirectory}
            </Button>
            <Button variant="primary" type="button" onClick={onStartScan} disabled={!bridge?.scanStart || directories.length === 0 || busy === 'scan'}>
              {busy === 'scan' ? <Loader2 className="spin" /> : <FolderSearch />}
              {copy.common.startBackgroundScan}
            </Button>
          </div>
        </div>
        <div className="trust-strip">
          <Badge tone="blue">{copy.scan.localRead}</Badge>
          <Badge>{copy.scan.noUpload}</Badge>
          <Badge>{copy.scan.autosave}</Badge>
          <Badge>{copy.scan.localRecognition}</Badge>
        </div>
      </Card>
      <Card>
        <PanelHeader kicker={copy.scan.historyKicker} title={copy.scan.historyTitle} desc={copy.scan.historyDesc}>
          <Button className="refresh-history-button" size="compact" type="button" onClick={onRefreshSessions} disabled={!bridge?.sessionsList}>
            <RefreshCw /> {copy.common.refreshHistory}
          </Button>
        </PanelHeader>
        <div className="history-list">
          {sessions.length === 0 ? (
            <EmptyState text={copy.scan.historyEmpty} />
          ) : (
            sessions.map((session) => <SessionCard key={`${session.sessionId || session.id}-${session.sessionPath || session.path}`} session={session} bridge={bridge} copy={copy} onOpenReport={onOpenReport} onDelete={onDeleteSession} />)
          )}
        </div>
      </Card>
    </section>
  );
}

function TasksView({
  jobs,
  bridge,
  busy,
  copy,
  onCancelJob,
  onCancelRunningJobs,
  onOpenReport,
  onOpenReview,
}: {
  bridge: DesktopBridge | null;
  busy: string | null;
  copy: DesktopCopy;
  jobs: ScanJob[];
  onCancelJob: (job: ScanJob) => void;
  onCancelRunningJobs: () => void;
  onOpenReport: (input: ReportInput) => void;
  onOpenReview: () => void;
}) {
  const active = jobs.filter((job) => isRunning(job.status));
  const completed = jobs.filter((job) => job.status === 'completed');
  const failed = jobs.filter((job) => job.status === 'failed');
  const percent = aggregateJobPercent(active);
  return (
    <section className="system-layout tasks-layout">
      <Card className="tasks-card">
        <PanelHeader kicker={copy.tasks.kicker} title={copy.tasks.title} desc={copy.tasks.desc}>
          <Button size="compact" type="button" onClick={onCancelRunningJobs} disabled={!bridge?.scanCancel || active.length === 0 || busy === 'cancel-all'}>
            {copy.common.pauseAll}
          </Button>
          <Button variant="primary" size="compact" type="button" onClick={onOpenReview}>
            {copy.common.openReview}
          </Button>
        </PanelHeader>
        <div className="task-summary-grid">
          <SummaryCard label={copy.tasks.directoryTasks} value={jobs.length} caption={copy.tasks.independentDirectories} />
          <SummaryCard label={copy.tasks.scanning} value={active.length} caption={copy.tasks.totalProgress(formatNumber(percent))} />
          <SummaryCard label={copy.tasks.completed} value={completed.length} caption={copy.tasks.canReview} />
          <SummaryCard label={copy.tasks.needsAttention} value={failed.length} caption={copy.tasks.permissionIssue} />
        </div>
        <div className="jobs-table-wrap">
          <table className="jobs-table">
            <thead>
              <tr>
                <th scope="col">{copy.tasks.directory}</th>
                <th scope="col">{copy.tasks.status}</th>
                <th scope="col">{copy.tasks.progress}</th>
                <th scope="col">{copy.tasks.data}</th>
                <th scope="col">{copy.tasks.actions}</th>
              </tr>
            </thead>
            <tbody>
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <EmptyState text={copy.tasks.empty} />
                  </td>
                </tr>
              ) : (
                jobs.map((job) => (
                  <JobTableRow
                    key={jobKey(job)}
                    job={job}
                    bridge={bridge}
                    copy={copy}
                    busy={busy}
                    onCancelJob={onCancelJob}
                    onOpenReport={onOpenReport}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}

function TraySurface({
  jobs,
  trayState,
  bridge,
  copy,
  busy,
  notice,
  revealKey,
  onCancelJob,
  onCancelRunningJobs,
  onOpenWorkbench,
  onOpenReview,
  onOpenJobReview,
  onChooseAndScan,
  onOpenNotificationSettings,
  onClose,
  onQuit,
}: {
  bridge: DesktopBridge | null;
  copy: DesktopCopy;
  busy: string | null;
  jobs: ScanJob[];
  notice: { kind: 'error' | 'success' | 'warning'; message: string } | null;
  revealKey: number;
  trayState: TrayState | null;
  onCancelJob: (job: ScanJob) => void;
  onCancelRunningJobs: () => void;
  onOpenWorkbench: () => void;
  onOpenReview: () => void;
  onOpenJobReview: (job: ScanJob) => void;
  onChooseAndScan: () => void;
  onOpenNotificationSettings: () => void;
  onClose: () => void;
  onQuit: () => void;
}) {
  const displayJobs = useMemo(() => normalizeJobs(trayState?.jobs || jobs), [jobs, trayState]);
  const queued = displayJobs.filter((job) => isQueued(job.status));
  const active = displayJobs.filter((job) => isRunning(job.status) && !isQueued(job.status));
  const completed = displayJobs.filter((job) => job.status === 'completed');
  const failed = displayJobs.filter((job) => job.status === 'failed');
  const orderedJobs = [
    ...active,
    ...queued,
    ...completed,
    ...failed,
    ...displayJobs.filter((job) => !active.includes(job) && !queued.includes(job) && !completed.includes(job) && !failed.includes(job)),
  ];
  const percent = active.length > 0
    ? Math.round(Number(trayState?.aggregatePercent ?? aggregateJobPercent(active)))
    : completed.length > 0 && active.length === 0 && queued.length === 0
      ? 100
      : 0;
  const statusKind = failed.length > 0 ? 'attention' : active.length > 0 ? 'running' : completed.length > 0 ? 'complete' : 'idle';
  const statusText = failed.length > 0 ? copy.tray.statusAttention : active.length > 0 ? copy.tray.statusRunning : completed.length > 0 ? copy.tray.statusComplete : copy.tray.statusIdle;
  const visibleJobs = orderedJobs.slice(0, 3);
  const hiddenJobCount = Math.max(0, orderedJobs.length - visibleJobs.length);
  const totalCandidates = displayJobs.reduce((sum, job) => sum + Number(job.cleanupPlanCount || job.clusterCount || 0), 0);
  const totalAssets = displayJobs.reduce((sum, job) => sum + Number(job.assetCount || job.total || job.progress?.total || 0), 0);
  const canReview = completed.length > 0 || failed.length > 0 || displayJobs.some((job) => Boolean(reportInputFromJob(job)));
  const canPauseAll = Boolean((bridge?.trayPause || bridge?.scanCancel) && active.length > 0 && busy !== 'cancel-all');
  const description = failed.length > 0
    ? copy.tray.descriptionAttention
    : active.length > 0
      ? copy.tray.descriptionRunning
      : completed.length > 0
        ? copy.tray.descriptionComplete
        : copy.tray.descriptionIdle;
  const primaryAction = canReview
    ? { label: copy.common.openReviewResult, icon: <ListChecks />, onClick: onOpenReview, disabled: false }
    : active.length > 0
      ? { label: copy.common.openWorkbench, icon: <ExternalLink />, onClick: onOpenWorkbench, disabled: false }
      : { label: copy.common.chooseAndScan, icon: <FolderSearch />, onClick: onChooseAndScan, disabled: !bridge?.trayChooseAndScan || busy === 'tray-choose-scan' };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <main className="tray-surface" aria-label={copy.tray.aria}>
      <section key={revealKey} className="tray-island" data-reveal-key={revealKey}>
        <div className="tray-island-tip" aria-hidden />
        <section className="tray-progress-summary">
          <button className="tray-summary-close-button" type="button" onClick={onClose} aria-label={copy.tray.closeIsland}>
            <X />
          </button>
          <span className="tray-progress-logo" role="img" aria-label="Media Clean" />
          <div>
            <div className="tray-progress-title">
              <strong>{statusText}</strong>
              <span className={cn('tray-status-pill', statusKind)}>
                <span aria-hidden />
                {active.length > 0 ? copy.tray.activeCount(formatNumber(active.length)) : completed.length > 0 ? copy.tray.completedCount(formatNumber(completed.length)) : copy.tray.localIdle}
              </span>
            </div>
            <p>{description}</p>
            <div className="tray-progress-facts">
              <span>{copy.tray.overallProgress(formatNumber(percent))}</span>
              <span>{copy.tray.directories(formatNumber(displayJobs.length))}</span>
              <span>{copy.tray.media(formatNumber(totalAssets))}</span>
              <span>{copy.tray.candidates(formatNumber(totalCandidates))}</span>
              <span>{copy.tray.completedCount(formatNumber(completed.length))}</span>
              {failed.length > 0 ? <span>{copy.tray.failed(formatNumber(failed.length))}</span> : null}
            </div>
          </div>
        </section>

        {queued.length > 0 ? (
          <section className="tray-queue-strip" aria-label={copy.tray.queueAria}>
            <Clock3 />
            <div>
              <strong>{copy.tray.queueTitle(formatNumber(queued.length))}</strong>
              <p>{copy.tray.queueDesc}</p>
            </div>
          </section>
        ) : null}

        <section className="tray-task-list" aria-label={copy.tray.taskListAria}>
          {visibleJobs.length === 0 ? (
            <div className="tray-empty-row">
              <FolderSearch />
              <div>
                <strong>{copy.tray.emptyTitle}</strong>
                <p>{copy.tray.emptyDesc}</p>
              </div>
            </div>
          ) : (
            visibleJobs.map((job, index) => (
              <TrayTaskRow
                key={`tray-surface-${jobKey(job)}`}
                job={job}
                bridge={bridge}
                busy={busy}
                copy={copy}
                accent={TRAY_ROW_ACCENTS[index % TRAY_ROW_ACCENTS.length]}
                index={index}
                onCancelJob={onCancelJob}
                onOpenReview={onOpenReview}
                onOpenJobReview={onOpenJobReview}
              />
            ))
          )}
          {hiddenJobCount > 0 ? <p className="tray-more-note">{copy.tray.more(formatNumber(hiddenJobCount))}</p> : null}
        </section>

        {notice ? <div className={cn('tray-inline-notice', notice.kind)}>{notice.message}</div> : null}

        <div className="tray-local-note">
          <ShieldCheck />
          <span>{copy.tray.localNote}</span>
          <button type="button" onClick={onOpenNotificationSettings}>
            <Bell /> {copy.common.notificationSettings}
          </button>
        </div>

        <div className="tray-primary-actions">
          <Button variant="primary" type="button" onClick={primaryAction.onClick} disabled={primaryAction.disabled}>
            {primaryAction.icon} {primaryAction.label}
          </Button>
          <Button type="button" onClick={onOpenWorkbench}>
            <ExternalLink /> {copy.common.openWorkbench}
          </Button>
        </div>

        <div className="tray-footer-actions">
          <button className="tray-collapse-action" type="button" onClick={onClose}>
            <X /> {copy.common.collapse}
          </button>
          <button type="button" disabled={!canPauseAll} onClick={onCancelRunningJobs}>
            <Pause /> {copy.common.pauseAll}
          </button>
          <button className="danger" type="button" onClick={onQuit}>
            <Power /> {copy.common.quit}
          </button>
        </div>
      </section>
    </main>
  );
}

function TrayTaskRow({
  job,
  bridge,
  busy,
  copy,
  accent,
  index,
  onCancelJob,
  onOpenReview,
  onOpenJobReview,
}: {
  accent: string;
  bridge: DesktopBridge | null;
  busy: string | null;
  copy: DesktopCopy;
  index: number;
  job: ScanJob;
  onCancelJob: (job: ScanJob) => void;
  onOpenReview: () => void;
  onOpenJobReview: (job: ScanJob) => void;
}) {
  const percent = jobPercent(job);
  const status = String(job.status || 'queued');
  const jobId = job.jobId || job.id || '';
  const running = isRunning(status);
  const completed = status === 'completed';
  const failed = status === 'failed';
  const queued = isQueued(status);
  const canPause = running && !queued && Boolean(bridge?.scanCancel && jobId) && busy !== `cancel:${jobId}`;
  const canReview = completed || failed || Boolean(reportInputFromJob(job));
  const statusTone = completed ? 'complete' : running && !queued ? 'running' : failed ? 'attention' : 'idle';
  return (
    <article className="tray-task-row" style={{ '--tray-row-progress': percent, '--tray-row-accent': accent, '--tray-row-index': index } as CSSProperties}>
      <div className="tray-task-topline">
        <div className="tray-task-name">
          <span className="tray-task-icon" aria-hidden>
            <Folder />
          </span>
          <div>
            <strong>{trayJobTitle(job)}</strong>
            <p>{scanPhaseLabel(job.phase || status)}</p>
          </div>
        </div>
        <span className={cn('tray-task-status', statusTone)}>
          {scanStatusLabel(status)}
        </span>
        <span className="tray-task-data">{trayJobMetric(job)}</span>
        <button
          className="tray-task-action pause"
          type="button"
          aria-label={copy.tray.pauseJob(trayJobTitle(job))}
          disabled={!canPause}
          onClick={() => onCancelJob(job)}
        >
          <Pause />
          <span>{copy.common.pause}</span>
        </button>
        <button
          className={cn('tray-task-action', 'review', failed && 'attention')}
          type="button"
          aria-label={copy.tray.openJobReview(trayJobTitle(job))}
          disabled={!canReview}
          onClick={() => {
            if (canReview) onOpenJobReview(job);
            else onOpenReview();
          }}
        >
          {failed ? <AlertTriangle /> : <ListChecks />}
          <span>{copy.common.review}</span>
        </button>
      </div>
      <div className="tray-task-progress-line">
        <div className="tray-task-progress" aria-label={copy.tray.progressAria(formatNumber(percent))}>
          <span />
        </div>
        <small>{percent}%</small>
      </div>
    </article>
  );
}

function TrayRecentSummary({ jobs }: { jobs: ScanJob[] }) {
  const copy = getDesktopCopy(getDesktopLocale());
  return (
    <section className="tray-recent-summary" aria-label={copy.tray.recentAria}>
      <div className="tray-recent-header">
        <strong>{copy.tray.recentTitle}</strong>
        <span>{copy.tray.recentVisible(formatNumber(jobs.length))}</span>
      </div>
      <div className="tray-recent-bars">
        {jobs.map((job) => {
          const percent = jobPercent(job);
          const status = String(job.status || 'queued');
          return (
            <div className={cn('tray-recent-item', trayTaskTone(status))} key={`recent-${jobKey(job)}`}>
              <div>
                <span>{trayJobTitle(job)}</span>
                <small>{scanStatusLabel(status)}</small>
              </div>
              <div className="tray-recent-track" style={{ '--tray-recent-progress': percent } as CSSProperties}>
                <span />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ReviewView({
  payload,
  reportInput,
  summary,
  candidates,
  copy,
  categoryTabs,
  activeCategory,
  query,
  pageIndex,
  pageCount,
  pageSize,
  filteredCount,
  visibleCandidates,
  selectedAssetIds,
  selectedStatus,
  historyText,
  busy,
  bridge,
  onCategoryChange,
  onQueryChange,
  onPageSizeChange,
  onPageChange,
  onSelectVisible,
  onClearVisible,
  onToggleCandidate,
  onOpenDetail,
  onReload,
  onBackToScan,
  onConfirmTrash,
}: {
  payload: ReportPayload | null;
  reportInput: ReportInput | null;
  summary: { assetCount: number; clusterCount: number; cleanupPlanCount: number; diagnosticCount: number };
  candidates: NormalizedCandidate[];
  copy: DesktopCopy;
  categoryTabs: Array<[string, number]>;
  activeCategory: string;
  query: string;
  pageIndex: number;
  pageCount: number;
  pageSize: number;
  filteredCount: number;
  visibleCandidates: NormalizedCandidate[];
  selectedAssetIds: Set<string>;
  selectedStatus: string;
  historyText: string;
  busy: string | null;
  bridge: DesktopBridge | null;
  onCategoryChange: (category: string) => void;
  onQueryChange: (value: string) => void;
  onPageSizeChange: (size: number) => void;
  onPageChange: (index: number) => void;
  onSelectVisible: () => void;
  onClearVisible: () => void;
  onToggleCandidate: (candidate: NormalizedCandidate, range: boolean) => void;
  onOpenDetail: (candidate: NormalizedCandidate, index: number) => void;
  onReload: () => void;
  onBackToScan: () => void;
  onConfirmTrash: () => void;
}) {
  const session = payload?.session || {};
  const root = session.source?.root || copy.review.emptyRoot;
  const start = filteredCount === 0 ? 0 : pageIndex * pageSize + 1;
  const end = Math.min(filteredCount, start + pageSize - 1);
  const hasSelection = selectedAssetIds.size > 0;
  return (
    <section className="review-layout">
      <Card className="report-panel">
        <PanelHeader kicker={copy.review.kicker} title={copy.review.title} desc={copy.review.desc(root)}>
          <Button size="compact" onClick={onReload} disabled={!reportInput || busy === 'report'} type="button">
            <RefreshCw /> {copy.common.reload}
          </Button>
          <Button size="compact" onClick={onBackToScan} type="button">
            {copy.common.backToScan}
          </Button>
        </PanelHeader>
        <div className="summary-grid">
          <SummaryCard label={copy.review.media} value={summary.assetCount} caption={copy.review.mediaCaption} />
          <SummaryCard label={copy.review.candidateGroups} value={summary.clusterCount} caption={copy.review.candidateCaption} />
          <SummaryCard label={copy.review.suggestions} value={summary.cleanupPlanCount} caption={copy.review.suggestionsCaption} />
          <SummaryCard label={copy.review.warnings} value={summary.diagnosticCount} caption={copy.review.warningsCaption} />
        </div>
        <div className="candidate-toolbar">
          <div className="category-tabs">
            {categoryTabs.map(([category, count]) => (
              <button className={cn('category-tab', activeCategory === category && 'active')} key={category} type="button" onClick={() => onCategoryChange(category)}>
                {categoryLabel(category)} <span>{formatNumber(count)}</span>
              </button>
            ))}
          </div>
          <label className="search-field">
            <Search />
            <input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder={copy.common.search} />
          </label>
        </div>
        <div className="pagination-bar">
          <p className="muted">
            {copy.review.pageInfo(formatNumber(start), formatNumber(end), formatNumber(filteredCount), formatNumber(pageIndex + 1), formatNumber(pageCount))}
          </p>
          <div className="pagination-actions">
            <Button size="compact" type="button" onClick={onSelectVisible} disabled={visibleCandidates.length === 0}>{copy.common.selectAll}</Button>
            <Button size="compact" type="button" onClick={onClearVisible} disabled={visibleCandidates.length === 0}>{copy.common.selectNone}</Button>
            {PAGE_SIZE_OPTIONS.map((size) => (
              <Button size="compact" active={pageSize === size} key={size} type="button" onClick={() => onPageSizeChange(size)}>{size}</Button>
            ))}
            <Button size="compact" type="button" onClick={() => onPageChange(0)} disabled={pageIndex <= 0}>{copy.common.firstPage}</Button>
            <Button size="compact" type="button" onClick={() => onPageChange(Math.max(0, pageIndex - 1))} disabled={pageIndex <= 0}>{copy.common.previous}</Button>
            <Button size="compact" type="button" onClick={() => onPageChange(Math.min(pageCount - 1, pageIndex + 1))} disabled={pageIndex >= pageCount - 1}>{copy.common.next}</Button>
            <Button size="compact" type="button" onClick={() => onPageChange(pageCount - 1)} disabled={pageIndex >= pageCount - 1}>{copy.common.lastPage}</Button>
          </div>
        </div>
        <div className="candidate-grid">
          {!payload ? (
            <EmptyState text={copy.review.noReport} />
          ) : visibleCandidates.length === 0 ? (
            <EmptyState text={copy.review.noMatch} />
          ) : (
            visibleCandidates.map((candidate) => (
              <CandidateCard
                key={candidate.id}
                candidate={candidate}
                selectedAssetIds={selectedAssetIds}
                bridge={bridge}
                copy={copy}
                onToggle={onToggleCandidate}
                onOpenDetail={onOpenDetail}
              />
            ))
          )}
        </div>
      </Card>
      {hasSelection ? (
        <section className="cleanup-dock">
          <div className="cleanup-copy">
            <h2>{copy.review.cleanupTitle}</h2>
            <p className="muted">{copy.review.selected(selectedStatus)}</p>
          </div>
          <div className="cleanup-meta">
            <Badge tone="amber">{historyText}</Badge>
          </div>
          <Button variant="danger" type="button" disabled={!payload || busy === 'trash' || busy === 'delete'} onClick={() => onConfirmTrash()}>
            <Trash2 /> {copy.common.trashConfirm}
          </Button>
        </section>
      ) : null}
    </section>
  );
}

function AboutView({
  bridge,
  version,
  rendererMode,
  jobs,
  sessions,
  copy,
  updateCheck,
  busy,
  onCheckUpdates,
  onOpenNotificationSettings,
}: {
  bridge: DesktopBridge | null;
  version: string;
  rendererMode: string;
  jobs: ScanJob[];
  sessions: SessionRecord[];
  copy: DesktopCopy;
  updateCheck: UpdateCheckResult | null;
  busy: string | null;
  onCheckUpdates: () => void;
  onOpenNotificationSettings: () => void;
}) {
  const running = jobs.filter((job) => isRunning(job.status)).length;
  const completed = jobs.filter((job) => job.status === 'completed').length;
  const failedJobs = jobs.filter((job) => job.status === 'failed' || job.error);
  const updateTone = updateCheck?.canUpdate ? 'amber' : updateCheck ? 'green' : undefined;
  const updateMessage = updateCheck?.canUpdate
    ? copy.update.available
    : updateCheck
      ? copy.update.checked
      : copy.update.idle;
  return (
    <section className="system-layout">
      <Card>
        <div className="panel-actions about-actions">
          <Button size="compact" type="button" onClick={onCheckUpdates} disabled={busy === 'update-check'}>
            {busy === 'update-check' ? <Loader2 className="spin" /> : <RefreshCw />} {copy.common.checkVersion}
          </Button>
          <Button size="compact" type="button" onClick={onOpenNotificationSettings}>
            <Bell /> {copy.common.notificationSettings}
          </Button>
        </div>

        <section className="version-panel">
          <div>
            <p className="section-kicker">{copy.about.section}</p>
            <h3>{copy.update.version(version)}</h3>
            <p>{updateMessage}</p>
          </div>
          <Badge tone={updateTone}>{updateCheck?.canUpdate ? copy.update.updatable : updateCheck ? copy.update.checkedBadge : copy.update.pending}</Badge>
          {updateCheck?.releaseUrl ? (
            <a href={updateCheck.releaseUrl} target="_blank" rel="noreferrer">
              <ExternalLink /> {copy.common.openRelease}
            </a>
          ) : null}
        </section>

        <div className="summary-grid">
          <SummaryCard label={copy.about.tasks} value={jobs.length} caption={copy.about.taskCaption(formatNumber(running), formatNumber(completed))} />
          <SummaryCard label={copy.about.history} value={sessions.length} caption={copy.about.historyCaption} />
          <SummaryCard label={copy.about.errors} value={failedJobs.length} caption={copy.about.errorsCaption(failedJobs.length > 0)} />
          <SummaryCard label={copy.about.connection} value={bridge ? 1 : 0} caption={bridge ? copy.bridge.ready : copy.bridge.waiting} />
        </div>

        <div className="system-grid">
          <StatusRow icon={<PackageCheck />} label={copy.about.workbench} value={rendererMode === 'static' ? copy.about.workbenchValueStatic : copy.about.workbenchValueDebug} tone={rendererMode === 'static' ? 'green' : 'blue'} detail={copy.about.workbenchDetail} />
          <StatusRow icon={<ShieldCheck />} label={copy.about.privacy} value={copy.about.privacyValue} tone="green" detail={copy.about.privacyDetail} />
          <StatusRow icon={<Database />} label={copy.about.records} value={sessions.length > 0 ? copy.about.recordsSaved : copy.about.recordsEmpty} tone={sessions.length > 0 ? 'green' : undefined} detail={copy.about.recordsDetail} />
          <StatusRow icon={<Activity />} label={copy.about.background} value={running > 0 ? copy.about.backgroundRunning : completed > 0 ? copy.about.backgroundReviewable : copy.about.backgroundIdle} tone={running > 0 ? 'blue' : completed > 0 ? 'green' : undefined} detail={copy.about.backgroundDetail} />
        </div>
      </Card>
    </section>
  );
}

function DetailDialog({
  candidate,
  reviewCandidates,
  index,
  selectedAssetIds,
  bridge,
  copy,
  busy,
  onClose,
  onIndexChange,
  onOpenCandidateAsset,
  onToggleAsset,
  onToggleRange,
  onSelectCurrent,
  onSelectGroup,
  onSelectOthers,
  onConfirmTrash,
}: {
  candidate: NormalizedCandidate;
  reviewCandidates: NormalizedCandidate[];
  index: number;
  selectedAssetIds: Set<string>;
  bridge: DesktopBridge | null;
  copy: DesktopCopy;
  busy: string | null;
  onClose: () => void;
  onIndexChange: (index: number) => void;
  onOpenCandidateAsset: (candidate: NormalizedCandidate, index: number) => void;
  onToggleAsset: (assetId: string, selected: boolean) => void;
  onToggleRange: (assetId: string) => void;
  onSelectCurrent: (candidate: NormalizedCandidate, index: number) => void;
  onSelectGroup: (candidate: NormalizedCandidate) => void;
  onSelectOthers: (candidate: NormalizedCandidate, index: number) => void;
  onConfirmTrash: (options?: ConfirmTrashOptions) => void;
}) {
  const reviewItems = useMemo(
    () => reviewCandidates.flatMap((item, candidateIndex) => item.assets.map((asset, assetIndex) => ({ asset, assetIndex, candidate: item, candidateIndex }))),
    [reviewCandidates],
  );
  const fallbackAsset = candidate.assets[index] || candidate.assets[0];
  const currentGlobalIndex = Math.max(0, reviewItems.findIndex((item) => item.candidate.id === candidate.id && item.asset.id === fallbackAsset?.id));
  const currentItem = reviewItems[currentGlobalIndex] || { asset: fallbackAsset, assetIndex: index, candidate, candidateIndex: 0 };
  const activeCandidate = currentItem.candidate;
  const asset = currentItem.asset;
  const activeIndex = currentItem.assetIndex;
  const candidateTitle = activeCandidate.title || categoryLabel(activeCandidate.category);
  const reasonText = activeCandidate.reasons.length > 0 ? activeCandidate.reasons.join(', ') : activeCandidate.description || copy.detail.manualReview;
  const selectedInCandidate = activeCandidate.assets.filter((item) => selectedAssetIds.has(item.id)).length;
  const totalBytes = activeCandidate.assets.reduce((sum, item) => sum + Number(item.fileSize || item.size || 0), 0);
  const detailDialogRef = useRef<HTMLDivElement | null>(null);
  const swipeStartX = useRef<number | null>(null);
  const selectCurrentItem = () => onSelectCurrent(activeCandidate, activeIndex);
  const toggleCurrentItem = () => onToggleAsset(asset.id, !selectedAssetIds.has(asset.id));
  const selectGroupItems = () => onSelectGroup(activeCandidate);
  const selectOtherGroupItems = () => onSelectOthers(activeCandidate, activeIndex);
  const cleanupCurrentOrSelection = (mode: TrashMode) => {
    const targetAssetIds = selectedAssetIds.size > 0 ? Array.from(selectedAssetIds) : [asset.id];
    onConfirmTrash({ mode, assetIds: targetAssetIds });
  };
  const openReviewItem = (nextIndex: number) => {
    const next = reviewItems[Math.min(Math.max(nextIndex, 0), reviewItems.length - 1)];
    if (next) onOpenCandidateAsset(next.candidate, next.assetIndex);
  };
  const openGroupItem = (itemIndex: number) => {
    if (activeCandidate.id === candidate.id) {
      onIndexChange(itemIndex);
      return;
    }
    onOpenCandidateAsset(activeCandidate, itemIndex);
  };
  const handleSwipeEnd = (clientX: number) => {
    if (swipeStartX.current == null) return;
    const delta = clientX - swipeStartX.current;
    swipeStartX.current = null;
    if (Math.abs(delta) < 42) return;
    openReviewItem(currentGlobalIndex + (delta < 0 ? 1 : -1));
  };

  const hotkeysRef = useHotkeys<HTMLDivElement>(
    'left,right,arrowleft,arrowright,space,ctrl+space,meta+space,delete,ctrl+delete,meta+delete,backspace,ctrl+backspace,meta+backspace',
    (event) => {
      if (isTextEntryKeyTarget(event.target)) return;
      event.preventDefault();
      if (event.key === 'ArrowLeft') {
        openReviewItem(currentGlobalIndex - 1);
        return;
      }
      if (event.key === 'ArrowRight') {
        openReviewItem(currentGlobalIndex + 1);
        return;
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        cleanupCurrentOrSelection(event.ctrlKey || event.metaKey ? 'delete' : 'trash');
        return;
      }
      if (event.ctrlKey || event.metaKey) selectGroupItems();
      else toggleCurrentItem();
    },
    {
      enableOnFormTags: true,
      enableOnContentEditable: false,
      keydown: true,
      preventDefault: true,
    },
    [currentGlobalIndex, reviewItems, selectedAssetIds, asset, toggleCurrentItem, selectGroupItems, cleanupCurrentOrSelection],
  );

  const setDetailHotkeysRef = useCallback((node: HTMLDivElement | null) => {
    detailDialogRef.current = node;
    hotkeysRef(node);
  }, [hotkeysRef]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      detailDialogRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <div ref={setDetailHotkeysRef} className="detail-overlay" role="dialog" aria-modal="true" aria-labelledby="candidate-detail-title" tabIndex={-1}>
      <article className="detail-dialog">
        <section className="detail-preview">
          <div className="detail-preview-stage" onPointerDown={(event) => { swipeStartX.current = event.clientX; }} onPointerUp={(event) => handleSwipeEnd(event.clientX)}>
            <DetailMedia asset={asset} bridge={bridge} />
          </div>
          <div className="detail-preview-actions">
            <IconButton size="large" onClick={() => openReviewItem(currentGlobalIndex - 1)} disabled={currentGlobalIndex <= 0} type="button"><ChevronLeft /></IconButton>
            <IconButton size="large" onClick={() => openReviewItem(currentGlobalIndex + 1)} disabled={currentGlobalIndex >= reviewItems.length - 1} type="button"><ChevronRight /></IconButton>
          </div>
          <div className="detail-review-strip" aria-label={copy.detail.pendingStrip}>
            {reviewItems.map((item, itemIndex) => (
              <button
                className={cn('review-strip-tile', itemIndex === currentGlobalIndex && 'active', selectedAssetIds.has(item.asset.id) && 'selected')}
                key={`${item.candidate.id}-${item.asset.id}`}
                type="button"
                onClick={() => onOpenCandidateAsset(item.candidate, item.assetIndex)}
                aria-label={`${item.candidate.title || categoryLabel(item.candidate.category)} ${formatNumber(item.assetIndex + 1)}`}
              >
                <MediaTile asset={item.asset} bridge={bridge} />
                <span>{formatNumber(item.candidateIndex + 1)}.{formatNumber(item.assetIndex + 1)}</span>
              </button>
            ))}
          </div>
        </section>
        <section className="detail-content">
          <div className="detail-header">
            <div className="min-w-0">
              <Badge tone={CATEGORY_COPY[activeCandidate.category]?.tone as 'amber' | 'blue' | 'green' | undefined}>{categoryLabel(activeCandidate.category)}</Badge>
              <h2 id="candidate-detail-title">{candidateTitle}</h2>
              <p className="path">{copy.detail.groupPosition(formatNumber(currentItem.candidateIndex + 1), formatNumber(reviewCandidates.length))} · {copy.review.assetCount(formatNumber(activeCandidate.assets.length))} · {reasonText}</p>
            </div>
            <IconButton size="large" onClick={onClose} type="button" aria-label={copy.review.detailClose}><X /></IconButton>
          </div>
          <div className="detail-actions">
            <Button size="compact" onClick={selectCurrentItem} type="button">{copy.common.selectCurrent}</Button>
            <Button size="compact" onClick={selectGroupItems} type="button">{copy.detail.selectGroup}</Button>
            <Button size="compact" onClick={selectOtherGroupItems} type="button">{copy.common.selectOthers}</Button>
            <Button variant="danger" size="compact" onClick={() => onConfirmTrash()} disabled={selectedAssetIds.size === 0 || busy === 'trash' || busy === 'delete'} type="button">
              <Trash2 /> {copy.common.trashConfirm}
            </Button>
          </div>
          <ShortcutHelp copy={copy} />
          <div className="detail-facts">
            <DetailFact label={copy.detail.media} value={copy.review.assetCount(formatNumber(activeCandidate.assets.length))} />
            <DetailFact label={copy.detail.selectedInGroup} value={formatNumber(selectedInCandidate)} />
            <DetailFact label={copy.detail.score} value={activeCandidate.score != null ? String(Math.round(Number(activeCandidate.score))) : '--'} />
            <DetailFact label={copy.detail.size} value={formatBytes(totalBytes)} />
            <DetailFact label={copy.detail.currentPreview} value={`${formatNumber(currentGlobalIndex + 1)} / ${formatNumber(reviewItems.length)}`} />
            <DetailFact label={copy.detail.reasons} value={reasonText} />
          </div>
          <h3>{copy.review.galleryTitle}</h3>
          <div className="detail-gallery">
            {activeCandidate.assets.map((item, itemIndex) => (
              <button
                className={cn('gallery-tile', itemIndex === activeIndex && 'active')}
                key={item.id}
                type="button"
                onClick={(event) => {
                  if (event.shiftKey) onToggleRange(item.id);
                  else if (event.metaKey || event.ctrlKey) onToggleAsset(item.id, !selectedAssetIds.has(item.id));
                  else openGroupItem(itemIndex);
                }}
              >
                <MediaTile asset={item} bridge={bridge} />
                <input
                  type="checkbox"
                  aria-label={`${fileName(item.uri || item.id)} ${copy.common.selectCurrent}`}
                  checked={selectedAssetIds.has(item.id)}
                  readOnly
                  onClick={(event) => {
                    event.stopPropagation();
                    if (event.shiftKey) onToggleRange(item.id);
                    else onToggleAsset(item.id, !selectedAssetIds.has(item.id));
                  }}
                />
              </button>
            ))}
          </div>
        </section>
      </article>
    </div>
  );
}

function AlertConfirmDialog({
  open,
  title,
  description,
  cancelLabel,
  confirmLabel,
  busy,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  cancelLabel: string;
  confirmLabel: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    const frame = window.requestAnimationFrame(() => {
      cancelRef.current?.focus({ preventScroll: true });
    });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      onCancel();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onCancel, open]);

  if (!open) return null;

  return (
    <div
      className="alert-dialog-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <section className="alert-dialog-content" role="alertdialog" aria-modal="true" aria-labelledby="permanent-delete-title" aria-describedby="permanent-delete-description">
        <div className="alert-dialog-icon" aria-hidden="true">
          <Trash2 />
        </div>
        <div className="alert-dialog-copy">
          <h2 id="permanent-delete-title">{title}</h2>
          <p id="permanent-delete-description">{description}</p>
        </div>
        <div className="alert-dialog-actions">
          <Button type="button" ref={cancelRef} onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button variant="danger" type="button" onClick={onConfirm} disabled={busy}>
            <Trash2 /> {confirmLabel}
          </Button>
        </div>
      </section>
    </div>
  );
}

function ShortcutHelp({ copy }: { copy: DesktopCopy }) {
  return (
    <section className="detail-shortcuts" aria-label={copy.detail.shortcutTitle}>
      <h3>{copy.detail.shortcutTitle}</h3>
      <div className="shortcut-grid">
        {copy.detail.shortcuts.map((shortcut) => (
          <div className="shortcut-row" key={`${shortcut.keys.join('+')}-${shortcut.label}`}>
            <span className="shortcut-keys">
              {shortcut.keys.map((key) => <kbd key={key}>{key}</kbd>)}
            </span>
            <span>{shortcut.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function CandidateCard({ candidate, selectedAssetIds, bridge, copy, onToggle, onOpenDetail }: {
  candidate: NormalizedCandidate;
  selectedAssetIds: Set<string>;
  bridge: DesktopBridge | null;
  copy: DesktopCopy;
  onToggle: (candidate: NormalizedCandidate, range: boolean) => void;
  onOpenDetail: (candidate: NormalizedCandidate, index: number) => void;
}) {
  const categoryCopy = CATEGORY_COPY[candidate.category] || { label: candidate.category, tone: 'blue' };
  const allSelected = candidate.assets.length > 0 && candidate.assets.every((asset) => selectedAssetIds.has(asset.id));
  const partiallySelected = candidate.assets.some((asset) => selectedAssetIds.has(asset.id));
  const candidateTitle = candidate.title || fileName(candidate.assets[0]?.uri || candidate.id);
  return (
    <article
      className={cn('candidate-card', partiallySelected && 'selected')}
      tabIndex={0}
      aria-label={`${candidateTitle}，${copy.common.details}`}
      onClick={(event) => {
        if (event.shiftKey || event.metaKey || event.ctrlKey) {
          event.preventDefault();
          onToggle(candidate, event.shiftKey);
          return;
        }
        onOpenDetail(candidate, 0);
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onOpenDetail(candidate, 0);
      }}
    >
      <div className="candidate-preview">
        {candidate.assets.slice(0, Math.max(1, Math.min(4, candidate.assets.length))).map((asset, index) => (
          <MediaTile key={`${candidate.id}-${asset.id}-${index}`} asset={asset} bridge={bridge} />
        ))}
      </div>
      <div className="candidate-body">
        <div className="candidate-title-row">
          <Badge tone={categoryCopy.tone as 'amber' | 'blue' | 'green' | undefined}>{categoryLabel(candidate.category)}</Badge>
          {candidate.score != null ? <Badge>score {Math.round(Number(candidate.score))}</Badge> : null}
          <input
            type="checkbox"
            aria-label={`${candidateTitle} ${copy.common.selectCurrent}`}
            checked={allSelected}
            readOnly
            onClick={(event) => {
              event.stopPropagation();
              onToggle(candidate, event.shiftKey);
            }}
          />
        </div>
        <h3>{candidateTitle}</h3>
        <p className="subtext">{copy.review.assetCount(formatNumber(candidate.assets.length))} · {(candidate.reasons || []).join(', ') || candidate.description}</p>
        <div className="candidate-footer">
          <span className="subtext">{candidate.reasons?.[0] || candidate.category}</span>
          <Button size="compact" type="button" onClick={(event) => {
            event.stopPropagation();
            onOpenDetail(candidate, 0);
          }}>{copy.common.details}</Button>
        </div>
      </div>
    </article>
  );
}

function MediaTile({ asset, bridge }: { asset?: NormalizedAsset; bridge: DesktopBridge | null }) {
  const copy = getDesktopCopy(getDesktopLocale());
  if (!asset) return <div className="media-tile">{copy.review.emptyTile}</div>;
  const src = asset.mediaType === 'video' ? bridge?.posterUrl?.(asset.id) : bridge?.mediaUrl?.(asset.id);
  return (
    <div className="media-tile">
      {src ? <img src={src} alt={fileName(asset.uri || asset.id)} loading="lazy" /> : <span>{copy.review.noPreview}</span>}
      {asset.mediaType === 'video' ? <span className="video-label">VIDEO</span> : null}
    </div>
  );
}

function DetailMedia({ asset, bridge }: { asset: NormalizedAsset; bridge: DesktopBridge | null }) {
  const copy = getDesktopCopy(getDesktopLocale());
  const src = asset.mediaType === 'video' ? bridge?.mediaUrl?.(asset.id) : bridge?.mediaUrl?.(asset.id);
  return (
    <div className="detail-media">
      {!src ? <span>{copy.review.noPreview}</span> : asset.mediaType === 'video' ? <video src={src} controls /> : <img src={src} alt={fileName(asset.uri || asset.id)} />}
    </div>
  );
}

function JobTableRow({
  job,
  bridge,
  busy,
  copy,
  onCancelJob,
  onOpenReport,
}: {
  bridge: DesktopBridge | null;
  busy: string | null;
  copy: DesktopCopy;
  job: ScanJob;
  onCancelJob: (job: ScanJob) => void;
  onOpenReport: (input: ReportInput) => void;
}) {
  const percent = jobPercent(job);
  const root = job.root || job.path || job.directory || '';
  const status = String(job.status || 'queued');
  const jobId = job.jobId || job.id || '';
  const canOpenReport = status === 'completed' && Boolean(job.sessionId || job.session || job.sessionPath);
  return (
    <tr className={cn(status === 'failed' && 'attention')}>
      <td className="job-name-cell">
        <strong>{fileName(root || job.sessionId || job.jobId || copy.review.fallbackDirectory)}</strong>
        <span>{root || copy.review.noDirectory}</span>
        {job.error ? <small className="error">{job.error}</small> : null}
      </td>
      <td>
        <Badge tone={status === 'completed' ? 'green' : isRunning(status) ? 'blue' : status === 'failed' ? 'amber' : undefined}>{scanStatusLabel(status)}</Badge>
        <span className="table-subtext">{scanPhaseLabel(job.phase || status)}</span>
      </td>
      <td className="job-progress-cell">
        <div className="job-table-progress" style={{ '--job-table-progress': percent } as CSSProperties} aria-label={copy.tray.progressAria(formatNumber(percent))}>
          <span />
        </div>
        <span>{progressText(job)}</span>
      </td>
      <td>
        <strong className="table-data-text">{jobDataSummary(job)}</strong>
      </td>
      <td>
        <div className="jobs-table-actions">
          <Button size="compact" type="button" disabled={!isRunning(status) || !bridge?.scanCancel || !jobId || busy === `cancel:${jobId}`} onClick={() => onCancelJob(job)}>
            <Pause /> {copy.common.pause}
          </Button>
          <Button size="compact" type="button" disabled={!canOpenReport} onClick={() => onOpenReport({ sessionId: job.sessionId || null, sessionPath: job.session || job.sessionPath || null, cleanupPlanPath: job.cleanupPlan || job.cleanupPlanPath || null })}>
            <ListChecks /> {copy.common.review}
          </Button>
        </div>
      </td>
    </tr>
  );
}

function SessionCard({ session, bridge, copy, onOpenReport, onDelete }: { session: SessionRecord; bridge: DesktopBridge | null; copy: DesktopCopy; onOpenReport: (input: ReportInput) => void; onDelete: (session: SessionRecord) => void }) {
  const sessionId = session.sessionId || session.id || copy.review.unnamedSession;
  const root = session.root || session.sourceRoot || session.path || '';
  return (
    <article className="session-card">
      <div className="session-topline">
        <div className="min-w-0">
          <div className="candidate-title-row">
            <Badge tone="blue">{session.source || session.platform || 'desktop'}</Badge>
            {session.cleanupHistory?.assetCount ? <Badge tone="amber">{copy.review.cleanedBadge(formatNumber(session.cleanupHistory.assetCount))}</Badge> : null}
          </div>
          <h3>{sessionId}</h3>
          <p className="path">{root || copy.review.noRoot}</p>
          <p className="subtext">{[formatDate(session.generatedAt || session.createdAt), copy.review.sessionMeta(formatNumber(session.assetCount), formatNumber(session.clusterCount))].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="panel-actions session-actions">
          <Button variant="primary" size="compact" type="button" onClick={() => onOpenReport({ sessionId, sessionPath: session.sessionPath || session.path || null, cleanupPlanPath: session.cleanupPlanPath || session.planPath || null })}>{copy.common.open}</Button>
          <Button size="compact" type="button" disabled={!bridge?.sessionsDelete} onClick={() => onDelete(session)}>{copy.common.delete}</Button>
        </div>
      </div>
    </article>
  );
}

function FlowStrip({ activeView, directories, jobs, candidates, selectedCount, cleanedCount, copy }: { activeView: View; directories: string[]; jobs: ScanJob[]; candidates: NormalizedCandidate[]; selectedCount: number; cleanedCount: number; copy: DesktopCopy }) {
  const activeJobs = jobs.filter((job) => isRunning(job.status));
  const completedJobs = jobs.filter((job) => job.status === 'completed');
  const activeStep = activeView === 'tasks'
    ? 2
    : activeView === 'review'
      ? cleanedCount > 0
        ? 5
        : selectedCount > 0
          ? 4
          : 3
      : 1;
  const stepState = (step: number) => (step < activeStep ? 'done reached' : step === activeStep ? 'active reached' : 'pending');
  const steps = [
    ['1', copy.flow.scan, directories.length > 0 ? copy.flow.directoriesAdded(formatNumber(directories.length)) : copy.flow.chooseLocalDirectories, stepState(1)],
    ['2', copy.flow.recognition, activeJobs.length > 0 ? copy.flow.recognizingTasks(formatNumber(activeJobs.length)) : completedJobs.length > 0 ? copy.flow.generatedCandidates : copy.flow.waitingResults, stepState(2)],
    ['3', copy.flow.review, candidates.length > 0 ? copy.flow.candidateGroups(formatNumber(candidates.length)) : copy.flow.reviewByType, stepState(3)],
    ['4', copy.flow.filter, selectedCount > 0 ? copy.flow.selectedFiles(formatNumber(selectedCount)) : copy.flow.filterDesc, stepState(4)],
    ['5', copy.flow.cleanup, cleanedCount > 0 ? copy.flow.cleanedHistory(formatNumber(cleanedCount)) : copy.flow.cleanupDesc, stepState(5)],
  ];
  return (
    <section className="flow-strip">
      {steps.map(([index, title, body, state]) => (
        <article className={cn('flow-step', state)} key={index} aria-current={state.includes('active') ? 'step' : undefined}>
          <span>{index}</span>
          <strong>{title}</strong>
          <p>{body}</p>
        </article>
      ))}
    </section>
  );
}

function DesktopSkeleton({ view }: { view: View }) {
  return (
    <section className={cn('desktop-skeleton', view === 'review' && 'review')}>
      <div className="skeleton-hero" />
      <div className="skeleton-grid">
        {Array.from({ length: view === 'review' ? 8 : 4 }, (_, index) => <Skeleton key={index} />)}
      </div>
    </section>
  );
}

function NavButton({ active, icon, title, desc, onClick }: { active: boolean; icon: ReactNode; title: string; desc: string; onClick: () => void }) {
  return (
    <button className={cn('task-nav-item', active && 'active')} type="button" aria-label={`${title}：${desc}`} title={title} onClick={onClick}>
      <span className="nav-icon" aria-hidden="true">{icon}</span>
      <span className="nav-copy"><strong>{title}</strong><small>{desc}</small></span>
    </button>
  );
}

function SecondaryNavButton({ active, icon, title, onClick }: { active: boolean; icon: ReactNode; title: string; onClick: () => void }) {
  return (
    <button className={cn(active && 'active')} type="button" aria-label={title} title={title} onClick={onClick}>
      <span className="nav-icon" aria-hidden="true">{icon}</span>
      <strong className="nav-copy">{title}</strong>
    </button>
  );
}

function PanelHeader({ kicker, title, desc, children }: { kicker: string; title: string; desc: string; children?: ReactNode }) {
  return (
    <div className="panel-header">
      <div>
        <p className="section-kicker">{kicker}</p>
        <h2>{title}</h2>
        <p className="muted">{desc}</p>
      </div>
      {children ? <div className="panel-actions">{children}</div> : null}
    </div>
  );
}

function SummaryCard({ label, value, caption }: { label: string; value: number; caption: string }) {
  return (
    <div className="summary-card">
      <span>{label}</span>
      <strong>{formatNumber(value)}</strong>
      <p>{caption}</p>
    </div>
  );
}

function StatusRow({
  icon,
  label,
  value,
  tone,
  detail,
}: {
  detail: string;
  icon: ReactNode;
  label: string;
  tone?: 'amber' | 'blue' | 'green';
  value: string;
}) {
  return (
    <article className="status-row">
      <div className="status-icon">{icon}</div>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <p>{detail}</p>
      </div>
      <Badge tone={tone}>{value}</Badge>
    </article>
  );
}

function DetailFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-fact">
      <span>{label}</span>
      <strong>{value || '--'}</strong>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="empty-state">{text}</div>;
}

function DevPreviewDock({ copy }: { copy: DesktopCopy }) {
  const entries: Array<[string, string]> = [
    [copy.nav.scan.title, '?preview=1&view=scan'],
    [copy.nav.tasks.title, '?preview=1&view=tasks'],
    [copy.nav.review.title, '?preview=1&view=review'],
    [copy.common.about, '?preview=1&view=about'],
    ['Island', '?preview=1&surface=tray'],
  ];
  return (
    <nav className="dev-preview-dock" aria-label={copy.app.previewDock}>
      <strong>Codex Preview</strong>
      {entries.map(([label, href]) => (
        <a href={href} key={href}>{label}</a>
      ))}
    </nav>
  );
}

function addVisibleAssets(current: Set<string>, candidates: NormalizedCandidate[]) {
  const next = new Set(current);
  for (const candidate of candidates) for (const asset of candidate.assets) next.add(asset.id);
  return next;
}

function uniqueAssetIds(assetIds: string[]) {
  return Array.from(new Set(assetIds.filter(Boolean)));
}

function clearVisibleAssets(current: Set<string>, candidates: NormalizedCandidate[]) {
  const next = new Set(current);
  for (const candidate of candidates) for (const asset of candidate.assets) next.delete(asset.id);
  return next;
}

function candidateRange(candidates: NormalizedCandidate[], anchorId: string, targetId: string) {
  const anchorIndex = candidates.findIndex((candidate) => candidate.id === anchorId);
  const targetIndex = candidates.findIndex((candidate) => candidate.id === targetId);
  if (anchorIndex < 0 || targetIndex < 0) return candidates.filter((candidate) => candidate.id === targetId);
  return candidates.slice(Math.min(anchorIndex, targetIndex), Math.max(anchorIndex, targetIndex) + 1);
}

function getRendererSurface() {
  try {
    return new URL(window.location.href).searchParams.get('surface');
  } catch {
    return null;
  }
}

function readInitialView(): View {
  return normalizeView(readViewFromLocation()) || consumePendingView() || 'scan';
}

function readViewFromLocation() {
  try {
    return new URL(window.location.href).searchParams.get('view');
  } catch {
    return null;
  }
}

function setPendingView(view: View) {
  try {
    window.localStorage.setItem(PENDING_VIEW_KEY, view);
  } catch {
    // Ignore storage failures in restricted Electron contexts.
  }
}

function consumePendingView() {
  try {
    const next = normalizeView(window.localStorage.getItem(PENDING_VIEW_KEY));
    if (next) window.localStorage.removeItem(PENDING_VIEW_KEY);
    return next;
  } catch {
    return null;
  }
}

function normalizeView(value: unknown): View | null {
  const next = String(value || '');
  if (next === 'status' || next === 'diagnostics') return 'about';
  return ['scan', 'tasks', 'review', 'about'].includes(next) ? (next as View) : null;
}

function scanStatusLabel(status?: string) {
  const copy = getDesktopCopy(getDesktopLocale());
  const normalized = String(status || '').toLowerCase();
  if (['queued', 'pending'].includes(normalized)) return copy.status.queued;
  if (['scanning', 'analyzing', 'planning', 'running'].includes(normalized)) return copy.status.running;
  if (normalized === 'completed') return copy.status.completed;
  if (normalized === 'failed') return copy.status.failed;
  if (normalized === 'cancelled' || normalized === 'canceled') return copy.status.cancelled;
  return copy.status.idle;
}

function trayTaskTone(status?: string) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'completed') return 'complete';
  if (normalized === 'failed') return 'attention';
  if (['scanning', 'analyzing', 'planning', 'running'].includes(normalized)) return 'running';
  return 'idle';
}

function isQueued(status?: string) {
  const normalized = String(status || '').toLowerCase();
  return normalized === 'queued' || normalized === 'pending';
}

function scanPhaseLabel(phase?: string) {
  const copy = getDesktopCopy(getDesktopLocale());
  const normalized = String(phase || '').toLowerCase();
  if (['queued', 'pending'].includes(normalized)) return copy.status.phaseQueued;
  if (['scanning', 'walk', 'walking'].includes(normalized)) return copy.status.phaseReading;
  if (['analyzing', 'analysis'].includes(normalized)) return copy.status.phaseAnalyzing;
  if (['planning', 'plan'].includes(normalized)) return copy.status.phasePlanning;
  if (normalized === 'completed') return copy.status.completed;
  if (normalized === 'failed') return copy.status.phaseFailed;
  if (normalized === 'cancelled' || normalized === 'canceled') return copy.status.cancelled;
  return copy.status.phasePreparing;
}

function trayJobTitle(job: ScanJob) {
  const fallback = getDesktopCopy(getDesktopLocale()).review.fallbackDirectory;
  return fileName(job.root || job.path || job.directory || job.sessionId || job.jobId || fallback) || fallback;
}

function reportInputFromJob(job: ScanJob): ReportInput | null {
  const sessionId = job.sessionId || job.id || null;
  const sessionPath = job.sessionPath || job.session || null;
  const cleanupPlanPath = job.cleanupPlanPath || job.cleanupPlan || null;
  if (!sessionId && !sessionPath && !cleanupPlanPath) return null;
  return { sessionId, sessionPath, cleanupPlanPath };
}

function trayJobMetric(job: ScanJob) {
  const copy = getDesktopCopy(getDesktopLocale());
  const status = String(job.status || '').toLowerCase();
  const percent = jobPercent(job);
  const total = Number(job.progress?.total ?? job.total ?? 0);
  const processed = Number(job.progress?.processed ?? job.processed ?? 0);
  const assets = Number(job.assetCount || 0);
  const candidates = Number(job.cleanupPlanCount || job.clusterCount || 0);

  if (status === 'completed') {
    return candidates > 0
      ? copy.status.completedMetricCandidates(formatNumber(candidates))
      : copy.status.completedMetricAssets(formatNumber(assets));
  }
  if (total > 0) return copy.status.mediaMetric(formatNumber(percent), formatNumber(total));
  if (processed > 0) return copy.status.processedMetric(formatNumber(percent), formatNumber(processed));
  if (assets > 0) return copy.status.mediaMetric(formatNumber(percent), formatNumber(assets));
  if (status === 'failed') return copy.status.permissionMetric;
  return copy.status.preparingMetric(formatNumber(percent));
}

function jobDataSummary(job: ScanJob) {
  const copy = getDesktopCopy(getDesktopLocale());
  const assets = Number(job.assetCount || 0);
  const candidates = Number(job.cleanupPlanCount || job.clusterCount || 0);
  const total = Number(job.progress?.total ?? job.total ?? 0);
  const processed = Number(job.progress?.processed ?? job.processed ?? 0);
  if (candidates > 0) return copy.status.candidates(formatNumber(candidates));
  if (assets > 0) return copy.status.mediaItems(formatNumber(assets));
  if (total > 0) return `${formatNumber(processed)} / ${formatNumber(total)}`;
  if (processed > 0) return copy.status.processedItems(formatNumber(processed));
  return copy.status.waitingData;
}

function isEditableKeyTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return target.isContentEditable || tag === 'input' || tag === 'textarea' || tag === 'select';
}

function isTextEntryKeyTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName.toLowerCase();
  if (tag === 'textarea' || tag === 'select') return true;
  if (tag !== 'input') return false;
  const type = (target.getAttribute('type') || 'text').toLowerCase();
  return !['button', 'checkbox', 'radio', 'reset', 'submit'].includes(type);
}

function getBridge() {
  return window.mediaCleanDesktop || window.mediaClean || null;
}
