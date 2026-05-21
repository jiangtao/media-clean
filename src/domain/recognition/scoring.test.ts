import { describe, expect, it } from 'vitest';

import {
  buildCleanupCandidates,
  classifyAbnormalMedia,
  classifyAccidentalMedia,
  sortCandidatesByScore,
} from './scoring';
import { RECOGNITION_REASON } from './reasons';
import type { MediaAssetSnapshot } from './types';

const R = RECOGNITION_REASON;

const baseAsset: MediaAssetSnapshot = {
  id: 'asset-1',
  uri: 'file:///asset-1.jpg',
  mediaType: 'photo',
  width: 720,
  height: 1280,
  duration: 0,
  fileSize: 180_000,
  creationTime: 1_710_000_000_000,
};

describe('classifyAccidentalMedia', () => {
  it('marks a dark blurry photo as a strong accidental candidate', () => {
    const result = classifyAccidentalMedia(baseAsset, {
      brightness: 0.08,
      contrast: 0.05,
      edgeDensity: 0.04,
    });

    expect(result.kind).toBe('accidental-photo');
    expect(result.confidence).toBe('high');
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.reasons).toEqual(
      expect.arrayContaining([R.frameVeryDark, R.lowEdgeDetail, R.smallFile]),
    );
  });

  it('treats a moderately blurry gray-dark photo as an actionable accidental candidate', () => {
    const result = classifyAccidentalMedia(
      {
        ...baseAsset,
        id: 'asset-medium-blur-dark',
        uri: 'file:///asset-medium-blur-dark.jpg',
        width: 3024,
        height: 4032,
        fileSize: 2_800_000,
      },
      {
        brightness: 0.2,
        contrast: 0.08,
        edgeDensity: 0.095,
      },
    );

    expect(result.kind).toBe('accidental-photo');
    expect(result.confidence).not.toBe('low');
    expect(result.score).toBeGreaterThanOrEqual(55);
    expect(result.reasons).toEqual(expect.arrayContaining([R.lowEdgeDetail]));
  });

  it('marks a short dark video as a strong accidental candidate', () => {
    const result = classifyAccidentalMedia(
      {
        ...baseAsset,
        id: 'asset-2',
        uri: 'file:///asset-2.mp4',
        mediaType: 'video',
        duration: 1.8,
        fileSize: 2_400_000,
      },
      {
        brightness: 0.12,
        contrast: 0.08,
        edgeDensity: 0.06,
      },
    );

    expect(result.kind).toBe('accidental-video');
    expect(result.confidence).toBe('high');
    expect(result.score).toBeGreaterThanOrEqual(85);
    expect(result.reasons).toEqual(
      expect.arrayContaining([R.videoExtremelyShort, R.thumbnailVeryDark]),
    );
  });

  it('keeps normal media below candidate threshold', () => {
    const result = classifyAccidentalMedia(
      {
        ...baseAsset,
        id: 'asset-3',
        uri: 'file:///asset-3.jpg',
        fileSize: 5_400_000,
        width: 3024,
        height: 4032,
      },
      {
        brightness: 0.56,
        contrast: 0.34,
        edgeDensity: 0.28,
      },
    );

    expect(result.confidence).toBe('low');
    expect(result.score).toBeLessThan(55);
    expect(result.reasons).toHaveLength(0);
  });

  it('does not treat an unknown file size as a small-file risk reason', () => {
    const result = classifyAccidentalMedia(
      {
        ...baseAsset,
        id: 'asset-4',
        uri: 'file:///asset-4.jpg',
        fileSize: 0,
      },
      {
        brightness: 0.56,
        contrast: 0.34,
        edgeDensity: 0.28,
      },
    );

    expect(result.reasons).not.toContain(R.smallFile);
  });

  it('marks a moderately dim blurry photo as actionable even when it is not an extreme dark frame', () => {
    const result = classifyAccidentalMedia(
      {
        ...baseAsset,
        id: 'asset-moderate-blur',
        uri: 'file:///asset-moderate-blur.jpg',
        width: 1920,
        height: 1080,
        fileSize: 980_000,
      },
      {
        brightness: 0.22,
        contrast: 0.09,
        edgeDensity: 0.08,
      },
    );

    expect(result.score).toBeGreaterThanOrEqual(55);
    expect(result.confidence).not.toBe('low');
    expect(result.reasons).toEqual(
      expect.arrayContaining([R.frameVeryDark, R.lowEdgeDetail]),
    );
  });

  it('sorts candidates by descending score and creation time', () => {
    const sorted = sortCandidatesByScore([
      {
        id: 'b',
        asset: { ...baseAsset, id: 'b', creationTime: 2 },
        score: 72,
        confidence: 'medium',
        kind: 'accidental-photo',
        primaryIssueType: 'accidental',
        issueTypes: ['accidental'],
        reasons: [R.frameVeryDark],
      },
      {
        id: 'a',
        asset: { ...baseAsset, id: 'a', creationTime: 5 },
        score: 88,
        confidence: 'high',
        kind: 'accidental-video',
        primaryIssueType: 'accidental',
        issueTypes: ['accidental'],
        reasons: [R.videoExtremelyShort],
      },
      {
        id: 'c',
        asset: { ...baseAsset, id: 'c', creationTime: 7 },
        score: 72,
        confidence: 'medium',
        kind: 'accidental-photo',
        primaryIssueType: 'accidental',
        issueTypes: ['accidental'],
        reasons: [R.smallFile],
      },
    ]);

    expect(sorted.map((item) => item.id)).toEqual(['a', 'c', 'b']);
  });
});

