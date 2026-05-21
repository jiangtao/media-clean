import type {
  CleanupCandidate,
  CleanupConfidence,
  CleanupIssueType,
  CleanupKind,
  DuplicateGroup,
  MediaType,
} from '../domain/recognition/types';
import type { ScanSummary } from '../features/scan/scan-media-library';
import { DEFAULT_SCAN_WINDOW_MONTHS_EQUIVALENT } from '../features/scan/scan-config';
import type { ReminderSettings } from '../features/reminders/reminder-settings';
import type { AppLanguage } from './app-language';
import { formatEnglishPluralSuffix, formatI18nTemplate } from './formatters';
import { loadI18nResources } from './resource-loader';

type Frequency = ReminderSettings['frequency'];

interface LocalizedCopy {
  languageLabel: string;
  languageOptions: Array<{ value: AppLanguage; label: string }>;
  appearance: {
    title: string;
    system: string;
    light: string;
    dark: string;
  };
  common: {
    cancel: string;
    close: string;
    deleteConfirm: string;
    unknownSize: string;
    neverScanned: string;
    notScheduled: string;
    statusTitle: string;
  };
  appErrorBoundary: {
    title: string;
    body: string;
    retry: string;
  };
  components: {
    selectionBar: {
      selectedItems: (count: number) => string;
      selectAll: string;
      deselectAll: string;
      clean: string;
    };
    scanCounter: {
      complete: string;
      scanning: (counterText: string) => string;
    };
    scanProgress: {
      scanning: string;
      preparing: string;
      complete: string;
      cancel: string;
      pendingCount: string;
      completedResults: (count: number) => string;
    };
  };
  hero: {
    kicker: string;
    title: string;
    description: string;
    lastScan: string;
    autoCleanupHint: string;
  };
  summary: {
    scannedLabel: string;
    scannedCaption: string;
    candidatesLabel: string;
    candidatesCaption: string;
    blurryLabel: string;
    duplicateLabel: string;
    similarLabel: string;
    suggestedCleanupLabel: string;
    suggestedCleanupCaption: string;
    recycleLabel: string;
    recycleCaption: string;
  };
  controls: {
    rescan: string;
    scanning: string;
    autoCleanup: string;
  };
  info: {
    title: string;
    firstLine: string;
    secondLine: string;
  };
  reminder: {
    title: string;
    genericTitle: string;
    defaultSummary: string;
    disabledSummary: string;
    weekly: string;
    daily: string;
    weekdays: string[];
    weekdayShorts: string[];
    themePreview: string;
    frequencyLabel: string;
    weekdayLabel: string;
    timeLabel: string;
    hourMinus: string;
    hourPlus: string;
    minuteMinus: string;
    minutePlus: string;
    themePlaceholder: string;
    saveTheme: string;
    footnote: string;
    permissionLabel: string;
    permissionOn: string;
      permissionOff: string;
      scheduled: string;
      pending: string;
      disabled: string;
      unauthorized: string;
      channelName: string;
      channelDescription: string;
      nextReminder: string;
    estimatedReminder: string;
    plannedReminder: string;
    noScanSummary: string;
    noScanDetail: string;
    eligibilityHint: (months: number) => string;
    scheduleDaily: string;
    scheduleWeekly: string;
    recentScanFoundSummary: string;
    recentScanEmptySummary: string;
    recentScanDetail: string;
  };
  notifications: {
    scanCompletion: {
      channelName: string;
      channelDescription: string;
      title: string;
      bodyWithResults: string;
      bodyEmpty: string;
    };
    androidBackgroundScan: {
      title: string;
      bodyWithFile: string;
      bodyWithoutFile: string;
    };
  };
  permission: {
    title: string;
    body: string;
    action: string;
  };
  tabs: {
    suggestions: string;
    recycle: string;
    photos: string;
    settings: string;
  };
  splash: {
    brand: string;
    title: string;
    subtitle: string;
    body: string;
  };
  landing: {
    statusTitleGranted: string;
    statusBodyGranted: string;
    statusTitlePending: string;
    statusBodyPending: string;
    heroTitle: string;
    heroBodyGranted: string;
    heroBodyPending: string;
    actionReady: string;
    actionPending: string;
    featurePill: string;
    localOnlyTitle: string;
    localOnlyBody: string;
    mediaSupportTitle: string;
    mediaSupportBody: string;
  };
  settings: {
    loading: string;
    headerTitle: string;
    headerBody: string;
    runtimeTitle: string;
    preferenceTitle: string;
    maintenanceTitle: string;
    languageThemeTitle: string;
    scanRangeTitle: string;
    scanRangeHint: string;
    scanRangeRecentMonths: (months: number) => string;
    scanRangeAllLabel: string;
    followSystemLanguage: (currentLabel: string) => string;
    compactSystemLabel: string;
    reminderEnableAction: string;
    reminderDisableAction: string;
    reminderTitle: string;
    lastScanTitle: string;
    cachedDataTitle: string;
    localOnlyNote: string;
    cacheHint: string;
    clearingAction: string;
    clearAction: string;
    clearCache: string;
    clearCacheWithSize: (formattedSize: string) => string;
    currentThemePrefix: string;
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
      scanEarliestMediaLabel: string;
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
      selectionModeSelectAll: string;
      selectionModeDeselectAll: string;
      selectionModeSelectedItems: (count: number) => string;
      cleanupSelected: string;
      keepSelected: string;
      workspaceTitleWithCount: (title: string, count: number) => string;
      workspaceSelectedSize: (formattedSize: string) => string;
      workspaceEmptyIssueTitle: string;
      stateReadyBody: string;
      stateScanningTitle: string;
      stateScanningBody: string;
      stateRecognizingTitle: string;
      stateRecognizingBody: string;
      stateResultTitle: string;
      stateResultBody: (count: number) => string;
      autoResumeScanNotice: string;
      entryUnit: string;
      entryPermissionGrantedTitle: string;
      entryPermissionGrantedBody: string;
      entryLoadingTitle: string;
      entryLoadingBody: string;
      entryReadyHint: string;
      entryLocalOnly: string;
      entryLocalOnlyCaption: string;
      entrySupportsPhotosAndVideos: string;
      entrySupportsPhotosAndVideosCaption: string;
      entryFastLocalScan: string;
      entryScanningInstrumentationLabel: string;
    };
    recycleBin: {
      title: string;
      emptyTitle: string;
      emptyBody: string;
      loading: string;
      selectionToggle: (isAllSelected: boolean) => string;
      pendingSummary: (count: number) => string;
      selectedItems: (count: number) => string;
      cancel: string;
      restore: string;
      delete: string;
      keepAction: string;
      cleanupAction: string;
      releasableSizeLabel: string;
      cleanupHistoryTitle: string;
      cleanupHistoryReleased: (formattedSize: string) => string;
    };
  };
  filters: {
    all: string;
    accidental: string;
    abnormal: string;
    duplicate: string;
  };
  empty: {
    suggestionsTitle: string;
    suggestionsBody: string;
    recycleTitle: string;
    recycleBody: string;
  };
  actionBar: {
    selectedItems: (count: number) => string;
    restoreSelected: string;
    cleanupSelected: string;
    clearSelection: string;
  };
  alerts: {
    scanFailed: string;
    initFailed: string;
    deleteFailedTitle: string;
    deleteFailedBody: string;
    noAutoCleanupTitle: string;
    noAutoCleanupBody: string;
    autoCleanupTitle: string;
    autoCleanupBody: (count: number) => string;
    confirmMoveToRecycle: string;
    selectedCleanupTitle: string;
    selectedCleanupBody: (count: number) => string;
    moveToRecycle: string;
    deleteForever: string;
    confirmAgainTitle: string;
    confirmAgainBody: string;
    previewDeleteTitle: string;
    previewDeleteBody: string;
    reminderDisabledTitle: string;
    reminderDisabledBody: string;
  };
  candidate: {
    highConfidence: string;
    mediumConfidence: string;
    lowConfidence: string;
    accidentalVideo: string;
    accidentalPhoto: string;
    abnormalVideo: string;
    abnormalPhoto: string;
    similarVideo: string;
    similarPhoto: string;
    duplicateVideo: string;
    duplicatePhoto: string;
    accidentalIssue: string;
    abnormalIssue: string;
    duplicateIssue: string;
    selected: string;
    actionable: string;
    noRisk: string;
    recycleHint: string;
    previewHint: string;
    unselect: string;
    addAction: string;
    scoreUnit: string;
    secondUnit: string;
  };
  preview: {
    title: string;
    subtitle: string;
    clearAction: string;
    clearCompactAction: string;
    judgementTitle: string;
    mediaInfoTitle: string;
    typeLabel: string;
    capturedAtLabel: string;
    dimensionsLabel: string;
    sizeLabel: string;
    durationLabel: string;
    video: string;
    photo: string;
    keepAction: string;
    keepCompactAction: string;
    keepHint: string;
    restore: string;
    restoreCompactAction: string;
    moveToRecycle: string;
    deleteForever: string;
    deleteForeverCompactAction: string;
    duplicateGroupHint: (count: number) => string;
    duplicateExpand: string;
    duplicateCollapse: string;
    duplicateSelectionHint: string;
    duplicateSelectedCount: (count: number) => string;
    duplicateKeepReference: string;
    duplicateCurrentItem: string;
    duplicateSimilarItem: (index: number) => string;
    duplicateExactTag: string;
    duplicateSimilarTag: string;
    duplicateSimilarityTag: (percentage: number) => string;
    duplicateSelectDelete: string;
    duplicateSelectedDelete: string;
    duplicateRepresentativeTitle: string;
    duplicateReasonHigherResolution: string;
    duplicateReasonLargerFile: string;
    duplicateReasonNewerCapture: string;
    duplicateCardSummaryHigherResolution: string;
    duplicateCardSummaryLargerFile: string;
    duplicateCardSummaryNewerCapture: string;
    duplicateComparisonHigherResolution: string;
    duplicateComparisonLargerFile: string;
    duplicateComparisonNewerCapture: string;
  };
  recognition: {
    reasons: Record<string, string>;
    compactReasons: Record<string, string>;
  };
}

