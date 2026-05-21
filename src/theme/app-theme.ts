import { GENERATED_APP_THEMES } from './generated/app-theme.generated';

export const APP_THEME_PREFERENCES = ['system', 'light', 'dark'] as const;

export type AppThemePreference = (typeof APP_THEME_PREFERENCES)[number];
export type AppThemeScheme = 'light' | 'dark';

export interface AppThemePalette {
  scheme: AppThemeScheme;
  statusBarStyle: 'dark' | 'light';
  safeArea: string;
  orbTop: string;
  orbBottom: string;
  heroBackground: string;
  heroSurface: string;
  heroAccent: string;
  heroTitle: string;
  heroText: string;
  heroHint: string;
  pageTextPrimary: string;
  pageTextSecondary: string;
  pageTextMuted: string;
  cardBackground: string;
  cardBorder: string;
  cardMutedBackground: string;
  cardMutedBorder: string;
  infoBackground: string;
  infoBorder: string;
  noticeBackground: string;
  noticeBorder: string;
  noticeTitle: string;
  noticeText: string;
  inputBackground: string;
  inputBorder: string;
  inputText: string;
  buttonPrimaryBackground: string;
  buttonPrimaryText: string;
  buttonSuccessBackground: string;
  buttonSuccessPressedBackground: string;
  buttonSecondaryBackground: string;
  buttonSecondaryText: string;
  buttonTertiaryBackground: string;
  buttonTertiaryText: string;
  buttonDangerBackground: string;
  buttonDangerPressedBackground: string;
  buttonDangerText: string;
  chipBackground: string;
  chipBorder: string;
  chipText: string;
  chipActiveBackground: string;
  chipActiveText: string;
  tabBackground: string;
  tabText: string;
  tabActiveBackground: string;
  tabActiveText: string;
  actionBarBackground: string;
  actionBarText: string;
  shadowColor: string;
  thumbnailBackground: string;
  previewBackground: string;
}

export function normalizeThemePreference(input?: string | null): AppThemePreference {
  if (input === 'light' || input === 'dark') {
    return input;
  }

  return 'system';
}

export function resolveThemeScheme(
  preference: AppThemePreference,
  systemScheme?: 'light' | 'dark' | null,
): AppThemeScheme {
  if (preference === 'light' || preference === 'dark') {
    return preference;
  }

  return systemScheme === 'dark' ? 'dark' : 'light';
}

export function getAppTheme(scheme: AppThemeScheme): AppThemePalette {
  return GENERATED_APP_THEMES[scheme];
}
