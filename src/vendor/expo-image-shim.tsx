import React from 'react';
import {
  Image as ReactNativeImage,
  type ImageProps as ReactNativeImageProps,
  type ImageResizeMode,
} from 'react-native';

type ExpoImageContentFit = 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';

type ExpoImageShimProps = Omit<ReactNativeImageProps, 'resizeMode'> & {
  cachePolicy?: 'none' | 'disk' | 'memory' | 'memory-disk';
  contentFit?: ExpoImageContentFit;
  recyclingKey?: string;
  transition?: number;
};

function mapContentFit(contentFit: ExpoImageContentFit | undefined): ImageResizeMode | undefined {
  switch (contentFit) {
    case 'cover':
      return 'cover';
    case 'contain':
    case 'scale-down':
      return 'contain';
    case 'fill':
      return 'stretch';
    case 'none':
      return 'center';
    default:
      return undefined;
  }
}

export function Image({
  cachePolicy: _cachePolicy,
  contentFit,
  recyclingKey: _recyclingKey,
  transition: _transition,
  ...props
}: ExpoImageShimProps) {
  return <ReactNativeImage {...props} resizeMode={mapContentFit(contentFit)} />;
}

export default Image;
