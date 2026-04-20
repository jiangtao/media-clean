import { useEffect, useState, useCallback } from 'react';
import { Dimensions, type ScaledSize } from 'react-native';

/**
 * Foldable device state types
 */
export type FoldableState = 'folded' | 'unfolded' | 'half-folded';
export type ScreenType = 'cover' | 'inner';
export type LayoutMode = 'narrow' | 'wide' | 'tablet';

/**
 * Device screen specifications for known foldable devices
 * @public Exported for testing and device detection
 */
export const FOLDABLE_DEVICES = {
  // Galaxy Z Flip series
  'Z_FLIP5': { cover: { width: 720, height: 748 }, inner: { width: 1080, height: 2640 } },
  'Z_FLIP6': { cover: { width: 720, height: 748 }, inner: { width: 1080, height: 2640 } },

  // Galaxy Z Fold series
  'Z_FOLD5': { cover: { width: 904, height: 2316 }, inner: { width: 1812, height: 2176 } },
  'Z_FOLD6': { cover: { width: 904, height: 2316 }, inner: { width: 1812, height: 2176 } },

  // Pixel Fold
  'PIXEL_FOLD': { cover: { width: 1080, height: 2100 }, inner: { width: 1840, height: 2208 } },

  // OnePlus Open
  'ONEPLUS_OPEN': { cover: { width: 1080, height: 2400 }, inner: { width: 1920, height: 2440 } },

  // Huawei Mate X series
  'MATE_X5': { cover: { width: 1080, height: 2504 }, inner: { width: 2224, height: 2504 } },

  // Honor Magic V series
  'MAGIC_V2': { cover: { width: 1080, height: 2376 }, inner: { width: 2156, height: 2340 } },

  // Xiaomi Mix Fold series
  'MIX_FOLD4': { cover: { width: 1080, height: 2520 }, inner: { width: 2488, height: 2224 } },

  // Vivo X Fold series
  'X_FOLD3': { cover: { width: 1080, height: 2520 }, inner: { width: 2480, height: 2200 } },

  // Oppo Find N series
  'FIND_N3': { cover: { width: 1080, height: 2520 }, inner: { width: 2268, height: 2440 } },

  // Motorola Razr series
  'RAZR_2024': { cover: { width: 1056, height: 1066 }, inner: { width: 1080, height: 2640 } },
};

/**
 * Threshold constants for foldable detection
 * @public Exported for testing and configuration
 */
export const THRESHOLDS = {
  /** Width below which is considered narrow/cover screen layout */
  NARROW_MAX_WIDTH: 600,
  /** Width above which is considered tablet layout */
  TABLET_MIN_WIDTH: 900,
  /** Aspect ratio threshold for detecting foldable screens */
  FOLDABLE_ASPECT_RATIO_MIN: 0.3,
  FOLDABLE_ASPECT_RATIO_MAX: 1.2,
  /** Hinge area height for unfolded state (approximate) */
  HINGE_AREA_HEIGHT: 24,
  /** Half-folded detection threshold (angle approximation via dimensions) */
  HALF_FOLDED_THRESHOLD: 0.6,
};

/**
 * Hinge area information
 */
export interface HingeArea {
  /** Whether hinge area should be avoided */
  shouldAvoid: boolean;
  /** Hinge position: 'horizontal' (folds horizontally like Z Fold) or 'vertical' (folds vertically like Z Flip) */
  orientation: 'horizontal' | 'vertical';
  /** Safe area insets for hinge */
  safeArea: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
}

/**
 * Foldable state information
 */
export interface FoldableInfo {
  /** Current fold state */
  state: FoldableState;
  /** Which screen is active */
  screenType: ScreenType;
  /** Current layout mode */
  layoutMode: LayoutMode;
  /** Whether this is a foldable device */
  isFoldable: boolean;
  /** Hinge area information */
  hingeArea: HingeArea;
  /** Current screen dimensions */
  dimensions: ScaledSize;
  /** Whether device is currently in dual-screen mode */
  isDualScreen: boolean;
  /** Fold posture angle approximation (0 = flat, 90 = half-folded, 180 = folded closed) */
  postureAngle: number;
}

/**
 * Default foldable info for non-foldable devices
 */
