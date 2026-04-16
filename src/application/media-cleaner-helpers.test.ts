import { describe, expect, it } from 'vitest';

import { createInitialCleanupState } from '../features/cleanup/cleanup-state';
import type { CleanupAction } from '../features/cleanup/cleanup-state';
import type { CleanupCandidate } from '../domain/recognition/types';
import {
  createSummaryFromState,
  derivePersistedRecycleBinIds,
  resolvePreviewPrimaryActionMode,
} from './media-cleaner-helpers';

function candidate(id: string): CleanupCandidate {
  return {
    id,
    asset: {
      id,
      uri: `file:///${id}.jpg`,
      mediaType: 'photo',
      width: 1080,
      height: 1920,
      duration: 0,
      fileSize: 240_000,
      creationTime: 1_710_000_000_000,
    },
    confidence: 'high',
    kind: 'accidental-photo',
    primaryIssueType: 'accidental',
    issueTypes: ['accidental'],
    reasons: ['画面明显过暗'],
    score: 88,
  };
}

describe('media cleaner helpers', () => {
  it('treats recycle-bin preview primary action as restore', () => {
    expect(resolvePreviewPrimaryActionMode('suggestions')).toBe('soft-delete');
    expect(resolvePreviewPrimaryActionMode('recycle')).toBe('restore');
  });

  it('preserves unresolved recycle-bin ids across hydrate and removes explicit restore/delete ids', () => {
    const hydrateAction: CleanupAction = {
      type: 'hydrate',
      activeCandidates: [],
      recycleBin: [candidate('visible')],
    };

    expect(derivePersistedRecycleBinIds(['ghost', 'visible'], ['visible'], hydrateAction)).toEqual([
      'ghost',
      'visible',
    ]);

    expect(
      derivePersistedRecycleBinIds(['ghost', 'visible'], ['visible'], {
        type: 'restore',
        ids: ['visible'],
      }),
    ).toEqual(['ghost']);

    expect(
      derivePersistedRecycleBinIds(['ghost', 'visible'], ['ghost'], {
        type: 'hard-delete',
        ids: ['ghost'],
      }),
    ).toEqual(['visible']);
  });

  it('recomputes live candidate counts after cleanup while keeping last scan timing', () => {
    const state = {
      ...createInitialCleanupState([candidate('active')]),
      recycleBin: [candidate('recycle')],
    };

    const summary = createSummaryFromState(state, {
      scannedAt: 1_710_000_123_000,
      scannedCount: 24,
      candidateCount: 9,
    });

    expect(summary).toMatchObject({
      scannedAt: 1_710_000_123_000,
      scannedCount: 24,
      candidateCount: 2,
      highConfidenceCount: 2,
      mediumConfidenceCount: 0,
      recycleBinCount: 1,
    });
  });
});
