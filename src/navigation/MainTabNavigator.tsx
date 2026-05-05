import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import type { MainTabParamList } from './types';
import { TabBar } from '../ui/components/TabBar';
import { PhotoGridScreen } from '../ui/screens/PhotoGridScreen';
import { RecycleBinScreen } from '../ui/screens/RecycleBinScreen';
import { SettingsScreen } from '../ui/screens/SettingsScreen';
import { useAppPreferences } from '../application/AppPreferencesContext';
import { loadRecycleBinIds } from '../services/storage/app-storage';

const Tab = createBottomTabNavigator<MainTabParamList>();

type MainTabScreenContextValue = {
  recycleBinIds: string[];
  onRecycleBinIdsChange: (ids: string[]) => void;
};

const MainTabScreenContext = createContext<MainTabScreenContextValue | null>(null);

function useMainTabScreenContext() {
  const context = useContext(MainTabScreenContext);
  if (!context) {
    throw new Error('MainTab screen context is unavailable.');
  }
  return context;
}

function PhotosTabScreen() {
  const { recycleBinIds, onRecycleBinIdsChange } = useMainTabScreenContext();
  return (
    <PhotoGridScreen
      recycleBinIds={recycleBinIds}
      onRecycleBinIdsChange={onRecycleBinIdsChange}
    />
  );
}

function RecycleBinTabScreen() {
  const { recycleBinIds, onRecycleBinIdsChange } = useMainTabScreenContext();
  return (
    <RecycleBinScreen
      recycleBinIds={recycleBinIds}
      onRecycleBinIdsChange={onRecycleBinIdsChange}
    />
  );
}

export function MainTabNavigator() {
  const appPreferences = useAppPreferences() as ReturnType<typeof useAppPreferences> & {
    recycleBinIds?: string[];
  };
  const { copy, theme } = appPreferences;
  const [recycleBinIds, setRecycleBinIds] = useState<string[]>(() => appPreferences.recycleBinIds ?? []);
  const [lastSelectedTab, setLastSelectedTab] = useState<keyof MainTabParamList>('Photos');
  const recycleBinCount = recycleBinIds.length;

  const refreshRecycleBinIds = useCallback(async () => {
    try {
      const nextRecycleBinIds = await loadRecycleBinIds();
      setRecycleBinIds(nextRecycleBinIds);
    } catch {
      setRecycleBinIds([]);
    }
  }, []);

  useEffect(() => {
    void refreshRecycleBinIds();
  }, [refreshRecycleBinIds]);

  useEffect(() => {
    if (appPreferences.recycleBinIds) {
      setRecycleBinIds(appPreferences.recycleBinIds);
    }
  }, [appPreferences.recycleBinIds]);

  const tabs = useMemo(() => [
    {
      name: 'Photos',
      label: copy.tabs.photos,
      icon: 'images-outline',
      activeIcon: 'images',
      badge: undefined,
    },
    {
      name: 'RecycleBin',
      label: copy.tabs.recycle,
      icon: 'trash-outline',
      activeIcon: 'trash',
      badge: recycleBinCount || undefined,
    },
    {
      name: 'Settings',
      label: copy.tabs.settings,
      icon: 'settings-outline',
      activeIcon: 'settings',
      badge: undefined,
    },
  ], [copy, recycleBinCount]);

  const screenContextValue = useMemo<MainTabScreenContextValue>(
    () => ({
      recycleBinIds,
      onRecycleBinIdsChange: setRecycleBinIds,
    }),
    [recycleBinIds],
  );

  return (
    <MainTabScreenContext.Provider value={screenContextValue}>
      <Tab.Navigator
        id="main-tabs"
        initialRouteName={lastSelectedTab}
        screenOptions={{
          headerShown: false,
        }}
        tabBar={({ state, navigation }) => (
          <TabBar
            tabs={tabs}
            activeTab={state.routes[state.index].name}
            onTabPress={(name) => {
              void refreshRecycleBinIds();
              setLastSelectedTab(name as keyof MainTabParamList);
              const route = state.routes.find(r => r.name === name);
              if (route) {
                navigation.navigate(route.name);
              }
            }}
            theme={theme}
          />
        )}
      >
        <Tab.Screen name="Photos" component={PhotosTabScreen} />
        <Tab.Screen name="RecycleBin" component={RecycleBinTabScreen} />
        <Tab.Screen name="Settings" component={SettingsScreen} />
      </Tab.Navigator>
    </MainTabScreenContext.Provider>
  );
}
