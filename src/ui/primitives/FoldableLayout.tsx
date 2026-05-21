import React, { useMemo } from 'react';
import {
  View,
  StyleSheet,
  type ViewStyle,
  type StyleProp,
  type FlexStyle,
} from 'react-native';
import {
  useFoldableState,
  type FoldableInfo,
  type LayoutMode,
  getHingeSafeAreaInsets,
} from '../../features/compatibility/use-foldable-state';
import { useOrientation, getOrientationStyles } from '../../features/compatibility/use-orientation';

/**
 * Layout configuration for different screen states
 */
export interface FoldableLayoutConfig {
  /** Layout for narrow/cover screen (e.g., Z Flip cover, Z Fold outer) */
  narrow: ViewStyle;
  /** Layout for wide screen (e.g., phones, Z Fold outer in landscape) */
  wide: ViewStyle;
  /** Layout for tablet/inner screen (e.g., Z Fold unfolded) */
  tablet: ViewStyle;
}

/**
 * Hinge handling mode
 */
export type HingeMode = 'avoid' | 'split' | 'ignore';

/**
 * Props for FoldableLayout component
 */
export interface FoldableLayoutProps {
  /** Child elements */
  children: React.ReactNode;
  /** Layout configuration for different screen modes */
  layoutConfig?: Partial<FoldableLayoutConfig>;
  /** How to handle the hinge area */
  hingeMode?: HingeMode;
  /** Additional container style */
  style?: StyleProp<ViewStyle>;
  /** Content container style */
  contentStyle?: StyleProp<ViewStyle>;
  /** Whether to use dual-pane layout when unfolded */
  dualPane?: boolean;
  /** Left/top pane content (for dual-pane mode) */
  pane1?: React.ReactNode;
  /** Right/bottom pane content (for dual-pane mode) */
  pane2?: React.ReactNode;
  /** Pane split ratio (0.0 - 1.0), default 0.5 */
  splitRatio?: number;
  /** Test ID for testing */
  testID?: string;
}

/**
 * Default layout configurations
 */
const DEFAULT_LAYOUTS: FoldableLayoutConfig = {
  narrow: {
    padding: 12,
    gap: 12,
  },
  wide: {
    padding: 18,
    gap: 18,
    maxWidth: 800,
    alignSelf: 'center',
    width: '100%',
  },
  tablet: {
    padding: 24,
    gap: 24,
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },
};

/**
 * Get effective layout style based on current foldable state
 * @internal Exported for testing
 */
export function getEffectiveLayoutStyle(
  layoutMode: LayoutMode,
  layoutConfig: Partial<FoldableLayoutConfig>,
  isLandscape: boolean
): ViewStyle {
  const baseStyle = DEFAULT_LAYOUTS[layoutMode];
  const customStyle = layoutConfig[layoutMode] || {};

  // Adjust for landscape on wide screens
  if (isLandscape && layoutMode === 'wide') {
    return {
      ...baseStyle,
      ...customStyle,
      paddingHorizontal: Math.max((customStyle.padding as number) || 24, 24),
    };
  }

  return { ...baseStyle, ...customStyle };
}

/**
 * Calculate hinge-aware split layout
 * @internal Exported for testing
 */
export function calculateSplitLayout(
  foldableInfo: FoldableInfo,
  splitRatio: number,
  isLandscape: boolean
): { pane1: ViewStyle; pane2: ViewStyle; hingeGap: number } {
  if (!foldableInfo.isFoldable || !foldableInfo.hingeArea.shouldAvoid) {
    // Standard split without hinge consideration
    return {
      pane1: { flex: splitRatio },
      pane2: { flex: 1 - splitRatio },
      hingeGap: 0,
    };
  }

  const { orientation, safeArea } = foldableInfo.hingeArea;
  // Calculate hinge gap based on orientation, regardless of landscape mode
  const hingeGap = orientation === 'horizontal'
    ? safeArea.bottom - safeArea.top
    : safeArea.right - safeArea.left;

  return {
    pane1: { flex: splitRatio },
    pane2: { flex: 1 - splitRatio },
    hingeGap,
  };
}