describe('classifyAbnormalMedia', () => {
  it('marks an extremely short dark video as abnormal media', () => {
    const result = classifyAbnormalMedia(
      {
        ...baseAsset,
        id: 'abnormal-video',
        uri: 'file:///abnormal-video.mp4',
        mediaType: 'video',
        duration: 0.9,
        width: 480,
        height: 854,
        fileSize: 720_000,
      },
      {
        brightness: 0.04,
        contrast: 0.03,
        edgeDensity: 0.02,
      },
    );

    expect(result.kind).toBe('abnormal-video');
    expect(result.primaryIssueType).toBe('abnormal');
    expect(result.issueTypes).toEqual(['abnormal']);
    expect(result.confidence).toBe('high');
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.reasons).toEqual(
      expect.arrayContaining([R.mediaDurationTooShort, R.thumbnailNearlyBlack]),
    );
  });

  it('treats a near-solid low-information photo as an actionable abnormal candidate', () => {
    const result = classifyAbnormalMedia(
      {
        ...baseAsset,
        id: 'abnormal-flat-photo',
        uri: 'file:///abnormal-flat-photo.jpg',
        width: 1170,
        height: 2532,
        fileSize: 860_000,
      },
      {
        brightness: 0.52,
        contrast: 0.03,
        edgeDensity: 0.01,
      },
    );

    expect(result.kind).toBe('abnormal-photo');
    expect(result.primaryIssueType).toBe('abnormal');
    expect(result.confidence).not.toBe('low');
    expect(result.score).toBeGreaterThanOrEqual(55);
    expect(result.reasons).toEqual(expect.arrayContaining([R.noVisibleContent]));
  });
});

