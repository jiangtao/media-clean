import { DEFAULT_SCAN_LIMIT } from '../../features/scan/scan-config';

interface ScreenInsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
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
      scanCompleteTitle: string;
      scanResultSummary: (count: number) => string;
      scanResultFootnote: string;
      scanExhaustedTitle: string;
      scanExhaustedBody: string;
      continueScan: string;
      selectedItems: (count: number) => string;
      cleanupSelected: string;
      keepSelected: string;
    };
    recycleBin: {
      title: string;
      emptyTitle: string;
      emptyBody: string;
      expireHint: (days: number) => string;
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
  },
) {
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
      note: null,
      result: null,
    } as const;
  }

  if (options.hasCompletedScan) {
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
        note: null,
        result: null,
      } as const;
    }

    return {
      eyebrow: copy.screens.photoGrid.scanCompleteTitle,
      title: copy.screens.photoGrid.scanScopeSummary(scanScopeCount),
      body: copy.screens.photoGrid.scanResultFootnote,
      action: copy.controls.rescan,
      progress: {
        current: progressTotal,
        total: progressTotal,
        value: copy.screens.photoGrid.scanProgressValue(progressTotal, progressTotal),
      },
      note: null,
      result: copy.screens.photoGrid.scanResultSummary(options.resultCount ?? 0),
    } as const;
  }

  return {
    eyebrow: copy.screens.photoGrid.scanPromptTitle,
    title: copy.screens.photoGrid.scanScopeSummary(scanScopeCount),
    body: null,
    action: copy.screens.photoGrid.startScan,
    progress: null,
    note: null,
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

export function buildSettingsScreenLayout(insets: ScreenInsets) {
  return {
    headerTop: 16 + insets.top,
    contentBottom: 100 + insets.bottom,
    left: 16 + insets.left,
    right: 16 + insets.right,
  };
}

export function buildRecycleBinTexts(copy: PhotoGridCopy, expirationDays: number) {
  return {
    title: copy.screens.recycleBin.title,
    emptyTitle: copy.screens.recycleBin.emptyTitle,
    emptyBody: copy.screens.recycleBin.emptyBody,
    expireHint: copy.screens.recycleBin.expireHint(expirationDays),
  };
}
