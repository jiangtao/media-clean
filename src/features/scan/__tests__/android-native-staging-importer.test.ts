import { describe, expect, it } from 'vitest';

import type { AnalyzedMediaInput } from '../../../domain/recognition/scoring';
import type { CleanupCandidate } from '../../../domain/recognition/types';
import {
  buildAndroidNativeStagingChunkKey,
  createAndroidNativeStagingImporter,
} from '../android-native-staging-importer';

function createCleanupCandidate(
  id: string,
  mediaType: 'photo' | 'video' = 'photo',
): CleanupCandidate {
  return {
    id,
    asset: {
      id,
      uri: `file:///${id}.${mediaType === 'video' ? 'mp4' : 'jpg'}`,
      previewUri:
        mediaType === 'video'
          ? `file:///${id}-preview.jpg`
          : `file:///${id}.jpg`,
      mediaType,
      width: mediaType === 'video' ? 1920 : 3024,
      height: mediaType === 'video' ? 1080 : 4032,
      duration: mediaType === 'video' ? 12 : 0,
      fileSize: mediaType === 'video' ? 2_400_000 : 280_000,
      creationTime: 1_710_000_000_000,
    },
    score: 82,
    confidence: 'high',
    kind: mediaType === 'video' ? 'abnormal-video' : 'abnormal-photo',
    primaryIssueType: 'abnormal',
    issueTypes: ['abnormal'],
    reasons: ['测试命中'],
  };
}

function createAnalyzedInput(
  id: string,
  options: {
    brightness?: number;
    contrast?: number;
    edgeDensity?: number;
  } = {},
): AnalyzedMediaInput {
  return {
    asset: {
      id,
      uri: `file:///${id}.jpg`,
      previewUri: `file:///${id}.jpg`,
      mediaType: 'photo',
      width: 640,
      height: 640,
      duration: 0,
      fileSize: 80_000,
      creationTime: 1_710_000_000_000,
    },
    metrics: {
      brightness: options.brightness ?? 0.03,
      contrast: options.contrast ?? 0.04,
      edgeDensity: options.edgeDensity ?? 0.02,
    },
    fingerprint: null,
    analysisStatus: 'ok',
  };
}

describe('android native staging importer', () => {
  it('imports a chunk only once and keeps repeated chunk imports idempotent', () => {
    const importer = createAndroidNativeStagingImporter({
      sourceCandidates: [
        createCleanupCandidate('photo-1'),
        createCleanupCandidate('photo-2'),
        createCleanupCandidate('photo-3'),
      ],
      falsePositiveIds: [],
    });

    const checkpoint = {
      current: 2,
      total: 3,
      currentFileName: 'IMG_002.jpg',
      processedCount: 2,
      lastProcessedAssetId: 'photo-2',
      analyzedInputs: [
        createAnalyzedInput('photo-1', {
          brightness: 0.56,
          contrast: 0.32,
          edgeDensity: 0.28,
        }),
        createAnalyzedInput('photo-2'),
      ],
    };

    const firstImport = importer.importCheckpoint(checkpoint);
    const secondImport = importer.importCheckpoint(checkpoint);

    expect(buildAndroidNativeStagingChunkKey(checkpoint)).toBe('2:photo-2:0');
    expect(firstImport.didImport).toBe(true);
    expect(firstImport.visibleCandidates).toHaveLength(2);
    expect(firstImport.scopeSelection).toEqual({
      total: 2,
      photo: 2,
      video: 0,
    });
    expect(secondImport.didImport).toBe(false);
    expect(secondImport.visibleCandidates).toEqual(firstImport.visibleCandidates);
  });

  it('does not hide a source candidate when progress only reports the asset id and no analyzed payload arrived yet', () => {
    const importer = createAndroidNativeStagingImporter({
      sourceCandidates: [
        createCleanupCandidate('photo-1'),
        createCleanupCandidate('photo-2'),
      ],
      falsePositiveIds: [],
    });

    importer.recordProgress({
      analyzedAssetId: 'photo-1',
      analyzedInput: null,
    });

    const imported = importer.importCheckpoint({
      current: 1,
      total: 2,
      currentFileName: 'IMG_001.jpg',
      processedCount: 1,
      lastProcessedAssetId: 'photo-1',
      analyzedInputs: [],
    });

    expect(imported.didImport).toBe(true);
    expect(imported.visibleCandidates.map((candidate) => candidate.id)).toEqual([
      'photo-1',
      'photo-2',
    ]);
  });

  it('re-imports the same checkpoint progress when a new analyzed payload arrives later', () => {
    const importer = createAndroidNativeStagingImporter({
      sourceCandidates: [
        createCleanupCandidate('photo-1'),
        createCleanupCandidate('photo-2'),
      ],
      falsePositiveIds: [],
    });

    const checkpoint = {
      current: 1,
      total: 2,
      currentFileName: 'IMG_001.jpg',
      processedCount: 1,
      lastProcessedAssetId: 'photo-1',
      analyzedInputs: [] as AnalyzedMediaInput[],
    };

    const firstImport = importer.importCheckpoint(checkpoint);
    importer.recordProgress({
      analyzedAssetId: 'photo-1',
      analyzedInput: createAnalyzedInput('photo-1'),
    });
    const secondImport = importer.importCheckpoint(checkpoint);

    expect(firstImport.chunkKey).toBe('1:photo-1:0');
    expect(secondImport.didImport).toBe(true);
    expect(secondImport.chunkKey).toBe('1:photo-1:1');
    expect(secondImport.visibleCandidates.map((candidate) => candidate.id)).toEqual(['photo-1', 'photo-2']);
  });
});