function formatResourceTemplate(
  template: string,
  values: Record<string, string | number | boolean> = {},
) {
  return formatI18nTemplate(template, {
    defaultScanWindowMonths: DEFAULT_SCAN_WINDOW_MONTHS_EQUIVALENT,
    ...values,
  });
}

function buildLocalizedCopy(language: AppLanguage): LocalizedCopy {
  const resources = loadI18nResources(language);
  const app = resources.app;
  const components = resources.components;
  const settings = resources.settings;
  const photoGrid = resources['photo-grid'];
  const recycleBin = resources['recycle-bin'];
  const cleanup = resources.cleanup;
  const notifications = resources.notifications;
  const { scanScopeSummaryDefault: photoGridScanScopeSummaryDefault, ...photoGridStrings } =
    photoGrid;
  const { selectionToggleAllSelected: recycleBinSelectionToggleAllSelected, ...recycleBinStrings } =
    recycleBin;

  return {
    languageLabel: app.languageLabel,
    languageOptions: app.languageOptions.map((option) => ({
      value: option.value as AppLanguage,
      label: option.label,
    })),
    appearance: { ...app.appearance },
    common: { ...app.common },
    appErrorBoundary: { ...app.appErrorBoundary },
    components: {
      selectionBar: {
        ...components.selectionBar,
        selectedItems: (count: number) =>
          formatResourceTemplate(components.selectionBar.selectedItems, { count }),
      },
      scanCounter: {
        ...components.scanCounter,
        scanning: (counterText: string) =>
          formatResourceTemplate(components.scanCounter.scanning, { counterText }),
      },
      scanProgress: {
        ...components.scanProgress,
        completedResults: (count: number) =>
          formatResourceTemplate(components.scanProgress.completedResults, { count }),
      },
    },
    hero: { ...app.hero },
    summary: { ...app.summary },
    controls: { ...app.controls },
    info: { ...app.info },
    reminder: {
      ...app.reminder,
      weekdays: [...app.reminder.weekdays],
      weekdayShorts: [...app.reminder.weekdayShorts],
      eligibilityHint: (months: number) =>
        formatResourceTemplate(app.reminder.eligibilityHint, {
          months,
          monthPluralSuffix: formatEnglishPluralSuffix(months),
        }),
    },
    notifications: {
      scanCompletion: { ...notifications.scanCompletion },
      androidBackgroundScan: { ...notifications.androidBackgroundScan },
    },
    permission: { ...app.permission },
    tabs: { ...app.tabs },
    splash: { ...app.splash },
    landing: { ...resources.landing },
    settings: {
      ...settings,
      scanRangeRecentMonths: (months: number) =>
        formatResourceTemplate(settings.scanRangeRecentMonths, {
          months,
          monthPluralSuffix: formatEnglishPluralSuffix(months),
        }),
      followSystemLanguage: (currentLabel: string) =>
        formatResourceTemplate(settings.followSystemLanguage, { currentLabel }),
      clearCacheWithSize: (formattedSize: string) =>
        formatResourceTemplate(settings.clearCacheWithSize, { formattedSize }),
    },
    screens: {
      photoGrid: {
        ...photoGridStrings,
        scanPromptBody: formatResourceTemplate(photoGrid.scanPromptBody),
        scanScopeSummary: (count: number) =>
          count > 0
            ? formatResourceTemplate(photoGrid.scanScopeSummary, { count })
            : formatResourceTemplate(photoGridScanScopeSummaryDefault),
        scanScopeHint: formatResourceTemplate(photoGrid.scanScopeHint),
        scanProgressValue: (current: number, total: number) =>
          formatResourceTemplate(photoGrid.scanProgressValue, { current, total }),
        scanCurrentBatchRange: (start: string, end: string) =>
          formatResourceTemplate(photoGrid.scanCurrentBatchRange, { start, end }),
        scanBatchRange: (start: string, end: string) =>
          formatResourceTemplate(photoGrid.scanBatchRange, { start, end }),
        scanResultSummary: (count: number) =>
          formatResourceTemplate(photoGrid.scanResultSummary, { count }),
        selectedItems: (count: number) => formatResourceTemplate(photoGrid.selectedItems, { count }),
        selectionModeSelectedItems: (count: number) =>
          formatResourceTemplate(photoGrid.selectionModeSelectedItems, { count }),
        workspaceTitleWithCount: (title: string, count: number) =>
          formatResourceTemplate(photoGrid.workspaceTitleWithCount, { title, count }),
        workspaceSelectedSize: (formattedSize: string) =>
          formatResourceTemplate(photoGrid.workspaceSelectedSize, { formattedSize }),
        stateResultBody: (count: number) =>
          formatResourceTemplate(photoGrid.stateResultBody, { count }),
      },
      recycleBin: {
        ...recycleBinStrings,
        selectionToggle: (isAllSelected: boolean) =>
          isAllSelected ? recycleBinSelectionToggleAllSelected : recycleBin.selectionToggle,
        pendingSummary: (count: number) =>
          formatResourceTemplate(recycleBin.pendingSummary, { count }),
        selectedItems: (count: number) =>
          formatResourceTemplate(recycleBin.selectedItems, { count }),
        cleanupHistoryReleased: (formattedSize: string) =>
          formatResourceTemplate(recycleBin.cleanupHistoryReleased, { formattedSize }),
      },
    },
    filters: { ...cleanup.filters },
    empty: { ...cleanup.empty },
    actionBar: {
      ...cleanup.actionBar,
      selectedItems: (count: number) =>
        formatResourceTemplate(cleanup.actionBar.selectedItems, { count }),
    },
    alerts: {
      ...cleanup.alerts,
      autoCleanupBody: (count: number) =>
        formatResourceTemplate(cleanup.alerts.autoCleanupBody, { count }),
      selectedCleanupBody: (count: number) =>
        formatResourceTemplate(cleanup.alerts.selectedCleanupBody, { count }),
    },
    candidate: { ...cleanup.candidate },
    preview: {
      ...cleanup.preview,
      duplicateGroupHint: (count: number) =>
        formatResourceTemplate(cleanup.preview.duplicateGroupHint, { count }),
      duplicateSelectedCount: (count: number) =>
        formatResourceTemplate(cleanup.preview.duplicateSelectedCount, { count }),
      duplicateSimilarItem: (index: number) =>
        formatResourceTemplate(cleanup.preview.duplicateSimilarItem, { index }),
      duplicateSimilarityTag: (percentage: number) =>
        formatResourceTemplate(cleanup.preview.duplicateSimilarityTag, { percentage }),
    },
    recognition: {
      reasons: { ...resources.recognition.reasons },
      compactReasons: { ...resources.recognition.compactReasons },
    },
  };
}

