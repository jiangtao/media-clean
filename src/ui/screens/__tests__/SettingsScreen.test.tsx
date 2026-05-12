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
  useWindowDimensions: () => ({ width: 375, height: 812, scale: 3, fontScale: 1 }),
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
const mockSaveScanRange = vi.mocked(scanRangeStorage.saveScanRange);
const mockReconcileReminderRuntimeInForeground = vi.mocked(
  reminderRuntime.reconcileReminderRuntimeInForeground,
);
const mockReconcileReminderRuntimeSettings = vi.mocked(
  reminderRuntime.reconcileReminderRuntimeSettings,
);
const mockSyncReminderRuntimeSettings = vi.mocked(reminderRuntime.syncReminderRuntimeSettings);
const mockSetLanguage = vi.fn();
const mockSetThemePreference = vi.fn();
const ReactTestRenderer = TestRenderer;

const baselineReminderSettings = {
  enabled: true,
  frequency: 'weekly' as const,
  weekday: 1,
  hour: 20,
  minute: 30,
  notificationId: 'existing-reminder-id',
  nextTriggerAt: 1_710_000_000_000,
  summary: '定期检查最近拍摄的照片和视频，优先清理重复、模糊与相似内容。',
};

const baselineReminderRuntime = {
  settings: baselineReminderSettings,
  permissionGranted: true,
};

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

function expectRenderedTextContaining(
  renderer: ReturnType<typeof ReactTestRenderer.create>,
  expected: string,
) {
  expect(collectRenderedTexts(renderer).some((text: string) => text.includes(expected))).toBe(true);
}

describe('SettingsScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSetLanguage.mockResolvedValue(undefined);
    mockSetThemePreference.mockResolvedValue(undefined);

    mockUseAppPreferences.mockReturnValue({
      isReady: true,
      language: 'zh-CN',
      languagePreference: 'zh-CN',
      themePreference: 'system',
      resolvedThemeScheme: 'light',
      theme: getAppTheme('light'),
      copy: getAppCopy('zh-CN'),
      setLanguage: mockSetLanguage,
      setThemePreference: mockSetThemePreference,
    });
    mockLoadScanRange.mockResolvedValue(3);
    mockSaveScanRange.mockResolvedValue(undefined);
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
    mockReconcileReminderRuntimeInForeground.mockResolvedValue(baselineReminderRuntime);
    mockReconcileReminderRuntimeSettings.mockResolvedValue(baselineReminderRuntime);
    mockSyncReminderRuntimeSettings.mockResolvedValue(baselineReminderRuntime);
  });

  it('loads persisted scan state and reminder runtime on focus', async () => {
    const renderer = await renderScreen();
    const renderedTexts = collectRenderedTexts(renderer);

    expect(mockLoadScanRange).toHaveBeenCalled();
    expect(mockLoadLastScanMeta).toHaveBeenCalled();
    expect(mockReconcileReminderRuntimeInForeground).toHaveBeenCalledWith('zh-CN', {
      name: '定期清理提醒',
      description: '提醒你重新扫描最近媒体并清理重复、模糊与相似内容。',
    });
    expect(renderedTexts).toContain('最近 3 个月');
    expect(renderedTexts).toContain('24');
    expect(renderer.root.findAllByProps({ testID: 'scan-range-option-all-disabled' })).toHaveLength(0);
    expect(renderedTexts).toContain('每周一 20:30 提醒你检查识别结果');
  });

  it('shows the never-scanned copy when no scan history exists', async () => {
    mockLoadLastScanMeta.mockReset();
    mockLoadLastScanMeta.mockResolvedValue(null);

    const renderer = await renderScreen();

    expectRenderedTextContaining(renderer, '尚未扫描');
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
    expectRenderedTextContaining(renderer, '尚未扫描');
    expect(collectRenderedTexts(renderer)).toContain('缓存数据');
    expect(collectRenderedTexts(renderer)).toContain('清除');
  });

  it('shows the estimated persistent cache size inline for the clear-cache action', async () => {
    const renderer = await renderScreen();

    expect(collectRenderedTexts(renderer)).toContain('缓存数据');
    expect(collectRenderedTexts(renderer)).toContain('5.0 MB');
    expect(collectRenderedTexts(renderer)).toContain('清除');
  });

  it('includes generated analysis file cache bytes in the clear-cache estimate', async () => {
    mockLoadPersistentScanCacheSizeBytes.mockResolvedValue(5 * 1024 * 1024);
    mockLoadGeneratedAnalysisFileCacheSizeBytes.mockResolvedValue(2 * 1024 * 1024);

    const renderer = await renderScreen();

    expect(collectRenderedTexts(renderer)).toContain('7.0 MB');
  });

  it('shows design-aligned language and theme chips while keeping system choices visible', async () => {
    const renderer = await renderScreen();

    expect(collectRenderedTexts(renderer)).toContain('语言与主题');
    expect(collectRenderedTexts(renderer)).toContain('系统');
    expect(collectRenderedTexts(renderer)).toContain('简体中文');
    expect(collectRenderedTexts(renderer)).toContain('English');
    expect(collectRenderedTexts(renderer)).toContain('浅色');
    expect(collectRenderedTexts(renderer)).toContain('深色');
  });

  it('persists scan range changes and reconciles reminder runtime when reminders are active', async () => {
    const renderer = await renderScreen();

    await act(async () => {
      renderer.root.findByProps({ testID: 'scan-range-option-6' }).props.onPress();
      await flushPromises();
    });

    expect(mockSaveScanRange).toHaveBeenCalledWith(6);
    expect(mockReconcileReminderRuntimeSettings).toHaveBeenCalledWith(
      baselineReminderSettings,
      'zh-CN',
      {
        name: '定期清理提醒',
        description: '提醒你重新扫描最近媒体并清理重复、模糊与相似内容。',
      },
    );
  });

  it('keeps reminder enablement, cadence, and time controls wired to runtime sync', async () => {
    const renderer = await renderScreen();

    await act(async () => {
      renderer.root.findByProps({ testID: 'reminder-settings-toggle' }).props.onPress();
      await flushPromises();
    });

    expect(mockSyncReminderRuntimeSettings).toHaveBeenCalledWith(
      baselineReminderSettings,
      { enabled: false },
      'zh-CN',
      {
        name: '定期清理提醒',
        description: '提醒你重新扫描最近媒体并清理重复、模糊与相似内容。',
      },
      { requestPermissionOnEnable: false },
    );

    await act(async () => {
      renderer.root.findByProps({ testID: 'reminder-frequency-daily' }).props.onPress();
      await flushPromises();
    });

    expect(mockSyncReminderRuntimeSettings).toHaveBeenCalledWith(
      baselineReminderSettings,
      { frequency: 'daily' },
      'zh-CN',
      expect.any(Object),
    );

    await act(async () => {
      renderer.root.findByProps({ testID: 'reminder-time-0830' }).props.onPress();
      await flushPromises();
    });

    expect(mockSyncReminderRuntimeSettings).toHaveBeenCalledWith(
      baselineReminderSettings,
      { hour: 8, minute: 30 },
      'zh-CN',
      expect.any(Object),
    );
  });

  it('persists language and theme chip changes through preferences context', async () => {
    const renderer = await renderScreen();

    await act(async () => {
      renderer.root.findByProps({ testID: 'language-option-system' }).props.onPress();
      renderer.root.findByProps({ testID: 'language-option-en-US' }).props.onPress();
      renderer.root.findByProps({ testID: 'theme-option-dark' }).props.onPress();
      await flushPromises();
    });

    expect(mockSetLanguage).toHaveBeenCalledWith('system');
    expect(mockSetLanguage).toHaveBeenCalledWith('en-US');
    expect(mockSetThemePreference).toHaveBeenCalledWith('dark');
  });
});

