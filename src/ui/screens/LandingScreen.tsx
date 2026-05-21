import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NavigatorScreenParams } from '@react-navigation/native';

import { useAppPreferences } from '../../application/AppPreferencesContext';
import {
  getMediaLibraryPermissionsAsync,
  requestMediaLibraryPermissionsAsync,
} from '../../services/media-library-permissions';
import { saveHasEnteredWorkspace } from '../../services/storage/workspace-entry-storage';
import type { AppThemePalette } from '../../theme/app-theme';
import { COMPONENT_TOKENS } from '../../theme/generated/component-tokens.generated';
import type { MainTabParamList } from '../../navigation/types';
import { DesignIcon, type DesignIconName } from '../icons/DesignIcon';
import { Button, Separator, Text as PrimitiveText } from '../primitives';
import { LandingSkeleton } from '../skeletons';

interface LandingNavigation {
  replace: (routeName: 'Main', params?: NavigatorScreenParams<MainTabParamList>) => void;
}

type LandingPermissionState = 'loading' | 'granted' | 'pending';

export const LANDING_STYLE_TOKENS = COMPONENT_TOKENS.landing;

export function LandingScreen({ navigation }: { navigation: LandingNavigation }) {
  const { copy, theme } = useAppPreferences();
  const insets = useSafeAreaInsets();
  const dimensions = useWindowDimensions();
  const isDesignPhone = Math.min(dimensions.width, dimensions.height) <= 430;
  const styles = useMemo(
    () => createStyles(theme, insets, isDesignPhone),
    [insets, isDesignPhone, theme],
  );
  const landingCopy = useMemo(() => copy.landing, [copy]);
  const [permissionState, setPermissionState] = useState<LandingPermissionState>('loading');
  const [hasCheckedInitialPermission, setHasCheckedInitialPermission] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void getMediaLibraryPermissionsAsync()
      .then((permission) => {
        if (!cancelled) {
          setHasCheckedInitialPermission(true);
          setPermissionState(permission.granted ? 'granted' : 'pending');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHasCheckedInitialPermission(true);
          setPermissionState('pending');
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const isGranted = permissionState === 'granted';
  const statusTitle = isGranted
    ? landingCopy.statusTitleGranted
    : landingCopy.statusTitlePending;
  const statusBody = isGranted
    ? landingCopy.statusBodyGranted
    : landingCopy.statusBodyPending;
  const heroBody = isGranted
    ? landingCopy.heroBodyGranted
    : landingCopy.heroBodyPending;
  const actionLabel = isGranted ? landingCopy.actionReady : landingCopy.actionPending;
  const statusAccent = isGranted ? styles.statusAccentGranted : styles.statusAccentPending;
  const statusIconColor = isGranted ? theme.buttonSuccessBackground : theme.buttonPrimaryBackground;
  const statusIconName: DesignIconName = isGranted ? 'check' : 'scan';

  if (permissionState === 'loading' && !hasCheckedInitialPermission) {
    return <LandingSkeleton />;
  }

  const handlePrimaryAction = async () => {
    let granted = isGranted;

    try {
      if (!granted) {
        setPermissionState('loading');
        const permission = await requestMediaLibraryPermissionsAsync();
        granted = permission.granted;
        setPermissionState(granted ? 'granted' : 'pending');
      }

      await saveHasEnteredWorkspace(true);
    } finally {
      navigation.replace('Main', {
        screen: 'Photos',
        params: granted ? { autoStartScan: true } : undefined,
      });
    }
  };

  return (
    <View style={styles.container} testID="landing-screen">
      <View style={styles.waveLeft} />
      <View style={styles.waveRight} />
      <View style={styles.orbTop} />
      <View style={styles.orbBottom} />
      <View style={styles.glowTop} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
        testID="landing-scroll-view"
      >
        <View style={styles.statusCard} testID="landing-status-card">
          <View style={[styles.statusIconShell, statusAccent]}>
            <DesignIcon
              name={statusIconName}
              width={isDesignPhone ? 26 : 34}
              height={isDesignPhone ? 26 : 34}
              color={statusIconColor}
            />
          </View>
          <View style={styles.statusCopy}>
            <Text style={styles.statusTitle}>{statusTitle}</Text>
            <Text style={styles.statusBody}>{statusBody}</Text>
          </View>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroIllustration}>
            <View style={styles.heroRingOuter} />
            <View style={styles.heroRingInner} />
            <View style={styles.heroTile}>
              <DesignIcon
                name="stack"
                width={isDesignPhone ? 120 : 156}
                height={isDesignPhone ? 120 : 156}
                color={theme.buttonPrimaryBackground}
                secondaryColor={theme.buttonSecondaryBackground}
              />
            </View>
            <View style={[styles.sparkle, styles.sparkleLeft]} />
            <View style={[styles.sparkle, styles.sparkleRight]} />
          </View>

          <Text style={styles.heroTitle}>{landingCopy.heroTitle}</Text>
          <Text style={styles.heroBody}>{heroBody}</Text>

          <Button
            onPress={handlePrimaryAction}
            theme={theme}
            style={styles.actionButton}
            contentStyle={styles.actionButtonContent}
            testID="landing-primary-action"
            >
              <DesignIcon
              name={isGranted ? 'scan' : 'check'}
              width={isDesignPhone ? 20 : 24}
              height={isDesignPhone ? 20 : 24}
              color={theme.buttonPrimaryText}
              secondaryColor={theme.buttonPrimaryBackground}
            />
            <PrimitiveText variant="button" theme={theme} style={styles.actionText}>
              {actionLabel}
            </PrimitiveText>
          </Button>

          <View style={styles.featurePill}>
            <DesignIcon
              name="check"
              width={isDesignPhone ? 15 : 18}
              height={isDesignPhone ? 15 : 18}
              color={theme.buttonPrimaryBackground}
            />
            <PrimitiveText variant="label" theme={theme} style={styles.featurePillText}>
              {landingCopy.featurePill}
            </PrimitiveText>
          </View>

          <Separator theme={theme} style={styles.divider} />

          <View style={styles.featureList}>
            <View style={styles.featureRow} testID="landing-feature-row">
              <View style={styles.featureIconShell}>
                <DesignIcon
                  name="local-analysis"
                  width={isDesignPhone ? 46 : 56}
                  height={isDesignPhone ? 46 : 56}
                  color={theme.buttonPrimaryBackground}
                  secondaryColor={theme.cardMutedBackground}
                />
              </View>
              <View style={styles.featureCopy}>
                <Text style={styles.featureTitle}>{landingCopy.localOnlyTitle}</Text>
                <Text style={styles.featureBody}>{landingCopy.localOnlyBody}</Text>
              </View>
            </View>

            <View style={styles.featureRow} testID="landing-feature-row">
              <View style={styles.featureIconShell}>
                <DesignIcon
                  name="stack"
                  width={isDesignPhone ? 46 : 56}
                  height={isDesignPhone ? 46 : 56}
                  color={theme.buttonPrimaryBackground}
                  secondaryColor={theme.buttonSecondaryBackground}
                />
              </View>
              <View style={styles.featureCopy}>
                <Text style={styles.featureTitle}>{landingCopy.mediaSupportTitle}</Text>
                <Text style={styles.featureBody}>{landingCopy.mediaSupportBody}</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function createStyles(
  theme: AppThemePalette,
  insets: { top: number; bottom: number; left: number; right: number },
  isDesignPhone = true,
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
  const heroRingOuterColor = theme.scheme === 'dark'
    ? LANDING_STYLE_TOKENS.color.heroRingOuterDark
    : LANDING_STYLE_TOKENS.color.heroRingOuterLight;
  const heroRingInnerColor = theme.scheme === 'dark'
    ? LANDING_STYLE_TOKENS.color.heroRingInnerDark
    : LANDING_STYLE_TOKENS.color.heroRingInnerLight;
  const heroTileBackground = theme.scheme === 'dark'
    ? LANDING_STYLE_TOKENS.color.heroTileBackgroundDark
    : LANDING_STYLE_TOKENS.color.heroTileBackgroundLight;
  const heroTileBorder = theme.scheme === 'dark'
    ? LANDING_STYLE_TOKENS.color.heroTileBorderDark
    : LANDING_STYLE_TOKENS.color.heroTileBorderLight;
  const sparkleColor = theme.scheme === 'dark'
    ? LANDING_STYLE_TOKENS.color.sparkleDark
    : LANDING_STYLE_TOKENS.color.sparkleLight;

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
    glowTop: {
      position: 'absolute',
      top: insets.top + 48,
      right: 16 + insets.right,
      width: 116,
      height: 116,
      borderRadius: 58,
      backgroundColor: theme.heroAccent,
      opacity: LANDING_STYLE_TOKENS.opacity.glow,
    },
    statusCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: isDesignPhone ? 12 : 14,
      borderRadius: isDesignPhone ? 22 : 24,
      paddingVertical: isDesignPhone ? 12 : 14,
      paddingHorizontal: 0,
      backgroundColor: 'transparent',
      borderWidth: 0,
      shadowOpacity: 0,
      elevation: 0,
    },
    statusIconShell: {
      width: isDesignPhone ? 52 : 72,
      height: isDesignPhone ? 52 : 72,
      borderRadius: isDesignPhone ? 18 : 24,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 0,
    },
    statusAccentGranted: {
      backgroundColor: 'transparent',
    },
    statusAccentPending: {
      backgroundColor: 'transparent',
    },
    statusCopy: {
      flex: 1,
      gap: 6,
      minWidth: 0,
    },
    statusTitle: {
      fontSize: isDesignPhone ? 16 : 18,
      lineHeight: isDesignPhone ? 21 : 24,
      fontWeight: '800',
      color: theme.pageTextPrimary,
    },
    statusBody: {
      fontSize: isDesignPhone ? 12 : 14,
      lineHeight: isDesignPhone ? 17 : 20,
      color: theme.pageTextSecondary,
    },
    heroCard: {
      borderRadius: isDesignPhone ? 28 : 32,
      paddingHorizontal: isDesignPhone ? 18 : 22,
      paddingTop: isDesignPhone ? 20 : 28,
      paddingBottom: isDesignPhone ? 20 : 24,
      backgroundColor: 'transparent',
      borderWidth: 0,
      shadowOpacity: 0,
      elevation: 0,
      alignItems: 'center',
    },
    heroIllustration: {
      width: '100%',
      minHeight: isDesignPhone ? 184 : 228,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: isDesignPhone ? 10 : 14,
    },
    heroRingOuter: {
      position: 'absolute',
      width: isDesignPhone ? 188 : 220,
      height: isDesignPhone ? 188 : 220,
      borderRadius: isDesignPhone ? 94 : 110,
      borderWidth: 1,
      borderColor: heroRingOuterColor,
    },
    heroRingInner: {
      position: 'absolute',
      width: isDesignPhone ? 148 : 174,
      height: isDesignPhone ? 148 : 174,
      borderRadius: isDesignPhone ? 74 : 87,
      borderWidth: 1,
      borderColor: heroRingInnerColor,
    },
    heroTile: {
      width: isDesignPhone ? 112 : 140,
      height: isDesignPhone ? 112 : 140,
      borderRadius: isDesignPhone ? 24 : 30,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: heroTileBackground,
      borderWidth: 1,
      borderColor: heroTileBorder,
    },
    sparkle: {
      position: 'absolute',
      width: 14,
      height: 14,
      borderRadius: 999,
      backgroundColor: sparkleColor,
    },
    sparkleLeft: {
      left: 84,
      top: 84,
    },
    sparkleRight: {
      right: 88,
      bottom: 62,
    },
    heroTitle: {
      fontSize: isDesignPhone ? 24 : 30,
      lineHeight: isDesignPhone ? 31 : 40,
      fontWeight: '800',
      color: theme.pageTextPrimary,
      textAlign: 'center',
      marginBottom: isDesignPhone ? 8 : 12,
      letterSpacing: -0.4,
    },
    heroBody: {
      fontSize: isDesignPhone ? 13 : 14,
      lineHeight: isDesignPhone ? 19 : 22,
      color: theme.pageTextSecondary,
      textAlign: 'center',
      marginBottom: isDesignPhone ? 18 : 24,
      maxWidth: 286,
    },
    actionButton: {
      width: '100%',
      minHeight: isDesignPhone ? 52 : 60,
      borderRadius: 999,
      paddingHorizontal: 22,
      marginBottom: isDesignPhone ? 12 : 14,
    },
    actionButtonContent: {
      minHeight: isDesignPhone ? 28 : 34,
      gap: 10,
    },
    actionText: {
      fontSize: isDesignPhone ? 17 : 20,
      lineHeight: isDesignPhone ? 23 : 28,
      fontWeight: '800',
      color: theme.buttonPrimaryText,
    },
    featurePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderRadius: 999,
      paddingHorizontal: isDesignPhone ? 13 : 16,
      paddingVertical: isDesignPhone ? 7 : 10,
      backgroundColor: theme.buttonSecondaryBackground,
      marginBottom: isDesignPhone ? 14 : 18,
    },
    featurePillText: {
      fontSize: isDesignPhone ? 12 : 15,
      lineHeight: isDesignPhone ? 17 : 20,
      fontWeight: '700',
      color: theme.buttonPrimaryBackground,
    },
    divider: {
      alignSelf: 'stretch',
      marginBottom: isDesignPhone ? 14 : 18,
    },
    featureList: {
      alignSelf: 'stretch',
      gap: isDesignPhone ? 14 : 18,
    },
    featureRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: isDesignPhone ? 12 : 14,
    },
    featureIconShell: {
      width: isDesignPhone ? 34 : 44,
      alignItems: 'center',
      paddingTop: 2,
    },
    featureCopy: {
      flex: 1,
      gap: 4,
      minWidth: 0,
    },
    featureTitle: {
      fontSize: isDesignPhone ? 14 : 16,
      lineHeight: isDesignPhone ? 20 : 24,
      fontWeight: '800',
      color: theme.pageTextPrimary,
    },
    featureBody: {
      fontSize: isDesignPhone ? 12 : 14,
      lineHeight: isDesignPhone ? 18 : 21,
      color: theme.pageTextSecondary,
    },
  });
}
