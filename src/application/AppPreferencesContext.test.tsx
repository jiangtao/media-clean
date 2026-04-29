import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppPreferencesProvider, useAppPreferences } from './AppPreferencesContext';
import * as appLanguageStorage from '../services/storage/app-language-storage';
import * as themePreferenceStorage from '../services/storage/theme-preference-storage';

vi.mock('../services/storage/app-language-storage');
vi.mock('../services/storage/theme-preference-storage');
vi.mock('react-native', () => ({
  AppState: {
    addEventListener: vi.fn(() => ({
      remove: vi.fn(),
    })),
  },
  useColorScheme: () => 'dark',
}));

const mockLoadAppLanguagePreference = vi.mocked(appLanguageStorage.loadAppLanguagePreference);
const mockSaveAppLanguagePreference = vi.mocked(appLanguageStorage.saveAppLanguagePreference);
const mockLoadThemePreference = vi.mocked(themePreferenceStorage.loadThemePreference);
const mockSaveThemePreference = vi.mocked(themePreferenceStorage.saveThemePreference);

let latestSnapshot: ReturnType<typeof useAppPreferences> | null = null;

function PreferencesProbe() {
  latestSnapshot = useAppPreferences();

  return null;
}

describe('AppPreferencesContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    latestSnapshot = null;
    mockLoadAppLanguagePreference.mockResolvedValue('en-US');
    mockSaveAppLanguagePreference.mockResolvedValue(undefined);
    mockLoadThemePreference.mockResolvedValue('dark');
    mockSaveThemePreference.mockResolvedValue(undefined);
  });

  it('loads saved language and theme from storage into a shared app-level snapshot', async () => {
    await act(async () => {
      TestRenderer.create(
        <AppPreferencesProvider>
          <PreferencesProbe />
        </AppPreferencesProvider>,
      );
      await Promise.resolve();
    });

    expect(latestSnapshot?.copy.tabs.photos).toBe('Photos');
    expect(latestSnapshot?.languagePreference).toBe('en-US');
    expect(latestSnapshot?.theme.scheme).toBe('dark');
    expect(latestSnapshot?.themePreference).toBe('dark');
    expect(latestSnapshot?.resolvedThemeScheme).toBe('dark');

    expect(mockLoadAppLanguagePreference).toHaveBeenCalledTimes(1);
    expect(mockLoadThemePreference).toHaveBeenCalledTimes(1);
  });

  it('persists updates and exposes them immediately to consumers', async () => {
    await act(async () => {
      TestRenderer.create(
        <AppPreferencesProvider>
          <PreferencesProbe />
        </AppPreferencesProvider>,
      );
      await Promise.resolve();
    });

    await act(async () => {
      await latestSnapshot?.setLanguage('zh-CN');
      await latestSnapshot?.setThemePreference('light');
    });

    expect(latestSnapshot?.copy.tabs.photos).toBe('照片');
    expect(latestSnapshot?.theme.scheme).toBe('light');
    expect(latestSnapshot?.resolvedThemeScheme).toBe('light');

    expect(mockSaveAppLanguagePreference).toHaveBeenCalledWith('zh-CN');
    expect(mockSaveThemePreference).toHaveBeenCalledWith('light');
  });

  it('supports following the system language as a first-class preference', async () => {
    mockLoadAppLanguagePreference.mockResolvedValueOnce('system');

    await act(async () => {
      TestRenderer.create(
        <AppPreferencesProvider>
          <PreferencesProbe />
        </AppPreferencesProvider>,
      );
      await Promise.resolve();
    });

    await act(async () => {
      await latestSnapshot?.setLanguage('system');
    });

    expect(latestSnapshot?.languagePreference).toBe('system');
    expect(mockSaveAppLanguagePreference).toHaveBeenCalledWith('system');
  });
});
