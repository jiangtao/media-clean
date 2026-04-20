/**
 * Screen type definitions
 * Based on safe area insets to infer device screen type
 */

export type ScreenType =
  | 'standard'
  | 'notch'
  | 'teardrop'
  | 'hole-punch'
  | 'hole-punch-left'
  | 'waterfall'
  | 'pill'
  | 'tablet'
  | 'foldable-cover'
  | 'foldable-inner';

export interface EdgeInsets {
  top: number;
  left: number;
  right: number;
  bottom: number;
}

export interface ScreenDimensions {
  width: number;
  height: number;
  scale: number;
  fontScale: number;
}

export interface ScreenInfo {
  type: ScreenType;
  insets: EdgeInsets;
  dimensions: ScreenDimensions;
  isLandscape: boolean;
  isTablet: boolean;
  isFoldable: boolean;
}

/**
 * Detection thresholds based on empirical data from design document
 * Values are in dp (density-independent pixels)
 *
 * Priority order (highest first):
 * 1. Pill (> 35dp)
 * 2. Notch (> 32dp)
 * 3. Teardrop (28-32dp)
 * 4. Hole punch (25-27dp)
 * 5. Standard (= 24dp, no cutout)
 */
export const DETECTION_THRESHOLDS = {
  // Standard status bar height is typically 24dp
  STANDARD_TOP_INSET: 24,

  // Pill-shaped cutouts (like Dynamic Island) - highest priority
  // These typically have top inset > 35dp
  PILL_MIN_INSET: 35,

  // Notch screens (centered notch) - top inset > 32dp
  NOTCH_MIN_INSET: 32,

  // Teardrop (waterdrop) screens - top inset 28-32dp (inclusive)
  TEARDROP_MIN_INSET: 28,
  TEARDROP_MAX_INSET: 32,

  // Hole punch screens - top inset 25-27dp
  // This is just slightly above standard status bar (24dp)
  // Standard = 24, Hole punch > 24
  HOLE_PUNCH_MIN_INSET: 25,
  HOLE_PUNCH_MAX_INSET: 27,

  // Waterfall/curved screens have significant side insets
  WATERFALL_SIDE_INSET: 8,

  // Foldable cover screens are narrow (aspect ratio > 2.5 or < 0.4)
  FOLDABLE_COVER_ASPECT_RATIO: 2.5,

  // Foldable inner screens are nearly square (aspect ratio 0.8-1.2)
  FOLDABLE_INNER_ASPECT_MIN: 0.8,
  FOLDABLE_INNER_ASPECT_MAX: 1.2,

  // Tablet threshold based on shortest edge
  TABLET_MIN_EDGE: 600,
} as const;
