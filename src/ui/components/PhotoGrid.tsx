import React, { useMemo } from 'react';
import { StyleSheet, Dimensions, Pressable, View, Text, FlatList } from 'react-native';
import { Image } from 'expo-image';

import type { CleanupCandidate } from '../../domain/recognition/types';
import type { AppThemePalette } from '../../theme/app-theme';

interface PhotoGridProps {
  candidates: CleanupCandidate[];
  selectedIds: string[];
  onSelect: (id: string) => void;
  onItemPress: (candidate: CleanupCandidate) => void;
  theme: AppThemePalette;
  mediaType?: 'all' | 'photo' | 'video';
}

const { width } = Dimensions.get('window');
const NUM_COLUMNS = 3;
const SPACING = 2;
const ITEM_SIZE = (width - SPACING * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

export function PhotoGrid({
  candidates,
  selectedIds,
  onSelect,
  onItemPress,
  theme,
  mediaType = 'all',
}: PhotoGridProps) {
  const styles = useMemo(() => createStyles(theme), [theme]);

  const filteredCandidates = useMemo(() => {
    if (mediaType === 'all') return candidates;
    return candidates.filter(c => c.asset.mediaType === mediaType);
  }, [candidates, mediaType]);

  const renderItem = ({ item }: { item: CleanupCandidate }) => {
    const isSelected = selectedIds.includes(item.id);
    return (
      <PhotoGridItem
        candidate={item}
        isSelected={isSelected}
        onPress={() => onItemPress(item)}
        onSelect={() => onSelect(item.id)}
        theme={theme}
      />
    );
  };

  return (
    <FlatList
      data={filteredCandidates}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      numColumns={NUM_COLUMNS}
      contentContainerStyle={styles.list}
      showsVerticalScrollIndicator={false}
    />
  );
}

interface PhotoGridItemProps {
  candidate: CleanupCandidate;
  isSelected: boolean;
  onPress: () => void;
  onSelect: () => void;
  theme: AppThemePalette;
}

function PhotoGridItem({ candidate, isSelected, onPress, onSelect, theme }: PhotoGridItemProps) {
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onSelect}
      style={[styles.item, isSelected && styles.selectedItem]}
    >
      <Image
        source={{ uri: candidate.asset.previewUri ?? candidate.asset.uri }}
        style={styles.thumbnail}
        contentFit="cover"
      />
      {candidate.asset.mediaType === 'video' && (
        <View style={styles.videoIndicator}>
          <Text style={styles.videoIcon}>▶</Text>
        </View>
      )}
      {isSelected && (
        <View style={styles.checkmark}>
          <Text style={styles.checkmarkText}>✓</Text>
        </View>
      )}
    </Pressable>
  );
}

function createStyles(theme: AppThemePalette) {
  return StyleSheet.create({
    list: {
      padding: SPACING / 2,
    },
    item: {
      width: ITEM_SIZE,
      height: ITEM_SIZE,
      margin: SPACING / 2,
      backgroundColor: theme.thumbnailBackground,
      position: 'relative',
    },
    selectedItem: {
      opacity: 0.7,
    },
    thumbnail: {
      width: '100%',
      height: '100%',
    },
    videoIndicator: {
      position: 'absolute',
      bottom: 4,
      right: 4,
      backgroundColor: 'rgba(0,0,0,0.6)',
      borderRadius: 12,
      width: 24,
      height: 24,
      justifyContent: 'center',
      alignItems: 'center',
    },
    videoIcon: {
      color: 'white',
      fontSize: 10,
    },
    checkmark: {
      position: 'absolute',
      top: 4,
      right: 4,
      backgroundColor: '#007AFF',
      borderRadius: 12,
      width: 24,
      height: 24,
      justifyContent: 'center',
      alignItems: 'center',
    },
    checkmarkText: {
      color: 'white',
      fontSize: 14,
      fontWeight: 'bold',
    },
  });
}
