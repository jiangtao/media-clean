import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock react-native-safe-area-context
const mockInsets = {
  top: 24,
  left: 0,
  right: 0,
  bottom: 0,
};

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => mockInsets,
}));

// Mock react-native
// useWindowDimensions returns dp (density-independent pixels)
const mockDimensions = {
  width: 393,  // ~1080px / 2.75 scale
  height: 873, // ~2400px / 2.75 scale
  scale: 2.75,
  fontScale: 1,
};

vi.mock('react-native', () => ({
  useWindowDimensions: () => mockDimensions,
}));

// Import and mock React's useMemo to work outside component context
vi.mock('react', async () => {
  const actual = await vi.importActual('react');
  return {
    ...actual,
    useMemo: (fn: () => unknown) => fn(),
  };
});

import {
  useScreenType,
  useScreenTypeOnly,
  useCutoutInfo,
  useFoldableInfo,
} from './use-screen-type';

describe('useScreenType', () => {
  beforeEach(() => {
    // Reset mocks to default values (dp values)
    mockInsets.top = 24;  // Standard status bar
    mockInsets.left = 0;
    mockInsets.right = 0;
    mockInsets.bottom = 0;
    mockDimensions.width = 393;
    mockDimensions.height = 873;
  });

  it('returns screen info for standard screen', () => {
    const result = useScreenType();

    expect(result.type).toBe('standard');
    expect(result.isLandscape).toBe(false);
    expect(result.isTablet).toBe(false);
    expect(result.isFoldable).toBe(false);
    expect(result.hasNotch).toBe(false);
    expect(result.hasHolePunch).toBe(false);
    expect(result.hasCutout).toBe(false);
    expect(result.isCurved).toBe(false);
    expect(result.cutoutHeight).toBe(0);
  });

  it('returns notch screen when top inset is in notch range', () => {
    mockInsets.top = 33; // 32-34 range = notch
    const result = useScreenType();

    expect(result.type).toBe('notch');
    expect(result.hasNotch).toBe(true);
    expect(result.hasCutout).toBe(true);
    expect(result.cutoutHeight).toBe(9);
  });

  it('returns hole-punch screen for small top inset increase', () => {
    mockInsets.top = 26; // 24-27 range = hole punch
    const result = useScreenType();

    expect(result.type).toBe('hole-punch');
    expect(result.hasHolePunch).toBe(true);
    expect(result.hasCutout).toBe(true);
  });

  it('returns tablet for large screens', () => {
    mockDimensions.width = 600;
    mockDimensions.height = 960;
    const result = useScreenType();

    expect(result.type).toBe('tablet');
    expect(result.isTablet).toBe(true);
  });

  it('returns foldable-cover for narrow screen', () => {
    mockDimensions.width = 329; // Z Fold 5 cover width in dp
    mockDimensions.height = 843;
    const result = useScreenType();

    expect(result.type).toBe('foldable-cover');
    expect(result.isFoldable).toBe(true);
  });

  it('returns foldable-inner for square screen', () => {
    mockDimensions.width = 660; // Z Fold 5 inner width in dp
    mockDimensions.height = 792;
    const result = useScreenType();

    expect(result.type).toBe('foldable-inner');
    expect(result.isFoldable).toBe(true);
  });

  it('returns correct dimensions in response', () => {
    mockDimensions.width = 1440;
    mockDimensions.height = 3200;
    mockDimensions.scale = 3.5;
    mockDimensions.fontScale = 1.2;

    const result = useScreenType();

    expect(result.dimensions.width).toBe(1440);
    expect(result.dimensions.height).toBe(3200);
    expect(result.dimensions.scale).toBe(3.5);
    expect(result.dimensions.fontScale).toBe(1.2);
  });

  it('returns correct insets in response', () => {
    mockInsets.top = 35;
    mockInsets.left = 8;
    mockInsets.right = 8;
    mockInsets.bottom = 24;

    const result = useScreenType();

    expect(result.insets.top).toBe(35);
    expect(result.insets.left).toBe(8);
    expect(result.insets.right).toBe(8);
    expect(result.insets.bottom).toBe(24);
  });
});

describe('useScreenTypeOnly', () => {
  beforeEach(() => {
    mockInsets.top = 24;
    mockInsets.left = 0;
    mockInsets.right = 0;
    mockDimensions.width = 393;
    mockDimensions.height = 873;
  });

  it('returns screen type string', () => {
    const type = useScreenTypeOnly();
    expect(type).toBe('standard');
  });

  it('returns correct type when screen changes', () => {
    mockInsets.top = 33; // Notch range
    const type = useScreenTypeOnly();
    expect(type).toBe('notch');
  });
});

describe('useCutoutInfo', () => {
  beforeEach(() => {
    mockInsets.top = 24;
    mockInsets.left = 0;
    mockInsets.right = 0;
    mockDimensions.width = 393;
    mockDimensions.height = 873;
  });

  it('returns no cutout for standard screen', () => {
    const info = useCutoutInfo();
    expect(info.hasCutout).toBe(false);
    expect(info.cutoutHeight).toBe(0);
    expect(info.hasNotch).toBe(false);
    expect(info.hasHolePunch).toBe(false);
  });

  it('returns cutout info for notch screen', () => {
    mockInsets.top = 33; // Notch range
    const info = useCutoutInfo();
    expect(info.hasCutout).toBe(true);
    expect(info.cutoutHeight).toBe(9);
    expect(info.hasNotch).toBe(true);
    expect(info.hasHolePunch).toBe(false);
  });

  it('returns cutout info for hole punch screen', () => {
    mockInsets.top = 26; // Hole punch range
    const info = useCutoutInfo();
    expect(info.hasCutout).toBe(true);
    expect(info.cutoutHeight).toBe(2);
    expect(info.hasNotch).toBe(false);
    expect(info.hasHolePunch).toBe(true);
  });
});

describe('useFoldableInfo', () => {
  beforeEach(() => {
    mockInsets.top = 24;
    mockInsets.left = 0;
    mockInsets.right = 0;
    mockDimensions.width = 393;
    mockDimensions.height = 873;
  });

  it('returns null for non-foldable screen', () => {
    const info = useFoldableInfo();
    expect(info).toBeNull();
  });

  it('returns foldable info for cover screen', () => {
    mockDimensions.width = 329;
    mockDimensions.height = 843;
    const info = useFoldableInfo();

    expect(info).not.toBeNull();
    expect(info?.type).toBe('foldable-cover');
    expect(info?.isCoverScreen).toBe(true);
    expect(info?.isInnerScreen).toBe(false);
  });

  it('returns foldable info for inner screen', () => {
    mockDimensions.width = 660;
    mockDimensions.height = 792;
    const info = useFoldableInfo();

    expect(info).not.toBeNull();
    expect(info?.type).toBe('foldable-inner');
    expect(info?.isCoverScreen).toBe(false);
    expect(info?.isInnerScreen).toBe(true);
  });
});
