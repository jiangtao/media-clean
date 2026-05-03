import { beforeEach, describe, expect, it } from 'vitest';

import {
  __resetPhotoScanJobStorageForTests,
  clearPhotoScanJobCheckpoint,
  loadPhotoScanJobCheckpoint,
  savePhotoScanJobCheckpoint,
} from './scan-job-storage';
import {
  __resetOperationalStoreForTests,
  __useInMemoryOperationalStoreForTests,
} from './sqlite/operational-store';

describe('photo scan job storage', () => {
  beforeEach(() => {
    __resetPhotoScanJobStorageForTests();
    __resetOperationalStoreForTests();
    __useInMemoryOperationalStoreForTests();
  });

  it('persists and clears the active scan checkpoint', async () => {
    await savePhotoScanJobCheckpoint({
      jobId: 'photo-scan-1',
      phase: 'running',
      progressCurrent: 12,
      progressTotal: 60,
      processedCount: 12,
      candidateCount: 0,
      startedAt: 1_710_000_000_000,
      lastHeartbeatAt: 1_710_000_001_000,
      currentFileName: 'IMG_0012.JPG',
      lastProcessedAssetId: 'asset-12',
      lastError: null,
      updatedAt: 1_710_000_001_000,
    });

    await expect(loadPhotoScanJobCheckpoint()).resolves.toEqual({
      jobId: 'photo-scan-1',
      phase: 'running',
      progressCurrent: 12,
      progressTotal: 60,
      processedCount: 12,
      candidateCount: 0,
      startedAt: 1_710_000_000_000,
      lastHeartbeatAt: 1_710_000_001_000,
      currentFileName: 'IMG_0012.JPG',
      lastProcessedAssetId: 'asset-12',
      lastError: null,
      updatedAt: 1_710_000_001_000,
    });

    await clearPhotoScanJobCheckpoint();

    await expect(loadPhotoScanJobCheckpoint()).resolves.toBeNull();
  });
});
