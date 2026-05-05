import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as appStorage from '../../../services/storage/app-storage';
import * as reminderRuntime from '../../../features/reminders/reminder-runtime';
import * as scanRangeStorage from '../../../services/storage/scan-range-storage';
import { getAppCopy } from '../../../i18n/app-copy';
import { getAppTheme } from '../../../theme/app-theme';
import { SettingsScreen } from '../SettingsScreen';
import { buildSettingsScreenLayout } from '../screen-layout';

const appPreferencesApi = vi.hoisted(() => ({
  useAppPreferences: vi.fn(),
}));

const analysisTempFileCacheApi = vi.hoisted(() => ({
  clearGeneratedAnalysisFileCache: vi.fn(),
  loadGeneratedAnalysisFileCacheSizeBytes: vi.fn(),
}));

vi.mock('../../../application/AppPreferencesContext', () => appPreferencesApi);
vi.mock('../../../services/storage/app-storage');
vi.mock('../../../services/media/analysis-temp-file-cache', () => analysisTempFileCacheApi);
vi.mock('../../../services/storage/scan-range-storage', async () => {
  const actual = await vi.importActual<typeof import('../../../services/storage/scan-range-storage')>(
    '../../../services/storage/scan-range-storage',
  );

  return {
    ...actual,
    loadScanRange: vi.fn(),
    saveScanRange: vi.fn(),
  };
});
vi.mock('../../../features/reminders/reminder-runtime', () => ({
  reconcileReminderRuntimeInForeground: vi.fn(),
  reconcileReminderRuntimeOnLaunch: vi.fn(),
  reconcileReminderRuntimeSettings: vi.fn(),
  syncReminderRuntimeSettings: vi.fn(),
}));
vi.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback: () => void | (() => void)) => {
    callback();
  },
}));
vi.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));
vi.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  Switch: 'Switch',
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
    hairlineWidth: 1,
  },
}));
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockUseAppPreferences = vi.mocked(appPreferencesApi.useAppPreferences);
const mockLoadLastScanMeta = vi.mocked(appStorage.loadLastScanMeta);
const mockLoadPersistentScanCacheSizeBytes = vi.mocked(appStorage.loadPersistentScanCacheSizeBytes);
const mockClearPersistentScanCache = vi.mocked(appStorage.clearPersistentScanCache);
const mockLoadGeneratedAnalysisFileCacheSizeBytes = vi.mocked(
  analysisTempFileCacheApi.loadGeneratedAnalysisFileCacheSizeBytes,
);
const mockClearGeneratedAnalysisFileCache = vi.mocked(
  analysisTempFileCacheApi.clearGeneratedAnalysisFileCache,
);
const mockLoadScanRange = vi.mocked(scanRangeStorage.loadScanRange);
const mockReconcileReminderRuntimeInForeground = vi.mocked(
  reminderRuntime.reconcileReminderRuntimeInForeground,
);
const ReactTestRenderer = TestRenderer;

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function flattenTextChildren(children: React.ReactNode): string {
  if (typeof children === 'string' || typeof children === 'number') {
    return String(children);
  }

  if (Array.isArray(children)) {
    return children.map(flattenTextChildren).join('');
  }

  if (React.isValidElement<{ children?: React.ReactNode }>(children)) {
    return flattenTextChildren(children.props.children);
  }

  return '';
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

async function renderScreen() {
  let renderer: ReturnType<typeof ReactTestRenderer.create>;

  await act(async () => {
    renderer = ReactTestRenderer.create(<SettingsScreen />);
    await flushPromises();
  });

  return renderer!;
}

function collectRenderedTexts(renderer: ReturnType<typeof ReactTestRenderer.create>) {
  return renderer.root
    .findAllByType('Text')
    .map((node: { props: { children?: React.ReactNode } }) => flattenTextChildren(node.props.children))
    .filter(Boolean);
}

describe('SettingsScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseAppPreferences.mockReturnValue({
      isReady: true,
      language: 'zh-CN',
      languagePreference: 'zh-CN',
      themePreference: 'system',
      resolvedThemeScheme: 'light',
      theme: getAppTheme('light'),
      copy: getAppCopy('zh-CN'),
      setLanguage: vi.fn().mockResolvedValue(undefined),
      setThemePreference: vi.fn().mockResolvedValue(undefined),
    });
    mockLoadScanRange.mockResolvedValue(3);
    mockClearPersistentScanCache.mockResolvedValue(undefined);
    mockClearGeneratedAnalysisFileCache.mockResolvedValue(undefined);
    mockLoadPersistentScanCacheSizeBytes.mockResolvedValue(5 * 1024 * 1024);
    mockLoadGeneratedAnalysisFileCacheSizeBytes.mockResolvedValue(0);
    mockLoadLastScanMeta.mockResolvedValue({
      scannedAt: 1_710_100_000_000,
      scannedCount: 180,
      candidateCount: 12,
      highConfidenceCount: 8,
      mediumConfidenceCount: 4,
      recycleBinCount: 1,
    });
    mockReconcileReminderRuntimeInForeground.mockResolvedValue({
      settings: {
        enabled: true,
        frequency: 'weekly',
        weekday: 1,
        hour: 20,
        minute: 30,
        notificationId: 'existing-reminder-id',
        nextTriggerAt: 1_710_000_000_000,
        summary: '定期检查最近拍摄的照片和视频，优先清理误触、异常与重复内容。',
      },
      permissionGranted: true,
    });
  });

  it('loads persisted scan state and reminder runtime on focus', async () => {
    const renderer = await renderScreen();
    const renderedTexts = collectRenderedTexts(renderer);

    expect(mockLoadScanRange).toHaveBeenCalled();
    expect(mockLoadLastScanMeta).toHaveBeenCalled();
    expect(mockReconcileReminderRuntimeInForeground).toHaveBeenCalledWith('zh-CN', {
      name: '定期清理提醒',
      description: '提醒你重新扫描最近媒体并清理误触、异常与重复内容。',
    });
    expect(renderedTexts).toContain('最近 3 个月');
    expect(renderedTexts).toContain('每周一 20:30 提醒你检查识别结果');
  });

  it('shows the never-scanned copy when no scan history exists', async () => {
    mockLoadLastScanMeta.mockReset();
    mockLoadLastScanMeta.mockResolvedValue(null);

    const renderer = await renderScreen();

    expect(collectRenderedTexts(renderer)).toContain('尚未扫描');
  });

  it('clears persisted scan cache from settings and resets the last-scan status', async () => {
    mockLoadLastScanMeta.mockReset();
    mockLoadPersistentScanCacheSizeBytes.mockReset();
    mockLoadGeneratedAnalysisFileCacheSizeBytes.mockReset();
    mockClearGeneratedAnalysisFileCache.mockReset();
    mockLoadLastScanMeta
      .mockResolvedValueOnce({
        scannedAt: 1_710_100_000_000,
        scannedCount: 180,
        candidateCount: 12,
        highConfidenceCount: 8,
        mediumConfidenceCount: 4,
        recycleBinCount: 1,
      })
      .mockResolvedValue(null);
    mockLoadPersistentScanCacheSizeBytes
      .mockResolvedValueOnce(5 * 1024 * 1024)
      .mockResolvedValue(0);
    mockLoadGeneratedAnalysisFileCacheSizeBytes.mockResolvedValue(0);

    const renderer = await renderScreen();

    await act(async () => {
      renderer.root.findByProps({ testID: 'clear-persistent-scan-cache-button' }).props.onPress();
      await flushPromises();
    });

    expect(mockClearPersistentScanCache).toHaveBeenCalledTimes(1);
    expect(mockClearGeneratedAnalysisFileCache).toHaveBeenCalledTimes(1);
    expect(collectRenderedTexts(renderer)).toContain('尚未扫描');
    expect(collectRenderedTexts(renderer)).toContain('清除缓存');
    expect(collectRenderedTexts(renderer)).toContain('清除');
  });

  it('shows the estimated persistent cache size inline for the clear-cache action', async () => {
    const renderer = await renderScreen();

    expect(collectRenderedTexts(renderer)).toContain('清除缓存 5.0 MB');
    expect(collectRenderedTexts(renderer)).toContain('清除');
  });

  it('includes generated analysis file cache bytes in the clear-cache estimate', async () => {
    mockLoadPersistentScanCacheSizeBytes.mockResolvedValue(5 * 1024 * 1024);
    mockLoadGeneratedAnalysisFileCacheSizeBytes.mockResolvedValue(2 * 1024 * 1024);

    const renderer = await renderScreen();

    expect(collectRenderedTexts(renderer)).toContain('清除缓存 7.0 MB');
  });

  it('shows a follow-system language option using the current resolved language', async () => {
    const renderer = await renderScreen();

    expect(collectRenderedTexts(renderer)).toContain('跟随系统（当前：简体中文）');
  });
});

describe('SettingsScreen support logic', () => {
  it('keeps the supported scan range presets stable', () => {
    expect(scanRangeStorage.VALID_SCAN_RANGES).toEqual([1, 2, 3, 6, 12]);
  });

  it('builds safe-area aware layout paddings for notch and gesture insets', () => {
    expect(
      buildSettingsScreenLayout({
        top: 26,
        bottom: 24,
        left: 30,
        right: 26,
      }),
    ).toEqual({
      headerTop: 42,
      contentBottom: 124,
      left: 46,
      right: 42,
    });
  });

  it('keeps the localized never-scanned copy stable in both supported languages', () => {
    expect(getAppCopy('zh-CN').common.neverScanned).toBe('尚未扫描');
    expect(getAppCopy('en-US').common.neverScanned).toBe('Not scanned yet');
  });
});
