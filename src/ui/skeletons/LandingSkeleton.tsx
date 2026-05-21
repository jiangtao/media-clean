import { memo, useMemo } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppPreferences } from '../../application/AppPreferencesContext';
import type { AppThemePalette } from '../../theme/app-theme';
import { COMPONENT_TOKENS } from '../../theme/generated/component-tokens.generated';
import { Card } from '../primitives';
import { SkeletonBlock } from './SkeletonBlock';

interface LandingSkeletonCopy {
  skeletonLabel: string;
}

const LANDING_STYLE_TOKENS = COMPONENT_TOKENS.landing;

export const LandingSkeleton = memo(function LandingSkeleton() {
  const { copy, theme } = useAppPreferences();
  const insets = useSafeAreaInsets();
  const dimensions = useWindowDimensions();
  const isDesignPhone = Math.min(dimensions.width, dimensions.height) <= 430;
  const styles = useMemo(
    () => createStyles(theme, insets, isDesignPhone),
    [insets, isDesignPhone, theme],
  );
  const accessibilityLabel = (copy.landing as typeof copy.landing & LandingSkeletonCopy)
    .skeletonLabel;

  return (
    <View style={styles.container} testID="landing-skeleton">
      <View style={styles.waveLeft} />
      <View style={styles.waveRight} />
      <View style={styles.orbTop} />
      <View style={styles.orbBottom} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
        testID="landing-skeleton-scroll-view"
      >
        <View style={styles.statusRow}>
          <SkeletonBlock
            accessibilityLabel={accessibilityLabel}
            height={isDesignPhone ? 20 : 24}
            scheme={theme.scheme}
            style={styles.statusIcon}
            testID="landing-skeleton-status-icon"
            width={isDesignPhone ? 52 : 72}
          />
          <View style={styles.statusCopy}>
            <SkeletonBlock
              accessibilityLabel={accessibilityLabel}
              height={18}
              scheme={theme.scheme}
              testID="landing-skeleton-status-title"
              width="58%"
            />
            <SkeletonBlock
              accessibilityLabel={accessibilityLabel}
              height={14}
              scheme={theme.scheme}
              testID="landing-skeleton-status-body"
              width="78%"
            />
          </View>
        </View>

        <Card theme={theme} style={styles.heroCard}>
          <SkeletonBlock
            accessibilityLabel={accessibilityLabel}
            height={isDesignPhone ? 144 : 176}
            scheme={theme.scheme}
            style={styles.heroArt}
            testID="landing-skeleton-hero-art"
            width={isDesignPhone ? 188 : 220}
          />
          <SkeletonBlock
            accessibilityLabel={accessibilityLabel}
            height={26}
            scheme={theme.scheme}
            testID="landing-skeleton-hero-title"
            width="46%"
          />
          <SkeletonBlock
            accessibilityLabel={accessibilityLabel}
            height={18}
            scheme={theme.scheme}
            testID="landing-skeleton-hero-body"
            width="82%"
          />
          <SkeletonBlock
            accessibilityLabel={accessibilityLabel}
            height={isDesignPhone ? 52 : 60}
            scheme={theme.scheme}
            style={styles.action}
            testID="landing-skeleton-action"
            width="100%"
          />
          <SkeletonBlock
            accessibilityLabel={accessibilityLabel}
            height={isDesignPhone ? 32 : 38}
            scheme={theme.scheme}
            style={styles.pill}
            testID="landing-skeleton-pill"
            width="62%"
          />
          <View style={styles.featureList}>
            {[0, 1].map((index) => (
              <View key={index} style={styles.featureRow}>
                <SkeletonBlock
                  accessibilityLabel={accessibilityLabel}
                  height={isDesignPhone ? 46 : 56}
                  scheme={theme.scheme}
                  style={styles.featureIcon}
                  testID={`landing-skeleton-feature-icon-${index}`}
                  width={isDesignPhone ? 46 : 56}
                />
                <View style={styles.featureCopy}>
                  <SkeletonBlock
                    accessibilityLabel={accessibilityLabel}
                    height={16}
                    scheme={theme.scheme}
                    testID={`landing-skeleton-feature-title-${index}`}
                    width="54%"
                  />
                  <SkeletonBlock
                    accessibilityLabel={accessibilityLabel}
                    height={14}
                    scheme={theme.scheme}
                    testID={`landing-skeleton-feature-body-${index}`}
                    width="88%"
                  />
                </View>
              </View>
            ))}
          </View>
        </Card>
      </ScrollView>
    </View>
  );
});

