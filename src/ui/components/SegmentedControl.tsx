import React from 'react';
import { View, StyleSheet } from 'react-native';
import type { AppThemePalette } from '../../theme/app-theme';
import { COMPONENT_TOKENS } from '../../theme/generated/component-tokens.generated';
import { AppIcon, type AppIconName } from '../icons/AppIcon';
import { Text, TouchSurface } from '../primitives';

export const SEGMENTED_CONTROL_STYLE_TOKENS = COMPONENT_TOKENS.segmentedControl;

export interface SegmentedControlOption {
  value: string;
  label: string;
  icon?: AppIconName;
  count?: number;
}

interface SegmentedControlProps {
  options: readonly SegmentedControlOption[];
  selectedValue: string;
  onChange: (value: string) => void;
  theme: AppThemePalette;
}

export function SegmentedControl({ options, selectedValue, onChange, theme }: SegmentedControlProps) {
  return (
    <View style={styles.container}>
      {options.map((option) => {
        const selected = selectedValue === option.value;
        const selectedColor = theme.buttonPrimaryText;

        return (
          <TouchSurface
            key={option.value}
            style={[
              styles.button,
              { backgroundColor: theme.cardMutedBackground, borderColor: theme.cardBorder },
              selected && {
                backgroundColor: theme.buttonPrimaryBackground,
                borderColor: theme.buttonPrimaryBackground,
              },
            ]}
            onPress={() => onChange(option.value)}
            preset="tab"
          >
            <View style={styles.buttonContent}>
              {option.icon ? (
                <AppIcon
                  name={option.icon}
                  size={SEGMENTED_CONTROL_STYLE_TOKENS.size.icon}
                  color={selected ? selectedColor : theme.pageTextSecondary}
                  testID={`segmented-icon-${option.value}`}
                />
              ) : null}
              <View style={styles.textGroup}>
                <Text
                  variant="body"
                  theme={theme}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  style={[
                    styles.label,
                    { color: theme.pageTextSecondary },
                    selected && styles.selectedLabel,
                    selected && { color: selectedColor },
                  ]}
                >
                  {option.label}
                </Text>
                {typeof option.count === 'number' ? (
                  <Text
                    variant="label"
                    theme={theme}
                    style={[
                      styles.count,
                      { color: theme.pageTextMuted },
                      selected && { color: SEGMENTED_CONTROL_STYLE_TOKENS.color.selectedCountText },
                    ]}
                    testID={`segmented-count-${option.value}`}
                  >
                    {option.count}
                  </Text>
                ) : null}
              </View>
            </View>
          </TouchSurface>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: SEGMENTED_CONTROL_STYLE_TOKENS.gap.container,
  },
  button: {
    flex: 1,
    minHeight: SEGMENTED_CONTROL_STYLE_TOKENS.size.buttonMinHeight,
    paddingHorizontal: SEGMENTED_CONTROL_STYLE_TOKENS.size.buttonPaddingHorizontal,
    paddingVertical: SEGMENTED_CONTROL_STYLE_TOKENS.size.buttonPaddingVertical,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: SEGMENTED_CONTROL_STYLE_TOKENS.radius.button,
    borderWidth: SEGMENTED_CONTROL_STYLE_TOKENS.size.buttonBorderWidth,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SEGMENTED_CONTROL_STYLE_TOKENS.gap.buttonContent,
  },
  textGroup: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: SEGMENTED_CONTROL_STYLE_TOKENS.gap.textGroup,
  },
  label: {
    fontSize: SEGMENTED_CONTROL_STYLE_TOKENS.typography.labelFontSize,
    fontWeight: SEGMENTED_CONTROL_STYLE_TOKENS.typography.labelFontWeight,
    textAlign: 'center',
  },
  selectedLabel: {
    fontWeight: SEGMENTED_CONTROL_STYLE_TOKENS.typography.selectedLabelFontWeight,
  },
  count: {
    fontSize: SEGMENTED_CONTROL_STYLE_TOKENS.typography.countFontSize,
    fontWeight: SEGMENTED_CONTROL_STYLE_TOKENS.typography.countFontWeight,
    textAlign: 'center',
  },
});
