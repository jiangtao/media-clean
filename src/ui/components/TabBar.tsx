import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AppThemePalette } from '../../theme/app-theme';
import { TouchSurface } from './TouchSurface';

interface TabItem {
  name: string;
  label: string;
  icon: string;
  activeIcon?: string;
  badge?: number;
}

interface TabBarProps {
  tabs: TabItem[];
  activeTab: string;
  onTabPress: (name: string) => void;
  theme: AppThemePalette;
}

export function TabBar({ tabs, activeTab, onTabPress, theme }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const styles = createStyles(theme, insets.bottom);

  return (
    <View style={styles.container}>
      <View style={styles.tabBar}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.name;
          return (
            <TouchSurface
              key={tab.name}
              style={styles.tabItem}
              onPress={() => onTabPress(tab.name)}
              preset="tab"
            >
              <View style={styles.iconContainer}>
                <View style={[styles.iconSurface, isActive && styles.iconSurfaceActive]}>
                  <Ionicons
                    name={(isActive ? tab.activeIcon ?? tab.icon : tab.icon) as React.ComponentProps<typeof Ionicons>['name']}
                    size={19}
                    color={isActive ? theme.pageTextPrimary : theme.pageTextMuted}
                    testID={`tab-icon-${tab.name}`}
                  />
                </View>
                {tab.badge && tab.badge > 0 ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {tab.badge > 99 ? '99+' : tab.badge}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.label, isActive && styles.activeLabel]}>
                {tab.label}
              </Text>
            </TouchSurface>
          );
        })}
      </View>
    </View>
  );
}

function createStyles(theme: AppThemePalette, bottomInset: number) {
  return StyleSheet.create({
    container: {
      backgroundColor: theme.cardBackground,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.cardBorder,
      paddingBottom: bottomInset > 0 ? bottomInset : 8,
    },
    tabBar: {
      flexDirection: 'row',
      height: 56,
    },
    tabItem: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 44,
      minWidth: 44,
    },
    iconContainer: {
      position: 'relative',
      marginBottom: 2,
    },
    iconSurface: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconSurfaceActive: {
      backgroundColor: theme.cardMutedBackground,
    },
    label: {
      fontSize: 11,
      color: theme.pageTextMuted,
      fontWeight: '500',
    },
    activeLabel: {
      color: theme.pageTextPrimary,
      fontWeight: '600',
    },
    badge: {
      position: 'absolute',
      top: -6,
      right: -10,
      backgroundColor: '#ff3b30',
      borderRadius: 10,
      minWidth: 18,
      height: 18,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: theme.cardBackground,
    },
    badgeText: {
      color: '#FFFFFF',
      fontSize: 10,
      fontWeight: '700',
      paddingHorizontal: 4,
    },
  });
}
