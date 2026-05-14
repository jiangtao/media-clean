import React from 'react';
import { View } from 'react-native';
import * as ReactNativeSvg from 'react-native-svg';

export type AppIconName =
  | 'apps-outline'
  | 'arrow-back'
  | 'checkmark'
  | 'checkmark-circle-outline'
  | 'chevron-back'
  | 'chevron-forward'
  | 'close'
  | 'image-outline'
  | 'trash-bin-outline'
  | 'trash-outline'
  | 'videocam-outline';

interface AppIconProps {
  name: AppIconName;
  size: number;
  color: string;
  testID?: string;
}

type SvgNativeModule = {
  default?: React.ComponentType<Record<string, unknown>>;
  Svg?: React.ComponentType<Record<string, unknown>>;
  Circle: React.ComponentType<Record<string, unknown>>;
  Path: React.ComponentType<Record<string, unknown>>;
  Rect: React.ComponentType<Record<string, unknown>>;
};

function getNativeSvgModule(): SvgNativeModule | null {
  const svg = ReactNativeSvg as unknown as SvgNativeModule;
  return svg.Circle && svg.Path && svg.Rect ? svg : null;
}

function resolveSvgRoot(svg: SvgNativeModule): React.ComponentType<Record<string, unknown>> {
  return (svg.default ?? svg.Svg) as React.ComponentType<Record<string, unknown>>;
}

export function AppIcon({ name, size, color, testID }: AppIconProps) {
  const svg = getNativeSvgModule();

  if (!svg) {
    return <View style={{ width: size, height: size }} testID={testID} />;
  }

  const Svg = resolveSvgRoot(svg);
  const Path = svg.Path;
  const Circle = svg.Circle;
  const Rect = svg.Rect;

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" testID={testID}>
      {renderIconPath(name, { Path, Circle, Rect, color })}
    </Svg>
  );
}

function renderIconPath(
  name: AppIconName,
  {
    Path,
    Circle,
    Rect,
    color,
  }: Pick<SvgNativeModule, 'Path' | 'Circle' | 'Rect'> & { color: string },
) {
  switch (name) {
    case 'apps-outline':
      return (
        <>
          {[3, 10, 17].map((x) =>
            [3, 10, 17].map((y) => (
              <Rect
                key={`${x}-${y}`}
                x={x}
                y={y}
                width={4}
                height={4}
                rx={1}
                stroke={color}
                strokeWidth={1.8}
              />
            )),
          )}
        </>
      );
    case 'arrow-back':
      return (
        <Path
          d="M19 12H6M12 5L5 12L12 19"
          stroke={color}
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
    case 'checkmark':
      return (
        <Path
          d="M5 12.5L10 17.5L19 6.5"
          stroke={color}
          strokeWidth={2.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
    case 'checkmark-circle-outline':
      return (
        <>
          <Circle cx={12} cy={12} r={8.5} stroke={color} strokeWidth={2} />
          <Path
            d="M8 12.2L11 15.2L16.5 8.8"
            stroke={color}
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      );
    case 'chevron-back':
      return (
        <Path
          d="M15 5L8 12L15 19"
          stroke={color}
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
    case 'chevron-forward':
      return (
        <Path
          d="M9 5L16 12L9 19"
          stroke={color}
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
    case 'close':
      return (
        <Path
          d="M6 6L18 18M18 6L6 18"
          stroke={color}
          strokeWidth={2.3}
          strokeLinecap="round"
        />
      );
    case 'image-outline':
      return (
        <>
          <Rect x={4} y={5} width={16} height={14} rx={2} stroke={color} strokeWidth={2} />
          <Circle cx={9} cy={10} r={1.6} fill={color} />
          <Path
            d="M5.5 17L10 12.5L13.2 15.5L15.2 13.4L19 17"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      );
    case 'trash-bin-outline':
    case 'trash-outline':
      return (
        <>
          <Path d="M8 7V5.5C8 4.7 8.7 4 9.5 4H14.5C15.3 4 16 4.7 16 5.5V7" stroke={color} strokeWidth={2} strokeLinecap="round" />
          <Path d="M5 7H19" stroke={color} strokeWidth={2} strokeLinecap="round" />
          <Path d="M8 10V18M12 10V18M16 10V18" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
          <Path d="M7 7L8 20H16L17 7" stroke={color} strokeWidth={2} strokeLinejoin="round" />
        </>
      );
    case 'videocam-outline':
      return (
        <>
          <Rect x={4} y={7} width={11} height={10} rx={2} stroke={color} strokeWidth={2} />
          <Path
            d="M15 10L20 7.5V16.5L15 14"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      );
  }
}
