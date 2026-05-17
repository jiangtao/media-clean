import React, { useEffect, useMemo, useRef } from 'react';
import * as ReactNative from 'react-native';
import { StyleSheet, View } from 'react-native';
import * as ReactNativeSvg from 'react-native-svg';

import { AppIcon, type AppIconName } from './AppIcon';

export type DesignIconName =
  | 'blurry-drop'
  | 'check'
  | 'duplicate-camera'
  | 'local-analysis'
  | 'media-play'
  | 'nav-photo'
  | 'nav-setting'
  | 'nav-trash'
  | 'scan'
  | 'shield-check-outline'
  | 'similar-people'
  | 'stack'
  | 'video';

interface DesignIconProps {
  name: DesignIconName;
  width: number;
  height: number;
  align?: 'start' | 'center';
  color?: string;
  secondaryColor?: string;
  testID?: string;
}

interface SvgProcessRingProps {
  size: number;
  progress: number;
  current?: number;
  total?: number;
  color?: string;
  trackColor?: string;
  strokeWidth?: number;
  children?: React.ReactNode;
  testID?: string;
}

export type DesignIconDimensions = {
  width: number;
  height: number;
  glyphWidth: number;
  glyphHeight: number;
  viewBox: string;
};

type IconPrimitiveProps = Pick<DesignIconDimensions, 'viewBox'> & {
  width: number;
  height: number;
  color: string;
  secondaryColor: string;
  testID?: string;
};

type SvgNativeModule = {
  default?: React.ComponentType<Record<string, unknown>>;
  Svg?: React.ComponentType<Record<string, unknown>>;
  Circle: React.ComponentType<Record<string, unknown>>;
  Path: React.ComponentType<Record<string, unknown>>;
  Rect: React.ComponentType<Record<string, unknown>>;
};

type SvgIconPrimitiveProps = IconPrimitiveProps & {
  svg: SvgNativeModule;
};

type DesignIconGlyphDimensions = Pick<DesignIconDimensions, 'width' | 'height' | 'viewBox'>;

export const DESIGN_ICON_DEFAULT_DIMENSIONS: Readonly<Record<DesignIconName, DesignIconGlyphDimensions>> = {
  'blurry-drop': { width: 20, height: 22, viewBox: '2 1 20 22' },
  check: { width: 16, height: 21, viewBox: '3.238 1 17.524 23' },
  'duplicate-camera': { width: 22, height: 18, viewBox: '1 3 22 18' },
  'local-analysis': { width: 20, height: 20, viewBox: '1 1 22 22' },
  'media-play': { width: 20, height: 16, viewBox: '2 4 20 16' },
  'nav-photo': { width: 20, height: 20, viewBox: '1 1 22 22' },
  'nav-setting': { width: 24, height: 24, viewBox: '0 0 24 24' },
  'nav-trash': { width: 18, height: 20, viewBox: '2.1 1 19.8 22' },
  scan: { width: 18, height: 18, viewBox: '2 2 20 20' },
  'shield-check-outline': { width: 18, height: 22, viewBox: '3 1 18 22' },
  'similar-people': { width: 22, height: 19, viewBox: '1 3 22 19' },
  stack: { width: 16, height: 16, viewBox: '3 3 18 18' },
  video: { width: 20, height: 18, viewBox: '0.889 2 22.222 20' },
};

function roundIconDimension(value: number) {
  return Math.round(value * 1000) / 1000;
}

function buildIconDimensions(
  defaults: DesignIconGlyphDimensions,
  slotWidth: number,
  slotHeight: number,
): DesignIconDimensions {
  const defaultRatio = defaults.width / defaults.height;
  const frameRatio = slotWidth / slotHeight;
  const fitted =
    frameRatio > defaultRatio
      ? { glyphWidth: roundIconDimension(slotHeight * defaultRatio), glyphHeight: slotHeight }
      : { glyphWidth: slotWidth, glyphHeight: roundIconDimension(slotWidth / defaultRatio) };

  return {
    width: slotWidth,
    height: slotHeight,
    ...fitted,
    viewBox: defaults.viewBox,
  };
}

