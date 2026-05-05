export const APP_LANGUAGE_CODES = ['zh-CN', 'en-US'] as const;
export const APP_LANGUAGE_PREFERENCES = ['system', ...APP_LANGUAGE_CODES] as const;

export type AppLanguage = (typeof APP_LANGUAGE_CODES)[number];
export type AppLanguagePreference = (typeof APP_LANGUAGE_PREFERENCES)[number];

export function normalizeAppLanguage(input?: string | null): AppLanguage {
  const normalized = input?.trim().toLowerCase() ?? '';
  return normalized.startsWith('en') ? 'en-US' : 'zh-CN';
}

export function normalizeAppLanguagePreference(
  input?: string | null,
): AppLanguagePreference {
  return input === 'system' ? 'system' : normalizeAppLanguage(input);
}

export function detectPreferredAppLanguage(): AppLanguage {
  try {
    return normalizeAppLanguage(Intl.DateTimeFormat().resolvedOptions().locale);
  } catch {
    return 'zh-CN';
  }
}

export function resolveAppLanguagePreference(
  preference: AppLanguagePreference,
): AppLanguage {
  return preference === 'system' ? detectPreferredAppLanguage() : preference;
}
