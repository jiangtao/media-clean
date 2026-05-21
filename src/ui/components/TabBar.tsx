import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AppThemePalette } from '../../theme/app-theme';
import { COMPONENT_TOKENS } from '../../theme/generated/component-tokens.generated';
import { DesignIcon, type DesignIconName } from '../icons/DesignIcon';
import { Badge, Text, TouchSurface } from '../primitives';

export const TAB_BAR_STYLE_TOKENS = COMPONENT_TOKENS.tabBar;

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
  const styles = createStyles(
    theme,
    Math.max(insets.bottom, TAB_BAR_STYLE_TOKENS.layout.minimumBottomPadding),
  );

  return (
    <View style={styles.container} testID="main-tab-bar-safe-area">
      <View style={styles.tabBar} testID="main-tab-bar">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.name;
          const badgeText =
            tab.badge && tab.badge > TAB_BAR_STYLE_TOKENS.badge.maxDisplayCount
              ? `${TAB_BAR_STYLE_TOKENS.badge.maxDisplayCount}+`
              : tab.badge;
          return (
            <TouchSurface
              key={tab.name}
              style={styles.tabItem}
              onPress={() => onTabPress(tab.name)}
              preset="tab"
              testID={`tab-button-${tab.name}`}
              accessibilityLabel={`tab-button-${tab.name}`}
            >
              <View style={styles.iconContainer} testID={`tab-icon-container-${tab.name}`}>
                <DesignIcon
                  name={isActive ? tab.activeIcon ?? tab.icon : tab.icon}
                  width={TAB_BAR_STYLE_TOKENS.layout.iconSize}
                  height={TAB_BAR_STYLE_TOKENS.layout.iconSize}
                  color={isActive ? theme.buttonPrimaryBackground : theme.pageTextMuted}
                  secondaryColor={isActive ? theme.buttonPrimaryText : theme.safeArea}
                  testID={`tab-icon-${tab.name}`}
                />
                {tab.badge && tab.badge > 0 ? (
                  <Badge
                    variant="danger"
                    theme={theme}
                    style={styles.badge}
                    textStyle={styles.badgeText}
                    testID={`tab-badge-${tab.name}`}
                  >
                    {badgeText}
                  </Badge>
                ) : null}
              </View>
              <Text
                variant="label"
                theme={theme}
                style={[styles.label, isActive && styles.activeLabel]}
              >
                {tab.label}
              </Text>
            </TouchSurface>
          );
        })}
      </View>
    </View>
  );
}

function createStyles(theme: AppThemePalette, bottomPadding: number) {
  return StyleSheet.create({
    container: {
      backgroundColor: 'transparent',
      paddingBottom: bottomPadding,
    },
    tabBar: {
      flexDirection: 'row',
      height: TAB_BAR_STYLE_TOKENS.layout.height,
      marginHorizontal: TAB_BAR_STYLE_TOKENS.layout.marginHorizontal,
      paddingHorizontal: TAB_BAR_STYLE_TOKENS.layout.paddingHorizontal,
      backgroundColor: 'transparent',
    },
    tabItem: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: TAB_BAR_STYLE_TOKENS.layout.tabMinHeight,
      minWidth: TAB_BAR_STYLE_TOKENS.layout.tabMinWidth,
    },
    iconContainer: {
      position: 'relative',
      width: TAB_BAR_STYLE_TOKENS.layout.iconSize,
      height: TAB_BAR_STYLE_TOKENS.layout.iconSize,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: TAB_BAR_STYLE_TOKENS.layout.iconBottomMargin,
    },
    label: {
      fontSize: TAB_BAR_STYLE_TOKENS.typography.labelSize,
      color: theme.pageTextMuted,
      fontWeight: TAB_BAR_STYLE_TOKENS.typography.labelWeight,
    },
    activeLabel: {
      color: theme.buttonPrimaryBackground,
      fontWeight: TAB_BAR_STYLE_TOKENS.typography.activeLabelWeight,
    },
    badge: {
      position: 'absolute',
      top: -TAB_BAR_STYLE_TOKENS.badge.offsetTop,
      right: -TAB_BAR_STYLE_TOKENS.badge.offsetRight,
      borderRadius: TAB_BAR_STYLE_TOKENS.badge.radius,
      minWidth: TAB_BAR_STYLE_TOKENS.badge.minWidth,
      minHeight: TAB_BAR_STYLE_TOKENS.badge.minHeight,
      paddingHorizontal: TAB_BAR_STYLE_TOKENS.badge.paddingHorizontal,
      paddingVertical: TAB_BAR_STYLE_TOKENS.badge.paddingVertical,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: TAB_BAR_STYLE_TOKENS.badge.borderWidth,
      borderColor: theme.safeArea,
    },
    badgeText: {
      fontSize: TAB_BAR_STYLE_TOKENS.typography.badgeSize,
      fontWeight: TAB_BAR_STYLE_TOKENS.typography.badgeWeight,
      lineHeight: TAB_BAR_STYLE_TOKENS.badge.minHeight,
      textAlign: 'center',
      includeFontPadding: false,
    },
  });
}
