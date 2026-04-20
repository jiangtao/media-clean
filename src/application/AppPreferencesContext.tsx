import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';

import type { AppLanguage } from '../i18n/app-language';
import { detectPreferredAppLanguage } from '../i18n/app-language';
import { getAppCopy } from '../i18n/app-copy';
import { loadAppLanguage, saveAppLanguage } from '../services/storage/app-language-storage';
import {
  loadThemePreference,
  saveThemePreference,
} from '../services/storage/theme-preference-storage';
import {
  getAppTheme,
  resolveThemeScheme,
  type AppThemePalette,
  type AppThemePreference,
  type AppThemeScheme,
} from '../theme/app-theme';

interface AppPreferencesContextValue {
  isReady: boolean;
  language: AppLanguage;
  themePreference: AppThemePreference;
  resolvedThemeScheme: AppThemeScheme;
  theme: AppThemePalette;
  copy: ReturnType<typeof getAppCopy>;
  setLanguage: (language: AppLanguage) => Promise<void>;
  setThemePreference: (preference: AppThemePreference) => Promise<void>;
}

const AppPreferencesContext = createContext<AppPreferencesContextValue | null>(null);

interface AppPreferencesProviderProps {
  children: React.ReactNode;
}

export function AppPreferencesProvider({ children }: AppPreferencesProviderProps) {
  const systemTheme = useColorScheme();
  const [isReady, setIsReady] = useState(false);
  const [language, setLanguageState] = useState<AppLanguage>(detectPreferredAppLanguage);
  const [themePreference, setThemePreferenceState] = useState<AppThemePreference>('system');

  useEffect(() => {
    let isActive = true;

    async function loadPreferences() {
      try {
        const [savedLanguage, savedThemePreference] = await Promise.all([
          loadAppLanguage(),
          loadThemePreference(),
        ]);

        if (!isActive) {
          return;
        }

        setLanguageState(savedLanguage);
        setThemePreferenceState(savedThemePreference);
      } catch (error) {
        console.error('Failed to load app preferences:', error);
      } finally {
        if (isActive) {
          setIsReady(true);
        }
      }
    }

    void loadPreferences();

    return () => {
      isActive = false;
    };
  }, []);

  const setLanguage = useCallback(async (nextLanguage: AppLanguage) => {
    setLanguageState(nextLanguage);

    try {
      await saveAppLanguage(nextLanguage);
    } catch (error) {
      console.error('Failed to save app language:', error);
    }
  }, []);

  const setThemePreference = useCallback(async (nextPreference: AppThemePreference) => {
    setThemePreferenceState(nextPreference);

    try {
      await saveThemePreference(nextPreference);
    } catch (error) {
      console.error('Failed to save theme preference:', error);
    }
  }, []);

  const resolvedThemeScheme = useMemo(
    () => resolveThemeScheme(themePreference, systemTheme),
    [systemTheme, themePreference],
  );
  const theme = useMemo(() => getAppTheme(resolvedThemeScheme), [resolvedThemeScheme]);
  const copy = useMemo(() => getAppCopy(language), [language]);

  const value = useMemo<AppPreferencesContextValue>(
    () => ({
      isReady,
      language,
      themePreference,
      resolvedThemeScheme,
      theme,
      copy,
      setLanguage,
      setThemePreference,
    }),
    [
      copy,
      isReady,
      language,
      resolvedThemeScheme,
      setLanguage,
      setThemePreference,
      theme,
      themePreference,
    ],
  );

  return <AppPreferencesContext.Provider value={value}>{children}</AppPreferencesContext.Provider>;
}

export function useAppPreferences(): AppPreferencesContextValue {
  const context = useContext(AppPreferencesContext);

  if (!context) {
    throw new Error('useAppPreferences must be used within AppPreferencesProvider');
  }

  return context;
}
