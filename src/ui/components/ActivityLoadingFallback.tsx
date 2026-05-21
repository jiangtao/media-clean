import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useMemo } from 'react';

import type { AppThemePalette } from '../../theme/app-theme';
import { COMPONENT_TOKENS } from '../../theme/generated/component-tokens.generated';
import { Skeleton } from '../primitives';

type ActivityLoadingSurface = 'screen' | 'detail';

export const ACTIVITY_LOADING_FALLBACK_STYLE_TOKENS =
  COMPONENT_TOKENS.activityLoadingFallback;

interface ActivityLoadingFallbackProps {
  theme: AppThemePalette;
  testID?: string;
  surface?: ActivityLoadingSurface;
}

export function ActivityLoadingFallback({
  theme,
  testID = 'activity-loading-fallback',
  surface = 'screen',
}: ActivityLoadingFallbackProps) {
  const styles = useMemo(() => createStyles(theme, surface), [surface, theme]);

  return (
    <View style={styles.container} testID={testID}>
      <Skeleton
        accessibilityLabel={testID}
        height={
          surface === 'detail'
            ? ACTIVITY_LOADING_FALLBACK_STYLE_TOKENS.skeleton.detailHeight
            : ACTIVITY_LOADING_FALLBACK_STYLE_TOKENS.skeleton.screenHeight
        }
        scheme={theme.scheme}
        style={styles.skeleton}
        testID={`${testID}-skeleton`}
        width={
          surface === 'detail'
            ? ACTIVITY_LOADING_FALLBACK_STYLE_TOKENS.skeleton.detailWidth
            : ACTIVITY_LOADING_FALLBACK_STYLE_TOKENS.skeleton.screenWidth
        }
      >
        <ActivityIndicator
          color={
            surface === 'detail'
              ? ACTIVITY_LOADING_FALLBACK_STYLE_TOKENS.color.detailIndicator
              : theme.buttonPrimaryBackground
          }
          size="small"
        />
      </Skeleton>
    </View>
  );
}

function createStyles(theme: AppThemePalette, surface: ActivityLoadingSurface) {
  return StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor:
        surface === 'detail'
          ? ACTIVITY_LOADING_FALLBACK_STYLE_TOKENS.color.detailBackground
          : theme.safeArea,
    },
    skeleton: {
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
