import { PixelRatio } from 'react-native';

import {
  isSidewaysMediaOrientation,
  resolveMediaRotationDegrees,
  type MediaOrientation,
} from '../../domain/recognition/media-orientation';

const IMAGE_SCALE = PixelRatio.get();

export function buildSizedImageSource(uri: string, width: number, height: number) {
  return {
    uri,
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height)),
    scale: IMAGE_SCALE,
  };
}

export function buildOrientedImageFrameStyle(
  width: number,
  height: number,
  orientation: MediaOrientation,
) {
  const rotation = resolveMediaRotationDegrees(orientation);
  const sideways = isSidewaysMediaOrientation(orientation);

  return {
    width: sideways ? height : width,
    height: sideways ? width : height,
    ...(rotation
      ? {
          transform: [{ rotate: `${rotation}deg` }],
        }
      : {}),
  };
}