export function resolveDesignIconDimensions(
  name: DesignIconName,
  {
    size,
    width,
    height,
  }: {
    size?: number;
    width?: number;
    height?: number;
  } = {},
): DesignIconDimensions {
  const defaults = DESIGN_ICON_DEFAULT_DIMENSIONS[name];
  const defaultRatio = defaults.width / defaults.height;

  if (width !== undefined && height !== undefined) {
    return buildIconDimensions(defaults, width, height);
  }

  if (width !== undefined) {
    return buildIconDimensions(defaults, width, roundIconDimension(width / defaultRatio));
  }

  if (height !== undefined) {
    return buildIconDimensions(defaults, roundIconDimension(height * defaultRatio), height);
  }

  if (size !== undefined) {
    const scale = size / Math.max(defaults.width, defaults.height);
    return buildIconDimensions(
      defaults,
      roundIconDimension(defaults.width * scale),
      roundIconDimension(defaults.height * scale),
    );
  }

  return buildIconDimensions(defaults, defaults.width, defaults.height);
}

function readReactNativeExport<T>(key: string): T | undefined {
  try {
    return (ReactNative as unknown as Record<string, T | undefined>)[key];
  } catch {
    return undefined;
  }
}

const AnimatedApi = readReactNativeExport<any>('Animated');
const EasingApi = readReactNativeExport<any>('Easing');

function getNativeSvgModule(): SvgNativeModule | null {
  const svg = ReactNativeSvg as unknown as SvgNativeModule;
  return svg.Circle && svg.Path && svg.Rect ? svg : null;
}

function resolveSvgRoot(svg: SvgNativeModule): React.ComponentType<Record<string, unknown>> {
  return (svg.default ?? svg.Svg) as React.ComponentType<Record<string, unknown>>;
}

export function DesignIcon({
  name,
  width,
  height,
  align = 'center',
  color = '#2563EB',
  secondaryColor = '#FFFFFF',
  testID,
}: DesignIconProps) {
  const svg = getNativeSvgModule();
  const dimensions = resolveDesignIconDimensions(name, { width, height });

  if (!svg) {
    return (
      <FallbackDesignIcon
        name={name}
        dimensions={dimensions}
        align={align}
        color={color}
        testID={testID}
      />
    );
  }

  switch (name) {
    case 'blurry-drop':
      return (
        <DesignIconFrame dimensions={dimensions} align={align} testID={testID}>
          <BlurryDropIcon svg={svg} {...toGlyphPrimitiveDimensions(dimensions)} color={color} secondaryColor={secondaryColor} />
        </DesignIconFrame>
      );
    case 'check':
      return (
        <DesignIconFrame dimensions={dimensions} align={align} testID={testID}>
          <CheckIcon svg={svg} {...toGlyphPrimitiveDimensions(dimensions)} color={color} secondaryColor={secondaryColor} />
        </DesignIconFrame>
      );
    case 'duplicate-camera':
      return (
        <DesignIconFrame dimensions={dimensions} align={align} testID={testID}>
          <DuplicateCameraIcon svg={svg} {...toGlyphPrimitiveDimensions(dimensions)} color={color} secondaryColor={secondaryColor} />
        </DesignIconFrame>
      );
    case 'local-analysis':
      return (
        <DesignIconFrame dimensions={dimensions} align={align} testID={testID}>
          <LocalAnalysisIcon svg={svg} {...toGlyphPrimitiveDimensions(dimensions)} color={color} secondaryColor={secondaryColor} />
        </DesignIconFrame>
      );
    case 'media-play':
      return (
        <DesignIconFrame dimensions={dimensions} align={align} testID={testID}>
          <MediaPlayIcon svg={svg} {...toGlyphPrimitiveDimensions(dimensions)} color={color} secondaryColor={secondaryColor} />
        </DesignIconFrame>
      );
    case 'nav-photo':
      return (
        <DesignIconFrame dimensions={dimensions} align={align} testID={testID}>
          <NavPhotoIcon svg={svg} {...toGlyphPrimitiveDimensions(dimensions)} color={color} secondaryColor={secondaryColor} />
        </DesignIconFrame>
      );
    case 'nav-setting':
      return (
        <DesignIconFrame dimensions={dimensions} align={align} testID={testID}>
          <NavSettingIcon svg={svg} {...toGlyphPrimitiveDimensions(dimensions)} color={color} secondaryColor={secondaryColor} />
        </DesignIconFrame>
      );
    case 'nav-trash':
      return (
        <DesignIconFrame dimensions={dimensions} align={align} testID={testID}>
          <NavTrashIcon svg={svg} {...toGlyphPrimitiveDimensions(dimensions)} color={color} secondaryColor={secondaryColor} />
        </DesignIconFrame>
      );
    case 'scan':
      return (
        <DesignIconFrame dimensions={dimensions} align={align} testID={testID}>
          <ScanIcon svg={svg} {...toGlyphPrimitiveDimensions(dimensions)} color={color} secondaryColor={secondaryColor} />
        </DesignIconFrame>
      );
    case 'shield-check-outline':
      return (
        <DesignIconFrame dimensions={dimensions} align={align} testID={testID}>
          <ShieldCheckOutlineIcon svg={svg} {...toGlyphPrimitiveDimensions(dimensions)} color={color} secondaryColor={secondaryColor} />
        </DesignIconFrame>
      );
    case 'similar-people':
      return (
        <DesignIconFrame dimensions={dimensions} align={align} testID={testID}>
          <SimilarPeopleIcon svg={svg} {...toGlyphPrimitiveDimensions(dimensions)} color={color} secondaryColor={secondaryColor} />
        </DesignIconFrame>
      );
    case 'stack':
      return (
        <DesignIconFrame dimensions={dimensions} align={align} testID={testID}>
          <StackIcon svg={svg} {...toGlyphPrimitiveDimensions(dimensions)} color={color} secondaryColor={secondaryColor} />
        </DesignIconFrame>
      );
    case 'video':
      return (
        <DesignIconFrame dimensions={dimensions} align={align} testID={testID}>
          <VideoIcon svg={svg} {...toGlyphPrimitiveDimensions(dimensions)} color={color} secondaryColor={secondaryColor} />
        </DesignIconFrame>
      );
    default:
      return null;
  }
}

