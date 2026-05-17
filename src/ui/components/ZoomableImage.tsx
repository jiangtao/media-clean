import React, { memo } from 'react';
import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { buildSizedImageSource } from './image-source';

interface ZoomableImageProps {
  uri: string;
  width: number;
  height: number;
  maxScale?: number;
  minScale?: number;
  doubleTapReset?: boolean;
  onScaleChange?: (scale: number) => void;
}

const AnimatedImage = Animated.createAnimatedComponent(Image);

function ZoomableImageComponent({
  uri,
  width,
  height,
  maxScale = 3,
  minScale = 1,
  doubleTapReset = true,
  onScaleChange,
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
      // Clamp scale during gesture
      scale.value = Math.max(minScale * 0.5, Math.min(maxScale * 1.1, newScale));
    })
    .onEnd(() => {
      // Boundary checks and bounce back
      if (scale.value < minScale) {
        // Quick bounce back to minScale without animation
        scale.value = minScale;
        translateX.value = 0;
        translateY.value = 0;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else if (scale.value > maxScale) {
        scale.value = withTiming(maxScale, { duration: 150 });
      }

      savedScale.value = scale.value;
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;

      if (onScaleChange) {
        onScaleChange(scale.value);
      }
    });

  const panGesture = Gesture.Pan()
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
          onScaleChange(minScale);
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

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View style={[{ width, height }, animatedStyle]} testID="zoomable-image">
        <AnimatedImage
          source={buildSizedImageSource(uri, width, height)}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          cachePolicy="memory-disk"
          priority="high"
          allowDownscaling
          testID="zoomable-image-content"
        />
      </Animated.View>
    </GestureDetector>
  );
}

export const ZoomableImage = memo(ZoomableImageComponent);
