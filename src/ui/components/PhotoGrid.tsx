import React, { memo, useCallback, useMemo, useRef } from 'react';
import { StyleSheet, Dimensions, View, Text, FlatList } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import type { CleanupCandidate } from '../../domain/recognition/types';
import type { AppThemePalette } from '../../theme/app-theme';
import { buildSizedImageSource } from './image-source';
import { TouchSurface } from './TouchSurface';

interface PhotoGridProps {
  candidates: CleanupCandidate[];
  selectedIds: string[];
  selectionMode?: boolean;
  onSelect: (id: string) => void;
  onItemPress: (candidate: CleanupCandidate) => void;
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
}

const { width } = Dimensions.get('window');
const NUM_COLUMNS = 3;
const SPACING = 8;
const GRID_SIDE_PADDING = 16;
const ITEM_SIZE = (width - GRID_SIDE_PADDING * 2 - SPACING * (NUM_COLUMNS - 1)) / NUM_COLUMNS;
const SIZE_SMALL = 12;

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
  theme,
  mediaType = 'all',
  gridTestID,
  itemTestID = 'photo-grid-item',
  contentPadding,
}: PhotoGridProps) {
  const styles = useMemo(() => createStyles(theme, contentPadding), [contentPadding, theme]);
  const isSelectionMode = selectionMode ?? selectedIds.length > 0;
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

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
        itemTestID={itemTestID}
        theme={theme}
      />
    );
  }, [duplicateCountByGroup, isSelectionMode, itemTestID, onItemPress, onSelect, selectedIdSet, theme]);

  const keyExtractor = useCallback((item: CleanupCandidate) => item.id, []);
  const getItemLayout = useCallback(
    (_data: ArrayLike<CleanupCandidate> | null | undefined, index: number) => {
      const rowHeight = ITEM_SIZE + SPACING;
      const rowIndex = Math.floor(index / NUM_COLUMNS);

      return {
        length: rowHeight,
        offset: rowHeight * rowIndex,
        index,
      };
    },
    [],
  );

  return (
    <FlatList
      data={filteredCandidates}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      numColumns={NUM_COLUMNS}
      contentContainerStyle={styles.list}
      showsVerticalScrollIndicator={false}
      extraData={selectedIds}
      getItemLayout={getItemLayout}
      initialNumToRender={18}
      maxToRenderPerBatch={18}
      updateCellsBatchingPeriod={16}
      windowSize={7}
      removeClippedSubviews
      testID={gridTestID}
    />
  );
}

interface PhotoGridItemProps {
  candidate: CleanupCandidate;
  duplicateCount: number;
  isSelected: boolean;
  selectionMode: boolean;
  onPress: () => void;
  onSelect: () => void;
  itemTestID: string;
  theme: AppThemePalette;
}

function PhotoGridItem({
  candidate,
  duplicateCount,
  isSelected,
  selectionMode,
  onPress,
  onSelect,
  itemTestID,
  theme,
}: PhotoGridItemProps) {
  const styles = useMemo(() => createStyles(theme), [theme]);
  const lastLongPressAtRef = useRef(0);

  const handleLongPress = () => {
    lastLongPressAtRef.current = Date.now();
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
        source={buildSizedImageSource(resolveThumbnailUri(candidate), ITEM_SIZE, ITEM_SIZE)}
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
          <Ionicons
            name="videocam"
            size={13}
            color={theme.buttonTertiaryText}
            testID="video-indicator-icon"
          />
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
            size={14}
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
) {
  return StyleSheet.create({
    list: {
      paddingTop: (contentPadding?.top ?? 0) + 6,
      paddingBottom: (contentPadding?.bottom ?? 0) + 6,
      paddingLeft: (contentPadding?.left ?? 0) + GRID_SIDE_PADDING - SPACING / 2,
      paddingRight: (contentPadding?.right ?? 0) + GRID_SIDE_PADDING - SPACING / 2,
    },
    item: {
      width: ITEM_SIZE,
      height: ITEM_SIZE,
      margin: SPACING / 2,
      backgroundColor: theme.thumbnailBackground,
      position: 'relative',
      borderRadius: 12,
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
      top: 6,
      left: 6,
      backgroundColor: 'rgba(66, 66, 69, 0.88)',
      borderRadius: 7,
      width: 26,
      height: 22,
      justifyContent: 'center',
      alignItems: 'center',
    },
    duplicateBadge: {
      position: 'absolute',
      bottom: 6,
      left: 6,
      minWidth: 22,
      height: 20,
      borderRadius: 10,
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
      top: 8,
      right: 8,
      borderRadius: 12,
      width: 24,
      height: 24,
      backgroundColor: 'rgba(255, 255, 255, 0.08)',
      borderWidth: 2,
      borderColor: 'rgba(255, 255, 255, 0.96)',
      shadowColor: theme.shadowColor,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: theme.scheme === 'dark' ? 0.3 : 0.16,
      shadowRadius: 6,
      elevation: 3,
    },
    selectionIndicatorFilled: {
      position: 'absolute',
      top: 8,
      right: 8,
      borderRadius: 12,
      width: 24,
      height: 24,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#2f80ff',
      borderWidth: 2,
      borderColor: 'rgba(255, 255, 255, 0.96)',
      shadowColor: theme.shadowColor,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: theme.scheme === 'dark' ? 0.3 : 0.16,
      shadowRadius: 6,
      elevation: 3,
    },
  });
}
