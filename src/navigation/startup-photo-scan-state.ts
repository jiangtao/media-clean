import { loadActiveAndroidNativeScanSnapshot } from '../features/scan/android-native-scan';
import { DEFAULT_SCAN_LIMIT } from '../features/scan/scan-config';
import { stageStartupPhotoScanSessionRuntimeSnapshot } from '../features/scan/photo-scan-session-runtime';
import { getMediaLibraryPermissionsAsync } from '../services/media-library-permissions';
import {
  clearPhotoScanSessionSnapshot,
  loadLatestCompletedPhotoScanBatch,
  loadLatestPhotoScanBatch,
  loadPhotoScanResultCache,
  type PhotoScanBatchRecord,
  type PhotoScanResultCache,
  loadPhotoScanSessionSnapshot,
  type PhotoScanSessionSnapshot,
} from '../services/storage/app-storage';
import { loadPhotoScanJobCheckpoint } from '../services/storage/scan-job-storage';

function buildScopeSelectionFromCandidates(candidates: PhotoScanSessionSnapshot['authorizedCandidates']) {
  return candidates.reduce(
    (summary, candidate) => {
      summary.total += 1;

      if (candidate.asset.mediaType === 'photo') {
        summary.photo += 1;
      }

      if (candidate.asset.mediaType === 'video') {
        summary.video += 1;
      }

      return summary;
    },
    { total: 0, photo: 0, video: 0 },
  );
}

function matchesSnapshotScopeSelection(snapshot: PhotoScanSessionSnapshot) {
  const expected = buildScopeSelectionFromCandidates(snapshot.authorizedCandidates);

  return (
    snapshot.scanScopeSelection.total === expected.total &&
    snapshot.scanScopeSelection.photo === expected.photo &&
    snapshot.scanScopeSelection.video === expected.video
  );
}

function isUsableCompletedStartupPhotoScanSnapshot(snapshot: PhotoScanSessionSnapshot) {
  return (
    snapshot.permissionState === 'granted' &&
    snapshot.phase === 'completed' &&
    snapshot.scanProgress.current === snapshot.scanProgress.total &&
    snapshot.summary.scannedCount === snapshot.scanProgress.total &&
    snapshot.scanProgress.total >= snapshot.visibleCandidates.length &&
    snapshot.scanResultsCount === snapshot.visibleCandidates.length
  );
}

export function isRestorableStartupPhotoScanSnapshot(snapshot: PhotoScanSessionSnapshot) {
  if (!isUsableCompletedStartupPhotoScanSnapshot(snapshot) || !matchesSnapshotScopeSelection(snapshot)) {
    return false;
  }

  return snapshot.scanProgress.total === snapshot.authorizedCandidates.length;
}

function isRestorableStartupErrorSnapshot(snapshot: PhotoScanSessionSnapshot) {
  if (snapshot.phase === 'error') {
    return (
      snapshot.errorMessage !== null &&
      snapshot.errorMessage.trim().length > 0 &&
      snapshot.scanResultsCount === snapshot.visibleCandidates.length
    );
  }

  return false;
}

