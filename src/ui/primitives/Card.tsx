import { memo, type ReactNode } from 'react';
import { StyleSheet, View, type ViewProps, type StyleProp, type ViewStyle } from 'react-native';

import { getAppTheme, type AppThemePalette } from '../../theme/app-theme';
import { PRIMITIVE_TOKENS } from '../../theme/generated/primitive-tokens.generated';

export type CardVariant = 'default' | 'muted';

export interface CardProps extends ViewProps {
  children?: ReactNode;
  variant?: CardVariant;
  theme?: AppThemePalette;
  style?: StyleProp<ViewStyle>;
}

export const Card = memo(function Card({
  children,
  variant = 'default',
  theme = getAppTheme('light'),
  style,
  ...props
}: CardProps) {
  return (
    <View
      {...props}
      style={[
        styles.card,
        {
          backgroundColor: variant === 'muted' ? theme.cardMutedBackground : theme.cardBackground,
          borderColor: variant === 'muted' ? theme.cardMutedBorder : theme.cardBorder,
          shadowColor: theme.shadowColor,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: PRIMITIVE_TOKENS.radius.card,
    borderWidth: 1,
    padding: PRIMITIVE_TOKENS.spacing.cardPadding,
  },
});