const DEFAULT_FOLDABLE_INFO: FoldableInfo = {
  state: 'unfolded',
  screenType: 'inner',
  layoutMode: 'narrow',
  isFoldable: false,
  hingeArea: {
    shouldAvoid: false,
    orientation: 'horizontal',
    safeArea: { top: 0, bottom: 0, left: 0, right: 0 },
  },
  dimensions: Dimensions.get('window'),
  isDualScreen: false,
  postureAngle: 180,
};

/**
 * Check if dimensions match a known foldable device pattern
 */
function detectFoldableDevice(width: number, height: number): { isFoldable: boolean; type?: ScreenType } {
  const aspectRatio = width / height;
  const isLandscape = aspectRatio > 1;
  const effectiveWidth = isLandscape ? width : height;
  const effectiveHeight = isLandscape ? height : width;

  for (const [device, specs] of Object.entries(FOLDABLE_DEVICES)) {
    // Check cover screen match
    const coverMatch = Math.abs(effectiveWidth - specs.cover.width) < 50 &&
                      Math.abs(effectiveHeight - specs.cover.height) < 100;
    if (coverMatch) {
      return { isFoldable: true, type: 'cover' };
    }

    // Check inner screen match
    const innerMatch = Math.abs(effectiveWidth - specs.inner.width) < 100 &&
                      Math.abs(effectiveHeight - specs.inner.height) < 100;
    if (innerMatch) {
      return { isFoldable: true, type: 'inner' };
    }
  }

  // Heuristic detection for unknown foldable devices
  // Very square aspect ratio (close to 1:1) suggests cover screen
  if (aspectRatio >= 0.9 && aspectRatio <= 1.1 && width < 800) {
    return { isFoldable: true, type: 'cover' };
  }

  // Very wide inner screen aspect ratio
  if (aspectRatio > 1.3 && width > 1600) {
    return { isFoldable: true, type: 'inner' };
  }

  return { isFoldable: false };
}

/**
 * Determine layout mode based on screen width
 */
function getLayoutMode(width: number): LayoutMode {
  if (width < THRESHOLDS.NARROW_MAX_WIDTH) {
    return 'narrow';
  }
  if (width >= THRESHOLDS.TABLET_MIN_WIDTH) {
    return 'tablet';
  }
  return 'wide';
}

/**
 * Calculate hinge area based on device state
 */
function calculateHingeArea(
  state: FoldableState,
  screenType: ScreenType,
  dimensions: ScaledSize
): HingeArea {
  if (state !== 'unfolded' || screenType !== 'inner') {
    return {
      shouldAvoid: false,
      orientation: 'horizontal',
      safeArea: { top: 0, bottom: 0, left: 0, right: 0 },
    };
  }

  const { width, height } = dimensions;
  const aspectRatio = width / height;

  // For devices that fold horizontally (like Z Fold - wider when unfolded)
  if (aspectRatio > 1) {
    const hingeHeight = THRESHOLDS.HINGE_AREA_HEIGHT;
    const centerY = height / 2;

    return {
      shouldAvoid: true,
      orientation: 'horizontal',
      safeArea: {
        top: Math.max(0, centerY - hingeHeight / 2),
        bottom: Math.max(0, centerY + hingeHeight / 2),
        left: 0,
        right: 0,
      },
    };
  }

  // For devices that fold vertically (like Z Flip - taller when unfolded)
  const hingeWidth = THRESHOLDS.HINGE_AREA_HEIGHT;
  const centerX = width / 2;

  return {
    shouldAvoid: true,
    orientation: 'vertical',
    safeArea: {
      top: 0,
      bottom: 0,
      left: Math.max(0, centerX - hingeWidth / 2),
      right: Math.max(0, centerX + hingeWidth / 2),
    },
  };
}

/**
 * Hook to monitor foldable device state
 *
 * Features:
 * - Detects foldable devices based on screen dimensions
 * - Monitors fold/unfold state changes
 * - Calculates hinge area for layout avoidance
 * - Determines appropriate layout mode (narrow/wide/tablet)
 *
 * @returns FoldableInfo object with current device state
 *
 * @example
 * ```tsx
 * const foldable = useFoldableState();
 *
 * return (
 *   <View style={{
 *     paddingTop: foldable.hingeArea.safeArea.top,
 *     paddingBottom: foldable.hingeArea.safeArea.bottom,
 *   }}>
 *     {foldable.layoutMode === 'tablet' ? <TabletLayout /> : <PhoneLayout />}
 *   </View>
 * );
 * ```
 */