function createStyles(
  theme: AppThemePalette,
  insets: { top: number; bottom: number; left: number; right: number },
  isDesignPhone: boolean,
) {
  const waveLeftColor = theme.scheme === 'dark'
    ? LANDING_STYLE_TOKENS.color.waveLeftDark
    : LANDING_STYLE_TOKENS.color.waveLeftLight;
  const waveRightColor = theme.scheme === 'dark'
    ? LANDING_STYLE_TOKENS.color.waveRightDark
    : LANDING_STYLE_TOKENS.color.waveRightLight;
  const orbTopOpacity = theme.scheme === 'dark'
    ? LANDING_STYLE_TOKENS.opacity.orbTopDark
    : LANDING_STYLE_TOKENS.opacity.orbTopLight;
  const orbBottomOpacity = theme.scheme === 'dark'
    ? LANDING_STYLE_TOKENS.opacity.orbBottomDark
    : LANDING_STYLE_TOKENS.opacity.orbBottomLight;

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.safeArea,
      overflow: 'hidden',
      paddingTop: insets.top + (isDesignPhone ? 14 : 18),
      paddingBottom: Math.max(insets.bottom + 20, 24),
      paddingLeft: (isDesignPhone ? 28 : 20) + insets.left,
      paddingRight: (isDesignPhone ? 28 : 20) + insets.right,
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: 'center',
      gap: isDesignPhone ? 14 : 18,
    },
    waveLeft: {
      position: 'absolute',
      left: -180,
      top: insets.top + 96,
      width: 520,
      height: 260,
      borderRadius: 220,
      backgroundColor: waveLeftColor,
      transform: [{ rotate: '18deg' }],
    },
    waveRight: {
      position: 'absolute',
      right: -220,
      bottom: 120,
      width: 560,
      height: 280,
      borderRadius: 240,
      backgroundColor: waveRightColor,
      transform: [{ rotate: '-16deg' }],
    },
    orbTop: {
      position: 'absolute',
      top: insets.top - 48,
      right: -12 + insets.right,
      width: 164,
      height: 164,
      borderRadius: 82,
      backgroundColor: theme.orbTop,
      opacity: orbTopOpacity,
    },
    orbBottom: {
      position: 'absolute',
      left: -36 + insets.left,
      bottom: insets.bottom + 8,
      width: 184,
      height: 184,
      borderRadius: 92,
      backgroundColor: theme.orbBottom,
      opacity: orbBottomOpacity,
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: isDesignPhone ? 12 : 14,
      paddingVertical: isDesignPhone ? 12 : 14,
    },
    statusIcon: {
      borderRadius: isDesignPhone ? 18 : 24,
      minHeight: isDesignPhone ? 52 : 72,
    },
    statusCopy: {
      flex: 1,
      gap: 8,
    },
    heroCard: {
      alignItems: 'center',
      gap: isDesignPhone ? 12 : 16,
      borderWidth: 0,
      backgroundColor: 'transparent',
      paddingHorizontal: isDesignPhone ? 18 : 22,
      paddingTop: isDesignPhone ? 20 : 28,
      paddingBottom: isDesignPhone ? 20 : 24,
    },
    heroArt: {
      borderRadius: isDesignPhone ? 28 : 34,
      marginBottom: isDesignPhone ? 2 : 4,
    },
    action: {
      borderRadius: 999,
      marginTop: isDesignPhone ? 4 : 8,
    },
    pill: {
      borderRadius: 999,
    },
    featureList: {
      alignSelf: 'stretch',
      gap: isDesignPhone ? 14 : 18,
      marginTop: isDesignPhone ? 10 : 14,
    },
    featureRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: isDesignPhone ? 12 : 16,
    },
    featureIcon: {
      borderRadius: isDesignPhone ? 15 : 18,
    },
    featureCopy: {
      flex: 1,
      gap: 8,
    },
  });
}
