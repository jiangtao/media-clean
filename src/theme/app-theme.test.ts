import { describe, expect, it } from 'vitest';

import { getAppTheme, normalizeThemePreference, resolveThemeScheme } from './app-theme';

describe('app theme', () => {
  it('normalizes invalid theme preferences to system', () => {
    expect(normalizeThemePreference('light')).toBe('light');
    expect(normalizeThemePreference('dark')).toBe('dark');
    expect(normalizeThemePreference('system')).toBe('system');
    expect(normalizeThemePreference('sepia')).toBe('system');
    expect(normalizeThemePreference(null)).toBe('system');
  });

  it('resolves the final scheme from user preference and system theme', () => {
    expect(resolveThemeScheme('light', 'dark')).toBe('light');
    expect(resolveThemeScheme('dark', 'light')).toBe('dark');
    expect(resolveThemeScheme('system', 'dark')).toBe('dark');
    expect(resolveThemeScheme('system', 'light')).toBe('light');
    expect(resolveThemeScheme('system', null)).toBe('light');
  });

  it('returns a dark palette when the resolved scheme is dark', () => {
    expect(getAppTheme('dark').scheme).toBe('dark');
    expect(getAppTheme('dark').statusBarStyle).toBe('light');
  });
});
