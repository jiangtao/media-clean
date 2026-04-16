import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  detectPreferredAppLanguage,
  normalizeAppLanguage,
  type AppLanguage,
} from '../../i18n/app-language';

const APP_LANGUAGE_KEY = 'app-cleaner/app-language';

export async function loadAppLanguage(): Promise<AppLanguage> {
  const value = await AsyncStorage.getItem(APP_LANGUAGE_KEY);
  return value ? normalizeAppLanguage(value) : detectPreferredAppLanguage();
}

export async function saveAppLanguage(language: AppLanguage): Promise<void> {
  await AsyncStorage.setItem(APP_LANGUAGE_KEY, language);
}
