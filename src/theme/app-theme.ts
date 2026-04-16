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
  buttonSecondaryBackground: string;
  buttonSecondaryText: string;
  buttonTertiaryBackground: string;
  buttonTertiaryText: string;
  buttonDangerBackground: string;
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

const LIGHT_THEME: AppThemePalette = {
  scheme: 'light',
  statusBarStyle: 'dark',
  safeArea: '#f3ecdf',
  orbTop: '#d8e7df',
  orbBottom: '#f2d4c6',
  heroBackground: '#173944',
  heroSurface: '#102a33',
  heroAccent: '#9ed3c7',
  heroTitle: '#fff7ec',
  heroText: '#dce6e5',
  heroHint: '#bfcdcf',
  pageTextPrimary: '#18212f',
  pageTextSecondary: '#546272',
  pageTextMuted: '#7c8595',
  cardBackground: '#fffaf1',
  cardBorder: '#e7dcc7',
  cardMutedBackground: '#f6f7fb',
  cardMutedBorder: '#d8dce8',
  infoBackground: '#eef3f5',
  infoBorder: '#d8e2e6',
  noticeBackground: '#fff1e8',
  noticeBorder: '#efc9b4',
  noticeTitle: '#7d3f22',
  noticeText: '#965a3a',
  inputBackground: '#f8f4ea',
  inputBorder: '#d9cfbe',
  inputText: '#18212f',
  buttonPrimaryBackground: '#173944',
  buttonPrimaryText: '#ffffff',
  buttonSecondaryBackground: '#efe6d6',
  buttonSecondaryText: '#28404c',
  buttonTertiaryBackground: '#304856',
  buttonTertiaryText: '#e2edf0',
  buttonDangerBackground: '#b34f2f',
  buttonDangerText: '#ffffff',
  chipBackground: '#efe6d6',
  chipBorder: '#e1d5c2',
  chipText: '#304856',
  chipActiveBackground: '#173944',
  chipActiveText: '#ffffff',
  tabBackground: '#e9e1d2',
  tabText: '#596171',
  tabActiveBackground: '#173944',
  tabActiveText: '#ffffff',
  actionBarBackground: '#142a33',
  actionBarText: '#fff7ec',
  shadowColor: '#0f172a',
  thumbnailBackground: '#d8d2c5',
  previewBackground: '#141c28',
};

const DARK_THEME: AppThemePalette = {
  scheme: 'dark',
  statusBarStyle: 'light',
  safeArea: '#0d1218',
  orbTop: '#17303a',
  orbBottom: '#3d2430',
  heroBackground: '#0f2b34',
  heroSurface: '#142f38',
  heroAccent: '#82cfc1',
  heroTitle: '#f8f5ec',
  heroText: '#d2e0de',
  heroHint: '#9cb0b4',
  pageTextPrimary: '#edf2f7',
  pageTextSecondary: '#b6c2cf',
  pageTextMuted: '#8e9bab',
  cardBackground: '#161d26',
  cardBorder: '#283342',
  cardMutedBackground: '#19222d',
  cardMutedBorder: '#304052',
  infoBackground: '#152029',
  infoBorder: '#2d3d4c',
  noticeBackground: '#37231f',
  noticeBorder: '#6a3b31',
  noticeTitle: '#ffc8b5',
  noticeText: '#f2b29a',
  inputBackground: '#121922',
  inputBorder: '#334155',
  inputText: '#edf2f7',
  buttonPrimaryBackground: '#82cfc1',
  buttonPrimaryText: '#0f1d24',
  buttonSecondaryBackground: '#22303c',
  buttonSecondaryText: '#dce7ef',
  buttonTertiaryBackground: '#35485c',
  buttonTertiaryText: '#eef4f8',
  buttonDangerBackground: '#c9654a',
  buttonDangerText: '#fff7f1',
  chipBackground: '#22303c',
  chipBorder: '#36475b',
  chipText: '#d5e3ea',
  chipActiveBackground: '#82cfc1',
  chipActiveText: '#0f1d24',
  tabBackground: '#1a2430',
  tabText: '#9fb0c0',
  tabActiveBackground: '#82cfc1',
  tabActiveText: '#0f1d24',
  actionBarBackground: '#111b24',
  actionBarText: '#edf2f7',
  shadowColor: '#000000',
  thumbnailBackground: '#2d3846',
  previewBackground: '#05080d',
};

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
  return scheme === 'dark' ? DARK_THEME : LIGHT_THEME;
}
