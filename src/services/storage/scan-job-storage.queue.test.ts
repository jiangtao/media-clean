import { beforeEach, describe, expect, it, vi } from 'vitest';

const operationalStoreApi = vi.hoisted(() => ({
  loadOperationalActiveScanJob: vi.fn(),
  saveOperationalActiveScanJob: vi.fn(),
  clearOperationalActiveScanJob: vi.fn(),
}));

vi.mock('./sqlite/operational-store', () => ({
  loadOperationalActiveScanJob: operationalStoreApi.loadOperationalActiveScanJob,
  saveOperationalActiveScanJob: operationalStoreApi.saveOperationalActiveScanJob,
  clearOperationalActiveScanJob: operationalStoreApi.clearOperationalActiveScanJob,
}));

import {
  __resetPhotoScanJobStorageForTests,
  clearPhotoScanJobCheckpoint,
  loadPhotoScanJobCheckpoint,
  savePhotoScanJobCheckpoint,
} from './scan-job-storage';

function createCheckpoint(jobId: string) {
  return {
    jobId,
    phase: 'running' as const,
    progressCurrent: 1,
    progressTotal: 3,
    processedCount: 1,
    candidateCount: 0,
    startedAt: 1_710_000_000_000,
    lastHeartbeatAt: 1_710_000_000_100,
    currentFileName: 'IMG_0001.JPG',
    lastProcessedAssetId: 'asset-1',
    lastError: null,
    updatedAt: 1_710_000_000_100,
  };
}

function flushMicrotasks() {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}

describe('photo scan job storage queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetPhotoScanJobStorageForTests();
  });

  it('serializes checkpoint writes so a later save waits for the previous one', async () => {
    let releaseFirstSave: (() => void) | undefined;
    const callOrder: string[] = [];

    operationalStoreApi.saveOperationalActiveScanJob
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            callOrder.push('save-1:start');
            releaseFirstSave = () => {
              callOrder.push('save-1:end');
              resolve();
            };
          }),
      )
      .mockImplementationOnce(async () => {
        callOrder.push('save-2:start');
        callOrder.push('save-2:end');
      });

    const firstSave = savePhotoScanJobCheckpoint(createCheckpoint('job-1'));
    const secondSave = savePhotoScanJobCheckpoint(createCheckpoint('job-2'));

    await flushMicrotasks();

    expect(callOrder).toEqual(['save-1:start']);

    if (typeof releaseFirstSave === 'function') {
      releaseFirstSave();
    }
    await Promise.all([firstSave, secondSave]);

    expect(callOrder).toEqual([
      'save-1:start',
      'save-1:end',
      'save-2:start',
      'save-2:end',
    ]);
  });

  it('retries transient database locked errors before succeeding', async () => {
    operationalStoreApi.saveOperationalActiveScanJob
      .mockRejectedValueOnce(
        new Error("Call to function 'NativeStatement.finalizeAsync' has been rejected. database is locked"),
      )
      .mockResolvedValueOnce(undefined);

    await expect(
      savePhotoScanJobCheckpoint(createCheckpoint('job-retry')),
    ).resolves.toBeUndefined();

    expect(operationalStoreApi.saveOperationalActiveScanJob).toHaveBeenCalledTimes(2);
  });

  it('keeps restore reads behind in-flight writes', async () => {
    let releaseSave: (() => void) | undefined;
    const callOrder: string[] = [];

    operationalStoreApi.saveOperationalActiveScanJob.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          callOrder.push('save:start');
          releaseSave = () => {
            callOrder.push('save:end');
            resolve();
          };
        }),
    );
    operationalStoreApi.loadOperationalActiveScanJob.mockImplementationOnce(async () => {
      callOrder.push('load');
      return null;
    });

    const savePromise = savePhotoScanJobCheckpoint(createCheckpoint('job-restore'));
    const loadPromise = loadPhotoScanJobCheckpoint();

    await flushMicrotasks();
    expect(callOrder).toEqual(['save:start']);

    if (typeof releaseSave === 'function') {
      releaseSave();
    }
    await Promise.all([savePromise, loadPromise]);

    expect(callOrder).toEqual(['save:start', 'save:end', 'load']);
  });

  it('serializes clear after save to avoid checkpoint races on cancel', async () => {
    let releaseSave: (() => void) | undefined;
    const callOrder: string[] = [];

    operationalStoreApi.saveOperationalActiveScanJob.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          callOrder.push('save:start');
          releaseSave = () => {
            callOrder.push('save:end');
            resolve();
          };
        }),
    );
    operationalStoreApi.clearOperationalActiveScanJob.mockImplementationOnce(async () => {
      callOrder.push('clear');
    });

    const savePromise = savePhotoScanJobCheckpoint(createCheckpoint('job-clear'));
    const clearPromise = clearPhotoScanJobCheckpoint();

    await flushMicrotasks();
    expect(callOrder).toEqual(['save:start']);

    if (typeof releaseSave === 'function') {
      releaseSave();
    }
    await Promise.all([savePromise, clearPromise]);

    expect(callOrder).toEqual(['save:start', 'save:end', 'clear']);
  });
});
