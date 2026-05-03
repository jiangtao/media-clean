export interface ScanBatchProgressContractInput {
  persistedCurrent?: number | null;
  persistedTotal?: number | null;
  batchScopeTotal: number;
  dirtyAssetCount: number;
  resumedProcessedCount?: number | null;
}

export interface ScanBatchProgressContract {
  progressCurrent: number;
  progressTotal: number;
  completedOffset: number;
  resumedProcessedCount: number;
  dirtyAssetCount: number;
  isZeroWorkComplete: boolean;
}

function clampProgress(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function normalizeCount(value: number | null | undefined) {
  return Math.max(0, Math.floor(value ?? 0));
}

export function resolveScanBatchProgressContract(
  input: ScanBatchProgressContractInput,
): ScanBatchProgressContract {
  const batchScopeTotal = normalizeCount(input.batchScopeTotal);
  const dirtyAssetCount = normalizeCount(input.dirtyAssetCount);
  const progressTotal = Math.max(
    normalizeCount(input.persistedTotal),
    batchScopeTotal,
    dirtyAssetCount,
  );
  const completedOffset = Math.max(0, progressTotal - dirtyAssetCount);
  const resumedProcessedCount = clampProgress(
    normalizeCount(input.resumedProcessedCount),
    0,
    dirtyAssetCount,
  );
  const fallbackCurrent = completedOffset + resumedProcessedCount;
  const progressCurrent = clampProgress(
    input.persistedCurrent === null || typeof input.persistedCurrent === 'undefined'
      ? fallbackCurrent
      : normalizeCount(input.persistedCurrent),
    0,
    progressTotal,
  );

  return {
    progressCurrent,
    progressTotal,
    completedOffset,
    resumedProcessedCount,
    dirtyAssetCount,
    isZeroWorkComplete: progressTotal > 0 && dirtyAssetCount === 0 && progressCurrent === progressTotal,
  };
}
