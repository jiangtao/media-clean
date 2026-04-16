import { describe, expect, it } from 'vitest';

import {
  getDuplicateCardSummary,
  getDuplicateRepresentativeComparison,
} from './app-copy';
import type { CleanupCandidate } from '../domain/recognition/types';

const duplicateCandidate: CleanupCandidate = {
  id: 'duplicate-item',
  asset: {
    id: 'duplicate-item',
    uri: 'file:///duplicate-item.jpg',
    mediaType: 'photo',
    width: 1080,
    height: 1440,
    duration: 0,
    fileSize: 680_000,
    creationTime: new Date('2026-04-16T08:00:00+08:00').getTime(),
  },
  score: 86,
  confidence: 'high',
  kind: 'duplicate-photo',
  primaryIssueType: 'duplicate',
  issueTypes: ['duplicate'],
  reasons: ['与其他媒体高度相似', '已保留一份更高质量副本'],
  duplicateGroup: {
    groupId: 'duplicate-a-b',
    representativeId: 'keep',
    relation: 'exact',
    size: 2,
    similarity: 0.98,
    representativeReason: 'higher-resolution',
    representativeWidth: 3024,
    representativeHeight: 4032,
    representativeFileSize: 4_200_000,
    representativeCreationTime: new Date('2026-04-15T08:00:00+08:00').getTime(),
  },
};

describe('duplicate copy helpers', () => {
  it('builds a compact zh-CN duplicate card summary', () => {
    expect(getDuplicateCardSummary(duplicateCandidate, 'zh-CN')).toBe(
      '保留 3024 × 4032 副本 · 同组还有 1 项',
    );
  });

  it('builds a detailed en-US duplicate comparison', () => {
    expect(getDuplicateRepresentativeComparison(duplicateCandidate, 'en-US')).toBe(
      'Kept 3024 × 4032 while this item is 1080 × 1440.',
    );
  });
});
