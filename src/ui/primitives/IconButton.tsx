import { memo, type ReactNode } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { getAppTheme, type AppThemePalette } from '../../theme/app-theme';
import { PRIMITIVE_TOKENS } from '../../theme/generated/primitive-tokens.generated';
import { TouchSurface, type TouchSurfaceProps } from './TouchSurface';

export type IconButtonVariant = 'ghost' | 'muted' | 'overlay';

export interface IconButtonProps
  extends Omit<TouchSurfaceProps, 'children' | 'preset' | 'style' | 'pressedStyle'> {
  children?: ReactNode;
  size?: number;
  theme?: AppThemePalette;
  variant?: IconButtonVariant;
  style?: StyleProp<ViewStyle>;
  pressedStyle?: StyleProp<ViewStyle>;
}

export const IconButton = memo(function IconButton({
  accessibilityRole = 'button',
  children,
  size = PRIMITIVE_TOKENS.spacing.iconButtonSize,
  theme = getAppTheme('light'),
  variant = 'ghost',
  style,
  pressedStyle,
  ...props
}: IconButtonProps) {
  const variantStyle = resolveIconButtonStyle(theme, variant);

  return (
    <TouchSurface
      {...props}
      accessibilityRole={accessibilityRole}
      preset="icon"
      style={[
        styles.button,
        {
          width: size,
          height: size,
          borderRadius: PRIMITIVE_TOKENS.radius.iconButton,
        },
        variantStyle.container,
        style,
      ]}
      pressedStyle={[variantStyle.pressed, pressedStyle]}
    >
      {children}
    </TouchSurface>
  );
});

function resolveIconButtonStyle(theme: AppThemePalette, variant: IconButtonVariant) {
  switch (variant) {
    case 'muted':
      return {
        container: {
          backgroundColor: theme.cardMutedBackground,
          borderColor: theme.cardMutedBorder,
          borderWidth: 1,
        },
        pressed: {
          backgroundColor: theme.chipActiveBackground,
        },
      };
    case 'overlay':
      return {
        container: {
          backgroundColor: PRIMITIVE_TOKENS.color.iconButtonOverlayBackground,
        },
        pressed: {
          backgroundColor: PRIMITIVE_TOKENS.color.iconButtonOverlayPressedBackground,
        },
      };
    case 'ghost':
    default:
      return {
        container: {
          backgroundColor: 'transparent',
        },
        pressed: {
          backgroundColor: theme.cardMutedBackground,
        },
      };
  }
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
