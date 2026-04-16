import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useColorScheme } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { PhotoGrid } from '../components/PhotoGrid';
import { SegmentedControl } from '../components/SegmentedControl';
import { getAppTheme } from '../../theme/app-theme';
import type { CleanupCandidate } from '../../domain/recognition/types';
import type { AppLanguage } from '../../i18n/app-language';

const FILTER_OPTIONS = [
  { value: 'all', label: '全部' },
  { value: 'photo', label: '照片' },
  { value: 'video', label: '视频' },
];

export function PhotoGridScreen() {
  const systemTheme = useColorScheme();
  const theme = useMemo(() => getAppTheme(systemTheme ?? 'light'), [systemTheme]);
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [filter, setFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [candidates, setCandidates] = useState<CleanupCandidate[]>([]);

  useFocusEffect(
    useCallback(() => {
      // TODO: Load candidates from storage
      setCandidates([]);
    }, [])
  );

  const handleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleItemPress = (candidate: CleanupCandidate) => {
    // TODO: Navigate to detail
    console.log('Pressed:', candidate.id);
  };

  return (
    <View style={styles.container}>
      <SegmentedControl
        options={FILTER_OPTIONS}
        selectedValue={filter}
        onChange={setFilter}
      />
      <PhotoGrid
        candidates={candidates}
        selectedIds={selectedIds}
        onSelect={handleSelect}
        onItemPress={handleItemPress}
        theme={theme}
        mediaType={filter as 'all' | 'photo' | 'video'}
      />
      {selectedIds.length > 0 && (
        <View style={styles.actionBar}>
          <Text style={styles.actionText}>已选择 {selectedIds.length} 项</Text>
          <Pressable style={styles.actionButton}>
            <Text style={styles.actionButtonText}>清理</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function createStyles(theme: ReturnType<typeof getAppTheme>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.safeArea,
    },
    actionBar: {
      position: 'absolute',
      bottom: 80,
      left: 16,
      right: 16,
      backgroundColor: theme.actionBarBackground,
      borderRadius: 12,
      padding: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    actionText: {
      color: theme.actionBarText,
      fontSize: 14,
      fontWeight: '600',
    },
    actionButton: {
      backgroundColor: '#FF3B30',
      borderRadius: 8,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    actionButtonText: {
      color: '#FFFFFF',
      fontWeight: '600',
    },
  });
}