/**
 * FoldableLayout - Adaptive primitive layout component for foldable devices
 *
 * Features:
 * - Automatically adapts layout based on fold state
 * - Handles hinge area avoidance
 * - Supports dual-pane layouts for unfolded state
 * - Works with both foldable and non-foldable devices
 *
 * @example
 * ```tsx
 * // Basic usage
 * <FoldableLayout>
 *   <YourContent />
 * </FoldableLayout>
 *
 * // Dual-pane layout
 * <FoldableLayout
 *   dualPane
 *   pane1={<ListView />}
 *   pane2={<DetailView />}
 *   splitRatio={0.4}
 * />
 *
 * // Custom layouts
 * <FoldableLayout
 *   layoutConfig={{
 *     narrow: { padding: 8 },
 *     wide: { padding: 16, maxWidth: 600 },
 *     tablet: { padding: 32, maxWidth: 1000 },
 *   }}
 *   hingeMode="avoid"
 * >
 *   <Content />
 * </FoldableLayout>
 * ```
 */
export function FoldableLayout({
  children,
  layoutConfig = {},
  hingeMode = 'avoid',
  style,
  contentStyle,
  dualPane = false,
  pane1,
  pane2,
  splitRatio = 0.5,
  testID,
}: FoldableLayoutProps): React.ReactElement {
  const foldableInfo = useFoldableState();
  const { isLandscape } = useOrientation();

  const styles = useMemo(() => {
    const layoutStyle = getEffectiveLayoutStyle(
      foldableInfo.layoutMode,
      layoutConfig,
      isLandscape
    );

    const hingeInsets = hingeMode === 'avoid'
      ? getHingeSafeAreaInsets(foldableInfo)
      : { paddingTop: 0, paddingBottom: 0, paddingLeft: 0, paddingRight: 0 };

    const containerStyle: ViewStyle = {
      flex: 1,
      ...layoutStyle,
      paddingTop: (layoutStyle.padding as number) + hingeInsets.paddingTop,
      paddingBottom: (layoutStyle.padding as number) + hingeInsets.paddingBottom,
      paddingLeft: (layoutStyle.padding as number) + hingeInsets.paddingLeft,
      paddingRight: (layoutStyle.padding as number) + hingeInsets.paddingRight,
    };

    return StyleSheet.create({
      container: containerStyle,
      content: {
        flex: 1,
        ...(dualPane ? getOrientationStyles(isLandscape) : {}),
      } as ViewStyle,
      paneContainer: {
        flex: 1,
        flexDirection: isLandscape ? 'row' : 'column',
      } as ViewStyle,
      singlePane: {
        flex: 1,
      },
      hingeSpacer: {
        backgroundColor: 'transparent',
      },
    });
  }, [foldableInfo, layoutConfig, hingeMode, isLandscape, dualPane]);

  // Render dual-pane layout
  if (dualPane && pane1 && pane2) {
    const { pane1: pane1Style, pane2: pane2Style, hingeGap } = calculateSplitLayout(
      foldableInfo,
      splitRatio,
      isLandscape
    );

    const hingeSpacerStyle = isLandscape
      ? { width: hingeGap }
      : { height: hingeGap };

    return (
      <View style={[styles.container, style]} testID={testID}>
        <View style={[styles.paneContainer, contentStyle]}>
          <View style={[styles.singlePane, pane1Style]}>{pane1}</View>
          {hingeGap > 0 && hingeMode === 'split' && (
            <View style={[styles.hingeSpacer, hingeSpacerStyle]} />
          )}
          <View style={[styles.singlePane, pane2Style]}>{pane2}</View>
        </View>
      </View>
    );
  }

  // Render single-pane layout
  return (
    <View style={[styles.container, style]} testID={testID}>
      <View style={[styles.content, contentStyle]}>
        {children}
      </View>
    </View>
  );
}

/**
 * Hook to get foldable-aware layout props
 * Useful when you need direct access to layout calculations
 *
 * @example
 * ```tsx
 * const { layoutStyle, isDualPane } = useFoldableLayout({
 *   layoutConfig: { tablet: { padding: 32 } }
 * });
 *
 * return <ScrollView contentContainerStyle={layoutStyle} />;
 * ```
 */
