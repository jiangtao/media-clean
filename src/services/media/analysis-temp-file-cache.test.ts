import { beforeEach, describe, expect, it, vi } from 'vitest';

const fileSystemApi = vi.hoisted(() => ({
  cacheDirectory: 'file:///app/cache/',
  deleteAsync: vi.fn(),
  getInfoAsync: vi.fn(),
  readDirectoryAsync: vi.fn(),
}));

vi.mock('expo-file-system/src/legacy', () => fileSystemApi);

import {
  clearGeneratedAnalysisFileCache,
  loadGeneratedAnalysisFileCacheSizeBytes,
} from './analysis-temp-file-cache';

describe('analysis temp file cache', () => {
  beforeEach(() => {
    fileSystemApi.deleteAsync.mockReset();
    fileSystemApi.getInfoAsync.mockReset();
    fileSystemApi.readDirectoryAsync.mockReset();
    fileSystemApi.cacheDirectory = 'file:///app/cache/';
  });

  it('estimates the generated ImageManipulator and VideoThumbnails cache size recursively', async () => {
    fileSystemApi.getInfoAsync.mockImplementation(async (uri: string) => {
      if (uri === 'file:///app/cache/ImageManipulator') {
        return { exists: true, isDirectory: true, uri, size: 0, modificationTime: 0 };
      }

      if (uri === 'file:///app/cache/VideoThumbnails') {
        return { exists: true, isDirectory: true, uri, size: 0, modificationTime: 0 };
      }

      if (uri.endsWith('photo-a.jpg')) {
        return { exists: true, isDirectory: false, uri, size: 128, modificationTime: 0 };
      }

      if (uri.endsWith('frame-a.jpg')) {
        return { exists: true, isDirectory: false, uri, size: 256, modificationTime: 0 };
      }

      return { exists: false, isDirectory: false, uri };
    });
    fileSystemApi.readDirectoryAsync.mockImplementation(async (uri: string) => {
      if (uri === 'file:///app/cache/ImageManipulator') {
        return ['photo-a.jpg'];
      }

      if (uri === 'file:///app/cache/VideoThumbnails') {
        return ['frame-a.jpg'];
      }

      return [];
    });

    await expect(loadGeneratedAnalysisFileCacheSizeBytes()).resolves.toBe(384);
  });

  it('clears the generated analysis cache directories idempotently', async () => {
    fileSystemApi.deleteAsync.mockResolvedValue(undefined);

    await clearGeneratedAnalysisFileCache();

    expect(fileSystemApi.deleteAsync).toHaveBeenCalledWith(
      'file:///app/cache/ImageManipulator',
      { idempotent: true },
    );
    expect(fileSystemApi.deleteAsync).toHaveBeenCalledWith(
      'file:///app/cache/VideoThumbnails',
      { idempotent: true },
    );
  });
});
