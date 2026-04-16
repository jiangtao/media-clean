import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  normalizeThemePreference,
  type AppThemePreference,
} from '../../theme/app-theme';

const APP_THEME_PREFERENCE_KEY = 'app-cleaner/theme-preference';

export async function loadThemePreference(): Promise<AppThemePreference> {
  const value = await AsyncStorage.getItem(APP_THEME_PREFERENCE_KEY);
  return normalizeThemePreference(value);
}

export async function saveThemePreference(preference: AppThemePreference): Promise<void> {
  await AsyncStorage.setItem(APP_THEME_PREFERENCE_KEY, preference);
}
