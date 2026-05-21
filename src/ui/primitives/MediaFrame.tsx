import { forwardRef, type ElementRef, type ReactNode } from 'react';
import {
  StyleSheet,
  View,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from 'react-native';

import { getAppTheme, type AppThemePalette } from '../../theme/app-theme';
import { PRIMITIVE_TOKENS } from '../../theme/generated/primitive-tokens.generated';

export type MediaFrameVariant = 'preview' | 'transparent';

export interface MediaFrameProps extends ViewProps {
  children?: ReactNode;
  theme?: AppThemePalette;
  variant?: MediaFrameVariant;
  style?: StyleProp<ViewStyle>;
}

export const MediaFrame = forwardRef<ElementRef<typeof View>, MediaFrameProps>(
  function MediaFrame(
    {
      children,
      theme = getAppTheme('light'),
      variant = 'preview',
      style,
      ...props
    },
    ref,
  ) {
    return (
      <View
        ref={ref}
        {...props}
        style={[
          styles.frame,
          variant === 'transparent'
            ? styles.transparent
            : { backgroundColor: theme.previewBackground },
          style,
        ]}
      >
        {children}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  frame: {
    padding: 0,
    borderWidth: 0,
    borderRadius: PRIMITIVE_TOKENS.radius.media,
    overflow: 'hidden',
  },
  transparent: {
    backgroundColor: 'transparent',
    borderRadius: 0,
    overflow: 'visible',
  },
});