describe('buildCleanupCandidates', () => {
  it('marks a flat low-information photo as an actionable low-quality candidate', () => {
    const result = buildCleanupCandidates([
      {
        asset: {
          ...baseAsset,
          id: 'flat-photo',
          uri: 'file:///flat-photo.jpg',
          width: 1600,
          height: 1600,
          fileSize: 1_100_000,
        },
        metrics: {
          brightness: 0.48,
          contrast: 0.05,
          edgeDensity: 0.03,
        },
        fingerprint: '8888888888888888',
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('flat-photo');
    expect(result[0]?.score).toBeGreaterThanOrEqual(55);
    expect(result[0]?.reasons).toEqual(
      expect.arrayContaining([R.noVisibleContent]),
    );
  });

  it('flags fallback analysis with broken metadata as abnormal media', () => {
    const result = buildCleanupCandidates([
      {
        asset: {
          ...baseAsset,
          id: 'fallback-photo',
          uri: 'file:///fallback-photo.jpg',
          width: 0,
          height: 0,
          fileSize: 0,
        },
        metrics: {
          brightness: 0.5,
          contrast: 0.2,
          edgeDensity: 0.2,
        },
        fingerprint: null,
        analysisStatus: 'fallback',
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('fallback-photo');
    expect(result[0]?.primaryIssueType).toBe('abnormal');
    expect(result[0]?.issueTypes).toContain('abnormal');
    expect(result[0]?.score).toBeGreaterThanOrEqual(80);
    expect(result[0]?.reasons).toEqual(
      expect.arrayContaining([
        R.mediaAnalysisFailed,
        R.emptyMediaFile,
        R.invalidMediaMetadata,
      ]),
    );
  });

  it('keeps one best-quality photo and flags the redundant duplicates', () => {
    const result = buildCleanupCandidates([
      {
        asset: {
          ...baseAsset,
          id: 'keep',
          uri: 'file:///keep.jpg',
          width: 3024,
          height: 4032,
          fileSize: 4_200_000,
          creationTime: 3,
        },
        metrics: {
          brightness: 0.51,
          contrast: 0.19,
          edgeDensity: 0.18,
        },
        fingerprint: 'f0f0f0f0f0f0f0f0',
        contentHash: 'exact-photo-hash',
      },
      {
        asset: {
          ...baseAsset,
          id: 'dup-a',
          uri: 'file:///dup-a.jpg',
          width: 1080,
          height: 1440,
          fileSize: 680_000,
          creationTime: 9,
        },
        metrics: {
          brightness: 0.5,
          contrast: 0.18,
          edgeDensity: 0.17,
        },
        fingerprint: 'f0f0f0f0f0f0f0f0',
      },
      {
        asset: {
          ...baseAsset,
          id: 'dup-b',
          uri: 'file:///dup-b.jpg',
          width: 720,
          height: 960,
          fileSize: 320_000,
          creationTime: 12,
        },
        metrics: {
          brightness: 0.49,
          contrast: 0.17,
          edgeDensity: 0.16,
        },
        fingerprint: 'f0f0f0f0f0f0f0f1',
      },
    ]);

    expect(result.map((candidate) => candidate.id)).toEqual(['dup-b', 'dup-a']);
    expect(result.every((candidate) => candidate.primaryIssueType === 'duplicate')).toBe(true);
    expect(result.every((candidate) => candidate.issueTypes.includes('duplicate'))).toBe(true);
    expect(result.every((candidate) => candidate.kind === 'duplicate-photo')).toBe(true);
    expect(result.every((candidate) => candidate.duplicateGroup?.size === 3)).toBe(true);
    expect(result[0]?.duplicateGroup?.groupId).toBe(result[1]?.duplicateGroup?.groupId);
    expect(result[0]?.duplicateGroup?.representativeReason).toBe('higher-resolution');
    expect(result[0]?.duplicateGroup?.representativeWidth).toBe(3024);
    expect(result[0]?.duplicateGroup?.representativeHeight).toBe(4032);
    expect(result[0]?.duplicateGroup?.representativeFileSize).toBe(4_200_000);
  });

  it('treats two identical photos as duplicates even when one analysis falls back to metadata-only signals', () => {
    const result = buildCleanupCandidates([
      {
        asset: {
          ...baseAsset,
          id: 'identical-keep',
          uri: 'file:///identical-keep.jpg',
          width: 3024,
          height: 4032,
          fileSize: 4_200_000,
          creationTime: 3,
        },
        metrics: {
          brightness: 0.51,
          contrast: 0.19,
          edgeDensity: 0.18,
        },
        fingerprint: 'f0f0f0f0f0f0f0f0',
        contentHash: 'exact-photo-hash',
      },
      {
        asset: {
          ...baseAsset,
          id: 'identical-dup',
          uri: 'file:///identical-dup.jpg',
          width: 3024,
          height: 4032,
          fileSize: 4_200_000,
          creationTime: 3,
        },
        metrics: {
          brightness: 0.5,
          contrast: 0.18,
          edgeDensity: 0.17,
        },
        fingerprint: null,
        contentHash: 'exact-photo-hash',
        analysisStatus: 'fallback',
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('identical-dup');
    expect(result[0]?.primaryIssueType).toBe('duplicate');
    expect(result[0]?.duplicateGroup?.size).toBe(2);
  });

  it('detects visually similar photos that are slightly farther apart than the current near-duplicate threshold', () => {
    const result = buildCleanupCandidates([
      {
        asset: {
          ...baseAsset,
          id: 'similar-keep',
          uri: 'file:///similar-keep.jpg',
          width: 3024,
          height: 4032,
          fileSize: 4_200_000,
          creationTime: 3,
        },
        metrics: {
          brightness: 0.52,
          contrast: 0.2,
          edgeDensity: 0.18,
        },
        fingerprint: 'ffffffffffffffff',
      },
      {
        asset: {
          ...baseAsset,
          id: 'similar-dup',
          uri: 'file:///similar-dup.jpg',
          width: 3000,
          height: 4000,
          fileSize: 4_100_000,
          creationTime: 4,
        },
        metrics: {
          brightness: 0.51,
          contrast: 0.19,
          edgeDensity: 0.17,
        },
        fingerprint: 'ff0fffffffffff0f',
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('similar-dup');
    expect(result[0]?.primaryIssueType).toBe('duplicate');
    expect(result[0]?.duplicateGroup?.size).toBe(2);
    expect(result[0]?.duplicateGroup?.relation).toBe('near');
  });

  it('does not merge visually different landscape photos that only share broad tone and average-hash similarity', () => {
    const result = buildCleanupCandidates([
      {
        asset: {
          ...baseAsset,
          id: 'landscape-a',
          uri: 'file:///landscape-a.jpg',
          width: 4032,
          height: 3024,
          fileSize: 4_200_000,
          creationTime: 3,
        },
        metrics: {
          brightness: 0.58,
          contrast: 0.19,
          edgeDensity: 0.18,
        },
        fingerprint: 'f0f0f0f0f0f0f0f0',
        differenceHash: '00000000ffffffff',
      },
      {
        asset: {
          ...baseAsset,
          id: 'landscape-b',
          uri: 'file:///landscape-b.jpg',
          width: 4032,
          height: 3024,
          fileSize: 4_050_000,
          creationTime: 4,
        },
        metrics: {
          brightness: 0.57,
          contrast: 0.18,
          edgeDensity: 0.17,
        },
        fingerprint: 'f0f0f0f0f0f0f0f1',
        differenceHash: 'ffffffff00000000',
      },
    ]);

    expect(result).toHaveLength(0);
  });

  it('detects duplicate videos when later frames are similar even if the first frame differs', () => {
    const result = buildCleanupCandidates([
      {
        asset: {
          ...baseAsset,
          id: 'video-keep',
          uri: 'file:///video-keep.mp4',
          mediaType: 'video',
          width: 1920,
          height: 1080,
          duration: 12.2,
          fileSize: 12_000_000,
          creationTime: 2,
        },
        metrics: {
          brightness: 0.5,
          contrast: 0.22,
          edgeDensity: 0.24,
        },
        fingerprint: '1111111111111111',
        frameFingerprints: ['1111111111111111', 'aaaaaaaaaaaaaaaa', 'bbbbbbbbbbbbbbbb'],
      },
      {
        asset: {
          ...baseAsset,
          id: 'video-dup',
          uri: 'file:///video-dup.mp4',
          mediaType: 'video',
          width: 1280,
          height: 720,
          duration: 12.0,
          fileSize: 7_600_000,
          creationTime: 6,
        },
        metrics: {
          brightness: 0.52,
          contrast: 0.21,
          edgeDensity: 0.23,
        },
        fingerprint: 'ffffffffffffffff',
        frameFingerprints: ['ffffffffffffffff', 'aaaaaaaaaaaaaaaa', 'bbbbbbbbbbbbbbbc'],
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('video-dup');
    expect(result[0]?.kind).toBe('duplicate-video');
    expect(result[0]?.duplicateGroup?.size).toBe(2);
    expect(result[0]?.duplicateGroup?.representativeReason).toBe('higher-resolution');
    expect(result[0]?.duplicateGroup?.representativeWidth).toBe(1920);
    expect(result[0]?.duplicateGroup?.representativeHeight).toBe(1080);
  });

  it('expresses the duplicate-group quantity semantics as 2 for two exact same photos', () => {
    const result = buildCleanupCandidates([
      {
        asset: {
          ...baseAsset,
          id: 'photo-keep',
          uri: 'file:///photo-keep.jpg',
          width: 3024,
          height: 4032,
          fileSize: 4_200_000,
          creationTime: 4,
        },
        metrics: {
          brightness: 0.54,
          contrast: 0.23,
          edgeDensity: 0.22,
        },
        fingerprint: '1234123412341234',
      },
      {
        asset: {
          ...baseAsset,
          id: 'photo-dup',
          uri: 'file:///photo-dup.jpg',
          width: 1080,
          height: 1440,
          fileSize: 620_000,
          creationTime: 8,
        },
        metrics: {
          brightness: 0.54,
          contrast: 0.23,
          edgeDensity: 0.22,
        },
        fingerprint: '1234123412341234',
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('photo-dup');
    expect(result[0]?.kind).toBe('duplicate-photo');
    expect(result[0]?.duplicateGroup?.relation).toBe('exact');
    expect(result[0]?.duplicateGroup?.size).toBe(2);
  });
});
