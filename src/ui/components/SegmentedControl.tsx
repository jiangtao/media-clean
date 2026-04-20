import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { AppThemePalette } from '../../theme/app-theme';
import { TouchSurface } from './TouchSurface';

const SIZE_LARGE = 16;
const SIZE_DEFAULT = 14;
const SIZE_SMALL = 12;

export interface SegmentedControlOption {
  value: string;
  label: string;
  icon?: string;
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
      {options.map((option) => (
        <TouchSurface
          key={option.value}
          style={[
            styles.button,
            { backgroundColor: theme.cardMutedBackground, borderColor: theme.cardBorder },
            selectedValue === option.value && styles.selectedButton,
          ]}
          onPress={() => onChange(option.value)}
          preset="tab"
        >
          <View style={styles.buttonContent}>
            {option.icon ? (
              <Ionicons
                name={option.icon as React.ComponentProps<typeof Ionicons>['name']}
                size={SIZE_LARGE}
                color={selectedValue === option.value ? '#ffffff' : theme.pageTextSecondary}
                testID={`segmented-icon-${option.value}`}
              />
            ) : null}
            <View style={styles.textGroup}>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                style={[
                  styles.label,
                  { color: theme.pageTextSecondary },
                  selectedValue === option.value && styles.selectedLabel,
                  selectedValue === option.value && { color: '#ffffff' },
                ]}
              >
                {option.label}
              </Text>
              {typeof option.count === 'number' ? (
                <Text
                  style={[
                    styles.count,
                    { color: theme.pageTextMuted },
                    selectedValue === option.value && { color: 'rgba(255,255,255,0.88)' },
                  ]}
                  testID={`segmented-count-${option.value}`}
                >
                  {option.count}
                </Text>
              ) : null}
            </View>
          </View>
        </TouchSurface>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 6,
  },
  button: {
    flex: 1,
    minHeight: 38,
    paddingHorizontal: 8,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    borderWidth: 1,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  textGroup: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  selectedButton: {
    backgroundColor: '#2f80ff',
    borderColor: '#2f80ff',
  },
  label: {
    fontSize: SIZE_DEFAULT,
    fontWeight: '700',
    textAlign: 'center',
  },
  selectedLabel: {
    fontWeight: '800',
  },
  count: {
    fontSize: SIZE_SMALL,
    fontWeight: '700',
    textAlign: 'center',
  },
});
