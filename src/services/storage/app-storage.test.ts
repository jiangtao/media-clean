import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  __resetOperationalStoreImportForTests,
  appendFalsePositiveCandidateIds,
  clearPersistentScanCache,
  clearPhotoScanSessionSnapshot,
  clearPhotoScanResultCache,
  loadFalsePositiveCandidateIds,
  loadAssetManifestEntries,
  loadLastScanMeta,
  loadMediaAnalysisCache,
  loadLastValidScanBaseline,
  loadLatestCompletedPhotoScanBatch,
  loadLatestPhotoScanBatch,
  loadPersistentScanCacheSizeBytes,
  loadPersistedMediaLedger,
  loadPhotoScanBatch,
  loadPhotoScanBatchItems,
  loadPhotoScanResultCache,
  loadPhotoScanSessionSnapshot,
  loadRecycleBinCandidateCache,
  loadRecycleBinIds,
  loadRecycleBinSnapshotCache,
  loadUserDecisions,
  savePhotoScanBatch,
  savePhotoScanBatchItems,
  saveFalsePositiveCandidateIds,
  saveLastScanMeta,
  saveLastValidScanBaseline,
  saveManualRecycleBinSnapshot,
  saveMediaAnalysisCache,
  savePersistedMediaLedger,
  savePhotoScanResultCache,
  savePhotoScanSessionSnapshot,
  saveRecycleBinCandidateCache,
  saveRecycleBinIds,
  saveRecycleBinSnapshotCache,
  upsertAssetManifestEntries,
  syncPersistedMediaLedger,
  type AssetManifestRecord,
  type MediaAnalysisCache,
  type PersistedMediaRecord,
  type PhotoScanBatchItemRecord,
  type PhotoScanBatchRecord,
  type PhotoScanResultCache,
  type PhotoScanSessionSnapshot,
  type RecycleBinCandidateCache,
  type RecycleBinSnapshotCache,
} from './app-storage';
import {
  loadOperationalRecognitionGroups,
  __resetOperationalStoreForTests,
  __useInMemoryOperationalStoreForTests,
} from './sqlite/operational-store';

const { getItem, setItem, removeItem } = vi.hoisted(() => ({
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
}));

const asyncStorageState = vi.hoisted(() => new Map<string, string>());

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem,
    setItem,
    removeItem,
  },
}));

function bindAsyncStorageMocks() {
  getItem.mockImplementation(async (key: string) => asyncStorageState.get(key) ?? null);
  setItem.mockImplementation(async (key: string, value: string) => {
    asyncStorageState.set(key, value);
  });
  removeItem.mockImplementation(async (key: string) => {
    asyncStorageState.delete(key);
  });
}

const sampleCache: PhotoScanResultCache = {
  activeCandidates: [
    {
      id: 'candidate-1',
      asset: {
        id: 'asset-1',
        uri: 'file:///asset-1.jpg',
        previewUri: 'file:///asset-1-preview.jpg',
        mediaType: 'photo',
        width: 1179,
        height: 2556,
        duration: 0,
        fileSize: 1024,
        creationTime: 1_710_000_000_000,
      },
      score: 86,
      confidence: 'high',
      kind: 'abnormal-photo',
      primaryIssueType: 'abnormal',
      issueTypes: ['abnormal'],
      reasons: ['Too dark'],
    },
    {
      id: 'candidate-2',
      asset: {
        id: 'asset-2',
        uri: 'file:///asset-2.mov',
        mediaType: 'video',
        width: 1920,
        height: 1080,
        duration: 12,
        fileSize: 2048,
        creationTime: 1_710_000_100_000,
      },
      score: 61,
      confidence: 'medium',
      kind: 'duplicate-video',
      primaryIssueType: 'duplicate',
      issueTypes: ['duplicate'],
      reasons: ['Looks similar'],
      duplicateGroup: {
        groupId: 'group-1',
        representativeId: 'asset-3',
        relation: 'near',
        size: 2,
        similarity: 0.92,
        representativeReason: 'newer-capture',
        representativeWidth: 1920,
        representativeHeight: 1080,
        representativeFileSize: 4096,
        representativeCreationTime: 1_710_000_200_000,
      },
    },
  ],
  summary: {
    scannedAt: 1_710_000_300_000,
    scannedCount: 360,
    candidateCount: 2,
    highConfidenceCount: 1,
    mediumConfidenceCount: 1,
    recycleBinCount: 0,
  },
};

const sampleAnalysisCache: MediaAnalysisCache = {
  'asset-1': {
    assetId: 'asset-1',
    signature: 'v1:photo:1710000000000:1179:2556:0:1024',
    previewUri: 'file:///asset-1-preview.jpg',
    fingerprint: '10101010',
    frameFingerprints: ['10101010'],
    status: 'ok',
    metrics: {
      brightness: 0.25,
      contrast: 0.48,
      edgeDensity: 0.31,
    },
  },
};

const sampleRecycleBinCache: RecycleBinCandidateCache = [...sampleCache.activeCandidates];
const sampleRecycleBinSnapshot: RecycleBinSnapshotCache = {
  ids: ['candidate-1', 'candidate-2'],
  candidates: sampleRecycleBinCache,
  updatedAt: 1_710_000_300_000,
  source: 'manual',
};

