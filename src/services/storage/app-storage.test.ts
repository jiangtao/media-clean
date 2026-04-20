import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  appendFalsePositiveCandidateIds,
  clearPhotoScanResultCache,
  loadFalsePositiveCandidateIds,
  loadMediaAnalysisCache,
  loadPhotoScanResultCache,
  loadRecycleBinCandidateCache,
  loadRecycleBinSnapshotCache,
  saveFalsePositiveCandidateIds,
  saveManualRecycleBinSnapshot,
  saveMediaAnalysisCache,
  savePhotoScanResultCache,
  saveRecycleBinCandidateCache,
  saveRecycleBinSnapshotCache,
  type MediaAnalysisCache,
  type PhotoScanResultCache,
  type RecycleBinCandidateCache,
  type RecycleBinSnapshotCache,
} from './app-storage';

const { getItem, setItem, removeItem } = vi.hoisted(() => ({
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem,
    setItem,
    removeItem,
  },
}));

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

describe('photo scan result cache storage', () => {
  beforeEach(() => {
    getItem.mockReset();
    setItem.mockReset();
    removeItem.mockReset();
  });

  it('loads the stored photo scan result cache when the payload is valid', async () => {
    getItem.mockResolvedValueOnce(JSON.stringify(sampleCache));

    await expect(loadPhotoScanResultCache()).resolves.toEqual(sampleCache);
  });

  it('filters malformed candidates while preserving a valid cache payload', async () => {
    getItem.mockResolvedValueOnce(
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
    getItem.mockResolvedValueOnce('{broken-json');
    await expect(loadPhotoScanResultCache()).resolves.toBeNull();

    getItem.mockResolvedValueOnce(
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

  it('clears the stored photo scan result cache', async () => {
    await clearPhotoScanResultCache();

    expect(removeItem).toHaveBeenCalledWith('app-cleaner/photo-scan-result-cache');
  });
});

describe('media analysis cache storage', () => {
  beforeEach(() => {
    getItem.mockReset();
    setItem.mockReset();
    removeItem.mockReset();
  });

  it('loads the stored analysis cache when payload entries are valid', async () => {
    getItem.mockResolvedValueOnce(JSON.stringify(sampleAnalysisCache));

    await expect(loadMediaAnalysisCache()).resolves.toEqual(sampleAnalysisCache);
  });

  it('filters malformed analysis cache entries', async () => {
    getItem.mockResolvedValueOnce(
      JSON.stringify({
        ...sampleAnalysisCache,
        broken: {
          assetId: 'broken',
          signature: 123,
        },
      }),
    );

    await expect(loadMediaAnalysisCache()).resolves.toEqual(sampleAnalysisCache);
  });

  it('returns an empty analysis cache when storage is malformed', async () => {
    getItem.mockResolvedValueOnce('{broken-json');

    await expect(loadMediaAnalysisCache()).resolves.toEqual({});
  });

  it('persists the analysis cache as plain JSON', async () => {
    await saveMediaAnalysisCache(sampleAnalysisCache);

    expect(setItem).toHaveBeenCalledWith(
      'app-cleaner/media-analysis-cache',
      JSON.stringify(sampleAnalysisCache),
    );
  });
});

describe('recycle-bin candidate cache storage', () => {
  beforeEach(() => {
    getItem.mockReset();
    setItem.mockReset();
    removeItem.mockReset();
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