export function SvgProcessRing({
  size,
  progress,
  color = '#2563EB',
  trackColor = '#EFF6FF',
  strokeWidth = 12,
  children,
  testID,
}: SvgProcessRingProps) {
  const clampedProgress = Math.min(Math.max(progress, 0), 100);
  const radius = 90;
  const circumference = 2 * Math.PI * radius;
  const animatedProgress = useRef(
    AnimatedApi?.Value ? new AnimatedApi.Value(clampedProgress) : null,
  ).current;

  useEffect(() => {
    if (!animatedProgress || !AnimatedApi?.timing) {
      return;
    }

    AnimatedApi.timing(animatedProgress, {
      toValue: clampedProgress,
      duration: 520,
      easing: EasingApi?.out && EasingApi?.cubic ? EasingApi.out(EasingApi.cubic) : undefined,
      useNativeDriver: false,
    }).start();
  }, [animatedProgress, clampedProgress]);

  const dashOffset = animatedProgress?.interpolate
    ? animatedProgress.interpolate({
        inputRange: [0, 100],
        outputRange: [circumference, 0],
      })
    : circumference * (1 - clampedProgress / 100);

  const ringStyle = useMemo(() => ({ width: size, height: size }), [size]);
  const svg = getNativeSvgModule();

  if (!svg) {
    const fallbackProgressOpacity = clampedProgress <= 0 ? 0 : Math.max(0.2, clampedProgress / 100);

    return (
      <View style={[styles.processRing, ringStyle]} testID={testID}>
        <View
          style={[
            styles.processFallbackRing,
            {
              borderColor: trackColor,
              borderWidth: strokeWidth,
            },
          ]}
        />
        <View
          style={[
            styles.processFallbackRing,
            {
              borderColor: color,
              borderWidth: strokeWidth,
              opacity: fallbackProgressOpacity,
            },
          ]}
        />
        <View style={styles.processRingCenter}>{children}</View>
      </View>
    );
  }

  const Svg = resolveSvgRoot(svg);
  const Circle = svg.Circle;
  const AnimatedCircle = AnimatedApi?.createAnimatedComponent
    ? AnimatedApi.createAnimatedComponent(Circle)
    : Circle;

  return (
    <View style={[styles.processRing, ringStyle]} testID={testID}>
      <Svg width={size} height={size} viewBox="0 0 200 200">
        <Circle
          cx="100"
          cy="100"
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx="100"
          cy="100"
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
          transform="rotate(-90 100 100)"
        />
      </Svg>
      <View style={styles.processRingCenter}>{children}</View>
    </View>
  );
}

