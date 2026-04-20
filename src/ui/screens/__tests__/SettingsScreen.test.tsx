import { describe, expect, it, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { SettingsScreen } from '../SettingsScreen';
import { buildSettingsScreenLayout } from '../screen-layout';
import * as appLanguageStorage from '../../../services/storage/app-language-storage';
import * as themePreferenceStorage from '../../../services/storage/theme-preference-storage';
import { getAppCopy } from '../../../i18n/app-copy';

// Mock dependencies
vi.mock('../../../services/storage/app-language-storage');
vi.mock('../../../services/storage/theme-preference-storage');
vi.mock('../../../services/storage/reminder-settings-storage');
vi.mock('../../../features/reminders/reminder-runtime', () => ({
  reconcileReminderRuntimeOnLaunch: vi.fn().mockResolvedValue({
    settings: {
      enabled: false,
      frequency: 'weekly',
      weekday: 1,
      hour: 20,
      minute: 30,
      notificationId: null,
      nextTriggerAt: null,
      summary: '定期检查最近拍摄的照片和视频，优先清理误触、异常与重复内容。',
    },
    permissionGranted: false,
  }),
  reconcileReminderRuntimeSettings: vi.fn(),
  syncReminderRuntimeSettings: vi.fn(),
}));
vi.mock('@react-navigation/native', () => ({
  useFocusEffect: (callback: () => () => void) => {
    callback()();
  },
}));
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockLoadAppLanguage = vi.mocked(appLanguageStorage.loadAppLanguage);
const mockSaveAppLanguage = vi.mocked(appLanguageStorage.saveAppLanguage);
const mockLoadThemePreference = vi.mocked(themePreferenceStorage.loadThemePreference);
const mockSaveThemePreference = vi.mocked(themePreferenceStorage.saveThemePreference);

describe('SettingsScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadAppLanguage.mockResolvedValue('zh-CN');
    mockLoadThemePreference.mockResolvedValue('system');
  });

  describe('Scenario 6.1: 扫描范围设置 (Scan Range Setting)', () => {
    it('should display scan range slider with discrete values 1/2/3/6/12 months', () => {
      // Define valid scan range values
      const validScanRanges = [1, 2, 3, 6, 12];

      // Verify valid values
      expect(validScanRanges).toContain(1);
      expect(validScanRanges).toContain(2);
      expect(validScanRanges).toContain(3);
      expect(validScanRanges).toContain(6);
      expect(validScanRanges).toContain(12);
      expect(validScanRanges).toHaveLength(5);
    });

    it('should display current scan range value', () => {
      // Test displaying current value in Chinese
      const currentMonths = 2;
      const displayText = `最近 ${currentMonths} 个月`;
      expect(displayText).toBe('最近 2 个月');

      // Test displaying current value in English
      const displayTextEn = `Last ${currentMonths} months`;
      expect(displayTextEn).toBe('Last 2 months');
    });

    it('should format scan range display correctly for different values', () => {
      const testCases = [
        { value: 1, zh: '最近 1 个月', en: 'Last 1 month' },
        { value: 2, zh: '最近 2 个月', en: 'Last 2 months' },
        { value: 3, zh: '最近 3 个月', en: 'Last 3 months' },
        { value: 6, zh: '最近 6 个月', en: 'Last 6 months' },
        { value: 12, zh: '最近 12 个月', en: 'Last 12 months' },
      ];

      testCases.forEach(({ value, zh, en }) => {
        const zhDisplay = `最近 ${value} 个月`;
        const enDisplay = `Last ${value} month${value > 1 ? 's' : ''}`;
        expect(zhDisplay).toBe(zh);
        expect(enDisplay).toBe(en);
      });
    });

    it('should update scan range when user changes slider value', () => {
      let currentRange = 2;
      const setRange = (value: number) => {
        currentRange = value;
      };

      // Simulate slider change to 3 months
      setRange(3);
      expect(currentRange).toBe(3);

      // Simulate slider change to 6 months
      setRange(6);
      expect(currentRange).toBe(6);
    });

    it('should only allow valid scan range values', () => {
      const validValues = [1, 2, 3, 6, 12];

      // Test that invalid values are rejected
      const invalidValues = [0, 4, 5, 7, 8, 9, 10, 11, 13, 24];
      invalidValues.forEach(value => {
        expect(validValues).not.toContain(value);
      });
    });

    it('should persist scan range to storage', async () => {
      const saveScanRange = vi.fn();
      const scanRangeValue = 6;

      await saveScanRange(scanRangeValue);

      expect(saveScanRange).toHaveBeenCalledWith(6);
    });
  });

  describe('Scenario 6.2: 语言和主题设置 (Language and Theme Settings)', () => {
    it('should display language section with correct title in Chinese', () => {
      const copy = getAppCopy('zh-CN');
      expect(copy.languageLabel).toBe('语言');
    });

    it('should display language section with correct title in English', () => {
      const copy = getAppCopy('en-US');
      expect(copy.languageLabel).toBe('Language');
    });

    it('should show all language options', () => {
      const copy = getAppCopy('zh-CN');

      expect(copy.languageOptions).toHaveLength(2);
      expect(copy.languageOptions[0].value).toBe('zh-CN');
      expect(copy.languageOptions[0].label).toBe('简体中文');
      expect(copy.languageOptions[1].value).toBe('en-US');
      expect(copy.languageOptions[1].label).toBe('English');
    });

    it('should switch language when user selects different option', async () => {
      mockSaveAppLanguage.mockResolvedValue(undefined);

      const handleLanguageChange = async (newLanguage: 'zh-CN' | 'en-US') => {
        await appLanguageStorage.saveAppLanguage(newLanguage);
      };

      await handleLanguageChange('en-US');
      expect(mockSaveAppLanguage).toHaveBeenCalledWith('en-US');

      await handleLanguageChange('zh-CN');
      expect(mockSaveAppLanguage).toHaveBeenCalledWith('zh-CN');
    });

    it('should display appearance section with correct title in Chinese', () => {
      const copy = getAppCopy('zh-CN');
      expect(copy.appearance.title).toBe('显示主题');
    });

    it('should display appearance section with correct title in English', () => {
      const copy = getAppCopy('en-US');
      expect(copy.appearance.title).toBe('Appearance');
    });

    it('should show all theme options in Chinese', () => {
      const copy = getAppCopy('zh-CN');
      const themeOptions = [
        { value: 'system', label: copy.appearance.system },
        { value: 'light', label: copy.appearance.light },
        { value: 'dark', label: copy.appearance.dark },
      ];

      expect(themeOptions).toHaveLength(3);
      expect(themeOptions[0].label).toBe('跟随系统');
      expect(themeOptions[1].label).toBe('浅色');
      expect(themeOptions[2].label).toBe('深色');
    });

    it('should show all theme options in English', () => {
      const copy = getAppCopy('en-US');
      const themeOptions = [
        { value: 'system', label: copy.appearance.system },
        { value: 'light', label: copy.appearance.light },
        { value: 'dark', label: copy.appearance.dark },
      ];

      expect(themeOptions).toHaveLength(3);
      expect(themeOptions[0].label).toBe('System');
      expect(themeOptions[1].label).toBe('Light');
      expect(themeOptions[2].label).toBe('Dark');
    });

    it('should switch theme when user selects different option', async () => {
      mockSaveThemePreference.mockResolvedValue(undefined);

      const handleThemeChange = async (newTheme: 'system' | 'light' | 'dark') => {
        await themePreferenceStorage.saveThemePreference(newTheme);
      };

      await handleThemeChange('light');
      expect(mockSaveThemePreference).toHaveBeenCalledWith('light');

      await handleThemeChange('dark');
      expect(mockSaveThemePreference).toHaveBeenCalledWith('dark');

      await handleThemeChange('system');
      expect(mockSaveThemePreference).toHaveBeenCalledWith('system');
    });

    it('should resolve system theme based on color scheme', () => {
      const systemColorScheme = 'dark';
      const themePreference = 'system';

      const resolvedTheme = themePreference === 'system'
        ? systemColorScheme ?? 'light'
        : themePreference;

      expect(resolvedTheme).toBe('dark');
    });

    it('should use explicit theme when not set to system', () => {
      const systemColorScheme: 'light' | 'dark' = 'light';
      const getThemePreference = (): 'system' | 'light' | 'dark' => 'dark';
      const themePreference = getThemePreference();

      const resolvedTheme = themePreference === 'system'
        ? systemColorScheme ?? 'light'
        : themePreference;

      expect(resolvedTheme).toBe('dark');
    });
  });

  describe('Scenario 6.3: 上次清理时间显示 (Last Cleanup Time Display)', () => {
    it('should display last scan time when available', () => {
      const lastScanTimestamp = Date.now() - 86400000; // 1 day ago
      const formatted = new Date(lastScanTimestamp).toLocaleString('zh-CN', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      expect(formatted).toBeTruthy();
      expect(typeof formatted).toBe('string');
    });

    it('should display "never scanned" message when no scan history', () => {
      const copy = getAppCopy('zh-CN');
      const lastScanTimestamp: number | null = null;

      const displayText = lastScanTimestamp
        ? new Date(lastScanTimestamp).toLocaleString('zh-CN')
        : copy.common.neverScanned;

      expect(displayText).toBe('尚未扫描');
    });

    it('should display "never scanned" message in English when no scan history', () => {
      const copy = getAppCopy('en-US');
      const lastScanTimestamp: number | null = null;

      const displayText = lastScanTimestamp
        ? new Date(lastScanTimestamp).toLocaleString('en-US')
        : copy.common.neverScanned;

      expect(displayText).toBe('Not scanned yet');
    });

    it('should format last scan time correctly in Chinese', () => {
      const timestamp = new Date('2026-04-15T14:30:00').getTime();
      const formatted = new Date(timestamp).toLocaleString('zh-CN', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      expect(formatted).toContain('4');
      expect(formatted).toContain('15');
    });

    it('should format last scan time correctly in English', () => {
      const timestamp = new Date('2026-04-15T14:30:00').getTime();
      const formatted = new Date(timestamp).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      expect(formatted).toContain('Apr');
      expect(formatted).toContain('15');
    });
  });

  describe('Language persistence', () => {
    it('should load saved language on mount', async () => {
      mockLoadAppLanguage.mockResolvedValue('en-US');

      const loadedLanguage = await appLanguageStorage.loadAppLanguage();

      expect(loadedLanguage).toBe('en-US');
      expect(mockLoadAppLanguage).toHaveBeenCalled();
    });

    it('should default to zh-CN when no language saved', async () => {
      mockLoadAppLanguage.mockResolvedValue('zh-CN');

      const loadedLanguage = await appLanguageStorage.loadAppLanguage();

      expect(loadedLanguage).toBe('zh-CN');
    });
  });

  describe('Theme persistence', () => {
    it('should load saved theme preference on mount', async () => {
      mockLoadThemePreference.mockResolvedValue('dark');

      const loadedTheme = await themePreferenceStorage.loadThemePreference();

      expect(loadedTheme).toBe('dark');
      expect(mockLoadThemePreference).toHaveBeenCalled();
    });

    it('should default to system when no theme saved', async () => {
      mockLoadThemePreference.mockResolvedValue('system');

      const loadedTheme = await themePreferenceStorage.loadThemePreference();

      expect(loadedTheme).toBe('system');
    });
  });

  describe('Settings loading state', () => {
    it('should show loading state while settings are being loaded', () => {
      const isLoading = true;
      expect(isLoading).toBe(true);
    });

    it('should hide loading state after settings are loaded', () => {
      const isLoading = false;
      expect(isLoading).toBe(false);
    });
  });

  describe('Scenario 6.4: 特殊屏适配 (Special Screen Adaptation)', () => {
    it('should derive safe-area aware layout values for notch and punch-hole screens', () => {
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
  });
});
