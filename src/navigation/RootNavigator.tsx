import React, { useEffect, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as SplashScreen from 'expo-splash-screen';

import { MainTabNavigator } from './MainTabNavigator';
import type { RootStackParamList } from './types';
import { useAppPreferences } from '../application/AppPreferencesContext';
import { loadHasEnteredWorkspace } from '../services/storage/workspace-entry-storage';
import { LandingScreen } from '../ui/screens/LandingScreen';
import { hydrateStartupPhotoScanState } from './startup-photo-scan-state';

const Stack = createNativeStackNavigator<RootStackParamList>();
void Promise.resolve(SplashScreen.preventAutoHideAsync()).catch(() => undefined);

function LandingStackScreen(props: React.ComponentProps<typeof LandingScreen>) {
  return <LandingScreen {...props} />;
}

export function RootNavigator() {
  const { theme } = useAppPreferences();
  const [initialRouteName, setInitialRouteName] = useState<keyof RootStackParamList | null>(null);

  useEffect(() => {
    let disposed = false;

    void (async () => {
      try {
        const hasEnteredWorkspace = await loadHasEnteredWorkspace();
        if (hasEnteredWorkspace) {
          await hydrateStartupPhotoScanState();
        }

        if (!disposed) {
          setInitialRouteName(hasEnteredWorkspace ? 'Main' : 'Landing');
        }
      } catch (error) {
        console.warn('Failed to load workspace entry state, fallback to Landing.', error);
        if (!disposed) {
          setInitialRouteName('Landing');
        }
      }
    })();

    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    if (initialRouteName === null) {
      return;
    }

    void Promise.resolve(SplashScreen.hideAsync()).catch(() => undefined);
  }, [initialRouteName]);

  if (initialRouteName === null) {
    return null;
  }

  return (
    <Stack.Navigator
      initialRouteName={initialRouteName}
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        contentStyle: {
          backgroundColor: theme.safeArea,
        },
      }}
    >
      <Stack.Screen name="Landing" component={LandingStackScreen} />
      <Stack.Screen name="Main" component={MainTabNavigator} />
    </Stack.Navigator>
  );
}
