import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';

import { getAppCopy } from '../../i18n/app-copy';
import type { AppThemePalette } from '../../theme/app-theme';
import { COMPONENT_TOKENS } from '../../theme/generated/component-tokens.generated';
import { Text } from '../primitives';

export const SCAN_COUNTER_STYLE_TOKENS = COMPONENT_TOKENS.scanCounter;

interface ScanCounterProps {
  current: number;
  total: number;
  theme: AppThemePalette;
  animated?: boolean;
  duration?: number;
  locale?: 'zh-CN' | 'en-US';
}

interface ScanCounterState {
  current: number;
  total: number;
  displayValue: number;
  isAnimating: boolean;
}

export function useScanCounter(total: number, animationDuration = 300) {
  const [state, setState] = useState<ScanCounterState>({
    current: 0,
    total,
    displayValue: 0,
    isAnimating: false,
  });

  const animationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const clearAnimation = useCallback(() => {
    if (animationIntervalRef.current) {
      clearInterval(animationIntervalRef.current);
      animationIntervalRef.current = null;
    }
    setState((prev) => ({ ...prev, isAnimating: false }));
  }, []);

  const setValue = useCallback(
    async (value: number, animated = true): Promise<void> => {
      setState((prev) => ({ ...prev, current: value }));

      if (!animated) {
        setState((prev) => ({ ...prev, displayValue: value, isAnimating: false }));
        return Promise.resolve();
      }

      clearAnimation();
      setState((prev) => ({ ...prev, isAnimating: true }));

      return new Promise((resolve) => {
        const steps = 10;
        const stepDuration = animationDuration / steps;
        const startValue = state.displayValue;
        const valueDiff = value - startValue;
        const stepValue = valueDiff / steps;

        let step = 0;
        animationIntervalRef.current = setInterval(() => {
          step++;

          if (step >= steps) {
            setState((prev) => ({
              ...prev,
              displayValue: value,
              isAnimating: false,
            }));
            if (animationIntervalRef.current) {
              clearInterval(animationIntervalRef.current);
              animationIntervalRef.current = null;
            }
            resolve();
          } else {
            setState((prev) => ({
              ...prev,
              displayValue: startValue + stepValue * step,
            }));
          }
        }, stepDuration);
      });
    },
    [animationDuration, state.displayValue, clearAnimation]
  );

  const increment = useCallback(
    async (amount = 1, animated = true): Promise<void> => {
      const newValue = Math.min(state.current + amount, state.total);
      return setValue(newValue, animated);
    },
    [state.current, state.total, setValue]
  );

  const reset = useCallback(() => {
    clearAnimation();
    setState({
      current: 0,
      total,
      displayValue: 0,
      isAnimating: false,
    });
  }, [total, clearAnimation]);

  const cleanup = useCallback(() => {
    clearAnimation();
  }, [clearAnimation]);

  const getDisplayValue = useCallback(() => Math.round(state.displayValue), [state.displayValue]);
  const getCounterText = useCallback(() => `${Math.round(state.displayValue)}/${state.total}`, [state.displayValue, state.total]);
  const getPercentage = useCallback(
    () => (state.total > 0 ? Math.round((state.displayValue / state.total) * 100) : 0),
    [state.displayValue, state.total]
  );

  return {
    state,
    setValue,
    increment,
    reset,
    cleanup,
    getDisplayValue,
    getCounterText,
    getPercentage,
  };
}

export function ScanCounter({
  current,
  total,
  theme,
  animated = true,
  duration = 300,
  locale = 'zh-CN',
}: ScanCounterProps) {
  const counter = useScanCounter(total, duration);

  useEffect(() => {
    counter.setValue(current, animated);
  }, [current, animated, counter.setValue]);

  useEffect(() => {
    return () => counter.cleanup();
  }, [counter.cleanup]);

  const styles = createStyles(theme);
  const copy = getAppCopy(locale).components.scanCounter;

  const isComplete = current >= total;
  const statusText = isComplete
    ? copy.complete
    : copy.scanning(counter.getCounterText());

  return (
    <View style={styles.container} testID="scan-counter">
      <Text
        variant="body"
        theme={theme}
        style={styles.statusText}
      >
        {statusText}
      </Text>
    </View>
  );
}

function createStyles(theme: AppThemePalette) {
  return StyleSheet.create({
    container: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    statusText: {
      fontSize: SCAN_COUNTER_STYLE_TOKENS.typography.statusSize,
      fontWeight: SCAN_COUNTER_STYLE_TOKENS.typography.statusWeight,
      color: theme.pageTextPrimary,
    },
  });
}
