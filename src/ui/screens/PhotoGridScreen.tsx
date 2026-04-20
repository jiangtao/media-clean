import * as MediaLibrary from 'expo-media-library';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, View, Text, StyleSheet, Pressable } from 'react-native';
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
  loadFalsePositiveCandidateIds,
  loadPhotoScanResultCache,
  loadRecycleBinCandidateCache,
  loadRecycleBinIds,
  saveLastScanMeta,
  savePhotoScanResultCache,
  saveRecycleBinCandidateCache,
  saveRecycleBinIds,
} from '../../services/storage/app-storage';
import {
  ACTIONABLE_SCAN_THRESHOLD,
  scanMediaLibrary,
  type ScanSummary,
} from '../../features/scan/scan-media-library';
import {
  buildFilterWrapInsets,
  buildPhotoGridContentPadding,
  buildPhotoGridEntryCopy,
  buildPhotoGridEntryInsets,
  buildPhotoGridFilterOptions,
  buildPhotoGridTabOptions,
  PHOTO_GRID_ENTRY_INTERACTION_STANDARD,
} from './screen-layout';
import { notifyScanCompletionIfNeeded } from '../../services/notifications/scan-completion-notifications';

type PermissionState = 'loading' | 'granted' | 'denied';
type ScanScopeSelection = { total: number; photo: number; video: number };
type ScanProgressState = {
  current: number;
  total: number;
  currentFileName: string | null;
};
type PhotoGridScreenProps = {
  recycleBinIds?: string[];
  onRecycleBinIdsChange?: (ids: string[]) => void;
};

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

