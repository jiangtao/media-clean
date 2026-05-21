import { memo, useMemo } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppPreferences } from '../../application/AppPreferencesContext';
import type { AppThemePalette } from '../../theme/app-theme';
import { COMPONENT_TOKENS } from '../../theme/generated/component-tokens.generated';
import { buildSettingsScreenLayout, type SettingsScreenLayout } from '../screens/screen-layout';
import { Card } from '../primitives';
import { SkeletonBlock } from './SkeletonBlock';

const SETTINGS_STYLE_TOKENS = COMPONENT_TOKENS.settings;

interface SettingsSkeletonCopy {
  skeletonLabel: string;
}

export const SettingsSkeleton = memo(function SettingsSkeleton() {
  const { copy, theme } = useAppPreferences();
  const insets = useSafeAreaInsets();
  const dimensions = useWindowDimensions();
  const layout = useMemo(
    () => buildSettingsScreenLayout(insets, dimensions),
    [dimensions, insets],
  );
  const styles = useMemo(() => createStyles(theme, layout), [layout, theme]);
  const accessibilityLabel = (copy.settings as typeof copy.settings & SettingsSkeletonCopy)
    .skeletonLabel;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      testID="settings-skeleton"
    >
      <View style={styles.header}>
        <SkeletonBlock
          accessibilityLabel={accessibilityLabel}
          height={layout.isSELike ? 23 : 36}
          scheme={theme.scheme}
          testID="settings-skeleton-header"
          width="42%"
        />
      </View>

      {[0, 1, 2, 3].map((index) => (
        <Card key={index} theme={theme} style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <SkeletonBlock
              accessibilityLabel={accessibilityLabel}
              height={layout.isSELike ? 22 : 44}
              scheme={theme.scheme}
              style={styles.cardIcon}
              testID={`settings-skeleton-card-icon-${index}`}
              width={layout.isSELike ? 22 : 44}
            />
            <SkeletonBlock
              accessibilityLabel={accessibilityLabel}
              height={18}
              scheme={theme.scheme}
              testID={`settings-skeleton-card-title-${index}`}
              width={index === 2 ? '44%' : '36%'}
            />
          </View>
          <View style={styles.cardMainRow}>
            <View style={styles.metricGroup}>
              <SkeletonBlock
                accessibilityLabel={accessibilityLabel}
                height={layout.isSELike ? 24 : 32}
                scheme={theme.scheme}
                testID={`settings-skeleton-card-value-${index}`}
                width={index === 3 ? '34%' : '52%'}
              />
              <SkeletonBlock
                accessibilityLabel={accessibilityLabel}
                height={14}
                scheme={theme.scheme}
                testID={`settings-skeleton-card-meta-${index}`}
                width={index === 3 ? '72%' : '88%'}
              />
            </View>
            <View style={styles.chipRow}>
              {[0, 1, 2].map((chipIndex) => (
                <SkeletonBlock
                  key={chipIndex}
                  accessibilityLabel={accessibilityLabel}
                  height={layout.isSELike ? 30 : 36}
                  scheme={theme.scheme}
                  style={styles.chip}
                  testID={`settings-skeleton-card-${index}-chip-${chipIndex}`}
                  width={layout.isSELike ? 46 : 58}
                />
              ))}
            </View>
          </View>
        </Card>
      ))}

      <View style={styles.footer}>
        <SkeletonBlock
          accessibilityLabel={accessibilityLabel}
          height={layout.isSELike ? 14 : 18}
          scheme={theme.scheme}
          testID="settings-skeleton-footer-icon"
          width={layout.isSELike ? 14 : 22}
        />
        <SkeletonBlock
          accessibilityLabel={accessibilityLabel}
          height={14}
          scheme={theme.scheme}
          testID="settings-skeleton-footer-copy"
          width="64%"
        />
      </View>
    </ScrollView>
  );
});

function createStyles(theme: AppThemePalette, layout: SettingsScreenLayout) {
  const isCompact = layout.isSELike;
  const isDark = theme.scheme === 'dark';
  const screenBackground = isDark
    ? theme.safeArea
    : SETTINGS_STYLE_TOKENS.color.screenBackgroundLight;

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: screenBackground,
    },
    contentContainer: {
      paddingBottom: layout.contentBottom,
    },
    header: {
      paddingLeft: layout.left,
      paddingRight: layout.right,
      paddingTop: layout.headerTop,
      paddingBottom: isCompact ? 6 : 10,
      alignItems: 'center',
    },
    card: {
      marginLeft: layout.left,
      marginRight: layout.right,
      marginBottom: layout.cardGap,
      padding: layout.cardPadding,
      borderRadius: isCompact ? 18 : 28,
      backgroundColor: theme.cardBackground,
      borderWidth: 0,
      shadowColor: theme.shadowColor,
      shadowOffset: { width: 0, height: isCompact ? 5 : 14 },
      shadowOpacity: isDark
        ? SETTINGS_STYLE_TOKENS.opacity.cardShadowDark
        : SETTINGS_STYLE_TOKENS.opacity.cardShadowLight,
      shadowRadius: isCompact ? 14 : 28,
      elevation: isCompact ? 1 : 3,
    },
    cardHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: isCompact ? 8 : 16,
      marginBottom: isCompact ? 7 : 20,
    },
    cardIcon: {
      borderRadius: isCompact ? 8 : 14,
    },
    cardMainRow: {
      flexDirection: isCompact ? 'column' : 'row',
      gap: isCompact ? 10 : 14,
      justifyContent: 'space-between',
      alignItems: isCompact ? 'stretch' : 'center',
    },
    metricGroup: {
      flex: 1,
      gap: 8,
      minWidth: 0,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: isCompact ? 6 : 8,
    },
    chip: {
      borderRadius: 999,
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: isCompact ? 0 : 2,
      marginBottom: isCompact ? 16 : 22,
      paddingHorizontal: layout.left,
    },
  });
}
