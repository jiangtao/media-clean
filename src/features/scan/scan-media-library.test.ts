import { beforeEach, describe, expect, it, vi } from 'vitest';

const mediaLibraryApi = vi.hoisted(() => ({
  getAssetsAsync: vi.fn(),
  getAssetInfoAsync: vi.fn(),
  MediaType: {
    photo: 'photo',
    video: 'video',
  },
  SortBy: {
    creationTime: 'creationTime',
  },
}));

const fileSystemApi = vi.hoisted(() => ({
  getInfoAsync: vi.fn(),
}));

const visualAnalysisApi = vi.hoisted(() => ({
  analyzeVisualsForAsset: vi.fn(),
}));

const appStorageApi = vi.hoisted(() => ({
  loadMediaAnalysisCache: vi.fn(),
  loadFalsePositiveCandidateIds: vi.fn(),
  saveMediaAnalysisCache: vi.fn(),
}));

vi.mock('expo-media-library', () => mediaLibraryApi);
vi.mock('expo-file-system/legacy', () => fileSystemApi);
vi.mock('../../services/media/analyze-visuals', () => visualAnalysisApi);
vi.mock('../../services/storage/app-storage', () => appStorageApi);

import {
  SCAN_ANALYSIS_EXECUTION_STRATEGY,
  loadRecentScanAssets,
  scanMediaLibrary,
} from './scan-media-library';

const NEUTRAL_METRICS = {
  brightness: 0.56,
  contrast: 0.32,
  edgeDensity: 0.28,
};

function createAsset(id: string, overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id,
    filename: `${id}.jpg`,
    uri: `file:///${id}.jpg`,
    mediaType: mediaLibraryApi.MediaType.photo,
    width: 3024,
    height: 4032,
    duration: 0,
    creationTime: 1_710_000_000_000,
    ...overrides,
  };
}

function createVisualAnalysisResult(
  fingerprint: string | null,
  overrides: Partial<{
    previewUri: string;
    frameFingerprints: string[];
    differenceHash: string | null;
    status: 'ok' | 'fallback';
    metrics: typeof NEUTRAL_METRICS;
  }> = {},
) {
  return {
    previewUri: overrides.previewUri ?? 'file:///preview.jpg',
    fingerprint,
    differenceHash: overrides.differenceHash ?? fingerprint,
    frameFingerprints:
      overrides.frameFingerprints ?? (fingerprint ? [fingerprint] : []),
    status: overrides.status ?? 'ok',
    metrics: overrides.metrics ?? NEUTRAL_METRICS,
  };
}

