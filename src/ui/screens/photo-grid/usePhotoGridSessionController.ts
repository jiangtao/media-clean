import * as MediaLibrary from 'expo-media-library';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import type { CleanupCandidate } from '../../../domain/recognition/types';
import {
  buildCleanupCandidates,
  createFallbackCandidate,
  sortCandidatesByScore,
  type AnalyzedMediaInput,
} from '../../../domain/recognition/scoring';
import type { AppLanguage } from '../../../i18n/app-language';
import {
  appendFalsePositiveCandidateIds,
  loadAssetManifestEntries,
  loadPhotoScanBatch,
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
  clearPhotoScanResultCache,
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
  type PhotoScanResultCache,
  type PhotoScanBatchItemStage,
  type PhotoScanBatchItemRecord,
  type PhotoScanBatchRecord,
} from '../../../services/storage/app-storage';
import {
  ACTIONABLE_SCAN_THRESHOLD,
  loadRecentScanAssets,
  scanMediaLibrary,
  type ScanSummary,
} from '../../../features/scan/scan-media-library';
import {
  DEFAULT_SCAN_WINDOW_DAYS,
  DEFAULT_SCAN_WINDOW_MONTHS_EQUIVALENT,
} from '../../../features/scan/scan-config';
import { resolveScanBatchProgressContract } from '../../../features/scan/scan-batch-progress';
import { syncAndroidBackgroundScanForegroundService } from '../../../features/scan/android-background-scan';
import {
  executeAndroidNativeFirstScan,
  isAndroidNativeScanSupported,
  loadActiveAndroidNativeScanSnapshot,
  stopAndroidNativeScan,
  type AndroidNativeScanRuntimeSnapshot,
} from '../../../features/scan/android-native-scan';
import { createAndroidNativeStagingImporter } from '../../../features/scan/android-native-staging-importer';
import {
  enumerateAndroidMediaStoreAssets,
  type AndroidMediaStoreAssetMetadata,
} from '../../../features/scan/android-media-store';
import {
  clearPhotoScanSessionRuntimeSnapshot,
  getPhotoScanSessionRuntimeSnapshot,
  hydratePhotoScanSessionRuntimeSnapshot,
  persistPhotoScanSessionRuntimeSnapshot,
  stagePhotoScanSessionRuntimeSnapshot,
} from '../../../features/scan/photo-scan-session-runtime';
import {
  clearPhotoScanJobCheckpoint,
  loadPhotoScanJobCheckpoint,
  savePhotoScanJobCheckpoint,
  type PhotoScanJobCheckpoint,
} from '../../../services/storage/scan-job-storage';
import {
  getMediaLibraryPermissionsAsync,
  requestMediaLibraryPermissionsAsync,
} from '../../../services/media-library-permissions';
import {
  buildScanRangeStartAt,
  loadScanRange,
  type ScanRange,
} from '../../../services/storage/scan-range-storage';
import { reconcileReminderRuntimeInForeground } from '../../../features/reminders/reminder-runtime';
import { captureLastValidScanBaseline } from '../../../services/notifications/cleanup-reminders';
import { notifyScanCompletionIfNeeded } from '../../../services/notifications/scan-completion-notifications';
import { PHOTO_GRID_ENTRY_INTERACTION_STANDARD } from '../screen-layout';
import type { SwipeSelectionReason } from '../../hooks/useSwipeSelection';

type PermissionState = 'loading' | 'granted' | 'denied';
type ScanScopeSelection = { total: number; photo: number; video: number };
type ScanProgressState = {
  current: number;
  total: number;
  currentFileName: string | null;
};
export type ScanBatchRangeState = PhotoScanSessionRange | null;

interface PhotoGridControllerCopy {
  alerts: {
    scanFailed: string;
    deleteFailedBody: string;
  };
  reminder: {
    channelName: string;
    channelDescription: string;
  };
}

interface UsePhotoGridSessionControllerOptions {
  copy: PhotoGridControllerCopy;
  language: AppLanguage;
  recycleBinIds: string[];
  onRecycleBinIdsChange?: (ids: string[]) => void;
}

function buildPhotoScanJobId(scanToken: number, startedAt: number) {
  return `photo-scan-${startedAt}-${scanToken}`;
}

