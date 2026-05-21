import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NativeScrollEvent, StyleSheet, useWindowDimensions, View, FlatList } from 'react-native';
import { Image } from 'expo-image';
import { GestureDetector } from 'react-native-gesture-handler';

import type { CleanupCandidate } from '../../domain/recognition/types';
import type { AppThemePalette } from '../../theme/app-theme';
import { COMPONENT_TOKENS } from '../../theme/generated/component-tokens.generated';
import { buildOrientedImageFrameStyle, buildSizedImageSource } from './image-source';
import { AppIcon } from '../icons/AppIcon';
import { DesignIcon } from '../icons/DesignIcon';
import { Badge, Text as PrimitiveText, TouchSurface } from '../primitives';
import {
  buildMediaGridLayout,
  type MediaGridLayout,
} from '../screens/screen-layout';
import { useSwipeSelection, type SwipeSelectionReason } from '../hooks/useSwipeSelection';

interface PhotoGridProps {
  candidates: CleanupCandidate[];
  selectedIds: string[];
  selectionMode?: boolean;
  onSelect: (id: string) => void;
  onSelectionChange?: (nextIds: string[], reason: SwipeSelectionReason) => void;
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

export const PHOTO_GRID_STYLE_TOKENS = COMPONENT_TOKENS.photoGrid;

const displayedThumbnailUris = new Set<string>();

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
  onSelectionChange,
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
  const gridContentTopOffset =
    (contentPadding?.top ?? 0) +
    PHOTO_GRID_STYLE_TOKENS.list.edgePadding +
    resolvedGridLayout.spacing / 2;
  const isSelectionMode = selectionMode ?? selectedIds.length > 0;
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const filteredCandidates = useMemo(() => {
    if (mediaType === 'all') return candidates;
    return candidates.filter(c => c.asset.mediaType === mediaType);
  }, [candidates, mediaType]);
  const duplicateCountByGroup = useMemo(() => buildDuplicateCountByGroup(candidates), [candidates]);

  const { panGesture } = useSwipeSelection({
    candidates: filteredCandidates,
    selectedIds,
    onSelectionChange,
    gridLayout: resolvedGridLayout,
    scrollOffset,
    contentTopOffset: gridContentTopOffset,
    isSelectionMode,
  });

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
  const thumbnailUri = resolveThumbnailUri(candidate);
  const thumbnailSource = useMemo(
    () => buildSizedImageSource(thumbnailUri, gridLayout.itemSize, gridLayout.itemSize),
    [gridLayout.itemSize, thumbnailUri],
  );
  const [hasDisplayedThumbnail, setHasDisplayedThumbnail] = useState(() =>
    displayedThumbnailUris.has(thumbnailUri),
  );
  const videoIconWidth = gridLayout.isSELike
    ? PHOTO_GRID_STYLE_TOKENS.videoBadge.iconWidthCompact
    : PHOTO_GRID_STYLE_TOKENS.videoBadge.iconWidthRegular;
  const videoIconHeight = videoIconWidth * PHOTO_GRID_STYLE_TOKENS.videoBadge.iconHeightRatio;

  useEffect(() => {
    setHasDisplayedThumbnail(displayedThumbnailUris.has(thumbnailUri));
  }, [thumbnailUri]);

