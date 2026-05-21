import { memo, useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppPreferences } from '../../application/AppPreferencesContext';
import type { AppThemePalette } from '../../theme/app-theme';
import { SKELETON_TOKENS } from '../../theme/generated/skeleton-tokens.generated';
import {
  buildBottomActionLayout,
  buildMediaGridLayout,
  RECYCLE_BIN_DESIGN_CONTENT_WIDTH,
} from '../screens/screen-layout';
import { Card } from '../primitives';
import { SkeletonBlock } from './SkeletonBlock';

interface RecycleBinSkeletonCopy {
  skeletonLabel: string;
}

export const RecycleBinSkeleton = memo(function RecycleBinSkeleton() {
  const { copy, theme } = useAppPreferences();
  const insets = useSafeAreaInsets();
  const dimensions = useWindowDimensions();
  const gridLayout = useMemo(
    () => buildMediaGridLayout(insets, dimensions),
    [dimensions, insets],
  );
  const actionLayout = useMemo(
    () =>
      buildBottomActionLayout(insets, dimensions, {
        maxContentWidth: gridLayout.isSELike ? RECYCLE_BIN_DESIGN_CONTENT_WIDTH : 560,
      }),
    [dimensions, gridLayout.isSELike, insets],
  );
  const styles = useMemo(
    () => createStyles(theme, insets, actionLayout.isSELike ?? true),
    [actionLayout.isSELike, insets, theme],
  );
  const accessibilityLabel = (
    copy.screens.recycleBin as typeof copy.screens.recycleBin & RecycleBinSkeletonCopy
  ).skeletonLabel;
  const itemCount = gridLayout.columns * 3;

  return (
    <View style={styles.container} testID="recycle-bin-skeleton">
      <Card theme={theme} style={styles.summaryCard}>
        <SkeletonBlock
          accessibilityLabel={accessibilityLabel}
          height={isCompactSize(actionLayout.isSELike) ? 42 : 52}
          scheme={theme.scheme}
          style={styles.summaryIcon}
          testID="recycle-bin-skeleton-summary-icon"
          width={isCompactSize(actionLayout.isSELike) ? 30 : 42}
        />
        <View style={styles.summaryCopy}>
          <SkeletonBlock
            accessibilityLabel={accessibilityLabel}
            height={isCompactSize(actionLayout.isSELike) ? 24 : 31}
            scheme={theme.scheme}
            testID="recycle-bin-skeleton-summary-title"
            width="58%"
          />
          <SkeletonBlock
            accessibilityLabel={accessibilityLabel}
            height={isCompactSize(actionLayout.isSELike) ? 18 : 22}
            scheme={theme.scheme}
            testID="recycle-bin-skeleton-summary-meta"
            width="72%"
          />
        </View>
      </Card>

      <View style={styles.grid} testID="recycle-bin-skeleton-grid">
        {Array.from({ length: itemCount }, (_, index) => (
          <SkeletonBlock
            key={index}
            accessibilityLabel={accessibilityLabel}
            height={gridLayout.itemSize}
            scheme={theme.scheme}
            style={styles.gridItem}
            testID={`recycle-bin-skeleton-item-${index}`}
            width={gridLayout.itemSize}
          />
        ))}
      </View>
    </View>
  );
});

function isCompactSize(value: boolean | undefined) {
  return value ?? true;
}

function createStyles(
  theme: AppThemePalette,
  insets: { top: number; bottom: number; left: number; right: number },
  isCompact: boolean,
) {
  const gridGap = SKELETON_TOKENS.layout.blockGap;

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.safeArea,
      paddingBottom: Math.max(insets.bottom + 16, 28),
    },
    summaryCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: isCompact ? 10 : 14,
      marginTop: isCompact ? 2 : 22,
      marginLeft: isCompact ? 16 + insets.left : 24 + insets.left,
      marginRight: isCompact ? 16 + insets.right : 24 + insets.right,
      paddingHorizontal: isCompact ? 16 : 20,
      paddingVertical: isCompact ? 12 : 18,
      borderWidth: 0,
    },
    summaryIcon: {
      width: isCompact ? 30 : 42,
      minHeight: isCompact ? 42 : 52,
      borderRadius: SKELETON_TOKENS.layout.blockRadius,
    },
    summaryCopy: {
      flex: 1,
      gap: gridGap,
    },
    summaryTitle: {
      minHeight: isCompact ? 24 : 31,
    },
    summaryMeta: {
      minHeight: isCompact ? 18 : 22,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: gridGap,
      paddingTop: isCompact ? 12 : 18,
      paddingLeft: 16 + insets.left,
      paddingRight: 16 + insets.right,
    },
    gridItem: {
      borderRadius: isCompact ? 14 : 16,
    },
  });
}
