import { beforeEach, describe, expect, it, vi } from 'vitest';

const platformState = vi.hoisted(() => ({
  os: 'ios' as 'ios' | 'android',
  reset() {
    this.os = 'ios';
  },
}));

const nativeModulesState = vi.hoisted(() => ({
  modules: {} as Record<string, unknown>,
  reset() {
    Object.keys(this.modules).forEach((key) => {
      delete this.modules[key];
    });
  },
}));

vi.mock('react-native', () => ({
  Platform: {
    get OS() {
      return platformState.os;
    },
  },
  NativeModules: nativeModulesState.modules,
}));

import {
  enumerateAndroidMediaStoreAssets,
  isAndroidMediaStoreEnumerationSupported,
} from '../android-media-store';

describe('android media store wrapper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    platformState.reset();
    nativeModulesState.reset();
  });

  it('degrades safely outside Android', async () => {
    await expect(isAndroidMediaStoreEnumerationSupported()).resolves.toBe(false);
    await expect(
      enumerateAndroidMediaStoreAssets({
        createdAfter: 1_710_000_000_000,
      }),
    ).resolves.toEqual([]);
  });

  it('returns false and empty results when the native module is absent', async () => {
    platformState.os = 'android';

    await expect(isAndroidMediaStoreEnumerationSupported()).resolves.toBe(false);
    await expect(enumerateAndroidMediaStoreAssets()).resolves.toEqual([]);
  });

  it('uses the native module on Android and normalizes returned metadata', async () => {
    platformState.os = 'android';
    const isSupported = vi.fn(async () => true);
    const enumerate = vi.fn(async () => [
      {
        assetId: '1001',
        contentUri: 'content://media/external/images/media/1001',
        mediaType: 'photo',
        width: 1170,
        height: 2532,
        durationMs: 0,
        fileSizeBytes: 8_388_608,
        dateTaken: 1_710_000_000_123,
        dateModified: 1_710_000_100_000,
        bucketId: 'bucket-1',
        bucketName: 'Screenshots',
        mimeType: 'image/jpeg',
        isScreenshot: true,
        bitrate: null,
        frameRate: null,
        codec: '',
        orientation: 90,
        aspectRatio: 0.462,
      },
      {
        assetId: '2001',
        contentUri: 'content://media/external/video/media/2001',
        mediaType: 'video',
        width: 1920,
        height: 1080,
        durationMs: 12_345,
        fileSizeBytes: 10_485_760,
        dateTaken: undefined,
        dateModified: 1_710_000_200_000,
        bucketId: undefined,
        bucketName: 'Camera',
        mimeType: 'video/mp4',
        isScreenshot: false,
        bitrate: 8_000_000,
        frameRate: 29.97,
        codec: 'video/avc',
        orientation: undefined,
        aspectRatio: 1.7777777778,
      },
    ]);

    nativeModulesState.modules.AndroidMediaStoreEnumerator = {
      isSupported,
      enumerate,
    };

    await expect(isAndroidMediaStoreEnumerationSupported()).resolves.toBe(true);

    await expect(
      enumerateAndroidMediaStoreAssets({
        createdAfter: 1_710_000_000_000,
        createdBefore: 1_710_500_000_000,
        mediaTypes: ['photo'],
        limit: 25,
      }),
    ).resolves.toEqual([
      {
        assetId: '1001',
        contentUri: 'content://media/external/images/media/1001',
        mediaType: 'photo',
        width: 1170,
        height: 2532,
        durationMs: 0,
        fileSizeBytes: 8_388_608,
        dateTaken: 1_710_000_000_123,
        dateModified: 1_710_000_100_000,
        bucketId: 'bucket-1',
        bucketName: 'Screenshots',
        mimeType: 'image/jpeg',
        isScreenshot: true,
        bitrate: null,
        frameRate: null,
        codec: null,
        orientation: 90,
        aspectRatio: 0.462,
      },
      {
        assetId: '2001',
        contentUri: 'content://media/external/video/media/2001',
        mediaType: 'video',
        width: 1920,
        height: 1080,
        durationMs: 12_345,
        fileSizeBytes: 10_485_760,
        dateTaken: null,
        dateModified: 1_710_000_200_000,
        bucketId: null,
        bucketName: 'Camera',
        mimeType: 'video/mp4',
        isScreenshot: false,
        bitrate: 8_000_000,
        frameRate: 29.97,
        codec: 'video/avc',
        orientation: null,
        aspectRatio: 1.7777777778,
      },
    ]);

    expect(enumerate).toHaveBeenCalledWith({
      createdAfter: 1_710_000_000_000,
      createdBefore: 1_710_500_000_000,
      mediaTypes: ['photo'],
      limit: 25,
    });
  });

  it('returns an empty list when native support check rejects', async () => {
    platformState.os = 'android';
    nativeModulesState.modules.AndroidMediaStoreEnumerator = {
      isSupported: vi.fn(async () => {
        throw new Error('boom');
      }),
      enumerate: vi.fn(),
    };

    await expect(enumerateAndroidMediaStoreAssets()).resolves.toEqual([]);
  });
});
