import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

import type { MainTabParamList } from './types';
import { TabBar } from '../ui/components/TabBar';
import { PhotoGridScreen } from '../ui/screens/PhotoGridScreen';
import { RecycleBinScreen } from '../ui/screens/RecycleBinScreen';
import { SettingsScreen } from '../ui/screens/SettingsScreen';
import { useAppPreferences } from '../application/AppPreferencesContext';
import { loadRecycleBinIds } from '../services/storage/app-storage';

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainTabNavigator() {
  const appPreferences = useAppPreferences() as ReturnType<typeof useAppPreferences> & {
    recycleBinIds?: string[];
  };
  const { copy, theme } = appPreferences;
  const [recycleBinIds, setRecycleBinIds] = useState<string[]>(() => appPreferences.recycleBinIds ?? []);
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

  const renderPhotoGridScreen = useCallback(
    () => (
      <PhotoGridScreen
        recycleBinIds={recycleBinIds}
        onRecycleBinIdsChange={setRecycleBinIds}
      />
    ),
    [recycleBinIds],
  );

  const renderRecycleBinScreen = useCallback(
    () => (
      <RecycleBinScreen
        recycleBinIds={recycleBinIds}
        onRecycleBinIdsChange={setRecycleBinIds}
      />
    ),
    [recycleBinIds],
  );

  return (
    <Tab.Navigator
      id="main-tabs"
      screenOptions={{
        headerShown: false,
      }}
      tabBar={({ state, navigation }) => (
        <TabBar
          tabs={tabs}
          activeTab={state.routes[state.index].name}
          onTabPress={(name) => {
            void refreshRecycleBinIds();
            const route = state.routes.find(r => r.name === name);
            if (route) {
              navigation.navigate(route.name);
            }
          }}
          theme={theme}
        />
      )}
    >
      <Tab.Screen name="Photos">{renderPhotoGridScreen}</Tab.Screen>
      <Tab.Screen name="RecycleBin">{renderRecycleBinScreen}</Tab.Screen>
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}
