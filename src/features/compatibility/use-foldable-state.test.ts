import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Simple unit tests that don't require complex React Native mocking
import {
  getHingeSafeAreaInsets,
  type FoldableInfo,
} from './use-foldable-state';

describe('getHingeSafeAreaInsets', () => {
  it('should return zero insets for non-foldable', () => {
    const foldableInfo: FoldableInfo = {
      state: 'unfolded',
      screenType: 'inner',
      layoutMode: 'tablet',
      isFoldable: false,
      hingeArea: {
        shouldAvoid: false,
        orientation: 'horizontal',
        safeArea: { top: 0, bottom: 0, left: 0, right: 0 },
      },
      dimensions: { width: 390, height: 844, scale: 3, fontScale: 1 },
      isDualScreen: false,
      postureAngle: 180,
    };

    const insets = getHingeSafeAreaInsets(foldableInfo);

    expect(insets).toEqual({
      paddingTop: 0,
      paddingBottom: 0,
      paddingLeft: 0,
      paddingRight: 0,
    });
  });

  it('should return horizontal hinge insets', () => {
    const foldableInfo: FoldableInfo = {
      state: 'unfolded',
      screenType: 'inner',
      layoutMode: 'tablet',
      isFoldable: true,
      hingeArea: {
        shouldAvoid: true,
        orientation: 'horizontal',
        safeArea: {
          top: 1076,
          bottom: 1100,
          left: 0,
          right: 0,
        },
      },
      dimensions: { width: 1812, height: 2176, scale: 2.5, fontScale: 1 },
      isDualScreen: true,
      postureAngle: 180,
    };

    const insets = getHingeSafeAreaInsets(foldableInfo);

    expect(insets.paddingTop).toBe(1076);
    expect(insets.paddingBottom).toBe(2176 - 1100);
    expect(insets.paddingLeft).toBe(0);
    expect(insets.paddingRight).toBe(0);
  });

  it('should return vertical hinge insets', () => {
    const foldableInfo: FoldableInfo = {
      state: 'unfolded',
      screenType: 'inner',
      layoutMode: 'wide',
      isFoldable: true,
      hingeArea: {
        shouldAvoid: true,
        orientation: 'vertical',
        safeArea: {
          top: 0,
          bottom: 0,
          left: 528,
          right: 552,
        },
      },
      dimensions: { width: 1080, height: 2640, scale: 2.5, fontScale: 1 },
      isDualScreen: true,
      postureAngle: 180,
    };

    const insets = getHingeSafeAreaInsets(foldableInfo);

    expect(insets.paddingTop).toBe(0);
    expect(insets.paddingBottom).toBe(0);
    expect(insets.paddingLeft).toBe(528);
    expect(insets.paddingRight).toBe(1080 - 552);
  });
});

describe('Foldable device constants', () => {
  it('should export known foldable device specs', async () => {
    const { FOLDABLE_DEVICES } = await import('./use-foldable-state');

    expect(FOLDABLE_DEVICES).toBeDefined();
    expect(FOLDABLE_DEVICES.Z_FOLD5).toBeDefined();
    expect(FOLDABLE_DEVICES.Z_FLIP5).toBeDefined();
    expect(FOLDABLE_DEVICES.Z_FOLD5.cover).toBeDefined();
    expect(FOLDABLE_DEVICES.Z_FOLD5.inner).toBeDefined();
  });

  it('should have correct Z Fold5 dimensions', async () => {
    const { FOLDABLE_DEVICES } = await import('./use-foldable-state');

    expect(FOLDABLE_DEVICES.Z_FOLD5.cover.width).toBe(904);
    expect(FOLDABLE_DEVICES.Z_FOLD5.cover.height).toBe(2316);
    expect(FOLDABLE_DEVICES.Z_FOLD5.inner.width).toBe(1812);
    expect(FOLDABLE_DEVICES.Z_FOLD5.inner.height).toBe(2176);
  });

  it('should have correct Z Flip5 dimensions', async () => {
    const { FOLDABLE_DEVICES } = await import('./use-foldable-state');

    expect(FOLDABLE_DEVICES.Z_FLIP5.cover.width).toBe(720);
    expect(FOLDABLE_DEVICES.Z_FLIP5.cover.height).toBe(748);
    expect(FOLDABLE_DEVICES.Z_FLIP5.inner.width).toBe(1080);
    expect(FOLDABLE_DEVICES.Z_FLIP5.inner.height).toBe(2640);
  });
});

describe('Foldable detection thresholds', () => {
  it('should export threshold constants', async () => {
    const { THRESHOLDS } = await import('./use-foldable-state');

    expect(THRESHOLDS).toBeDefined();
    expect(THRESHOLDS.NARROW_MAX_WIDTH).toBe(600);
    expect(THRESHOLDS.TABLET_MIN_WIDTH).toBe(900);
    expect(THRESHOLDS.HINGE_AREA_HEIGHT).toBe(24);
  });
});
