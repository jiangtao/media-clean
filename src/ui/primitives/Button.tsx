import { memo, type ReactNode } from 'react';
import {
  StyleSheet,
  View,
  type PressableProps,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { getAppTheme, type AppThemePalette } from '../../theme/app-theme';
import { PRIMITIVE_TOKENS } from '../../theme/generated/primitive-tokens.generated';
import { TouchSurface } from './TouchSurface';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'danger' | 'chip';

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  children: ReactNode;
  variant?: ButtonVariant;
  theme?: AppThemePalette;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export const Button = memo(function Button({
  children,
  variant = 'primary',
  theme = getAppTheme('light'),
  disabled,
  style,
  contentStyle,
  textStyle,
  ...props
}: ButtonProps) {
  const variantStyle = resolveButtonStyle(theme, variant);

  return (
    <TouchSurface
      {...props}
      disabled={disabled}
      preset="pill"
      style={[styles.button, variantStyle.container, disabled ? styles.disabled : null, style]}
      pressedStyle={variantStyle.pressed}
    >
      <View style={[styles.content, contentStyle]}>
        {typeof children === 'string' || typeof children === 'number' ? (
          <Text
            variant="button"
            tone={variant === 'chip' || variant === 'secondary' || variant === 'tertiary' ? 'accent' : 'onButton'}
            theme={theme}
            style={[variantStyle.text, textStyle]}
          >
            {children}
          </Text>
        ) : (
          children
        )}
      </View>
    </TouchSurface>
  );
});

function resolveButtonStyle(theme: AppThemePalette, variant: ButtonVariant) {
  switch (variant) {
    case 'secondary':
      return {
        container: {
          backgroundColor: theme.buttonSecondaryBackground,
          borderColor: theme.cardBorder,
        },
        text: {
          color: theme.buttonSecondaryText,
        },
        pressed: {
          backgroundColor: theme.cardMutedBackground,
        },
      };
    case 'tertiary':
      return {
        container: {
          backgroundColor: theme.buttonTertiaryBackground,
          borderColor: theme.cardMutedBorder,
        },
        text: {
          color: theme.buttonTertiaryText,
        },
        pressed: {
          backgroundColor: theme.chipActiveBackground,
        },
      };
    case 'danger':
      return {
        container: {
          backgroundColor: theme.buttonDangerBackground,
          borderColor: theme.buttonDangerBackground,
        },
        text: {
          color: theme.buttonDangerText,
        },
        pressed: {
          backgroundColor: theme.buttonDangerPressedBackground,
        },
      };
    case 'chip':
      return {
        container: {
          backgroundColor: theme.chipActiveBackground,
          borderColor: theme.chipBorder,
        },
        text: {
          color: theme.chipActiveText,
        },
        pressed: {
          backgroundColor: theme.chipBackground,
        },
      };
    case 'primary':
    default:
      return {
        container: {
          backgroundColor: theme.buttonPrimaryBackground,
          borderColor: theme.buttonPrimaryBackground,
        },
        text: {
          color: theme.buttonPrimaryText,
        },
        pressed: {
          backgroundColor: theme.buttonSuccessPressedBackground,
        },
      };
  }
}

const styles = StyleSheet.create({
  button: {
    minHeight: 40,
    borderRadius: PRIMITIVE_TOKENS.radius.button,
    borderWidth: 1,
    paddingHorizontal: PRIMITIVE_TOKENS.spacing.buttonPaddingHorizontal,
    paddingVertical: PRIMITIVE_TOKENS.spacing.buttonPaddingVertical,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    minHeight: PRIMITIVE_TOKENS.typography.button.lineHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.48,
  },
});
