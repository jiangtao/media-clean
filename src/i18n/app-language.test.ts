import { afterEach, describe, expect, it, vi } from 'vitest';

import { detectPreferredAppLanguage, normalizeAppLanguage } from './app-language';

describe('app language', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('normalizes english locales to en-US and all others to zh-CN', () => {
    expect(normalizeAppLanguage('en')).toBe('en-US');
    expect(normalizeAppLanguage('en-GB')).toBe('en-US');
    expect(normalizeAppLanguage('zh-CN')).toBe('zh-CN');
    expect(normalizeAppLanguage('fr-FR')).toBe('zh-CN');
    expect(normalizeAppLanguage('')).toBe('zh-CN');
    expect(normalizeAppLanguage(null)).toBe('zh-CN');
  });

  it('detects the preferred app language from Intl when available', () => {
    vi.stubGlobal('Intl', {
      DateTimeFormat: () => ({
        resolvedOptions: () => ({ locale: 'en-GB' }),
      }),
    });

    expect(detectPreferredAppLanguage()).toBe('en-US');
  });

  it('falls back to zh-CN when Intl detection fails', () => {
    vi.stubGlobal('Intl', {
      DateTimeFormat: () => ({
        resolvedOptions: () => {
          throw new Error('unsupported');
        },
      }),
    });

    expect(detectPreferredAppLanguage()).toBe('zh-CN');
  });
});
