import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AppThemePalette } from '../../theme/app-theme';

interface TabItem {
  name: string;
  label: string;
  icon: string;
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
            <TouchableOpacity
              key={tab.name}
              style={styles.tabItem}
              onPress={() => onTabPress(tab.name)}
              activeOpacity={0.7}
            >
              <View style={styles.iconContainer}>
                <Text style={[styles.icon, isActive && styles.activeIcon]}>
                  {tab.icon}
                </Text>
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
            </TouchableOpacity>
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
    icon: {
      fontSize: 22,
      opacity: 0.6,
    },
    activeIcon: {
      opacity: 1,
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
      backgroundColor: '#FF3B30',
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
