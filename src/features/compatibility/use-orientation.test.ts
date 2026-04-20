import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Simple unit tests that don't require complex React Native mocking
import {
  getOrientationStyles,
} from './use-orientation';

describe('getOrientationStyles', () => {
  it('should return portrait styles', () => {
    const styles = getOrientationStyles(false);

    expect(styles.flexDirection).toBe('column');
    expect(styles.containerPadding).toBe(16);
    expect(styles.gridColumns).toBe(2);
    expect(styles.showSidePanel).toBe(false);
  });

  it('should return landscape styles', () => {
    const styles = getOrientationStyles(true);

    expect(styles.flexDirection).toBe('row');
    expect(styles.containerPadding).toBe(24);
    expect(styles.gridColumns).toBe(4);
    expect(styles.showSidePanel).toBe(true);
  });
});

describe('Orientation types', () => {
  it('should export Orientation type', async () => {
    const mod = await import('./use-orientation');

    expect(mod).toBeDefined();
    expect(typeof mod.useOrientation).toBe('function');
    expect(typeof mod.useOrientationChange).toBe('function');
    expect(typeof mod.useOrientationValue).toBe('function');
    expect(typeof mod.useResponsive).toBe('function');
  });
});
