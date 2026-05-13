import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AppThemePalette } from '../../theme/app-theme';
import { DesignIcon, type DesignIconName } from '../icons/DesignIcon';
import { TouchSurface } from './TouchSurface';

interface TabItem {
  name: string;
  label: string;
  icon: DesignIconName;
  activeIcon?: DesignIconName;
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
              testID={`tab-button-${tab.name}`}
              accessibilityLabel={`tab-button-${tab.name}`}
            >
              <View style={styles.iconContainer}>
                <DesignIcon
                  name={isActive ? tab.activeIcon ?? tab.icon : tab.icon}
                  width={24}
                  height={24}
                  color={isActive ? theme.buttonPrimaryBackground : theme.pageTextMuted}
                  secondaryColor={isActive ? theme.buttonPrimaryText : theme.safeArea}
                  testID={`tab-icon-${tab.name}`}
                />
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
  const compactBottomInset = bottomInset > 0 ? Math.min(bottomInset, 8) : 8;

  return StyleSheet.create({
    container: {
      backgroundColor: 'transparent',
      paddingBottom: compactBottomInset,
    },
    tabBar: {
      flexDirection: 'row',
      height: 56,
      marginHorizontal: 0,
      paddingHorizontal: 20,
      backgroundColor: 'transparent',
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
      marginBottom: 3,
    },
    label: {
      fontSize: 11,
      color: theme.pageTextMuted,
      fontWeight: '600',
    },
    activeLabel: {
      color: theme.buttonPrimaryBackground,
      fontWeight: '800',
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
      borderColor: theme.safeArea,
    },
    badgeText: {
      color: '#FFFFFF',
      fontSize: 10,
      fontWeight: '700',
      paddingHorizontal: 4,
    },
  });
}
