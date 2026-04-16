import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  loadThemePreference,
  saveThemePreference,
} from './theme-preference-storage';

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

describe('theme preference storage', () => {
  beforeEach(() => {
    getItem.mockReset();
    setItem.mockReset();
  });

  it('loads the stored preference when valid', async () => {
    getItem.mockResolvedValueOnce('dark');

    await expect(loadThemePreference()).resolves.toBe('dark');
  });

  it('falls back to system when nothing or invalid data is stored', async () => {
    getItem.mockResolvedValueOnce(null);
    await expect(loadThemePreference()).resolves.toBe('system');

    getItem.mockResolvedValueOnce('unknown');
    await expect(loadThemePreference()).resolves.toBe('system');
  });

  it('persists the selected theme preference', async () => {
    await saveThemePreference('light');

    expect(setItem).toHaveBeenCalledWith('app-cleaner/theme-preference', 'light');
  });
});
