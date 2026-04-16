import { describe, expect, it } from 'vitest';

import { calculateVisualMetricsFromRgba } from './image-metrics';

describe('calculateVisualMetricsFromRgba', () => {
  it('detects a dark flat image', () => {
    const pixels = new Uint8Array([
      10, 10, 10, 255,
      12, 12, 12, 255,
      11, 11, 11, 255,
      9, 9, 9, 255,
    ]);

    const metrics = calculateVisualMetricsFromRgba(pixels, 2, 2);

    expect(metrics.brightness).toBeLessThan(0.1);
    expect(metrics.contrast).toBeLessThan(0.02);
    expect(metrics.edgeDensity).toBeLessThan(0.05);
  });

  it('detects a bright detailed image', () => {
    const pixels = new Uint8Array([
      250, 250, 250, 255,
      30, 30, 30, 255,
      220, 160, 50, 255,
      60, 120, 230, 255,
    ]);

    const metrics = calculateVisualMetricsFromRgba(pixels, 2, 2);

    expect(metrics.brightness).toBeGreaterThan(0.4);
    expect(metrics.contrast).toBeGreaterThan(0.2);
    expect(metrics.edgeDensity).toBeGreaterThan(0.2);
  });
});