const COPY: Record<AppLanguage, LocalizedCopy> = {
  'zh-CN': buildLocalizedCopy('zh-CN'),
  'en-US': buildLocalizedCopy('en-US'),
};

function formatNumber(value: number, language: AppLanguage, maximumFractionDigits = 0) {
  return new Intl.NumberFormat(language, {
    maximumFractionDigits,
    minimumFractionDigits: maximumFractionDigits > 0 ? maximumFractionDigits : 0,
  }).format(value);
}

function formatResolution(width: number, height: number) {
  return `${width} × ${height}`;
}

export function getAppCopy(language: AppLanguage): LocalizedCopy {
  return COPY[language];
}

export function getDefaultReminderSummary(language: AppLanguage): string {
  return COPY[language].reminder.defaultSummary;
}

export function isDefaultReminderSummary(summary: string | undefined): boolean {
  const trimmed = summary?.trim();
  if (!trimmed) {
    return true;
  }

  return Object.values(COPY).some((copy) => copy.reminder.defaultSummary === trimmed);
}

export function resolveReminderSummary(summary: string | undefined, language: AppLanguage) {
  const trimmed = summary?.trim();
  if (!trimmed || isDefaultReminderSummary(trimmed)) {
    return getDefaultReminderSummary(language);
  }

  return trimmed;
}

