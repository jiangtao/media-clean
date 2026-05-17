import type { CleanupCandidate } from '../../domain/recognition/types';
import { DEFAULT_SCAN_LIMIT } from '../../features/scan/scan-config';

interface ScreenInsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface ScreenDimensions {
  width: number;
  height: number;
  scale?: number;
  fontScale?: number;
}

export interface AdaptiveScreenLayout {
  isSELike: boolean;
  isWide: boolean;
  availableWidth: number;
  contentWidth: number;
  horizontalGutter: number;
  left: number;
  right: number;
}

export interface MediaGridLayout {
  columns: number;
  itemSize: number;
  spacing: number;
  sidePadding: number;
  contentWidth: number;
  isSELike: boolean;
}

export interface BottomActionLayout {
  bottom: number;
  left: number;
  right: number;
  contentWidth: number;
  isSELike: boolean;
}

export interface SettingsScreenLayout {
  headerTop: number;
  contentBottom: number;
  left: number;
  right: number;
  contentWidth: number;
  cardPadding: number;
  cardGap: number;
  chipMinWidth: number;
  chipMinHeight: number;
  isSELike: boolean;
}

interface PhotoGridCopy {
  controls: {
    rescan: string;
    scanning: string;
  };
  permission: {
    title: string;
    body: string;
    action: string;
  };
  summary: {
    blurryLabel: string;
    duplicateLabel: string;
    similarLabel: string;
  };
  screens: {
    photoGrid: {
      filterAll: string;
      filterPhoto: string;
      filterVideo: string;
      permissionChecking: string;
      scanPromptTitle: string;
      scanPromptBody: string;
      startScan: string;
      scanScopeSummary: (count: number) => string;
      scanScopeHint: string;
      scanProgressTitle: string;
      scanProgressValue: (current: number, total: number) => string;
      scanProgressFootnote: string;
      scanCurrentBatchRange: (start: string, end: string) => string;
      scanBatchRange: (start: string, end: string) => string;
      scanCompleteTitle: string;
      scanResultSummary: (count: number) => string;
      scanResultFootnote: string;
      scanExhaustedTitle: string;
      scanExhaustedBody: string;
      scanAllCompleteTitle: string;
      scanAllCompleteBody: string;
      continueScan: string;
      selectedItems: (count: number) => string;
      cleanupSelected: string;
      keepSelected: string;
    };
    recycleBin: {
      title: string;
      emptyTitle: string;
      emptyBody: string;
      selectedItems: (count: number) => string;
      cancel: string;
      restore: string;
      delete: string;
    };
  };
}

interface PhotoGridScopeSelection {
  total: number;
  photo: number;
  video: number;
}

interface PhotoGridCandidateSummary {
  blurryCount: number;
  duplicateCount: number;
  similarCount: number;
}

interface PhotoGridResultBreakdownItem {
  key: 'blurry' | 'duplicate' | 'similar';
  label: string;
  count: number;
}

interface PhotoGridEntryCopy {
  eyebrow: string;
  title: string;
  body: string | null;
  action: string | null;
  progress: {
    current: number;
    total: number;
    value: string;
  } | null;
  note: string | null;
  result: string | null;
  resultBreakdown?: readonly PhotoGridResultBreakdownItem[];
}

const SE_LOGICAL_WIDTH = 430;
const SE_DESIGN_GRID_WIDTH = 375;
export const RECYCLE_BIN_DESIGN_CONTENT_WIDTH = 339;
const SETTINGS_DESIGN_CONTENT_WIDTH = 339;
const WIDE_LOGICAL_WIDTH = 600;
const DEFAULT_GRID_SIDE_PADDING = 16;
const DEFAULT_GRID_SPACING = 8;

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function isSELikeDimension(dimensions: ScreenDimensions) {
  return Math.min(dimensions.width, dimensions.height) <= SE_LOGICAL_WIDTH;
}

export function buildAdaptiveScreenLayout(
  insets: ScreenInsets,
  dimensions: ScreenDimensions,
  options: {
    minHorizontalGutter?: number;
    maxContentWidth?: number;
  } = {},
): AdaptiveScreenLayout {
  const safeWidth = Math.max(0, dimensions.width - insets.left - insets.right);
  const isSELike = isSELikeDimension(dimensions);
  const minHorizontalGutter = options.minHorizontalGutter ?? 16;
  const maxContentWidth = options.maxContentWidth ?? (safeWidth >= WIDE_LOGICAL_WIDTH ? 560 : 440);
  const contentWidth = Math.max(
    0,
    Math.min(safeWidth - minHorizontalGutter * 2, maxContentWidth),
  );
  const horizontalGutter = Math.max(
    minHorizontalGutter,
    Math.floor((safeWidth - contentWidth) / 2),
  );

  return {
    isSELike,
    isWide: safeWidth >= WIDE_LOGICAL_WIDTH,
    availableWidth: safeWidth,
    contentWidth,
    horizontalGutter,
    left: insets.left + horizontalGutter,
    right: insets.right + horizontalGutter,
  };
}

