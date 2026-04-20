/**
 * useScreenType hook
 * Returns current screen type based on SafeAreaInsets
 */

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWindowDimensions } from 'react-native';
import { useMemo } from 'react';

import {
  type EdgeInsets,
  type ScreenDimensions,
  type ScreenType,
  type ScreenInfo,
} from '../../services/device/screen-info';
import {
  detectScreenType,
  getScreenCharacteristics,
  isLandscape,
} from './notch-detector';

/**
 * Hook that returns the current screen type based on safe area insets
 * Automatically updates when orientation changes
 *
 * @example
 * const { type, isTablet, hasNotch } = useScreenType();
 *
 * return (
 *   <View style={[
 *     styles.container,
 *     hasNotch && styles.notchPadding
 *   ]}>
 *     {isTablet ? <TabletLayout /> : <MobileLayout />}
 *   </View>
 * );
 */
export function useScreenType(): ScreenInfo & {
  hasNotch: boolean;
  hasHolePunch: boolean;
  hasCutout: boolean;
  isCurved: boolean;
  isFoldable: boolean;
  cutoutHeight: number;
} {
  const insets = useSafeAreaInsets();
  const dimensions = useWindowDimensions();

  const screenInfo = useMemo(() => {
    const screenDimensions: ScreenDimensions = {
      width: dimensions.width,
      height: dimensions.height,
      scale: dimensions.scale,
      fontScale: dimensions.fontScale,
    };

    const edgeInsets: EdgeInsets = {
      top: insets.top,
      left: insets.left,
      right: insets.right,
      bottom: insets.bottom,
    };

    const type = detectScreenType(edgeInsets, screenDimensions);
    const characteristics = getScreenCharacteristics(edgeInsets, screenDimensions);
    const landscape = isLandscape(screenDimensions);

    return {
      type,
      insets: edgeInsets,
      dimensions: screenDimensions,
      isLandscape: landscape,
      isTablet: characteristics.isTablet,
      isFoldable: characteristics.isFoldable,
      hasNotch: characteristics.hasNotch,
      hasHolePunch: characteristics.hasHolePunch,
      hasCutout: characteristics.hasCutout,
      isCurved: characteristics.isCurved,
      cutoutHeight: characteristics.cutoutHeight,
    };
  }, [insets, dimensions]);

  return screenInfo;
}

/**
 * Hook that returns only the screen type string
 * Use this for simple type-based branching
 *
 * @example
 * const screenType = useScreenTypeOnly();
 * if (screenType === 'tablet') return <TabletView />;
 */
export function useScreenTypeOnly(): ScreenType {
  const { type } = useScreenType();
  return type;
}

/**
 * Hook that returns whether the current device needs
 * special handling for cutout/notch areas
 *
 * @example
 * const { hasCutout, cutoutHeight } = useCutoutInfo();
 * return <Header extraPaddingTop={hasCutout ? cutoutHeight : 0} />;
 */
export function useCutoutInfo() {
  const { hasCutout, cutoutHeight, hasNotch, hasHolePunch } = useScreenType();
  return { hasCutout, cutoutHeight, hasNotch, hasHolePunch };
}

/**
 * Hook that returns foldable-specific info
 * Returns null if not on a foldable device
 *
 * @example
 * const foldableInfo = useFoldableInfo();
 * if (foldableInfo) {
 *   return <FoldableLayout type={foldableInfo.type} />;
 * }
 */
export function useFoldableInfo(): {
  type: 'foldable-cover' | 'foldable-inner';
  isCoverScreen: boolean;
  isInnerScreen: boolean;
} | null {
  const { type, isFoldable } = useScreenType();

  if (!isFoldable) {
    return null;
  }

  return {
    type: type as 'foldable-cover' | 'foldable-inner',
    isCoverScreen: type === 'foldable-cover',
    isInnerScreen: type === 'foldable-inner',
  };
}
