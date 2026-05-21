export type MediaOrientation = number | null | undefined;

function normalizeDegrees(value: number) {
  return ((Math.round(value) % 360) + 360) % 360;
}

export function resolveMediaRotationDegrees(orientation: MediaOrientation) {
  if (typeof orientation !== 'number' || !Number.isFinite(orientation)) {
    return 0;
  }

  const rounded = Math.round(orientation);

  if (Math.abs(rounded) > 8) {
    const degrees = normalizeDegrees(rounded);
    return degrees === 90 || degrees === 180 || degrees === 270 ? degrees : 0;
  }

  switch (rounded) {
    case 3:
    case 4:
      return 180;
    case 5:
    case 6:
      return 90;
    case 7:
    case 8:
      return 270;
    default:
      return 0;
  }
}

export function isSidewaysMediaOrientation(orientation: MediaOrientation) {
  const rotation = resolveMediaRotationDegrees(orientation);
  return rotation === 90 || rotation === 270;
}

export function normalizeMediaDimensionsForOrientation(
  width: number,
  height: number,
  orientation: MediaOrientation,
) {
  if (!isSidewaysMediaOrientation(orientation)) {
    return { width, height };
  }

  return { width: height, height: width };
}
