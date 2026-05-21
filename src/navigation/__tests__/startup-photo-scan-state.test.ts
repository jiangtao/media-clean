import { beforeEach, describe, expect, it, vi } from 'vitest';

const storageApi = vi.hoisted(() => ({
  clearPhotoScanSessionSnapshot: vi.fn(),
  loadLatestCompletedPhotoScanBatch: vi.fn(),
  loadLatestPhotoScanBatch: vi.fn(),
  loadPhotoScanResultCache: vi.fn(),
  loadPhotoScanSessionSnapshot: vi.fn(),
}));

const scanJobStorageApi = vi.hoisted(() => ({
  loadPhotoScanJobCheckpoint: vi.fn(),
}));

const nativeScanApi = vi.hoisted(() => ({
  loadActiveAndroidNativeScanSnapshot: vi.fn(),
}));

const permissionsApi = vi.hoisted(() => ({
  getMediaLibraryPermissionsAsync: vi.fn(),
}));

const runtimeApi = vi.hoisted(() => ({
  stageStartupPhotoScanSessionRuntimeSnapshot: vi.fn(),
}));

vi.mock('../../services/storage/app-storage', () => storageApi);
vi.mock('../../services/storage/scan-job-storage', () => scanJobStorageApi);
vi.mock('../../features/scan/android-native-scan', () => nativeScanApi);
vi.mock('../../services/media-library-permissions', () => permissionsApi);
vi.mock('../../features/scan/photo-scan-session-runtime', () => runtimeApi);

import {
  hydrateStartupPhotoScanState,
  isRestorableStartupPhotoScanSnapshot,
} from '../startup-photo-scan-state';

function createCandidate(id: string, mediaType: 'photo' | 'video' = 'photo') {
  return {
    id,
    asset: {
      id,
      uri: `file:///${id}.jpg`,
      mediaType,
      width: 640,
      height: 640,
      duration: 0,
      fileSize: 80_000,
      creationTime: 1_710_000_000_000,
    },
    score: 90,
    confidence: 'high' as const,
    kind: 'abnormal-photo' as const,
    primaryIssueType: 'abnormal' as const,
    issueTypes: ['abnormal' as const],
    reasons: ['测试命中'],
  };
}

function createCompletedSnapshot(overrides = {}) {
  const authorizedCandidates = [createCandidate('photo-1'), createCandidate('video-1', 'video')];
  const visibleCandidates = [createCandidate('photo-1')];

  return {
    permissionState: 'granted' as const,
    phase: 'completed' as const,
    authorizedCandidates,
    visibleCandidates,
    scanResultsCount: visibleCandidates.length,
    scanProgress: {
      current: authorizedCandidates.length,
      total: authorizedCandidates.length,
      currentFileName: null,
    },
    scanScopeSelection: {
      total: authorizedCandidates.length,
      photo: 1,
      video: 1,
    },
    scanBatchRange: {
      startAt: 1_709_000_000_000,
      endAt: 1_710_000_000_000,
    },
    summary: {
      scannedAt: 1_710_000_000_000,
      scannedCount: authorizedCandidates.length,
      recycleBinCount: 0,
    },
    hasCompletedFullScan: false,
    errorMessage: null,
    updatedAt: 1_710_000_000_999,
    ...overrides,
  };
}

