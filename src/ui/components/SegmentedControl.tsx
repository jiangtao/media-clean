import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface SegmentedControlProps {
  options: { value: string; label: string }[];
  selectedValue: string;
  onChange: (value: string) => void;
}

export function SegmentedControl({ options, selectedValue, onChange }: SegmentedControlProps) {
  return (
    <View style={styles.container}>
      {options.map((option) => (
        <TouchableOpacity
          key={option.value}
          style={[styles.button, selectedValue === option.value && styles.selectedButton]}
          onPress={() => onChange(option.value)}
        >
          <Text style={[styles.label, selectedValue === option.value && styles.selectedLabel]}>
            {option.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#E9E9EB',
    borderRadius: 8,
    padding: 2,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  button: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 6,
  },
  selectedButton: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    elevation: 2,
  },
  label: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  selectedLabel: {
    color: '#000',
    fontWeight: '600',
  },
});