function buildCompletedStartupSnapshot(options: {
  persistedSession: PhotoScanSessionSnapshot | null;
  cachedResult: PhotoScanResultCache | null;
  latestCompletedBatch: PhotoScanBatchRecord | null;
}) {
  const now = Date.now();
  const visibleCandidates =
    options.cachedResult?.activeCandidates ??
    options.persistedSession?.visibleCandidates ??
    [];
  const authorizedCandidates =
    options.persistedSession?.authorizedCandidates.length
      ? options.persistedSession.authorizedCandidates
      : visibleCandidates;
  const scannedCount = Math.max(
    options.persistedSession?.scanProgress.total ?? 0,
    options.persistedSession?.summary.scannedCount ?? 0,
    options.cachedResult?.summary.scannedCount ?? 0,
    options.latestCompletedBatch?.progressTotal ?? 0,
    authorizedCandidates.length,
    visibleCandidates.length,
  );
  const scopedSelection =
    options.persistedSession && matchesSnapshotScopeSelection(options.persistedSession)
      ? options.persistedSession.scanScopeSelection
      : buildScopeSelectionFromCandidates(authorizedCandidates);

  return {
    permissionState: 'granted',
    phase: 'completed',
    authorizedCandidates,
    visibleCandidates,
    scanResultsCount: visibleCandidates.length,
    scanProgress: {
      current: scannedCount,
      total: scannedCount,
      currentFileName: null,
    },
    scanScopeSelection: scopedSelection,
    scanBatchRange:
      options.persistedSession?.scanBatchRange ??
      (options.latestCompletedBatch
        ? {
            startAt: options.latestCompletedBatch.rangeStartAt,
            endAt: options.latestCompletedBatch.rangeEndAt,
          }
        : null),
    summary: {
      scannedAt:
        options.latestCompletedBatch?.completedAt ??
        options.persistedSession?.summary.scannedAt ??
        options.cachedResult?.summary.scannedAt ??
        now,
      scannedCount,
      recycleBinCount:
        options.persistedSession?.summary.recycleBinCount ??
        options.cachedResult?.summary.recycleBinCount ??
        0,
    },
    hasCompletedFullScan:
      options.persistedSession?.hasCompletedFullScan ??
      (options.latestCompletedBatch?.phase === 'completed' &&
        options.latestCompletedBatch.mode === 'full'),
    errorMessage: null,
    updatedAt: now,
  } satisfies PhotoScanSessionSnapshot;
}

function isResumableBatchPhase(phase: string) {
  return (
    phase === 'queued' ||
    phase === 'enumeration' ||
    phase === 'analysis' ||
    phase === 'aggregation'
  );
}

function buildPermissionResolvedSnapshot(permissionState: 'granted' | 'denied') {
  const now = Date.now();

  return {
    permissionState,
    phase: 'idle',
    authorizedCandidates: [],
    visibleCandidates: [],
    scanResultsCount: 0,
    scanProgress: {
      current: 0,
      total: DEFAULT_SCAN_LIMIT,
      currentFileName: null,
    },
    scanScopeSelection: {
      total: DEFAULT_SCAN_LIMIT,
      photo: 0,
      video: 0,
    },
    scanBatchRange: null,
    summary: {
      scannedAt: 0,
      scannedCount: 0,
      recycleBinCount: 0,
    },
    hasCompletedFullScan: false,
    errorMessage: null,
    updatedAt: now,
  } satisfies PhotoScanSessionSnapshot;
}

function buildScanningStartupSnapshot(options: {
  persistedSession: PhotoScanSessionSnapshot | null;
  current: number;
  total: number;
  currentFileName: string | null;
  rangeStartAt?: number | null;
  rangeEndAt?: number | null;
}) {
  const persistedSession = options.persistedSession;
  const now = Date.now();
  const authorizedCandidates = persistedSession?.authorizedCandidates ?? [];
  const visibleCandidates = persistedSession?.visibleCandidates ?? [];
  const scopeSelection = persistedSession
    ? persistedSession.scanScopeSelection
    : {
        total: Math.max(options.total, DEFAULT_SCAN_LIMIT),
        photo: 0,
        video: 0,
      };

  return {
    permissionState: 'granted',
    phase: 'scanning',
    authorizedCandidates,
    visibleCandidates,
    scanResultsCount: visibleCandidates.length,
    scanProgress: {
      current: Math.max(0, options.current),
      total: Math.max(0, options.total),
      currentFileName: options.currentFileName,
    },
    scanScopeSelection: scopeSelection,
    scanBatchRange:
      options.rangeStartAt !== undefined || options.rangeEndAt !== undefined
        ? {
            startAt: options.rangeStartAt ?? null,
            endAt: options.rangeEndAt ?? null,
          }
        : persistedSession?.scanBatchRange ?? null,
    summary: persistedSession?.summary ?? {
      scannedAt: 0,
      scannedCount: 0,
      recycleBinCount: 0,
    },
    hasCompletedFullScan: false,
    errorMessage: null,
    updatedAt: now,
  } satisfies PhotoScanSessionSnapshot;
}