export interface UseFoldableLayoutOptions {
  layoutConfig?: Partial<FoldableLayoutConfig>;
  hingeMode?: HingeMode;
}

export interface UseFoldableLayoutResult {
  /** Calculated layout style */
  layoutStyle: ViewStyle;
  /** Current layout mode */
  layoutMode: LayoutMode;
  /** Whether device supports dual-pane */
  supportsDualPane: boolean;
  /** Whether currently in dual-pane mode */
  isDualPane: boolean;
  /** Hinge area insets */
  hingeInsets: ReturnType<typeof getHingeSafeAreaInsets>;
  /** Is foldable device */
  isFoldable: boolean;
}

export function useFoldableLayout(
  options: UseFoldableLayoutOptions = {}
): UseFoldableLayoutResult {
  const { layoutConfig = {}, hingeMode = 'avoid' } = options;
  const foldableInfo = useFoldableState();
  const { isLandscape } = useOrientation();

  const result = useMemo((): UseFoldableLayoutResult => {
    const layoutStyle = getEffectiveLayoutStyle(
      foldableInfo.layoutMode,
      layoutConfig,
      isLandscape
    );

    const hingeInsets = hingeMode === 'avoid'
      ? getHingeSafeAreaInsets(foldableInfo)
      : { paddingTop: 0, paddingBottom: 0, paddingLeft: 0, paddingRight: 0 };

    const finalStyle: ViewStyle = {
      ...layoutStyle,
      paddingTop: ((layoutStyle.padding as number) || 0) + hingeInsets.paddingTop,
      paddingBottom: ((layoutStyle.padding as number) || 0) + hingeInsets.paddingBottom,
      paddingLeft: ((layoutStyle.padding as number) || 0) + hingeInsets.paddingLeft,
      paddingRight: ((layoutStyle.padding as number) || 0) + hingeInsets.paddingRight,
    };

    const supportsDualPane = foldableInfo.isFoldable && foldableInfo.isDualScreen;

    return {
      layoutStyle: finalStyle,
      layoutMode: foldableInfo.layoutMode,
      supportsDualPane,
      isDualPane: supportsDualPane && foldableInfo.state === 'unfolded',
      hingeInsets,
      isFoldable: foldableInfo.isFoldable,
    };
  }, [foldableInfo, layoutConfig, hingeMode, isLandscape]);

  return result;
}

/**
 * Grid layout helper for foldable screens
 * Returns appropriate column count based on screen mode
 *
 * @example
 * ```tsx
 * const columns = useFoldableGridColumns({ narrow: 2, wide: 3, tablet: 4 });
 * <FlatList numColumns={columns} />
 * ```
 */
export interface GridColumnOptions {
  narrow: number;
  wide: number;
  tablet: number;
}

export function useFoldableGridColumns(options: GridColumnOptions): number {
  const foldableInfo = useFoldableState();
  const { isLandscape } = useOrientation();

  // In landscape, add extra column for wide screens
  if (isLandscape && foldableInfo.layoutMode === 'wide') {
    return Math.min(options.wide + 1, options.tablet);
  }

  return options[foldableInfo.layoutMode];
}

/**
 * Safe area wrapper for hinge avoidance
 * Renders children with proper padding to avoid hinge area
 */
export interface HingeSafeAreaProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  mode?: HingeMode;
}

export function HingeSafeArea({
  children,
  style,
  mode = 'avoid',
}: HingeSafeAreaProps): React.ReactElement {
  const foldableInfo = useFoldableState();

  const safeStyle = useMemo((): ViewStyle => {
    if (mode === 'ignore' || !foldableInfo.hingeArea.shouldAvoid) {
      return { flex: 1 };
    }

    const insets = getHingeSafeAreaInsets(foldableInfo);
    return {
      flex: 1,
      paddingTop: insets.paddingTop,
      paddingBottom: insets.paddingBottom,
      paddingLeft: insets.paddingLeft,
      paddingRight: insets.paddingRight,
    };
  }, [foldableInfo, mode]);

  return (
    <View style={[safeStyle, style]}>
      {children}
    </View>
  );
}
