import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useMemo } from 'react';

import type { AppThemePalette } from '../../theme/app-theme';

type ActivityLoadingSurface = 'screen' | 'detail';

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
      <ActivityIndicator
        color={surface === 'detail' ? '#ffffff' : theme.buttonPrimaryBackground}
        size="small"
      />
    </View>
  );
}

function createStyles(theme: AppThemePalette, surface: ActivityLoadingSurface) {
  return StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: surface === 'detail' ? '#000000' : theme.safeArea,
    },
  });
}