function DesignIconFrame({
  dimensions,
  align,
  testID,
  children,
}: {
  dimensions: DesignIconDimensions;
  align: 'start' | 'center';
  testID?: string;
  children: React.ReactNode;
}) {
  return (
    <View
      style={[
        styles.iconFrame,
        align === 'start' ? styles.iconFrameStart : styles.iconFrameCenter,
        {
          width: dimensions.width,
          height: dimensions.height,
        },
      ]}
      testID={testID}
    >
      {children}
    </View>
  );
}

function toGlyphPrimitiveDimensions(
  dimensions: DesignIconDimensions,
): Pick<IconPrimitiveProps, 'width' | 'height' | 'viewBox'> {
  return {
    width: dimensions.glyphWidth,
    height: dimensions.glyphHeight,
    viewBox: dimensions.viewBox,
  };
}

function FallbackDesignIcon({
  name,
  dimensions,
  align,
  color,
  testID,
}: {
  name: DesignIconName;
  dimensions: DesignIconDimensions;
  align: 'start' | 'center';
  color: string;
  testID?: string;
}) {
  const fallbackName = resolveFallbackIoniconName(name);
  const iconSize = Math.min(dimensions.glyphWidth, dimensions.glyphHeight);

  return (
    <View
      style={[
        styles.iconFrame,
        align === 'start' ? styles.iconFrameStart : styles.iconFrameCenter,
        { width: dimensions.width, height: dimensions.height },
      ]}
      testID={testID}
    >
      <AppIcon name={fallbackName} size={iconSize} color={color} />
    </View>
  );
}

function resolveFallbackIoniconName(name: DesignIconName): AppIconName {
  switch (name) {
    case 'blurry-drop':
      return 'image-outline';
    case 'check':
      return 'checkmark-circle-outline';
    case 'duplicate-camera':
      return 'image-outline';
    case 'local-analysis':
      return 'apps-outline';
    case 'media-play':
      return 'videocam-outline';
    case 'nav-photo':
      return 'image-outline';
    case 'nav-setting':
      return 'apps-outline';
    case 'nav-trash':
      return 'trash-outline';
    case 'scan':
      return 'apps-outline';
    case 'shield-check-outline':
      return 'checkmark-circle-outline';
    case 'similar-people':
      return 'apps-outline';
    case 'stack':
      return 'apps-outline';
    case 'video':
      return 'videocam-outline';
  }
}

function BlurryDropIcon({ svg, width, height, viewBox, color, secondaryColor, testID }: SvgIconPrimitiveProps) {
  const Svg = resolveSvgRoot(svg);
  const Path = svg.Path;
  return (
    <Svg width={width} height={height} viewBox={viewBox} fill="none" testID={testID}>
      <Path
        d="M12 2C8.4 6.4 5 10.7 5 15C5 19.4 8.1 22 12 22C15.9 22 19 19.4 19 15C19 10.7 15.6 6.4 12 2Z"
        fill={color}
      />
      <Path
        d="M9 15.3C9.2 17.1 10.4 18.3 12.1 18.6"
        stroke={secondaryColor}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </Svg>
  );
}