const samplePersistedMediaLedger: PersistedMediaRecord[] = [
  {
    assetId: 'candidate-1',
    stableHash: 'hash-candidate-1',
    status: 0,
    linkIds: [],
    updatedAt: 1_710_000_300_000,
    lastError: null,
    candidate: sampleCache.activeCandidates[0],
  },
];

const sampleLastValidScanBaseline = {
  scannedAt: 1_710_000_300_000,
  scannedCount: 360,
  candidateCount: 2,
  scanRangeMonths: 3,
  latestEligibleAssetAt: 1_710_000_100_000,
  ledgerUpdatedAt: 1_710_000_500_000,
};

const samplePhotoScanBatch: PhotoScanBatchRecord = {
  batchId: 'batch-1',
  mode: 'rolling-window',
  phase: 'analysis',
  windowDays: 90,
  rangeStartAt: 1_709_200_000_000,
  rangeEndAt: 1_710_000_300_000,
  progressCurrent: 24,
  progressTotal: 120,
  enumeratedCount: 120,
  dirtyCount: 120,
  analyzedCount: 24,
  candidateCount: 0,
  startedAt: 1_710_000_000_000,
  lastHeartbeatAt: 1_710_000_100_000,
  completedAt: null,
  lastError: null,
  updatedAt: 1_710_000_100_000,
};

const samplePhotoScanBatchItems: PhotoScanBatchItemRecord[] = [
  {
    batchId: 'batch-1',
    assetId: 'asset-1',
    stage: 'completed',
    mediaType: 'photo',
    dirtyReason: 'new',
    attemptCount: 1,
    workerSlot: null,
    lastHeartbeatAt: 1_710_000_050_000,
    lastError: null,
    updatedAt: 1_710_000_050_000,
  },
  {
    batchId: 'batch-1',
    assetId: 'asset-2',
    stage: 'queued',
    mediaType: 'video',
    dirtyReason: null,
    attemptCount: 0,
    workerSlot: null,
    lastHeartbeatAt: null,
    lastError: null,
    updatedAt: 1_710_000_050_000,
  },
];

const sampleAssetManifestEntries: AssetManifestRecord[] = [
  {
    assetId: 'asset-1',
    contentUri: 'file:///asset-1.jpg',
    mediaType: 'photo',
    mimeType: null,
    width: 1179,
    height: 2556,
    orientation: null,
    aspectRatio: 1179 / 2556,
    durationMs: 0,
    fileSizeBytes: 1024,
    dateTaken: 1_710_000_000_000,
    dateModified: null,
    bucketId: null,
    bucketName: null,
    isScreenshot: null,
    bitrate: null,
    frameRate: null,
    codec: null,
    firstSeenAt: 1_710_000_000_000,
    lastSeenAt: 1_710_000_100_000,
    isDeleted: false,
    dirtyReason: 'new',
    updatedAt: 1_710_000_100_000,
  },
  {
    assetId: 'asset-2',
    contentUri: 'file:///asset-2.mov',
    mediaType: 'video',
    mimeType: null,
    width: 1920,
    height: 1080,
    orientation: null,
    aspectRatio: 1920 / 1080,
    durationMs: 12,
    fileSizeBytes: 2048,
    dateTaken: 1_710_000_100_000,
    dateModified: null,
    bucketId: null,
    bucketName: null,
    isScreenshot: null,
    bitrate: null,
    frameRate: null,
    codec: null,
    firstSeenAt: 1_710_000_000_000,
    lastSeenAt: 1_710_000_100_000,
    isDeleted: false,
    dirtyReason: null,
    updatedAt: 1_710_000_100_000,
  },
];

const samplePhotoScanSessionSnapshot: PhotoScanSessionSnapshot = {
  permissionState: 'granted',
  phase: 'scanning',
  authorizedCandidates: sampleCache.activeCandidates,
  visibleCandidates: [sampleCache.activeCandidates[0]],
  scanResultsCount: 1,
  scanProgress: {
    current: 2,
    total: 3,
    currentFileName: 'IMG_002.jpg',
  },
  scanScopeSelection: {
    total: 1,
    photo: 1,
    video: 0,
  },
  scanBatchRange: {
    startAt: 1_709_200_000_000,
    endAt: 1_710_000_300_000,
  },
  summary: {
    scannedAt: 1_710_000_300_000,
    scannedCount: 2,
    recycleBinCount: 1,
  },
  hasCompletedFullScan: false,
  errorMessage: null,
  updatedAt: 1_710_000_400_000,
};

beforeEach(() => {
  __resetOperationalStoreImportForTests();
  __resetOperationalStoreForTests();
  __useInMemoryOperationalStoreForTests();
  asyncStorageState.clear();
  getItem.mockReset();
  setItem.mockReset();
  removeItem.mockReset();
  bindAsyncStorageMocks();
});

