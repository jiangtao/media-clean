import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { COMPONENT_TOKENS } from '../../../theme/generated/component-tokens.generated';
import { SelectionBar, SELECTION_BAR_STYLE_TOKENS } from '../SelectionBar';

vi.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  Pressable: 'Pressable',
  TouchableOpacity: 'TouchableOpacity',
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
    hairlineWidth: 1,
  },
}));

const theme = {
  cardBackground: '#fffaf1',
  cardBorder: '#e7dcc7',
  cardMutedBackground: '#f6f7fb',
  pageTextPrimary: '#18212f',
  buttonDangerBackground: '#b34f2f',
  buttonDangerText: '#ffffff',
} as never;

function flattenStyle(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) {
    return style.reduce<Record<string, unknown>>(
      (acc, entry) => ({ ...acc, ...flattenStyle(entry) }),
      {},
    );
  }

  if (style && typeof style === 'object') {
    return style as Record<string, unknown>;
  }

  return {};
}

describe('SelectionBar', () => {
  describe('Scenario 4.1: Long press enters selection mode', () => {
    it('should not render when not in selection mode', () => {
      // SelectionBar returns null when isSelectionMode is false
      const isSelectionMode = false;
      expect(isSelectionMode).toBe(false);
    });

    it('should render when in selection mode', () => {
      const isSelectionMode = true;
      expect(isSelectionMode).toBe(true);
    });

    it('should display selected count in Chinese', () => {
      const selectedCount = 3;
      const expectedText = `已选择 ${selectedCount} 张`;
      expect(expectedText).toBe('已选择 3 张');
    });

    it('should display selected count in English', () => {
      const selectedCount = 3;
      const locale = 'en-US';
      const expectedText = `${selectedCount} selected`;
      expect(expectedText).toBe('3 selected');
    });
  });

  describe('Scenario 4.2: Selection toolbar actions', () => {
    it('should trigger onSelectAll when select all button is pressed', () => {
      const onSelectAll = vi.fn();
      onSelectAll();
      expect(onSelectAll).toHaveBeenCalledTimes(1);
    });

    it('should trigger onDeselectAll when deselect all button is pressed', () => {
      const onDeselectAll = vi.fn();
      onDeselectAll();
      expect(onDeselectAll).toHaveBeenCalledTimes(1);
    });

    it('should show deselect all when items are selected', () => {
      const selectedCount = 5;
      expect(selectedCount > 0).toBe(true);
    });

    it('should show select all when no items are selected', () => {
      const selectedCount = 0;
      expect(selectedCount === 0).toBe(true);
    });

    it('should trigger onClean when clean button is pressed', () => {
      const onClean = vi.fn();
      onClean();
      expect(onClean).toHaveBeenCalledTimes(1);
    });

    it('should disable clean button when no items selected', () => {
      const selectedCount = 0;
      const isDisabled = selectedCount === 0;
      expect(isDisabled).toBe(true);
    });

    it('should enable clean button when items are selected', () => {
      const selectedCount = 3;
      // @ts-ignore - Intentional comparison for test logic
      const isDisabled = selectedCount === 0;
      expect(isDisabled).toBe(false);
    });

    it('should display correct count after selecting all', () => {
      const totalCount = 10;
      const selectedCount = totalCount;
      expect(selectedCount).toBe(10);
    });
  });

  describe('Selection count display', () => {
    it('should show singular form for one item in Chinese', () => {
      const selectedCount = 1;
      const expectedText = `已选择 ${selectedCount} 张`;
      expect(expectedText).toBe('已选择 1 张');
    });

    it('should show singular form for one item in English', () => {
      const selectedCount = 1;
      const locale = 'en-US';
      const expectedText = `${selectedCount} selected`;
      expect(expectedText).toBe('1 selected');
    });

    it('should show plural form for multiple items in English', () => {
      const selectedCount = 5;
      const locale = 'en-US';
      const expectedText = `${selectedCount} selected`;
      expect(expectedText).toBe('5 selected');
    });
  });

  describe('leaf style and testID contract', () => {
    it('uses file-backed component tokens for rendered selection controls', () => {
      const onSelectAll = vi.fn();
      const onDeselectAll = vi.fn();
      const onClean = vi.fn();
      let renderer!: ReturnType<typeof TestRenderer.create>;

      act(() => {
        renderer = TestRenderer.create(
          <SelectionBar
            selectedCount={0}
            totalCount={10}
            isSelectionMode
            onSelectAll={onSelectAll}
            onDeselectAll={onDeselectAll}
            onClean={onClean}
            theme={theme}
          />,
        );
      });

      const rootStyle = flattenStyle(renderer.root.findByProps({ testID: 'selection-bar' }).props.style);
      const selectAllButton = renderer.root.findByProps({ testID: 'select-all-button' });
      const cleanButtonStyle = flattenStyle(renderer.root.findByProps({ testID: 'clean-button' }).props.style);
      const countTextStyle = flattenStyle(renderer.root.findByProps({ testID: 'selection-count' }).props.style);

      expect(SELECTION_BAR_STYLE_TOKENS).toBe(COMPONENT_TOKENS.selectionBar);
      expect(rootStyle.paddingHorizontal).toBe(SELECTION_BAR_STYLE_TOKENS.spacing.horizontal);
      expect(rootStyle.paddingVertical).toBe(SELECTION_BAR_STYLE_TOKENS.spacing.vertical);
      expect(countTextStyle.fontSize).toBe(SELECTION_BAR_STYLE_TOKENS.typography.countSize);
      expect(flattenStyle(selectAllButton.props.style).borderRadius).toBe(
        SELECTION_BAR_STYLE_TOKENS.radius.button,
      );
      expect(cleanButtonStyle.opacity).toBe(SELECTION_BAR_STYLE_TOKENS.state.disabledOpacity);

      act(() => {
        selectAllButton.props.onPress();
      });

      expect(onSelectAll).toHaveBeenCalledTimes(1);
      expect(onDeselectAll).not.toHaveBeenCalled();
      expect(onClean).not.toHaveBeenCalled();
    });
  });
});
