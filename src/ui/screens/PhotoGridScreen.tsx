import * as MediaLibrary from 'expo-media-library';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import { PhotoGrid } from '../components/PhotoGrid';
import { ScanProgress } from '../components/ScanProgress';
import { SegmentedControl } from '../components/SegmentedControl';
import { TouchSurface } from '../components/TouchSurface';
import { DetailScreen } from './DetailScreen';
import { useAppPreferences } from '../../application/AppPreferencesContext';
import type { CleanupCandidate } from '../../domain/recognition/types';
import {
  buildCleanupCandidates,
  createFallbackCandidate,
  sortCandidatesByScore,
  type AnalyzedMediaInput,
} from '../../domain/recognition/scoring';
import type { AppThemePalette } from '../../theme/app-theme';
import {
  appendFalsePositiveCandidateIds,
  loadAssetManifestEntries,
  loadLatestPhotoScanBatch,
  loadLatestCompletedPhotoScanBatch,
  loadMediaAnalysisCache,
  loadPhotoScanBatchItems,
  type PhotoScanSessionRange,
  type PhotoScanSessionSnapshot,
  savePhotoScanBatch,
  savePhotoScanBatchItems,
  loadFalsePositiveCandidateIds,
  loadPhotoScanResultCache,
  loadRecycleBinCandidateCache,
  loadRecycleBinIds,
  saveLastScanMeta,
  saveLastValidScanBaseline,
  savePhotoScanResultCache,
  syncPersistedMediaLedger,
  saveRecycleBinCandidateCache,
  saveRecycleBinIds,
  upsertAssetManifestEntries,
  type AssetManifestRecord,
  type MediaAnalysisCache,
  type PhotoScanBatchItemStage,
  type PhotoScanBatchItemRecord,
  type PhotoScanBatchRecord,
} from '../../services/storage/app-storage';
import {
  ACTIONABLE_SCAN_THRESHOLD,
  loadRecentScanAssets,
  scanMediaLibrary,
  type ScanSummary,
} from '../../features/scan/scan-media-library';
import {
  DEFAULT_SCAN_WINDOW_DAYS,
  DEFAULT_SCAN_WINDOW_MONTHS_EQUIVALENT,
} from '../../features/scan/scan-config';
import { resolveScanBatchProgressContract } from '../../features/scan/scan-batch-progress';
import { syncAndroidBackgroundScanForegroundService } from '../../features/scan/android-background-scan';
import {
  executeAndroidNativeFirstScan,
  isAndroidNativeScanSupported,
  loadActiveAndroidNativeScanSnapshot,
  stopAndroidNativeScan,
  type AndroidNativeScanRuntimeSnapshot,
} from '../../features/scan/android-native-scan';
import { createAndroidNativeStagingImporter } from '../../features/scan/android-native-staging-importer';
import {
  enumerateAndroidMediaStoreAssets,
  type AndroidMediaStoreAssetMetadata,
} from '../../features/scan/android-media-store';
import {
  clearPhotoScanSessionRuntimeSnapshot,
  getPhotoScanSessionRuntimeSnapshot,
  hydratePhotoScanSessionRuntimeSnapshot,
  persistPhotoScanSessionRuntimeSnapshot,
  stagePhotoScanSessionRuntimeSnapshot,
} from '../../features/scan/photo-scan-session-runtime';
import {
  clearPhotoScanJobCheckpoint,
  loadPhotoScanJobCheckpoint,
  savePhotoScanJobCheckpoint,
  type PhotoScanJobCheckpoint,
} from '../../services/storage/scan-job-storage';
import {
  buildScanRangeStartAt,
  loadScanRange,
  type ScanRange,
} from '../../services/storage/scan-range-storage';
import { reconcileReminderRuntimeInForeground } from '../../features/reminders/reminder-runtime';
import {
  buildFilterWrapInsets,
  buildPhotoGridContentPadding,
  buildPhotoGridEntryCopy,
  buildPhotoGridEntryInsets,
  buildPhotoGridFilterOptions,
  buildPhotoGridTabOptions,
  PHOTO_GRID_ENTRY_INTERACTION_STANDARD,
} from './screen-layout';
import { captureLastValidScanBaseline } from '../../services/notifications/cleanup-reminders';
import { notifyScanCompletionIfNeeded } from '../../services/notifications/scan-completion-notifications';

type PermissionState = 'loading' | 'granted' | 'denied';
type ScanScopeSelection = { total: number; photo: number; video: number };
type ScanProgressState = {
  current: number;
  total: number;
  currentFileName: string | null;
};
type ScanBatchRangeState = PhotoScanSessionRange | null;
type PhotoGridScreenProps = {
  recycleBinIds?: string[];
  onRecycleBinIdsChange?: (ids: string[]) => void;
};

function buildPhotoScanJobId(scanToken: number, startedAt: number) {
  return `photo-scan-${startedAt}-${scanToken}`;
}

function buildAutoResumeScanNotice(language: string) {
  if (language === 'zh-CN') {
    return '检测到 Android 本地扫描仍在继续，已自动接回当前批次。';
  }

  return 'Detected that the Android local scan is still running. The current batch has been reattached automatically.';
}

