import React, { useEffect, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { MainTabNavigator } from './MainTabNavigator';
import type { RootStackParamList } from './types';
import { LandingScreen } from '../ui/screens/LandingScreen';
import { loadHasEnteredWorkspace } from '../services/storage/workspace-entry-storage';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
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
        console.warn('Failed to load workspace entry state, fallback to Main.', error);
        if (!disposed) {
          setInitialRouteName('Main');
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
    <Stack.Navigator initialRouteName={initialRouteName} screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Landing" component={LandingScreen} />
      <Stack.Screen name="Main" component={MainTabNavigator} />
    </Stack.Navigator>
  );
}
