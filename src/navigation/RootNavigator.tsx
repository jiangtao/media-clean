import React, { useEffect, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { MainTabNavigator } from './MainTabNavigator';
import type { RootStackParamList } from './types';
import { useAppPreferences } from '../application/AppPreferencesContext';
import { LandingScreen } from '../ui/screens/LandingScreen';
import { loadHasEnteredWorkspace } from '../services/storage/workspace-entry-storage';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { theme } = useAppPreferences();
  const [initialRouteName, setInitialRouteName] = useState<keyof RootStackParamList | null>(null);

  useEffect(() => {
    let disposed = false;

    void (async () => {
      try {
        const hasEnteredWorkspace = await loadHasEnteredWorkspace();
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
      <Stack.Screen name="Landing" component={LandingScreen} />
      <Stack.Screen name="Main" component={MainTabNavigator} />
    </Stack.Navigator>
  );
}