export function buildMediaGridLayout(
  insets: ScreenInsets,
  dimensions: ScreenDimensions,
  options: {
    maxGridWidth?: number;
  } = {},
): MediaGridLayout {
  const safeWidth = Math.max(0, dimensions.width - insets.left - insets.right);
  const isSELike = isSELikeDimension(dimensions);
  const maxGridWidth =
    options.maxGridWidth ??
    (isSELike ? Math.min(safeWidth, SE_DESIGN_GRID_WIDTH) : safeWidth >= 840 ? 760 : safeWidth);
  const contentWidth = Math.max(0, Math.min(safeWidth, maxGridWidth));
  const centerOffset = Math.max(0, Math.floor((safeWidth - contentWidth) / 2));
  const spacing = isSELike ? DEFAULT_GRID_SPACING : 10;
  const baseSidePadding = isSELike ? DEFAULT_GRID_SIDE_PADDING : 20;
  const columns =
    contentWidth >= 760 ? 6 : contentWidth >= 620 ? 5 : contentWidth >= 500 ? 4 : 3;
  const rawItemSize =
    (contentWidth - baseSidePadding * 2 - spacing * (columns - 1)) / columns;
  const itemSize = Math.max(72, Math.floor(rawItemSize));

  return {
    columns,
    itemSize,
    spacing,
    sidePadding: baseSidePadding + centerOffset,
    contentWidth,
    isSELike,
  };
}

export function buildBottomActionLayout(
  insets: ScreenInsets,
  dimensions: ScreenDimensions,
  options: {
    maxContentWidth?: number;
    bottomOffset?: number;
  } = {},
): BottomActionLayout {
  const frame = buildAdaptiveScreenLayout(insets, dimensions, {
    maxContentWidth: options.maxContentWidth ?? 560,
  });

  return {
    bottom: (options.bottomOffset ?? 0) + Math.max(insets.bottom, 8),
    left: frame.left,
    right: frame.right,
    contentWidth: frame.contentWidth,
    isSELike: frame.isSELike,
  };
}

// PhotoGrid entry interaction standard:
// compact copy, inline rail progress, and a single extensible scan-scope truth source.
export const PHOTO_GRID_ENTRY_INTERACTION_STANDARD: {
  defaultScanScopeCount: number;
  progressVariant: 'inline-rail';
  compactTypography: boolean;
} = {
  defaultScanScopeCount: DEFAULT_SCAN_LIMIT,
  progressVariant: 'inline-rail',
  compactTypography: true,
};

export function buildPhotoGridFilterOptions(copy: PhotoGridCopy) {
  return [
    { value: 'all', label: copy.screens.photoGrid.filterAll, icon: 'apps-outline' },
    { value: 'photo', label: copy.screens.photoGrid.filterPhoto, icon: 'image-outline' },
    { value: 'video', label: copy.screens.photoGrid.filterVideo, icon: 'videocam-outline' },
  ] as const;
}

export function buildPhotoGridTabOptions(
  copy: PhotoGridCopy,
  scopeSelection: PhotoGridScopeSelection,
) {
  return buildPhotoGridScopeBreakdown(copy, scopeSelection).map((item) => ({
    value: item.key,
    label: item.label,
    count: item.count,
    icon:
      item.key === 'all'
        ? 'apps-outline'
        : item.key === 'photo'
          ? 'image-outline'
          : 'videocam-outline',
  }));
}

export function buildPhotoGridScopeBreakdown(
  copy: PhotoGridCopy,
  scopeSelection: PhotoGridScopeSelection,
) {
  return [
    { key: 'all', label: copy.screens.photoGrid.filterAll, count: scopeSelection.total },
    { key: 'photo', label: copy.screens.photoGrid.filterPhoto, count: scopeSelection.photo },
    { key: 'video', label: copy.screens.photoGrid.filterVideo, count: scopeSelection.video },
  ] as const;
}

