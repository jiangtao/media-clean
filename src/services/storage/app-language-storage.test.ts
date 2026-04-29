import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  loadAppLanguage,
  loadAppLanguagePreference,
  saveAppLanguage,
  saveAppLanguagePreference,
} from './app-language-storage';

const { getItem, setItem } = vi.hoisted(() => ({
  getItem: vi.fn(),
  setItem: vi.fn(),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem,
    setItem,
  },
}));

describe('app language storage', () => {
  beforeEach(() => {
    getItem.mockReset();
    setItem.mockReset();
  });

  it('loads the stored language when available', async () => {
    getItem.mockResolvedValueOnce('en-US');

    await expect(loadAppLanguage()).resolves.toBe('en-US');
  });

  it('loads the stored language preference when available', async () => {
    getItem.mockResolvedValueOnce('system');

    await expect(loadAppLanguagePreference()).resolves.toBe('system');
  });

  it('falls back to the preferred app language when nothing is stored', async () => {
    getItem.mockResolvedValueOnce(null);

    await expect(loadAppLanguage()).resolves.toSatisfy((language) =>
      ['zh-CN', 'en-US'].includes(language),
    );
  });

  it('falls back to system preference when nothing is stored', async () => {
    getItem.mockResolvedValueOnce(null);

    await expect(loadAppLanguagePreference()).resolves.toBe('system');
  });

  it('persists the selected language', async () => {
    await saveAppLanguage('zh-CN');

    expect(setItem).toHaveBeenCalledWith('app-cleaner/app-language', 'zh-CN');
  });

  it('persists the selected language preference', async () => {
    await saveAppLanguagePreference('system');

    expect(setItem).toHaveBeenCalledWith('app-cleaner/app-language', 'system');
  });
});
