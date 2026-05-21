import { memo, type ReactNode } from 'react';
import {
  StyleSheet,
  View,
  type StyleProp,
  type TextStyle,
  type ViewProps,
  type ViewStyle,
} from 'react-native';

import { getAppTheme, type AppThemePalette } from '../../theme/app-theme';
import { PRIMITIVE_TOKENS } from '../../theme/generated/primitive-tokens.generated';
import { Text } from './Text';

export type BadgeVariant = 'default' | 'secondary' | 'danger' | 'outline' | 'success';

export interface BadgeProps extends ViewProps {
  children?: ReactNode;
  variant?: BadgeVariant;
  theme?: AppThemePalette;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export const Badge = memo(function Badge({
  children,
  variant = 'default',
  theme = getAppTheme('light'),
  style,
  textStyle,
  ...props
}: BadgeProps) {
  const variantStyle = resolveBadgeStyle(theme, variant);

  return (
    <View
      {...props}
      style={[styles.badge, variantStyle.container, style]}
    >
      {typeof children === 'string' || typeof children === 'number' ? (
        <Text
          variant="label"
          theme={theme}
          style={[variantStyle.text, textStyle]}
        >
          {children}
        </Text>
      ) : (
        children
      )}
    </View>
  );
});

function resolveBadgeStyle(theme: AppThemePalette, variant: BadgeVariant) {
  switch (variant) {
    case 'secondary':
      return {
        container: {
          backgroundColor: theme.chipBackground,
          borderColor: theme.chipBorder,
        },
        text: {
          color: theme.chipText,
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
      };
    case 'outline':
      return {
        container: {
          backgroundColor: 'transparent',
          borderColor: theme.cardBorder,
        },
        text: {
          color: theme.pageTextPrimary,
        },
      };
    case 'success':
      return {
        container: {
          backgroundColor: theme.buttonSuccessBackground,
          borderColor: theme.buttonSuccessBackground,
        },
        text: {
          color: theme.buttonPrimaryText,
        },
      };
    case 'default':
    default:
      return {
        container: {
          backgroundColor: theme.buttonPrimaryBackground,
          borderColor: theme.buttonPrimaryBackground,
        },
        text: {
          color: theme.buttonPrimaryText,
        },
      };
  }
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: PRIMITIVE_TOKENS.radius.button,
    borderWidth: PRIMITIVE_TOKENS.spacing.badgeBorderWidth,
    flexDirection: 'row',
    justifyContent: 'center',
    minHeight: PRIMITIVE_TOKENS.spacing.badgeMinHeight,
    paddingHorizontal: PRIMITIVE_TOKENS.spacing.badgePaddingHorizontal,
    paddingVertical: PRIMITIVE_TOKENS.spacing.badgePaddingVertical,
  },
});
