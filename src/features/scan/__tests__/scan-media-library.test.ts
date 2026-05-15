import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: <T,>(options: { ios?: T; android?: T; default?: T }) =>
      options.ios ?? options.default,
  },
  NativeModules: {},
  PixelRatio: {
    get: () => 1,
  },
  TurboModuleRegistry: {
    get: vi.fn(() => null),
  },
}));

vi.mock('expo-media-library', () => ({
  MediaType: {
    photo: 'photo',
    video: 'video',
  },
  SortBy: {
    creationTime: 'creationTime',
  },
  getAssetsAsync: vi.fn(),
  getAssetInfoAsync: vi.fn(),
}));

vi.mock('expo-file-system/legacy', () => ({
  default: {},
}));

vi.mock('../../../services/media/analyze-visuals', () => ({
  analyzeVisualsForAsset: vi.fn(),
}));

vi.mock('../../../services/storage/app-storage', () => ({
  loadFalsePositiveCandidateIds: vi.fn(),
  loadMediaAnalysisCache: vi.fn(),
  saveMediaAnalysisCache: vi.fn(),
}));

import * as MediaLibrary from 'expo-media-library';
import { analyzeVisualsForAsset } from '../../../services/media/analyze-visuals';
import {
  loadFalsePositiveCandidateIds,
  loadMediaAnalysisCache,
  saveMediaAnalysisCache,
} from '../../../services/storage/app-storage';
import { buildScanOutputFromAnalyzedInputs, scanMediaLibrary } from '../scan-media-library';

function createAnalyzedInput(id: string) {
  return {
    asset: {
      id,
      uri: `file:///${id}.jpg`,
      previewUri: `file:///${id}.jpg`,
      mediaType: 'photo' as const,
      width: 640,
      height: 640,
      duration: 0,
      fileSize: 80_000,
      creationTime: 1_710_000_000_000,
    },
    metrics: {
      brightness: 0.03,
      contrast: 0.04,
      edgeDensity: 0.02,
    },
    fingerprint: null,
    analysisStatus: 'ok' as const,
  };
}

function createCachedRecycleCandidate(id: string) {
  return {
    id,
    asset: {
      id,
      uri: `file:///${id}.jpg`,
      previewUri: `file:///${id}.jpg`,
      mediaType: 'photo' as const,
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

function createMediaAsset(id: string) {
  return {
    id,
    filename: `${id}.jpg`,
    uri: `file:///${id}.jpg`,
    mediaType: MediaLibrary.MediaType.photo,
    width: 640,
    height: 640,
    duration: 0,
    creationTime: 1_710_000_000_000,
    modificationTime: 1_710_000_000_000,
  };
}

describe('buildScanOutputFromAnalyzedInputs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reassembles the scan output from analyzed inputs and preserves recycle-bin caching rules', () => {
    const output = buildScanOutputFromAnalyzedInputs(
      [createAnalyzedInput('photo-1'), createAnalyzedInput('recycle-1')],
      ['recycle-1'],
      {
        falsePositiveIds: ['photo-1'],
        recycleBinCandidateCache: [
          {
            id: 'recycle-1',
            asset: {
              id: 'recycle-1',
              uri: 'file:///recycle-1.jpg',
              previewUri: 'file:///recycle-1.jpg',
              mediaType: 'photo',
              width: 640,
              height: 640,
              duration: 0,
              fileSize: 80_000,
              creationTime: 1_710_000_000_000,
            },
            score: 90,
            confidence: 'high',
            kind: 'abnormal-photo',
            primaryIssueType: 'abnormal',
            issueTypes: ['abnormal'],
            reasons: ['测试命中'],
          },
        ],
        scannedAt: 1_710_000_000_999,
        scannedCount: 2,
      },
    );

    expect(output.summary.scannedAt).toBe(1_710_000_000_999);
    expect(output.summary.scannedCount).toBe(2);
    expect(output.state.activeCandidates).toHaveLength(0);
    expect(output.state.recycleBin).toHaveLength(1);
    expect(output.summary.recycleBinCount).toBe(1);
  });

  it('keeps existing recycle-bin ids separate from newly recognized scan results', () => {
    const recycleBinIds = Array.from({ length: 9 }, (_, index) => `recycle-${index + 1}`);
    const output = buildScanOutputFromAnalyzedInputs(
      [
        createAnalyzedInput('new-cleanup-1'),
        createAnalyzedInput('new-cleanup-2'),
        createAnalyzedInput('recycle-1'),
      ],
      recycleBinIds,
      {
        recycleBinCandidateCache: recycleBinIds.map(createCachedRecycleCandidate),
        scannedAt: 1_710_000_000_999,
        scannedCount: 11,
      },
    );

    expect(output.state.activeCandidates.map((candidate) => candidate.id)).toEqual([
      'new-cleanup-1',
      'new-cleanup-2',
    ]);
    expect(output.state.recycleBin.map((candidate) => candidate.id).sort()).toEqual(recycleBinIds);
    expect(output.summary.recycleBinCount).toBe(9);
  });
});

describe('scanMediaLibrary recycle-bin exclusion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadFalsePositiveCandidateIds).mockResolvedValue([]);
    vi.mocked(loadMediaAnalysisCache).mockResolvedValue({});
    vi.mocked(MediaLibrary.getAssetInfoAsync).mockRejectedValue(new Error('Unexpected pinned lookup'));
  });

  it('does not reanalyze cached recycle-bin ids during a later scan', async () => {
    const recycleBinIds = Array.from({ length: 9 }, (_, index) => `recycle-${index + 1}`);
    vi.mocked(MediaLibrary.getAssetsAsync).mockResolvedValueOnce({
      assets: recycleBinIds.map(createMediaAsset),
      endCursor: '',
      hasNextPage: false,
      totalCount: recycleBinIds.length,
    });

    const output = await scanMediaLibrary(recycleBinIds, {
      recycleBinCandidateCache: recycleBinIds.map(createCachedRecycleCandidate),
      yieldToMainThread: async () => {},
    });

    expect(analyzeVisualsForAsset).not.toHaveBeenCalled();
    expect(saveMediaAnalysisCache).not.toHaveBeenCalled();
    expect(output.state.activeCandidates).toEqual([]);
    expect(output.state.recycleBin.map((candidate) => candidate.id).sort()).toEqual(recycleBinIds);
    expect(output.summary.recycleBinCount).toBe(9);
  });
});
