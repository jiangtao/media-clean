import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';

vi.unmock('./app-theme');
vi.unmock('./src/theme/app-theme');

import { getAppTheme, normalizeThemePreference, resolveThemeScheme } from './app-theme';
import type { AppThemePalette } from './app-theme';

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const paletteKeys: Array<keyof AppThemePalette> = [
  'scheme',
  'statusBarStyle',
  'safeArea',
  'orbTop',
  'orbBottom',
  'heroBackground',
  'heroSurface',
  'heroAccent',
  'heroTitle',
  'heroText',
  'heroHint',
  'pageTextPrimary',
  'pageTextSecondary',
  'pageTextMuted',
  'cardBackground',
  'cardBorder',
  'cardMutedBackground',
  'cardMutedBorder',
  'infoBackground',
  'infoBorder',
  'noticeBackground',
  'noticeBorder',
  'noticeTitle',
  'noticeText',
  'inputBackground',
  'inputBorder',
  'inputText',
  'buttonPrimaryBackground',
  'buttonPrimaryText',
  'buttonSuccessBackground',
  'buttonSuccessPressedBackground',
  'buttonSecondaryBackground',
  'buttonSecondaryText',
  'buttonTertiaryBackground',
  'buttonTertiaryText',
  'buttonDangerBackground',
  'buttonDangerPressedBackground',
  'buttonDangerText',
  'chipBackground',
  'chipBorder',
  'chipText',
  'chipActiveBackground',
  'chipActiveText',
  'tabBackground',
  'tabText',
  'tabActiveBackground',
  'tabActiveText',
  'actionBarBackground',
  'actionBarText',
  'shadowColor',
  'thumbnailBackground',
  'previewBackground',
];

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

  it('keeps the full palette shape stable for token migration', () => {
    expect(Object.keys(getAppTheme('light')).sort()).toEqual([...paletteKeys].sort());
    expect(Object.keys(getAppTheme('dark')).sort()).toEqual([...paletteKeys].sort());
  });

  it('keeps current light theme baseline values for UI refactors', () => {
    expect(getAppTheme('light')).toMatchObject({
      scheme: 'light',
      statusBarStyle: 'dark',
      safeArea: '#f5f7fb',
      heroBackground: '#ffffff',
      pageTextPrimary: '#17213a',
      pageTextSecondary: '#6d7891',
      cardBackground: '#ffffff',
      cardBorder: '#e7edf7',
      buttonPrimaryBackground: '#2f80ff',
      buttonDangerBackground: '#ff2f3a',
      chipActiveBackground: '#e5edff',
      tabActiveBackground: '#2f80ff',
      thumbnailBackground: '#dfe6f1',
      previewBackground: '#141c28',
    });
  });

  it('keeps current dark theme baseline values for UI refactors', () => {
    expect(getAppTheme('dark')).toMatchObject({
      scheme: 'dark',
      statusBarStyle: 'light',
      safeArea: '#0a1020',
      heroBackground: '#151d2e',
      pageTextPrimary: '#f2f5ff',
      pageTextSecondary: '#aab6ce',
      cardBackground: '#151d2e',
      cardBorder: '#26324a',
      buttonPrimaryBackground: '#4f7cff',
      buttonDangerBackground: '#dd3038',
      chipActiveBackground: '#223a78',
      tabActiveBackground: '#4f7cff',
      thumbnailBackground: '#222d42',
      previewBackground: '#05080d',
    });
  });

  it('generates the RN app theme from the token source without changing the facade shape', async () => {
    const { GENERATED_APP_THEMES } = await import('./generated/app-theme.generated');

    expect(GENERATED_APP_THEMES.light).toEqual(getAppTheme('light'));
    expect(GENERATED_APP_THEMES.dark).toEqual(getAppTheme('dark'));
    expect(Object.keys(GENERATED_APP_THEMES.light).sort()).toEqual([...paletteKeys].sort());
    expect(Object.keys(GENERATED_APP_THEMES.dark).sort()).toEqual([...paletteKeys].sort());
  });

  it('keeps NativeWind vars, CSS variables, and Tailwind fragment generated from the same token source', async () => {
    const { NATIVEWIND_THEME_VARS, THEME_CSS_VARIABLES } = await import(
      './generated/nativewind-vars.generated'
    );
    const tailwindTheme = require('./generated/tailwind-theme.generated.cjs');

    expect(NATIVEWIND_THEME_VARS.light['--app-safe-area']).toBe(getAppTheme('light').safeArea);
    expect(NATIVEWIND_THEME_VARS.dark['--app-safe-area']).toBe(getAppTheme('dark').safeArea);
    expect(THEME_CSS_VARIABLES.light).toContain('--app-safe-area: #f5f7fb;');
    expect(THEME_CSS_VARIABLES.dark).toContain('--app-safe-area: #0a1020;');
    expect(tailwindTheme.theme.extend.colors.background).toBe('var(--app-safe-area)');
    expect(tailwindTheme.theme.extend.colors.foreground).toBe('var(--app-page-text-primary)');
    expect(tailwindTheme.theme.extend.colors.primary.DEFAULT).toBe(
      'var(--app-button-primary-background)',
    );
    expect(tailwindTheme.theme.extend.colors.primary.foreground).toBe(
      'var(--app-button-primary-text)',
    );
    expect(tailwindTheme.theme.extend.colors.app.safeArea).toBe('var(--app-safe-area)');
    expect(tailwindTheme.theme.extend.colors.app.skeleton.base).toBe('var(--app-skeleton-base)');

    expect(() =>
      execFileSync(process.execPath, ['scripts/theme/verify-theme-tokens.mjs'], {
        cwd: repoRoot,
        stdio: 'pipe',
      }),
    ).not.toThrow();
  });
});
