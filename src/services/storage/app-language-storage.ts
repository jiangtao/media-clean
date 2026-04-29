import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  detectPreferredAppLanguage,
  normalizeAppLanguage,
  normalizeAppLanguagePreference,
  resolveAppLanguagePreference,
  type AppLanguage,
  type AppLanguagePreference,
} from '../../i18n/app-language';

const APP_LANGUAGE_KEY = 'app-cleaner/app-language';

export async function loadAppLanguage(): Promise<AppLanguage> {
  const preference = await loadAppLanguagePreference();
  return resolveAppLanguagePreference(preference);
}

export async function loadAppLanguagePreference(): Promise<AppLanguagePreference> {
  const value = await AsyncStorage.getItem(APP_LANGUAGE_KEY);
  return value ? normalizeAppLanguagePreference(value) : 'system';
}

export async function saveAppLanguagePreference(
  preference: AppLanguagePreference,
): Promise<void> {
  await AsyncStorage.setItem(APP_LANGUAGE_KEY, preference);
}

export async function saveAppLanguage(language: AppLanguage): Promise<void> {
  await saveAppLanguagePreference(normalizeAppLanguage(language));
}