export function resolveReminderTitle(summary: string | undefined, language: AppLanguage) {
  const resolvedSummary = resolveReminderSummary(summary, language);
  return isDefaultReminderSummary(resolvedSummary)
    ? COPY[language].reminder.genericTitle
    : resolvedSummary;
}

export function listReminderFrequencyLabels(language: AppLanguage) {
  return {
    weekly: COPY[language].reminder.weekly,
    daily: COPY[language].reminder.daily,
  } satisfies Record<Frequency, string>;
}

export function listReminderWeekdayLabels(language: AppLanguage) {
  return COPY[language].reminder.weekdays;
}

export function translateRiskReason(reason: string, language: AppLanguage) {
  return COPY[language].recognition.reasons[reason] ?? reason;
}

export function getConfidenceLabel(confidence: CleanupConfidence, language: AppLanguage) {
  const labels = COPY[language].candidate;
  if (confidence === 'high') {
    return labels.highConfidence;
  }

  if (confidence === 'medium') {
    return labels.mediumConfidence;
  }

  return labels.lowConfidence;
}

export function getIssueTypeLabel(issueType: CleanupIssueType, language: AppLanguage) {
  const labels = COPY[language].candidate;

  if (issueType === 'duplicate') {
    return labels.duplicateIssue;
  }

  if (issueType === 'abnormal') {
    return labels.abnormalIssue;
  }

  return labels.accidentalIssue;
}