function formatScanRangeDate(value: number) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}.${month}.${day}`;
}

function buildScanBatchRangeLabel(
  language: string,
  range: ScanBatchRangeState,
  formatter: (start: string, end: string) => string,
) {
  if (!range?.endAt) {
    return null;
  }

  const startText =
    range.startAt === null
      ? language === 'zh-CN'
        ? '最早媒体'
        : 'Earliest media'
      : formatScanRangeDate(range.startAt);

  return formatter(startText, formatScanRangeDate(range.endAt));
}

function isResumablePhotoScanBatchPhase(phase: PhotoScanBatchRecord['phase']) {
  return (
    phase === 'queued' ||
    phase === 'enumeration' ||
    phase === 'analysis' ||
    phase === 'aggregation'
  );
}

function isCompletedPhotoScanBatchItemStage(stage: PhotoScanBatchItemStage) {
  return stage === 'completed';
}

function buildContiguousBatchCompletionCursor(options: {
  itemsById: ReadonlyMap<string, PhotoScanBatchItemRecord>;
  orderedAssetIds: readonly string[];
}) {
  let processedCount = 0;
  let lastProcessedAssetId: string | null = null;

  for (const assetId of options.orderedAssetIds) {
    const item = options.itemsById.get(assetId);

    if (!item || !isCompletedPhotoScanBatchItemStage(item.stage)) {
      break;
    }

    processedCount += 1;
    lastProcessedAssetId = assetId;
  }

  return {
    processedCount,
    lastProcessedAssetId,
  };
}

function buildRecoveryCheckpointFromBatch(options: {
  batch: PhotoScanBatchRecord;
  batchItems: readonly PhotoScanBatchItemRecord[];
  sourceCandidates: readonly CleanupCandidate[];
}): PhotoScanJobCheckpoint {
  const completionCursor = buildContiguousBatchCompletionCursor({
    itemsById: new Map(options.batchItems.map((item) => [item.assetId, item])),
    orderedAssetIds: options.sourceCandidates.map((candidate) => candidate.asset.id),
  });

  return {
    jobId: options.batch.batchId,
    phase: 'running',
    progressCurrent: options.batch.progressCurrent,
    progressTotal: options.batch.progressTotal,
    processedCount: completionCursor.processedCount,
    candidateCount: options.batch.candidateCount,
    startedAt: options.batch.startedAt,
    lastHeartbeatAt: options.batch.lastHeartbeatAt,
    currentFileName: null,
    lastProcessedAssetId: completionCursor.lastProcessedAssetId,
    lastError: options.batch.lastError,
    updatedAt: options.batch.updatedAt,
  };
}

function shouldPreserveGrantedActiveSnapshot(
  snapshot: PhotoScanSessionSnapshot | null | undefined,
) {
  return (
    snapshot?.permissionState === 'granted' &&
    (snapshot.phase === 'scanning' || snapshot.phase === 'completed')
  );
}

function buildSelectionToggleLabel(language: string, isAllSelected: boolean) {
  if (language === 'en-US') {
    return isAllSelected ? 'Deselect All' : 'Select All';
  }

  return isAllSelected ? '取消全选' : '全选';
}

function buildPhotoScanSessionPhase(options: {
  isScanning: boolean;
  hasCompletedScan: boolean;
  errorMessage: string | null;
}): PhotoScanSessionSnapshot['phase'] {
  if (options.isScanning) {
    return 'scanning';
  }

  if (options.hasCompletedScan) {
    return 'completed';
  }

  if (options.errorMessage) {
    return 'error';
  }

  return 'idle';
}

function createAuthorizedMediaCandidate(asset: MediaLibrary.Asset): CleanupCandidate | null {
  if (asset.mediaType !== MediaLibrary.MediaType.photo && asset.mediaType !== MediaLibrary.MediaType.video) {
    return null;
  }

  return createFallbackCandidate({
    id: asset.id,
    uri: asset.uri,
    previewUri: asset.uri,
    mediaType: asset.mediaType === MediaLibrary.MediaType.video ? 'video' : 'photo',
    width: asset.width ?? 0,
    height: asset.height ?? 0,
    duration: asset.duration ?? 0,
    fileSize: 0,
    creationTime: asset.creationTime ?? 0,
  });
}

function createAuthorizedMediaCandidateFromAndroidMediaStoreAsset(
  asset: AndroidMediaStoreAssetMetadata,
): CleanupCandidate {
  return createFallbackCandidate({
    id: asset.assetId,
    uri: asset.contentUri,
    previewUri: asset.contentUri,
    mediaType: asset.mediaType,
    width: asset.width,
    height: asset.height,
    duration: Math.max(0, asset.durationMs),
    fileSize: Math.max(0, asset.fileSizeBytes),
    creationTime: asset.dateTaken ?? asset.dateModified ?? 0,
  });
}

function buildScopeSelectionFromCandidates(candidates: CleanupCandidate[]): ScanScopeSelection {
  return candidates.reduce<ScanScopeSelection>(
    (summary, candidate) => {
      summary.total += 1;

      if (candidate.asset.mediaType === 'photo') {
        summary.photo += 1;
      }

      if (candidate.asset.mediaType === 'video') {
        summary.video += 1;
      }

      return summary;
    },
    { total: 0, photo: 0, video: 0 },
  );
}

function buildScopeSelectionFromManifestEntries(entries: readonly AssetManifestRecord[]): ScanScopeSelection {
  return entries.reduce<ScanScopeSelection>(
    (summary, entry) => {
      summary.total += 1;

      if (entry.mediaType === 'photo') {
        summary.photo += 1;
      }

      if (entry.mediaType === 'video') {
        summary.video += 1;
      }

      return summary;
    },
    { total: 0, photo: 0, video: 0 },
  );
}

function buildStreamingVisibleCandidates(
  baseCandidates: CleanupCandidate[],
  analyzedAssetIds: ReadonlySet<string>,
  analyzedInputsById: ReadonlyMap<string, AnalyzedMediaInput>,
  falsePositiveIds: readonly string[],
) {
  const falsePositiveIdSet = new Set(falsePositiveIds);
  const recognizedById = new Map(
    sortCandidatesByScore(
      buildCleanupCandidates([...analyzedInputsById.values()]).filter(
        (candidate) =>
          candidate.score >= ACTIONABLE_SCAN_THRESHOLD && !falsePositiveIdSet.has(candidate.id),
      ),
    ).map((candidate) => [candidate.id, candidate]),
  );

  return baseCandidates.flatMap((candidate) => {
    if (!analyzedAssetIds.has(candidate.id)) {
      return [candidate];
    }

    const recognizedCandidate = recognizedById.get(candidate.id);
    return recognizedCandidate ? [recognizedCandidate] : [];
  });
}

function getDuplicateGroupCandidates(
  candidates: CleanupCandidate[],
  candidate: CleanupCandidate | null,
) {
  const groupId = candidate?.duplicateGroup?.groupId;

  if (!groupId) {
    return [];
  }

  return candidates.filter((item) => item.duplicateGroup?.groupId === groupId);
}

function buildNextDetailViewState(
  snapshotCandidates: CleanupCandidate[],
  seedCandidate: CleanupCandidate | null,
  targetIds: readonly string[],
  activeId: string,
) {
  const targetIdSet = new Set(targetIds);
  const nextSnapshotCandidates = snapshotCandidates.filter((candidate) => !targetIdSet.has(candidate.id));

  if (!seedCandidate) {
    return {
      nextPreviewCandidate: null,
      nextSnapshotCandidates,
    };
  }

  const scopedCandidates = getDuplicateGroupCandidates(snapshotCandidates, seedCandidate);
  const detailCandidates = scopedCandidates.length > 0 ? scopedCandidates : [seedCandidate];
  const currentIndex = Math.max(
    0,
    detailCandidates.findIndex((candidate) => candidate.id === activeId),
  );
  const remainingDetailCandidates = detailCandidates.filter((candidate) => !targetIdSet.has(candidate.id));

  if (remainingDetailCandidates.length === 0) {
    return {
      nextPreviewCandidate: null,
      nextSnapshotCandidates,
    };
  }

  return {
    nextPreviewCandidate:
      remainingDetailCandidates[Math.min(currentIndex, remainingDetailCandidates.length - 1)] ?? null,
    nextSnapshotCandidates,
  };
}

function expandSelectedIdsForCleanup(candidates: CleanupCandidate[], selectedIds: string[]) {
  const selectedSet = new Set(selectedIds);
  const expanded = new Set<string>();
  const duplicateGroups = new Set<string>();

  for (const candidate of candidates) {
    if (!selectedSet.has(candidate.id)) {
      continue;
    }

    if (candidate.duplicateGroup?.groupId) {
      duplicateGroups.add(candidate.duplicateGroup.groupId);
      continue;
    }

    expanded.add(candidate.id);
  }

  for (const candidate of candidates) {
    if (candidate.duplicateGroup?.groupId && duplicateGroups.has(candidate.duplicateGroup.groupId)) {
      expanded.add(candidate.id);
    }
  }

  return [...expanded];
}

function filterFalsePositiveCandidates(
  candidates: CleanupCandidate[],
  falsePositiveIds: readonly string[],
) {
  if (falsePositiveIds.length === 0) {
    return candidates;
  }

  const falsePositiveIdSet = new Set(falsePositiveIds);
  return candidates.filter((candidate) => !falsePositiveIdSet.has(candidate.id));
}

function mergeRecycleBinCandidateCache(
  existingCandidates: readonly CleanupCandidate[],
  incomingCandidates: readonly CleanupCandidate[],
  recycleBinIds: readonly string[],
) {
  const mergedById = new Map<string, CleanupCandidate>();

  for (const candidate of existingCandidates) {
    mergedById.set(candidate.id, candidate);
  }

  for (const candidate of incomingCandidates) {
    mergedById.set(candidate.id, candidate);
  }

  return recycleBinIds
    .map((id) => mergedById.get(id))
    .filter((candidate): candidate is CleanupCandidate => Boolean(candidate));
}

function buildFilteredSummary(
  baseSummary: Pick<ScanSummary, 'scannedAt' | 'scannedCount' | 'recycleBinCount'>,
  candidates: CleanupCandidate[],
): ScanSummary {
  return {
    scannedAt: baseSummary.scannedAt,
    scannedCount: baseSummary.scannedCount,
    candidateCount: candidates.length,
    highConfidenceCount: candidates.filter((candidate) => candidate.confidence === 'high').length,
    mediumConfidenceCount: candidates.filter((candidate) => candidate.confidence === 'medium').length,
    recycleBinCount: baseSummary.recycleBinCount,
  };
}

function mergeRunningScanProgress(
  previous: ScanProgressState,
  next: ScanProgressState,
): ScanProgressState {
  const mergedCurrent = Math.max(previous.current, next.current);
  const mergedTotal = Math.max(previous.total, next.total, mergedCurrent);
  const shouldKeepPreviousFileName =
    mergedCurrent === previous.current &&
    next.current < previous.current &&
    Boolean(previous.currentFileName);

  return {
    current: mergedCurrent,
    total: mergedTotal,
    currentFileName: shouldKeepPreviousFileName
      ? previous.currentFileName
      : (next.currentFileName ?? previous.currentFileName),
  };
}

function applyBatchDisplayProgressOffset(
  progress: ScanProgressState,
  options: {
    dirtyTotal: number;
    displayTotal: number;
    completedOffset: number;
  },
): ScanProgressState {
  const shouldUseDisplayProgress =
    options.displayTotal > progress.total && progress.total === options.dirtyTotal;

  if (!shouldUseDisplayProgress) {
    return progress;
  }

  return {
    current: Math.min(options.completedOffset + progress.current, options.displayTotal),
    total: options.displayTotal,
    currentFileName: progress.currentFileName,
  };
}

function buildPhotoScanBatchRecord(options: {
  batchId: string;
  mode?: PhotoScanBatchRecord['mode'];
  windowDays?: number | null;
  phase: PhotoScanBatchRecord['phase'];
  progressCurrent: number;
  progressTotal: number;
  enumeratedCount: number;
  dirtyCount: number;
  analyzedCount: number;
  candidateCount: number;
  startedAt: number;
  lastHeartbeatAt: number;
  completedAt?: number | null;
  lastError?: string | null;
  updatedAt: number;
  rangeStartAt: number | null;
  rangeEndAt: number | null;
}): PhotoScanBatchRecord {
  return {
    batchId: options.batchId,
    mode: options.mode ?? 'rolling-window',
    windowDays: options.windowDays ?? DEFAULT_SCAN_WINDOW_DAYS,
    rangeStartAt: options.rangeStartAt,
    rangeEndAt: options.rangeEndAt,
    phase: options.phase,
    progressCurrent: options.progressCurrent,
    progressTotal: options.progressTotal,
    enumeratedCount: options.enumeratedCount,
    dirtyCount: options.dirtyCount,
    analyzedCount: options.analyzedCount,
    candidateCount: options.candidateCount,
    startedAt: options.startedAt,
    lastHeartbeatAt: options.lastHeartbeatAt,
    completedAt: options.completedAt ?? null,
    lastError: options.lastError ?? null,
    updatedAt: options.updatedAt,
  };
}

function buildPhotoScanBatchItemSnapshot(
  itemsById: ReadonlyMap<string, PhotoScanBatchItemRecord>,
) {
  return [...itemsById.values()].sort(
    (left, right) => left.updatedAt - right.updatedAt || left.assetId.localeCompare(right.assetId),
  );
}

function countCompletedPhotoScanBatchItems(
  itemsById: ReadonlyMap<string, PhotoScanBatchItemRecord>,
) {
  let completedCount = 0;

  itemsById.forEach((item) => {
    if (isCompletedPhotoScanBatchItemStage(item.stage)) {
      completedCount += 1;
    }
  });

  return completedCount;
}

function updatePhotoScanBatchItemsCompletedByIds(
  itemsById: Map<string, PhotoScanBatchItemRecord>,
  assetIds: readonly string[],
  updatedAt: number,
) {
  assetIds.forEach((assetId) => {
    const previous = itemsById.get(assetId);

    if (!previous) {
      return;
    }

    itemsById.set(assetId, {
      ...previous,
      stage: 'completed',
      attemptCount: Math.max(previous.attemptCount, 1),
      lastHeartbeatAt: updatedAt,
      lastError: null,
      updatedAt,
    });
  });
}

function updatePhotoScanBatchItemsCompletedThroughAsset(
  itemsById: Map<string, PhotoScanBatchItemRecord>,
  orderedAssetIds: readonly string[],
  lastProcessedAssetId: string | null,
  updatedAt: number,
) {
  if (!lastProcessedAssetId) {
    return;
  }

  const lastProcessedIndex = orderedAssetIds.indexOf(lastProcessedAssetId);
  if (lastProcessedIndex < 0) {
    return;
  }

  updatePhotoScanBatchItemsCompletedByIds(
    itemsById,
    orderedAssetIds.slice(0, lastProcessedIndex + 1),
    updatedAt,
  );
}

function buildAssetManifestEntriesFromCandidates(
  sourceCandidates: readonly CleanupCandidate[],
  existingEntries: readonly AssetManifestRecord[],
  analysisCache: MediaAnalysisCache,
  observedAt: number,
) {
  const existingEntriesById = new Map(existingEntries.map((entry) => [entry.assetId, entry]));

  return sourceCandidates.map<AssetManifestRecord>((candidate) => {
    const existingEntry = existingEntriesById.get(candidate.asset.id);
    const fileSizeBytes =
      candidate.asset.fileSize > 0
        ? candidate.asset.fileSize
        : existingEntry?.fileSizeBytes ?? null;
    const dateTaken =
      candidate.asset.creationTime > 0
        ? candidate.asset.creationTime
        : existingEntry?.dateTaken ?? null;
    const aspectRatio =
      candidate.asset.width > 0 && candidate.asset.height > 0
        ? candidate.asset.width / candidate.asset.height
        : existingEntry?.aspectRatio ?? null;
    const didMetadataChange =
      existingEntry !== undefined &&
      (
        existingEntry.contentUri !== candidate.asset.uri ||
        existingEntry.mediaType !== candidate.asset.mediaType ||
        existingEntry.width !== candidate.asset.width ||
        existingEntry.height !== candidate.asset.height ||
        existingEntry.durationMs !== candidate.asset.duration ||
        existingEntry.fileSizeBytes !== fileSizeBytes ||
        existingEntry.dateTaken !== dateTaken
      );
    const dirtyReason =
      existingEntry === undefined
        ? 'new'
        : didMetadataChange
          ? 'modified'
          : analysisCache[candidate.asset.id]
            ? null
            : 'missing-analysis';

    return {
      assetId: candidate.asset.id,
      contentUri: candidate.asset.uri,
      mediaType: candidate.asset.mediaType,
      mimeType: existingEntry?.mimeType ?? null,
      width: candidate.asset.width,
      height: candidate.asset.height,
      orientation: existingEntry?.orientation ?? null,
      aspectRatio,
      durationMs: candidate.asset.duration,
      fileSizeBytes,
      dateTaken,
      dateModified: existingEntry?.dateModified ?? null,
      bucketId: existingEntry?.bucketId ?? null,
      bucketName: existingEntry?.bucketName ?? null,
      isScreenshot: existingEntry?.isScreenshot ?? null,
      bitrate: existingEntry?.bitrate ?? null,
      frameRate: existingEntry?.frameRate ?? null,
      codec: existingEntry?.codec ?? null,
      firstSeenAt: existingEntry?.firstSeenAt ?? observedAt,
      lastSeenAt: observedAt,
      isDeleted: false,
      dirtyReason,
      updatedAt: observedAt,
    };
  });
}

function buildAssetManifestEntriesFromAndroidMediaStoreAssets(
  sourceAssets: readonly AndroidMediaStoreAssetMetadata[],
  existingEntries: readonly AssetManifestRecord[],
  analysisCache: MediaAnalysisCache,
  observedAt: number,
) {
  const existingEntriesById = new Map(existingEntries.map((entry) => [entry.assetId, entry]));

  return sourceAssets.map<AssetManifestRecord>((asset) => {
    const existingEntry = existingEntriesById.get(asset.assetId);
    const didMetadataChange =
      existingEntry !== undefined &&
      (
        existingEntry.contentUri !== asset.contentUri ||
        existingEntry.mediaType !== asset.mediaType ||
        existingEntry.mimeType !== asset.mimeType ||
        existingEntry.width !== asset.width ||
        existingEntry.height !== asset.height ||
        existingEntry.orientation !== asset.orientation ||
        existingEntry.aspectRatio !== asset.aspectRatio ||
        existingEntry.durationMs !== asset.durationMs ||
        existingEntry.fileSizeBytes !== asset.fileSizeBytes ||
        existingEntry.dateTaken !== asset.dateTaken ||
        existingEntry.dateModified !== asset.dateModified ||
        existingEntry.bucketId !== asset.bucketId ||
        existingEntry.bucketName !== asset.bucketName ||
        existingEntry.isScreenshot !== asset.isScreenshot ||
        existingEntry.bitrate !== asset.bitrate ||
        existingEntry.frameRate !== asset.frameRate ||
        existingEntry.codec !== asset.codec
      );
    const dirtyReason =
      existingEntry === undefined
        ? 'new'
        : didMetadataChange
          ? 'modified'
          : analysisCache[asset.assetId]
            ? null
            : 'missing-analysis';

    return {
      assetId: asset.assetId,
      contentUri: asset.contentUri,
      mediaType: asset.mediaType,
      mimeType: asset.mimeType,
      width: asset.width,
      height: asset.height,
      orientation: asset.orientation,
      aspectRatio: asset.aspectRatio,
      durationMs: asset.durationMs,
      fileSizeBytes: asset.fileSizeBytes,
      dateTaken: asset.dateTaken,
      dateModified: asset.dateModified,
      bucketId: asset.bucketId,
      bucketName: asset.bucketName,
      isScreenshot: asset.isScreenshot,
      bitrate: asset.bitrate,
      frameRate: asset.frameRate,
      codec: asset.codec,
      firstSeenAt: existingEntry?.firstSeenAt ?? observedAt,
      lastSeenAt: observedAt,
      isDeleted: false,
      dirtyReason,
      updatedAt: observedAt,
    };
  });
}

function buildDirtyCandidatesFromManifestEntries(
  manifestEntries: readonly AssetManifestRecord[],
  falsePositiveIds: readonly string[],
) {
  const falsePositiveIdSet = new Set(falsePositiveIds);

  return manifestEntries.flatMap((entry) => {
    if (entry.dirtyReason === null || falsePositiveIdSet.has(entry.assetId)) {
      return [];
    }

    return [
      createFallbackCandidate({
        id: entry.assetId,
        uri: entry.contentUri,
        previewUri: entry.contentUri,
        mediaType: entry.mediaType === 'video' ? 'video' : 'photo',
        width: entry.width,
        height: entry.height,
        duration: entry.durationMs,
        fileSize: entry.fileSizeBytes ?? 0,
        creationTime: entry.dateTaken ?? entry.dateModified ?? 0,
      }),
    ];
  });
}

function buildWindowDaysFromRange(rangeStartAt: number | null, rangeEndAt: number) {
  if (rangeStartAt === null) {
    return null;
  }

  return Math.max(1, Math.round((rangeEndAt - rangeStartAt) / (24 * 60 * 60 * 1000)));
}

function isCompletedPhotoScanBatchPhase(phase: PhotoScanBatchRecord['phase']) {
  return phase === 'completed';
}

function isCompatiblePhotoScanWindowDays(
  latestWindowDays: number | null,
  configuredWindowDays: number | null,
) {
  if (latestWindowDays === null || configuredWindowDays === null) {
    return false;
  }

  return Math.abs(latestWindowDays - configuredWindowDays) <= 1;
}

export function resolveConfiguredScanWindow(options: {
  scanRangeMonths: ScanRange;
  latestCompletedBatch: PhotoScanBatchRecord | null;
  nowInput?: number;
}):
  | {
      status: 'ready';
      mode: 'rolling-window' | 'backfill';
      rangeStartAt: number | null;
      rangeEndAt: number;
      windowDays: number | null;
    }
  | {
      status: 'complete';
      mode: 'complete';
      rangeStartAt: null;
      rangeEndAt: number;
      windowDays: null;
    } {
  const rollingRangeEndAt = options.nowInput ?? Date.now();
  const rollingRangeStartAt = buildScanRangeStartAt(options.scanRangeMonths, rollingRangeEndAt);
  const rollingWindowDays = buildWindowDaysFromRange(rollingRangeStartAt, rollingRangeEndAt);
  const latestCompletedBatch = options.latestCompletedBatch;

  if (
    latestCompletedBatch &&
    isCompletedPhotoScanBatchPhase(latestCompletedBatch.phase) &&
    latestCompletedBatch.mode === 'full'
  ) {
    return {
      status: 'complete',
      mode: 'complete',
      rangeStartAt: null,
      rangeEndAt: rollingRangeEndAt,
      windowDays: null,
    };
  }

  if (
    !latestCompletedBatch ||
    !isCompletedPhotoScanBatchPhase(latestCompletedBatch.phase) ||
    latestCompletedBatch.rangeStartAt === null ||
    latestCompletedBatch.mode === 'repair'
  ) {
    return {
      status: 'ready',
      mode: 'rolling-window' as const,
      rangeStartAt: rollingRangeStartAt,
      rangeEndAt: rollingRangeEndAt,
      windowDays: rollingWindowDays,
    };
  }

  if (!isCompatiblePhotoScanWindowDays(latestCompletedBatch.windowDays, rollingWindowDays)) {
    return {
      status: 'ready',
      mode: 'rolling-window' as const,
      rangeStartAt: rollingRangeStartAt,
      rangeEndAt: rollingRangeEndAt,
      windowDays: rollingWindowDays,
    };
  }

  const backfillRangeEndAt = latestCompletedBatch.rangeStartAt;
  const backfillRangeStartAt = buildScanRangeStartAt(
    options.scanRangeMonths,
    backfillRangeEndAt,
  );

  return {
    status: 'ready',
    mode: 'backfill' as const,
    rangeStartAt: backfillRangeStartAt,
    rangeEndAt: backfillRangeEndAt,
    windowDays: buildWindowDaysFromRange(backfillRangeStartAt, backfillRangeEndAt),
  };
}

function buildInitialPhotoScanBatchItems(
  batchId: string,
  sourceCandidates: readonly CleanupCandidate[],
  manifestEntries: readonly AssetManifestRecord[],
  updatedAt: number,
) {
  const manifestById = new Map(manifestEntries.map((entry) => [entry.assetId, entry]));

  return sourceCandidates.map<PhotoScanBatchItemRecord>((candidate) => ({
    batchId,
    assetId: candidate.asset.id,
    stage: 'queued',
    mediaType: candidate.asset.mediaType,
    dirtyReason: manifestById.get(candidate.asset.id)?.dirtyReason ?? null,
    attemptCount: 0,
    workerSlot: null,
    lastHeartbeatAt: null,
    lastError: null,
    updatedAt,
  }));
}

export function PhotoGridScreen({
  recycleBinIds = [],
  onRecycleBinIdsChange,
}: PhotoGridScreenProps) {
  const initialRuntimeSnapshot = getPhotoScanSessionRuntimeSnapshot();
  const initialPermissionState =
    initialRuntimeSnapshot?.permissionState && initialRuntimeSnapshot.permissionState !== 'loading'
      ? initialRuntimeSnapshot.permissionState
      : 'loading';
  const initialAuthorizedCandidates = initialRuntimeSnapshot?.authorizedCandidates ?? [];
  const initialVisibleCandidates =
    initialRuntimeSnapshot?.phase === 'completed' || initialRuntimeSnapshot?.phase === 'scanning'
      ? initialRuntimeSnapshot.visibleCandidates
      : initialAuthorizedCandidates;
  const initialScanScopeSelection = initialRuntimeSnapshot?.scanScopeSelection ?? {
    total: PHOTO_GRID_ENTRY_INTERACTION_STANDARD.defaultScanScopeCount,
    photo: 0,
    video: 0,
  };
  const initialScanProgress = initialRuntimeSnapshot?.scanProgress ?? {
    current: 0,
    total: PHOTO_GRID_ENTRY_INTERACTION_STANDARD.defaultScanScopeCount,
    currentFileName: null as string | null,
  };
  const initialScanBatchRange = initialRuntimeSnapshot?.scanBatchRange ?? null;
  const initialIsScanning = initialRuntimeSnapshot?.phase === 'scanning';
  const initialHasCompletedScan = initialRuntimeSnapshot?.phase === 'completed';
  const initialHasCompletedFullScan = initialRuntimeSnapshot?.hasCompletedFullScan ?? false;

  const { copy, theme, language } = useAppPreferences();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme, insets), [insets, theme]);
  const filterOptions = useMemo(() => buildPhotoGridFilterOptions(copy), [copy]);
  const contentPadding = useMemo(() => buildPhotoGridContentPadding(insets), [insets]);
  const scanScopeCount = PHOTO_GRID_ENTRY_INTERACTION_STANDARD.defaultScanScopeCount;

  const [permissionState, setPermissionState] = useState<PermissionState>(initialPermissionState);
  const [filter, setFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [candidates, setCandidates] = useState<CleanupCandidate[]>(
    initialHasCompletedScan ? initialVisibleCandidates : [],
  );
  const [authorizedCandidates, setAuthorizedCandidates] = useState<CleanupCandidate[]>(
    initialAuthorizedCandidates,
  );
  const [streamingCandidates, setStreamingCandidates] = useState<CleanupCandidate[]>(
    initialIsScanning ? initialVisibleCandidates : initialAuthorizedCandidates,
  );
  const [previewCandidate, setPreviewCandidate] = useState<CleanupCandidate | null>(null);
  const [previewSnapshotCandidates, setPreviewSnapshotCandidates] = useState<CleanupCandidate[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    initialRuntimeSnapshot?.errorMessage ?? null,
  );
  const [resumeMessage, setResumeMessage] = useState<string | null>(null);
  const [resumeScanNonce, setResumeScanNonce] = useState(0);
  const [isScanning, setIsScanning] = useState(initialIsScanning);
  const [hasCompletedScan, setHasCompletedScan] = useState(initialHasCompletedScan);
  const [hasCompletedFullScan, setHasCompletedFullScan] = useState(initialHasCompletedFullScan);
  const [scanResultsCount, setScanResultsCount] = useState(
    initialRuntimeSnapshot?.scanResultsCount ?? 0,
  );
  const [scanProgress, setScanProgress] = useState<ScanProgressState>(initialScanProgress);
  const [scanBatchRange, setScanBatchRange] = useState<ScanBatchRangeState>(
    initialScanBatchRange,
  );
  const [scanScopeSelection, setScanScopeSelection] = useState<ScanScopeSelection>(
    initialScanScopeSelection,
  );
  const activeScanTokenRef = useRef(0);
  const isStartingScanRef = useRef(false);
  const activeScanJobIdRef = useRef<string | null>(null);
  const activeScanBatchRef = useRef<PhotoScanBatchRecord | null>(null);
  const activeScanBatchItemsRef = useRef<Map<string, PhotoScanBatchItemRecord>>(new Map());
  const lastPersistedBatchItemsProcessedCountRef = useRef(0);
  const authorizedCandidatesRef = useRef<CleanupCandidate[]>(initialAuthorizedCandidates);
  const activeScanCheckpointRef = useRef({
    current: initialScanProgress.current,
    total: initialScanProgress.total,
    currentFileName: initialScanProgress.currentFileName,
    processedCount: 0,
    lastProcessedAssetId: null as string | null,
  });
  const lastProgressCheckpointPersistAtRef = useRef(0);
  const falsePositiveIdsRef = useRef<string[]>([]);
  const recycleBinIdsRef = useRef<string[]>(recycleBinIds);
  const recycleBinCandidateCacheRef = useRef<CleanupCandidate[]>([]);
  const isPreviewOpenRef = useRef(false);
  const appStateRef = useRef(AppState.currentState ?? 'active');
  const deferredPreviewScanStateRef = useRef<{
    scanProgress?: ScanProgressState;
    streamingCandidates?: CleanupCandidate[];
    scanScopeSelection?: ScanScopeSelection;
  } | null>(null);
  const pendingResumeScanJobRef = useRef<PhotoScanJobCheckpoint | null>(null);
  const pendingResumeNativeSnapshotRef = useRef<AndroidNativeScanRuntimeSnapshot | null>(null);
  const pendingResumeScanBatchRangeRef = useRef<ScanBatchRangeState>(null);
  const foregroundServiceOwnerRef = useRef<'native' | 'js' | null>(null);
  const scanSummaryRef = useRef<Pick<ScanSummary, 'scannedAt' | 'scannedCount' | 'recycleBinCount'>>({
    scannedAt: initialRuntimeSnapshot?.summary.scannedAt ?? 0,
    scannedCount: initialRuntimeSnapshot?.summary.scannedCount ?? scanScopeCount,
    recycleBinCount: initialRuntimeSnapshot?.summary.recycleBinCount ?? 0,
  });
  const displayedCandidates = useMemo(
    () => (hasCompletedScan ? candidates : isScanning ? streamingCandidates : authorizedCandidates),
    [authorizedCandidates, candidates, hasCompletedScan, isScanning, streamingCandidates],
  );

  useEffect(() => {
    recycleBinIdsRef.current = recycleBinIds;
    scanSummaryRef.current = {
      ...scanSummaryRef.current,
      recycleBinCount: recycleBinIds.length,
    };
  }, [recycleBinIds]);

  useEffect(() => {
    authorizedCandidatesRef.current = authorizedCandidates;
  }, [authorizedCandidates]);

  const applyRunningScanProgress = useCallback((nextProgress: ScanProgressState) => {
    let mergedProgress = nextProgress;

    setScanProgress((previous) => {
      mergedProgress = mergeRunningScanProgress(previous, nextProgress);
      return mergedProgress;
    });

    activeScanCheckpointRef.current = {
      ...activeScanCheckpointRef.current,
      current: mergedProgress.current,
      total: mergedProgress.total,
      currentFileName: mergedProgress.currentFileName,
    };

    return mergedProgress;
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      appStateRef.current = nextState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => () => {
    void persistPhotoScanSessionRuntimeSnapshot(getPhotoScanSessionRuntimeSnapshot());
  }, []);

  const entryScanScopeCount = isScanning ? scanProgress.total : scanScopeSelection.total;
  const scanBatchRangeLabel = useMemo(
    () =>
      buildScanBatchRangeLabel(
        language,
        scanBatchRange,
        copy.screens.photoGrid.scanBatchRange,
      ),
    [copy.screens.photoGrid.scanBatchRange, language, scanBatchRange],
  );
  const entryCopy = useMemo(
    () =>
      buildPhotoGridEntryCopy(copy, {
        permissionState,
        scanScopeCount: entryScanScopeCount,
        isScanning,
        hasCompletedScan,
        hasCompletedFullScan,
        progressCurrent: scanProgress.current,
        progressTotal: scanProgress.total,
        currentFileName: scanProgress.currentFileName,
        resultCount: scanResultsCount,
        scanRangeLabel: scanBatchRangeLabel,
        liveCandidates: hasCompletedScan ? displayedCandidates : undefined,
      }),
    [
      copy,
      displayedCandidates,
      entryScanScopeCount,
      permissionState,
      isScanning,
      hasCompletedScan,
      hasCompletedFullScan,
      scanProgress.current,
      scanProgress.currentFileName,
      scanProgress.total,
      scanBatchRangeLabel,
      scanResultsCount,
    ],
  );
  const tabOptions = useMemo(
    () => (permissionState === 'granted' ? buildPhotoGridTabOptions(copy, scanScopeSelection) : filterOptions),
    [copy, filterOptions, permissionState, scanScopeSelection],
  );
  const isSelectionMode = selectedIds.length > 0;
  const previewDuplicateCandidates = useMemo(
    () => getDuplicateGroupCandidates(previewSnapshotCandidates ?? [], previewCandidate),
    [previewCandidate, previewSnapshotCandidates],
  );
  const selectableCandidates = useMemo(
    () =>
      filter === 'all'
        ? displayedCandidates
        : displayedCandidates.filter((candidate) => candidate.asset.mediaType === filter),
    [displayedCandidates, filter],
  );
  const isAllSelectableSelected = useMemo(() => {
    if (selectableCandidates.length === 0) {
      return false;
    }

    const selectedIdSet = new Set(selectedIds);
    return selectableCandidates.every((candidate) => selectedIdSet.has(candidate.id));
  }, [selectableCandidates, selectedIds]);

  const buildCurrentSessionSnapshot = useCallback((overrides?: {
    phase?: PhotoScanSessionSnapshot['phase'];
    permissionState?: PermissionState;
    authorizedCandidates?: CleanupCandidate[];
    visibleCandidates?: CleanupCandidate[];
    scanResultsCount?: number;
    scanProgress?: ScanProgressState;
    scanScopeSelection?: ScanScopeSelection;
    scanBatchRange?: ScanBatchRangeState;
    hasCompletedFullScan?: boolean;
    errorMessage?: string | null;
    summary?: Pick<ScanSummary, 'scannedAt' | 'scannedCount' | 'recycleBinCount'>;
  }): PhotoScanSessionSnapshot => ({
    permissionState: overrides?.permissionState ?? permissionState,
    phase:
      overrides?.phase ??
      buildPhotoScanSessionPhase({
        isScanning,
        hasCompletedScan,
        errorMessage,
      }),
    authorizedCandidates: overrides?.authorizedCandidates ?? authorizedCandidates,
    visibleCandidates:
      overrides?.visibleCandidates ??
      (hasCompletedScan ? candidates : isScanning ? streamingCandidates : authorizedCandidates),
    scanResultsCount: overrides?.scanResultsCount ?? scanResultsCount,
    scanProgress: overrides?.scanProgress ?? scanProgress,
    scanScopeSelection: overrides?.scanScopeSelection ?? scanScopeSelection,
    scanBatchRange: overrides?.scanBatchRange ?? scanBatchRange,
    summary: overrides?.summary ?? scanSummaryRef.current,
    hasCompletedFullScan: overrides?.hasCompletedFullScan ?? hasCompletedFullScan,
    errorMessage: overrides?.errorMessage ?? errorMessage,
    updatedAt: Date.now(),
  }), [
    authorizedCandidates,
    candidates,
    errorMessage,
    hasCompletedScan,
    hasCompletedFullScan,
    isScanning,
    permissionState,
    scanBatchRange,
    scanProgress,
    scanResultsCount,
    scanScopeSelection,
    streamingCandidates,
  ]);

  const applySessionSnapshot = useCallback((snapshot: PhotoScanSessionSnapshot) => {
    scanSummaryRef.current = {
      scannedAt: snapshot.summary.scannedAt,
      scannedCount: snapshot.summary.scannedCount,
      recycleBinCount: snapshot.summary.recycleBinCount,
    };

    setPermissionState(snapshot.permissionState);
    setAuthorizedCandidates(snapshot.authorizedCandidates);
    setSelectedIds([]);
    setScanScopeSelection(snapshot.scanScopeSelection);
    setScanProgress(snapshot.scanProgress);
    setScanBatchRange(snapshot.scanBatchRange ?? null);
    setScanResultsCount(snapshot.scanResultsCount);
    setHasCompletedFullScan(snapshot.hasCompletedFullScan === true);
    setErrorMessage(snapshot.errorMessage);

    if (snapshot.phase === 'completed') {
      setCandidates(snapshot.visibleCandidates);
      setStreamingCandidates(snapshot.visibleCandidates);
      setIsScanning(false);
      setHasCompletedScan(true);
      return;
    }

    if (snapshot.phase === 'scanning') {
      setCandidates([]);
      setStreamingCandidates(snapshot.visibleCandidates);
      setIsScanning(true);
      setHasCompletedScan(false);
      setHasCompletedFullScan(false);
      return;
    }

    if (snapshot.phase === 'error') {
      setCandidates([]);
      setStreamingCandidates(snapshot.visibleCandidates);
      setIsScanning(false);
      setHasCompletedScan(false);
      setHasCompletedFullScan(false);
      return;
    }

    setCandidates([]);
    setStreamingCandidates(snapshot.authorizedCandidates);
    setIsScanning(false);
    setHasCompletedScan(false);
    setHasCompletedFullScan(false);
  }, []);

  useEffect(() => {
    const phase = buildPhotoScanSessionPhase({
      isScanning,
      hasCompletedScan,
      errorMessage,
    });

    if (permissionState === 'loading') {
      return;
    }

    stagePhotoScanSessionRuntimeSnapshot(
      buildCurrentSessionSnapshot({
        phase,
      }),
    );
  }, [
    buildCurrentSessionSnapshot,
    errorMessage,
    hasCompletedScan,
    isScanning,
    permissionState,
  ]);

  const syncAndroidForegroundScanProgress = useCallback((nextOptions: {
    isScanning: boolean;
    progressCurrent: number;
    progressTotal: number;
    currentFileName: string | null;
  }) => {
    if (Platform.OS !== 'android') {
      return;
    }

    void syncAndroidBackgroundScanForegroundService({
      language,
      isScanning: nextOptions.isScanning,
      progressCurrent: nextOptions.progressCurrent,
      progressTotal: nextOptions.progressTotal,
      currentFileName: nextOptions.currentFileName,
    }).catch((error) => {
      console.error('Failed to sync Android background scan foreground service:', error);
    });
  }, [language]);

  const hydrateAuthorizedState = useCallback(async (options?: {
    ignoreCachedResult?: boolean;
    preserveRunningProgress?: boolean;
  }) => {
    const [cachedResult, falsePositiveIds, recycleBinCandidateCache] = await Promise.all([
      options?.ignoreCachedResult ? Promise.resolve(null) : loadPhotoScanResultCache(),
      loadFalsePositiveCandidateIds(),
      loadRecycleBinCandidateCache(),
    ]);
    const latestScanBatch = cachedResult ? await loadLatestCompletedPhotoScanBatch() : null;
    const scanRangeMonths = await loadScanRange();
    const rangeEndAt = Date.now();
    const createdAfter = buildScanRangeStartAt(scanRangeMonths, rangeEndAt);
    const enumeratedAndroidAssets =
      Platform.OS === 'android'
        ? await enumerateAndroidMediaStoreAssets({ createdAfter })
        : [];
    const recentAssets =
      enumeratedAndroidAssets.length > 0
        ? enumeratedAndroidAssets
            .filter((asset) => !falsePositiveIds.includes(asset.assetId))
            .map((asset) => createAuthorizedMediaCandidateFromAndroidMediaStoreAsset(asset))
        : (
            await loadRecentScanAssets({
              excludedAssetIds: falsePositiveIds,
              createdAfter,
            })
          )
            .map((asset) => createAuthorizedMediaCandidate(asset))
            .filter((candidate): candidate is CleanupCandidate => Boolean(candidate));
    falsePositiveIdsRef.current = falsePositiveIds;
    recycleBinCandidateCacheRef.current = recycleBinCandidateCache;
    const nextAuthorizedCandidates = recentAssets;
    const nextSelection = buildScopeSelectionFromCandidates(nextAuthorizedCandidates);
    authorizedCandidatesRef.current = nextAuthorizedCandidates;

    setScanScopeSelection(nextSelection);
    setAuthorizedCandidates(nextAuthorizedCandidates);
    if (!options?.preserveRunningProgress) {
      setStreamingCandidates(nextAuthorizedCandidates);
    }
    setResumeMessage(null);

    if (!cachedResult) {
      scanSummaryRef.current = {
        scannedAt: 0,
        scannedCount: nextSelection.total,
        recycleBinCount: 0,
      };
      setCandidates([]);
      setSelectedIds([]);
      setScanResultsCount(0);
      setIsScanning(Boolean(options?.preserveRunningProgress));
      setHasCompletedScan(false);
      setHasCompletedFullScan(false);
      if (!options?.preserveRunningProgress) {
        setScanBatchRange({ startAt: createdAfter, endAt: rangeEndAt });
      }
      if (options?.preserveRunningProgress) {
        applyRunningScanProgress({
          current: 0,
          total: nextSelection.total,
          currentFileName: null,
        });
      } else {
        setScanProgress({
          current: 0,
          total: nextSelection.total,
          currentFileName: null,
        });
      }
      return {
        authorizedCandidates: nextAuthorizedCandidates,
        scanScopeSelection: nextSelection,
      };
    }

    scanSummaryRef.current = {
      scannedAt: cachedResult.summary.scannedAt,
      scannedCount: cachedResult.summary.scannedCount,
      recycleBinCount: cachedResult.summary.recycleBinCount,
    };
    const filteredCachedCandidates = filterFalsePositiveCandidates(
      cachedResult.activeCandidates,
      falsePositiveIds,
    );

    setCandidates(filteredCachedCandidates);
    setStreamingCandidates(filteredCachedCandidates);
    setSelectedIds([]);
    setScanResultsCount(filteredCachedCandidates.length);
    setScanScopeSelection(buildScopeSelectionFromCandidates(filteredCachedCandidates));
    setHasCompletedFullScan(
      latestScanBatch?.phase === 'completed' && latestScanBatch.mode === 'full',
    );
    setScanBatchRange(
      latestScanBatch
        ? {
            startAt: latestScanBatch.rangeStartAt,
            endAt: latestScanBatch.rangeEndAt,
          }
        : null,
    );
    setScanProgress({
      current: cachedResult.summary.scannedCount,
      total: cachedResult.summary.scannedCount,
      currentFileName: null,
    });
    setIsScanning(false);
    setHasCompletedScan(true);

    if (filteredCachedCandidates.length !== cachedResult.activeCandidates.length) {
      await savePhotoScanResultCache({
        activeCandidates: filteredCachedCandidates,
        summary: buildFilteredSummary(scanSummaryRef.current, filteredCachedCandidates),
      });
    }
    return {
      authorizedCandidates: nextAuthorizedCandidates,
      scanScopeSelection: nextSelection,
    };
  }, [applyRunningScanProgress]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function refreshAuthorizedState() {
        try {
          if (!isActive) {
            return;
          }

          await hydrateAuthorizedState();
        } catch {
          if (isActive) {
            setScanScopeSelection({ total: 0, photo: 0, video: 0 });
            setAuthorizedCandidates([]);
            setCandidates([]);
            setStreamingCandidates([]);
            setScanBatchRange(null);
            setIsScanning(false);
            setHasCompletedScan(false);
            setHasCompletedFullScan(false);
          }
        }
      }

      async function restorePendingScanIfNeeded() {
        const runtimeSnapshot = getPhotoScanSessionRuntimeSnapshot();
        const [persistedSession, pendingScanJob, nativeRuntimeSnapshot, latestScanBatch] = await Promise.all([
          hydratePhotoScanSessionRuntimeSnapshot(),
          loadPhotoScanJobCheckpoint(),
          loadActiveAndroidNativeScanSnapshot(),
          loadLatestPhotoScanBatch(),
        ]);
        let effectivePendingScanJob = pendingScanJob;
        let effectivePendingScanBatch = latestScanBatch;

        if (!isActive) {
          return true;
        }

        if (nativeRuntimeSnapshot?.status.phase === 'running') {
          setIsScanning(true);
          setHasCompletedScan(false);
          setHasCompletedFullScan(false);
          setScanBatchRange(
            latestScanBatch?.batchId === nativeRuntimeSnapshot.status.jobId
              ? {
                  startAt: latestScanBatch.rangeStartAt,
                  endAt: latestScanBatch.rangeEndAt,
                }
              : null,
          );
          applyRunningScanProgress({
            current: nativeRuntimeSnapshot.status.current,
            total: nativeRuntimeSnapshot.status.total,
            currentFileName: nativeRuntimeSnapshot.status.currentFileName,
          });

          await hydrateAuthorizedState({ ignoreCachedResult: true, preserveRunningProgress: true });

          if (!isActive) {
            return true;
          }

          pendingResumeNativeSnapshotRef.current = nativeRuntimeSnapshot;
          pendingResumeScanBatchRangeRef.current =
            latestScanBatch?.batchId === nativeRuntimeSnapshot.status.jobId
              ? {
                  startAt: latestScanBatch.rangeStartAt,
                  endAt: latestScanBatch.rangeEndAt,
                }
              : null;
          pendingResumeScanJobRef.current = {
            jobId: nativeRuntimeSnapshot.status.jobId,
            phase: 'running',
            progressCurrent: nativeRuntimeSnapshot.status.current,
            progressTotal: nativeRuntimeSnapshot.status.total,
            processedCount: 0,
            candidateCount: 0,
            startedAt: nativeRuntimeSnapshot.status.startedAt,
            lastHeartbeatAt: nativeRuntimeSnapshot.status.updatedAt,
            currentFileName: nativeRuntimeSnapshot.status.currentFileName,
            lastProcessedAssetId: null,
            lastError: null,
            updatedAt: nativeRuntimeSnapshot.status.updatedAt,
          };
          setResumeMessage(buildAutoResumeScanNotice(language));
          setResumeScanNonce((value) => value + 1);
          return true;
        }

        if (nativeRuntimeSnapshot) {
          await stopAndroidNativeScan().catch(() => undefined);

          if (
            effectivePendingScanJob?.phase === 'running' &&
            effectivePendingScanJob.jobId === nativeRuntimeSnapshot.status.jobId
          ) {
            await clearPhotoScanJobCheckpoint().catch(() => undefined);
            effectivePendingScanJob = null;
          }
        }

        if (runtimeSnapshot && persistedSession && persistedSession.phase !== 'idle') {
          const [falsePositiveIds, recycleBinCandidateCache] = await Promise.all([
            loadFalsePositiveCandidateIds(),
            loadRecycleBinCandidateCache(),
          ]);

          falsePositiveIdsRef.current = falsePositiveIds;
          recycleBinCandidateCacheRef.current = recycleBinCandidateCache;

          if (!isActive) {
            return true;
          }

          applySessionSnapshot(persistedSession);
          return true;
        }

        if (effectivePendingScanJob?.phase === 'running') {
          setIsScanning(true);
          setHasCompletedScan(false);
          setHasCompletedFullScan(false);
          setScanBatchRange(
            latestScanBatch?.batchId === effectivePendingScanJob.jobId
              ? {
                  startAt: latestScanBatch.rangeStartAt,
                  endAt: latestScanBatch.rangeEndAt,
                }
              : null,
          );
          applyRunningScanProgress({
            current: effectivePendingScanJob.progressCurrent,
            total: effectivePendingScanJob.progressTotal,
            currentFileName: effectivePendingScanJob.currentFileName,
          });

          await hydrateAuthorizedState({ ignoreCachedResult: true, preserveRunningProgress: true });

          if (!isActive) {
            return true;
          }

          pendingResumeScanJobRef.current = effectivePendingScanJob;
          pendingResumeScanBatchRangeRef.current =
            latestScanBatch?.batchId === effectivePendingScanJob.jobId
              ? {
                  startAt: latestScanBatch.rangeStartAt,
                  endAt: latestScanBatch.rangeEndAt,
                }
              : null;
          setResumeMessage(buildAutoResumeScanNotice(language));
          setResumeScanNonce((value) => value + 1);
          return true;
        }

        if (effectivePendingScanBatch && isResumablePhotoScanBatchPhase(effectivePendingScanBatch.phase)) {
          setIsScanning(true);
          setHasCompletedScan(false);
          setHasCompletedFullScan(false);
          setScanBatchRange({
            startAt: effectivePendingScanBatch.rangeStartAt,
            endAt: effectivePendingScanBatch.rangeEndAt,
          });
          applyRunningScanProgress({
            current: effectivePendingScanBatch.progressCurrent,
            total: effectivePendingScanBatch.progressTotal,
            currentFileName: null,
          });

          const [{ authorizedCandidates }, batchItems] = await Promise.all([
            hydrateAuthorizedState({ ignoreCachedResult: true, preserveRunningProgress: true }),
            loadPhotoScanBatchItems(effectivePendingScanBatch.batchId),
          ]);

          if (!isActive) {
            return true;
          }

          pendingResumeScanJobRef.current = buildRecoveryCheckpointFromBatch({
            batch: effectivePendingScanBatch,
            batchItems,
            sourceCandidates: authorizedCandidates,
          });
          pendingResumeScanBatchRangeRef.current = {
            startAt: effectivePendingScanBatch.rangeStartAt,
            endAt: effectivePendingScanBatch.rangeEndAt,
          };
          setResumeMessage(buildAutoResumeScanNotice(language));
          setResumeScanNonce((value) => value + 1);
          return true;
        }

        if (persistedSession && persistedSession.phase !== 'idle') {
          const [falsePositiveIds, recycleBinCandidateCache] = await Promise.all([
            loadFalsePositiveCandidateIds(),
            loadRecycleBinCandidateCache(),
          ]);

          falsePositiveIdsRef.current = falsePositiveIds;
          recycleBinCandidateCacheRef.current = recycleBinCandidateCache;

          if (!isActive) {
            return true;
          }

          applySessionSnapshot(persistedSession);
          return true;
        }

        return false;
      }

      async function refreshPermissionState() {
        try {
          const permission = await MediaLibrary.getPermissionsAsync(false, ['photo', 'video']);

          if (!isActive) {
            return;
          }

          const stagedSnapshot = getPhotoScanSessionRuntimeSnapshot();
          const shouldPreserveActiveState =
            shouldPreserveGrantedActiveSnapshot(stagedSnapshot);

          if (permission.granted) {
            setPermissionState('granted');
            const didRestorePendingState = await restorePendingScanIfNeeded();
            if (!isActive) {
              return;
            }

            if (!didRestorePendingState) {
              await refreshAuthorizedState();
            }
          } else if (shouldPreserveActiveState) {
            setPermissionState('granted');
          } else {
            setPermissionState('denied');
            pendingResumeScanJobRef.current = null;
            pendingResumeScanBatchRangeRef.current = null;
            setAuthorizedCandidates([]);
            setCandidates([]);
            setStreamingCandidates([]);
            setScanBatchRange(null);
            setIsScanning(false);
            setHasCompletedScan(false);
            setHasCompletedFullScan(false);
            setResumeMessage(null);
            void stopAndroidNativeScan();
            void clearPhotoScanSessionRuntimeSnapshot();
          }
        } catch {
          if (isActive) {
            const stagedSnapshot = getPhotoScanSessionRuntimeSnapshot();
            const shouldPreserveActiveState =
              shouldPreserveGrantedActiveSnapshot(stagedSnapshot);

            if (shouldPreserveActiveState) {
              setPermissionState('granted');
            } else {
              pendingResumeScanJobRef.current = null;
              pendingResumeScanBatchRangeRef.current = null;
              setPermissionState('denied');
              setAuthorizedCandidates([]);
              setCandidates([]);
              setStreamingCandidates([]);
              setScanBatchRange(null);
              setIsScanning(false);
              setHasCompletedScan(false);
              setHasCompletedFullScan(false);
              setResumeMessage(null);
              void stopAndroidNativeScan();
              void clearPhotoScanSessionRuntimeSnapshot();
            }
          }
        }
      }

      void refreshPermissionState();

      return () => {
        isActive = false;
        void persistPhotoScanSessionRuntimeSnapshot(getPhotoScanSessionRuntimeSnapshot());
      };
    }, [
      applyRunningScanProgress,
      applySessionSnapshot,
      hydrateAuthorizedState,
      language,
    ]),
  );

  const resetScanProgress = useCallback((nextTotal = scanScopeSelection.total) => {
    setScanProgress({
      current: 0,
      total: nextTotal,
      currentFileName: null,
    });
    setScanResultsCount(0);
  }, [scanScopeSelection.total]);

  const flushDeferredPreviewScanState = useCallback(() => {
    const deferredState = deferredPreviewScanStateRef.current;

    if (!deferredState) {
      return;
    }

    deferredPreviewScanStateRef.current = null;

    if (deferredState.scanProgress) {
      setScanProgress(deferredState.scanProgress);
    }

    if (deferredState.streamingCandidates) {
      setStreamingCandidates(deferredState.streamingCandidates);
    }

    if (deferredState.scanScopeSelection) {
      setScanScopeSelection(deferredState.scanScopeSelection);
    }
  }, []);

  const dismissPreview = useCallback(
    (options?: { flushDeferredScanState?: boolean }) => {
      isPreviewOpenRef.current = false;
      setPreviewCandidate(null);
      setPreviewSnapshotCandidates(null);

      if (options?.flushDeferredScanState) {
        flushDeferredPreviewScanState();
      } else {
        deferredPreviewScanStateRef.current = null;
      }
    },
    [flushDeferredPreviewScanState],
  );

  const handleSelect = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id],
    );
  }, []);

  const handleItemPress = useCallback((candidate: CleanupCandidate) => {
    isPreviewOpenRef.current = true;
    setPreviewCandidate(candidate);
    setPreviewSnapshotCandidates(displayedCandidates);
  }, [displayedCandidates]);

  const persistCurrentScanCandidates = useCallback(
    async (
      nextCandidates: CleanupCandidate[],
      falsePositiveIds: readonly string[] = falsePositiveIdsRef.current,
    ) => {
      if (!hasCompletedScan) {
        return;
      }

      try {
        const filteredCandidates = filterFalsePositiveCandidates(nextCandidates, falsePositiveIds);
        await savePhotoScanResultCache({
          activeCandidates: filteredCandidates,
          summary: buildFilteredSummary(scanSummaryRef.current, filteredCandidates),
        });
      } catch (persistError) {
        console.error('Failed to persist updated selection results:', persistError);
      }
    },
    [hasCompletedScan],
  );

  const persistMediaLedger = useCallback(
    async (options: {
      activeCandidates?: readonly CleanupCandidate[];
      recycleBinCandidates?: readonly CleanupCandidate[];
      keptIds?: readonly string[];
    }) => {
      try {
        await syncPersistedMediaLedger({
          activeCandidates: options.activeCandidates,
          recycleBinCandidates: options.recycleBinCandidates,
          keptIds: options.keptIds,
        });
      } catch (persistError) {
        console.error('Failed to sync persistent media ledger:', persistError);
      }
    },
    [],
  );

  const persistRecycleBinState = useCallback(
    async (
      nextIds: string[],
      nextCandidateCache: CleanupCandidate[] = recycleBinCandidateCacheRef.current,
    ) => {
      const uniqueIds = [...new Set(nextIds)];
      const normalizedCandidateCache = mergeRecycleBinCandidateCache(
        [],
        nextCandidateCache,
        uniqueIds,
      );

      recycleBinIdsRef.current = uniqueIds;
      recycleBinCandidateCacheRef.current = normalizedCandidateCache;
      scanSummaryRef.current = {
        ...scanSummaryRef.current,
        recycleBinCount: uniqueIds.length,
      };

      await Promise.all([
        saveRecycleBinIds(uniqueIds),
        saveRecycleBinCandidateCache(normalizedCandidateCache),
      ]);
      onRecycleBinIdsChange?.(uniqueIds);
    },
    [onRecycleBinIdsChange],
  );

  const handleCleanupSelected = useCallback(async () => {
    if (selectedIds.length === 0) {
      return;
    }

    try {
      const idsToRemove = expandSelectedIdsForCleanup(candidates, selectedIds);
      const idsToRemoveSet = new Set(idsToRemove);
      const nextCandidates = candidates.filter((candidate) => !idsToRemoveSet.has(candidate.id));
      const nextRecycleBinIds = [...recycleBinIdsRef.current, ...idsToRemove];
      const movedCandidates = candidates.filter((candidate) => idsToRemoveSet.has(candidate.id));
      const nextRecycleBinCandidateCache = mergeRecycleBinCandidateCache(
        recycleBinCandidateCacheRef.current,
        movedCandidates,
        nextRecycleBinIds,
      );

      setCandidates(nextCandidates);
      setStreamingCandidates(nextCandidates);
      setSelectedIds([]);
      setScanResultsCount(nextCandidates.length);
      setScanScopeSelection(buildScopeSelectionFromCandidates(nextCandidates));
      await Promise.all([
        persistRecycleBinState(nextRecycleBinIds, nextRecycleBinCandidateCache),
        persistCurrentScanCandidates(nextCandidates),
        persistMediaLedger({
          activeCandidates: nextCandidates,
          recycleBinCandidates: nextRecycleBinCandidateCache,
          keptIds: falsePositiveIdsRef.current,
        }),
      ]);
    } catch (error) {
      console.error('Failed to clean selected candidates:', error);
      setErrorMessage(error instanceof Error ? error.message : copy.alerts.deleteFailedBody);
    }
  }, [candidates, copy.alerts.deleteFailedBody, persistCurrentScanCandidates, persistMediaLedger, persistRecycleBinState, selectedIds]);

  const handleKeepSelected = useCallback(async () => {
    if (selectedIds.length === 0 || !hasCompletedScan) {
      return;
    }

    try {
      const falsePositiveIds = await appendFalsePositiveCandidateIds(selectedIds);
      falsePositiveIdsRef.current = falsePositiveIds;

      const selectedIdSet = new Set(selectedIds);
      const nextCandidates = candidates.filter((candidate) => !selectedIdSet.has(candidate.id));

      setCandidates(nextCandidates);
      setStreamingCandidates(nextCandidates);
      setSelectedIds([]);
      setScanResultsCount(nextCandidates.length);
      setScanScopeSelection(buildScopeSelectionFromCandidates(nextCandidates));
      await Promise.all([
        persistCurrentScanCandidates(nextCandidates, falsePositiveIds),
        persistMediaLedger({
          activeCandidates: nextCandidates,
          recycleBinCandidates: recycleBinCandidateCacheRef.current,
          keptIds: falsePositiveIds,
        }),
      ]);
    } catch (error) {
      console.error('Failed to keep selected candidates:', error);
      setErrorMessage(error instanceof Error ? error.message : copy.alerts.deleteFailedBody);
    }
  }, [candidates, copy.alerts.deleteFailedBody, hasCompletedScan, persistCurrentScanCandidates, persistMediaLedger, selectedIds]);

  const handleRequestPermission = useCallback(async () => {
    try {
      const permission = await MediaLibrary.requestPermissionsAsync(false, ['photo', 'video']);
      setPermissionState(permission.granted ? 'granted' : 'denied');
      setResumeMessage(null);

      if (permission.granted) {
        await hydrateAuthorizedState();
      } else {
        setAuthorizedCandidates([]);
        setCandidates([]);
        setStreamingCandidates([]);
        setScanScopeSelection({ total: 0, photo: 0, video: 0 });
        setScanBatchRange(null);
        setIsScanning(false);
        setHasCompletedScan(false);
        setHasCompletedFullScan(false);
      }
    } catch {
      setPermissionState('denied');
      setAuthorizedCandidates([]);
      setCandidates([]);
      setStreamingCandidates([]);
      setScanScopeSelection({ total: 0, photo: 0, video: 0 });
      setScanBatchRange(null);
      setIsScanning(false);
      setHasCompletedScan(false);
      setHasCompletedFullScan(false);
      setResumeMessage(null);
    }
  }, [hydrateAuthorizedState]);

  const handleStartScan = useCallback(async (options?: {
    sourceCandidates?: CleanupCandidate[];
    recoveryCheckpoint?: PhotoScanJobCheckpoint | null;
    nativeRuntimeSnapshot?: AndroidNativeScanRuntimeSnapshot | null;
    scanBatchRange?: ScanBatchRangeState;
  }) => {
    if (isStartingScanRef.current) {
      return;
    }

    isStartingScanRef.current = true;
    const initialSourceCandidates = options?.sourceCandidates ?? authorizedCandidatesRef.current;
    const recoveryCheckpoint = options?.recoveryCheckpoint ?? null;
    const nativeRuntimeSnapshot = options?.nativeRuntimeSnapshot ?? null;
    const nativeRuntimeStatus = nativeRuntimeSnapshot?.status ?? null;
    const requestedScanBatchRange = options?.scanBatchRange ?? null;
    const recoveryResumeCursor = {
      processedCount: recoveryCheckpoint?.processedCount ?? 0,
      lastProcessedAssetId: recoveryCheckpoint?.lastProcessedAssetId ?? null,
    };
    const scanToken = activeScanTokenRef.current + 1;
    const startedAt = nativeRuntimeStatus?.startedAt ?? Date.now();
    const scanJobId =
      nativeRuntimeStatus?.jobId ?? buildPhotoScanJobId(scanToken, startedAt);
    activeScanTokenRef.current = scanToken;
    activeScanJobIdRef.current = scanJobId;
    let sourceCandidates = initialSourceCandidates;
    let createdAfter: number | null = null;
    let rangeEndAt = startedAt;
    let batchMode: PhotoScanBatchRecord['mode'] = 'rolling-window';
    let windowDays: number | null = DEFAULT_SCAN_WINDOW_DAYS;
    let scanRangeMonths: ScanRange = DEFAULT_SCAN_WINDOW_MONTHS_EQUIVALENT as ScanRange;
    let manifestEntries: AssetManifestRecord[] = [];
    let didUseAndroidMetadataWindow = false;
    const analyzedAssetIds = new Set<string>();
    const analyzedInputsById = new Map<string, AnalyzedMediaInput>();
    deferredPreviewScanStateRef.current = null;
    setErrorMessage(null);
    setResumeMessage(
      recoveryCheckpoint ? buildAutoResumeScanNotice(language) : null,
    );
    setIsScanning(true);
    setHasCompletedScan(false);
    setHasCompletedFullScan(false);
    setStreamingCandidates(initialSourceCandidates);
    setScanScopeSelection(buildScopeSelectionFromCandidates(initialSourceCandidates));
    resetScanProgress(initialSourceCandidates.length);
    setScanBatchRange(requestedScanBatchRange);

    try {
      const [
        recycleBinIds,
        falsePositiveIds,
        recycleBinCandidateCache,
        analysisCache,
        loadedScanRangeMonths,
        latestCompletedScanBatch,
      ] = await Promise.all([
        recycleBinIdsRef.current.length > 0
          ? Promise.resolve(recycleBinIdsRef.current)
          : loadRecycleBinIds(),
        loadFalsePositiveCandidateIds(),
        loadRecycleBinCandidateCache(),
        loadMediaAnalysisCache(),
        loadScanRange(),
        !recoveryCheckpoint && !nativeRuntimeStatus
          ? loadLatestCompletedPhotoScanBatch()
          : Promise.resolve(null),
      ]);
      recycleBinIdsRef.current = recycleBinIds;
      falsePositiveIdsRef.current = falsePositiveIds;
      recycleBinCandidateCacheRef.current = recycleBinCandidateCache;
      scanRangeMonths = loadedScanRangeMonths;
      const fallbackRangeEndAt = requestedScanBatchRange?.endAt ?? startedAt;
      const fallbackRangeStartAt =
        requestedScanBatchRange
          ? requestedScanBatchRange.startAt
          : buildScanRangeStartAt(scanRangeMonths, fallbackRangeEndAt);
      createdAfter = fallbackRangeStartAt;
      rangeEndAt = fallbackRangeEndAt;
      setScanBatchRange({ startAt: createdAfter, endAt: rangeEndAt });

      if (Platform.OS === 'android' && !recoveryCheckpoint && !nativeRuntimeStatus) {
        const nextWindow = resolveConfiguredScanWindow({
          scanRangeMonths,
          latestCompletedBatch: latestCompletedScanBatch,
          nowInput: startedAt,
        });
        const hasCompletedHistoricalCoverage = nextWindow.status === 'complete';
        if (nextWindow.status === 'complete') {
          createdAfter = buildScanRangeStartAt(scanRangeMonths, startedAt);
          rangeEndAt = startedAt;
          batchMode = 'full';
          windowDays = buildWindowDaysFromRange(createdAfter, rangeEndAt);
        } else {
          createdAfter = nextWindow.rangeStartAt;
          rangeEndAt = nextWindow.rangeEndAt;
          batchMode = nextWindow.mode;
          windowDays = nextWindow.windowDays;
        }
        setScanBatchRange({ startAt: createdAfter, endAt: rangeEndAt });

        const enumeratedAssets = await enumerateAndroidMediaStoreAssets({
          createdAfter,
          createdBefore: rangeEndAt,
        });
        didUseAndroidMetadataWindow = true;
        const hasOlderAndroidAssets =
          hasCompletedHistoricalCoverage || createdAfter === null
            ? false
            : (
                await enumerateAndroidMediaStoreAssets({
                  createdBefore: createdAfter,
                  limit: 1,
                })
              ).length > 0;
        const existingManifestEntries =
          enumeratedAssets.length > 0
            ? await loadAssetManifestEntries(enumeratedAssets.map((asset) => asset.assetId))
            : [];
        manifestEntries = buildAssetManifestEntriesFromAndroidMediaStoreAssets(
          enumeratedAssets,
          existingManifestEntries,
          analysisCache,
          startedAt,
        );
        sourceCandidates = buildDirtyCandidatesFromManifestEntries(
          manifestEntries,
          falsePositiveIds,
        );

        if (hasCompletedHistoricalCoverage && sourceCandidates.length === 0) {
          if (manifestEntries.length > 0) {
            await upsertAssetManifestEntries(manifestEntries);
          }
          const completedTotal = Math.max(
            latestCompletedScanBatch?.progressCurrent ?? 0,
            latestCompletedScanBatch?.progressTotal ?? 0,
            manifestEntries.length,
            scanProgress.total,
          );
          activeScanJobIdRef.current = null;
          activeScanBatchRef.current = null;
          activeScanBatchItemsRef.current = new Map();
          lastPersistedBatchItemsProcessedCountRef.current = 0;
          foregroundServiceOwnerRef.current = null;
          setResumeMessage(null);
          setIsScanning(false);
          setHasCompletedScan(true);
          setHasCompletedFullScan(true);
          setScanScopeSelection(
            manifestEntries.length > 0
              ? buildScopeSelectionFromManifestEntries(manifestEntries)
              : buildScopeSelectionFromCandidates(sourceCandidates),
          );
          setScanBatchRange(
            latestCompletedScanBatch
              ? {
                  startAt: latestCompletedScanBatch.rangeStartAt,
                  endAt: latestCompletedScanBatch.rangeEndAt,
                }
              : null,
          );
          setScanProgress({
            current: completedTotal,
            total: completedTotal,
            currentFileName: null,
          });
          return;
        }

        if (!hasOlderAndroidAssets) {
          batchMode = 'full';
        }
      }

      if (manifestEntries.length === 0 && !didUseAndroidMetadataWindow) {
        const sourceCandidateAssetIds = sourceCandidates.map((candidate) => candidate.asset.id);
        const existingManifestEntries = await loadAssetManifestEntries(sourceCandidateAssetIds);
        manifestEntries = buildAssetManifestEntriesFromCandidates(
          sourceCandidates,
          existingManifestEntries,
          analysisCache,
          startedAt,
        );
        windowDays = buildWindowDaysFromRange(createdAfter, rangeEndAt) ?? windowDays;
      }

      const sourceCandidateAssetIds = sourceCandidates.map((candidate) => candidate.asset.id);
      const batchScopeSelection =
        manifestEntries.length > 0
          ? buildScopeSelectionFromManifestEntries(manifestEntries)
          : buildScopeSelectionFromCandidates(sourceCandidates);
      const scanProgressContract = resolveScanBatchProgressContract({
        persistedCurrent: nativeRuntimeStatus?.current ?? recoveryCheckpoint?.progressCurrent,
        persistedTotal: nativeRuntimeStatus?.total ?? recoveryCheckpoint?.progressTotal,
        batchScopeTotal: batchScopeSelection.total,
        dirtyAssetCount: sourceCandidates.length,
        resumedProcessedCount: recoveryResumeCursor.processedCount,
      });
      const displayProgressTotal = scanProgressContract.progressTotal;
      const displayProgressCompletedOffset = scanProgressContract.completedOffset;
      const resumedProcessedCount = scanProgressContract.resumedProcessedCount;
      const displayProgressCurrent = scanProgressContract.progressCurrent;

      setResumeMessage(
        recoveryCheckpoint ? buildAutoResumeScanNotice(language) : null,
      );
      setIsScanning(true);
      setHasCompletedScan(false);
      setHasCompletedFullScan(false);
      setStreamingCandidates(sourceCandidates);
      setScanScopeSelection(batchScopeSelection);
      setScanBatchRange({ startAt: createdAfter, endAt: rangeEndAt });
      setScanProgress({
        current: displayProgressCurrent,
        total: displayProgressTotal,
        currentFileName:
          nativeRuntimeStatus?.currentFileName ??
          recoveryCheckpoint?.currentFileName ??
          null,
      });
      setScanResultsCount(0);
      activeScanCheckpointRef.current = {
        current: displayProgressCurrent,
        total: displayProgressTotal,
        currentFileName:
          nativeRuntimeStatus?.currentFileName ??
          recoveryCheckpoint?.currentFileName ??
          null,
        processedCount: resumedProcessedCount,
        lastProcessedAssetId: recoveryResumeCursor.lastProcessedAssetId,
      };
      lastProgressCheckpointPersistAtRef.current = startedAt;

      const shouldUseNativeForegroundOwner =
        Platform.OS === 'android' && (await isAndroidNativeScanSupported().catch(() => false));
      foregroundServiceOwnerRef.current =
        Platform.OS === 'android'
          ? shouldUseNativeForegroundOwner
            ? 'native'
            : 'js'
          : null;

      if (foregroundServiceOwnerRef.current === 'js') {
        syncAndroidForegroundScanProgress({
          isScanning: true,
          progressCurrent: displayProgressCurrent,
          progressTotal: displayProgressTotal,
          currentFileName: recoveryCheckpoint?.currentFileName ?? null,
        });
      }

      const initialBatchItems = buildInitialPhotoScanBatchItems(
        scanJobId,
        sourceCandidates,
        manifestEntries,
        startedAt,
      );
      const batchItemsById = new Map(
        initialBatchItems.map((item) => [item.assetId, item] satisfies [string, PhotoScanBatchItemRecord]),
      );
      updatePhotoScanBatchItemsCompletedThroughAsset(
        batchItemsById,
        sourceCandidateAssetIds,
        recoveryResumeCursor.lastProcessedAssetId,
        nativeRuntimeStatus?.updatedAt ?? startedAt,
      );
      activeScanBatchItemsRef.current = batchItemsById;
      lastPersistedBatchItemsProcessedCountRef.current = resumedProcessedCount;
      const initialBatchRecord = buildPhotoScanBatchRecord({
        batchId: scanJobId,
        mode: batchMode,
        windowDays,
        phase: 'analysis',
        progressCurrent: displayProgressCurrent,
        progressTotal: displayProgressTotal,
        enumeratedCount: manifestEntries.length,
        dirtyCount: sourceCandidates.length,
        analyzedCount: resumedProcessedCount,
        candidateCount: 0,
        startedAt,
        lastHeartbeatAt: nativeRuntimeStatus?.updatedAt ?? startedAt,
        updatedAt: nativeRuntimeStatus?.updatedAt ?? startedAt,
        rangeStartAt: createdAfter,
        rangeEndAt,
      });
      activeScanBatchRef.current = initialBatchRecord;

      await Promise.all([
        savePhotoScanJobCheckpoint({
          jobId: scanJobId,
          phase: 'running',
          progressCurrent: displayProgressCurrent,
          progressTotal: displayProgressTotal,
          processedCount: resumedProcessedCount,
          candidateCount: 0,
          startedAt,
          lastHeartbeatAt: nativeRuntimeStatus?.updatedAt ?? startedAt,
          currentFileName:
            nativeRuntimeStatus?.currentFileName ??
            recoveryCheckpoint?.currentFileName ??
            null,
          lastProcessedAssetId: recoveryResumeCursor.lastProcessedAssetId,
          lastError: null,
          updatedAt: nativeRuntimeStatus?.updatedAt ?? startedAt,
        }),
        savePhotoScanBatch(initialBatchRecord),
        savePhotoScanBatchItems(
          scanJobId,
          buildPhotoScanBatchItemSnapshot(batchItemsById),
        ),
        upsertAssetManifestEntries(manifestEntries),
      ]);

      const androidNativeStagingImporter =
        Platform.OS === 'android'
          ? createAndroidNativeStagingImporter({
              sourceCandidates,
              falsePositiveIds,
            })
          : null;
      const legacyScanOptions = {
        createdAfter,
        createdBefore: rangeEndAt,
        falsePositiveIds,
        recycleBinCandidateCache,
        resumeAfterAssetId: recoveryResumeCursor.lastProcessedAssetId,
        onCheckpoint: async (checkpoint) => {
          if (activeScanTokenRef.current !== scanToken || activeScanJobIdRef.current !== scanJobId) {
            return;
          }

          const updatedAt = Date.now();
          const checkpointDisplayProgress = applyBatchDisplayProgressOffset(
            {
              current: checkpoint.current,
              total: checkpoint.total,
              currentFileName: checkpoint.currentFileName,
            },
            {
              dirtyTotal: sourceCandidates.length,
              displayTotal: displayProgressTotal,
              completedOffset: displayProgressCompletedOffset,
            },
          );
          const nextScanProgress = mergeRunningScanProgress(
            activeScanCheckpointRef.current,
            checkpointDisplayProgress,
          );
          const checkpointAnalyzedInputs = checkpoint.analyzedInputs ?? [];
          if (checkpointAnalyzedInputs.length > 0) {
            updatePhotoScanBatchItemsCompletedByIds(
              activeScanBatchItemsRef.current,
              checkpointAnalyzedInputs.map((analyzedInput) => analyzedInput.asset.id),
              updatedAt,
            );
          }
          const checkpointCompletedCount = countCompletedPhotoScanBatchItems(
            activeScanBatchItemsRef.current,
          );
          const checkpointCompletionCursor = buildContiguousBatchCompletionCursor({
            itemsById: activeScanBatchItemsRef.current,
            orderedAssetIds: sourceCandidateAssetIds,
          });
          activeScanCheckpointRef.current = {
            ...checkpoint,
            current: nextScanProgress.current,
            total: nextScanProgress.total,
            currentFileName: nextScanProgress.currentFileName,
            processedCount: checkpointCompletionCursor.processedCount,
            lastProcessedAssetId: checkpointCompletionCursor.lastProcessedAssetId,
          };
          if (isPreviewOpenRef.current) {
            deferredPreviewScanStateRef.current = {
              ...deferredPreviewScanStateRef.current,
              scanProgress: nextScanProgress,
            };
          } else {
            applyRunningScanProgress(nextScanProgress);
          }
          const runningBatchRecord = buildPhotoScanBatchRecord({
            batchId: scanJobId,
            mode: batchMode,
            windowDays,
            phase: 'analysis',
            progressCurrent: nextScanProgress.current,
            progressTotal: nextScanProgress.total,
            enumeratedCount: manifestEntries.length,
            dirtyCount: sourceCandidates.length,
            analyzedCount: checkpointCompletedCount,
            candidateCount: 0,
            startedAt,
            lastHeartbeatAt: updatedAt,
            updatedAt,
            rangeStartAt: createdAfter,
            rangeEndAt,
          });
          activeScanBatchRef.current = runningBatchRecord;
          const shouldPersistBatchItems =
            checkpoint.processedCount === checkpoint.total ||
            checkpoint.processedCount - lastPersistedBatchItemsProcessedCountRef.current >= 25;

          await Promise.all([
            savePhotoScanJobCheckpoint({
              jobId: scanJobId,
              phase: 'running',
              progressCurrent: nextScanProgress.current,
              progressTotal: nextScanProgress.total,
              processedCount: checkpointCompletionCursor.processedCount,
              candidateCount: 0,
              startedAt,
              lastHeartbeatAt: updatedAt,
              currentFileName: nextScanProgress.currentFileName,
              lastProcessedAssetId: checkpointCompletionCursor.lastProcessedAssetId,
              lastError: null,
              updatedAt,
            }),
            savePhotoScanBatch(runningBatchRecord),
            shouldPersistBatchItems
              ? savePhotoScanBatchItems(
                  scanJobId,
                  buildPhotoScanBatchItemSnapshot(activeScanBatchItemsRef.current),
                ).then(() => {
                  lastPersistedBatchItemsProcessedCountRef.current = checkpoint.processedCount;
                })
              : Promise.resolve(),
          ]);

          if (!androidNativeStagingImporter) {
            return;
          }

          const importedChunk = androidNativeStagingImporter.importCheckpoint(checkpoint);
          if (!importedChunk.didImport) {
            return;
          }

          if (isPreviewOpenRef.current) {
            deferredPreviewScanStateRef.current = {
              ...deferredPreviewScanStateRef.current,
              streamingCandidates: importedChunk.visibleCandidates,
              scanScopeSelection: importedChunk.scopeSelection,
            };
          } else {
            setStreamingCandidates(importedChunk.visibleCandidates);
            setScanScopeSelection(importedChunk.scopeSelection);
          }
        },
        onProgress: (progress) => {
          if (activeScanTokenRef.current !== scanToken) {
            return;
          }

          const now = Date.now();
          const nextScanProgress = applyBatchDisplayProgressOffset(
            {
              current: progress.current,
              total: progress.total,
              currentFileName: progress.currentFileName,
            },
            {
              dirtyTotal: sourceCandidates.length,
              displayTotal: displayProgressTotal,
              completedOffset: displayProgressCompletedOffset,
            },
          );

          if (isPreviewOpenRef.current) {
            deferredPreviewScanStateRef.current = {
              ...deferredPreviewScanStateRef.current,
              scanProgress: nextScanProgress,
            };
          } else {
            applyRunningScanProgress(nextScanProgress);
          }
          if (progress.analyzedAssetId) {
            updatePhotoScanBatchItemsCompletedByIds(
              activeScanBatchItemsRef.current,
              [progress.analyzedAssetId],
              now,
            );
          }
          const progressProcessedCount = countCompletedPhotoScanBatchItems(
            activeScanBatchItemsRef.current,
          );
          const progressCompletionCursor = buildContiguousBatchCompletionCursor({
            itemsById: activeScanBatchItemsRef.current,
            orderedAssetIds: sourceCandidateAssetIds,
          });
          const mergedProgress = mergeRunningScanProgress(activeScanCheckpointRef.current, nextScanProgress);
          activeScanCheckpointRef.current = {
            ...activeScanCheckpointRef.current,
            current: mergedProgress.current,
            total: mergedProgress.total,
            currentFileName: mergedProgress.currentFileName,
            processedCount: progressCompletionCursor.processedCount,
            lastProcessedAssetId: progressCompletionCursor.lastProcessedAssetId,
          };

          if (foregroundServiceOwnerRef.current === 'js') {
            syncAndroidForegroundScanProgress({
              isScanning: true,
              progressCurrent: mergedProgress.current,
              progressTotal: mergedProgress.total,
              currentFileName: mergedProgress.currentFileName,
            });
          }

          if (
            activeScanJobIdRef.current === scanJobId &&
            (progress.current === progress.total || now - lastProgressCheckpointPersistAtRef.current >= 500)
          ) {
            lastProgressCheckpointPersistAtRef.current = now;
            const runningBatchRecord = buildPhotoScanBatchRecord({
              batchId: scanJobId,
              mode: batchMode,
              windowDays,
              phase: 'analysis',
              progressCurrent: mergedProgress.current,
              progressTotal: mergedProgress.total,
              enumeratedCount: manifestEntries.length,
              dirtyCount: sourceCandidates.length,
              analyzedCount: progressProcessedCount,
              candidateCount: 0,
              startedAt,
              lastHeartbeatAt: now,
              updatedAt: now,
              rangeStartAt: createdAfter,
              rangeEndAt,
            });
            activeScanBatchRef.current = runningBatchRecord;
            void savePhotoScanJobCheckpoint({
              jobId: scanJobId,
              phase: 'running',
              progressCurrent: mergedProgress.current,
              progressTotal: mergedProgress.total,
              processedCount: activeScanCheckpointRef.current.processedCount,
              candidateCount: 0,
              startedAt,
              lastHeartbeatAt: now,
              currentFileName: mergedProgress.currentFileName,
              lastProcessedAssetId: activeScanCheckpointRef.current.lastProcessedAssetId,
              lastError: null,
              updatedAt: now,
            })
              .then(() => savePhotoScanBatch(runningBatchRecord))
              .catch((checkpointError) => {
                console.error('Failed to persist running scan progress checkpoint:', checkpointError);
              });
          }

          if (progress.analyzedAssetId) {
            if (androidNativeStagingImporter) {
              androidNativeStagingImporter.recordProgress(progress);
              return;
            }

            analyzedAssetIds.add(progress.analyzedAssetId);

            if (progress.analyzedInput) {
              analyzedInputsById.set(progress.analyzedAssetId, progress.analyzedInput);
            } else {
              analyzedInputsById.delete(progress.analyzedAssetId);
            }

            const nextVisibleCandidates = buildStreamingVisibleCandidates(
              sourceCandidates,
              analyzedAssetIds,
              analyzedInputsById,
              falsePositiveIdsRef.current,
            );
            const nextScopeSelection = buildScopeSelectionFromCandidates(nextVisibleCandidates);

            if (isPreviewOpenRef.current) {
              deferredPreviewScanStateRef.current = {
                ...deferredPreviewScanStateRef.current,
                streamingCandidates: nextVisibleCandidates,
                scanScopeSelection: nextScopeSelection,
              };
            } else {
              setStreamingCandidates(nextVisibleCandidates);
              setScanScopeSelection(nextScopeSelection);
            }
          }
        },
      } satisfies Parameters<typeof scanMediaLibrary>[1];
      const result =
        Platform.OS === 'android'
          ? (
              await executeAndroidNativeFirstScan({
                jobId: scanJobId,
                recycleBinIds,
                sourceCandidates,
                language,
                displayProgressTotal,
                displayProgressCompletedOffset,
                attachToRunningIfPresent: nativeRuntimeStatus?.phase === 'running',
                nativeRuntimeSnapshot,
                legacyOptions: legacyScanOptions,
                runLegacyScan: async (legacyRecycleBinIds, legacyOptions) => {
                  foregroundServiceOwnerRef.current = 'js';
                  syncAndroidForegroundScanProgress({
                    isScanning: true,
                    progressCurrent: activeScanCheckpointRef.current.current,
                    progressTotal: activeScanCheckpointRef.current.total,
                    currentFileName: activeScanCheckpointRef.current.currentFileName,
                  });
                  return scanMediaLibrary(legacyRecycleBinIds, legacyOptions);
                },
              })
            ).output
          : await scanMediaLibrary(recycleBinIds, legacyScanOptions);

      if (activeScanTokenRef.current !== scanToken) {
        return;
      }

      const shouldReportBatchTotalAsCompletionCount =
        Platform.OS === 'android' && manifestEntries.length > sourceCandidates.length;
      const completedBatchTotal = Math.max(
        result.summary.scannedCount,
        activeScanCheckpointRef.current.total,
        manifestEntries.length,
        sourceCandidates.length,
      );
      const completedScannedCount = shouldReportBatchTotalAsCompletionCount
        ? completedBatchTotal
        : result.summary.scannedCount;

      scanSummaryRef.current = {
        scannedAt: result.summary.scannedAt,
        scannedCount: completedScannedCount,
        recycleBinCount: result.summary.recycleBinCount,
      };
      recycleBinCandidateCacheRef.current = result.state.recycleBin;
      const filteredCandidates = filterFalsePositiveCandidates(
        result.state.activeCandidates,
        falsePositiveIds,
      );

      setCandidates(filteredCandidates);
      setStreamingCandidates(filteredCandidates);
      setSelectedIds([]);
      setScanResultsCount(filteredCandidates.length);
      setScanScopeSelection(buildScopeSelectionFromCandidates(filteredCandidates));
      setScanProgress({
        current: completedScannedCount,
        total: completedScannedCount,
        currentFileName: null,
      });
      if (foregroundServiceOwnerRef.current === 'js') {
        syncAndroidForegroundScanProgress({
          isScanning: false,
          progressCurrent: completedScannedCount,
          progressTotal: completedScannedCount,
          currentFileName: null,
        });
      }
      foregroundServiceOwnerRef.current = null;
      setResumeMessage(null);
      setIsScanning(false);
      setHasCompletedScan(true);
      setHasCompletedFullScan(batchMode === 'full');
      setScanBatchRange({ startAt: createdAfter, endAt: rangeEndAt });
      updatePhotoScanBatchItemsCompletedThroughAsset(
        activeScanBatchItemsRef.current,
        sourceCandidateAssetIds,
        sourceCandidateAssetIds[sourceCandidateAssetIds.length - 1] ?? null,
        result.summary.scannedAt,
      );
      const completedBatchRecord = buildPhotoScanBatchRecord({
        batchId: scanJobId,
        mode: batchMode,
        windowDays,
        phase: 'completed',
        progressCurrent: completedScannedCount,
        progressTotal: completedScannedCount,
        enumeratedCount: manifestEntries.length,
        dirtyCount: sourceCandidates.length,
        analyzedCount: result.summary.scannedCount,
        candidateCount: filteredCandidates.length,
        startedAt,
        lastHeartbeatAt: result.summary.scannedAt,
        completedAt: result.summary.scannedAt,
        updatedAt: result.summary.scannedAt,
        rangeStartAt: createdAfter,
        rangeEndAt,
      });
      activeScanBatchRef.current = completedBatchRecord;

      let didPersistReminderBaseline = false;
      let didPersistTerminalRecoveryState = false;

      try {
        const baseline = await captureLastValidScanBaseline({
          scannedAt: result.summary.scannedAt,
          scannedCount: completedScannedCount,
          candidateCount: filteredCandidates.length,
          ledgerUpdatedAt: result.summary.scannedAt,
        }, {
          scanRangeMonths,
          createdAfter: buildScanRangeStartAt(scanRangeMonths, result.summary.scannedAt),
        });

        await saveLastScanMeta({
          scannedAt: result.summary.scannedAt,
          scannedCount: completedScannedCount,
          candidateCount: filteredCandidates.length,
        });
        await saveLastValidScanBaseline(baseline);
        didPersistReminderBaseline = true;

        await Promise.all([
          savePhotoScanBatch(completedBatchRecord),
          savePhotoScanBatchItems(
            scanJobId,
            buildPhotoScanBatchItemSnapshot(activeScanBatchItemsRef.current),
          ),
        ]);
        didPersistTerminalRecoveryState = true;

        await Promise.all([
          saveRecycleBinCandidateCache(result.state.recycleBin),
          savePhotoScanResultCache({
            activeCandidates: filteredCandidates,
            summary: buildFilteredSummary(scanSummaryRef.current, filteredCandidates),
          }),
          persistMediaLedger({
            activeCandidates: filteredCandidates,
            recycleBinCandidates: result.state.recycleBin,
            keptIds: falsePositiveIds,
          }),
        ]);
      } catch (persistError) {
        console.error('Failed to persist scan results:', persistError);
      }

      if (didPersistReminderBaseline) {
        try {
          await reconcileReminderRuntimeInForeground(language, {
            name: copy.reminder.channelName,
            description: copy.reminder.channelDescription,
          });
        } catch (reminderError) {
          console.error('Failed to reconcile reminder runtime after scan:', reminderError);
        }
      }

      if (appStateRef.current !== 'active') {
        try {
          await notifyScanCompletionIfNeeded({
            language,
            scannedCount: completedScannedCount,
            resultCount: filteredCandidates.length,
          });
        } catch (notificationError) {
          console.error('Failed to present scan completion notification:', notificationError);
        }
      }

      if (didPersistTerminalRecoveryState) {
        await clearPhotoScanJobCheckpoint();
      }
      activeScanJobIdRef.current = null;
      activeScanBatchRef.current = null;
    } catch (error) {
      if (activeScanTokenRef.current !== scanToken) {
        return;
      }

      setIsScanning(false);
      setHasCompletedScan(false);
      setHasCompletedFullScan(false);
      setStreamingCandidates(sourceCandidates);
      setScanScopeSelection(buildScopeSelectionFromCandidates(sourceCandidates));
      resetScanProgress(sourceCandidates.length);
      if (foregroundServiceOwnerRef.current === 'js') {
        syncAndroidForegroundScanProgress({
          isScanning: false,
          progressCurrent: activeScanCheckpointRef.current.current,
          progressTotal: activeScanCheckpointRef.current.total,
          currentFileName: activeScanCheckpointRef.current.currentFileName,
        });
      }
      foregroundServiceOwnerRef.current = null;
      setResumeMessage(null);
      setErrorMessage(error instanceof Error ? error.message : copy.alerts.scanFailed);

      try {
        const updatedAt = Date.now();
        const failedCompletedCount = countCompletedPhotoScanBatchItems(
          activeScanBatchItemsRef.current,
        );
        const failedBatchRecord = buildPhotoScanBatchRecord({
          batchId: scanJobId,
          mode: batchMode,
          windowDays,
          phase: 'failed',
          progressCurrent: activeScanCheckpointRef.current.current,
          progressTotal: activeScanCheckpointRef.current.total,
          enumeratedCount: manifestEntries.length,
          dirtyCount: sourceCandidates.length,
          analyzedCount: failedCompletedCount,
          candidateCount: 0,
          startedAt,
          lastHeartbeatAt: updatedAt,
          completedAt: updatedAt,
          lastError: error instanceof Error ? error.message : copy.alerts.scanFailed,
          updatedAt,
          rangeStartAt: createdAfter,
          rangeEndAt,
        });
        activeScanBatchRef.current = failedBatchRecord;
        await Promise.all([
          savePhotoScanJobCheckpoint({
            jobId: scanJobId,
            phase: 'failed',
            progressCurrent: activeScanCheckpointRef.current.current,
            progressTotal: activeScanCheckpointRef.current.total,
            processedCount: activeScanCheckpointRef.current.processedCount,
            candidateCount: 0,
            startedAt,
            lastHeartbeatAt: updatedAt,
            currentFileName: activeScanCheckpointRef.current.currentFileName,
            lastProcessedAssetId: activeScanCheckpointRef.current.lastProcessedAssetId,
            lastError: error instanceof Error ? error.message : copy.alerts.scanFailed,
            updatedAt,
          }),
          savePhotoScanBatch(failedBatchRecord),
          savePhotoScanBatchItems(
            scanJobId,
            buildPhotoScanBatchItemSnapshot(activeScanBatchItemsRef.current),
          ),
        ]);
      } catch (checkpointError) {
        console.error('Failed to persist scan job checkpoint:', checkpointError);
      }

      activeScanJobIdRef.current = null;
      activeScanBatchRef.current = null;
    } finally {
      isStartingScanRef.current = false;
    }
  }, [
    applyRunningScanProgress,
    copy.alerts.scanFailed,
    copy.reminder.channelDescription,
    copy.reminder.channelName,
    language,
    persistMediaLedger,
    resetScanProgress,
    scanProgress.total,
    syncAndroidForegroundScanProgress,
  ]);

  useEffect(() => {
    const pendingResumeScanJob = pendingResumeScanJobRef.current;
    const pendingResumeNativeSnapshot = pendingResumeNativeSnapshotRef.current;
    const pendingResumeScanBatchRange = pendingResumeScanBatchRangeRef.current;

    if (!pendingResumeScanJob || resumeScanNonce === 0) {
      return;
    }

    pendingResumeScanJobRef.current = null;
    pendingResumeNativeSnapshotRef.current = null;
    pendingResumeScanBatchRangeRef.current = null;
    void handleStartScan({
      sourceCandidates: authorizedCandidatesRef.current,
      recoveryCheckpoint: pendingResumeScanJob,
      nativeRuntimeSnapshot: pendingResumeNativeSnapshot,
      scanBatchRange: pendingResumeScanBatchRange,
    });
  }, [handleStartScan, resumeScanNonce]);

  const handleCancelScan = useCallback(() => {
    const activeBatch = activeScanBatchRef.current;
    if (activeBatch) {
      const updatedAt = Date.now();
      const cancelledCompletedCount = countCompletedPhotoScanBatchItems(
        activeScanBatchItemsRef.current,
      );
      const cancelledBatchRecord = {
        ...activeBatch,
        phase: 'cancelled' as const,
        progressCurrent: activeScanCheckpointRef.current.current,
        progressTotal: activeScanCheckpointRef.current.total,
        analyzedCount: cancelledCompletedCount,
        lastHeartbeatAt: updatedAt,
        completedAt: updatedAt,
        updatedAt,
      };
      activeScanBatchRef.current = cancelledBatchRecord;
      void Promise.all([
        savePhotoScanBatch(cancelledBatchRecord),
        savePhotoScanBatchItems(
          cancelledBatchRecord.batchId,
          buildPhotoScanBatchItemSnapshot(activeScanBatchItemsRef.current),
        ),
      ]).catch((error) => {
        console.error('Failed to persist cancelled scan batch:', error);
      });
    }
    activeScanTokenRef.current += 1;
    activeScanJobIdRef.current = null;
    activeScanBatchRef.current = null;
    activeScanBatchItemsRef.current = new Map();
    lastPersistedBatchItemsProcessedCountRef.current = 0;
    pendingResumeScanJobRef.current = null;
    pendingResumeNativeSnapshotRef.current = null;
    pendingResumeScanBatchRangeRef.current = null;
    deferredPreviewScanStateRef.current = null;
    setIsScanning(false);
    setHasCompletedScan(false);
    setHasCompletedFullScan(false);
    setResumeMessage(null);
    setScanBatchRange(null);
    setStreamingCandidates(authorizedCandidatesRef.current);
    setScanScopeSelection(buildScopeSelectionFromCandidates(authorizedCandidatesRef.current));
    resetScanProgress(authorizedCandidatesRef.current.length);
    if (foregroundServiceOwnerRef.current === 'native') {
      void stopAndroidNativeScan();
    } else if (foregroundServiceOwnerRef.current === 'js') {
      syncAndroidForegroundScanProgress({
        isScanning: false,
        progressCurrent: activeScanCheckpointRef.current.current,
        progressTotal: activeScanCheckpointRef.current.total,
        currentFileName: activeScanCheckpointRef.current.currentFileName,
      });
    }
    foregroundServiceOwnerRef.current = null;
    void clearPhotoScanSessionRuntimeSnapshot();
    void clearPhotoScanJobCheckpoint();
  }, [resetScanProgress, syncAndroidForegroundScanProgress]);

  const handleToggleSelectAll = useCallback(() => {
    setSelectedIds(
      isAllSelectableSelected ? [] : selectableCandidates.map((candidate) => candidate.id),
    );
  }, [isAllSelectableSelected, selectableCandidates]);

  const handleClosePreview = useCallback(() => {
    dismissPreview({ flushDeferredScanState: true });
  }, [dismissPreview]);

  const handlePreviewPrimaryAction = useCallback(
    async (ids?: string[]) => {
      if (!previewCandidate || !hasCompletedScan) {
        dismissPreview({ flushDeferredScanState: true });
        return;
      }

      try {
        const targetIds = ids && ids.length > 0 ? ids : [previewCandidate.id];
        const idSet = new Set(targetIds);
        const nextCandidates = candidates.filter((candidate) => !idSet.has(candidate.id));
        const nextRecycleBinIds = [...recycleBinIdsRef.current, ...targetIds];
        const movedCandidates = candidates.filter((candidate) => idSet.has(candidate.id));
        const nextRecycleBinCandidateCache = mergeRecycleBinCandidateCache(
          recycleBinCandidateCacheRef.current,
          movedCandidates,
          nextRecycleBinIds,
        );
        const detailSnapshotCandidates = previewSnapshotCandidates ?? displayedCandidates;
        const { nextPreviewCandidate, nextSnapshotCandidates } = buildNextDetailViewState(
          detailSnapshotCandidates,
          previewCandidate,
          targetIds,
          targetIds[0] ?? previewCandidate.id,
        );

        setCandidates(nextCandidates);
        setStreamingCandidates(nextCandidates);
        setSelectedIds([]);
        setScanResultsCount(nextCandidates.length);
        setScanScopeSelection(buildScopeSelectionFromCandidates(nextCandidates));
        if (nextPreviewCandidate) {
          setPreviewSnapshotCandidates(nextSnapshotCandidates);
          setPreviewCandidate(nextPreviewCandidate);
        } else {
          dismissPreview();
        }
        await Promise.all([
          persistRecycleBinState(nextRecycleBinIds, nextRecycleBinCandidateCache),
          persistCurrentScanCandidates(nextCandidates),
          persistMediaLedger({
            activeCandidates: nextCandidates,
            recycleBinCandidates: nextRecycleBinCandidateCache,
            keptIds: falsePositiveIdsRef.current,
          }),
        ]);
      } catch (error) {
        console.error('Failed to clean preview candidate:', error);
        setErrorMessage(error instanceof Error ? error.message : copy.alerts.deleteFailedBody);
      }
    },
    [candidates, copy.alerts.deleteFailedBody, dismissPreview, displayedCandidates, hasCompletedScan, persistCurrentScanCandidates, persistMediaLedger, persistRecycleBinState, previewCandidate, previewSnapshotCandidates],
  );

  const handlePreviewHardDelete = useCallback(async (ids?: string[]) => {
    await handlePreviewPrimaryAction(ids);
  }, [handlePreviewPrimaryAction]);

  const handlePreviewKeep = useCallback(
    async (ids?: string[]) => {
      if (!previewCandidate || !hasCompletedScan) {
        dismissPreview({ flushDeferredScanState: true });
        return;
      }

      try {
        const targetIds = ids && ids.length > 0 ? ids : [previewCandidate.id];
        const falsePositiveIds = await appendFalsePositiveCandidateIds(targetIds);
        falsePositiveIdsRef.current = falsePositiveIds;

        const falsePositiveIdSet = new Set(targetIds);
        const nextCandidates = candidates.filter((candidate) => !falsePositiveIdSet.has(candidate.id));
        const detailSnapshotCandidates = previewSnapshotCandidates ?? displayedCandidates;
        const { nextPreviewCandidate, nextSnapshotCandidates } = buildNextDetailViewState(
          detailSnapshotCandidates,
          previewCandidate,
          targetIds,
          targetIds[0] ?? previewCandidate.id,
        );

        setCandidates(nextCandidates);
        setStreamingCandidates(nextCandidates);
        setSelectedIds((prev) => prev.filter((id) => !falsePositiveIdSet.has(id)));
        setScanResultsCount(nextCandidates.length);
        setScanScopeSelection(buildScopeSelectionFromCandidates(nextCandidates));
        if (nextPreviewCandidate) {
          setPreviewSnapshotCandidates(nextSnapshotCandidates);
          setPreviewCandidate(nextPreviewCandidate);
        } else {
          dismissPreview();
        }
        await Promise.all([
          persistCurrentScanCandidates(nextCandidates, falsePositiveIds),
          persistMediaLedger({
            activeCandidates: nextCandidates,
            recycleBinCandidates: recycleBinCandidateCacheRef.current,
            keptIds: falsePositiveIds,
          }),
        ]);
      } catch (error) {
        console.error('Failed to keep preview candidate:', error);
        setErrorMessage(error instanceof Error ? error.message : copy.alerts.deleteFailedBody);
      }
    },
    [candidates, copy.alerts.deleteFailedBody, dismissPreview, displayedCandidates, hasCompletedScan, persistCurrentScanCandidates, persistMediaLedger, previewCandidate, previewSnapshotCandidates],
  );

  const showPermissionPrompt = permissionState === 'denied';
  const showLoadingPrompt = permissionState === 'loading';
  const showScanPrompt = permissionState === 'granted';
  const isGrantedIdleState = showScanPrompt && !isScanning && !hasCompletedScan;
  const entryBodyText =
    isGrantedIdleState && !entryCopy.body
      ? copy.screens.photoGrid.scanPromptBody
      : entryCopy.body;
  const entryNoteItems = [
    entryCopy.note,
    isGrantedIdleState ? copy.screens.photoGrid.scanScopeHint : null,
  ].filter((item): item is string => Boolean(item));
  const entryNoteText = entryNoteItems.length > 0 ? entryNoteItems.join('\n') : null;
  const DetailScreenCompat = DetailScreen as unknown as React.ComponentType<
    React.ComponentProps<typeof DetailScreen> & {
      onKeep?: (ids?: string[]) => void | Promise<void>;
    }
  >;

  if (previewCandidate) {
    return (
      <DetailScreenCompat
        candidate={previewCandidate}
        duplicateCandidates={previewDuplicateCandidates}
        language={language}
        theme={theme}
        mode="suggestions"
        onClose={handleClosePreview}
        onPrimaryAction={handlePreviewPrimaryAction}
        onHardDelete={handlePreviewHardDelete}
        onKeep={handlePreviewKeep}
      />
    );
  }

  return (
    <View style={styles.container}>
      {showLoadingPrompt ? (
        <View style={styles.entryCard}>
          <Text style={styles.entryEyebrow}>{entryCopy.eyebrow}</Text>
          <Text style={styles.entryTitle}>{entryCopy.title}</Text>
          {entryCopy.body ? <Text style={styles.entryBody}>{entryCopy.body}</Text> : null}
        </View>
      ) : null}

      {showPermissionPrompt ? (
        <View style={styles.entryCard}>
          <Text style={styles.entryEyebrow}>{entryCopy.eyebrow}</Text>
          <Text style={styles.entryTitle}>{entryCopy.title}</Text>
          {entryCopy.body ? <Text style={styles.entryBody}>{entryCopy.body}</Text> : null}
          <Pressable style={styles.inlineButton} onPress={() => void handleRequestPermission()}>
            <Text style={styles.inlineButtonText}>{entryCopy.action}</Text>
          </Pressable>
        </View>
      ) : null}

      {showScanPrompt ? (
        <>
          <View style={styles.entryCard}>
            {!entryCopy.progress ? <Text style={styles.entryEyebrow}>{entryCopy.eyebrow}</Text> : null}
            <View style={styles.entryHeaderRow}>
              <View style={styles.entryTextWrap}>
                <Text style={styles.entryTitle}>{entryCopy.title}</Text>
                {entryBodyText ? <Text style={styles.entryBody}>{entryBodyText}</Text> : null}
                {entryNoteText ? <Text style={styles.entryNote}>{entryNoteText}</Text> : null}
              </View>
              {entryCopy.action ? (
                <Pressable
                  style={[styles.inlineButton, isScanning && styles.buttonDisabled]}
                  onPress={() => void handleStartScan()}
                  disabled={isScanning}
                >
                  <Text style={styles.inlineButtonText}>{entryCopy.action}</Text>
                </Pressable>
              ) : null}
            </View>
            {entryCopy.progress ? (
              <View style={styles.entryProgressWrap} testID="photo-grid-inline-progress">
                <ScanProgress
                  isVisible={isScanning}
                  current={entryCopy.progress.current}
                  total={entryCopy.progress.total}
                  currentFileName={scanProgress.currentFileName}
                  resultsCount={scanResultsCount}
                  theme={theme}
                  locale={language}
                  onCancel={handleCancelScan}
                  embedded
                />
              </View>
            ) : null}
            {entryCopy.resultBreakdown ? (
              <View style={styles.scopeBreakdownRow} testID="photo-grid-scan-summary">
                {entryCopy.resultBreakdown.map((item) => (
                  <View style={styles.scopeBadge} key={item.key}>
                    <Text style={styles.scopeBadgeLabel}>
                      {item.label}
                      <Text style={styles.scopeBadgeCount}> {item.count}</Text>
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>

          {resumeMessage ? (
            <View style={styles.noticeCard}>
              <Text style={styles.noticeTitle}>{copy.common.statusTitle}</Text>
              <Text style={styles.noticeText}>{resumeMessage}</Text>
            </View>
          ) : null}

          {errorMessage ? (
            <View style={styles.noticeCard}>
              <Text style={styles.noticeTitle}>{copy.common.statusTitle}</Text>
              <Text style={styles.noticeText}>{errorMessage}</Text>
            </View>
          ) : null}

          <View style={styles.filterWrap}>
            <SegmentedControl
              options={tabOptions}
              selectedValue={filter}
              onChange={setFilter}
              theme={theme}
            />
          </View>
          <View style={styles.gridStage} testID="photo-grid-stage">
            <PhotoGrid
              candidates={displayedCandidates}
              selectedIds={selectedIds}
              selectionMode={isSelectionMode}
              onSelect={handleSelect}
              onItemPress={handleItemPress}
              theme={theme}
              mediaType={filter as 'all' | 'photo' | 'video'}
              contentPadding={contentPadding}
            />
            {isScanning ? (
              <View
                pointerEvents="none"
                style={styles.gridLoadingOverlay}
                testID="photo-grid-loading-overlay"
              />
            ) : null}
          </View>
          {isSelectionMode && (
            <View style={styles.actionBar}>
              <View style={styles.selectionActionsRow}>
                <TouchSurface
                  style={[styles.selectionActionButton, styles.selectionToggleButton]}
                  pressedStyle={styles.selectionToggleButtonPressed}
                  onPress={handleToggleSelectAll}
                  preset="pill"
                  testID="photo-selection-toggle-button"
                >
                  <Text style={[styles.selectionActionText, styles.selectionToggleText]}>
                    {buildSelectionToggleLabel(language, isAllSelectableSelected)}
                  </Text>
                </TouchSurface>
                <TouchSurface
                  style={[styles.selectionActionButton, styles.selectionDeleteButton]}
                  pressedStyle={styles.selectionDeleteButtonPressed}
                  onPress={() => void handleCleanupSelected()}
                  preset="pill"
                  testID="cleanup-selected-button"
                >
                  <Text style={styles.selectionActionText}>
                    {copy.screens.photoGrid.cleanupSelected} ({selectedIds.length})
                  </Text>
                </TouchSurface>
                <TouchSurface
                  style={[styles.selectionActionButton, styles.selectionKeepButton]}
                  pressedStyle={styles.selectionKeepButtonPressed}
                  onPress={() => void handleKeepSelected()}
                  preset="pill"
                  testID="keep-selected-button"
                >
                  <Text style={styles.selectionActionText}>
                    {copy.screens.photoGrid.keepSelected} ({selectedIds.length})
                  </Text>
                </TouchSurface>
              </View>
            </View>
          )}
        </>
      ) : null}
    </View>
  );
}

function createStyles(
  theme: AppThemePalette,
  insets: { top: number; bottom: number; left: number; right: number },
) {
  const SIZE_LARGE = 16;
  const SIZE_DEFAULT = 14;
  const SIZE_SMALL = 12;
  const MUTED_DANGER = '#d8646a';
  const MUTED_DANGER_PRESSED = '#c65a60';
  const MUTED_KEEP = '#18bf63';
  const MUTED_KEEP_PRESSED = '#15ad59';
  const entryInsets = buildPhotoGridEntryInsets(insets);
  const filterWrapInsets = buildFilterWrapInsets(insets);

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.safeArea,
    },
    entryCard: {
      marginTop: entryInsets.top,
      marginLeft: entryInsets.left,
      marginRight: entryInsets.right,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 18,
      backgroundColor: theme.cardBackground,
      borderWidth: 1,
      borderColor: theme.cardBorder,
      gap: 8,
    },
    entryEyebrow: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.pageTextSecondary,
      letterSpacing: 0.2,
    },
    entryHeaderRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
    },
    entryTextWrap: {
      flex: 1,
      gap: 4,
    },
    entryProgressWrap: {
      marginTop: 2,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: theme.cardMutedBorder,
    },
    entryTitle: {
      fontSize: SIZE_DEFAULT,
      fontWeight: '700',
      color: theme.pageTextPrimary,
    },
    entryBody: {
      fontSize: SIZE_SMALL,
      lineHeight: 16,
      color: theme.pageTextSecondary,
    },
    entryNote: {
      fontSize: 11,
      lineHeight: 15,
      color: theme.pageTextMuted,
    },
    scopeBreakdownRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      paddingTop: 2,
    },
    scopeBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: theme.cardMutedBackground,
      borderWidth: 1,
      borderColor: theme.cardMutedBorder,
    },
    scopeBadgeLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.pageTextSecondary,
    },
    scopeBadgeCount: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.pageTextPrimary,
    },
    inlineButton: {
      alignSelf: 'flex-start',
      borderRadius: 999,
      backgroundColor: theme.buttonPrimaryBackground,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    inlineButtonText: {
      color: theme.buttonPrimaryText,
      fontSize: SIZE_SMALL,
      fontWeight: '700',
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    noticeCard: {
      marginTop: 12,
      marginLeft: 16 + insets.left,
      marginRight: 16 + insets.right,
      padding: 16,
      borderRadius: 16,
      backgroundColor: theme.noticeBackground,
      borderWidth: 1,
      borderColor: theme.noticeBorder,
    },
    noticeTitle: {
      color: theme.noticeTitle,
      fontWeight: '700',
      marginBottom: 6,
    },
    noticeText: {
      color: theme.noticeText,
      lineHeight: 20,
    },
    filterWrap: {
      paddingTop: filterWrapInsets.top,
      paddingLeft: filterWrapInsets.left,
      paddingRight: filterWrapInsets.right,
    },
    gridStage: {
      flex: 1,
      position: 'relative',
    },
    gridLoadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(255, 255, 255, 0.18)',
    },
    actionBar: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      paddingTop: 6,
      paddingBottom: Math.max(insets.bottom, 8) + 8,
      paddingHorizontal: 12,
      backgroundColor: 'transparent',
    },
    selectionToggleButton: {
      minHeight: 40,
      minWidth: 0,
      paddingHorizontal: 14,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.cardBackground,
      borderWidth: 1,
      borderColor: theme.cardBorder,
      shadowColor: theme.shadowColor,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: theme.scheme === 'dark' ? 0.16 : 0.08,
      shadowRadius: 10,
      elevation: 2,
    },
    selectionToggleButtonPressed: {
      backgroundColor: theme.cardMutedBackground,
    },
    selectionToggleText: {
      color: theme.pageTextPrimary,
    },
    selectionActionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    selectionActionButton: {
      flex: 1,
      minHeight: 44,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: theme.shadowColor,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: theme.scheme === 'dark' ? 0.2 : 0.08,
      shadowRadius: 10,
      elevation: 2,
    },
    selectionDeleteButton: {
      backgroundColor: MUTED_DANGER,
    },
    selectionDeleteButtonPressed: {
      backgroundColor: MUTED_DANGER_PRESSED,
    },
    selectionKeepButton: {
      backgroundColor: MUTED_KEEP,
    },
    selectionKeepButtonPressed: {
      backgroundColor: MUTED_KEEP_PRESSED,
    },
    selectionActionText: {
      color: '#ffffff',
      fontSize: SIZE_DEFAULT,
      fontWeight: '800',
      letterSpacing: 0.2,
    },
  });
}
