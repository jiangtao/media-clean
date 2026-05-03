import { beforeEach, describe, expect, it, vi } from 'vitest';

const platformState = vi.hoisted(() => ({
  os: 'ios' as 'ios' | 'android',
  reset() {
    this.os = 'ios';
  },
}));

const nativeModulesState = vi.hoisted(() => ({
  modules: {
    BackgroundScanForegroundService: {
      isSupported: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    },
  } as Record<string, any>,
  reset() {
    this.modules.BackgroundScanForegroundService.isSupported.mockReset();
    this.modules.BackgroundScanForegroundService.start.mockReset();
    this.modules.BackgroundScanForegroundService.stop.mockReset();
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
  buildAndroidBackgroundScanNotificationPayload,
  syncAndroidBackgroundScanForegroundService,
} from './android-background-scan';

const nativeForegroundService = nativeModulesState.modules.BackgroundScanForegroundService;

describe('buildAndroidBackgroundScanNotificationPayload', () => {
  beforeEach(() => {
    platformState.reset();
    nativeModulesState.reset();
  });

  it('builds zh-CN notification copy with progress and current file name', () => {
    expect(
      buildAndroidBackgroundScanNotificationPayload({
        language: 'zh-CN',
        progressCurrent: 18,
        progressTotal: 42,
        currentFileName: 'IMG_0018.HEIC',
      }),
    ).toEqual({
      title: '扫描进行中',
      body: '已处理 18/42，当前：IMG_0018.HEIC',
      currentFileName: 'IMG_0018.HEIC',
      progressCurrent: 18,
      progressTotal: 42,
    });
  });

  it('builds en-US notification copy without a file name', () => {
    expect(
      buildAndroidBackgroundScanNotificationPayload({
        language: 'en-US',
        progressCurrent: 6,
        progressTotal: 12,
        currentFileName: null,
      }),
    ).toEqual({
      title: 'Scanning in progress',
      body: 'Processed 6/12. Scanning continues after leaving the app.',
      currentFileName: null,
      progressCurrent: 6,
      progressTotal: 12,
    });
  });

  it('trims very long file names for notification safety', () => {
    const payload = buildAndroidBackgroundScanNotificationPayload({
      language: 'zh-CN',
      progressCurrent: 1,
      progressTotal: 3,
      currentFileName: 'THIS_IS_A_VERY_LONG_FILENAME_FOR_BACKGROUND_SCAN_PREVIEW_IMAGE.JPG',
    });

    expect(payload.currentFileName?.length).toBeLessThanOrEqual(48);
    expect(payload.currentFileName).toMatch(/\.\.\.$/);
    expect(payload.body).toContain(`当前：${payload.currentFileName}`);
  });
});

describe('syncAndroidBackgroundScanForegroundService', () => {
  beforeEach(() => {
    platformState.reset();
    nativeModulesState.reset();
  });

  it('returns false on non-Android platforms without touching the native module', async () => {
    await expect(
      syncAndroidBackgroundScanForegroundService({
        language: 'zh-CN',
        isScanning: true,
        progressCurrent: 1,
        progressTotal: 3,
        currentFileName: 'IMG_001.jpg',
      }),
    ).resolves.toBe(false);

    expect(nativeForegroundService.isSupported).not.toHaveBeenCalled();
    expect(nativeForegroundService.start).not.toHaveBeenCalled();
  });

  it('starts or updates the native foreground service on Android when scanning is active', async () => {
    platformState.os = 'android';
    nativeForegroundService.isSupported.mockResolvedValue(true);
    nativeForegroundService.start.mockResolvedValue(undefined);

    await expect(
      syncAndroidBackgroundScanForegroundService({
        language: 'zh-CN',
        isScanning: true,
        progressCurrent: 2,
        progressTotal: 5,
        currentFileName: 'IMG_002.jpg',
      }),
    ).resolves.toBe(true);

    expect(nativeForegroundService.start).toHaveBeenCalledWith({
      title: '扫描进行中',
      body: '已处理 2/5，当前：IMG_002.jpg',
      currentFileName: 'IMG_002.jpg',
      progressCurrent: 2,
      progressTotal: 5,
    });
  });

  it('stops the native foreground service on Android when scanning ends', async () => {
    platformState.os = 'android';
    nativeForegroundService.isSupported.mockResolvedValue(true);
    nativeForegroundService.stop.mockResolvedValue(undefined);

    await expect(
      syncAndroidBackgroundScanForegroundService({
        language: 'zh-CN',
        isScanning: false,
        progressCurrent: 5,
        progressTotal: 5,
        currentFileName: null,
      }),
    ).resolves.toBe(true);

    expect(nativeForegroundService.stop).toHaveBeenCalledTimes(1);
  });
});
