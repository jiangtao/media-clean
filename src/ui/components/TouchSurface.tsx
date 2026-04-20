import { memo, useMemo, useState, type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

type TouchSurfacePreset = 'tile' | 'pill' | 'icon' | 'tab';

interface TouchSurfaceProps extends Omit<PressableProps, 'children' | 'style'> {
  children?: ReactNode | ((state: { pressed: boolean }) => ReactNode);
  style?: StyleProp<ViewStyle>;
  pressedStyle?: StyleProp<ViewStyle>;
  preset?: TouchSurfacePreset;
}

const PRESS_RETENTION_OFFSET = {
  top: 12,
  bottom: 12,
  left: 12,
  right: 12,
} as const;

export const TouchSurface = memo(function TouchSurface({
  children,
  style,
  pressedStyle,
  preset = 'pill',
  hitSlop,
  onPressIn,
  onPressOut,
  pressRetentionOffset,
  ...props
}: TouchSurfaceProps) {
  const [pressed, setPressed] = useState(false);
  const styles = useMemo(() => createStyles(preset), [preset]);

  const handlePressIn = (event: GestureResponderEvent) => {
    setPressed(true);
    onPressIn?.(event);
  };

  const handlePressOut = (event: GestureResponderEvent) => {
    setPressed(false);
    onPressOut?.(event);
  };

  return (
    <Pressable
      {...props}
      hitSlop={hitSlop ?? (preset === 'icon' ? 8 : undefined)}
      pressRetentionOffset={pressRetentionOffset ?? PRESS_RETENTION_OFFSET}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[style, pressed ? styles.pressed : null, pressed ? pressedStyle : null]}
    >
      {typeof children === 'function' ? children({ pressed }) : children}
    </Pressable>
  );
});

function createStyles(preset: TouchSurfacePreset) {
  const pressedStyle =
    preset === 'icon'
      ? {
          transform: [{ scale: 0.92 }],
          opacity: 0.88,
        }
      : preset === 'tile'
        ? {
            transform: [{ scale: 0.986 }],
            opacity: 0.96,
          }
        : preset === 'tab'
          ? {
              transform: [{ scale: 0.972 }],
              opacity: 0.94,
            }
          : {
              transform: [{ scale: 0.976 }],
              opacity: 0.95,
            };

  return StyleSheet.create({
    pressed: pressedStyle,
  });
}
