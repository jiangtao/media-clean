export const APP_LANGUAGE_CODES = ['zh-CN', 'en-US'] as const;

export type AppLanguage = (typeof APP_LANGUAGE_CODES)[number];

export function normalizeAppLanguage(input?: string | null): AppLanguage {
  const normalized = input?.trim().toLowerCase() ?? '';
  return normalized.startsWith('en') ? 'en-US' : 'zh-CN';
}

export function detectPreferredAppLanguage(): AppLanguage {
  try {
    return normalizeAppLanguage(Intl.DateTimeFormat().resolvedOptions().locale);
  } catch {
    return 'zh-CN';
  }
}