  const handleThumbnailDisplay = useCallback(() => {
    displayedThumbnailUris.add(thumbnailUri);
    setHasDisplayedThumbnail(true);
  }, [thumbnailUri]);

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
        source={thumbnailSource}
        placeholder={hasDisplayedThumbnail ? thumbnailSource : undefined}
        style={[
          styles.thumbnail,
          buildOrientedImageFrameStyle(
            gridLayout.itemSize,
            gridLayout.itemSize,
            candidate.asset.orientation,
          ),
        ]}
        contentFit="cover"
        cachePolicy="memory-disk"
        priority="normal"
        allowDownscaling
        decodeFormat="rgb"
        transition={0}
        recyclingKey={thumbnailUri}
        onDisplay={handleThumbnailDisplay}
        testID="photo-grid-image"
      />
      {candidate.asset.mediaType === 'video' && (
        <View style={styles.videoIndicator} testID="video-indicator">
          <DesignIcon
            name="video"
            width={videoIconWidth}
            height={videoIconHeight}
            align="start"
            color={PHOTO_GRID_STYLE_TOKENS.videoBadge.foreground}
            testID="video-indicator-icon"
          />
          <PrimitiveText theme={theme} style={styles.videoIndicatorText}>
            {formatDuration(candidate.asset.duration)}
          </PrimitiveText>
        </View>
      )}
      {duplicateCount > 1 ? (
        <View style={styles.duplicateBadge} testID="duplicate-count-badge">
          <Badge
            variant="danger"
            theme={theme}
            style={styles.duplicateBadgeContent}
            textStyle={styles.duplicateBadgeText}
          >
            {duplicateCount}
          </Badge>
        </View>
      ) : null}
      {selectionMode && !isSelected ? (
        <View style={styles.selectionIndicatorEmpty} testID="selection-indicator-empty" />
      ) : null}
      {isSelected ? (
        <View style={styles.selectionIndicatorFilled} testID="selection-checkmark">
          <AppIcon
            name="checkmark"
            size={
              gridLayout.isSELike
                ? PHOTO_GRID_STYLE_TOKENS.selection.checkIconSizeCompact
                : PHOTO_GRID_STYLE_TOKENS.selection.checkIconSizeRegular
            }
            color={PHOTO_GRID_STYLE_TOKENS.selection.foreground}
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
    prevProps.candidate.asset.orientation === nextProps.candidate.asset.orientation &&
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
  const tokens = PHOTO_GRID_STYLE_TOKENS;
  const selectionIndicatorSize = isCompact
    ? tokens.selection.sizeCompact
    : tokens.selection.sizeRegular;
  const selectionIndicatorOffset = isCompact
    ? tokens.selection.offsetCompact
    : tokens.selection.offsetRegular;
  const selectionIndicatorBorderWidth = isCompact
    ? tokens.selection.borderWidthCompact
    : tokens.selection.borderWidthRegular;
  const itemRadius = isCompact ? tokens.item.radiusCompact : tokens.item.radiusRegular;
  const videoBadgeHeight = isCompact
    ? tokens.videoBadge.heightCompact
    : tokens.videoBadge.heightRegular;

  return StyleSheet.create({
    list: {
      paddingTop: (contentPadding?.top ?? 0) + tokens.list.edgePadding,
      paddingBottom: (contentPadding?.bottom ?? 0) + tokens.list.edgePadding,
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
      borderWidth: theme.scheme === 'light' ? StyleSheet.hairlineWidth : tokens.item.darkBorderWidth,
      borderColor:
        theme.scheme === 'light'
          ? tokens.item.lightBorderColor
          : theme.cardBorder,
      overflow: 'hidden',
    },
    itemPressed: {
      shadowColor: theme.shadowColor,
      shadowOffset: { width: 0, height: tokens.item.pressedShadowOffsetY },
      shadowOpacity:
        theme.scheme === 'dark'
          ? tokens.item.pressedShadowOpacityDark
          : tokens.item.pressedShadowOpacityLight,
      shadowRadius: tokens.item.pressedShadowRadius,
      elevation: tokens.item.pressedElevation,
    },
    thumbnail: {
      width: '100%',
      height: '100%',
    },
    videoIndicator: {
      position: 'absolute',
      left: isCompact ? tokens.videoBadge.leftCompact : tokens.videoBadge.leftRegular,
      bottom: isCompact ? tokens.videoBadge.bottomCompact : tokens.videoBadge.bottomRegular,
      flexDirection: 'row',
      alignItems: 'center',
      gap: isCompact ? tokens.videoBadge.gapCompact : tokens.videoBadge.gapRegular,
      paddingLeft: isCompact ? tokens.videoBadge.paddingLeftCompact : tokens.videoBadge.paddingLeftRegular,
      paddingRight: isCompact ? tokens.videoBadge.paddingRightCompact : tokens.videoBadge.paddingRightRegular,
      height: videoBadgeHeight,
      backgroundColor: tokens.videoBadge.background,
      borderRadius: tokens.videoBadge.radius,
      justifyContent: 'center',
    },
    videoIndicatorText: {
      color: tokens.videoBadge.foreground,
      fontSize: isCompact ? tokens.videoBadge.textSizeCompact : tokens.videoBadge.textSizeRegular,
      fontWeight: tokens.videoBadge.textWeight,
      lineHeight: isCompact
        ? tokens.videoBadge.textLineHeightCompact
        : tokens.videoBadge.textLineHeightRegular,
    },
    duplicateBadge: {
      position: 'absolute',
      bottom: tokens.duplicateBadge.bottom,
      right: tokens.duplicateBadge.right,
      minWidth: tokens.duplicateBadge.minWidth,
      height: tokens.duplicateBadge.height,
      borderRadius: tokens.duplicateBadge.radius,
      paddingHorizontal: tokens.duplicateBadge.paddingHorizontal,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: tokens.duplicateBadge.background,
    },
    duplicateBadgeContent: {
      alignSelf: 'auto',
      backgroundColor: 'transparent',
      borderWidth: 0,
      height: tokens.duplicateBadge.contentHeight,
      minHeight: tokens.duplicateBadge.contentHeight,
      minWidth: 0,
      paddingHorizontal: 0,
      paddingVertical: 0,
    },
    duplicateBadgeText: {
      color: tokens.duplicateBadge.foreground,
      fontSize: tokens.duplicateBadge.textSize,
      fontWeight: tokens.duplicateBadge.textWeight,
    },
    selectionIndicatorEmpty: {
      position: 'absolute',
      top: selectionIndicatorOffset,
      right: selectionIndicatorOffset,
      borderRadius: selectionIndicatorSize / 2,
      width: selectionIndicatorSize,
      height: selectionIndicatorSize,
      backgroundColor: isCompact
        ? tokens.selection.emptyBackgroundCompact
        : tokens.selection.emptyBackgroundRegular,
      borderWidth: selectionIndicatorBorderWidth,
      borderColor: isCompact ? tokens.selection.borderColorCompact : tokens.selection.borderColorRegular,
      shadowColor: theme.shadowColor,
      shadowOffset: {
        width: 0,
        height: isCompact ? tokens.selection.shadowOffsetYCompact : tokens.selection.shadowOffsetYRegular,
      },
      shadowOpacity: isCompact
        ? tokens.selection.shadowOpacityCompact
        : theme.scheme === 'dark'
          ? tokens.selection.shadowOpacityDark
          : tokens.selection.shadowOpacityLight,
      shadowRadius: isCompact ? tokens.selection.shadowRadiusCompact : tokens.selection.shadowRadiusRegular,
      elevation: isCompact ? tokens.selection.elevationCompact : tokens.selection.elevationRegular,
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
      backgroundColor: tokens.selection.filledBackground,
      borderWidth: selectionIndicatorBorderWidth,
      borderColor: isCompact ? tokens.selection.borderColorCompact : tokens.selection.borderColorRegular,
      shadowColor: theme.shadowColor,
      shadowOffset: {
        width: 0,
        height: isCompact ? tokens.selection.shadowOffsetYCompact : tokens.selection.shadowOffsetYRegular,
      },
      shadowOpacity: isCompact
        ? tokens.selection.shadowOpacityCompact
        : theme.scheme === 'dark'
          ? tokens.selection.shadowOpacityDark
          : tokens.selection.shadowOpacityLight,
      shadowRadius: isCompact ? tokens.selection.shadowRadiusCompact : tokens.selection.shadowRadiusRegular,
      elevation: isCompact ? tokens.selection.elevationCompact : tokens.selection.elevationRegular,
    },
  });
}
