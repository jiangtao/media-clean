import { describe, it, expect, vi, beforeEach } from 'vitest';

// Simple unit tests for utility functions
import {
  getEffectiveLayoutStyle,
  calculateSplitLayout,
} from './FoldableLayout';
import type { FoldableInfo } from '../../features/compatibility/use-foldable-state';

describe('getEffectiveLayoutStyle', () => {
  it('should return narrow layout', () => {
    const result = getEffectiveLayoutStyle('narrow', {}, false);

    expect(result.padding).toBe(12);
    expect(result.gap).toBe(12);
  });

  it('should return wide layout', () => {
    const result = getEffectiveLayoutStyle('wide', {}, false);

    expect(result.padding).toBe(18);
    expect(result.maxWidth).toBe(800);
  });

  it('should return tablet layout', () => {
    const result = getEffectiveLayoutStyle('tablet', {}, false);

    expect(result.padding).toBe(24);
    expect(result.maxWidth).toBe(1200);
  });

  it('should apply custom config', () => {
    const result = getEffectiveLayoutStyle('narrow', { narrow: { padding: 8 } }, false);

    expect(result.padding).toBe(8);
  });
});

describe('calculateSplitLayout', () => {
  it('should calculate standard split without hinge', () => {
    const foldableInfo: FoldableInfo = {
      state: 'unfolded',
      screenType: 'inner',
      layoutMode: 'narrow',
      isFoldable: false,
      hingeArea: { shouldAvoid: false, orientation: 'horizontal', safeArea: { top: 0, bottom: 0, left: 0, right: 0 } },
      dimensions: { width: 390, height: 844, scale: 3, fontScale: 1 },
      isDualScreen: false,
      postureAngle: 180,
    };

    const result = calculateSplitLayout(foldableInfo, 0.5, false);

    expect(result.pane1).toEqual({ flex: 0.5 });
    expect(result.pane2).toEqual({ flex: 0.5 });
    expect(result.hingeGap).toBe(0);
  });

  it('should calculate hinge-aware split for unfolded Z Fold', () => {
    const foldableInfo: FoldableInfo = {
      state: 'unfolded',
      screenType: 'inner',
      layoutMode: 'tablet',
      isFoldable: true,
      hingeArea: {
        shouldAvoid: true,
        orientation: 'horizontal',
        safeArea: { top: 1076, bottom: 1100, left: 0, right: 0 },
      },
      dimensions: { width: 1812, height: 2176, scale: 2.5, fontScale: 1 },
      isDualScreen: true,
      postureAngle: 180,
    };

    const result = calculateSplitLayout(foldableInfo, 0.5, false);

    expect(result.pane1).toEqual({ flex: 0.5 });
    expect(result.pane2).toEqual({ flex: 0.5 });
    expect(result.hingeGap).toBe(24); // 1100 - 1076
  });

  it('should calculate hinge-aware split for vertical hinge', () => {
    const foldableInfo: FoldableInfo = {
      state: 'unfolded',
      screenType: 'inner',
      layoutMode: 'wide',
      isFoldable: true,
      hingeArea: {
        shouldAvoid: true,
        orientation: 'vertical',
        safeArea: { top: 0, bottom: 0, left: 528, right: 552 },
      },
      dimensions: { width: 1080, height: 2640, scale: 2.5, fontScale: 1 },
      isDualScreen: true,
      postureAngle: 180,
    };

    const result = calculateSplitLayout(foldableInfo, 0.4, true);

    expect(result.pane1).toEqual({ flex: 0.4 });
    expect(result.pane2).toEqual({ flex: 0.6 });
    expect(result.hingeGap).toBe(24); // 552 - 528
  });
});

describe('FoldableLayout component exports', () => {
  it('should export all hooks and components', async () => {
    const mod = await import('./FoldableLayout');

    expect(mod.FoldableLayout).toBeDefined();
    expect(mod.useFoldableLayout).toBeDefined();
    expect(mod.useFoldableGridColumns).toBeDefined();
    expect(mod.HingeSafeArea).toBeDefined();
    expect(mod.getEffectiveLayoutStyle).toBeDefined();
    expect(mod.calculateSplitLayout).toBeDefined();
  });

  it('should export types', async () => {
    const mod = await import('./FoldableLayout');

    // Types are compile-time only, but we can verify the module loads
    expect(mod).toBeDefined();
  });
});