export function getDuplicateRepresentativeReasonLabel(
  reason: DuplicateGroup['representativeReason'],
  language: AppLanguage,
) {
  const labels = COPY[language].preview;

  if (reason === 'higher-resolution') {
    return labels.duplicateReasonHigherResolution;
  }

  if (reason === 'larger-file') {
    return labels.duplicateReasonLargerFile;
  }

  return labels.duplicateReasonNewerCapture;
}

export function getDuplicateCardSummary(candidate: CleanupCandidate, language: AppLanguage) {
  const group = candidate.duplicateGroup;
  if (!group) {
    return null;
  }

  const count = group.size - 1;
  const labels = COPY[language].preview;

  if (group.representativeReason === 'higher-resolution') {
    return formatResourceTemplate(labels.duplicateCardSummaryHigherResolution, {
      kept: formatResolution(group.representativeWidth, group.representativeHeight),
      count,
    });
  }

  if (group.representativeReason === 'larger-file') {
    return formatResourceTemplate(labels.duplicateCardSummaryLargerFile, {
      kept: formatLocalizedSize(group.representativeFileSize, language),
      count,
    });
  }

  return formatResourceTemplate(labels.duplicateCardSummaryNewerCapture, {
    kept: formatLocalizedDateTime(group.representativeCreationTime, language),
    count,
  });
}

