import { normalizeAppLanguage, type AppLanguage } from './app-language';
import { APP_I18N_RESOURCES } from './resources.generated';

export type I18nLocaleDirectory = keyof typeof APP_I18N_RESOURCES;
export type I18nResourceBundle = (typeof APP_I18N_RESOURCES)[I18nLocaleDirectory];

export function resolveI18nResourceLanguage(input?: string | null): AppLanguage {
  return normalizeAppLanguage(input);
}

export function resolveI18nLocaleDirectory(input?: string | null): I18nLocaleDirectory {
  return resolveI18nResourceLanguage(input) === 'en-US' ? 'en' : 'zh';
}

export function loadI18nResources(input?: string | null): I18nResourceBundle {
  return APP_I18N_RESOURCES[resolveI18nLocaleDirectory(input)];
}
