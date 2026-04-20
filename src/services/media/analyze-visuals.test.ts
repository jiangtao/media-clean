import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-image-manipulator', () => ({
  manipulateAsync: vi.fn(),
  SaveFormat: {
    JPEG: 'jpeg',
  },
}));

vi.mock('expo-video-thumbnails', () => ({
  getThumbnailAsync: vi.fn(),
}));

import { buildVideoSampleTimes } from './analyze-visuals';

describe('buildVideoSampleTimes', () => {
  it('returns one zero sample when duration is unavailable', () => {
    expect(buildVideoSampleTimes(0)).toEqual([0]);
  });

  it('uses a compact, evenly spaced sample set inside a stable inner window for short videos', () => {
    const result = buildVideoSampleTimes(4.8);

    expect(result).toHaveLength(3);
    expect(result[0]).toBeGreaterThan(0);
    expect(result[1]).toBeGreaterThan(result[0]!);
    expect(result[2]).toBeGreaterThan(result[1]!);
    expect(result[2]).toBeLessThan(4_800 - 250);

    const gaps = [
      result[1]! - result[0]!,
      result[2]! - result[1]!,
    ];
    expect(Math.abs(gaps[0]! - gaps[1]!)).toBeLessThanOrEqual(2);
  });

  it('uses more evenly spaced samples for medium and long videos without drifting to the start or end', () => {
    const medium = buildVideoSampleTimes(18);
    const long = buildVideoSampleTimes(95);

    expect(medium).toHaveLength(5);
    expect(long).toHaveLength(7);
    expect(medium[0]).toBeGreaterThan(0);
    expect(long[0]).toBeGreaterThan(0);
    expect(medium.at(-1)!).toBeLessThan(18_000 - 250);
    expect(long.at(-1)!).toBeLessThan(95_000 - 250);

    const mediumGaps = medium.slice(1).map((value, index) => value - medium[index]!);
    const longGaps = long.slice(1).map((value, index) => value - long[index]!);

    expect(Math.max(...mediumGaps) - Math.min(...mediumGaps)).toBeLessThanOrEqual(2);
    expect(Math.max(...longGaps) - Math.min(...longGaps)).toBeLessThanOrEqual(2);
  });
});
