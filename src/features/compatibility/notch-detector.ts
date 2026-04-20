/**
 * Notch/Cutout detection utilities
 * Detects screen cutout type based on safe area insets
 */

import {
  type EdgeInsets,
  type ScreenDimensions,
  type ScreenType,
  DETECTION_THRESHOLDS,
} from '../../services/device/screen-info';

/**
 * Calculate aspect ratio from dimensions
 * Returns width/height ratio (landscape > 1, portrait < 1)
 */
export function getAspectRatio(dimensions: ScreenDimensions): number {
  return dimensions.width / dimensions.height;
}

/**
 * Determine if the device is in landscape orientation
 */
export function isLandscape(dimensions: ScreenDimensions): boolean {
  return dimensions.width > dimensions.height;
}

/**
 * Detect tablet based on shortest edge
 */
export function detectTablet(dimensions: ScreenDimensions): boolean {
  const shortestEdge = Math.min(dimensions.width, dimensions.height);
  return shortestEdge >= DETECTION_THRESHOLDS.TABLET_MIN_EDGE;
}

/**
 * Detect foldable screen types based on aspect ratio and dimensions
 * Returns the specific foldable type or null if not foldable
 *
 * Cover screen detection:
 * - Very narrow aspect ratio (> 2.5 or < 0.4): tall narrow or wide short
 * - Small dimensions: shortest edge < 400dp
 *
 * Inner screen detection:
 * - Nearly square aspect ratio (0.8-1.2)
 * - Large dimensions: shortest edge >= 500dp
 */
export function detectFoldableType(
  insets: EdgeInsets,
  dimensions: ScreenDimensions,
): 'foldable-cover' | 'foldable-inner' | null {
  const aspectRatio = getAspectRatio(dimensions);
  const shortestEdge = Math.min(dimensions.width, dimensions.height);

  // Cover screen: very narrow when portrait (tall), or very wide when landscape
  // AND has small dimensions (cover screens are smaller than typical phones)
  const isNarrowAspect = aspectRatio > DETECTION_THRESHOLDS.FOLDABLE_COVER_ASPECT_RATIO ||
                         aspectRatio < 1 / DETECTION_THRESHOLDS.FOLDABLE_COVER_ASPECT_RATIO;

  if (isNarrowAspect && shortestEdge < 400) {
    return 'foldable-cover';
  }

  // Inner screen: nearly square aspect ratio AND large dimensions
  const isSquareAspect = aspectRatio >= DETECTION_THRESHOLDS.FOLDABLE_INNER_ASPECT_MIN &&
                         aspectRatio <= DETECTION_THRESHOLDS.FOLDABLE_INNER_ASPECT_MAX;

  if (isSquareAspect && shortestEdge >= 500) {
    return 'foldable-inner';
  }

  return null;
}

/**
 * Detect waterfall/curved screen based on side insets
 * Waterfall screens have larger left/right insets due to curved edges
 */
export function detectWaterfall(insets: EdgeInsets): boolean {
  return insets.left >= DETECTION_THRESHOLDS.WATERFALL_SIDE_INSET ||
         insets.right >= DETECTION_THRESHOLDS.WATERFALL_SIDE_INSET;
}

/**
 * Detect pill-shaped cutout (like Dynamic Island or Honor's pill design)
 * These typically have very large top insets
 */
export function detectPill(insets: EdgeInsets): boolean {
  return insets.top >= DETECTION_THRESHOLDS.PILL_MIN_INSET;
}

/**
 * Detect notch screen (centered notch)
 * Characterized by top inset > 32dp
 */
export function detectNotch(insets: EdgeInsets): boolean {
  return insets.top >= DETECTION_THRESHOLDS.NOTCH_MIN_INSET &&
         insets.top < DETECTION_THRESHOLDS.PILL_MIN_INSET;
}

/**
 * Detect teardrop/waterdrop notch (smaller than standard notch)
 * Range: 28-32 dp
 */