function mockLegacyOperationalImport(values: Partial<{
  recycleBinIds: unknown;
  lastValidScanBaseline: unknown;
  mediaAnalysisCache: unknown;
  persistedMediaLedger: unknown;
  lastScanMeta: unknown;
  scanRange: string | null;
}>) {
  asyncStorageState.clear();

  if (values.recycleBinIds !== undefined) {
    asyncStorageState.set('app-cleaner/recycle-bin-ids', JSON.stringify(values.recycleBinIds));
  }
  if (values.lastValidScanBaseline !== undefined) {
    asyncStorageState.set(
      'app-cleaner/last-valid-scan-baseline',
      JSON.stringify(values.lastValidScanBaseline),
    );
  }
  if (values.mediaAnalysisCache !== undefined) {
    asyncStorageState.set(
      'app-cleaner/media-analysis-cache',
      JSON.stringify(values.mediaAnalysisCache),
    );
  }
  if (values.persistedMediaLedger !== undefined) {
    asyncStorageState.set(
      'app-cleaner/persisted-media-ledger',
      JSON.stringify(values.persistedMediaLedger),
    );
  }
  if (values.lastScanMeta !== undefined) {
    asyncStorageState.set('app-cleaner/last-scan', JSON.stringify(values.lastScanMeta));
  }
  if (values.scanRange !== undefined && values.scanRange !== null) {
    asyncStorageState.set('app-cleaner/scan-range', values.scanRange);
  }
}

describe('photo scan result cache storage', () => {
  beforeEach(() => {
    getItem.mockReset();
    setItem.mockReset();
    removeItem.mockReset();
    bindAsyncStorageMocks();
  });

  it('loads the stored photo scan result cache when the payload is valid', async () => {
    asyncStorageState.set('app-cleaner/photo-scan-result-cache', JSON.stringify(sampleCache));

    await expect(loadPhotoScanResultCache()).resolves.toEqual(sampleCache);
  });

  it('filters malformed candidates while preserving a valid cache payload', async () => {
    asyncStorageState.set(
      'app-cleaner/photo-scan-result-cache',
      JSON.stringify({
        activeCandidates: [
          sampleCache.activeCandidates[0],
          { id: 'broken-candidate', asset: null },
        ],
        summary: sampleCache.summary,
      }),
    );

    await expect(loadPhotoScanResultCache()).resolves.toEqual({
      activeCandidates: [sampleCache.activeCandidates[0]],
      summary: sampleCache.summary,
    });
  });

  it('returns null when the stored cache is malformed', async () => {
    asyncStorageState.set('app-cleaner/photo-scan-result-cache', '{broken-json');
    await expect(loadPhotoScanResultCache()).resolves.toBeNull();

    __resetOperationalStoreImportForTests();
    __resetOperationalStoreForTests();
    __useInMemoryOperationalStoreForTests();
    asyncStorageState.set(
      'app-cleaner/photo-scan-result-cache',
      JSON.stringify({
        activeCandidates: sampleCache.activeCandidates,
        summary: { scannedAt: 'yesterday' },
      }),
    );
    await expect(loadPhotoScanResultCache()).resolves.toBeNull();
  });

  it('persists the photo scan result cache as plain JSON', async () => {
    await savePhotoScanResultCache(sampleCache);

    expect(setItem).toHaveBeenCalledWith(
      'app-cleaner/photo-scan-result-cache',
      JSON.stringify(sampleCache),
    );
  });

  it('loads the photo scan result cache from the operational candidate view when AsyncStorage is empty', async () => {
    await savePhotoScanResultCache(sampleCache);
    asyncStorageState.delete('app-cleaner/photo-scan-result-cache');

    await expect(loadPhotoScanResultCache()).resolves.toEqual(sampleCache);
  });

  it('persists duplicate groups as operational recognition groups', async () => {
    await savePhotoScanResultCache(sampleCache);

    await expect(loadOperationalRecognitionGroups()).resolves.toEqual([
      {
        groupId: 'group-1',
        relation: 'near',
        size: 2,
        similarity: 0.92,
        representativeAssetId: 'asset-3',
        representativeReason: 'newer-capture',
        representativeWidth: 1920,
        representativeHeight: 1080,
        representativeFileSize: 4096,
        representativeCreationTime: 1_710_000_200_000,
        memberAssetIds: ['asset-2'],
        updatedAt: sampleCache.summary.scannedAt,
      },
    ]);
  });

  it('prefers the newer legacy cache when the operational candidate view is stale', async () => {
    const staleCache: PhotoScanResultCache = {
      ...sampleCache,
      summary: {
        ...sampleCache.summary,
        scannedAt: sampleCache.summary.scannedAt - 1_000,
        scannedCount: 120,
      },
    };
    const newerLegacyCache: PhotoScanResultCache = {
      ...sampleCache,
      summary: {
        ...sampleCache.summary,
        scannedAt: sampleCache.summary.scannedAt + 1_000,
        scannedCount: 480,
      },
    };

    await savePhotoScanResultCache(staleCache);
    asyncStorageState.set(
      'app-cleaner/photo-scan-result-cache',
      JSON.stringify(newerLegacyCache),
    );

    await expect(loadPhotoScanResultCache()).resolves.toEqual(newerLegacyCache);
  });

  it('clears the stored photo scan result cache', async () => {
    await savePhotoScanResultCache(sampleCache);
    await expect(loadOperationalRecognitionGroups()).resolves.toHaveLength(1);
    await clearPhotoScanResultCache();

    expect(removeItem).toHaveBeenCalledWith('app-cleaner/photo-scan-result-cache');
    await expect(loadPhotoScanResultCache()).resolves.toBeNull();
    await expect(loadOperationalRecognitionGroups()).resolves.toEqual([]);
  });
});