function buildPhotoGridCandidateSummary(
  candidates: readonly Pick<CleanupCandidate, 'primaryIssueType' | 'duplicateGroup'>[],
): PhotoGridCandidateSummary {
  return candidates.reduce<PhotoGridCandidateSummary>(
    (summary, candidate) => {
      if (candidate.primaryIssueType !== 'duplicate') {
        summary.blurryCount += 1;
      } else if (candidate.duplicateGroup?.relation === 'near') {
        summary.similarCount += 1;
      } else {
        summary.duplicateCount += 1;
      }

      return summary;
    },
    {
      blurryCount: 0,
      duplicateCount: 0,
      similarCount: 0,
    },
  );
}

function buildPhotoGridResultBreakdown(
  copy: PhotoGridCopy,
  candidates: readonly Pick<CleanupCandidate, 'primaryIssueType' | 'duplicateGroup'>[],
) {
  const summary = buildPhotoGridCandidateSummary(candidates);

  return [
    {
      key: 'duplicate',
      label: copy.summary.duplicateLabel,
      count: summary.duplicateCount,
    },
    {
      key: 'blurry',
      label: copy.summary.blurryLabel,
      count: summary.blurryCount,
    },
    {
      key: 'similar',
      label: copy.summary.similarLabel,
      count: summary.similarCount,
    },
  ] as const;
}

export function buildPhotoGridEntryCopy(
  copy: PhotoGridCopy,
  options: {
    permissionState: 'loading' | 'granted' | 'denied';
    scanScopeCount?: number;
    isScanning?: boolean;
    hasCompletedScan?: boolean;
    progressCurrent?: number;
    progressTotal?: number;
    currentFileName?: string | null;
    resultCount?: number;
    hasCompletedFullScan?: boolean;
    scanRangeLabel?: string | null;
    liveCandidates?: readonly Pick<CleanupCandidate, 'primaryIssueType' | 'duplicateGroup'>[];
  },
): PhotoGridEntryCopy {
  const scanScopeCount = options.scanScopeCount ?? PHOTO_GRID_ENTRY_INTERACTION_STANDARD.defaultScanScopeCount;
  const progressTotal =
    options.progressTotal && options.progressTotal > 0 ? options.progressTotal : scanScopeCount;
  const progressCurrent = Math.min(options.progressCurrent ?? 0, progressTotal);

  if (options.permissionState === 'loading') {
    return {
      eyebrow: copy.screens.photoGrid.permissionChecking,
      title: copy.screens.photoGrid.scanScopeSummary(scanScopeCount),
      body: null,
      action: null,
      progress: null,
      note: null,
      result: null,
    } as const;
  }

  if (options.permissionState === 'denied') {
    return {
      eyebrow: copy.permission.title,
      title: copy.screens.photoGrid.scanScopeSummary(scanScopeCount),
      body: copy.permission.body,
      action: copy.permission.action,
      progress: null,
      note: null,
      result: null,
    } as const;
  }

  if (options.isScanning) {
    return {
      eyebrow: copy.screens.photoGrid.scanProgressTitle,
      title: copy.screens.photoGrid.scanScopeSummary(scanScopeCount),
      body: copy.screens.photoGrid.scanProgressFootnote,
      action: copy.controls.scanning,
      progress: {
        current: progressCurrent,
        total: progressTotal,
        value: copy.screens.photoGrid.scanProgressValue(progressCurrent, progressTotal),
      },
      note: options.scanRangeLabel ?? null,
      result: null,
    } as const;
  }

  if (options.hasCompletedScan) {
    const resultBreakdown = options.liveCandidates
      ? buildPhotoGridResultBreakdown(copy, options.liveCandidates)
      : undefined;
    const completedAction = options.hasCompletedFullScan ? null : copy.controls.rescan;

    if (options.hasCompletedFullScan) {
      return {
        eyebrow: copy.screens.photoGrid.scanCompleteTitle,
        title: copy.screens.photoGrid.scanAllCompleteTitle,
        body: (options.resultCount ?? 0) === 0
          ? copy.screens.photoGrid.scanAllCompleteBody
          : copy.screens.photoGrid.scanResultFootnote,
        action: null,
        progress: {
          current: progressTotal,
          total: progressTotal,
          value: copy.screens.photoGrid.scanProgressValue(progressTotal, progressTotal),
        },
        note: options.scanRangeLabel ?? null,
        result:
          (options.resultCount ?? 0) > 0
            ? copy.screens.photoGrid.scanResultSummary(options.resultCount ?? 0)
            : null,
        ...(resultBreakdown ? { resultBreakdown } : {}),
      } as const;
    }

    if ((options.resultCount ?? 0) === 0) {
      return {
        eyebrow: copy.screens.photoGrid.scanCompleteTitle,
        title: copy.screens.photoGrid.scanExhaustedTitle,
        body: copy.screens.photoGrid.scanExhaustedBody,
        action: copy.screens.photoGrid.continueScan,
        progress: {
          current: progressTotal,
          total: progressTotal,
          value: copy.screens.photoGrid.scanProgressValue(progressTotal, progressTotal),
        },
        note: options.scanRangeLabel ?? null,
        result: null,
        ...(resultBreakdown ? { resultBreakdown } : {}),
      } as const;
    }

    return {
      eyebrow: copy.screens.photoGrid.scanCompleteTitle,
      title: copy.screens.photoGrid.scanScopeSummary(scanScopeCount),
      body: copy.screens.photoGrid.scanResultFootnote,
      action: completedAction,
      progress: {
        current: progressTotal,
        total: progressTotal,
        value: copy.screens.photoGrid.scanProgressValue(progressTotal, progressTotal),
      },
      note: options.scanRangeLabel ?? null,
      result: copy.screens.photoGrid.scanResultSummary(options.resultCount ?? 0),
      ...(resultBreakdown ? { resultBreakdown } : {}),
    } as const;
  }

  return {
    eyebrow: copy.screens.photoGrid.scanPromptTitle,
    title: copy.screens.photoGrid.scanScopeSummary(scanScopeCount),
    body: null,
    action: copy.screens.photoGrid.startScan,
    progress: null,
    note: options.scanRangeLabel ?? null,
    result: null,
  } as const;
}