function buildAutoResumeScanNotice(language: string) {
  if (language === 'zh-CN') {
    return '检测到 Android 本地扫描仍在继续，已自动接回当前批次。';
  }

  return 'Detected that the Android local scan is still running. The current batch has been reattached automatically.';
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

const SHOULD_LOG_ANDROID_ENUMERATION_PROBE = __DEV__ && process.env.NODE_ENV !== 'test';

function createAuthorizedMediaCandidate(asset: MediaLibrary.Asset): CleanupCandidate | null {
  if (
    asset.mediaType !== MediaLibrary.MediaType.photo &&
    asset.mediaType !== MediaLibrary.MediaType.video
  ) {
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

function matchesPhotoScanSessionScopeSelection(
  snapshot: Pick<PhotoScanSessionSnapshot, 'authorizedCandidates' | 'scanScopeSelection'>,
) {
  const expectedScopeSelection = buildScopeSelectionFromCandidates(snapshot.authorizedCandidates);

  return (
    snapshot.scanScopeSelection.total === expectedScopeSelection.total &&
    snapshot.scanScopeSelection.photo === expectedScopeSelection.photo &&
    snapshot.scanScopeSelection.video === expectedScopeSelection.video
  );
}

function isRestorablePersistedPhotoScanSessionSnapshot(snapshot: PhotoScanSessionSnapshot) {
  if (snapshot.permissionState !== 'granted') {
    return false;
  }

  if (!matchesPhotoScanSessionScopeSelection(snapshot)) {
    return false;
  }

  if (snapshot.phase === 'completed') {
    return (
      snapshot.scanProgress.current === snapshot.scanProgress.total &&
      snapshot.summary.scannedCount === snapshot.scanProgress.total &&
      snapshot.scanProgress.total === snapshot.authorizedCandidates.length &&
      snapshot.scanResultsCount === snapshot.visibleCandidates.length
    );
  }

  if (snapshot.phase === 'error') {
    return (
      snapshot.errorMessage !== null &&
      snapshot.errorMessage.trim().length > 0 &&
      snapshot.scanResultsCount === snapshot.visibleCandidates.length
    );
  }

  return false;
}

function shouldIgnoreCompletedPhotoScanCache(options: {
  cachedResult: PhotoScanResultCache;
  latestScanBatch: PhotoScanBatchRecord | null;
  authorizedCandidateCount: number;
}) {
  if (options.authorizedCandidateCount <= 0) {
    return false;
  }

  const completedScanDenominator = Math.max(
    options.cachedResult.summary.scannedCount,
    options.latestScanBatch?.progressTotal ?? 0,
  );

  return completedScanDenominator < options.authorizedCandidateCount;
}

function buildScopeSelectionFromManifestEntries(
  entries: readonly AssetManifestRecord[],
): ScanScopeSelection {
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
  const nextSnapshotCandidates = snapshotCandidates.filter(
    (candidate) => !targetIdSet.has(candidate.id),
  );

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
  const remainingDetailCandidates = detailCandidates.filter(
    (candidate) => !targetIdSet.has(candidate.id),
  );

  if (remainingDetailCandidates.length === 0) {
    return {
      nextPreviewCandidate: null,
      nextSnapshotCandidates,
    };
  }

  return {
    nextPreviewCandidate:
      remainingDetailCandidates[Math.min(currentIndex, remainingDetailCandidates.length - 1)] ??
      null,
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
    if (
      candidate.duplicateGroup?.groupId &&
      duplicateGroups.has(candidate.duplicateGroup.groupId)
    ) {
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

function mergeUnresolvedScanCandidates(
  existingCandidates: readonly CleanupCandidate[],
  incomingCandidates: readonly CleanupCandidate[],
  options: {
    falsePositiveIds: readonly string[];
    recycleBinIds: readonly string[];
    replacedAssetIds: readonly string[];
  },
) {
  const falsePositiveIdSet = new Set(options.falsePositiveIds);
  const recycleBinIdSet = new Set(options.recycleBinIds);
  const replacedAssetIdSet = new Set(options.replacedAssetIds);
  const mergedById = new Map<string, CleanupCandidate>();
  const isUnresolved = (candidate: CleanupCandidate) =>
    !falsePositiveIdSet.has(candidate.id) && !recycleBinIdSet.has(candidate.id);

  for (const candidate of existingCandidates) {
    if (isUnresolved(candidate) && !replacedAssetIdSet.has(candidate.asset.id)) {
      mergedById.set(candidate.id, candidate);
    }
  }

  for (const candidate of incomingCandidates) {
    if (isUnresolved(candidate)) {
      mergedById.set(candidate.id, candidate);
    }
  }

  return sortCandidatesByScore([...mergedById.values()]);
}

function mergePhotoScanSessionRanges(
  left: PhotoScanSessionRange | null,
  right: PhotoScanSessionRange | null,
): PhotoScanSessionRange | null {
  if (!left) {
    return right;
  }

  if (!right) {
    return left;
  }

  return {
    startAt:
      left.startAt === null || right.startAt === null
        ? null
        : Math.min(left.startAt, right.startAt),
    endAt:
      left.endAt === null
        ? right.endAt
        : right.endAt === null
          ? left.endAt
          : Math.max(left.endAt, right.endAt),
  };
}

function attachScanBatchRangeToCandidates(
  candidates: readonly CleanupCandidate[],
  range: PhotoScanSessionRange | null,
  options?: { overwrite?: boolean },
) {
  if (!range) {
    return [...candidates];
  }

  return candidates.map((candidate) => {
    if (!options?.overwrite && candidate.scanBatchRange) {
      return candidate;
    }

    return {
      ...candidate,
      scanBatchRange: {
        startAt: range.startAt,
        endAt: range.endAt,
      },
    };
  });
}

function buildUnresolvedScanBatchRange(
  candidates: readonly CleanupCandidate[],
): PhotoScanSessionRange | null {
  return candidates.reduce<PhotoScanSessionRange | null>(
    (range, candidate) => mergePhotoScanSessionRanges(range, candidate.scanBatchRange ?? null),
    null,
  );
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
    mediumConfidenceCount: candidates.filter((candidate) => candidate.confidence === 'medium')
      .length,
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
    if (latestCompletedBatch.progressTotal <= 0) {
      return {
        status: 'ready',
        mode: 'rolling-window' as const,
        rangeStartAt: rollingRangeStartAt,
        rangeEndAt: rollingRangeEndAt,
        windowDays: rollingWindowDays,
      };
    }

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

export function usePhotoGridSessionController({
  copy,
  language,
  recycleBinIds,
  onRecycleBinIdsChange,
}: UsePhotoGridSessionControllerOptions) {
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
  const scanScopeCount = PHOTO_GRID_ENTRY_INTERACTION_STANDARD.defaultScanScopeCount;

  const [permissionState, setPermissionState] = useState<PermissionState>(initialPermissionState);
  const [filter, setFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSelectionModeActive, setIsSelectionModeActive] = useState(false);
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
  const [previewSnapshotCandidates, setPreviewSnapshotCandidates] = useState<
    CleanupCandidate[] | null
  >(null);
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
  const scanBatchRangeRef = useRef<ScanBatchRangeState>(initialScanBatchRange);
  const completedScanBatchRangeRef = useRef<ScanBatchRangeState>(
    initialHasCompletedScan ? initialScanBatchRange : null,
  );
  const [scanScopeSelection, setScanScopeSelection] = useState<ScanScopeSelection>(
    initialScanScopeSelection,
  );
  const activeScanTokenRef = useRef(0);
  const isStartingScanRef = useRef(false);
  const activeScanJobIdRef = useRef<string | null>(null);
  const activeScanBatchRef = useRef<PhotoScanBatchRecord | null>(null);
  const activeScanPersistenceStateRef = useRef<
    'idle' | 'running' | 'completed' | 'failed' | 'cancelled'
  >('idle');
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
  const candidatesRef = useRef<CleanupCandidate[]>(
    initialHasCompletedScan ? initialVisibleCandidates : [],
  );
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
  const scanSummaryRef = useRef<
    Pick<ScanSummary, 'scannedAt' | 'scannedCount' | 'recycleBinCount'>
  >({
    scannedAt: initialRuntimeSnapshot?.summary.scannedAt ?? 0,
    scannedCount: initialRuntimeSnapshot?.summary.scannedCount ?? scanScopeCount,
    recycleBinCount: initialRuntimeSnapshot?.summary.recycleBinCount ?? 0,
  });
  const displayedCandidates = useMemo(
    () =>
      hasCompletedScan
        ? candidates
        : isScanning
          ? streamingCandidates
          : authorizedCandidates,
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

  useEffect(() => {
    candidatesRef.current = candidates;
  }, [candidates]);

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

  useEffect(() => {
    scanBatchRangeRef.current = scanBatchRange;
  }, [scanBatchRange]);

  useEffect(() => {
    if (!isScanning && hasCompletedScan) {
      completedScanBatchRangeRef.current = scanBatchRange;
    }
  }, [hasCompletedScan, isScanning, scanBatchRange]);

  useEffect(() => () => {
    void persistPhotoScanSessionRuntimeSnapshot(getPhotoScanSessionRuntimeSnapshot());
  }, []);

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

  const buildCurrentSessionSnapshot = useCallback(
    (overrides?: {
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
    }),
    [
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
    ],
  );

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
    if (snapshot.phase === 'completed') {
      completedScanBatchRangeRef.current = snapshot.scanBatchRange ?? null;
    }
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

  const syncAndroidForegroundScanProgress = useCallback(
    (nextOptions: {
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
    },
    [language],
  );

  const hydrateAuthorizedState = useCallback(
    async (options?: {
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
      if (SHOULD_LOG_ANDROID_ENUMERATION_PROBE && Platform.OS === 'android') {
        console.info('[photo-grid] hydrateAuthorizedState android enumeration', {
          createdAfter,
          count: enumeratedAndroidAssets.length,
        });
        if (enumeratedAndroidAssets.length === 0) {
          const [unboundedAndroidProbe, unboundedMediaLibraryProbe] = await Promise.all([
            enumerateAndroidMediaStoreAssets({ limit: 3 }),
            loadRecentScanAssets({ limit: 3 }),
          ]);
          console.info('[photo-grid] hydrateAuthorizedState android unbounded probe', {
            androidCount: unboundedAndroidProbe.length,
            androidAssetIds: unboundedAndroidProbe.map((asset) => asset.assetId),
            androidModifiedAt: unboundedAndroidProbe.map((asset) => asset.dateModified),
            mediaLibraryCount: unboundedMediaLibraryProbe.length,
            mediaLibraryAssetIds: unboundedMediaLibraryProbe.map((asset) => asset.id),
            mediaLibraryCreationTime: unboundedMediaLibraryProbe.map(
              (asset) => asset.creationTime,
            ),
          });
        }
      }
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
      let effectiveCachedResult = cachedResult;
      let effectiveLatestScanBatch = latestScanBatch;
      authorizedCandidatesRef.current = nextAuthorizedCandidates;

      if (
        cachedResult &&
        shouldIgnoreCompletedPhotoScanCache({
          cachedResult,
          latestScanBatch,
          authorizedCandidateCount: nextSelection.total,
        })
      ) {
        if (SHOULD_LOG_ANDROID_ENUMERATION_PROBE) {
          console.info('[photo-grid] ignore stale completed scan cache', {
            authorizedCount: nextSelection.total,
            cachedScannedCount: cachedResult.summary.scannedCount,
            latestBatchProgressTotal: latestScanBatch?.progressTotal ?? null,
            latestBatchPhase: latestScanBatch?.phase ?? null,
          });
        }

        await clearPhotoScanResultCache().catch(() => undefined);
        effectiveCachedResult = null;
        effectiveLatestScanBatch = null;
      }

      setScanScopeSelection(nextSelection);
      setAuthorizedCandidates(nextAuthorizedCandidates);
      if (!options?.preserveRunningProgress) {
        setStreamingCandidates(nextAuthorizedCandidates);
      }
      setResumeMessage(null);

      if (!effectiveCachedResult) {
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
        scannedAt: effectiveCachedResult.summary.scannedAt,
        scannedCount: effectiveCachedResult.summary.scannedCount,
        recycleBinCount: effectiveCachedResult.summary.recycleBinCount,
      };
      const filteredCachedCandidates = filterFalsePositiveCandidates(
        effectiveCachedResult.activeCandidates,
        falsePositiveIds,
      );
      const completedScanDenominator = Math.max(
        effectiveCachedResult.summary.scannedCount,
        effectiveLatestScanBatch?.progressTotal ?? 0,
      );
      const latestCompletedBatchRange = effectiveLatestScanBatch
        ? {
            startAt: effectiveLatestScanBatch.rangeStartAt,
            endAt: effectiveLatestScanBatch.rangeEndAt,
          }
        : null;
      const cachedFallbackScanRange = mergePhotoScanSessionRanges(
        scanBatchRangeRef.current,
        latestCompletedBatchRange,
      );
      const didBackfillCachedCandidateRange =
        cachedFallbackScanRange !== null &&
        filteredCachedCandidates.some((candidate) => !candidate.scanBatchRange);
      const rangedCachedCandidates = attachScanBatchRangeToCandidates(
        filteredCachedCandidates,
        cachedFallbackScanRange,
      );
      const completedScanRange =
        buildUnresolvedScanBatchRange(rangedCachedCandidates) ?? cachedFallbackScanRange;

      setCandidates(rangedCachedCandidates);
      setStreamingCandidates(rangedCachedCandidates);
      setSelectedIds([]);
      setScanResultsCount(rangedCachedCandidates.length);
      setScanScopeSelection(nextSelection);
      setHasCompletedFullScan(
        effectiveLatestScanBatch?.phase === 'completed' &&
          effectiveLatestScanBatch.mode === 'full',
      );
      completedScanBatchRangeRef.current = completedScanRange;
      setScanBatchRange(completedScanRange);
      setScanProgress({
        current: completedScanDenominator,
        total: completedScanDenominator,
        currentFileName: null,
      });
      setIsScanning(false);
      setHasCompletedScan(true);

      if (
        filteredCachedCandidates.length !== effectiveCachedResult.activeCandidates.length ||
        didBackfillCachedCandidateRange
      ) {
        await savePhotoScanResultCache({
          activeCandidates: rangedCachedCandidates,
          summary: buildFilteredSummary(scanSummaryRef.current, rangedCachedCandidates),
        });
      }
      return {
        authorizedCandidates: nextAuthorizedCandidates,
        scanScopeSelection: nextSelection,
      };
    },
    [applyRunningScanProgress],
  );

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
        const [persistedSession, pendingScanJob, nativeRuntimeSnapshot, latestScanBatch] =
          await Promise.all([
            hydratePhotoScanSessionRuntimeSnapshot(),
            loadPhotoScanJobCheckpoint(),
            loadActiveAndroidNativeScanSnapshot(),
            loadLatestPhotoScanBatch(),
          ]);
        let effectivePendingScanJob = pendingScanJob;
        let effectivePendingScanBatch = latestScanBatch;
        let effectivePersistedSession = persistedSession;

        if (!isActive) {
          return true;
        }

        if (
          !runtimeSnapshot &&
          effectivePersistedSession &&
          effectivePersistedSession.phase !== 'idle' &&
          !isRestorablePersistedPhotoScanSessionSnapshot(effectivePersistedSession)
        ) {
          if (SHOULD_LOG_ANDROID_ENUMERATION_PROBE) {
            console.info('[photo-grid] drop incoherent persisted session snapshot', {
              phase: effectivePersistedSession.phase,
              authorizedCount: effectivePersistedSession.authorizedCandidates.length,
              visibleCount: effectivePersistedSession.visibleCandidates.length,
              scanResultsCount: effectivePersistedSession.scanResultsCount,
              scannedCount: effectivePersistedSession.summary.scannedCount,
              progressCurrent: effectivePersistedSession.scanProgress.current,
              progressTotal: effectivePersistedSession.scanProgress.total,
              scopeSelection: effectivePersistedSession.scanScopeSelection,
            });
          }

          await clearPhotoScanSessionRuntimeSnapshot().catch(() => undefined);
          effectivePersistedSession = null;
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

          await hydrateAuthorizedState({
            ignoreCachedResult: true,
            preserveRunningProgress: true,
          });

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

        if (
          runtimeSnapshot &&
          effectivePersistedSession &&
          effectivePersistedSession.phase !== 'idle'
        ) {
          const [falsePositiveIds, recycleBinCandidateCache] = await Promise.all([
            loadFalsePositiveCandidateIds(),
            loadRecycleBinCandidateCache(),
          ]);

          falsePositiveIdsRef.current = falsePositiveIds;
          recycleBinCandidateCacheRef.current = recycleBinCandidateCache;

          if (!isActive) {
            return true;
          }

          applySessionSnapshot(effectivePersistedSession);
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

          await hydrateAuthorizedState({
            ignoreCachedResult: true,
            preserveRunningProgress: true,
          });

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

        if (
          effectivePendingScanBatch &&
          isResumablePhotoScanBatchPhase(effectivePendingScanBatch.phase)
        ) {
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
            hydrateAuthorizedState({
              ignoreCachedResult: true,
              preserveRunningProgress: true,
            }),
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

        if (effectivePersistedSession && effectivePersistedSession.phase !== 'idle') {
          const [falsePositiveIds, recycleBinCandidateCache] = await Promise.all([
            loadFalsePositiveCandidateIds(),
            loadRecycleBinCandidateCache(),
          ]);

          falsePositiveIdsRef.current = falsePositiveIds;
          recycleBinCandidateCacheRef.current = recycleBinCandidateCache;

          if (!isActive) {
            return true;
          }

          applySessionSnapshot(effectivePersistedSession);
          return true;
        }

        return false;
      }

      async function refreshPermissionState() {
        try {
          const permission = await getMediaLibraryPermissionsAsync();

          if (!isActive) {
            return;
          }

          const stagedSnapshot = getPhotoScanSessionRuntimeSnapshot();
          const shouldPreserveActiveState =
            shouldPreserveGrantedActiveSnapshot(stagedSnapshot);

          if (permission.granted) {
            const didRestorePendingState = await restorePendingScanIfNeeded();
            if (!isActive) {
              return;
            }

            if (!didRestorePendingState) {
              await refreshAuthorizedState();
            }
            if (isActive) {
              setPermissionState('granted');
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
    }, [applyRunningScanProgress, applySessionSnapshot, hydrateAuthorizedState, language]),
  );

  const resetScanProgress = useCallback(
    (nextTotal = scanScopeSelection.total) => {
      setScanProgress({
        current: 0,
        total: nextTotal,
        currentFileName: null,
      });
      setScanResultsCount(0);
    },
    [scanScopeSelection.total],
  );

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
    setSelectedIds((prev) => {
      const isSelecting = !prev.includes(id);
      if (isSelecting) {
        setIsSelectionModeActive(true);
      }
      return prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id];
    });
  }, []);

  const handleSelectionChange = useCallback(
    (nextIds: string[], _reason: SwipeSelectionReason) => {
      setIsSelectionModeActive(true);
      setSelectedIds(nextIds);
    },
    [],
  );

  const handleItemPress = useCallback(
    (candidate: CleanupCandidate) => {
      isPreviewOpenRef.current = true;
      setPreviewCandidate(candidate);
      setPreviewSnapshotCandidates(displayedCandidates);
    },
    [displayedCandidates],
  );

  const persistCurrentScanCandidates = useCallback(
    async (
      nextCandidates: CleanupCandidate[],
      falsePositiveIds: readonly string[] = falsePositiveIdsRef.current,
    ) => {
      if (!hasCompletedScan) {
        return;
      }

      try {
        const filteredCandidates = filterFalsePositiveCandidates(
          nextCandidates,
          falsePositiveIds,
        );
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
      const nextCandidates = candidates.filter(
        (candidate) => !idsToRemoveSet.has(candidate.id),
      );
      const nextRecycleBinIds = [...recycleBinIdsRef.current, ...idsToRemove];
      const movedCandidates = candidates.filter((candidate) => idsToRemoveSet.has(candidate.id));
      const nextRecycleBinCandidateCache = mergeRecycleBinCandidateCache(
        recycleBinCandidateCacheRef.current,
        movedCandidates,
        nextRecycleBinIds,
      );
      const nextScanBatchRange = buildUnresolvedScanBatchRange(nextCandidates);

      setCandidates(nextCandidates);
      setStreamingCandidates(nextCandidates);
      setSelectedIds([]);
      setIsSelectionModeActive(false);
      setScanResultsCount(nextCandidates.length);
      setScanScopeSelection(buildScopeSelectionFromCandidates(nextCandidates));
      completedScanBatchRangeRef.current = nextScanBatchRange;
      setScanBatchRange(nextScanBatchRange);
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
  }, [
    candidates,
    copy.alerts.deleteFailedBody,
    persistCurrentScanCandidates,
    persistMediaLedger,
    persistRecycleBinState,
    selectedIds,
  ]);

  const handleKeepSelected = useCallback(async () => {
    if (selectedIds.length === 0 || !hasCompletedScan) {
      return;
    }

    try {
      const falsePositiveIds = await appendFalsePositiveCandidateIds(selectedIds);
      falsePositiveIdsRef.current = falsePositiveIds;

      const selectedIdSet = new Set(selectedIds);
      const nextCandidates = candidates.filter(
        (candidate) => !selectedIdSet.has(candidate.id),
      );
      const nextScanBatchRange = buildUnresolvedScanBatchRange(nextCandidates);

      setCandidates(nextCandidates);
      setStreamingCandidates(nextCandidates);
      setSelectedIds([]);
      setIsSelectionModeActive(false);
      setScanResultsCount(nextCandidates.length);
      setScanScopeSelection(buildScopeSelectionFromCandidates(nextCandidates));
      completedScanBatchRangeRef.current = nextScanBatchRange;
      setScanBatchRange(nextScanBatchRange);
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
  }, [
    candidates,
    copy.alerts.deleteFailedBody,
    hasCompletedScan,
    persistCurrentScanCandidates,
    persistMediaLedger,
    selectedIds,
  ]);

  const handleRequestPermission = useCallback(async () => {
    try {
      const permission = await requestMediaLibraryPermissionsAsync();
      setPermissionState(permission.granted ? 'granted' : 'denied');
      setResumeMessage(null);

      if (permission.granted) {
        return await hydrateAuthorizedState();
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

    return null;
  }, [hydrateAuthorizedState]);

  const handleStartScan = useCallback(
    async (options?: {
      sourceCandidates?: CleanupCandidate[];
      recoveryCheckpoint?: PhotoScanJobCheckpoint | null;
      nativeRuntimeSnapshot?: AndroidNativeScanRuntimeSnapshot | null;
      scanBatchRange?: ScanBatchRangeState;
    }) => {
      if (isStartingScanRef.current) {
        return;
      }

      isStartingScanRef.current = true;
      const initialSourceCandidates =
        options?.sourceCandidates ?? authorizedCandidatesRef.current;
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
      const scanJobId = nativeRuntimeStatus?.jobId ?? buildPhotoScanJobId(scanToken, startedAt);
      activeScanTokenRef.current = scanToken;
      activeScanJobIdRef.current = scanJobId;
      activeScanPersistenceStateRef.current = 'running';
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
      setResumeMessage(recoveryCheckpoint ? buildAutoResumeScanNotice(language) : null);
      setIsScanning(true);
      setHasCompletedScan(false);
      setHasCompletedFullScan(false);
      setStreamingCandidates(initialSourceCandidates);
      setScanScopeSelection(buildScopeSelectionFromCandidates(initialSourceCandidates));
      resetScanProgress(initialSourceCandidates.length);
      setScanBatchRange(requestedScanBatchRange);

      try {
        const [
          recycleBinIdsValue,
          falsePositiveIds,
          recycleBinCandidateCache,
          analysisCache,
          loadedScanRangeMonths,
          latestCompletedScanBatch,
          recoveryScanBatch,
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
          recoveryCheckpoint && !nativeRuntimeStatus
            ? loadPhotoScanBatch(recoveryCheckpoint.jobId)
            : Promise.resolve(null),
        ]);
        recycleBinIdsRef.current = recycleBinIdsValue;
        falsePositiveIdsRef.current = falsePositiveIds;
        recycleBinCandidateCacheRef.current = recycleBinCandidateCache;
        scanRangeMonths = loadedScanRangeMonths;
        const fallbackRangeEndAt = requestedScanBatchRange?.endAt ?? startedAt;
        const fallbackRangeStartAt = requestedScanBatchRange
          ? requestedScanBatchRange.startAt
          : buildScanRangeStartAt(scanRangeMonths, fallbackRangeEndAt);
        createdAfter = fallbackRangeStartAt;
        rangeEndAt = fallbackRangeEndAt;
        setScanBatchRange({ startAt: createdAfter, endAt: rangeEndAt });

        if (Platform.OS === 'android' && !nativeRuntimeStatus) {
          const shouldRebuildRecoveryWindowFromBatch =
            Boolean(recoveryCheckpoint) &&
            Boolean(recoveryScanBatch) &&
            recoveryScanBatch?.rangeStartAt !== null &&
            recoveryScanBatch?.mode !== 'rolling-window';

          if (shouldRebuildRecoveryWindowFromBatch) {
            createdAfter = recoveryScanBatch?.rangeStartAt ?? createdAfter;
            rangeEndAt =
              recoveryScanBatch?.rangeEndAt ?? requestedScanBatchRange?.endAt ?? rangeEndAt;
            batchMode = recoveryScanBatch?.mode ?? batchMode;
            windowDays =
              recoveryScanBatch?.windowDays ??
              buildWindowDaysFromRange(createdAfter, rangeEndAt) ??
              windowDays;
            setScanBatchRange({ startAt: createdAfter, endAt: rangeEndAt });

            const canFallbackToMediaLibraryWindow = batchMode !== 'backfill';
            const enumeratedAssets = await enumerateAndroidMediaStoreAssets({
              createdAfter,
              createdBefore: rangeEndAt,
            });
            if (SHOULD_LOG_ANDROID_ENUMERATION_PROBE) {
              console.info('[photo-grid] recovery scan android enumeration', {
                jobId: recoveryCheckpoint?.jobId ?? null,
                mode: batchMode,
                createdAfter,
                createdBefore: rangeEndAt,
                count: enumeratedAssets.length,
              });
            }
            didUseAndroidMetadataWindow = enumeratedAssets.length > 0;
            const fallbackWindowAssets =
              enumeratedAssets.length === 0 && canFallbackToMediaLibraryWindow
                ? await loadRecentScanAssets({
                    excludedAssetIds: falsePositiveIds,
                    createdAfter,
                    createdBefore: rangeEndAt,
                  })
                : [];

            if (enumeratedAssets.length > 0) {
              const existingManifestEntries = await loadAssetManifestEntries(
                enumeratedAssets.map((asset) => asset.assetId),
              );
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
            } else if (fallbackWindowAssets.length > 0) {
              sourceCandidates = fallbackWindowAssets
                .map((asset) => createAuthorizedMediaCandidate(asset))
                .filter((candidate): candidate is CleanupCandidate => Boolean(candidate));
              const existingManifestEntries = await loadAssetManifestEntries(
                sourceCandidates.map((candidate) => candidate.asset.id),
              );
              manifestEntries = buildAssetManifestEntriesFromCandidates(
                sourceCandidates,
                existingManifestEntries,
                analysisCache,
                startedAt,
              );
            } else {
              sourceCandidates = [];
            }
          } else if (!recoveryCheckpoint) {
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

            const canFallbackToMediaLibraryWindow = batchMode !== 'backfill';
            const enumeratedAssets = await enumerateAndroidMediaStoreAssets({
              createdAfter,
              createdBefore: rangeEndAt,
            });
            if (SHOULD_LOG_ANDROID_ENUMERATION_PROBE) {
              console.info('[photo-grid] active scan android enumeration', {
                createdAfter,
                createdBefore: rangeEndAt,
                count: enumeratedAssets.length,
                batchMode,
              });
            }
            didUseAndroidMetadataWindow = enumeratedAssets.length > 0;
            const fallbackWindowAssets =
              enumeratedAssets.length === 0 && canFallbackToMediaLibraryWindow
                ? await loadRecentScanAssets({
                    excludedAssetIds: falsePositiveIds,
                    createdAfter,
                    createdBefore: rangeEndAt,
                  })
                : [];
            const hasOlderAndroidAssets =
              hasCompletedHistoricalCoverage || createdAfter === null
                ? false
                : enumeratedAssets.length > 0 || !canFallbackToMediaLibraryWindow
                  ? (
                      await enumerateAndroidMediaStoreAssets({
                        createdBefore: createdAfter,
                        limit: 1,
                      })
                    ).length > 0
                  : (
                      await loadRecentScanAssets({
                        excludedAssetIds: falsePositiveIds,
                        createdBefore: createdAfter,
                        limit: 1,
                      })
                    ).length > 0;
            if (SHOULD_LOG_ANDROID_ENUMERATION_PROBE) {
              console.info('[photo-grid] active scan android older-assets probe', {
                createdAfter,
                canFallbackToMediaLibraryWindow,
                hasOlderAndroidAssets,
              });
            }
            if (enumeratedAssets.length > 0) {
              const existingManifestEntries = await loadAssetManifestEntries(
                enumeratedAssets.map((asset) => asset.assetId),
              );
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
            } else if (fallbackWindowAssets.length > 0) {
              sourceCandidates = fallbackWindowAssets
                .map((asset) => createAuthorizedMediaCandidate(asset))
                .filter((candidate): candidate is CleanupCandidate => Boolean(candidate));
              const existingManifestEntries = await loadAssetManifestEntries(
                sourceCandidates.map((candidate) => candidate.asset.id),
              );
              manifestEntries = buildAssetManifestEntriesFromCandidates(
                sourceCandidates,
                existingManifestEntries,
                analysisCache,
                startedAt,
              );
            } else {
              sourceCandidates = [];
            }

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
        }

        if (manifestEntries.length === 0 && !didUseAndroidMetadataWindow) {
          const sourceCandidateAssetIds = sourceCandidates.map((candidate) => candidate.asset.id);
          const existingManifestEntries = await loadAssetManifestEntries(
            sourceCandidateAssetIds,
          );
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

        setResumeMessage(recoveryCheckpoint ? buildAutoResumeScanNotice(language) : null);
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
          Platform.OS === 'android' &&
          (await isAndroidNativeScanSupported().catch(() => false));
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
          initialBatchItems.map(
            (item) => [item.assetId, item] satisfies [string, PhotoScanBatchItemRecord],
          ),
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
            if (
              activeScanTokenRef.current !== scanToken ||
              activeScanJobIdRef.current !== scanJobId ||
              activeScanPersistenceStateRef.current !== 'running'
            ) {
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
              checkpoint.processedCount -
                lastPersistedBatchItemsProcessedCountRef.current >=
                25;

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
                    lastPersistedBatchItemsProcessedCountRef.current =
                      checkpoint.processedCount;
                  })
                : Promise.resolve(),
            ]);

            if (
              activeScanTokenRef.current !== scanToken ||
              activeScanJobIdRef.current !== scanJobId
            ) {
              return;
            }

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
            if (
              activeScanTokenRef.current !== scanToken ||
              activeScanJobIdRef.current !== scanJobId ||
              activeScanPersistenceStateRef.current !== 'running'
            ) {
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
            const mergedProgress = mergeRunningScanProgress(
              activeScanCheckpointRef.current,
              nextScanProgress,
            );
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
              activeScanPersistenceStateRef.current === 'running' &&
              (progress.current === progress.total ||
                now - lastProgressCheckpointPersistAtRef.current >= 500)
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
                .then(() => {
                  if (
                    activeScanTokenRef.current !== scanToken ||
                    activeScanJobIdRef.current !== scanJobId ||
                    activeScanPersistenceStateRef.current !== 'running'
                  ) {
                    return;
                  }

                  return savePhotoScanBatch(runningBatchRecord);
                })
                .catch((checkpointError) => {
                  console.error(
                    'Failed to persist running scan progress checkpoint:',
                    checkpointError,
                  );
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
              const nextScopeSelection =
                buildScopeSelectionFromCandidates(nextVisibleCandidates);

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
                  recycleBinIds: recycleBinIdsValue,
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
            : await scanMediaLibrary(recycleBinIdsValue, legacyScanOptions);

        if (activeScanTokenRef.current !== scanToken) {
          return;
        }

        activeScanTokenRef.current += 1;
        activeScanJobIdRef.current = null;

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
        const completedBatchRange: PhotoScanSessionRange = {
          startAt: createdAfter,
          endAt: rangeEndAt,
        };
        const existingCandidatesFallbackRange =
          buildUnresolvedScanBatchRange(candidatesRef.current) ??
          completedScanBatchRangeRef.current ??
          scanBatchRangeRef.current;
        const existingCandidatesForMerge = attachScanBatchRangeToCandidates(
          candidatesRef.current,
          existingCandidatesFallbackRange,
        );
        const completedBatchCandidates = attachScanBatchRangeToCandidates(
          result.state.activeCandidates,
          completedBatchRange,
          { overwrite: true },
        );
        const filteredCandidates = filterFalsePositiveCandidates(
          completedBatchCandidates,
          falsePositiveIds,
        );
        const mergedUnresolvedCandidates = mergeUnresolvedScanCandidates(
          existingCandidatesForMerge,
          filteredCandidates,
          {
            falsePositiveIds,
            recycleBinIds: recycleBinIdsValue,
            replacedAssetIds: sourceCandidateAssetIds,
          },
        );
        const unresolvedScanBatchRange =
          buildUnresolvedScanBatchRange(mergedUnresolvedCandidates) ?? completedBatchRange;

        setCandidates(mergedUnresolvedCandidates);
        setStreamingCandidates(mergedUnresolvedCandidates);
        setSelectedIds([]);
        setScanResultsCount(mergedUnresolvedCandidates.length);
        setScanScopeSelection(batchScopeSelection);
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
        completedScanBatchRangeRef.current = unresolvedScanBatchRange;
        setScanBatchRange(unresolvedScanBatchRange);
        activeScanPersistenceStateRef.current = 'completed';
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
          candidateCount: mergedUnresolvedCandidates.length,
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
          const baseline = await captureLastValidScanBaseline(
            {
              scannedAt: result.summary.scannedAt,
              scannedCount: completedScannedCount,
              candidateCount: mergedUnresolvedCandidates.length,
              ledgerUpdatedAt: result.summary.scannedAt,
            },
            {
              scanRangeMonths,
              createdAfter: buildScanRangeStartAt(
                scanRangeMonths,
                result.summary.scannedAt,
              ),
            },
          );

          await saveLastScanMeta({
            scannedAt: result.summary.scannedAt,
            scannedCount: completedScannedCount,
            candidateCount: mergedUnresolvedCandidates.length,
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
              activeCandidates: mergedUnresolvedCandidates,
              summary: buildFilteredSummary(scanSummaryRef.current, mergedUnresolvedCandidates),
            }),
            persistMediaLedger({
              activeCandidates: mergedUnresolvedCandidates,
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
            console.error(
              'Failed to reconcile reminder runtime after scan:',
              reminderError,
            );
          }
        }

        if (appStateRef.current !== 'active') {
          try {
            await notifyScanCompletionIfNeeded({
              language,
              scannedCount: completedScannedCount,
              resultCount: mergedUnresolvedCandidates.length,
            });
          } catch (notificationError) {
            console.error(
              'Failed to present scan completion notification:',
              notificationError,
            );
          }
        }

        if (didPersistTerminalRecoveryState) {
          await clearPhotoScanJobCheckpoint();
        }
        activeScanBatchRef.current = null;
        activeScanPersistenceStateRef.current = 'idle';
      } catch (error) {
        if (activeScanTokenRef.current !== scanToken) {
          return;
        }

        activeScanTokenRef.current += 1;
        activeScanJobIdRef.current = null;
        activeScanPersistenceStateRef.current = 'failed';

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

        activeScanBatchRef.current = null;
        activeScanPersistenceStateRef.current = 'idle';
      } finally {
        isStartingScanRef.current = false;
      }
    },
    [
      applyRunningScanProgress,
      copy.alerts.scanFailed,
      copy.reminder.channelDescription,
      copy.reminder.channelName,
      language,
      persistMediaLedger,
      resetScanProgress,
      scanProgress.total,
      syncAndroidForegroundScanProgress,
    ],
  );

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
      activeScanPersistenceStateRef.current = 'cancelled';
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
    activeScanPersistenceStateRef.current = 'idle';
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
    setScanScopeSelection(
      buildScopeSelectionFromCandidates(authorizedCandidatesRef.current),
    );
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
      if (SHOULD_LOG_ANDROID_ENUMERATION_PROBE) {
        console.info('[photo-grid] preview primary action invoked', {
          previewCandidateId: previewCandidate?.id ?? null,
          requestedIds: ids ?? null,
          hasCompletedScan,
          candidateCount: candidates.length,
          displayedCount: displayedCandidates.length,
        });
      }

      if (!previewCandidate || !hasCompletedScan) {
        if (SHOULD_LOG_ANDROID_ENUMERATION_PROBE) {
          console.info('[photo-grid] preview primary action dismissed before persist', {
            previewCandidateId: previewCandidate?.id ?? null,
            hasCompletedScan,
          });
        }
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
        const { nextPreviewCandidate, nextSnapshotCandidates } =
          buildNextDetailViewState(
            detailSnapshotCandidates,
            previewCandidate,
            targetIds,
            targetIds[0] ?? previewCandidate.id,
          );
        const nextScanBatchRange = buildUnresolvedScanBatchRange(nextCandidates);

        setCandidates(nextCandidates);
        setStreamingCandidates(nextCandidates);
        setSelectedIds([]);
        setScanResultsCount(nextCandidates.length);
        setScanScopeSelection(buildScopeSelectionFromCandidates(nextCandidates));
        completedScanBatchRangeRef.current = nextScanBatchRange;
        setScanBatchRange(nextScanBatchRange);
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
        if (SHOULD_LOG_ANDROID_ENUMERATION_PROBE) {
          console.info('[photo-grid] preview primary action persisted', {
            targetIds,
            nextCandidateCount: nextCandidates.length,
            nextRecycleBinCount: nextRecycleBinIds.length,
          });
        }
      } catch (error) {
        console.error('Failed to clean preview candidate:', error);
        setErrorMessage(error instanceof Error ? error.message : copy.alerts.deleteFailedBody);
      }
    },
    [
      candidates,
      copy.alerts.deleteFailedBody,
      dismissPreview,
      displayedCandidates,
      hasCompletedScan,
      persistCurrentScanCandidates,
      persistMediaLedger,
      persistRecycleBinState,
      previewCandidate,
      previewSnapshotCandidates,
    ],
  );

  const handlePreviewHardDelete = useCallback(
    async (ids?: string[]) => {
      await handlePreviewPrimaryAction(ids);
    },
    [handlePreviewPrimaryAction],
  );

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
        const nextCandidates = candidates.filter(
          (candidate) => !falsePositiveIdSet.has(candidate.id),
        );
        const detailSnapshotCandidates = previewSnapshotCandidates ?? displayedCandidates;
        const { nextPreviewCandidate, nextSnapshotCandidates } =
          buildNextDetailViewState(
            detailSnapshotCandidates,
            previewCandidate,
            targetIds,
            targetIds[0] ?? previewCandidate.id,
          );
        const nextScanBatchRange = buildUnresolvedScanBatchRange(nextCandidates);

        setCandidates(nextCandidates);
        setStreamingCandidates(nextCandidates);
        setSelectedIds((prev) => prev.filter((id) => !falsePositiveIdSet.has(id)));
        setScanResultsCount(nextCandidates.length);
        setScanScopeSelection(buildScopeSelectionFromCandidates(nextCandidates));
        completedScanBatchRangeRef.current = nextScanBatchRange;
        setScanBatchRange(nextScanBatchRange);
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
    [
      candidates,
      copy.alerts.deleteFailedBody,
      dismissPreview,
      displayedCandidates,
      hasCompletedScan,
      persistCurrentScanCandidates,
      persistMediaLedger,
      previewCandidate,
      previewSnapshotCandidates,
    ],
  );

  return {
    permissionState,
    filter,
    setFilter,
    selectedIds,
    setSelectedIds,
    displayedCandidates,
    isSelectionMode: isSelectionModeActive,
    exitSelectionMode: useCallback(() => {
      setIsSelectionModeActive(false);
      setSelectedIds([]);
    }, []),
    isAllSelectableSelected,
    previewCandidate,
    previewDuplicateCandidates,
    errorMessage,
    resumeMessage,
    isScanning,
    hasCompletedScan,
    hasCompletedFullScan,
    scanResultsCount,
    scanProgress,
    scanBatchRange,
    scanScopeSelection,
    handleSelect,
    handleSelectionChange,
    handleItemPress,
    handleCleanupSelected,
    handleKeepSelected,
    handleRequestPermission,
    handleStartScan,
    handleCancelScan,
    handleToggleSelectAll,
    handleClosePreview,
    handlePreviewPrimaryAction,
    handlePreviewHardDelete,
    handlePreviewKeep,
  };
}
