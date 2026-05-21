import { beforeEach, describe, expect, it, vi } from 'vitest';

const fileSystemApi = vi.hoisted(() => ({
  deleteAsync: vi.fn(),
}));

const imageManipulatorApi = vi.hoisted(() => ({
  manipulateAsync: vi.fn(),
}));

const videoThumbnailsApi = vi.hoisted(() => ({
  getThumbnailAsync: vi.fn(),
}));

const jpegApi = vi.hoisted(() => ({
  decode: vi.fn(() => ({
    data: new Uint8ClampedArray(48 * 48 * 4),
    width: 48,
    height: 48,
  })),
}));

vi.mock('expo-file-system/src/legacy', () => fileSystemApi);

vi.mock('expo-image-manipulator', () => ({
  manipulateAsync: imageManipulatorApi.manipulateAsync,
  SaveFormat: {
    JPEG: 'jpeg',
  },
}));

vi.mock('expo-video-thumbnails', () => ({
  getThumbnailAsync: videoThumbnailsApi.getThumbnailAsync,
}));

vi.mock('jpeg-js', () => jpegApi);

import { analyzeVisualsForAsset, buildVideoSampleTimes } from './analyze-visuals';

const ONE_PIXEL_JPEG_BASE64 = Buffer.from('fake-jpeg').toString('base64');

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

describe('analyzeVisualsForAsset', () => {
  beforeEach(() => {
    fileSystemApi.deleteAsync.mockReset();
    imageManipulatorApi.manipulateAsync.mockReset();
    videoThumbnailsApi.getThumbnailAsync.mockReset();
    jpegApi.decode.mockClear();
  });

  it('returns the original photo URI and deletes the generated reduced analysis image', async () => {
    imageManipulatorApi.manipulateAsync.mockResolvedValueOnce({
      uri: 'file:///cache/ImageManipulator/photo-reduced.jpg',
      base64: ONE_PIXEL_JPEG_BASE64,
    });

    const result = await analyzeVisualsForAsset('file:///media/original-photo.jpg', 'photo');

    expect(result.previewUri).toBe('file:///media/original-photo.jpg');
    expect(fileSystemApi.deleteAsync).toHaveBeenCalledWith(
      'file:///cache/ImageManipulator/photo-reduced.jpg',
      { idempotent: true },
    );
  });

  it('returns the original video URI and deletes generated frame thumbnails and reduced images', async () => {
    videoThumbnailsApi.getThumbnailAsync
      .mockResolvedValueOnce({ uri: 'file:///cache/VideoThumbnails/frame-1.jpg' })
      .mockResolvedValueOnce({ uri: 'file:///cache/VideoThumbnails/frame-2.jpg' })
      .mockResolvedValueOnce({ uri: 'file:///cache/VideoThumbnails/frame-3.jpg' });
    imageManipulatorApi.manipulateAsync.mockImplementation(async (sourceUri: string) => ({
      uri: `${sourceUri}.reduced.jpg`,
      base64: ONE_PIXEL_JPEG_BASE64,
    }));

    const result = await analyzeVisualsForAsset('file:///media/original-video.mp4', 'video', 4.8);

    expect(result.previewUri).toBe('file:///media/original-video.mp4');
    expect(fileSystemApi.deleteAsync).toHaveBeenCalledWith(
      'file:///cache/VideoThumbnails/frame-1.jpg.reduced.jpg',
      { idempotent: true },
    );
    expect(fileSystemApi.deleteAsync).toHaveBeenCalledWith(
      'file:///cache/VideoThumbnails/frame-1.jpg',
      { idempotent: true },
    );
    expect(fileSystemApi.deleteAsync).toHaveBeenCalledWith(
      'file:///cache/VideoThumbnails/frame-3.jpg.reduced.jpg',
      { idempotent: true },
    );
    expect(fileSystemApi.deleteAsync).toHaveBeenCalledWith(
      'file:///cache/VideoThumbnails/frame-3.jpg',
      { idempotent: true },
    );
  });
});