describe('media analysis cache storage', () => {
  beforeEach(() => {
    getItem.mockReset();
    setItem.mockReset();
    removeItem.mockReset();
    bindAsyncStorageMocks();
  });

  it('loads the stored analysis cache when payload entries are valid', async () => {
    mockLegacyOperationalImport({
      mediaAnalysisCache: sampleAnalysisCache,
    });

    await expect(loadMediaAnalysisCache()).resolves.toEqual(sampleAnalysisCache);
  });

  it('filters malformed analysis cache entries', async () => {
    mockLegacyOperationalImport({
      mediaAnalysisCache: {
        ...sampleAnalysisCache,
        broken: {
          assetId: 'broken',
          signature: 123,
        },
      },
    });

    await expect(loadMediaAnalysisCache()).resolves.toEqual(sampleAnalysisCache);
  });

  it('returns an empty analysis cache when storage is malformed', async () => {
    getItem.mockImplementation(async (key: string) =>
      key === 'app-cleaner/media-analysis-cache' ? '{broken-json' : null,
    );

    await expect(loadMediaAnalysisCache()).resolves.toEqual({});
  });

  it('persists the analysis cache as plain JSON', async () => {
    await saveMediaAnalysisCache(sampleAnalysisCache);

    await expect(loadMediaAnalysisCache()).resolves.toEqual(sampleAnalysisCache);
    expect(setItem).not.toHaveBeenCalledWith(
      'app-cleaner/media-analysis-cache',
      JSON.stringify(sampleAnalysisCache),
    );
  });
});

describe('photo scan session storage', () => {
  beforeEach(() => {
    getItem.mockReset();
    setItem.mockReset();
    removeItem.mockReset();
    bindAsyncStorageMocks();
  });

  it('loads the stored photo scan session when the payload is valid', async () => {
    getItem.mockResolvedValueOnce(JSON.stringify(samplePhotoScanSessionSnapshot));

    await expect(loadPhotoScanSessionSnapshot()).resolves.toEqual(samplePhotoScanSessionSnapshot);
  });

  it('filters malformed candidates from the stored photo scan session snapshot', async () => {
    getItem.mockResolvedValueOnce(
      JSON.stringify({
        ...samplePhotoScanSessionSnapshot,
        authorizedCandidates: [...sampleCache.activeCandidates, { id: 'broken', asset: null }],
        visibleCandidates: [{ id: 'broken', asset: null }, sampleCache.activeCandidates[0]],
      }),
    );

    await expect(loadPhotoScanSessionSnapshot()).resolves.toEqual({
      ...samplePhotoScanSessionSnapshot,
      authorizedCandidates: sampleCache.activeCandidates,
      visibleCandidates: [sampleCache.activeCandidates[0]],
    });
  });

  it('returns null when the stored photo scan session snapshot is malformed', async () => {
    getItem.mockResolvedValueOnce(
      JSON.stringify({
        ...samplePhotoScanSessionSnapshot,
        phase: 'broken',
      }),
    );

    await expect(loadPhotoScanSessionSnapshot()).resolves.toBeNull();
  });

  it('persists and clears the photo scan session snapshot as plain JSON', async () => {
    await savePhotoScanSessionSnapshot(samplePhotoScanSessionSnapshot);

    expect(setItem).toHaveBeenCalledWith(
      'app-cleaner/photo-scan-session',
      JSON.stringify(samplePhotoScanSessionSnapshot),
    );

    await clearPhotoScanSessionSnapshot();

    expect(removeItem).toHaveBeenCalledWith('app-cleaner/photo-scan-session');
  });
});

