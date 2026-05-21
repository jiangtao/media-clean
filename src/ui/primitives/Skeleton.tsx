import { memo, useEffect, useMemo, useRef, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  View,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from 'react-native';

import type { AppThemeScheme } from '../../theme/app-theme';
import { SKELETON_TOKENS } from '../../theme/generated/skeleton-tokens.generated';

export interface SkeletonProps extends Omit<ViewProps, 'accessibilityLabel'> {
  accessibilityLabel: string;
  animated?: boolean;
  children?: ReactNode;
  height?: number;
  reduceMotion?: boolean;
  scheme?: AppThemeScheme;
  style?: StyleProp<ViewStyle>;
  width?: number | `${number}%`;
}

export const Skeleton = memo(function Skeleton({
  accessibilityLabel,
  animated = true,
  children,
  height = SKELETON_TOKENS.layout.defaultHeight,
  reduceMotion = false,
  scheme = 'light',
  style,
  width = '100%',
  ...props
}: SkeletonProps) {
  const shimmerProgress = useRef(new Animated.Value(0)).current;
  const shouldAnimate = animated && !reduceMotion;
  const colors = SKELETON_TOKENS.colors[scheme];

  useEffect(() => {
    if (!shouldAnimate) {
      shimmerProgress.setValue(1);
      return undefined;
    }

    const loop = Animated.loop(
      Animated.timing(shimmerProgress, {
        toValue: 1,
        duration: SKELETON_TOKENS.motion.animationDurationMs,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    );

    shimmerProgress.setValue(0);
    loop.start();
    return () => {
      loop.stop();
    };
  }, [shouldAnimate, shimmerProgress]);

  const shimmerTranslateX =
    typeof shimmerProgress.interpolate === 'function'
      ? shimmerProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [-180, 260],
        })
      : 0;

  const containerStyle = useMemo(
    () => [
      styles.container,
      {
        backgroundColor: colors.base,
        borderRadius: SKELETON_TOKENS.layout.blockRadius,
        height,
        width,
      },
      style,
    ],
    [colors.base, height, style, width],
  );

  const blockStyle = useMemo(
    () => [
      StyleSheet.absoluteFill,
      {
        backgroundColor: colors.base,
        borderRadius: SKELETON_TOKENS.layout.blockRadius,
      },
    ],
    [colors.base],
  );

  const highlightStyle = useMemo(
    () => [
      styles.highlight,
      {
        backgroundColor: colors.highlight,
        opacity: shouldAnimate ? SKELETON_TOKENS.motion.maxOpacity : SKELETON_TOKENS.motion.maxOpacity,
        transform: shouldAnimate
          ? [{ translateX: shimmerTranslateX }, { skewX: '-12deg' }]
          : [{ translateX: 0 }, { skewX: '-12deg' }],
      },
    ],
    [colors.highlight, shouldAnimate, shimmerTranslateX],
  );

  return (
    <View
      {...props}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="progressbar"
      accessibilityState={{ busy: true }}
      accessible
      style={containerStyle}
    >
      <Animated.View
        pointerEvents="none"
        style={blockStyle}
        testID={props.testID ? `${props.testID}-block` : undefined}
      >
        <Animated.View
          pointerEvents="none"
          style={highlightStyle}
          testID={props.testID ? `${props.testID}-highlight` : undefined}
        />
      </Animated.View>
      {children ? <View style={styles.children}>{children}</View> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    borderWidth: 0,
    overflow: 'hidden',
  },
  highlight: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: '52%',
  },
  children: {
    marginTop: SKELETON_TOKENS.layout.blockGap,
  },
});