export function buildPhotoGridContentPadding(insets: ScreenInsets) {
  return {
    left: insets.left,
    right: insets.right,
    bottom: 88 + insets.bottom,
  };
}

export function buildPhotoGridEntryInsets(insets: ScreenInsets) {
  return {
    top: 12 + insets.top,
    left: 16 + insets.left,
    right: 16 + insets.right,
  };
}

export function buildFilterWrapInsets(insets: ScreenInsets) {
  return {
    top: 8,
    left: 16 + insets.left,
    right: 16 + insets.right,
  };
}

export function buildFloatingActionBarInsets(insets: ScreenInsets) {
  return {
    bottom: 80 + insets.bottom,
    left: 16 + insets.left,
    right: 16 + insets.right,
  };
}

export function buildRecycleBinHeaderInsets(insets: ScreenInsets) {
  return {
    top: 16 + insets.top,
    left: insets.left,
    right: insets.right,
  };
}

export function buildSettingsScreenLayout(
  insets: ScreenInsets,
  dimensions?: ScreenDimensions,
): SettingsScreenLayout {
  if (!dimensions) {
    return {
      headerTop: 18 + insets.top,
      contentBottom: 92 + insets.bottom,
      left: 28 + insets.left,
      right: 28 + insets.right,
      contentWidth: 0,
      cardPadding: 12,
      cardGap: 14,
      chipMinWidth: 32,
      chipMinHeight: 24,
      isSELike: true,
    };
  }

  const frame = buildAdaptiveScreenLayout(insets, dimensions, {
    minHorizontalGutter: isSELikeDimension(dimensions) ? 28 : 16,
    maxContentWidth:
      isSELikeDimension(dimensions)
        ? SETTINGS_DESIGN_CONTENT_WIDTH
        : dimensions.width >= WIDE_LOGICAL_WIDTH
          ? 640
          : 440,
  });

  return {
    headerTop: (frame.isSELike ? 18 : 28) + insets.top,
    contentBottom: (frame.isSELike ? 92 : 104) + insets.bottom,
    left: frame.left,
    right: frame.right,
    contentWidth: frame.contentWidth,
    cardPadding: frame.isSELike ? 12 : 30,
    cardGap: frame.isSELike ? 14 : 28,
    chipMinWidth: frame.isSELike ? 32 : 64,
    chipMinHeight: frame.isSELike ? 24 : 44,
    isSELike: frame.isSELike,
  };
}

export function buildRecycleBinTexts(copy: PhotoGridCopy) {
  return {
    title: copy.screens.recycleBin.title,
    emptyTitle: copy.screens.recycleBin.emptyTitle,
    emptyBody: copy.screens.recycleBin.emptyBody,
  };
}
