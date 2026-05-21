import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AppState, useColorScheme } from 'react-native';

import type { AppLanguage, AppLanguagePreference } from '../i18n/app-language';
import {
  detectPreferredAppLanguage,
  resolveAppLanguagePreference,
} from '../i18n/app-language';
import { getAppCopy } from '../i18n/app-copy';
import {
  loadAppLanguagePreference,
  saveAppLanguagePreference,
} from '../services/storage/app-language-storage';
import {
  loadThemePreference,
  saveThemePreference,
} from '../services/storage/theme-preference-storage';
import { OBSERVABILITY_EVENTS } from '../services/observability/observability';
import { getAppObservability } from './observability';
import {
  getAppTheme,
  resolveThemeScheme,
  type AppThemePalette,
  type AppThemePreference,
  type AppThemeScheme,
} from '../theme/app-theme';

export interface AppPreferencesSnapshot {
  isReady: boolean;
  language: AppLanguage;
  languagePreference: AppLanguagePreference;
  themePreference: AppThemePreference;
  resolvedThemeScheme: AppThemeScheme;
  theme: AppThemePalette;
  copy: ReturnType<typeof getAppCopy>;
  setLanguage: (language: AppLanguagePreference) => Promise<void>;
  setThemePreference: (preference: AppThemePreference) => Promise<void>;
}

const AppPreferencesContext = createContext<AppPreferencesSnapshot | null>(null);

interface AppPreferencesProviderProps {
  children: React.ReactNode;
}

export function useManagedAppPreferencesState(): AppPreferencesSnapshot {
  const systemTheme = useColorScheme();
  const [isReady, setIsReady] = useState(false);
  const [language, setLanguageState] = useState<AppLanguage>(detectPreferredAppLanguage);
  const [languagePreference, setLanguagePreferenceState] =
    useState<AppLanguagePreference>('system');
  const [themePreference, setThemePreferenceState] = useState<AppThemePreference>('system');

  useEffect(() => {
    let isActive = true;

    async function loadPreferences() {
      try {
        const [savedLanguagePreference, savedThemePreference] = await Promise.all([
          loadAppLanguagePreference(),
          loadThemePreference(),
        ]);

        if (!isActive) {
          return;
        }

        setLanguagePreferenceState(savedLanguagePreference);
        setLanguageState(resolveAppLanguagePreference(savedLanguagePreference));
        setThemePreferenceState(savedThemePreference);
      } catch (error) {
        getAppObservability().trackError(
          OBSERVABILITY_EVENTS.appPreferencesLoadFailed,
          error,
          {
            source: 'AppPreferencesContext',
            operation: 'loadPreferences',
          },
        );
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

  useEffect(() => {
    if (languagePreference !== 'system') {
      return;
    }

    const handleAppStateChange = (nextState: string) => {
      if (nextState === 'active') {
        setLanguageState(detectPreferredAppLanguage());
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [languagePreference]);

  const setLanguage = useCallback(async (nextLanguagePreference: AppLanguagePreference) => {
    setLanguagePreferenceState(nextLanguagePreference);
    setLanguageState(resolveAppLanguagePreference(nextLanguagePreference));

    try {
      await saveAppLanguagePreference(nextLanguagePreference);
    } catch (error) {
      getAppObservability().trackError(
        OBSERVABILITY_EVENTS.appPreferencesSaveFailed,
        error,
        {
          source: 'AppPreferencesContext',
          preference: 'language',
        },
      );
      console.error('Failed to save app language:', error);
    }
  }, []);

  const setThemePreference = useCallback(async (nextPreference: AppThemePreference) => {
    setThemePreferenceState(nextPreference);

    try {
      await saveThemePreference(nextPreference);
    } catch (error) {
      getAppObservability().trackError(
        OBSERVABILITY_EVENTS.appPreferencesSaveFailed,
        error,
        {
          source: 'AppPreferencesContext',
          preference: 'theme',
        },
      );
      console.error('Failed to save theme preference:', error);
    }
  }, []);

  const resolvedThemeScheme = useMemo(
    () => resolveThemeScheme(themePreference, systemTheme),
    [systemTheme, themePreference],
  );
  const theme = useMemo(() => getAppTheme(resolvedThemeScheme), [resolvedThemeScheme]);
  const copy = useMemo(() => getAppCopy(language), [language]);

  return useMemo<AppPreferencesSnapshot>(
    () => ({
      isReady,
      language,
      languagePreference,
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
      languagePreference,
      resolvedThemeScheme,
      setLanguage,
      setThemePreference,
      theme,
      themePreference,
    ],
  );
}

export function AppPreferencesProvider({ children }: AppPreferencesProviderProps) {
  const value = useManagedAppPreferencesState();

  return <AppPreferencesContext.Provider value={value}>{children}</AppPreferencesContext.Provider>;
}

export function useAppPreferences(): AppPreferencesSnapshot {
  const context = useContext(AppPreferencesContext);

  if (!context) {
    throw new Error('useAppPreferences must be used within AppPreferencesProvider');
  }

  return context;
}
