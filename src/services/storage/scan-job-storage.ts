import {
  clearOperationalActiveScanJob,
  loadOperationalActiveScanJob,
  saveOperationalActiveScanJob,
  type ActiveScanJobCheckpoint,
} from './sqlite/operational-store';

const LOCKED_RETRY_DELAYS_MS = [40, 80, 160] as const;

let activeScanJobOperationQueue: Promise<void> = Promise.resolve();

export type PhotoScanJobPhase = ActiveScanJobCheckpoint['phase'];

export interface PhotoScanJobCheckpoint {
  jobId: string;
  phase: PhotoScanJobPhase;
  progressCurrent: number;
  progressTotal: number;
  processedCount: number;
  candidateCount: number;
  startedAt: number;
  lastHeartbeatAt: number;
  currentFileName: string | null;
  lastProcessedAssetId: string | null;
  lastError: string | null;
  updatedAt: number;
}

function isSqliteDatabaseLockedError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.message.toLowerCase().includes('database is locked');
}

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function withLockedRetry<T>(operation: () => Promise<T>): Promise<T> {
  let attempt = 0;

  while (true) {
    try {
      return await operation();
    } catch (error) {
      if (
        !isSqliteDatabaseLockedError(error) ||
        attempt >= LOCKED_RETRY_DELAYS_MS.length
      ) {
        throw error;
      }

      const retryDelay = LOCKED_RETRY_DELAYS_MS[attempt];
      attempt += 1;
      await delay(retryDelay);
    }
  }
}

function enqueueActiveScanJobOperation<T>(operation: () => Promise<T>) {
  const queuedOperation = activeScanJobOperationQueue
    .catch(() => undefined)
    .then(() => operation());

  activeScanJobOperationQueue = queuedOperation.then(
    () => undefined,
    () => undefined,
  );

  return queuedOperation;
}

export function __resetPhotoScanJobStorageForTests() {
  activeScanJobOperationQueue = Promise.resolve();
}

export async function loadPhotoScanJobCheckpoint() {
  return enqueueActiveScanJobOperation(() =>
    withLockedRetry(() => loadOperationalActiveScanJob()),
  );
}

export async function savePhotoScanJobCheckpoint(checkpoint: PhotoScanJobCheckpoint) {
  await enqueueActiveScanJobOperation(() =>
    withLockedRetry(() => saveOperationalActiveScanJob(checkpoint)),
  );
}

export async function clearPhotoScanJobCheckpoint() {
  await enqueueActiveScanJobOperation(() =>
    withLockedRetry(() => clearOperationalActiveScanJob()),
  );
}