export async function hydrateStartupPhotoScanState() {
  const [
    persistedSession,
    pendingScanJob,
    nativeRuntimeSnapshot,
    latestScanBatch,
    latestCompletedBatch,
    cachedResult,
  ] =
    await Promise.all([
      loadPhotoScanSessionSnapshot(),
      loadPhotoScanJobCheckpoint().catch(() => null),
      loadActiveAndroidNativeScanSnapshot().catch(() => null),
      loadLatestPhotoScanBatch().catch(() => null),
      loadLatestCompletedPhotoScanBatch().catch(() => null),
      loadPhotoScanResultCache().catch(() => null),
    ]);

  if (nativeRuntimeSnapshot?.status.phase === 'running') {
    stageStartupPhotoScanSessionRuntimeSnapshot(
      buildScanningStartupSnapshot({
        persistedSession,
        current: nativeRuntimeSnapshot.status.current,
        total: nativeRuntimeSnapshot.status.total,
        currentFileName: nativeRuntimeSnapshot.status.currentFileName,
        rangeStartAt:
          latestScanBatch?.batchId === nativeRuntimeSnapshot.status.jobId
            ? latestScanBatch.rangeStartAt
            : undefined,
        rangeEndAt:
          latestScanBatch?.batchId === nativeRuntimeSnapshot.status.jobId
            ? latestScanBatch.rangeEndAt
            : undefined,
      }),
    );
    return;
  }

  if (pendingScanJob?.phase === 'running') {
    stageStartupPhotoScanSessionRuntimeSnapshot(
      buildScanningStartupSnapshot({
        persistedSession,
        current: pendingScanJob.progressCurrent,
        total: pendingScanJob.progressTotal,
        currentFileName: pendingScanJob.currentFileName,
        rangeStartAt:
          latestScanBatch?.batchId === pendingScanJob.jobId
            ? latestScanBatch.rangeStartAt
            : undefined,
        rangeEndAt:
          latestScanBatch?.batchId === pendingScanJob.jobId
            ? latestScanBatch.rangeEndAt
            : undefined,
      }),
    );
    return;
  }

  if (latestScanBatch && isResumableBatchPhase(latestScanBatch.phase)) {
    stageStartupPhotoScanSessionRuntimeSnapshot(
      buildScanningStartupSnapshot({
        persistedSession,
        current: latestScanBatch.progressCurrent,
        total: latestScanBatch.progressTotal,
        currentFileName: null,
        rangeStartAt: latestScanBatch.rangeStartAt,
        rangeEndAt: latestScanBatch.rangeEndAt,
      }),
    );
    return;
  }

  if (persistedSession && isRestorableStartupPhotoScanSnapshot(persistedSession)) {
    stageStartupPhotoScanSessionRuntimeSnapshot(persistedSession);
    return;
  }

  if (persistedSession && isRestorableStartupErrorSnapshot(persistedSession)) {
    stageStartupPhotoScanSessionRuntimeSnapshot(persistedSession);
    return;
  }

  if (
    (persistedSession && isUsableCompletedStartupPhotoScanSnapshot(persistedSession)) ||
    cachedResult
  ) {
    stageStartupPhotoScanSessionRuntimeSnapshot(
      buildCompletedStartupSnapshot({
        persistedSession,
        cachedResult,
        latestCompletedBatch,
      }),
    );
    return;
  }

  if (persistedSession && persistedSession.phase !== 'idle') {
    await clearPhotoScanSessionSnapshot().catch(() => undefined);
  }

  const permission = await getMediaLibraryPermissionsAsync().catch(() => null);
  stageStartupPhotoScanSessionRuntimeSnapshot(
    buildPermissionResolvedSnapshot(permission?.granted ? 'granted' : 'denied'),
  );
}