describe('startup-photo-scan-state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storageApi.loadPhotoScanSessionSnapshot.mockResolvedValue(null);
    storageApi.loadLatestPhotoScanBatch.mockResolvedValue(null);
    storageApi.loadLatestCompletedPhotoScanBatch.mockResolvedValue(null);
    storageApi.loadPhotoScanResultCache.mockResolvedValue(null);
    storageApi.clearPhotoScanSessionSnapshot.mockResolvedValue(undefined);
    scanJobStorageApi.loadPhotoScanJobCheckpoint.mockResolvedValue(null);
    nativeScanApi.loadActiveAndroidNativeScanSnapshot.mockResolvedValue(null);
    permissionsApi.getMediaLibraryPermissionsAsync.mockResolvedValue({ granted: true });
  });

  it('restores a coherent completed snapshot before the PhotoGrid first render', async () => {
    const snapshot = createCompletedSnapshot();
    storageApi.loadPhotoScanSessionSnapshot.mockResolvedValueOnce(snapshot);

    await hydrateStartupPhotoScanState();

    expect(runtimeApi.stageStartupPhotoScanSessionRuntimeSnapshot).toHaveBeenCalledWith(snapshot);
    expect(permissionsApi.getMediaLibraryPermissionsAsync).not.toHaveBeenCalled();
  });

  it('rejects incoherent completed snapshots and stages a permission-resolved idle state', async () => {
    const snapshot = createCompletedSnapshot({
      scanResultsCount: 3,
    });
    storageApi.loadPhotoScanSessionSnapshot.mockResolvedValueOnce(snapshot);

    await hydrateStartupPhotoScanState();

    expect(isRestorableStartupPhotoScanSnapshot(snapshot)).toBe(false);
    expect(storageApi.clearPhotoScanSessionSnapshot).toHaveBeenCalledTimes(1);
    expect(runtimeApi.stageStartupPhotoScanSessionRuntimeSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        permissionState: 'granted',
        phase: 'idle',
      }),
    );
  });

  it('keeps a usable completed snapshot on startup even when the stored scope summary is stale', async () => {
    const snapshot = createCompletedSnapshot({
      scanScopeSelection: {
        total: 999,
        photo: 998,
        video: 1,
      },
    });
    storageApi.loadPhotoScanSessionSnapshot.mockResolvedValueOnce(snapshot);

    await hydrateStartupPhotoScanState();

    expect(runtimeApi.stageStartupPhotoScanSessionRuntimeSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        permissionState: 'granted',
        phase: 'completed',
        visibleCandidates: snapshot.visibleCandidates,
        scanResultsCount: snapshot.visibleCandidates.length,
      }),
    );
    expect(storageApi.clearPhotoScanSessionSnapshot).not.toHaveBeenCalled();
  });

  it('bootstraps the completed result state from cached scan results when the session snapshot is missing', async () => {
    storageApi.loadPhotoScanResultCache.mockResolvedValueOnce({
      activeCandidates: [createCandidate('result-1')],
      summary: {
        scannedAt: 1_710_000_000_111,
        scannedCount: 42,
        recycleBinCount: 3,
      },
    });
    storageApi.loadLatestCompletedPhotoScanBatch.mockResolvedValueOnce({
      batchId: 'batch-1',
      mode: 'rolling-window',
      phase: 'completed',
      windowDays: 30,
      rangeStartAt: 1_709_000_000_000,
      rangeEndAt: 1_710_000_000_000,
      progressCurrent: 42,
      progressTotal: 42,
      enumeratedCount: 42,
      dirtyCount: 0,
      analyzedCount: 42,
      candidateCount: 1,
      startedAt: 1_709_000_000_000,
      lastHeartbeatAt: 1_710_000_000_000,
      completedAt: 1_710_000_000_111,
      lastError: null,
      updatedAt: 1_710_000_000_111,
    });

    await hydrateStartupPhotoScanState();

    expect(runtimeApi.stageStartupPhotoScanSessionRuntimeSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        permissionState: 'granted',
        phase: 'completed',
        scanResultsCount: 1,
        scanProgress: {
          current: 42,
          total: 42,
          currentFileName: null,
        },
        summary: expect.objectContaining({
          scannedCount: 42,
          recycleBinCount: 3,
        }),
      }),
    );
    expect(permissionsApi.getMediaLibraryPermissionsAsync).not.toHaveBeenCalled();
  });

  it('stages a scanning snapshot when native scan runtime is still running', async () => {
    nativeScanApi.loadActiveAndroidNativeScanSnapshot.mockResolvedValueOnce({
      status: {
        jobId: 'native-scan-job-1',
        phase: 'running',
        current: 8,
        total: 20,
        processedCount: 8,
        currentFileName: 'IMG_008.jpg',
        lastProcessedAssetId: 'photo-8',
        startedAt: 1_710_000_000_000,
        updatedAt: 1_710_000_000_888,
      },
      analyzedInputs: [],
    });

    await hydrateStartupPhotoScanState();

    expect(runtimeApi.stageStartupPhotoScanSessionRuntimeSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        permissionState: 'granted',
        phase: 'scanning',
        scanProgress: {
          current: 8,
          total: 20,
          currentFileName: 'IMG_008.jpg',
        },
      }),
    );
  });
});