export function PhotoGridScreen({
  recycleBinIds = [],
  onRecycleBinIdsChange,
}: PhotoGridScreenProps) {
  const { copy, theme, language } = useAppPreferences();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme, insets), [insets, theme]);
  const filterOptions = useMemo(() => buildPhotoGridFilterOptions(copy), [copy]);
  const contentPadding = useMemo(() => buildPhotoGridContentPadding(insets), [insets]);
  const scanScopeCount = PHOTO_GRID_ENTRY_INTERACTION_STANDARD.defaultScanScopeCount;

  const [permissionState, setPermissionState] = useState<PermissionState>('loading');
  const [filter, setFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [candidates, setCandidates] = useState<CleanupCandidate[]>([]);
  const [authorizedCandidates, setAuthorizedCandidates] = useState<CleanupCandidate[]>([]);
  const [streamingCandidates, setStreamingCandidates] = useState<CleanupCandidate[]>([]);
  const [previewCandidate, setPreviewCandidate] = useState<CleanupCandidate | null>(null);
  const [previewSnapshotCandidates, setPreviewSnapshotCandidates] = useState<CleanupCandidate[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [hasCompletedScan, setHasCompletedScan] = useState(false);
  const [scanResultsCount, setScanResultsCount] = useState(0);
  const [scanProgress, setScanProgress] = useState<ScanProgressState>({
    current: 0,
    total: scanScopeCount,
    currentFileName: null as string | null,
  });
  const [scanScopeSelection, setScanScopeSelection] = useState<ScanScopeSelection>({
    total: scanScopeCount,
    photo: 0,
    video: 0,
  });
  const activeScanTokenRef = useRef(0);
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
  const scanSummaryRef = useRef<Pick<ScanSummary, 'scannedAt' | 'scannedCount' | 'recycleBinCount'>>({
    scannedAt: 0,
    scannedCount: scanScopeCount,
    recycleBinCount: 0,
  });

  useEffect(() => {
    recycleBinIdsRef.current = recycleBinIds;
    scanSummaryRef.current = {
      ...scanSummaryRef.current,
      recycleBinCount: recycleBinIds.length,
    };
  }, [recycleBinIds]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      appStateRef.current = nextState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const entryCopy = useMemo(
    () =>
      buildPhotoGridEntryCopy(copy, {
        permissionState,
        scanScopeCount: scanScopeSelection.total,
        isScanning,
        hasCompletedScan,
        progressCurrent: scanProgress.current,
        progressTotal: scanProgress.total,
        currentFileName: scanProgress.currentFileName,
        resultCount: scanResultsCount,
      }),
    [
      copy,
      permissionState,
      scanScopeSelection.total,
      isScanning,
      hasCompletedScan,
      scanProgress.current,
      scanProgress.currentFileName,
      scanProgress.total,
      scanResultsCount,
    ],
  );
  const tabOptions = useMemo(
    () => (permissionState === 'granted' ? buildPhotoGridTabOptions(copy, scanScopeSelection) : filterOptions),
    [copy, filterOptions, permissionState, scanScopeSelection],
  );
  const isSelectionMode = selectedIds.length > 0;
  const displayedCandidates = useMemo(
    () => (hasCompletedScan ? candidates : isScanning ? streamingCandidates : authorizedCandidates),
    [authorizedCandidates, candidates, hasCompletedScan, isScanning, streamingCandidates],
  );
  const previewDuplicateCandidates = useMemo(
    () => getDuplicateGroupCandidates(previewSnapshotCandidates ?? [], previewCandidate),
    [previewCandidate, previewSnapshotCandidates],
  );

  const hydrateAuthorizedState = useCallback(async () => {
    const [page, cachedResult, falsePositiveIds, recycleBinCandidateCache] = await Promise.all([
      MediaLibrary.getAssetsAsync({
        first: scanScopeCount,
        mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
        sortBy: [[MediaLibrary.SortBy.creationTime, false]],
      }),
      loadPhotoScanResultCache(),
      loadFalsePositiveCandidateIds(),
      loadRecycleBinCandidateCache(),
    ]);
    falsePositiveIdsRef.current = falsePositiveIds;
    recycleBinCandidateCacheRef.current = recycleBinCandidateCache;

    const nextAuthorizedCandidates = page.assets
      .map((asset) => createAuthorizedMediaCandidate(asset))
      .filter((candidate): candidate is CleanupCandidate => Boolean(candidate));
    const nextSelection = buildScopeSelectionFromCandidates(nextAuthorizedCandidates);

    setScanScopeSelection(nextSelection);
    setAuthorizedCandidates(nextAuthorizedCandidates);
    setStreamingCandidates(nextAuthorizedCandidates);

    if (!cachedResult) {
      scanSummaryRef.current = {
        scannedAt: 0,
        scannedCount: nextSelection.total,
        recycleBinCount: 0,
      };
      setCandidates([]);
      setSelectedIds([]);
      setScanResultsCount(0);
      setIsScanning(false);
      setHasCompletedScan(false);
      setScanProgress({
        current: 0,
        total: nextSelection.total,
        currentFileName: null,
      });
      return;
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
  }, [scanScopeCount]);

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
            setIsScanning(false);
            setHasCompletedScan(false);
          }
        }
      }

      async function refreshPermissionState() {
        try {
          const permission = await MediaLibrary.getPermissionsAsync(false, ['photo', 'video']);

          if (!isActive) {
            return;
          }

          setPermissionState(permission.granted ? 'granted' : 'denied');
          if (permission.granted) {
            await refreshAuthorizedState();
          } else {
            setAuthorizedCandidates([]);
            setCandidates([]);
            setIsScanning(false);
            setHasCompletedScan(false);
          }
        } catch {
          if (isActive) {
            setPermissionState('denied');
            setAuthorizedCandidates([]);
            setCandidates([]);
            setStreamingCandidates([]);
            setIsScanning(false);
            setHasCompletedScan(false);
          }
        }
      }

      void refreshPermissionState();

      return () => {
        isActive = false;
      };
    }, [hydrateAuthorizedState]),
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
      ]);
    } catch (error) {
      console.error('Failed to clean selected candidates:', error);
      setErrorMessage(error instanceof Error ? error.message : copy.alerts.deleteFailedBody);
    }
  }, [candidates, copy.alerts.deleteFailedBody, persistCurrentScanCandidates, persistRecycleBinState, selectedIds]);

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
      await persistCurrentScanCandidates(nextCandidates, falsePositiveIds);
    } catch (error) {
      console.error('Failed to keep selected candidates:', error);
      setErrorMessage(error instanceof Error ? error.message : copy.alerts.deleteFailedBody);
    }
  }, [candidates, copy.alerts.deleteFailedBody, hasCompletedScan, persistCurrentScanCandidates, selectedIds]);

  const handleRequestPermission = useCallback(async () => {
    try {
      const permission = await MediaLibrary.requestPermissionsAsync(false, ['photo', 'video']);
      setPermissionState(permission.granted ? 'granted' : 'denied');

      if (permission.granted) {
        await hydrateAuthorizedState();
      }
    } catch {
      setPermissionState('denied');
      setAuthorizedCandidates([]);
      setCandidates([]);
      setStreamingCandidates([]);
      setScanScopeSelection({ total: 0, photo: 0, video: 0 });
      setIsScanning(false);
      setHasCompletedScan(false);
    }
  }, [hydrateAuthorizedState]);

  const handleStartScan = useCallback(async () => {
    const scanToken = activeScanTokenRef.current + 1;
    activeScanTokenRef.current = scanToken;
    const analyzedAssetIds = new Set<string>();
    const analyzedInputsById = new Map<string, AnalyzedMediaInput>();
    deferredPreviewScanStateRef.current = null;
    setErrorMessage(null);
    setIsScanning(true);
    setHasCompletedScan(false);
    setStreamingCandidates(authorizedCandidates);
    setScanScopeSelection(buildScopeSelectionFromCandidates(authorizedCandidates));
    resetScanProgress(authorizedCandidates.length);

    try {
      const [recycleBinIds, falsePositiveIds, recycleBinCandidateCache] = await Promise.all([
        recycleBinIdsRef.current.length > 0
          ? Promise.resolve(recycleBinIdsRef.current)
          : loadRecycleBinIds(),
        loadFalsePositiveCandidateIds(),
        loadRecycleBinCandidateCache(),
      ]);
      recycleBinIdsRef.current = recycleBinIds;
      falsePositiveIdsRef.current = falsePositiveIds;
      recycleBinCandidateCacheRef.current = recycleBinCandidateCache;
      const result = await scanMediaLibrary(recycleBinIds, {
        falsePositiveIds,
        recycleBinCandidateCache,
        onProgress: (progress) => {
          if (activeScanTokenRef.current !== scanToken) {
            return;
          }

          const nextScanProgress = {
            current: progress.current,
            total: progress.total,
            currentFileName: progress.currentFileName,
          };

          if (isPreviewOpenRef.current) {
            deferredPreviewScanStateRef.current = {
              ...deferredPreviewScanStateRef.current,
              scanProgress: nextScanProgress,
            };
          } else {
            setScanProgress(nextScanProgress);
          }

          if (progress.analyzedAssetId) {
            analyzedAssetIds.add(progress.analyzedAssetId);

            if (progress.analyzedInput) {
              analyzedInputsById.set(progress.analyzedAssetId, progress.analyzedInput);
            } else {
              analyzedInputsById.delete(progress.analyzedAssetId);
            }

            const nextVisibleCandidates = buildStreamingVisibleCandidates(
              authorizedCandidates,
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
      });

      if (activeScanTokenRef.current !== scanToken) {
        return;
      }

      scanSummaryRef.current = {
        scannedAt: result.summary.scannedAt,
        scannedCount: result.summary.scannedCount,
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
        current: result.summary.scannedCount,
        total: result.summary.scannedCount,
        currentFileName: null,
      });
      setIsScanning(false);
      setHasCompletedScan(true);

      try {
        await Promise.all([
          saveLastScanMeta({
            scannedAt: result.summary.scannedAt,
            scannedCount: result.summary.scannedCount,
            candidateCount: filteredCandidates.length,
          }),
          saveRecycleBinCandidateCache(result.state.recycleBin),
          savePhotoScanResultCache({
            activeCandidates: filteredCandidates,
            summary: buildFilteredSummary(scanSummaryRef.current, filteredCandidates),
          }),
        ]);
      } catch (persistError) {
        console.error('Failed to persist scan results:', persistError);
      }

      if (appStateRef.current !== 'active') {
        try {
          await notifyScanCompletionIfNeeded({
            language,
            scannedCount: result.summary.scannedCount,
            resultCount: filteredCandidates.length,
          });
        } catch (notificationError) {
          console.error('Failed to present scan completion notification:', notificationError);
        }
      }
    } catch (error) {
      if (activeScanTokenRef.current !== scanToken) {
        return;
      }

      setIsScanning(false);
      setHasCompletedScan(false);
      setStreamingCandidates(authorizedCandidates);
      setScanScopeSelection(buildScopeSelectionFromCandidates(authorizedCandidates));
      resetScanProgress(authorizedCandidates.length);
      setErrorMessage(error instanceof Error ? error.message : copy.alerts.scanFailed);
    }
  }, [authorizedCandidates, copy.alerts.scanFailed, language, resetScanProgress]);

  const handleCancelScan = useCallback(() => {
    activeScanTokenRef.current += 1;
    deferredPreviewScanStateRef.current = null;
    setIsScanning(false);
    setHasCompletedScan(false);
    setStreamingCandidates(authorizedCandidates);
    setScanScopeSelection(buildScopeSelectionFromCandidates(authorizedCandidates));
    resetScanProgress(authorizedCandidates.length);
  }, [authorizedCandidates, resetScanProgress]);

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
        ]);
      } catch (error) {
        console.error('Failed to clean preview candidate:', error);
        setErrorMessage(error instanceof Error ? error.message : copy.alerts.deleteFailedBody);
      }
    },
    [candidates, copy.alerts.deleteFailedBody, dismissPreview, displayedCandidates, hasCompletedScan, persistCurrentScanCandidates, persistRecycleBinState, previewCandidate, previewSnapshotCandidates],
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
        await persistCurrentScanCandidates(nextCandidates, falsePositiveIds);
      } catch (error) {
        console.error('Failed to keep preview candidate:', error);
        setErrorMessage(error instanceof Error ? error.message : copy.alerts.deleteFailedBody);
      }
    },
    [candidates, copy.alerts.deleteFailedBody, dismissPreview, displayedCandidates, hasCompletedScan, persistCurrentScanCandidates, previewCandidate, previewSnapshotCandidates],
  );

  const showPermissionPrompt = permissionState === 'denied';
  const showLoadingPrompt = permissionState === 'loading';
  const showScanPrompt = permissionState === 'granted';
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
                {entryCopy.body ? <Text style={styles.entryBody}>{entryCopy.body}</Text> : null}
              </View>
              <Pressable
                style={[styles.inlineButton, isScanning && styles.buttonDisabled]}
                onPress={() => void handleStartScan()}
                disabled={isScanning}
              >
                <Text style={styles.inlineButtonText}>{entryCopy.action}</Text>
              </Pressable>
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
          </View>

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
                pointerEvents="auto"
                style={styles.gridLoadingOverlay}
                testID="photo-grid-loading-overlay"
              />
            ) : null}
          </View>
          {isSelectionMode && (
            <View style={styles.actionBar}>
              <View style={styles.selectionActionsRow}>
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