describe('persisted media ledger storage', () => {
  beforeEach(() => {
    getItem.mockReset();
    setItem.mockReset();
    removeItem.mockReset();
    bindAsyncStorageMocks();
  });

  it('loads the stored media ledger when payload entries are valid', async () => {
    mockLegacyOperationalImport({
      persistedMediaLedger: samplePersistedMediaLedger,
    });

    await expect(loadPersistedMediaLedger()).resolves.toEqual(samplePersistedMediaLedger);
  });

  it('filters malformed media ledger entries', async () => {
    mockLegacyOperationalImport({
      persistedMediaLedger: [
        samplePersistedMediaLedger[0],
        { assetId: 'broken', status: 'oops' },
      ],
    });

    await expect(loadPersistedMediaLedger()).resolves.toEqual(samplePersistedMediaLedger);
  });

  it('persists the normalized media ledger as plain JSON', async () => {
    await savePersistedMediaLedger(samplePersistedMediaLedger);

    await expect(loadPersistedMediaLedger()).resolves.toEqual(samplePersistedMediaLedger);
  });

  it('syncs scan, keep, recycle, and error states into a unified media ledger', async () => {
    mockLegacyOperationalImport({
      mediaAnalysisCache: sampleAnalysisCache,
      persistedMediaLedger: samplePersistedMediaLedger,
    });

    const synced = await syncPersistedMediaLedger({
      activeCandidates: [sampleCache.activeCandidates[0]],
      recycleBinCandidates: [sampleCache.activeCandidates[1]],
      keptIds: ['candidate-1'],
      errorById: {
        'candidate-404': 'analysis failed',
      },
      updatedAt: 1_710_000_500_000,
    });

    expect(synced).toEqual([
      {
        assetId: 'candidate-1',
        stableHash: '10101010',
        status: 1,
        linkIds: [],
        updatedAt: 1_710_000_500_000,
        lastError: null,
        candidate: sampleCache.activeCandidates[0],
      },
      {
        assetId: 'candidate-2',
        stableHash: 'asset-2',
        status: -2,
        linkIds: ['asset-3'],
        updatedAt: 1_710_000_500_000,
        lastError: null,
        candidate: sampleCache.activeCandidates[1],
      },
      {
        assetId: 'candidate-404',
        stableHash: 'candidate-404',
        status: -1,
        linkIds: [],
        updatedAt: 1_710_000_500_000,
        lastError: 'analysis failed',
      },
    ]);

    await expect(loadPersistedMediaLedger()).resolves.toEqual(synced);
    await expect(loadUserDecisions()).resolves.toEqual([
      {
        assetId: 'asset-1',
        candidateId: 'candidate-1',
        decision: 'kept',
        source: 'manual',
        reason: 'marked-false-positive',
        decidedAt: 1_710_000_500_000,
        updatedAt: 1_710_000_500_000,
        snapshotJson: JSON.stringify(sampleCache.activeCandidates[0]),
      },
      {
        assetId: 'asset-2',
        candidateId: 'candidate-2',
        decision: 'recycled',
        source: 'manual',
        reason: 'move-to-recycle-bin',
        decidedAt: 1_710_000_500_000,
        updatedAt: 1_710_000_500_000,
        snapshotJson: JSON.stringify(sampleCache.activeCandidates[1]),
      },
      {
        assetId: 'candidate-404',
        candidateId: 'candidate-404',
        decision: 'failed',
        source: 'manual',
        reason: 'analysis failed',
        decidedAt: 1_710_000_500_000,
        updatedAt: 1_710_000_500_000,
        snapshotJson: null,
      },
    ]);
  });

  it('evicts permanently deleted media from the ledger and operational store', async () => {
    mockLegacyOperationalImport({
      mediaAnalysisCache: sampleAnalysisCache,
      persistedMediaLedger: samplePersistedMediaLedger,
    });

    await saveRecycleBinIds(['candidate-1']);
    const synced = await syncPersistedMediaLedger({
      deletedIds: ['candidate-1'],
      updatedAt: 1_710_000_600_000,
    });

    expect(synced).toEqual([]);
    await expect(loadPersistedMediaLedger()).resolves.toEqual([]);
    await expect(loadMediaAnalysisCache()).resolves.toEqual({});
    await expect(loadRecycleBinIds()).resolves.toEqual([]);
  });

  it('records restored and deleted user decisions without keeping them in scan cache', async () => {
    await syncPersistedMediaLedger({
      recycleBinCandidates: [sampleCache.activeCandidates[1]],
      updatedAt: 1_710_000_500_000,
    });

    await syncPersistedMediaLedger({
      activeCandidates: [sampleCache.activeCandidates[1]],
      restoredIds: ['candidate-2'],
      updatedAt: 1_710_000_550_000,
    });

    await expect(loadUserDecisions()).resolves.toEqual([
      {
        assetId: 'asset-2',
        candidateId: 'candidate-2',
        decision: 'restored',
        source: 'manual',
        reason: 'restore-from-recycle-bin',
        decidedAt: 1_710_000_550_000,
        updatedAt: 1_710_000_550_000,
        snapshotJson: JSON.stringify(sampleCache.activeCandidates[1]),
      },
    ]);

    await syncPersistedMediaLedger({
      deletedIds: ['candidate-2'],
      updatedAt: 1_710_000_600_000,
    });

    await expect(loadUserDecisions()).resolves.toEqual([
      {
        assetId: 'asset-2',
        candidateId: 'candidate-2',
        decision: 'deleted',
        source: 'manual',
        reason: 'hard-delete',
        decidedAt: 1_710_000_600_000,
        updatedAt: 1_710_000_600_000,
        snapshotJson: JSON.stringify(sampleCache.activeCandidates[1]),
      },
    ]);
  });

  it('does not infer restored decisions from ordinary active scan results', async () => {
    await syncPersistedMediaLedger({
      recycleBinCandidates: [sampleCache.activeCandidates[1]],
      updatedAt: 1_710_000_500_000,
    });

    await syncPersistedMediaLedger({
      activeCandidates: [sampleCache.activeCandidates[1]],
      updatedAt: 1_710_000_550_000,
    });

    await expect(loadUserDecisions()).resolves.toEqual([
      {
        assetId: 'asset-2',
        candidateId: 'candidate-2',
        decision: 'recycled',
        source: 'manual',
        reason: 'move-to-recycle-bin',
        decidedAt: 1_710_000_500_000,
        updatedAt: 1_710_000_500_000,
        snapshotJson: JSON.stringify(sampleCache.activeCandidates[1]),
      },
    ]);
  });

  it('prunes recognition groups when deleted asset records are evicted', async () => {
    await savePhotoScanResultCache(sampleCache);
    await expect(loadOperationalRecognitionGroups()).resolves.toHaveLength(1);

    await syncPersistedMediaLedger({
      deletedIds: ['asset-2'],
      updatedAt: 1_710_000_650_000,
    });

    await expect(loadOperationalRecognitionGroups()).resolves.toEqual([]);
  });
});

