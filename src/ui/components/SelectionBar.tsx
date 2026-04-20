import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { AppThemePalette } from '../../theme/app-theme';

interface SelectionBarProps {
  selectedCount: number;
  totalCount: number;
  isSelectionMode: boolean;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onClean: () => void;
  theme: AppThemePalette;
  locale?: string;
}

export function SelectionBar({
  selectedCount,
  totalCount,
  isSelectionMode,
  onSelectAll,
  onDeselectAll,
  onClean,
  theme,
  locale = 'zh-CN',
}: SelectionBarProps) {
  if (!isSelectionMode) {
    return null;
  }

  const styles = createStyles(theme);
  const isEnglish = locale === 'en-US';
  const hasSelection = selectedCount > 0;

  const selectionText = isEnglish
    ? `${selectedCount} selected`
    : `已选择 ${selectedCount} 张`;

  return (
    <View style={styles.container} testID="selection-bar">
      <Text style={styles.countText} testID="selection-count">
        {selectionText}
      </Text>

      <View style={styles.buttonGroup}>
        {hasSelection ? (
          <TouchableOpacity
            style={styles.button}
            onPress={onDeselectAll}
            testID="deselect-all-button"
          >
            <Text style={styles.buttonText}>
              {isEnglish ? 'Deselect All' : '取消全选'}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.button}
            onPress={onSelectAll}
            testID="select-all-button"
          >
            <Text style={styles.buttonText}>
              {isEnglish ? 'Select All' : '全选'}
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.button, styles.cleanButton, !hasSelection && styles.disabledButton]}
          onPress={onClean}
          disabled={!hasSelection}
          testID="clean-button"
        >
          <Text style={[styles.buttonText, styles.cleanButtonText]}>
            {isEnglish ? 'Clean' : '清理'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function createStyles(theme: AppThemePalette) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: theme.cardBackground,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.cardBorder,
    },
    countText: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.pageTextPrimary,
    },
    buttonGroup: {
      flexDirection: 'row',
      gap: 12,
    },
    button: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: theme.cardMutedBackground,
      borderWidth: 1,
      borderColor: theme.cardBorder,
    },
    buttonText: {
      fontSize: 14,
      fontWeight: '500',
      color: theme.pageTextPrimary,
    },
    cleanButton: {
      backgroundColor: theme.buttonDangerBackground,
      borderColor: theme.buttonDangerBackground,
    },
    cleanButtonText: {
      color: theme.buttonDangerText,
    },
    disabledButton: {
      opacity: 0.5,
    },
  });
}