export function getDuplicateRepresentativeComparison(
  candidate: CleanupCandidate,
  language: AppLanguage,
) {
  const group = candidate.duplicateGroup;
  if (!group) {
    return null;
  }

  const labels = COPY[language].preview;

  if (group.representativeReason === 'higher-resolution') {
    return formatResourceTemplate(labels.duplicateComparisonHigherResolution, {
      kept: formatResolution(group.representativeWidth, group.representativeHeight),
      current: formatResolution(candidate.asset.width, candidate.asset.height),
    });
  }

  if (group.representativeReason === 'larger-file') {
    return formatResourceTemplate(labels.duplicateComparisonLargerFile, {
      kept: formatLocalizedSize(group.representativeFileSize, language),
      current: formatLocalizedSize(candidate.asset.fileSize, language),
    });
  }

  return formatResourceTemplate(labels.duplicateComparisonNewerCapture, {
    kept: formatLocalizedDateTime(group.representativeCreationTime, language),
    current: formatLocalizedDateTime(candidate.asset.creationTime, language),
  });
}

export function getCandidateTitle(kind: CleanupKind, language: AppLanguage) {
  const labels = COPY[language].candidate;

  switch (kind) {
    case 'accidental-video':
      return labels.accidentalVideo;
    case 'abnormal-video':
      return labels.abnormalVideo;
    case 'duplicate-video':
      return labels.duplicateVideo;
    case 'duplicate-photo':
      return labels.duplicatePhoto;
    case 'abnormal-photo':
      return labels.abnormalPhoto;
    case 'accidental-photo':
    default:
      return labels.accidentalPhoto;
  }
}

export function getCandidateDisplayTitle(candidate: CleanupCandidate, language: AppLanguage) {
  const labels = COPY[language].candidate;
  const isVideo = candidate.asset.mediaType === 'video';

  if (candidate.duplicateGroup?.relation === 'near') {
    return isVideo ? labels.similarVideo : labels.similarPhoto;
  }

  if (candidate.primaryIssueType === 'duplicate') {
    return isVideo ? labels.duplicateVideo : labels.duplicatePhoto;
  }

  return isVideo ? labels.accidentalVideo : labels.accidentalPhoto;
}

export function getMediaTypeLabel(mediaType: MediaType, language: AppLanguage) {
  return mediaType === 'video' ? COPY[language].preview.video : COPY[language].preview.photo;
}

function getCompactReasonLabel(reason: string, language: AppLanguage) {
  return COPY[language].recognition.compactReasons[reason] ?? translateRiskReason(reason, language);
}

function uniqueLabels(labels: string[]) {
  return Array.from(new Set(labels.filter(Boolean)));
}

export function getDetailViewerTags(candidate: CleanupCandidate, language: AppLanguage) {
  const copy = COPY[language];
  const tags: string[] = [];

  if (candidate.duplicateGroup) {
    if (candidate.duplicateGroup.relation === 'exact') {
      tags.push(copy.candidate.duplicateIssue, copy.preview.duplicateExactTag);
    } else {
      tags.push(
        copy.preview.duplicateSimilarTag,
        copy.preview.duplicateSimilarityTag(Math.round(candidate.duplicateGroup.similarity * 100)),
      );
    }
  } else {
    tags.push(getIssueTypeLabel(candidate.primaryIssueType, language));
  }

  const compactReasons = candidate.reasons.map((reason) => getCompactReasonLabel(reason, language));
  return uniqueLabels([...tags, ...compactReasons]);
}

