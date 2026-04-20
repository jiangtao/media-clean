import { describe, expect, it } from 'vitest';
import {
  detectScreenType,
  detectNotch,
  detectTeardrop,
  detectHolePunch,
  detectPill,
  detectWaterfall,
  detectFoldableType,
  detectTablet,
  getScreenCharacteristics,
  isLandscape,
  getAspectRatio,
} from './notch-detector';
import type { EdgeInsets, ScreenDimensions } from '../../services/device/screen-info';

const createInsets = (overrides: Partial<EdgeInsets> = {}): EdgeInsets => ({
  top: 24,
  left: 0,
  right: 0,
  bottom: 0,
  ...overrides,
});

const createDimensions = (overrides: Partial<ScreenDimensions> = {}): ScreenDimensions => ({
  // useWindowDimensions returns dp (density-independent pixels), not pixels
  // Typical phone: ~393dp width at 2.75x scale = ~1080px
  width: 393,
  height: 873,
  scale: 2.75,
  fontScale: 1,
  ...overrides,
});

describe('isLandscape', () => {
  it('returns true when width > height', () => {
    expect(isLandscape(createDimensions({ width: 873, height: 393 }))).toBe(true);
  });

  it('returns false when width < height', () => {
    expect(isLandscape(createDimensions({ width: 393, height: 873 }))).toBe(false);
  });

  it('returns false when width === height', () => {
    expect(isLandscape(createDimensions({ width: 393, height: 393 }))).toBe(false);
  });
});

describe('getAspectRatio', () => {
  it('calculates correct aspect ratio for portrait', () => {
    expect(getAspectRatio(createDimensions({ width: 393, height: 873 }))).toBeCloseTo(0.45, 2);
  });

  it('calculates correct aspect ratio for landscape', () => {
    expect(getAspectRatio(createDimensions({ width: 873, height: 393 }))).toBeCloseTo(2.22, 2);
  });

  it('returns 1 for square screen', () => {
    expect(getAspectRatio(createDimensions({ width: 393, height: 393 }))).toBe(1);
  });
});

describe('detectTablet', () => {
  it('returns true for large screen with shortest edge >= 600', () => {
    expect(detectTablet(createDimensions({ width: 600, height: 960 }))).toBe(true);
    expect(detectTablet(createDimensions({ width: 960, height: 600 }))).toBe(true);
  });

  it('returns false for phone-sized screens', () => {
    expect(detectTablet(createDimensions({ width: 393, height: 873 }))).toBe(false);
    expect(detectTablet(createDimensions({ width: 360, height: 800 }))).toBe(false);
  });

  it('returns true at exactly 600dp threshold', () => {
    expect(detectTablet(createDimensions({ width: 600, height: 800 }))).toBe(true);
  });
});

describe('detectFoldableType', () => {
  it('detects foldable cover screen by narrow aspect ratio and small size', () => {
    // Z Fold 5 cover screen in portrait (tall and narrow): ~329x843 dp
    const foldCover = createDimensions({ width: 329, height: 843 });
    expect(detectFoldableType(createInsets(), foldCover)).toBe('foldable-cover');
  });

  it('detects foldable inner screen by square aspect ratio and large size', () => {
    // Z Fold 5 inner screen: ~660x792 dp (aspect ~0.83, shortest edge 660)
    const foldInner = createDimensions({ width: 660, height: 792 });
    expect(detectFoldableType(createInsets(), foldInner)).toBe('foldable-inner');
  });

  it('returns null for regular phone screens', () => {
    const phone = createDimensions({ width: 393, height: 873 });
    expect(detectFoldableType(createInsets(), phone)).toBeNull();
  });

  it('returns null for small square screens (not foldable)', () => {
    // Small square screen should not be detected as foldable inner
    const smallSquare = createDimensions({ width: 300, height: 320 });
    expect(detectFoldableType(createInsets(), smallSquare)).toBeNull();
  });
});

describe('detectWaterfall', () => {
  it('detects waterfall screen by large side insets', () => {
    expect(detectWaterfall(createInsets({ left: 8 }))).toBe(true);
    expect(detectWaterfall(createInsets({ right: 8 }))).toBe(true);
    expect(detectWaterfall(createInsets({ left: 12, right: 12 }))).toBe(true);
  });

  it('returns false for standard screens', () => {
    expect(detectWaterfall(createInsets({ left: 0, right: 0 }))).toBe(false);
    expect(detectWaterfall(createInsets({ left: 4, right: 4 }))).toBe(false);
  });
});

