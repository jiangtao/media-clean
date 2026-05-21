import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAppPreferences } from '../../application/AppPreferencesContext';
import { loadI18nResources } from '../../i18n/resource-loader';
import type { AppThemePalette } from '../../theme/app-theme';
import { Card } from '../primitives';
import { SkeletonBlock } from './SkeletonBlock';

interface AppBootstrapSkeletonProps {
  testID?: string;
}

export const AppBootstrapSkeleton = memo(function AppBootstrapSkeleton({
  testID = 'app-bootstrap-skeleton',
}: AppBootstrapSkeletonProps) {
  const { language, theme } = useAppPreferences();
  const accessibilityLabel = loadI18nResources(language).app.skeleton.loadingLabel;
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.container} testID={testID}>
      <Card theme={theme} style={styles.panel}>
        <SkeletonBlock
          accessibilityLabel={accessibilityLabel}
          height={56}
          scheme={theme.scheme}
          style={styles.brandMark}
          testID={`${testID}-brand`}
          width={56}
        />
        <View style={styles.copy}>
          <SkeletonBlock
            accessibilityLabel={accessibilityLabel}
            height={18}
            scheme={theme.scheme}
            testID={`${testID}-title`}
            width="64%"
          />
          <SkeletonBlock
            accessibilityLabel={accessibilityLabel}
            height={14}
            scheme={theme.scheme}
            testID={`${testID}-body`}
            width="82%"
          />
        </View>
      </Card>
    </View>
  );
});

function createStyles(theme: AppThemePalette) {
  return StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.safeArea,
      paddingHorizontal: 28,
    },
    panel: {
      width: '100%',
      maxWidth: 360,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      padding: 18,
      borderRadius: 24,
      backgroundColor: theme.cardBackground,
      borderWidth: 0,
      shadowColor: theme.shadowColor,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: theme.scheme === 'dark' ? 0.16 : 0.055,
      shadowRadius: 26,
      elevation: 2,
    },
    brandMark: {
      borderRadius: 18,
      minHeight: 56,
    },
    copy: {
      flex: 1,
      gap: 10,
      minWidth: 0,
    },
  });
}