function CheckIcon({ svg, width, height, viewBox, color, secondaryColor, testID }: SvgIconPrimitiveProps) {
  const Svg = resolveSvgRoot(svg);
  const Path = svg.Path;
  return (
    <Svg width={width} height={height} viewBox={viewBox} fill="none" overflow="visible" testID={testID}>
      <Path d="M12 2L4 5V11C4 16.5 7.5 21.5 12 23C16.5 21.5 20 16.5 20 11V5L12 2Z" fill={color} />
      <Path
        d="M8 12L11 15L16 9"
        stroke={secondaryColor}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function DuplicateCameraIcon({ svg, width, height, viewBox, color, secondaryColor, testID }: SvgIconPrimitiveProps) {
  const Svg = resolveSvgRoot(svg);
  const Circle = svg.Circle;
  const Path = svg.Path;
  const Rect = svg.Rect;
  return (
    <Svg width={width} height={height} viewBox={viewBox} fill="none" testID={testID}>
      <Path d="M8 5L9.6 3H14.4L16 5H19C20.7 5 22 6.3 22 8V18C22 19.7 20.7 21 19 21H5C3.3 21 2 19.7 2 18V8C2 6.3 3.3 5 5 5H8Z" fill={color} />
      <Circle cx="12" cy="13" r="4" fill={secondaryColor} />
      <Circle cx="12" cy="13" r="2.2" fill={color} />
      <Rect x="17" y="7.5" width="2" height="1.6" rx="0.8" fill={secondaryColor} opacity="0.9" />
    </Svg>
  );
}

function LocalAnalysisIcon({ svg, width, height, viewBox, color, secondaryColor, testID }: SvgIconPrimitiveProps) {
  const Svg = resolveSvgRoot(svg);
  const Circle = svg.Circle;
  const Path = svg.Path;
  return (
    <Svg width={width} height={height} viewBox={viewBox} fill="none" testID={testID}>
      <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2" />
      <Path
        d="M12 3V12H21"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M12 12L18.5 18.2"
        stroke={secondaryColor}
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.65"
      />
    </Svg>
  );
}

function MediaPlayIcon({ svg, width, height, viewBox, color, testID }: SvgIconPrimitiveProps) {
  const Svg = resolveSvgRoot(svg);
  const Path = svg.Path;
  const Rect = svg.Rect;
  return (
    <Svg width={width} height={height} viewBox={viewBox} fill="none" testID={testID}>
      <Rect x="3" y="5" width="18" height="14" rx="2.8" stroke={color} strokeWidth="2" />
      <Path d="M10 9.2V14.8L15 12L10 9.2Z" fill={color} />
    </Svg>
  );
}

function NavPhotoIcon({ svg, width, height, viewBox, color, secondaryColor, testID }: SvgIconPrimitiveProps) {
  const Svg = resolveSvgRoot(svg);
  const Circle = svg.Circle;
  const Path = svg.Path;
  const Rect = svg.Rect;
  return (
    <Svg width={width} height={height} viewBox={viewBox} fill="none" overflow="visible" testID={testID}>
      <Rect x="2" y="2" width="20" height="20" rx="5" fill={color} />
      <Path d="M19 17L15 12L12 16L9 12L5 17H19Z" fill={secondaryColor} />
      <Circle cx="8" cy="8" r="1.5" fill={secondaryColor} />
    </Svg>
  );
}

function NavSettingIcon({ svg, width, height, viewBox, color, testID }: SvgIconPrimitiveProps) {
  const Svg = resolveSvgRoot(svg);
  const Path = svg.Path;
  return (
    <Svg width={width} height={height} viewBox={viewBox} fill="none" overflow="visible" testID={testID}>
      <Path d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z" stroke={color} strokeWidth="2" />
      <Path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.604.736 1.08 1.34 1.34H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function NavTrashIcon({ svg, width, height, viewBox, color, testID }: SvgIconPrimitiveProps) {
  const Svg = resolveSvgRoot(svg);
  const Path = svg.Path;
  return (
    <Svg width={width} height={height} viewBox={viewBox} fill="none" overflow="visible" testID={testID}>
      <Path d="M4 7H20" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Path d="M6 7V19C6 20.1 6.9 21 8 21H16C17.1 21 18 20.1 18 19V7" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Path d="M9 7V4C9 3.4 9.4 3 10 3H14C14.6 3 15 3.4 15 4V7" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Path d="M10 11V17" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Path d="M14 11V17" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

function ScanIcon({ svg, width, height, viewBox, color, testID }: SvgIconPrimitiveProps) {
  const Svg = resolveSvgRoot(svg);
  const Circle = svg.Circle;
  const Path = svg.Path;
  return (
    <Svg width={width} height={height} viewBox={viewBox} fill="none" overflow="visible" testID={testID}>
      <Path d="M4 8V4H8" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Path d="M16 4H20V8" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Path d="M20 16V20H16" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Path d="M8 20H4V16" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth="2" />
      <Path d="M14.5 14.5L17 17" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

function ShieldCheckOutlineIcon({ svg, width, height, viewBox, color, testID }: SvgIconPrimitiveProps) {
  const Svg = resolveSvgRoot(svg);
  const Path = svg.Path;
  return (
    <Svg width={width} height={height} viewBox={viewBox} fill="none" testID={testID}>
      <Path
        d="M12 2L5 4.9V11.1C5 16.1 8 20.5 12 22C16 20.5 19 16.1 19 11.1V4.9L12 2Z"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <Path
        d="M8.5 12L11 14.5L15.8 9.6"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function SimilarPeopleIcon({ svg, width, height, viewBox, color, testID }: SvgIconPrimitiveProps) {
  const Svg = resolveSvgRoot(svg);
  const Circle = svg.Circle;
  const Path = svg.Path;
  return (
    <Svg width={width} height={height} viewBox={viewBox} fill="none" testID={testID}>
      <Circle cx="8" cy="8" r="4" fill={color} />
      <Circle cx="16" cy="8" r="4" fill={color} opacity="0.92" />
      <Path d="M2.5 21C3 16.9 5.2 14.5 8.6 14.5C11.8 14.5 13.8 17 14.2 21H2.5Z" fill={color} />
      <Path d="M10 21C10.4 17 12.6 14.5 16 14.5C19.2 14.5 21.3 17 21.5 21H10Z" fill={color} opacity="0.92" />
    </Svg>
  );
}

function StackIcon({ svg, width, height, viewBox, color, secondaryColor, testID }: SvgIconPrimitiveProps) {
  const Svg = resolveSvgRoot(svg);
  const Path = svg.Path;
  const Rect = svg.Rect;
  return (
    <Svg width={width} height={height} viewBox={viewBox} fill="none" overflow="visible" testID={testID}>
      <Rect x="6" y="4" width="14" height="14" rx="2" fill={secondaryColor} />
      <Rect x="4" y="6" width="14" height="14" rx="2" fill={color} />
      <Path d="M8 16L11 11L14 16H8Z" fill="#FFFFFF" opacity="0.8" />
      <Path d="M13 16L15.5 12L18 16H13Z" fill="#FFFFFF" opacity="0.8" />
    </Svg>
  );
}

function VideoIcon({ svg, width, height, viewBox, color, testID }: SvgIconPrimitiveProps) {
  const Svg = resolveSvgRoot(svg);
  const Path = svg.Path;
  return (
    <Svg width={width} height={height} viewBox={viewBox} fill="none" overflow="visible" testID={testID}>
      <Path
        d="M2 6C2 4.34315 3.34315 3 5 3H14C15.6569 3 17 4.34315 17 6V8.5L21 7.5C21.6667 7.33333 22 7.83333 22 8.5V15.5C22 16.1667 21.6667 16.6667 21 16.5L17 15.5V18C17 19.6569 15.6569 21 14 21H5C3.34315 21 2 19.6569 2 18V6Z M8 9L13 12L8 15V9Z"
        fill={color}
        fillRule="evenodd"
        clipRule="evenodd"
      />
    </Svg>
  );
}

const styles = StyleSheet.create({
  iconFrame: {
    justifyContent: 'center',
    overflow: 'visible',
  },
  iconFrameStart: {
    alignItems: 'flex-start',
  },
  iconFrameCenter: {
    alignItems: 'center',
  },
  processRing: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  processFallbackRing: {
    position: 'absolute',
    inset: 0,
    borderRadius: 999,
  },
  processRingCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