export function useFoldableState(): FoldableInfo {
  const [dimensions, setDimensions] = useState<ScaledSize>(Dimensions.get('window'));
  const [foldableInfo, setFoldableInfo] = useState<FoldableInfo>(DEFAULT_FOLDABLE_INFO);

  const updateFoldableState = useCallback(() => {
    const { width, height } = dimensions;
    const detection = detectFoldableDevice(width, height);

    if (!detection.isFoldable) {
      setFoldableInfo({
        ...DEFAULT_FOLDABLE_INFO,
        dimensions,
        layoutMode: getLayoutMode(width),
      });
      return;
    }

    const layoutMode = getLayoutMode(width);
    const screenType = detection.type || 'inner';

    // Determine fold state based on dimensions
    let state: FoldableState = 'unfolded';
    let postureAngle = 180;

    if (screenType === 'cover') {
      state = 'folded';
      postureAngle = 0;
    } else {
      // Inner screen - check if dimensions suggest half-folded
      const aspectRatio = width / height;
      if (aspectRatio < THRESHOLDS.HALF_FOLDED_THRESHOLD) {
        state = 'half-folded';
        postureAngle = 90;
      }
    }

    const hingeArea = calculateHingeArea(state, screenType, dimensions);

    setFoldableInfo({
      state,
      screenType,
      layoutMode,
      isFoldable: true,
      hingeArea,
      dimensions,
      isDualScreen: state === 'unfolded' && screenType === 'inner',
      postureAngle,
    });
  }, [dimensions]);

  // Update foldable state when dimensions change
  useEffect(() => {
    updateFoldableState();
  }, [updateFoldableState]);

  // Listen for dimension changes
  useEffect(() => {
    const handleChange = ({ window }: { window: ScaledSize }) => {
      setDimensions(window);
    };

    const subscription = Dimensions.addEventListener('change', handleChange);
    return () => subscription.remove();
  }, []);

  return foldableInfo;
}

/**
 * Hook to check if device is a specific foldable model
 * Useful for device-specific optimizations
 */
export function useFoldableDeviceModel(): keyof typeof FOLDABLE_DEVICES | 'unknown' | 'non-foldable' {
  const [model, setModel] = useState<keyof typeof FOLDABLE_DEVICES | 'unknown' | 'non-foldable'>('non-foldable');

  useEffect(() => {
    const { width, height } = Dimensions.get('window');
    const isLandscape = width > height;
    const effectiveWidth = isLandscape ? width : height;
    const effectiveHeight = isLandscape ? height : width;

    for (const [device, specs] of Object.entries(FOLDABLE_DEVICES)) {
      const coverMatch = Math.abs(effectiveWidth - specs.cover.width) < 50 &&
                        Math.abs(effectiveHeight - specs.cover.height) < 100;
      const innerMatch = Math.abs(effectiveWidth - specs.inner.width) < 100 &&
                        Math.abs(effectiveHeight - specs.inner.height) < 100;

      if (coverMatch || innerMatch) {
        setModel(device as keyof typeof FOLDABLE_DEVICES);
        return;
      }
    }

    // Heuristic detection
    const detection = detectFoldableDevice(width, height);
    setModel(detection.isFoldable ? 'unknown' : 'non-foldable');
  }, []);

  return model;
}

/**
 * Get CSS-like safe area insets for hinge avoidance
 * Returns padding values to avoid the hinge area
 */
export function getHingeSafeAreaInsets(foldableInfo: FoldableInfo): {
  paddingTop: number;
  paddingBottom: number;
  paddingLeft: number;
  paddingRight: number;
} {
  if (!foldableInfo.hingeArea.shouldAvoid) {
    return { paddingTop: 0, paddingBottom: 0, paddingLeft: 0, paddingRight: 0 };
  }

  const { safeArea, orientation } = foldableInfo.hingeArea;

  if (orientation === 'horizontal') {
    return {
      paddingTop: safeArea.top,
      paddingBottom: foldableInfo.dimensions.height - safeArea.bottom,
      paddingLeft: 0,
      paddingRight: 0,
    };
  }

  return {
    paddingTop: 0,
    paddingBottom: 0,
    paddingLeft: safeArea.left,
    paddingRight: foldableInfo.dimensions.width - safeArea.right,
  };
}