describe('detectPill', () => {
  it('detects pill screen by large top inset (>=35)', () => {
    expect(detectPill(createInsets({ top: 35 }))).toBe(true);
    expect(detectPill(createInsets({ top: 40 }))).toBe(true);
    expect(detectPill(createInsets({ top: 50 }))).toBe(true);
  });

  it('returns false for smaller top insets', () => {
    expect(detectPill(createInsets({ top: 30 }))).toBe(false);
    expect(detectPill(createInsets({ top: 24 }))).toBe(false);
  });
});

describe('detectNotch', () => {
  it('detects notch screen by top inset in 32-34 range', () => {
    expect(detectNotch(createInsets({ top: 32 }))).toBe(true);
    expect(detectNotch(createInsets({ top: 34 }))).toBe(true);
  });

  it('returns false for top inset outside 32-34 range', () => {
    expect(detectNotch(createInsets({ top: 31 }))).toBe(false);
    expect(detectNotch(createInsets({ top: 35 }))).toBe(false); // pill range
    expect(detectNotch(createInsets({ top: 30 }))).toBe(false); // teardrop range
    expect(detectNotch(createInsets({ top: 24 }))).toBe(false);
  });
});

describe('detectTeardrop', () => {
  it('detects teardrop screen by top inset in 28-31 range', () => {
    expect(detectTeardrop(createInsets({ top: 28 }))).toBe(true);
    expect(detectTeardrop(createInsets({ top: 30 }))).toBe(true);
    expect(detectTeardrop(createInsets({ top: 31 }))).toBe(true);
  });

  it('returns false for top inset outside range', () => {
    expect(detectTeardrop(createInsets({ top: 27 }))).toBe(false);
    expect(detectTeardrop(createInsets({ top: 32 }))).toBe(false);
    expect(detectTeardrop(createInsets({ top: 24 }))).toBe(false);
  });
});

describe('detectHolePunch', () => {
  it('detects hole punch by top inset in 25-27 range', () => {
    expect(detectHolePunch(createInsets({ top: 25 }), createDimensions())).toBe('hole-punch');
    expect(detectHolePunch(createInsets({ top: 26 }), createDimensions())).toBe('hole-punch');
    expect(detectHolePunch(createInsets({ top: 27 }), createDimensions())).toBe('hole-punch');
  });

  it('detects left hole punch in landscape with larger left inset', () => {
    const landscape = createDimensions({ width: 873, height: 393 });
    expect(detectHolePunch(createInsets({ top: 25, left: 12, right: 0 }), landscape)).toBe('hole-punch-left');
  });

  it('returns null for top inset outside 25-27 range', () => {
    expect(detectHolePunch(createInsets({ top: 24 }), createDimensions())).toBeNull();
    expect(detectHolePunch(createInsets({ top: 28 }), createDimensions())).toBeNull();
  });
});

