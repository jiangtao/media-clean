import React, { useMemo } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useColorScheme, View } from 'react-native';

import type { MainTabParamList } from './types';
import { TabBar } from '../ui/components/TabBar';
import { getAppTheme } from '../theme/app-theme';
import { PhotoGridScreen } from '../ui/screens/PhotoGridScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();

// Placeholder screens - will be replaced by actual implementations
function RecycleBinScreen() {
  return <View style={{ flex: 1, backgroundColor: '#f5f5f5' }} />;
}

function SettingsScreen() {
  return <View style={{ flex: 1, backgroundColor: '#f5f5f5' }} />;
}

export function MainTabNavigator() {
  const systemTheme = useColorScheme();
  const theme = useMemo(() => getAppTheme(systemTheme ?? 'light'), [systemTheme]);

  // TODO: Get recycle bin count from state management
  const recycleBinCount = 0;

  const tabs = useMemo(() => [
    { name: 'Photos', label: '照片', icon: '📷', badge: undefined },
    { name: 'RecycleBin', label: '回收站', icon: '🗑', badge: recycleBinCount || undefined },
    { name: 'Settings', label: '设置', icon: '⚙️', badge: undefined },
  ], [recycleBinCount]);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
      }}
      tabBar={({ state, navigation }) => (
        <TabBar
          tabs={tabs}
          activeTab={state.routes[state.index].name}
          onTabPress={(name) => {
            const route = state.routes.find(r => r.name === name);
            if (route) {
              navigation.navigate(route.name);
            }
          }}
          theme={theme}
        />
      )}
    >
      <Tab.Screen name="Photos" component={PhotoGridScreen} />
      <Tab.Screen name="RecycleBin" component={RecycleBinScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}
