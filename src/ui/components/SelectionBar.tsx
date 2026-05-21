import React from 'react';
import { View, StyleSheet } from 'react-native';

import { getAppCopy } from '../../i18n/app-copy';
import { normalizeAppLanguage } from '../../i18n/app-language';
import type { AppThemePalette } from '../../theme/app-theme';
import { COMPONENT_TOKENS } from '../../theme/generated/component-tokens.generated';
import { Button, Text } from '../primitives';

export const SELECTION_BAR_STYLE_TOKENS = COMPONENT_TOKENS.selectionBar;

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
  const copy = getAppCopy(normalizeAppLanguage(locale)).components.selectionBar;
  const hasSelection = selectedCount > 0;
  const selectionText = copy.selectedItems(selectedCount);

  return (
    <View style={styles.container} testID="selection-bar">
      <Text
        variant="body"
        theme={theme}
        style={styles.countText}
        testID="selection-count"
      >
        {selectionText}
      </Text>

      <View style={styles.buttonGroup}>
        {hasSelection ? (
          <Button
            variant="secondary"
            theme={theme}
            style={styles.button}
            textStyle={styles.buttonText}
            onPress={onDeselectAll}
            testID="deselect-all-button"
          >
            {copy.deselectAll}
          </Button>
        ) : (
          <Button
            variant="secondary"
            theme={theme}
            style={styles.button}
            textStyle={styles.buttonText}
            onPress={onSelectAll}
            testID="select-all-button"
          >
            {copy.selectAll}
          </Button>
        )}

        <Button
          variant="danger"
          theme={theme}
          style={[styles.button, styles.cleanButton, !hasSelection && styles.disabledButton]}
          textStyle={[styles.buttonText, styles.cleanButtonText]}
          onPress={onClean}
          disabled={!hasSelection}
          testID="clean-button"
        >
          {copy.clean}
        </Button>
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
      paddingHorizontal: SELECTION_BAR_STYLE_TOKENS.spacing.horizontal,
      paddingVertical: SELECTION_BAR_STYLE_TOKENS.spacing.vertical,
      backgroundColor: theme.cardBackground,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.cardBorder,
    },
    countText: {
      fontSize: SELECTION_BAR_STYLE_TOKENS.typography.countSize,
      fontWeight: SELECTION_BAR_STYLE_TOKENS.typography.countWeight,
      color: theme.pageTextPrimary,
    },
    buttonGroup: {
      flexDirection: 'row',
      gap: SELECTION_BAR_STYLE_TOKENS.spacing.buttonGap,
    },
    button: {
      minHeight: SELECTION_BAR_STYLE_TOKENS.size.buttonMinHeight,
      paddingHorizontal: SELECTION_BAR_STYLE_TOKENS.spacing.buttonHorizontal,
      paddingVertical: SELECTION_BAR_STYLE_TOKENS.spacing.buttonVertical,
      borderRadius: SELECTION_BAR_STYLE_TOKENS.radius.button,
      backgroundColor: theme.cardMutedBackground,
      borderWidth: SELECTION_BAR_STYLE_TOKENS.border.buttonWidth,
      borderColor: theme.cardBorder,
    },
    buttonText: {
      fontSize: SELECTION_BAR_STYLE_TOKENS.typography.buttonSize,
      fontWeight: SELECTION_BAR_STYLE_TOKENS.typography.buttonWeight,
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
      opacity: SELECTION_BAR_STYLE_TOKENS.state.disabledOpacity,
    },
  });
}