describe('scanMediaLibrary', () => {
  beforeEach(() => {
    mediaLibraryApi.getAssetsAsync.mockReset();
    mediaLibraryApi.getAssetInfoAsync.mockReset();
    fileSystemApi.getInfoAsync.mockReset();
    visualAnalysisApi.analyzeVisualsForAsset.mockReset();
    appStorageApi.loadMediaAnalysisCache.mockReset();
    appStorageApi.loadFalsePositiveCandidateIds.mockReset();
    appStorageApi.saveMediaAnalysisCache.mockReset();

    mediaLibraryApi.getAssetsAsync.mockResolvedValue({
      assets: [],
      hasNextPage: false,
      endCursor: undefined,
    });
    mediaLibraryApi.getAssetInfoAsync.mockImplementation(async (asset: { id: string; uri: string }) => ({
      ...asset,
      localUri: asset.uri,
    }));
    fileSystemApi.getInfoAsync.mockResolvedValue({ exists: true, size: 3_600_000 });
    visualAnalysisApi.analyzeVisualsForAsset.mockResolvedValue({
      previewUri: 'file:///preview.jpg',
      fingerprint: null,
      status: 'ok',
      metrics: NEUTRAL_METRICS,
    });
    appStorageApi.loadMediaAnalysisCache.mockResolvedValue({});
    appStorageApi.loadFalsePositiveCandidateIds.mockResolvedValue([]);
    appStorageApi.saveMediaAnalysisCache.mockResolvedValue(undefined);
  });

  it('keeps recycle-bin items even when they score below the active candidate threshold', async () => {
    mediaLibraryApi.getAssetsAsync.mockResolvedValueOnce({
      assets: [
        createAsset('keep-in-recycle'),
        createAsset('high-risk', {
          uri: 'file:///high-risk.jpg',
          width: 720,
          height: 1280,
        }),
      ],
      hasNextPage: false,
      endCursor: undefined,
    });

    fileSystemApi.getInfoAsync.mockImplementation(async (uri: string) => ({
      exists: true,
      size: uri.includes('high-risk') ? 160_000 : 3_600_000,
    }));
    visualAnalysisApi.analyzeVisualsForAsset.mockImplementation(async (uri: string) => ({
      previewUri: uri,
      fingerprint: null,
      status: 'ok',
      metrics: uri.includes('high-risk')
        ? {
            brightness: 0.08,
            contrast: 0.05,
            edgeDensity: 0.04,
          }
        : {
            brightness: 0.55,
            contrast: 0.31,
            edgeDensity: 0.27,
          },
    }));

    const result = await scanMediaLibrary(['keep-in-recycle']);

    expect(result.state.recycleBin.map((candidate) => candidate.id)).toEqual(['keep-in-recycle']);
    expect(result.state.activeCandidates.map((candidate) => candidate.id)).toEqual(['high-risk']);
    expect(result.summary.recycleBinCount).toBe(1);
    expect(result.summary.candidateCount).toBe(2);
  });

  it('loads the whole album across pages when no scan limit is provided', async () => {
    mediaLibraryApi.getAssetsAsync
      .mockResolvedValueOnce({
        assets: Array.from({ length: 60 }, (_, index) => createAsset(`page-1-${index + 1}`)),
        hasNextPage: true,
        endCursor: 'cursor-1',
      })
      .mockResolvedValueOnce({
        assets: Array.from({ length: 25 }, (_, index) => createAsset(`page-2-${index + 1}`)),
        hasNextPage: false,
        endCursor: undefined,
      });

    const assets = await loadRecentScanAssets({ createdAfter: null });

    expect(mediaLibraryApi.getAssetsAsync).toHaveBeenCalledTimes(2);
    expect(mediaLibraryApi.getAssetsAsync).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        first: 60,
        after: undefined,
      }),
    );
    expect(mediaLibraryApi.getAssetsAsync).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        first: 60,
        after: 'cursor-1',
      }),
    );
    expect(assets).toHaveLength(85);
    expect(assets[0]?.id).toBe('page-1-1');
    expect(assets[84]?.id).toBe('page-2-25');
  });

  it('merges recent assets and recycle-bin recovery by id without duplicating counts', async () => {
    mediaLibraryApi.getAssetsAsync.mockResolvedValueOnce({
      assets: [createAsset('shared-id')],
      hasNextPage: false,
      endCursor: undefined,
    });

    const result = await scanMediaLibrary(['shared-id']);

    expect(mediaLibraryApi.getAssetInfoAsync).toHaveBeenCalledTimes(1);
    expect(result.summary.scannedCount).toBe(1);
    expect(result.state.recycleBin.map((candidate) => candidate.id)).toEqual(['shared-id']);
  });

  it('stops paging once the rolling scan window reaches older assets', async () => {
    mediaLibraryApi.getAssetsAsync
      .mockResolvedValueOnce({
        assets: [
          createAsset('recent-1', { creationTime: 1_710_000_000_000 }),
          createAsset('recent-2', { creationTime: 1_709_000_000_000 }),
          createAsset('older-1', { creationTime: 1_600_000_000_000 }),
        ],
        hasNextPage: true,
        endCursor: 'cursor-1',
      })
      .mockResolvedValueOnce({
        assets: [createAsset('older-2', { creationTime: 1_590_000_000_000 })],
        hasNextPage: false,
        endCursor: undefined,
      });

    const assets = await loadRecentScanAssets({
      createdAfter: 1_700_000_000_000,
    });

    expect(mediaLibraryApi.getAssetsAsync).toHaveBeenCalledTimes(1);
    expect(assets.map((asset) => asset.id)).toEqual(['recent-1', 'recent-2']);
  });

  it('skips newer assets that belong to a later batch when a backfill upper bound is provided', async () => {
    mediaLibraryApi.getAssetsAsync.mockResolvedValueOnce({
      assets: [
        createAsset('newer-1', { creationTime: 1_710_000_000_000 }),
        createAsset('window-1', { creationTime: 1_699_000_000_000 }),
        createAsset('window-2', { creationTime: 1_698_000_000_000 }),
        createAsset('older-1', { creationTime: 1_650_000_000_000 }),
      ],
      hasNextPage: false,
      endCursor: undefined,
    });

    const assets = await loadRecentScanAssets({
      createdAfter: 1_690_000_000_000,
      createdBefore: 1_700_000_000_000,
    });

    expect(assets.map((asset) => asset.id)).toEqual(['window-1', 'window-2']);
  });

  it('reports per-asset progress and a terminal completion state when a callback is provided', async () => {
    mediaLibraryApi.getAssetsAsync.mockResolvedValueOnce({
      assets: [createAsset('first'), createAsset('second')],
      hasNextPage: false,
      endCursor: undefined,
    });

    const onProgress = vi.fn();

    await scanMediaLibrary([], onProgress);

    expect(onProgress).toHaveBeenCalledTimes(3);
    expect(onProgress.mock.calls[0][0]).toMatchObject({
      current: 1,
      total: 2,
      currentFileName: 'first.jpg',
      isScanning: true,
      percentage: 50,
    });
    expect(onProgress.mock.calls[1][0]).toMatchObject({
      current: 2,
      total: 2,
      currentFileName: 'second.jpg',
      isScanning: true,
      percentage: 100,
    });
    expect(onProgress.mock.calls[2][0]).toMatchObject({
      current: 2,
      total: 2,
      currentFileName: 'second.jpg',
      isScanning: false,
      percentage: 100,
    });
  });

  it('falls back to cooperative yielding when no dedicated worker runtime is available', () => {
    expect(SCAN_ANALYSIS_EXECUTION_STRATEGY).toBe('cooperative-yield');
  });

  it('yields between analysis chunks so scanning does not monopolize the UI thread', async () => {
    mediaLibraryApi.getAssetsAsync.mockResolvedValueOnce({
      assets: [createAsset('first'), createAsset('second'), createAsset('third')],
      hasNextPage: false,
      endCursor: undefined,
    });

    const timeline: string[] = [];
    const yieldToMainThread = vi.fn(async () => {
      timeline.push('yield');
    });

    visualAnalysisApi.analyzeVisualsForAsset.mockImplementation(async (uri: string) => {
      timeline.push(uri);
      return {
        previewUri: uri,
        fingerprint: null,
        status: 'ok',
        metrics: {
          brightness: 0.56,
          contrast: 0.32,
          edgeDensity: 0.28,
        },
      };
    });

    await scanMediaLibrary([], {
      analysisConcurrency: 1,
      yieldToMainThread,
    });

    expect(yieldToMainThread).toHaveBeenCalledTimes(2);
    expect(timeline).toEqual([
      'file:///first.jpg',
      'yield',
      'file:///second.jpg',
      'yield',
      'file:///third.jpg',
    ]);
  });

  it('flushes analysis cache and emits durable checkpoints at chunk boundaries', async () => {
    mediaLibraryApi.getAssetsAsync.mockResolvedValueOnce({
      assets: [createAsset('first'), createAsset('second'), createAsset('third')],
      hasNextPage: false,
      endCursor: undefined,
    });

    const onCheckpoint = vi.fn();

    await scanMediaLibrary([], {
      analysisConcurrency: 1,
      onCheckpoint,
    });

    expect(appStorageApi.saveMediaAnalysisCache).toHaveBeenCalledTimes(3);
    expect(onCheckpoint).toHaveBeenNthCalledWith(1, {
      current: 1,
      total: 3,
      currentFileName: 'first.jpg',
      processedCount: 1,
      lastProcessedAssetId: 'first',
    });
    expect(onCheckpoint).toHaveBeenNthCalledWith(3, {
      current: 3,
      total: 3,
      currentFileName: 'third.jpg',
      processedCount: 3,
      lastProcessedAssetId: 'third',
    });
  });

  it('resumes after the last processed asset by hydrating cached analysis and scanning only the remainder', async () => {
    mediaLibraryApi.getAssetsAsync.mockResolvedValueOnce({
      assets: [createAsset('first'), createAsset('second'), createAsset('third')],
      hasNextPage: false,
      endCursor: undefined,
    });
    appStorageApi.loadMediaAnalysisCache.mockResolvedValueOnce({
      first: {
        assetId: 'first',
        signature: 'v1:photo:1710000000000:3024:4032:0:3600000',
        previewUri: 'file:///first-preview.jpg',
        fingerprint: null,
        frameFingerprints: [],
        status: 'ok',
        metrics: {
          brightness: 0.08,
          contrast: 0.05,
          edgeDensity: 0.04,
        },
      },
      second: {
        assetId: 'second',
        signature: 'v1:photo:1710000000000:3024:4032:0:3600000',
        previewUri: 'file:///second-preview.jpg',
        fingerprint: null,
        frameFingerprints: [],
        status: 'ok',
        metrics: {
          brightness: 0.08,
          contrast: 0.05,
          edgeDensity: 0.04,
        },
      },
    });
    visualAnalysisApi.analyzeVisualsForAsset.mockResolvedValueOnce({
      previewUri: 'file:///third-preview.jpg',
      fingerprint: null,
      status: 'ok',
      metrics: {
        brightness: 0.08,
        contrast: 0.05,
        edgeDensity: 0.04,
      },
    });

    const onProgress = vi.fn();

    const result = await scanMediaLibrary([], {
      onProgress,
      resumeAfterAssetId: 'second',
      analysisConcurrency: 1,
    });

    expect(visualAnalysisApi.analyzeVisualsForAsset).toHaveBeenCalledTimes(1);
    expect(visualAnalysisApi.analyzeVisualsForAsset).toHaveBeenCalledWith(
      'file:///third.jpg',
      'photo',
      0,
    );
    expect(onProgress.mock.calls[0][0]).toMatchObject({
      current: 2,
      total: 3,
      currentFileName: 'second.jpg',
      analyzedAssetId: 'second',
      isScanning: true,
    });
    expect(result.summary.scannedCount).toBe(3);
    expect(result.state.activeCandidates.map((candidate) => candidate.id)).toEqual([
      'first',
      'second',
      'third',
    ]);
  });

  it('reuses persisted asset analysis for unchanged assets', async () => {
    mediaLibraryApi.getAssetsAsync.mockResolvedValueOnce({
      assets: [
        createAsset('cached-photo', {
          width: 1179,
          height: 2556,
          creationTime: 1_710_000_000_000,
        }),
      ],
      hasNextPage: false,
      endCursor: undefined,
    });
    fileSystemApi.getInfoAsync.mockResolvedValueOnce({ exists: true, size: 1024 });
    appStorageApi.loadMediaAnalysisCache.mockResolvedValueOnce({
      'cached-photo': {
        assetId: 'cached-photo',
        signature: 'v1:photo:1710000000000:1179:2556:0:1024',
        previewUri: 'file:///cached-photo.jpg',
        fingerprint: null,
        frameFingerprints: [],
        status: 'ok',
        metrics: {
          brightness: 0.02,
          contrast: 0.01,
          edgeDensity: 0.01,
        },
      },
    });

    const result = await scanMediaLibrary([]);

    expect(visualAnalysisApi.analyzeVisualsForAsset).not.toHaveBeenCalled();
    expect(appStorageApi.saveMediaAnalysisCache).not.toHaveBeenCalled();
    expect(result.state.activeCandidates.map((candidate) => candidate.id)).toEqual([
      'cached-photo',
    ]);
  });

  it('rewrites legacy cached preview URIs to the original media URI without heavy re-analysis', async () => {
    mediaLibraryApi.getAssetsAsync.mockResolvedValueOnce({
      assets: [
        createAsset('legacy-preview-photo', {
          width: 1179,
          height: 2556,
          creationTime: 1_710_000_000_000,
        }),
      ],
      hasNextPage: false,
      endCursor: undefined,
    });
    fileSystemApi.getInfoAsync.mockResolvedValueOnce({ exists: true, size: 1024 });
    appStorageApi.loadMediaAnalysisCache.mockResolvedValueOnce({
      'legacy-preview-photo': {
        assetId: 'legacy-preview-photo',
        signature: 'v1:photo:1710000000000:1179:2556:0:1024',
        previewUri: 'file:///cache/ImageManipulator/legacy-temp.jpg',
        fingerprint: null,
        frameFingerprints: [],
        status: 'ok',
        metrics: {
          brightness: 0.02,
          contrast: 0.01,
          edgeDensity: 0.01,
        },
      },
    });

    const result = await scanMediaLibrary([]);

    expect(visualAnalysisApi.analyzeVisualsForAsset).not.toHaveBeenCalled();
    expect(result.state.activeCandidates[0]?.asset.previewUri).toBe(
      'file:///legacy-preview-photo.jpg',
    );
    expect(appStorageApi.saveMediaAnalysisCache).toHaveBeenCalledWith({
      'legacy-preview-photo': expect.objectContaining({
        previewUri: 'file:///legacy-preview-photo.jpg',
      }),
    });
  });

  it('re-analyzes assets whose cache signature no longer matches and persists the refreshed result', async () => {
    mediaLibraryApi.getAssetsAsync.mockResolvedValueOnce({
      assets: [createAsset('stale-photo')],
      hasNextPage: false,
      endCursor: undefined,
    });
    fileSystemApi.getInfoAsync.mockResolvedValueOnce({ exists: true, size: 3_600_000 });
    appStorageApi.loadMediaAnalysisCache.mockResolvedValueOnce({
      'stale-photo': {
        assetId: 'stale-photo',
        signature: 'v1:photo:1710000000000:3024:4032:0:111',
        previewUri: 'file:///stale-preview.jpg',
        fingerprint: 'old-fingerprint',
        frameFingerprints: ['old-fingerprint'],
        status: 'ok',
        metrics: {
          brightness: 0.5,
          contrast: 0.2,
          edgeDensity: 0.2,
        },
      },
    });

    await scanMediaLibrary([]);

    expect(visualAnalysisApi.analyzeVisualsForAsset).toHaveBeenCalledTimes(1);
    expect(appStorageApi.saveMediaAnalysisCache).toHaveBeenCalledWith({
      'stale-photo': expect.objectContaining({
        assetId: 'stale-photo',
        signature: 'v1:photo:1710000000000:3024:4032:0:3600000',
        previewUri: 'file:///stale-photo.jpg',
        status: 'ok',
      }),
    });
  });

  it('keeps identical photos in one duplicate group even if one analysis falls back without a perceptual fingerprint', async () => {
    mediaLibraryApi.getAssetsAsync.mockResolvedValueOnce({
      assets: [
        createAsset('identical-keep'),
        createAsset('identical-dup'),
      ],
      hasNextPage: false,
      endCursor: undefined,
    });
    fileSystemApi.getInfoAsync
      .mockResolvedValueOnce({ exists: true, size: 4_200_000, md5: 'identical-photo-md5' })
      .mockResolvedValueOnce({ exists: true, size: 4_200_000, md5: 'identical-photo-md5' });
    visualAnalysisApi.analyzeVisualsForAsset
      .mockResolvedValueOnce({
        previewUri: 'file:///identical-keep.jpg',
        fingerprint: 'f0f0f0f0f0f0f0f0',
        status: 'ok',
        metrics: {
          brightness: 0.5,
          contrast: 0.2,
          edgeDensity: 0.18,
        },
      })
      .mockResolvedValueOnce({
        previewUri: 'file:///identical-dup.jpg',
        fingerprint: null,
        status: 'fallback',
        metrics: {
          brightness: 0.5,
          contrast: 0.2,
          edgeDensity: 0.18,
        },
      });

    const result = await scanMediaLibrary([]);

    expect(result.state.activeCandidates).toHaveLength(1);
    expect(result.state.activeCandidates[0]?.id).toBe('identical-dup');
    expect(result.state.activeCandidates[0]?.duplicateGroup?.size).toBe(2);
  });

  it('surfaces near-similar photos that are slightly beyond the current strict near-duplicate threshold', async () => {
    mediaLibraryApi.getAssetsAsync.mockResolvedValueOnce({
      assets: [
        createAsset('similar-keep'),
        createAsset('similar-dup', {
          width: 3000,
          height: 4000,
        }),
      ],
      hasNextPage: false,
      endCursor: undefined,
    });
    fileSystemApi.getInfoAsync
      .mockResolvedValueOnce({ exists: true, size: 4_200_000 })
      .mockResolvedValueOnce({ exists: true, size: 4_050_000 });
    visualAnalysisApi.analyzeVisualsForAsset
      .mockResolvedValueOnce({
        previewUri: 'file:///similar-keep.jpg',
        fingerprint: 'ffffffffffffffff',
        status: 'ok',
        metrics: {
          brightness: 0.52,
          contrast: 0.21,
          edgeDensity: 0.18,
        },
      })
      .mockResolvedValueOnce({
        previewUri: 'file:///similar-dup.jpg',
        fingerprint: 'ff0fffffffffff0f',
        status: 'ok',
        metrics: {
          brightness: 0.51,
          contrast: 0.2,
          edgeDensity: 0.17,
        },
      });

    const result = await scanMediaLibrary([]);

    expect(result.state.activeCandidates).toHaveLength(1);
    expect(result.state.activeCandidates[0]?.id).toBe('similar-dup');
    expect(result.state.activeCandidates[0]?.duplicateGroup?.relation).toBe('near');
    expect(result.summary.candidateCount).toBe(1);
  });

  it('BDD: Given 两张完全相同的照片且其中一张首次分析 fallback, when 扫描, then 仍应通过兜底形成重复组并给出正确组数量', async () => {
    mediaLibraryApi.getAssetsAsync.mockResolvedValueOnce({
      assets: [createAsset('fallback-exact-a'), createAsset('fallback-exact-b')],
      hasNextPage: false,
      endCursor: undefined,
    });
    fileSystemApi.getInfoAsync
      .mockResolvedValueOnce({ exists: true, size: 4_200_000, md5: 'fallback-exact-md5' })
      .mockResolvedValueOnce({ exists: true, size: 4_200_000, md5: 'fallback-exact-md5' });

    visualAnalysisApi.analyzeVisualsForAsset.mockImplementation(async (uri: string) => {
      if (uri.includes('fallback-exact-a')) {
        return createVisualAnalysisResult(null, {
          previewUri: uri,
          status: 'fallback',
          metrics: NEUTRAL_METRICS,
        });
      }

      return createVisualAnalysisResult('0000000000000000', {
        previewUri: uri,
      });
    });

    const result = await scanMediaLibrary([]);

    expect(result.state.activeCandidates).toHaveLength(1);
    expect(result.state.activeCandidates[0]?.primaryIssueType).toBe('duplicate');
    expect(result.state.activeCandidates[0]?.duplicateGroup?.size).toBe(2);
  });

  it('BDD: Given 两张相似但不完全重复的照片, when 扫描, then 应形成可浏览的近重复结果组', async () => {
    mediaLibraryApi.getAssetsAsync.mockResolvedValueOnce({
      assets: [
        createAsset('similar-photo-a', {
          width: 1170,
          height: 2532,
          fileSize: 2_900_000,
        }),
        createAsset('similar-photo-b', {
          width: 1170,
          height: 2532,
          fileSize: 2_700_000,
          creationTime: 1_710_000_010_000,
        }),
      ],
      hasNextPage: false,
      endCursor: undefined,
    });

    visualAnalysisApi.analyzeVisualsForAsset.mockImplementation(async (uri: string) => {
      if (uri.includes('similar-photo-a')) {
        return createVisualAnalysisResult('0000000000000000', {
          previewUri: uri,
        });
      }

      return createVisualAnalysisResult('000000000000000f', {
        previewUri: uri,
      });
    });

    const result = await scanMediaLibrary([]);

    expect(result.state.activeCandidates).toHaveLength(1);
    expect(result.state.activeCandidates[0]?.issueTypes).toContain('duplicate');
    expect(result.state.activeCandidates[0]?.duplicateGroup?.size).toBe(2);
    expect(
      result.state.activeCandidates[0]?.reasons.some((reason) => reason.includes('近似')),
    ).toBe(true);
  });

  it('BDD: Given 两张不同风景图仅在平均色调上接近, when 扫描, then 不应被识别为重复或相似组', async () => {
    mediaLibraryApi.getAssetsAsync.mockResolvedValueOnce({
      assets: [
        createAsset('landscape-a', {
          width: 4032,
          height: 3024,
          fileSize: 4_200_000,
        }),
        createAsset('landscape-b', {
          width: 4032,
          height: 3024,
          fileSize: 4_050_000,
          creationTime: 1_710_000_010_000,
        }),
      ],
      hasNextPage: false,
      endCursor: undefined,
    });

    visualAnalysisApi.analyzeVisualsForAsset.mockImplementation(async (uri: string) => {
      if (uri.includes('landscape-a')) {
        return createVisualAnalysisResult('f0f0f0f0f0f0f0f0', {
          previewUri: uri,
          differenceHash: '00000000ffffffff',
          metrics: {
            brightness: 0.58,
            contrast: 0.19,
            edgeDensity: 0.18,
          },
        });
      }

      return createVisualAnalysisResult('f0f0f0f0f0f0f0f1', {
        previewUri: uri,
        differenceHash: 'ffffffff00000000',
        metrics: {
          brightness: 0.57,
          contrast: 0.18,
          edgeDensity: 0.17,
        },
      });
    });

    const result = await scanMediaLibrary([]);

    expect(result.state.activeCandidates).toHaveLength(0);
    expect(result.summary.candidateCount).toBe(0);
  });

  it('BDD: Given 重复对跨过旧的默认扫描上限, when 扫描整个相册, then 旧上限后的媒体也必须继续参与识别', async () => {
    const leadingDuplicate = createAsset('limit-duplicate-a', {
      creationTime: 1_710_000_500_000,
    });
    const fillerAssets = Array.from({ length: 359 }, (_, index) =>
      createAsset(`filler-${index + 1}`, {
        creationTime: 1_710_000_499_000 - index,
      }),
    );
    const trailingDuplicate = createAsset('limit-duplicate-b', {
      creationTime: 1_709_999_000_000,
    });
    const allAssets = [leadingDuplicate, ...fillerAssets, trailingDuplicate];

    mediaLibraryApi.getAssetsAsync.mockImplementation(
      async ({ first, after }: { first: number; after?: string }) => {
        const start = after ? Number.parseInt(after, 10) : 0;
        const end = start + first;

        return {
          assets: allAssets.slice(start, end),
          hasNextPage: end < allAssets.length,
          endCursor: end < allAssets.length ? String(end) : undefined,
        };
      },
    );

    visualAnalysisApi.analyzeVisualsForAsset.mockImplementation(async (uri: string) => {
      if (uri.includes('limit-duplicate-a') || uri.includes('limit-duplicate-b')) {
        return createVisualAnalysisResult('1111111111111111', {
          previewUri: uri,
        });
      }

      return createVisualAnalysisResult(null, {
        previewUri: uri,
      });
    });

    const result = await scanMediaLibrary([]);

    expect(result.state.activeCandidates).toHaveLength(1);
    expect(result.state.activeCandidates[0]?.duplicateGroup?.groupId).toBeTruthy();
    expect(result.summary.scannedCount).toBe(361);
  });

  it('reuses reviewed decisions so kept items and cached recycle-bin items skip heavy analysis on later scans', async () => {
    mediaLibraryApi.getAssetsAsync.mockResolvedValueOnce({
      assets: [
        createAsset('kept-photo'),
        createAsset('recycle-photo'),
        createAsset('fresh-photo', {
          width: 720,
          height: 1280,
        }),
      ],
      hasNextPage: false,
      endCursor: undefined,
    });

    visualAnalysisApi.analyzeVisualsForAsset.mockResolvedValueOnce({
      previewUri: 'file:///fresh-photo.jpg',
      fingerprint: null,
      status: 'ok',
      metrics: {
        brightness: 0.08,
        contrast: 0.05,
        edgeDensity: 0.04,
      },
    });

    const result = await scanMediaLibrary(['recycle-photo'], {
      falsePositiveIds: ['kept-photo'],
      recycleBinCandidateCache: [
        {
          id: 'recycle-photo',
          asset: {
            id: 'recycle-photo',
            uri: 'file:///recycle-photo.jpg',
            previewUri: 'file:///recycle-photo-preview.jpg',
            mediaType: 'photo',
            width: 1080,
            height: 1440,
            duration: 0,
            fileSize: 680_000,
            creationTime: 1_710_000_000_000,
          },
          score: 88,
          confidence: 'high',
          kind: 'duplicate-photo',
          primaryIssueType: 'duplicate',
          issueTypes: ['duplicate'],
          reasons: ['已移入回收站'],
          duplicateGroup: {
            groupId: 'recycle-group',
            representativeId: 'recycle-keep',
            relation: 'exact',
            size: 2,
            similarity: 0.98,
            representativeReason: 'higher-resolution',
            representativeWidth: 3024,
            representativeHeight: 4032,
            representativeFileSize: 4_200_000,
            representativeCreationTime: 1_709_999_000_000,
          },
        },
      ],
    });

    expect(visualAnalysisApi.analyzeVisualsForAsset).toHaveBeenCalledTimes(1);
    expect(result.state.activeCandidates.map((candidate) => candidate.id)).toEqual(['fresh-photo']);
    expect(result.state.recycleBin.map((candidate) => candidate.id)).toEqual(['recycle-photo']);
    expect(result.summary.candidateCount).toBe(2);
  });

  it('skips previously kept assets when filling the default 360-item scan window so newer candidates can enter later pages', async () => {
    const keptAssets = Array.from({ length: 360 }, (_, index) =>
      createAsset(`kept-${index + 1}`, {
        creationTime: 1_710_100_000_000 - index,
      }),
    );
    const freshAssets = Array.from({ length: 2 }, (_, index) =>
      createAsset(`fresh-${index + 1}`, {
        creationTime: 1_710_099_000_000 - index,
      }),
    );
    const allAssets = [...keptAssets, ...freshAssets];

    mediaLibraryApi.getAssetsAsync.mockImplementation(
      async ({ first, after }: { first: number; after?: string }) => {
        const start = after ? Number.parseInt(after, 10) : 0;
        const end = start + first;

        return {
          assets: allAssets.slice(start, end),
          hasNextPage: end < allAssets.length,
          endCursor: end < allAssets.length ? String(end) : undefined,
        };
      },
    );
    appStorageApi.loadFalsePositiveCandidateIds.mockResolvedValueOnce(
      keptAssets.map((asset) => asset.id),
    );

    const result = await scanMediaLibrary([]);

    expect(mediaLibraryApi.getAssetsAsync).toHaveBeenCalledTimes(7);
    expect(visualAnalysisApi.analyzeVisualsForAsset).toHaveBeenCalledTimes(2);
    expect(result.summary.scannedCount).toBe(2);
  });
});
