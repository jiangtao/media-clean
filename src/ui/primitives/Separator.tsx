import { memo } from 'react';
import { StyleSheet, View, type ViewProps, type StyleProp, type ViewStyle } from 'react-native';

import { getAppTheme, type AppThemePalette } from '../../theme/app-theme';
import { PRIMITIVE_TOKENS } from '../../theme/generated/primitive-tokens.generated';

export interface SeparatorProps extends ViewProps {
  orientation?: 'horizontal' | 'vertical';
  theme?: AppThemePalette;
  style?: StyleProp<ViewStyle>;
}

export const Separator = memo(function Separator({
  orientation = 'horizontal',
  theme = getAppTheme('light'),
  style,
  ...props
}: SeparatorProps) {
  return (
    <View
      {...props}
      accessibilityRole="none"
      style={[
        orientation === 'vertical' ? styles.vertical : styles.horizontal,
        { backgroundColor: theme.cardBorder },
        style,
      ]}
    />
  );
});

const styles = StyleSheet.create({
  horizontal: {
    height: PRIMITIVE_TOKENS.spacing.separatorThickness,
    borderRadius: PRIMITIVE_TOKENS.radius.separator,
    width: '100%',
  },
  vertical: {
    width: PRIMITIVE_TOKENS.spacing.separatorThickness,
    borderRadius: PRIMITIVE_TOKENS.radius.separator,
    alignSelf: 'stretch',
  },
});