describe('last valid scan baseline storage', () => {
  beforeEach(() => {
    getItem.mockReset();
    setItem.mockReset();
    removeItem.mockReset();
    bindAsyncStorageMocks();
  });

  it('loads the stored scan baseline when the payload is valid', async () => {
    mockLegacyOperationalImport({
      lastValidScanBaseline: sampleLastValidScanBaseline,
    });

    await expect(loadLastValidScanBaseline()).resolves.toEqual(sampleLastValidScanBaseline);
  });

  it('normalizes malformed latest asset timestamps to null', async () => {
    mockLegacyOperationalImport({
      lastValidScanBaseline: {
        ...sampleLastValidScanBaseline,
        latestEligibleAssetAt: 'broken',
      },
    });

    await expect(loadLastValidScanBaseline()).resolves.toEqual({
      ...sampleLastValidScanBaseline,
      latestEligibleAssetAt: null,
    });
  });

  it('returns null when the stored scan baseline is malformed', async () => {
    mockLegacyOperationalImport({
      lastValidScanBaseline: {
        scannedAt: 'broken',
      },
    });

    await expect(loadLastValidScanBaseline()).resolves.toBeNull();
  });

  it('persists the scan baseline as plain JSON', async () => {
    await saveLastValidScanBaseline(sampleLastValidScanBaseline);

    await expect(loadLastValidScanBaseline()).resolves.toEqual(sampleLastValidScanBaseline);
  });
});

describe('last scan meta storage', () => {
  beforeEach(() => {
    getItem.mockReset();
    setItem.mockReset();
    removeItem.mockReset();
    bindAsyncStorageMocks();
  });

  it('backfills a durable scan baseline from legacy last scan metadata', async () => {
    getItem.mockImplementationOnce(async () =>
      JSON.stringify({
        scannedAt: 1_710_000_300_000,
        scannedCount: 360,
        candidateCount: 2,
      }),
    );

    await expect(loadLastScanMeta()).resolves.toEqual({
      scannedAt: 1_710_000_300_000,
      scannedCount: 360,
      candidateCount: 2,
    });

    mockLegacyOperationalImport({
      lastScanMeta: {
        scannedAt: 1_710_000_300_000,
        scannedCount: 360,
        candidateCount: 2,
      },
      scanRange: '6',
    });

    await expect(loadLastValidScanBaseline()).resolves.toEqual({
      scannedAt: 1_710_000_300_000,
      scannedCount: 360,
      candidateCount: 2,
      scanRangeMonths: 6,
      latestEligibleAssetAt: 1_710_000_300_000,
      ledgerUpdatedAt: 1_710_000_300_000,
    });
  });

  it('persists last scan metadata together with a durable scan baseline', async () => {
    mockLegacyOperationalImport({
      scanRange: '3',
    });

    await saveLastScanMeta({
      scannedAt: 1_710_000_300_000,
      scannedCount: 360,
      candidateCount: 2,
    });

    expect(setItem).toHaveBeenNthCalledWith(
      1,
      'app-cleaner/last-scan',
      JSON.stringify({
        scannedAt: 1_710_000_300_000,
        scannedCount: 360,
        candidateCount: 2,
      }),
    );
    await expect(loadLastValidScanBaseline()).resolves.toEqual({
      scannedAt: 1_710_000_300_000,
      scannedCount: 360,
      candidateCount: 2,
      scanRangeMonths: 3,
      latestEligibleAssetAt: 1_710_000_300_000,
      ledgerUpdatedAt: 1_710_000_300_000,
    });
  });
});

describe('recycle-bin candidate cache storage', () => {
  beforeEach(() => {
    getItem.mockReset();
    setItem.mockReset();
    removeItem.mockReset();
    bindAsyncStorageMocks();
  });

  it('loads the stored recycle-bin candidate cache when payload entries are valid', async () => {
    getItem.mockResolvedValueOnce(JSON.stringify(sampleRecycleBinCache));

    await expect(loadRecycleBinCandidateCache()).resolves.toEqual(sampleRecycleBinCache);
  });

  it('loads recycle-bin candidate arrays from the richer snapshot payload for backward compatibility', async () => {
    getItem.mockResolvedValueOnce(JSON.stringify(sampleRecycleBinSnapshot));

    await expect(loadRecycleBinCandidateCache()).resolves.toEqual(sampleRecycleBinCache);
  });

  it('filters malformed recycle-bin cache entries', async () => {
    getItem.mockResolvedValueOnce(
      JSON.stringify([
        sampleRecycleBinCache[0],
        { id: 'broken-candidate', asset: null },
      ]),
    );

    await expect(loadRecycleBinCandidateCache()).resolves.toEqual([
      sampleRecycleBinCache[0],
    ]);
  });

  it('persists the recycle-bin candidate cache inside the reusable snapshot envelope', async () => {
    await saveRecycleBinCandidateCache(sampleRecycleBinCache);

    expect(setItem).toHaveBeenCalledWith(
      'app-cleaner/recycle-bin-candidate-cache',
      expect.any(String),
    );

    expect(JSON.parse(setItem.mock.calls[0]?.[1] as string)).toEqual({
      ids: ['candidate-1', 'candidate-2'],
      candidates: sampleRecycleBinCache,
      updatedAt: expect.any(Number),
      source: 'manual',
    });
  });
});

