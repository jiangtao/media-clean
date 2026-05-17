import { describe, expect, it } from 'vitest';

import { applyCleanupAction, createInitialCleanupState } from './cleanup-state';
import type { CleanupCandidate } from '../../domain/recognition/types';

const candidate = (id: string): CleanupCandidate => ({
  id,
  asset: {
    id,
    uri: `file:///${id}.jpg`,
    mediaType: 'photo',
    width: 720,
    height: 1280,
    duration: 0,
    fileSize: 160_000,
    creationTime: 10,
  },
  confidence: 'high',
  kind: 'accidental-photo',
  primaryIssueType: 'accidental',
  issueTypes: ['accidental'],
  reasons: ['画面明显过暗'],
  score: 90,
});

describe('cleanup state', () => {
  it('moves suggested-cleanup candidates into recycle bin during auto cleanup', () => {
    const state = createInitialCleanupState([
      candidate('a'),
      candidate('b'),
      {
        ...candidate('c'),
        confidence: 'medium',
        score: 68,
      },
    ]);

    const next = applyCleanupAction(state, {
      type: 'auto-soft-delete',
    });

    expect(next.activeCandidates.map((item) => item.id)).toEqual(['c']);
    expect(next.recycleBin.map((item) => item.id)).toEqual(['a', 'b']);
  });

  it('restores an item from recycle bin', () => {
    const state = {
      ...createInitialCleanupState([]),
      activeCandidates: [],
      recycleBin: [candidate('restore-me')],
    };

    const next = applyCleanupAction(state, {
      type: 'restore',
      ids: ['restore-me'],
    });

    expect(next.recycleBin).toHaveLength(0);
    expect(next.activeCandidates.map((item) => item.id)).toEqual(['restore-me']);
  });

  it('removes permanently deleted items from every list', () => {
    const state = {
      ...createInitialCleanupState([candidate('active')]),
      recycleBin: [candidate('trashed')],
      selectedIds: ['active', 'trashed'],
    };

    const next = applyCleanupAction(state, {
      type: 'hard-delete',
      ids: ['active', 'trashed'],
    });

    expect(next.activeCandidates).toHaveLength(0);
    expect(next.recycleBin).toHaveLength(0);
    expect(next.selectedIds).toHaveLength(0);
  });
});