describe('SettingsScreen support logic', () => {
  it('keeps the supported scan range presets stable', () => {
    expect(scanRangeStorage.VALID_SCAN_RANGES).toEqual([1, 2, 3, 6, 12, 24]);
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
      headerTop: 44,
      contentBottom: 116,
      left: 58,
      right: 54,
      contentWidth: 0,
      cardPadding: 12,
      cardGap: 14,
      chipMinWidth: 32,
      chipMinHeight: 24,
      isSELike: true,
    });
  });

  it('uses a compact SE typography and chip layout contract for 375pt windows', () => {
    expect(
      buildSettingsScreenLayout(
        { top: 0, bottom: 0, left: 0, right: 0 },
        { width: 375, height: 812, scale: 3, fontScale: 1 },
      ),
    ).toMatchObject({
      headerTop: 18,
      contentBottom: 92,
      left: 28,
      right: 28,
      contentWidth: 319,
      cardPadding: 12,
      cardGap: 14,
      chipMinWidth: 32,
      chipMinHeight: 24,
      isSELike: true,
    });
  });

  it('keeps settings cards centered instead of stretching on wide RN windows', () => {
    expect(
      buildSettingsScreenLayout(
        { top: 0, bottom: 0, left: 0, right: 0 },
        { width: 800, height: 1100, scale: 2, fontScale: 1 },
      ),
    ).toMatchObject({
      left: 80,
      right: 80,
      contentWidth: 640,
      isSELike: false,
      cardPadding: 30,
    });
  });

  it('keeps the localized never-scanned copy stable in both supported languages', () => {
    expect(getAppCopy('zh-CN').common.neverScanned).toBe('尚未扫描');
    expect(getAppCopy('en-US').common.neverScanned).toBe('Not scanned yet');
  });
});
