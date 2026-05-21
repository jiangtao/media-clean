import { memo } from 'react';

import { Skeleton, type SkeletonProps } from '../primitives';

export type SkeletonBlockProps = SkeletonProps;

export const SkeletonBlock = memo(function SkeletonBlock(props: SkeletonBlockProps) {
  return <Skeleton {...props} />;
});
