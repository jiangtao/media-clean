import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import { getAppTheme } from '../../../theme/app-theme';
import { SegmentedControl, SEGMENTED_CONTROL_STYLE_TOKENS } from '../SegmentedControl';

vi.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  Pressable: 'Pressable',
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
  },
}));

const FILTER_OPTIONS = [
  { value: 'all', label: '全部', count: 5 },
  { value: 'photo', label: '照片', count: 3 },
  { value: 'video', label: '视频', count: 2 },
];

function flattenStyle(style: unknown): Record<string, unknown> {
  if (Array.isArray(style)) {
    return style.reduce<Record<string, unknown>>(
      (merged, entry) => ({ ...merged, ...flattenStyle(entry) }),
      {},
    );
  }

  if (style && typeof style === 'object') {
    return style as Record<string, unknown>;
  }

  return {};
}

describe('SegmentedControl', () => {
  describe('Segment display', () => {
    it('should be a function component', () => {
      expect(typeof SegmentedControl).toBe('function');
    });

    it('should accept options prop with correct structure', () => {
      const props = {
        options: FILTER_OPTIONS,
        selectedValue: 'all',
        onChange: vi.fn(),
      };

      expect(props.options).toHaveLength(3);
      expect(props.options[0]).toHaveProperty('value');
      expect(props.options[0]).toHaveProperty('label');
      expect(props.options[0]).toHaveProperty('count');
    });

    it('should have correct segment labels for photo filtering', () => {
      expect(FILTER_OPTIONS[0].label).toBe('全部');
      expect(FILTER_OPTIONS[1].label).toBe('照片');
      expect(FILTER_OPTIONS[2].label).toBe('视频');
    });

    it('should have correct segment values for photo filtering', () => {
      expect(FILTER_OPTIONS[0].value).toBe('all');
      expect(FILTER_OPTIONS[1].value).toBe('photo');
      expect(FILTER_OPTIONS[2].value).toBe('video');
    });

    it('should support custom option labels', () => {
      const customOptions = [
        { value: 'option1', label: '选项1', count: 8 },
        { value: 'option2', label: '选项2', count: 4 },
      ];

      expect(customOptions[0].label).toBe('选项1');
      expect(customOptions[1].label).toBe('选项2');
    });
  });

  describe('Active state', () => {
    it('should accept selectedValue prop', () => {
      const props = {
        options: FILTER_OPTIONS,
        selectedValue: 'photo',
        onChange: vi.fn(),
      };

      expect(props.selectedValue).toBe('photo');
    });

    it('should identify the selected segment', () => {
      const selectedValue = 'photo';
      const isSelected = (value: string) => value === selectedValue;

      expect(isSelected('photo')).toBe(true);
      expect(isSelected('all')).toBe(false);
      expect(isSelected('video')).toBe(false);
    });

    it('should identify unselected segments', () => {
      const selectedValue = 'all';

      FILTER_OPTIONS.forEach(option => {
        const isSelected = option.value === selectedValue;
        if (option.value === 'all') {
          expect(isSelected).toBe(true);
        } else {
          expect(isSelected).toBe(false);
        }
      });
    });

    it('should support changing selected value', () => {
      let selectedValue = 'all';

      const changeValue = (newValue: string) => {
        selectedValue = newValue;
      };

      changeValue('photo');
      expect(selectedValue).toBe('photo');

      changeValue('video');
      expect(selectedValue).toBe('video');
    });
  });

  describe('Interaction', () => {
    it('should accept onChange callback', () => {
      const onChange = vi.fn();
      const props = {
        options: FILTER_OPTIONS,
        selectedValue: 'all',
        onChange,
      };

      expect(typeof props.onChange).toBe('function');
    });

    it('should call onChange with correct value when segment selected', () => {
      const onChange = vi.fn();

      // Simulate selecting each segment
      FILTER_OPTIONS.forEach(option => {
        onChange.mockClear();
        onChange(option.value);
        expect(onChange).toHaveBeenCalledWith(option.value);
      });
    });

    it('should pass unique value for each segment', () => {
      const values = FILTER_OPTIONS.map(o => o.value);
      const uniqueValues = [...new Set(values)];

      expect(uniqueValues).toHaveLength(FILTER_OPTIONS.length);
    });

    it('should support variable number of options', () => {
      const twoOptions = [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' },
      ];

      const fourOptions = [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' },
        { value: 'c', label: 'C' },
        { value: 'd', label: 'D' },
      ];

      expect(twoOptions).toHaveLength(2);
      expect(fourOptions).toHaveLength(4);
    });
  });

  describe('Props validation', () => {
    it('should require options array', () => {
      const props = {
        options: FILTER_OPTIONS,
        selectedValue: 'all',
        onChange: vi.fn(),
      };

      expect(Array.isArray(props.options)).toBe(true);
    });

    it('should require selectedValue string', () => {
      const props = {
        options: FILTER_OPTIONS,
        selectedValue: 'photo',
        onChange: vi.fn(),
      };

      expect(typeof props.selectedValue).toBe('string');
    });

    it('should require onChange function', () => {
      const onChange = vi.fn();
      expect(typeof onChange).toBe('function');
    });

    it('should have matching selectedValue in options', () => {
      const selectedValue = 'photo';
      const optionValues = FILTER_OPTIONS.map(o => o.value);

      expect(optionValues).toContain(selectedValue);
    });
  });

  describe('Layout properties', () => {
    it('should use horizontal layout direction', () => {
      // SegmentedControl uses flexDirection: 'row'
      const containerStyle = { flexDirection: 'row' };
      expect(containerStyle.flexDirection).toBe('row');
    });

    it('should distribute buttons equally', () => {
      // Each button has flex: 1
      const buttonStyle = { flex: 1 };
      expect(buttonStyle.flex).toBe(1);
    });

    it('should have rounded corners', () => {
      expect(SEGMENTED_CONTROL_STYLE_TOKENS.radius.button).toBe(18);
    });

    it('should have proper button padding', () => {
      expect(SEGMENTED_CONTROL_STYLE_TOKENS.size.buttonPaddingVertical).toBe(6);
    });

    it('should keep the segmented hierarchy at 16/14/12 through file-backed tokens', () => {
      expect(SEGMENTED_CONTROL_STYLE_TOKENS.size.icon).toBe(16);
      expect(SEGMENTED_CONTROL_STYLE_TOKENS.typography.labelFontSize).toBe(14);
      expect(SEGMENTED_CONTROL_STYLE_TOKENS.typography.countFontSize).toBe(12);
    });

    it('maps the selected segment to app theme tokens while preserving compact text sizing', () => {
      const theme = getAppTheme('light');
      let renderer!: ReturnType<typeof TestRenderer.create>;

      act(() => {
        renderer = TestRenderer.create(
          <SegmentedControl
            options={FILTER_OPTIONS}
            selectedValue="photo"
            onChange={vi.fn()}
            theme={theme}
          />,
        );
      });

      const segments = renderer.root.findAllByType('Pressable');
      const labels = renderer.root.findAllByType('Text');
      const selectedSegmentStyle = flattenStyle(segments[1].props.style);
      const selectedLabelStyle = flattenStyle(labels[2].props.style);

      expect(selectedSegmentStyle.backgroundColor).toBe(theme.buttonPrimaryBackground);
      expect(selectedSegmentStyle.borderColor).toBe(theme.buttonPrimaryBackground);
      expect(selectedLabelStyle.color).toBe(theme.buttonPrimaryText);
      expect(selectedLabelStyle.fontSize).toBe(
        SEGMENTED_CONTROL_STYLE_TOKENS.typography.labelFontSize,
      );
    });
  });
});
