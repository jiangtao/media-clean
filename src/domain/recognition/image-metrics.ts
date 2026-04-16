import type { VisualMetrics } from './types';

const clamp = (value: number, min = 0, max = 1) => Math.min(Math.max(value, min), max);

function getLuminanceAt(rgba: Uint8Array, width: number, x: number, y: number) {
  const offset = (y * width + x) * 4;
  return (rgba[offset] * 0.299 + rgba[offset + 1] * 0.587 + rgba[offset + 2] * 0.114) / 255;
}

export function calculateVisualMetricsFromRgba(
  rgba: Uint8Array,
  width: number,
  height: number,
): VisualMetrics {
  if (width <= 0 || height <= 0 || rgba.length < width * height * 4) {
    return {
      brightness: 0,
      contrast: 0,
      edgeDensity: 0,
    };
  }

  const pixelCount = width * height;
  const luminance = new Array<number>(pixelCount);

  let brightnessSum = 0;

  for (let index = 0; index < pixelCount; index += 1) {
    const offset = index * 4;
    const value =
      (rgba[offset] * 0.299 + rgba[offset + 1] * 0.587 + rgba[offset + 2] * 0.114) / 255;
    luminance[index] = value;
    brightnessSum += value;
  }

  const brightness = brightnessSum / pixelCount;

  let variance = 0;
  for (const value of luminance) {
    variance += (value - brightness) ** 2;
  }

  let edgeSum = 0;
  let edgeCount = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;

      if (x + 1 < width) {
        edgeSum += Math.abs(luminance[index] - luminance[index + 1]);
        edgeCount += 1;
      }

      if (y + 1 < height) {
        edgeSum += Math.abs(luminance[index] - luminance[index + width]);
        edgeCount += 1;
      }
    }
  }

  return {
    brightness: clamp(brightness),
    contrast: clamp(Math.sqrt(variance / pixelCount)),
    edgeDensity: edgeCount > 0 ? clamp(edgeSum / edgeCount) : 0,
  };
}

export function calculateAverageHashFromRgba(
  rgba: Uint8Array,
  width: number,
  height: number,
  gridSize = 8,
) {
  if (width <= 0 || height <= 0 || rgba.length < width * height * 4) {
    return null;
  }

  const luminance: number[] = [];

  for (let row = 0; row < gridSize; row += 1) {
    const sourceY = Math.min(
      height - 1,
      Math.floor(((row + 0.5) * height) / gridSize),
    );

    for (let column = 0; column < gridSize; column += 1) {
      const sourceX = Math.min(
        width - 1,
        Math.floor(((column + 0.5) * width) / gridSize),
      );
      luminance.push(getLuminanceAt(rgba, width, sourceX, sourceY));
    }
  }

  const average = luminance.reduce((sum, value) => sum + value, 0) / luminance.length;
  let hash = '';

  for (let index = 0; index < luminance.length; index += 4) {
    const nibble = luminance
      .slice(index, index + 4)
      .map((value) => (value >= average ? '1' : '0'))
      .join('');

    hash += Number.parseInt(nibble, 2).toString(16);
  }

  return hash;
}