export function detectTeardrop(insets: EdgeInsets): boolean {
  return insets.top >= DETECTION_THRESHOLDS.TEARDROP_MIN_INSET &&
         insets.top < DETECTION_THRESHOLDS.TEARDROP_MAX_INSET;
}

/**
 * Detect hole punch based on top inset
 * Range: 24-27 dp
 * Returns whether it's left-aligned or centered
 */
export function detectHolePunch(
  insets: EdgeInsets,
  dimensions: ScreenDimensions,
): 'hole-punch' | 'hole-punch-left' | null {
  const isHolePunchRange = insets.top >= DETECTION_THRESHOLDS.HOLE_PUNCH_MIN_INSET &&
                           insets.top <= DETECTION_THRESHOLDS.HOLE_PUNCH_MAX_INSET;

  if (!isHolePunchRange) {
    return null;
  }

  // In landscape, check left inset to determine hole position
  if (isLandscape(dimensions)) {
    // If left inset is noticeably larger, hole is on the left
    // Use a >= 4dp gap so Samsung S20-style landscape cutouts are classified
    // as left-aligned even when the safe-area delta lands exactly on the boundary.
    if (insets.left >= insets.right + 4) {
      return 'hole-punch-left';
    }
  }

  return 'hole-punch';
}

/**
 * Main detection function that analyzes insets and dimensions
 * to determine screen type following priority order:
 * 1. Foldable detection (most specific)
 * 2. Tablet detection
 * 3. Pill detection (large top inset)
 * 4. Notch detection (medium-large top inset)
 * 5. Teardrop detection (medium top inset)
 * 6. Hole punch detection (small-medium top inset)
 * 7. Waterfall detection (side insets)
 * 8. Standard (default)
 */
export function detectScreenType(
  insets: EdgeInsets,
  dimensions: ScreenDimensions,
): ScreenType {
  // First check for foldable
  const foldableType = detectFoldableType(insets, dimensions);
  if (foldableType) {
    return foldableType;
  }

  // Check for tablet (but not foldable inner screen)
  if (detectTablet(dimensions)) {
    return 'tablet';
  }

  // Check for pill-shaped cutout (largest top inset)
  if (detectPill(insets)) {
    return 'pill';
  }

  // Check for standard notch
  if (detectNotch(insets)) {
    return 'notch';
  }

  // Check for teardrop (waterdrop) notch
  if (detectTeardrop(insets)) {
    return 'teardrop';
  }

  // Check for hole punch
  const holePunchType = detectHolePunch(insets, dimensions);
  if (holePunchType) {
    return holePunchType;
  }

  // Check for waterfall/curved screen
  if (detectWaterfall(insets)) {
    return 'waterfall';
  }

  // Default to standard
  return 'standard';
}

/**
 * Get additional screen characteristics
 * Useful for fine-tuning UI based on specific device quirks
 */
export function getScreenCharacteristics(insets: EdgeInsets, dimensions: ScreenDimensions) {
  const screenType = detectScreenType(insets, dimensions);
  const aspectRatio = getAspectRatio(dimensions);

  return {
    type: screenType,
    hasNotch: screenType === 'notch' || screenType === 'teardrop' || screenType === 'pill',
    hasHolePunch: screenType === 'hole-punch' || screenType === 'hole-punch-left',
    hasCutout: screenType !== 'standard' && screenType !== 'waterfall' && screenType !== 'tablet',
    isCurved: screenType === 'waterfall',
    isFoldable: screenType === 'foldable-cover' || screenType === 'foldable-inner',
    isTablet: screenType === 'tablet',
    aspectRatio,
    landscape: isLandscape(dimensions),
    // Estimated cutout height (top inset minus standard status bar)
    cutoutHeight: Math.max(0, insets.top - DETECTION_THRESHOLDS.STANDARD_TOP_INSET),
  };
}
