import { PixelRatio } from 'react-native';

const IMAGE_SCALE = PixelRatio.get();

export function buildSizedImageSource(uri: string, width: number, height: number) {
  return {
    uri,
    width: Math.max(1, Math.round(width)),
    height: Math.max(1, Math.round(height)),
    scale: IMAGE_SCALE,
  };
}
