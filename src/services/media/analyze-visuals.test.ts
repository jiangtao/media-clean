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

  it('uses a compact sample set for short videos', () => {
    const result = buildVideoSampleTimes(4.8);

    expect(result).toHaveLength(3);
    expect(result[0]).toBe(0);
    expect(result[1]).toBeGreaterThan(result[0]!);
    expect(result[2]).toBeGreaterThan(result[1]!);
  });

  it('uses more samples for medium and long videos', () => {
    expect(buildVideoSampleTimes(18)).toHaveLength(5);
    expect(buildVideoSampleTimes(95)).toHaveLength(7);
  });
});