export function formatLocalizedDateTime(timestamp: number | null | undefined, language: AppLanguage) {
  if (!timestamp) {
    return COPY[language].common.neverScanned;
  }

  return new Date(timestamp).toLocaleString(language, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatLocalizedSize(bytes: number, language: AppLanguage) {
  if (bytes <= 0) {
    return COPY[language].common.unknownSize;
  }

  if (bytes < 1024 * 1024) {
    return `${formatNumber(Math.round(bytes / 1024), language)} KB`;
  }

  return `${formatNumber(bytes / (1024 * 1024), language, 1)} MB`;
}

export function formatLocalizedDuration(seconds: number, language: AppLanguage) {
  return `${formatNumber(seconds, language, 1)} ${COPY[language].candidate.secondUnit}`;
}

export function buildReminderScheduleSummary(
  settings: Pick<ReminderSettings, 'enabled' | 'frequency' | 'weekday' | 'hour' | 'minute'>,
  language: AppLanguage,
) {
  const copy = COPY[language].reminder;
  if (!settings.enabled) {
    return copy.disabledSummary;
  }

  const time = `${settings.hour.toString().padStart(2, '0')}:${settings.minute
    .toString()
    .padStart(2, '0')}`;

  if (settings.frequency === 'daily') {
    return formatResourceTemplate(copy.scheduleDaily, {
      daily: copy.daily,
      time,
    });
  }

  const weekdayLabel = copy.weekdays[settings.weekday - 1] ?? copy.weekdays[0];
  const weekdayShort = copy.weekdayShorts[settings.weekday - 1] ?? copy.weekdayShorts[0];
  return formatResourceTemplate(copy.scheduleWeekly, {
    weekly: copy.weekly,
    weekdayLabel,
    weekdayShort,
    time,
  });
}

export function getScanCompletionNotificationChannelCopy(language: AppLanguage) {
  const copy = COPY[language].notifications.scanCompletion;
  return {
    name: copy.channelName,
    description: copy.channelDescription,
  };
}

export function buildScanCompletionNotificationCopy(
  language: AppLanguage,
  scannedCount: number,
  resultCount: number,
) {
  const copy = COPY[language].notifications.scanCompletion;
  return {
    title: copy.title,
    body: formatResourceTemplate(
      resultCount > 0 ? copy.bodyWithResults : copy.bodyEmpty,
      {
        scannedCount,
        resultCount,
      },
    ),
  };
}

export function buildAndroidBackgroundScanNotificationCopy(
  language: AppLanguage,
  progressLabel: string,
  currentFileName: string | null,
) {
  const copy = COPY[language].notifications.androidBackgroundScan;
  return {
    title: copy.title,
    body: formatResourceTemplate(
      currentFileName ? copy.bodyWithFile : copy.bodyWithoutFile,
      {
        progressLabel,
        currentFileName: currentFileName ?? '',
      },
    ),
  };
}

export function buildRecentScanReminderContent(
  latestScan: ScanSummary | null,
  settings: Pick<ReminderSettings, 'hour' | 'minute'> & { summary?: string },
  language: AppLanguage,
) {
  const copy = COPY[language].reminder;
  const reminderTime = `${settings.hour.toString().padStart(2, '0')}:${settings.minute
    .toString()
    .padStart(2, '0')}`;

  if (!latestScan) {
    return {
      title: resolveReminderTitle(settings.summary, language),
      summary: copy.noScanSummary,
      detail: copy.noScanDetail,
    };
  }

  const summary =
    latestScan.candidateCount > 0
      ? formatResourceTemplate(copy.recentScanFoundSummary, {
          candidateCount: latestScan.candidateCount,
          time: reminderTime,
        })
      : formatResourceTemplate(copy.recentScanEmptySummary, {
          time: reminderTime,
        });

  const detail = formatResourceTemplate(copy.recentScanDetail, {
    scannedCount: latestScan.scannedCount,
    highConfidenceCount: latestScan.highConfidenceCount,
    mediumConfidenceCount: latestScan.mediumConfidenceCount,
    recycleBinCount: latestScan.recycleBinCount,
  });

  return {
    title: resolveReminderTitle(settings.summary, language),
    summary,
    detail,
  };
}