describe('detectScreenType', () => {
  it('detects standard screen', () => {
    // Standard screen: top inset exactly 24 (standard status bar) and no other indicators
    const standard = detectScreenType(
      createInsets({ top: 24, left: 0, right: 0 }),
      createDimensions({ width: 393, height: 873 }),
    );
    expect(standard).toBe('standard');
  });

  it('detects hole punch screen', () => {
    const holePunch = detectScreenType(
      createInsets({ top: 26 }), // 25-27 range
      createDimensions({ width: 393, height: 873 }),
    );
    expect(holePunch).toBe('hole-punch');
  });

  it('detects notch screen', () => {
    const notch = detectScreenType(
      createInsets({ top: 33 }), // 32-34 range
      createDimensions({ width: 393, height: 852 }),
    );
    expect(notch).toBe('notch');
  });

  it('detects teardrop screen', () => {
    const teardrop = detectScreenType(
      createInsets({ top: 30 }), // 28-31 range
      createDimensions({ width: 393, height: 873 }),
    );
    expect(teardrop).toBe('teardrop');
  });

  it('detects hole punch left screen', () => {
    const holePunchLeft = detectScreenType(
      createInsets({ top: 26, left: 12, right: 0 }), // 25-27 range
      createDimensions({ width: 873, height: 393 }), // landscape
    );
    expect(holePunchLeft).toBe('hole-punch-left');
  });

  it('detects waterfall screen', () => {
    const waterfall = detectScreenType(
      createInsets({ top: 24, left: 8, right: 8 }), // Waterfall detected by side insets (not hole punch)
      createDimensions({ width: 393, height: 873 }),
    );
    expect(waterfall).toBe('waterfall');
  });

  it('detects pill screen', () => {
    const pill = detectScreenType(
      createInsets({ top: 50 }), // > 35
      createDimensions({ width: 436, height: 969 }),
    );
    expect(pill).toBe('pill');
  });

  it('detects tablet', () => {
    const tablet = detectScreenType(
      createInsets({ top: 24 }),
      createDimensions({ width: 600, height: 960 }),
    );
    expect(tablet).toBe('tablet');
  });

  it('detects foldable cover screen', () => {
    const foldCover = detectScreenType(
      createInsets({ top: 24 }),
      createDimensions({ width: 329, height: 843 }), // tall narrow
    );
    expect(foldCover).toBe('foldable-cover');
  });

  it('detects foldable inner screen', () => {
    const foldInner = detectScreenType(
      createInsets({ top: 24 }),
      createDimensions({ width: 660, height: 792 }), // nearly square
    );
    expect(foldInner).toBe('foldable-inner');
  });

  it('prioritizes pill over notch for large top inset', () => {
    const pill = detectScreenType(
      createInsets({ top: 50 }), // > 35, so pill
      createDimensions({ width: 393, height: 873 }),
    );
    expect(pill).toBe('pill');
  });

  it('prioritizes foldable over tablet', () => {
    const foldable = detectScreenType(
      createInsets({ top: 24 }),
      createDimensions({ width: 660, height: 792 }),
    );
    expect(foldable).toBe('foldable-inner');
    expect(foldable).not.toBe('tablet');
  });
});

describe('getScreenCharacteristics', () => {
  it('returns correct characteristics for standard screen', () => {
    const chars = getScreenCharacteristics(
      createInsets({ top: 24, left: 0, right: 0 }), // No side insets
      createDimensions({ width: 393, height: 873 }),
    );
    expect(chars.type).toBe('standard');
    expect(chars.hasNotch).toBe(false);
    expect(chars.hasHolePunch).toBe(false);
    expect(chars.hasCutout).toBe(false);
    expect(chars.isCurved).toBe(false);
    expect(chars.isFoldable).toBe(false);
    expect(chars.isTablet).toBe(false);
    expect(chars.cutoutHeight).toBe(0);
  });

  it('returns correct characteristics for notch screen', () => {
    const chars = getScreenCharacteristics(
      createInsets({ top: 33 }),
      createDimensions({ width: 393, height: 852 }),
    );
    expect(chars.type).toBe('notch');
    expect(chars.hasNotch).toBe(true);
    expect(chars.hasCutout).toBe(true);
    expect(chars.cutoutHeight).toBe(9); // 33 - 24
  });

  it('returns correct characteristics for hole punch screen', () => {
    const chars = getScreenCharacteristics(
      createInsets({ top: 26 }),
      createDimensions({ width: 393, height: 852 }),
    );
    expect(chars.type).toBe('hole-punch');
    expect(chars.hasHolePunch).toBe(true);
    expect(chars.hasCutout).toBe(true);
    expect(chars.cutoutHeight).toBe(2); // 26 - 24
  });

  it('returns correct characteristics for foldable', () => {
    const chars = getScreenCharacteristics(
      createInsets({ top: 24 }),
      createDimensions({ width: 660, height: 792 }),
    );
    expect(chars.isFoldable).toBe(true);
    expect(chars.isTablet).toBe(false);
  });

  it('returns correct characteristics for waterfall screen', () => {
    const chars = getScreenCharacteristics(
      createInsets({ top: 24, left: 8, right: 8 }), // Side insets for curved screen
      createDimensions({ width: 393, height: 873 }),
    );
    expect(chars.isCurved).toBe(true);
  });
});
