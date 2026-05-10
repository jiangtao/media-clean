import React, { memo, useCallback, useMemo, useRef, useState } from 'react';
import { NativeScrollEvent, StyleSheet, useWindowDimensions, View, Text, FlatList } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { GestureDetector } from 'react-native-gesture-handler';

import type { CleanupCandidate } from '../../domain/recognition/types';
import type { AppThemePalette } from '../../theme/app-theme';
import { buildSizedImageSource } from './image-source';
import { TouchSurface } from './TouchSurface';
import { DesignIcon } from '../icons/DesignIcon';
import {
  buildMediaGridLayout,
  type MediaGridLayout,
} from '../screens/screen-layout';
import { useSwipeSelection } from '../hooks/useSwipeSelection';

interface PhotoGridProps {
  candidates: CleanupCandidate[];
  selectedIds: string[];
  selectionMode?: boolean;
  onSelect: (id: string) => void;
  onItemPress: (candidate: CleanupCandidate) => void;
  onItemLongPress?: (candidate: CleanupCandidate) => void;
  theme: AppThemePalette;
  mediaType?: 'all' | 'photo' | 'video';
  gridTestID?: string;
  itemTestID?: string;
  contentPadding?: {
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
  };
  gridLayout?: MediaGridLayout;
}

const SIZE_SMALL = 12;

function formatDuration(seconds: number) {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = String(safeSeconds % 60).padStart(2, '0');

  return `${minutes}:${remainder}`;
}

function resolveThumbnailUri(candidate: CleanupCandidate) {
  if (candidate.asset.mediaType === 'photo') {
    return candidate.asset.uri;
  }

  return candidate.asset.previewUri ?? candidate.asset.uri;
}

function buildDuplicateCountByGroup(candidates: CleanupCandidate[]) {
  const counts = new Map<string, number>();

  for (const candidate of candidates) {
    const groupId = candidate.duplicateGroup?.groupId;
    if (!groupId) {
      continue;
    }

    counts.set(groupId, (counts.get(groupId) ?? 0) + 1);
  }

  return counts;
}

export function PhotoGrid({
  candidates,
  selectedIds,
  selectionMode,
  onSelect,
  onItemPress,
  onItemLongPress,
  theme,
  mediaType = 'all',
  gridTestID,
  itemTestID = 'photo-grid-item',
  contentPadding,
  gridLayout,
}: PhotoGridProps) {
  const dimensions = useWindowDimensions();
  const [scrollOffset, setScrollOffset] = useState(0);
  const resolvedGridLayout = useMemo(
    () =>
      gridLayout ??
      buildMediaGridLayout(
        { top: 0, bottom: 0, left: 0, right: 0 },
        dimensions,
      ),
    [dimensions, gridLayout],
  );
  const styles = useMemo(
    () => createStyles(theme, contentPadding, resolvedGridLayout),
    [contentPadding, resolvedGridLayout, theme],
  );
  const isSelectionMode = selectionMode ?? selectedIds.length > 0;
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  // Swipe selection hook
  const { panGesture } = useSwipeSelection({
    candidates,
    selectedIds,
    onSelect,
    gridLayout: resolvedGridLayout,
    scrollOffset,
    isSelectionMode,
  });

  const filteredCandidates = useMemo(() => {
    if (mediaType === 'all') return candidates;
    return candidates.filter(c => c.asset.mediaType === mediaType);
  }, [candidates, mediaType]);
  const duplicateCountByGroup = useMemo(() => buildDuplicateCountByGroup(candidates), [candidates]);

  const renderItem = useCallback(({ item }: { item: CleanupCandidate }) => {
    const duplicateCount = item.duplicateGroup?.groupId
      ? duplicateCountByGroup.get(item.duplicateGroup.groupId) ?? 0
      : 0;

    return (
      <MemoPhotoGridItem
        candidate={item}
        duplicateCount={duplicateCount}
        isSelected={selectedIdSet.has(item.id)}
        selectionMode={isSelectionMode}
        onPress={() => onItemPress(item)}
        onSelect={() => onSelect(item.id)}
        onLongPress={onItemLongPress ? () => onItemLongPress(item) : undefined}
        itemTestID={itemTestID}
        theme={theme}
        gridLayout={resolvedGridLayout}
      />
    );
  }, [
    duplicateCountByGroup,
    isSelectionMode,
    itemTestID,
    onItemPress,
    onItemLongPress,
    onSelect,
    resolvedGridLayout,
    selectedIdSet,
    theme,
  ]);

  const keyExtractor = useCallback((item: CleanupCandidate) => item.id, []);
  const getItemLayout = useCallback(
    (_data: ArrayLike<CleanupCandidate> | null | undefined, index: number) => {
      const rowHeight = resolvedGridLayout.itemSize + resolvedGridLayout.spacing;
      const rowIndex = Math.floor(index / resolvedGridLayout.columns);

      return {
        length: rowHeight,
        offset: rowHeight * rowIndex,
        index,
      };
    },
    [resolvedGridLayout],
  );

  const handleScroll = useCallback((event: { nativeEvent: NativeScrollEvent }) => {
    setScrollOffset(event.nativeEvent.contentOffset.y);
  }, []);

  return (
    <GestureDetector gesture={panGesture}>
      <FlatList
        key={`photo-grid-${resolvedGridLayout.columns}`}
        data={filteredCandidates}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        numColumns={resolvedGridLayout.columns}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        extraData={`${selectedIds.join(',')}:${resolvedGridLayout.columns}:${resolvedGridLayout.itemSize}`}
        getItemLayout={getItemLayout}
        initialNumToRender={18}
        maxToRenderPerBatch={18}
        updateCellsBatchingPeriod={16}
        windowSize={7}
        removeClippedSubviews
        scrollEventThrottle={16}
        onScroll={handleScroll}
        testID={gridTestID}
      />
    </GestureDetector>
  );
}