describe('recycle-bin snapshot storage', () => {
  beforeEach(() => {
    getItem.mockReset();
    setItem.mockReset();
    removeItem.mockReset();
    bindAsyncStorageMocks();
  });

  it('loads the stored recycle-bin snapshot when the payload is valid', async () => {
    getItem.mockResolvedValueOnce(JSON.stringify(sampleRecycleBinSnapshot));

    await expect(loadRecycleBinSnapshotCache()).resolves.toEqual(sampleRecycleBinSnapshot);
  });

  it('converts the legacy recycle-bin candidate array into a reusable snapshot', async () => {
    getItem.mockResolvedValueOnce(JSON.stringify(sampleRecycleBinCache));

    await expect(loadRecycleBinSnapshotCache()).resolves.toEqual({
      ids: ['candidate-1', 'candidate-2'],
      candidates: sampleRecycleBinCache,
      updatedAt: 0,
      source: 'legacy',
    });
  });

  it('persists an explicit recycle-bin snapshot envelope as plain JSON', async () => {
    await saveRecycleBinSnapshotCache(sampleRecycleBinSnapshot);

    expect(setItem).toHaveBeenCalledWith(
      'app-cleaner/recycle-bin-candidate-cache',
      JSON.stringify(sampleRecycleBinSnapshot),
    );
  });

  it('provides a reusable persistent snapshot helper for manually recycled candidates', async () => {
    await saveManualRecycleBinSnapshot(sampleRecycleBinCache);

    expect(setItem).toHaveBeenCalledWith(
      'app-cleaner/recycle-bin-candidate-cache',
      expect.any(String),
    );

    expect(JSON.parse(setItem.mock.calls[0]?.[1] as string)).toEqual({
      ids: ['candidate-1', 'candidate-2'],
      candidates: sampleRecycleBinCache,
      updatedAt: expect.any(Number),
      source: 'manual',
    });
  });
});

describe('false-positive candidate id storage', () => {
  beforeEach(() => {
    getItem.mockReset();
    setItem.mockReset();
    removeItem.mockReset();
    bindAsyncStorageMocks();
  });

  it('loads normalized false-positive ids from storage', async () => {
    getItem.mockResolvedValueOnce(JSON.stringify(['candidate-2', 'candidate-1', 'candidate-2']));

    await expect(loadFalsePositiveCandidateIds()).resolves.toEqual([
      'candidate-1',
      'candidate-2',
    ]);
  });

  it('returns an empty array when false-positive ids are malformed', async () => {
    getItem.mockResolvedValueOnce('{broken-json');
    await expect(loadFalsePositiveCandidateIds()).resolves.toEqual([]);

    getItem.mockResolvedValueOnce(JSON.stringify({ nope: true }));
    await expect(loadFalsePositiveCandidateIds()).resolves.toEqual([]);
  });

  it('saves normalized false-positive ids', async () => {
    await saveFalsePositiveCandidateIds(['candidate-2', 'candidate-1', 'candidate-2']);

    expect(setItem).toHaveBeenCalledWith(
      'app-cleaner/false-positive-candidate-ids',
      JSON.stringify(['candidate-1', 'candidate-2']),
    );
  });

  it('appends false-positive ids without duplicating existing entries', async () => {
    getItem.mockResolvedValueOnce(JSON.stringify(['candidate-2']));

    await expect(
      appendFalsePositiveCandidateIds(['candidate-3', 'candidate-2', 'candidate-1']),
    ).resolves.toEqual(['candidate-1', 'candidate-2', 'candidate-3']);

    expect(setItem).toHaveBeenCalledWith(
      'app-cleaner/false-positive-candidate-ids',
      JSON.stringify(['candidate-1', 'candidate-2', 'candidate-3']),
    );
  });
});

