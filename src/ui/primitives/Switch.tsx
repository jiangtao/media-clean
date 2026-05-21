import { memo } from 'react';
import { StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { getAppTheme, type AppThemePalette } from '../../theme/app-theme';
import { PRIMITIVE_TOKENS } from '../../theme/generated/primitive-tokens.generated';
import { TouchSurface } from './TouchSurface';

export type SwitchTone = 'primary' | 'success' | 'danger';

export interface SwitchProps extends Omit<PressableProps, 'style'> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  tone?: SwitchTone;
  theme?: AppThemePalette;
  style?: StyleProp<ViewStyle>;
  thumbStyle?: StyleProp<ViewStyle>;
}

export const Switch = memo(function Switch({
  checked = false,
  onCheckedChange,
  tone = 'primary',
  theme = getAppTheme('light'),
  disabled,
  style,
  thumbStyle,
  onPress,
  ...props
}: SwitchProps) {
  const trackColor = checked ? resolveCheckedTrackColor(theme, tone) : theme.chipBackground;
  const borderColor = checked ? trackColor : theme.chipBorder;
  const thumbColor = checked ? theme.buttonPrimaryText : theme.chipText;
  const isDisabled = disabled ?? undefined;
  const translateX =
    PRIMITIVE_TOKENS.spacing.switchWidth -
    PRIMITIVE_TOKENS.spacing.switchThumbSize -
    PRIMITIVE_TOKENS.spacing.switchThumbInset * 2;

  return (
    <TouchSurface
      {...props}
      accessibilityRole="switch"
      accessibilityState={{ checked, disabled: isDisabled }}
      disabled={isDisabled}
      onPress={(event) => {
        onCheckedChange?.(!checked);
        onPress?.(event);
      }}
      preset="pill"
      style={[
        styles.track,
        { backgroundColor: trackColor, borderColor },
        disabled ? styles.disabled : null,
        style,
      ]}
    >
      <View
        testID={props.testID ? `${props.testID}-thumb` : undefined}
        style={[
          styles.thumb,
          { backgroundColor: thumbColor },
          checked ? { transform: [{ translateX }] } : null,
          thumbStyle,
        ]}
      />
    </TouchSurface>
  );
});

function resolveCheckedTrackColor(theme: AppThemePalette, tone: SwitchTone) {
  switch (tone) {
    case 'success':
      return theme.buttonSuccessBackground;
    case 'danger':
      return theme.buttonDangerBackground;
    case 'primary':
    default:
      return theme.buttonPrimaryBackground;
  }
}

const styles = StyleSheet.create({
  track: {
    width: PRIMITIVE_TOKENS.spacing.switchWidth,
    height: PRIMITIVE_TOKENS.spacing.switchHeight,
    borderRadius: PRIMITIVE_TOKENS.radius.switchTrack,
    borderWidth: 1,
    padding: PRIMITIVE_TOKENS.spacing.switchThumbInset,
    justifyContent: 'center',
  },
  thumb: {
    width: PRIMITIVE_TOKENS.spacing.switchThumbSize,
    height: PRIMITIVE_TOKENS.spacing.switchThumbSize,
    borderRadius: PRIMITIVE_TOKENS.radius.switchThumb,
  },
  disabled: {
    opacity: 0.48,
  },
});