interface PhotoGridItemProps {
  candidate: CleanupCandidate;
  duplicateCount: number;
  isSelected: boolean;
  selectionMode: boolean;
  onPress: () => void;
  onSelect: () => void;
  onLongPress?: () => void;
  itemTestID: string;
  theme: AppThemePalette;
  gridLayout: MediaGridLayout;
}

function PhotoGridItem({
  candidate,
  duplicateCount,
  isSelected,
  selectionMode,
  onPress,
  onSelect,
  onLongPress,
  itemTestID,
  theme,
  gridLayout,
}: PhotoGridItemProps) {
  const styles = useMemo(() => createStyles(theme, undefined, gridLayout), [gridLayout, theme]);
  const lastLongPressAtRef = useRef(0);
  const videoIconWidth = gridLayout.isSELike ? 15 : 16;
  const videoIconHeight = videoIconWidth * 0.9;

  const handleLongPress = () => {
    lastLongPressAtRef.current = Date.now();
    if (onLongPress) {
      onLongPress();
      return;
    }

    onSelect();
  };

  const handlePress = () => {
    if (Date.now() - lastLongPressAtRef.current < 350) {
      return;
    }

    if (selectionMode) {
      onSelect();
      return;
    }

    onPress();
  };

  return (
    <TouchSurface
      onPress={handlePress}
      onLongPress={handleLongPress}
      style={styles.item}
      pressedStyle={styles.itemPressed}
      preset="tile"
      testID={itemTestID}
    >
      <Image
        source={buildSizedImageSource(
          resolveThumbnailUri(candidate),
          gridLayout.itemSize,
          gridLayout.itemSize,
        )}
        style={styles.thumbnail}
        contentFit="cover"
        cachePolicy="memory-disk"
        priority="normal"
        allowDownscaling
        decodeFormat="rgb"
        transition={0}
        recyclingKey={resolveThumbnailUri(candidate)}
        testID="photo-grid-image"
      />
      {candidate.asset.mediaType === 'video' && (
        <View style={styles.videoIndicator} testID="video-indicator">
          <DesignIcon
            name="video"
            width={videoIconWidth}
            height={videoIconHeight}
            align="start"
            color="#ffffff"
            testID="video-indicator-icon"
          />
          <Text style={styles.videoIndicatorText}>
            {formatDuration(candidate.asset.duration)}
          </Text>
        </View>
      )}
      {duplicateCount > 1 ? (
        <View style={styles.duplicateBadge} testID="duplicate-count-badge">
          <Text style={styles.duplicateBadgeText}>{duplicateCount}</Text>
        </View>
      ) : null}
      {selectionMode && !isSelected ? (
        <View style={styles.selectionIndicatorEmpty} testID="selection-indicator-empty" />
      ) : null}
      {isSelected ? (
        <View style={styles.selectionIndicatorFilled} testID="selection-checkmark">
          <Ionicons
            name="checkmark"
            size={gridLayout.isSELike ? 11 : 13}
            color="#ffffff"
            testID="selection-checkmark-icon"
          />
        </View>
      ) : null}
    </TouchSurface>
  );
}

const MemoPhotoGridItem = memo(PhotoGridItem, (prevProps, nextProps) => {
  return (
    prevProps.candidate.id === nextProps.candidate.id &&
    prevProps.candidate.asset.uri === nextProps.candidate.asset.uri &&
    prevProps.candidate.asset.previewUri === nextProps.candidate.asset.previewUri &&
    prevProps.candidate.asset.mediaType === nextProps.candidate.asset.mediaType &&
    prevProps.duplicateCount === nextProps.duplicateCount &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.selectionMode === nextProps.selectionMode &&
    prevProps.theme === nextProps.theme
  );
});

