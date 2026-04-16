import { describe, expect, it } from 'vitest';

import {
  buildCleanupCandidates,
  classifyAbnormalMedia,
  classifyAccidentalMedia,
  sortCandidatesByScore,
} from './scoring';
import type { MediaAssetSnapshot } from './types';

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
      expect.arrayContaining(['画面明显过暗', '边缘信息很少', '文件尺寸较小']),
    );
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
      expect.arrayContaining(['视频时长极短', '缩略图明显过暗']),
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

    expect(result.reasons).not.toContain('文件尺寸较小');
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
        reasons: ['画面明显过暗'],
      },
      {
        id: 'a',
        asset: { ...baseAsset, id: 'a', creationTime: 5 },
        score: 88,
        confidence: 'high',
        kind: 'accidental-video',
        primaryIssueType: 'accidental',
        issueTypes: ['accidental'],
        reasons: ['视频时长极短'],
      },
      {
        id: 'c',
        asset: { ...baseAsset, id: 'c', creationTime: 7 },
        score: 72,
        confidence: 'medium',
        kind: 'accidental-photo',
        primaryIssueType: 'accidental',
        issueTypes: ['accidental'],
        reasons: ['文件尺寸较小'],
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
      expect.arrayContaining(['媒体时长异常短', '缩略图接近全黑']),
    );
  });
});

describe('buildCleanupCandidates', () => {
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
      expect.arrayContaining(['媒体内容分析失败', '媒体文件为空', '媒体元数据异常']),
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
});
