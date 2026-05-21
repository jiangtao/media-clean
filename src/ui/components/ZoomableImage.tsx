import React, { memo } from 'react';
import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { MediaFrame } from '../primitives';
import { buildOrientedImageFrameStyle, buildSizedImageSource } from './image-source';
import { MEDIA_VIEWER_STYLE_TOKENS } from './media-viewer-tokens';

interface ZoomableImageProps {
  uri: string;
  width: number;
  height: number;
  maxScale?: number;
  minScale?: number;
  doubleTapReset?: boolean;
  orientation?: number | null;
  onScaleChange?: (scale: number) => void;
  panEnabled?: boolean;
}

const AnimatedImage = Animated.createAnimatedComponent(Image);
const AnimatedMediaFrame = Animated.createAnimatedComponent(MediaFrame);

function ZoomableImageComponent({
  uri,
  width,
  height,
  maxScale = MEDIA_VIEWER_STYLE_TOKENS.zoom.defaultMaxScale,
  minScale = MEDIA_VIEWER_STYLE_TOKENS.zoom.defaultMinScale,
  doubleTapReset = true,
  orientation,
  onScaleChange,
  panEnabled = true,
}: ZoomableImageProps) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      const newScale = savedScale.value * event.scale;
      const minGestureScale = minScale * MEDIA_VIEWER_STYLE_TOKENS.zoom.underScaleFactor;
      const maxGestureScale = maxScale * MEDIA_VIEWER_STYLE_TOKENS.zoom.overScaleFactor;
      scale.value = Math.max(minGestureScale, Math.min(maxGestureScale, newScale));
    })
    .onEnd(() => {
      let resolvedScale = scale.value;

      // Boundary checks and bounce back
      if (resolvedScale < minScale) {
        // Quick bounce back to minScale without animation
        scale.value = minScale;
        resolvedScale = minScale;
        translateX.value = 0;
        translateY.value = 0;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else if (resolvedScale > maxScale) {
        scale.value = withTiming(maxScale, {
          duration: MEDIA_VIEWER_STYLE_TOKENS.zoom.clampDurationMs,
        });
        resolvedScale = maxScale;
      }

      savedScale.value = resolvedScale;
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;

      if (onScaleChange) {
        runOnJS(onScaleChange)(resolvedScale);
      }
    });

  const panGesture = Gesture.Pan()
    .enabled(panEnabled)
    .onUpdate((event) => {
      // Only allow pan when zoomed in
      if (scale.value > minScale) {
        const maxTranslateX = (width * scale.value - width) / 2;
        const maxTranslateY = (height * scale.value - height) / 2;

        let newX = savedTranslateX.value + event.translationX;
        let newY = savedTranslateY.value + event.translationY;

        // Boundary limits
        newX = Math.max(-maxTranslateX, Math.min(maxTranslateX, newX));
        newY = Math.max(-maxTranslateY, Math.min(maxTranslateY, newY));

        translateX.value = newX;
        translateY.value = newY;
      }
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  // Double tap to reset
  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .enabled(doubleTapReset)
    .onEnd(() => {
      if (scale.value > minScale) {
        // Quick reset without animation
        scale.value = minScale;
        translateX.value = 0;
        translateY.value = 0;
        savedScale.value = minScale;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;

        if (onScaleChange) {
          runOnJS(onScaleChange)(minScale);
        }
      }
    });

  // Combine gestures
  const composedGesture = Gesture.Simultaneous(
    Gesture.Simultaneous(pinchGesture, panGesture),
    doubleTapGesture
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));
  const imageFrameStyle = buildOrientedImageFrameStyle(width, height, orientation);

  return (
    <GestureDetector gesture={composedGesture}>
      <AnimatedMediaFrame
        variant="transparent"
        style={[styles.frame, { width, height }, animatedStyle]}
        testID="zoomable-image"
      >
        <AnimatedImage
          source={buildSizedImageSource(uri, imageFrameStyle.width, imageFrameStyle.height)}
          style={imageFrameStyle}
          contentFit="contain"
          cachePolicy="memory-disk"
          priority="high"
          allowDownscaling
          testID="zoomable-image-content"
        />
      </AnimatedMediaFrame>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export const ZoomableImage = memo(ZoomableImageComponent);
