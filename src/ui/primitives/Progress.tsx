import { memo, useMemo } from 'react';
import { StyleSheet, View, type ViewProps, type StyleProp, type ViewStyle } from 'react-native';

import { getAppTheme, type AppThemePalette } from '../../theme/app-theme';
import { PRIMITIVE_TOKENS } from '../../theme/generated/primitive-tokens.generated';

export interface ProgressProps extends ViewProps {
  indicatorStyle?: StyleProp<ViewStyle>;
  indicatorTestID?: string;
  max?: number;
  theme?: AppThemePalette;
  trackStyle?: StyleProp<ViewStyle>;
  value?: number | null;
}

export const Progress = memo(function Progress({
  children,
  indicatorStyle,
  indicatorTestID,
  max = 100,
  theme = getAppTheme('light'),
  trackStyle,
  value = 0,
  ...props
}: ProgressProps) {
  const normalizedValue = Math.max(0, Math.min(value ?? 0, max));
  const percentage = max > 0 ? (normalizedValue / max) * 100 : 0;
  const indicatorWidth = `${Math.max(percentage, normalizedValue > 0 ? 1 : 0)}%` as `${number}%`;
  const accessibilityValue = useMemo(
    () => ({
      min: 0,
      max,
      now: normalizedValue,
    }),
    [max, normalizedValue],
  );

  return (
    <View
      {...props}
      accessibilityRole="progressbar"
      accessibilityValue={accessibilityValue}
      style={[
        styles.track,
        {
          backgroundColor: theme.cardMutedBackground,
          borderColor: theme.cardMutedBorder,
        },
        trackStyle,
      ]}
    >
      <View
        pointerEvents="none"
        style={[
          styles.indicator,
          {
            backgroundColor: theme.buttonPrimaryBackground,
            width: indicatorWidth,
          },
          indicatorStyle,
        ]}
        testID={indicatorTestID ?? (props.testID ? `${props.testID}-indicator` : undefined)}
      />
      {children}
    </View>
  );
});

const styles = StyleSheet.create({
  track: {
    borderRadius: PRIMITIVE_TOKENS.radius.button,
    borderWidth: PRIMITIVE_TOKENS.spacing.progressBorderWidth,
    height: PRIMITIVE_TOKENS.spacing.progressHeight,
    overflow: 'hidden',
    width: '100%',
  },
  indicator: {
    borderRadius: PRIMITIVE_TOKENS.radius.button,
    height: '100%',
  },
});
