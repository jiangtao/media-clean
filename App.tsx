import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import {
  AppPreferencesProvider,
  useAppPreferences,
} from './src/application/AppPreferencesContext';
import { CleanupReminderBootstrap } from './src/application/CleanupReminderBootstrap';
import { AppErrorBoundary } from './src/application/AppErrorBoundary';
import { RootNavigator } from './src/navigation/RootNavigator';

function AppShell() {
  const { resolvedThemeScheme, theme } = useAppPreferences();

  const navigationTheme = resolvedThemeScheme === 'dark'
    ? {
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          background: theme.safeArea,
          card: theme.cardBackground,
          border: theme.cardBorder,
          primary: theme.buttonPrimaryBackground,
          text: theme.pageTextPrimary,
          notification: theme.buttonDangerBackground,
        },
      }
    : {
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          background: theme.safeArea,
          card: theme.cardBackground,
          border: theme.cardBorder,
          primary: theme.buttonPrimaryBackground,
          text: theme.pageTextPrimary,
          notification: theme.buttonDangerBackground,
        },
      };

  return (
    <NavigationContainer theme={navigationTheme}>
      <StatusBar style={theme.statusBarStyle} />
      <CleanupReminderBootstrap />
      <RootNavigator />
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppPreferencesProvider>
          <AppErrorBoundary>
            <AppShell />
          </AppErrorBoundary>
        </AppPreferencesProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