function createStyles(
  theme: AppThemePalette,
  contentPadding?: PhotoGridProps['contentPadding'],
  gridLayout: MediaGridLayout = buildMediaGridLayout(
    { top: 0, bottom: 0, left: 0, right: 0 },
    { width: 375, height: 812, scale: 3, fontScale: 1 },
  ),
) {
  const isCompact = gridLayout.isSELike;
  const selectionIndicatorSize = isCompact ? 18 : 24;
  const selectionIndicatorOffset = isCompact ? 7 : 10;
  const selectionIndicatorBorderWidth = isCompact ? 1.5 : 2;
  const itemRadius = isCompact ? 16 : 18;
  const videoBadgeHeight = isCompact ? 23 : 25;

  return StyleSheet.create({
    list: {
      paddingTop: (contentPadding?.top ?? 0) + 6,
      paddingBottom: (contentPadding?.bottom ?? 0) + 6,
      paddingLeft: (contentPadding?.left ?? 0) + gridLayout.sidePadding - gridLayout.spacing / 2,
      paddingRight: (contentPadding?.right ?? 0) + gridLayout.sidePadding - gridLayout.spacing / 2,
    },
    item: {
      width: gridLayout.itemSize,
      height: gridLayout.itemSize,
      margin: gridLayout.spacing / 2,
      backgroundColor: theme.thumbnailBackground,
      position: 'relative',
      borderRadius: itemRadius,
      borderWidth: theme.scheme === 'light' ? StyleSheet.hairlineWidth : 1,
      borderColor:
        theme.scheme === 'light'
          ? 'rgba(226, 232, 243, 0.44)'
          : theme.cardBorder,
      overflow: 'hidden',
    },
    itemPressed: {
      shadowColor: theme.shadowColor,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: theme.scheme === 'dark' ? 0.18 : 0.1,
      shadowRadius: 14,
      elevation: 4,
    },
    thumbnail: {
      width: '100%',
      height: '100%',
    },
    videoIndicator: {
      position: 'absolute',
      left: isCompact ? 7 : 8,
      bottom: isCompact ? 7 : 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: isCompact ? 4 : 5,
      paddingLeft: isCompact ? 7 : 8,
      paddingRight: isCompact ? 9 : 10,
      height: videoBadgeHeight,
      backgroundColor: 'rgba(15, 23, 42, 0.74)',
      borderRadius: 999,
      justifyContent: 'center',
    },
    videoIndicatorText: {
      color: '#ffffff',
      fontSize: isCompact ? 11 : 12,
      fontWeight: '700',
      lineHeight: isCompact ? 14 : 15,
    },
    duplicateBadge: {
      position: 'absolute',
      bottom: 8,
      right: 8,
      minWidth: 24,
      height: 22,
      borderRadius: 11,
      paddingHorizontal: 6,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#df676d',
    },
    duplicateBadgeText: {
      color: '#ffffff',
      fontSize: SIZE_SMALL,
      fontWeight: '800',
    },
    selectionIndicatorEmpty: {
      position: 'absolute',
      top: selectionIndicatorOffset,
      right: selectionIndicatorOffset,
      borderRadius: selectionIndicatorSize / 2,
      width: selectionIndicatorSize,
      height: selectionIndicatorSize,
      backgroundColor: isCompact ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255, 255, 255, 0.08)',
      borderWidth: selectionIndicatorBorderWidth,
      borderColor: isCompact ? 'rgba(255, 255, 255, 0.98)' : 'rgba(255, 255, 255, 0.96)',
      shadowColor: theme.shadowColor,
      shadowOffset: { width: 0, height: isCompact ? 1 : 2 },
      shadowOpacity: isCompact ? 0 : theme.scheme === 'dark' ? 0.3 : 0.16,
      shadowRadius: isCompact ? 0 : 6,
      elevation: isCompact ? 0 : 3,
    },
    selectionIndicatorFilled: {
      position: 'absolute',
      top: selectionIndicatorOffset,
      right: selectionIndicatorOffset,
      borderRadius: selectionIndicatorSize / 2,
      width: selectionIndicatorSize,
      height: selectionIndicatorSize,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#2f80ff',
      borderWidth: selectionIndicatorBorderWidth,
      borderColor: isCompact ? 'rgba(255, 255, 255, 0.98)' : 'rgba(255, 255, 255, 0.96)',
      shadowColor: theme.shadowColor,
      shadowOffset: { width: 0, height: isCompact ? 1 : 2 },
      shadowOpacity: isCompact ? 0 : theme.scheme === 'dark' ? 0.3 : 0.16,
      shadowRadius: isCompact ? 0 : 6,
      elevation: isCompact ? 0 : 3,
    },
  });
}
