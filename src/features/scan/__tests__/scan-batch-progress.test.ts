import { describe, expect, it } from 'vitest';

import { resolveScanBatchProgressContract } from '../scan-batch-progress';

describe('resolveScanBatchProgressContract', () => {
  it('uses the batch scope as the denominator while only dirty assets remain as work', () => {
    expect(
      resolveScanBatchProgressContract({
        batchScopeTotal: 5,
        dirtyAssetCount: 2,
        resumedProcessedCount: 1,
      }),
    ).toEqual({
      progressCurrent: 4,
      progressTotal: 5,
      completedOffset: 3,
      resumedProcessedCount: 1,
      dirtyAssetCount: 2,
      isZeroWorkComplete: false,
    });
  });

  it('marks a non-empty batch with zero dirty assets as already complete', () => {
    expect(
      resolveScanBatchProgressContract({
        batchScopeTotal: 261,
        dirtyAssetCount: 0,
      }),
    ).toEqual({
      progressCurrent: 261,
      progressTotal: 261,
      completedOffset: 261,
      resumedProcessedCount: 0,
      dirtyAssetCount: 0,
      isZeroWorkComplete: true,
    });
  });

  it('keeps persisted progress bounded by the resolved denominator', () => {
    expect(
      resolveScanBatchProgressContract({
        persistedCurrent: 999,
        persistedTotal: 10,
        batchScopeTotal: 8,
        dirtyAssetCount: 3,
        resumedProcessedCount: 5,
      }),
    ).toEqual({
      progressCurrent: 10,
      progressTotal: 10,
      completedOffset: 7,
      resumedProcessedCount: 3,
      dirtyAssetCount: 3,
      isZeroWorkComplete: false,
    });
  });
});