describe('persistent scan cache clearing', () => {
  beforeEach(() => {
    getItem.mockReset();
    setItem.mockReset();
    removeItem.mockReset();
    bindAsyncStorageMocks();
  });

  it('clears persisted scan cache state without deleting recycle-bin ids or reminder settings', async () => {
    mockLegacyOperationalImport({
      mediaAnalysisCache: sampleAnalysisCache,
      persistedMediaLedger: samplePersistedMediaLedger,
      lastValidScanBaseline: sampleLastValidScanBaseline,
      lastScanMeta: {
        scannedAt: 1_710_000_300_000,
        scannedCount: 360,
        candidateCount: 2,
      },
    });

    await saveRecycleBinIds(['recycle-kept']);
    await saveRecycleBinCandidateCache(sampleRecycleBinCache);
    await savePhotoScanResultCache(sampleCache);
    await savePhotoScanSessionSnapshot(samplePhotoScanSessionSnapshot);
    await saveFalsePositiveCandidateIds(['candidate-1']);
    await saveMediaAnalysisCache(sampleAnalysisCache);
    await savePersistedMediaLedger(samplePersistedMediaLedger);
    await syncPersistedMediaLedger({
      keptIds: ['candidate-1'],
      updatedAt: 1_710_000_500_000,
    });
    await saveLastScanMeta({
      scannedAt: 1_710_000_300_000,
      scannedCount: 360,
      candidateCount: 2,
    });
    await saveLastValidScanBaseline(sampleLastValidScanBaseline);

    await clearPersistentScanCache();

    await expect(loadPhotoScanResultCache()).resolves.toBeNull();
    await expect(loadOperationalRecognitionGroups()).resolves.toEqual([]);
    await expect(loadPhotoScanSessionSnapshot()).resolves.toBeNull();
    await expect(loadFalsePositiveCandidateIds()).resolves.toEqual([]);
    await expect(loadMediaAnalysisCache()).resolves.toEqual({});
    await expect(loadPersistedMediaLedger()).resolves.toEqual([]);
    await expect(loadUserDecisions()).resolves.toEqual([
      expect.objectContaining({
        assetId: 'asset-1',
        candidateId: 'candidate-1',
        decision: 'kept',
      }),
    ]);
    await expect(loadLastScanMeta()).resolves.toBeNull();
    await expect(loadLastValidScanBaseline()).resolves.toBeNull();
    await expect(loadRecycleBinCandidateCache()).resolves.toEqual([]);
    await expect(loadRecycleBinIds()).resolves.toEqual(['recycle-kept']);
    expect(removeItem).toHaveBeenCalledWith('app-cleaner/photo-scan-result-cache');
    expect(removeItem).toHaveBeenCalledWith('app-cleaner/photo-scan-session');
    expect(removeItem).toHaveBeenCalledWith('app-cleaner/false-positive-candidate-ids');
    expect(removeItem).toHaveBeenCalledWith('app-cleaner/last-scan');
  });

  it('estimates removable persistent scan cache bytes from AsyncStorage and operational-store payloads', async () => {
    await saveRecycleBinCandidateCache(sampleRecycleBinCache);
    await savePhotoScanResultCache(sampleCache);
    await savePhotoScanSessionSnapshot(samplePhotoScanSessionSnapshot);
    await saveFalsePositiveCandidateIds(['candidate-1']);
    await saveMediaAnalysisCache(sampleAnalysisCache);
    await savePersistedMediaLedger(samplePersistedMediaLedger);
    await saveLastScanMeta({
      scannedAt: 1_710_000_300_000,
      scannedCount: 360,
      candidateCount: 2,
    });
    await saveLastValidScanBaseline(sampleLastValidScanBaseline);

    await expect(loadPersistentScanCacheSizeBytes()).resolves.toBeGreaterThan(0);

    await clearPersistentScanCache();

    await expect(loadPersistentScanCacheSizeBytes()).resolves.toBe(0);
  });
});

describe('android v1 batch runtime storage', () => {
  it('persists and reloads the latest scan batch and its batch items from the operational store', async () => {
    await savePhotoScanBatch(samplePhotoScanBatch);
    await savePhotoScanBatchItems(samplePhotoScanBatch.batchId, samplePhotoScanBatchItems);

    await expect(loadLatestPhotoScanBatch()).resolves.toEqual(samplePhotoScanBatch);
    await expect(loadPhotoScanBatch(samplePhotoScanBatch.batchId)).resolves.toEqual(samplePhotoScanBatch);
    await expect(loadPhotoScanBatchItems(samplePhotoScanBatch.batchId)).resolves.toEqual(
      samplePhotoScanBatchItems,
    );
  });

  it('keeps latest any batch separate from the latest completed batch', async () => {
    const completedBatch: PhotoScanBatchRecord = {
      ...samplePhotoScanBatch,
      batchId: 'batch-completed',
      phase: 'completed',
      progressCurrent: samplePhotoScanBatch.progressTotal,
      analyzedCount: samplePhotoScanBatch.progressTotal,
      completedAt: 1_710_000_200_000,
      updatedAt: 1_710_000_200_000,
    };
    const failedBatch: PhotoScanBatchRecord = {
      ...samplePhotoScanBatch,
      batchId: 'batch-failed',
      phase: 'failed',
      lastError: 'native worker failed',
      updatedAt: 1_710_000_300_000,
    };

    await savePhotoScanBatch(completedBatch);
    await savePhotoScanBatch(failedBatch);

    await expect(loadLatestCompletedPhotoScanBatch()).resolves.toEqual(completedBatch);
    await expect(loadLatestPhotoScanBatch()).resolves.toEqual(failedBatch);
  });

  it('upserts and filters asset manifest entries by asset id', async () => {
    await upsertAssetManifestEntries(sampleAssetManifestEntries);

    await expect(loadAssetManifestEntries()).resolves.toEqual(sampleAssetManifestEntries);
    await expect(loadAssetManifestEntries(['asset-2'])).resolves.toEqual([
      sampleAssetManifestEntries[1],
    ]);
  });
});
