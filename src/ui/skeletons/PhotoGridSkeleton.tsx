import { memo, useMemo } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppPreferences } from '../../application/AppPreferencesContext';
import type { AppThemePalette } from '../../theme/app-theme';
import {
  buildMediaGridLayout,
  buildPhotoGridContentPadding,
  type MediaGridLayout,
} from '../screens/screen-layout';
import { Card } from '../primitives';
import { SkeletonBlock } from './SkeletonBlock';

interface PhotoGridSkeletonCopy {
  skeletonLabel: string;
}

export type PhotoGridSkeletonVariant = 'permissionChecking' | 'permissionDenied' | 'scanReady';

interface PhotoGridSkeletonProps {
  variant?: PhotoGridSkeletonVariant;
}

export const PhotoGridSkeleton = memo(function PhotoGridSkeleton({
  variant = 'permissionChecking',
}: PhotoGridSkeletonProps) {
  const { copy, theme } = useAppPreferences();
  const insets = useSafeAreaInsets();
  const dimensions = useWindowDimensions();
  const gridLayout = useMemo(
    () => buildMediaGridLayout(insets, dimensions),
    [dimensions, insets],
  );
  const contentPadding = useMemo(() => buildPhotoGridContentPadding(insets), [insets]);
  const styles = useMemo(
    () => createStyles(theme, insets, gridLayout, contentPadding),
    [contentPadding, gridLayout, insets, theme],
  );
  const accessibilityLabel = (
    copy.screens.photoGrid as typeof copy.screens.photoGrid & PhotoGridSkeletonCopy
  ).skeletonLabel;
  const previewTileCount =
    variant === 'permissionDenied' ? 0 : gridLayout.columns * (gridLayout.isSELike ? 4 : 3);
  const isScanReady = variant === 'scanReady';

  return (
    <View style={styles.container} testID="photo-grid-entry-card">
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        testID="photo-grid-skeleton"
      >
        <Card
          theme={theme}
          style={styles.entryCard}
          testID={`photo-grid-skeleton-entry-${variant}`}
        >
          <View style={styles.entryHeaderRow}>
            <SkeletonBlock
              accessibilityLabel={accessibilityLabel}
              height={gridLayout.isSELike ? 42 : 48}
              scheme={theme.scheme}
              style={styles.entryIcon}
              testID="photo-grid-skeleton-entry-icon"
              width={gridLayout.isSELike ? 42 : 48}
            />
            <View style={styles.entryCopy}>
              <SkeletonBlock
                accessibilityLabel={accessibilityLabel}
                height={18}
                scheme={theme.scheme}
                testID="photo-grid-skeleton-entry-title"
                width="58%"
              />
              <SkeletonBlock
                accessibilityLabel={accessibilityLabel}
                height={14}
                scheme={theme.scheme}
                testID="photo-grid-skeleton-entry-body"
                width="86%"
              />
            </View>
          </View>
          <View style={styles.filterRow} testID="photo-grid-skeleton-filters">
            {(variant === 'permissionDenied' ? [0] : [0, 1, 2]).map((index) => (
              <SkeletonBlock
                key={index}
                accessibilityLabel={accessibilityLabel}
                height={gridLayout.isSELike ? 30 : 34}
                scheme={theme.scheme}
                style={isScanReady && index === 0 ? styles.actionPill : styles.filterPill}
                testID={`photo-grid-skeleton-filter-${index}`}
                width={
                  variant === 'permissionDenied'
                    ? '100%'
                    : isScanReady && index === 0
                      ? '100%'
                      : index === 0
                        ? 72
                        : 62
                }
              />
            ))}
          </View>
        </Card>

        {previewTileCount > 0 ? (
          <View style={styles.grid} testID="photo-grid-skeleton-grid">
            {Array.from({ length: previewTileCount }, (_, index) => (
              <SkeletonBlock
                key={index}
                accessibilityLabel={accessibilityLabel}
                height={gridLayout.itemSize}
                scheme={theme.scheme}
                style={styles.gridTile}
                testID={`photo-grid-skeleton-grid-item-${index}`}
                width={gridLayout.itemSize}
              />
            ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
});

function createStyles(
  theme: AppThemePalette,
  insets: { top: number; bottom: number; left: number; right: number },
  gridLayout: MediaGridLayout,
  contentPadding: { left: number; right: number; bottom: number },
) {
  const topPadding = Math.max(insets.top - 12, 0);

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.safeArea,
    },
    scrollContent: {
      paddingTop: topPadding,
      paddingBottom: contentPadding.bottom,
    },
    entryCard: {
      marginHorizontal: gridLayout.isSELike ? 16 : 20,
      marginBottom: 18,
      paddingHorizontal: gridLayout.isSELike ? 18 : 22,
      paddingVertical: gridLayout.isSELike ? 18 : 22,
      borderRadius: gridLayout.isSELike ? 22 : 28,
      backgroundColor: theme.cardBackground,
      borderWidth: 0,
      shadowColor: theme.shadowColor,
      shadowOffset: { width: 0, height: gridLayout.isSELike ? 8 : 14 },
      shadowOpacity: theme.scheme === 'dark' ? 0.14 : 0.055,
      shadowRadius: gridLayout.isSELike ? 18 : 28,
      elevation: gridLayout.isSELike ? 2 : 3,
    },
    entryHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: gridLayout.isSELike ? 12 : 14,
    },
    entryIcon: {
      borderRadius: 16,
    },
    entryCopy: {
      flex: 1,
      gap: 9,
      minWidth: 0,
    },
    filterRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: gridLayout.isSELike ? 16 : 18,
    },
    filterPill: {
      borderRadius: 999,
    },
    actionPill: {
      borderRadius: 999,
      marginTop: gridLayout.isSELike ? 2 : 4,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: gridLayout.spacing,
      paddingLeft: gridLayout.sidePadding,
      paddingRight: gridLayout.sidePadding,
      paddingBottom: contentPadding.bottom,
    },
    gridTile: {
      borderRadius: gridLayout.isSELike ? 14 : 16,
      padding: 0,
    },
  });
}
