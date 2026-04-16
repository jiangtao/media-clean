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

vi.mock('expo-media-library', () => mediaLibraryApi);
vi.mock('expo-file-system/legacy', () => fileSystemApi);
vi.mock('../../services/media/analyze-visuals', () => visualAnalysisApi);

import { scanMediaLibrary } from './scan-media-library';

function createAsset(id: string, overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id,
    uri: `file:///${id}.jpg`,
    mediaType: mediaLibraryApi.MediaType.photo,
    width: 3024,
    height: 4032,
    duration: 0,
    creationTime: 1_710_000_000_000,
    ...overrides,
  };
}

describe('scanMediaLibrary', () => {
  beforeEach(() => {
    mediaLibraryApi.getAssetsAsync.mockReset();
    mediaLibraryApi.getAssetInfoAsync.mockReset();
    fileSystemApi.getInfoAsync.mockReset();
    visualAnalysisApi.analyzeVisualsForAsset.mockReset();

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
      metrics: {
        brightness: 0.56,
        contrast: 0.32,
        edgeDensity: 0.28,
      },
    });
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
});
