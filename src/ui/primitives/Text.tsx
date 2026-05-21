import { memo } from 'react';
import {
  Text as RNText,
  StyleSheet,
  type TextProps as RNTextProps,
  type StyleProp,
  type TextStyle,
} from 'react-native';

import { getAppTheme, type AppThemePalette } from '../../theme/app-theme';
import { PRIMITIVE_TOKENS } from '../../theme/generated/primitive-tokens.generated';

export type PrimitiveTextVariant = 'title' | 'body' | 'caption' | 'label' | 'button';
export type PrimitiveTextTone =
  | 'primary'
  | 'secondary'
  | 'muted'
  | 'accent'
  | 'danger'
  | 'success'
  | 'chip'
  | 'onButton';

export interface TextProps extends RNTextProps {
  variant?: PrimitiveTextVariant;
  tone?: PrimitiveTextTone;
  theme?: AppThemePalette;
  style?: StyleProp<TextStyle>;
}

export const Text = memo(function Text({
  variant = 'body',
  tone = 'primary',
  theme = getAppTheme('light'),
  style,
  ...props
}: TextProps) {
  return (
    <RNText
      {...props}
      style={[styles.base, PRIMITIVE_TOKENS.typography[variant], { color: resolveTone(theme, tone) }, style]}
    />
  );
});

function resolveTone(theme: AppThemePalette, tone: PrimitiveTextTone) {
  switch (tone) {
    case 'secondary':
      return theme.pageTextSecondary;
    case 'muted':
      return theme.pageTextMuted;
    case 'accent':
      return theme.buttonPrimaryBackground;
    case 'danger':
      return theme.buttonDangerBackground;
    case 'success':
      return theme.buttonSuccessBackground;
    case 'chip':
      return theme.chipText;
    case 'onButton':
      return theme.buttonPrimaryText;
    case 'primary':
    default:
      return theme.pageTextPrimary;
  }
}

const styles = StyleSheet.create({
  base: {
    letterSpacing: 0,
  },
});
