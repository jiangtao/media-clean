import { useEffect, useState, useCallback } from 'react';
import { Dimensions, type ScaledSize } from 'react-native';

/**
 * Orientation types
 */
export type Orientation = 'portrait' | 'landscape' | 'portrait-upside-down' | 'landscape-left' | 'landscape-right';

/**
 * Detailed orientation information
 */
export interface OrientationInfo {
  /** Current orientation */
  orientation: Orientation;
  /** Whether device is in portrait mode */
  isPortrait: boolean;
  /** Whether device is in landscape mode */
  isLandscape: boolean;
  /** Current screen dimensions */
  dimensions: ScaledSize;
  /** Screen aspect ratio (width / height) */
  aspectRatio: number;
  /** Whether orientation is locked (not auto-rotating) */
  isLocked: boolean;
}

/**
 * Orientation change event detail
 */
export interface OrientationChangeEvent {
  previousOrientation: Orientation;
  currentOrientation: Orientation;
  dimensions: ScaledSize;
}

/**
 * Threshold for determining orientation from aspect ratio
 */
const ORIENTATION_THRESHOLD = 1;

/**
 * Determine orientation from dimensions
 */
function getOrientationFromDimensions(dimensions: ScaledSize): Orientation {
  const { width, height } = dimensions;
  const aspectRatio = width / height;

  if (aspectRatio < 1) {
    // Height > width, portrait
    return 'portrait';
  } else if (aspectRatio > 1) {
    // Width > height, landscape
    // Determine left/right based on previous state or default to right
    return 'landscape-right';
  }

  // Square - default to portrait
  return 'portrait';
}

/**
 * Hook to monitor screen orientation changes
 *
 * Features:
 * - Real-time orientation detection
 * - Portrait/landscape classification
 * - Aspect ratio calculation
 * - Orientation change callbacks
 * - Support for foldable devices (orientation changes on fold/unfold)
 *
 * @returns OrientationInfo with current orientation state
 *
 * @example
 * ```tsx
 * const orientation = useOrientation();
 *
 * return (
 *   <View style={[
 *     styles.container,
 *     orientation.isLandscape && styles.landscapeLayout
 *   ]}>
 *     <Text>{orientation.isPortrait ? 'Portrait' : 'Landscape'}</Text>
 *   </View>
 * );
 * ```
 */
export function useOrientation(): OrientationInfo {
  const [dimensions, setDimensions] = useState<ScaledSize>(Dimensions.get('window'));
  const [orientation, setOrientation] = useState<Orientation>(getOrientationFromDimensions(dimensions));
  const [isLocked, setIsLocked] = useState(false);

  const updateOrientation = useCallback((newDimensions: ScaledSize) => {
    const newOrientation = getOrientationFromDimensions(newDimensions);
    setDimensions(newDimensions);
    setOrientation(newOrientation);
  }, []);

  // Listen for dimension changes (handles orientation and foldable changes)
  useEffect(() => {
    const handleChange = ({ window }: { window: ScaledSize }) => {
      updateOrientation(window);
    };

    const subscription = Dimensions.addEventListener('change', handleChange);
    return () => subscription.remove();
  }, [updateOrientation]);

  const aspectRatio = dimensions.width / dimensions.height;
  const isPortrait = aspectRatio < ORIENTATION_THRESHOLD;
  const isLandscape = aspectRatio >= ORIENTATION_THRESHOLD;

  return {
    orientation,
    isPortrait,
    isLandscape,
    dimensions,
    aspectRatio,
    isLocked,
  };
}

/**
 * Hook with callback for orientation changes
 * Useful for triggering side effects on orientation change
 *
 * @param onChange - Callback function called when orientation changes
 *
 * @example
 * ```tsx
 * useOrientationChange(({ previousOrientation, currentOrientation }) => {
 *   console.log(`Changed from ${previousOrientation} to ${currentOrientation}`);
 * });
 * ```
 */
export function useOrientationChange(
  onChange: (event: OrientationChangeEvent) => void
): void {
  const [previousOrientation, setPreviousOrientation] = useState<Orientation>(
    getOrientationFromDimensions(Dimensions.get('window'))
  );

  useEffect(() => {
    const handleChange = ({ window }: { window: ScaledSize }) => {
      const currentOrientation = getOrientationFromDimensions(window);

      if (currentOrientation !== previousOrientation) {
        onChange({
          previousOrientation,
          currentOrientation,
          dimensions: window,
        });
        setPreviousOrientation(currentOrientation);
      }
    };

    const subscription = Dimensions.addEventListener('change', handleChange);
    return () => subscription.remove();
  }, [onChange, previousOrientation]);
}

/**
 * Hook to conditionally apply styles based on orientation
 * Returns the appropriate value based on current orientation
 *
 * @param portraitValue - Value to use in portrait mode
 * @param landscapeValue - Value to use in landscape mode
 * @returns Current appropriate value
 *
 * @example
 * ```tsx
 * const numColumns = useOrientationValue(2, 4);
 * const containerWidth = useOrientationValue('100%', '50%');
 * ```
 */
export function useOrientationValue<T>(portraitValue: T, landscapeValue: T): T {
  const { isLandscape } = useOrientation();
  return isLandscape ? landscapeValue : portraitValue;
}

/**
 * Hook for responsive layout calculations
 * Returns responsive values based on screen width breakpoints
 *
 * @param options - Configuration for responsive values
 * @returns Current responsive value
 *
 * @example
 * ```tsx
 * const padding = useResponsive({
 *   narrow: 8,
 *   wide: 16,
 *   tablet: 24,
 * });
 * ```
 */
export interface ResponsiveOptions<T> {
  narrow: T;
  wide: T;
  tablet: T;
}

export function useResponsive<T>(options: ResponsiveOptions<T>): T {
  const { dimensions, isLandscape } = useOrientation();
  const width = dimensions.width;

  // Consider orientation for tablet detection
  const effectiveWidth = isLandscape ? Math.max(width, dimensions.height) : width;

  if (effectiveWidth >= 900) {
    return options.tablet;
  }
  if (effectiveWidth >= 600) {
    return options.wide;
  }
  return options.narrow;
}

/**
 * Hook specifically for foldable device orientation handling
 * Combines fold state with orientation for proper layout
 *
 * @returns Object with orientation info and foldable-specific flags
 */
export interface FoldableOrientationInfo extends OrientationInfo {
  /** Whether this orientation change was due to folding/unfolding */
  isFoldableChange: boolean;
  /** Whether current state is suitable for dual-pane layout */
  supportsDualPane: boolean;
}

/**
 * Get orientation style helpers
 * Returns common style patterns for orientation handling
 */
export function getOrientationStyles(isLandscape: boolean) {
  return {
    flexDirection: isLandscape ? 'row' : 'column' as const,
    containerPadding: isLandscape ? 24 : 16,
    gridColumns: isLandscape ? 4 : 2,
    cardWidth: isLandscape ? '23%' : '48%',
    showSidePanel: isLandscape,
  };
}
