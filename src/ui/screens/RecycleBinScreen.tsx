import * as MediaLibrary from 'expo-media-library';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, BackHandler, View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import { PhotoGrid } from '../components/PhotoGrid';
import type { SwipeSelectionReason } from '../hooks/useSwipeSelection';
import { DetailScreen } from './DetailScreen';
import { TouchSurface } from '../components/TouchSurface';
import { AppIcon } from '../icons/AppIcon';
import { DesignIcon } from '../icons/DesignIcon';
import { useAppPreferences } from '../../application/AppPreferencesContext';
import type { CleanupCandidate } from '../../domain/recognition/types';
import type { CleanupState } from '../../features/cleanup/cleanup-state';
import { createInitialCleanupState, applyCleanupAction } from '../../features/cleanup/cleanup-state';
import { formatLocalizedSize } from '../../i18n/app-copy';
import type { AppThemePalette } from '../../theme/app-theme';
import { scanMediaLibrary } from '../../features/scan/scan-media-library';
import { buildDefaultScanWindowStartAt } from '../../features/scan/scan-config';
import {
  loadCleanupReportSnapshot,
  loadRecycleBinSnapshotCache,
  loadRecycleBinIds,
  saveRecycleBinIds,
  saveRecycleBinSnapshotCache,
  syncPersistedMediaLedger,
  type CleanupReportSnapshot,
} from '../../services/storage/app-storage';
import {
  buildBottomActionLayout,
  buildMediaGridLayout,
  buildPhotoGridContentPadding,
  buildRecycleBinHeaderInsets,
  buildRecycleBinTexts,
  RECYCLE_BIN_DESIGN_CONTENT_WIDTH,
} from './screen-layout';
import { ensureMediaLibraryDeletePermissionsAsync } from '../../services/media-library-permissions';
import {
  buildSelectionHeaderTitle,
  buildSelectionToggleLabel,
} from './photo-grid/selection-mode-labels';

function normalizeIds(ids: string[]) {
  return Array.from(new Set(ids)).sort();
}

function areSameIds(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function buildHydratedRecycleBinState(activeCandidates: CleanupCandidate[], recycleBin: CleanupCandidate[]) {
  const hydratedState = applyCleanupAction(createInitialCleanupState([]), {
    type: 'hydrate',
    activeCandidates,
    recycleBin,
  });

  return {
    ...hydratedState,
    selectedIds: [],
  };
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

function buildNextDetailCandidate(
  recycleBinCandidates: CleanupCandidate[],
  seedCandidate: CleanupCandidate | null,
  targetIds: readonly string[],
  activeId: string,
) {
  if (!seedCandidate) {
    return null;
  }

  const targetIdSet = new Set(targetIds);
  const scopedCandidates = getDuplicateGroupCandidates(recycleBinCandidates, seedCandidate);
  const detailCandidates = scopedCandidates.length > 0 ? scopedCandidates : [seedCandidate];
  const currentIndex = Math.max(
    0,
    detailCandidates.findIndex((candidate) => candidate.id === activeId),
  );
  const remainingDetailCandidates = detailCandidates.filter((candidate) => !targetIdSet.has(candidate.id));

  if (remainingDetailCandidates.length === 0) {
    return null;
  }

  return remainingDetailCandidates[Math.min(currentIndex, remainingDetailCandidates.length - 1)] ?? null;
}

function filterRecycleBinCandidateCache(
  candidates: readonly CleanupCandidate[],
  recycleBinIds: readonly string[],
) {
  const recycleBinIdSet = new Set(recycleBinIds);
  return candidates.filter((candidate) => recycleBinIdSet.has(candidate.id));
}

function mergeHydratedRecycleBinCandidates(
  recycleBinIds: readonly string[],
  cachedCandidates: readonly CleanupCandidate[],
  hydratedCandidates: readonly CleanupCandidate[],
) {
  const merged = new Map<string, CleanupCandidate>();

  for (const candidate of cachedCandidates) {
    merged.set(candidate.id, candidate);
  }

  for (const candidate of hydratedCandidates) {
    merged.set(candidate.id, candidate);
  }

  return recycleBinIds
    .map((id) => merged.get(id))
    .filter((candidate): candidate is CleanupCandidate => Boolean(candidate));
}

function sumCandidateBytes(candidates: readonly CleanupCandidate[]) {
  return candidates.reduce((total, candidate) => total + (candidate.asset.fileSize ?? 0), 0);
}

const EMPTY_CLEANUP_REPORT: CleanupReportSnapshot = {
  cleanedItemCount: 0,
  cleanedBytes: 0,
  lastCleanedAt: null,
};

type RecycleBinScreenProps = {
  recycleBinIds?: string[];
  onRecycleBinIdsChange?: (ids: string[]) => void;
  onBackToPhotos?: () => void;
};

export function RecycleBinScreen({
  recycleBinIds,
  onRecycleBinIdsChange,
  onBackToPhotos,
}: RecycleBinScreenProps = {}) {
  const { copy, theme, language } = useAppPreferences();
  const insets = useSafeAreaInsets();
  const dimensions = useWindowDimensions();
  const gridLayout = useMemo(
    () => buildMediaGridLayout(insets, dimensions),
    [dimensions, insets],
  );
  const actionLayout = useMemo(
    () =>
      buildBottomActionLayout(insets, dimensions, {
        maxContentWidth: gridLayout.isSELike ? RECYCLE_BIN_DESIGN_CONTENT_WIDTH : 560,
      }),
    [dimensions, gridLayout.isSELike, insets],
  );
  const styles = useMemo(
    () => createStyles(theme, insets, actionLayout),
    [actionLayout, insets, theme],
  );
  const baseContentPadding = useMemo(() => buildPhotoGridContentPadding(insets), [insets]);
  const recycleBinTexts = useMemo(() => buildRecycleBinTexts(copy), [copy]);
  const recycleBinCopy = copy.screens.recycleBin;
  const loadingLabel = recycleBinCopy.loading;

  const [state, setState] = useState<CleanupState>(createInitialCleanupState([]));
  const [previewCandidate, setPreviewCandidate] = useState<CleanupCandidate | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isHydrating, setIsHydrating] = useState(true);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [isSelectionModeActive, setIsSelectionModeActive] = useState(false);
  const [cleanupReport, setCleanupReport] =
    useState<CleanupReportSnapshot>(EMPTY_CLEANUP_REPORT);
  const [persistedRecycleBinCount, setPersistedRecycleBinCount] = useState(
    recycleBinIds?.length ?? 0,
  );
  const hasRecycleBinItems = state.recycleBin.length > 0;
  const visibleRecycleBinCount = Math.max(state.recycleBin.length, persistedRecycleBinCount);
  const selectionCount = state.selectedIds.length;
  const isSelectionMode = hasRecycleBinItems && isSelectionModeActive;
  const contentPadding = useMemo(
    () => ({
      ...baseContentPadding,
      bottom: baseContentPadding.bottom + (isSelectionMode ? 150 : 36),
    }),
    [baseContentPadding, isSelectionMode],
  );
  const isAllRecycleBinSelected =
    state.recycleBin.length > 0 &&
    state.recycleBin.every((candidate) => state.selectedIds.includes(candidate.id));
  const previewDuplicateCandidates = useMemo(
    () => getDuplicateGroupCandidates(state.recycleBin, previewCandidate),
    [previewCandidate, state.recycleBin],
  );
  const pendingCandidates = state.recycleBin;
  const pendingBytes = useMemo(() => sumCandidateBytes(pendingCandidates), [pendingCandidates]);
  const cleanupHistorySizeText =
    cleanupReport.cleanedBytes > 0
      ? formatLocalizedSize(cleanupReport.cleanedBytes, language)
      : '0 KB';
  const cleanupHistoryPrefix = `${recycleBinCopy.cleanupHistoryTitle}${
    language === 'zh-CN' ? '： ' : ': '
  }${recycleBinCopy.cleanupHistoryReleased('')}`;
  const summaryTitle = recycleBinCopy.pendingSummary(visibleRecycleBinCount);
  const isCompact = gridLayout.isSELike;
  const summaryIconSize = gridLayout.isSELike ? 26 : 34;
  const headerTitle = isSelectionMode
    ? buildSelectionHeaderTitle(language, selectionCount)
    : recycleBinTexts.title;
  const selectionToggleLabel = buildSelectionToggleLabel(language, isAllRecycleBinSelected);
  const shouldShowCleanupHistoryLine = hasHydrated && visibleRecycleBinCount === 0;

  useEffect(() => {
    if (!hasRecycleBinItems && isSelectionModeActive) {
      setIsSelectionModeActive(false);
    }
  }, [hasRecycleBinItems, isSelectionModeActive]);

  useEffect(() => {
    setPersistedRecycleBinCount(recycleBinIds?.length ?? 0);
  }, [recycleBinIds]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function hydrateRecycleBin() {
        setIsHydrating(true);
        setErrorMessage(null);
        setIsSelectionModeActive(false);

        try {
          const recycleBinSnapshotPromise = loadRecycleBinSnapshotCache();
          const recycleBinSourceIdsPromise =
            recycleBinIds && recycleBinIds.length > 0
              ? Promise.resolve(recycleBinIds)
              : loadRecycleBinIds();
          const cleanupReportPromise = loadCleanupReportSnapshot();
          const [recycleBinSnapshot, nextCleanupReport] = await Promise.all([
            recycleBinSnapshotPromise,
            cleanupReportPromise,
          ]);
          const cachedRecycleBin = recycleBinSnapshot?.candidates ?? [];

          if (!isActive) {
            return;
          }

          setCleanupReport(nextCleanupReport);

          if (cachedRecycleBin.length > 0) {
            setState(buildHydratedRecycleBinState([], cachedRecycleBin));
            setPreviewCandidate((current) =>
              current && cachedRecycleBin.some((candidate) => candidate.id === current.id)
                ? current
                : null,
            );
            setIsHydrating(false);
            setHasHydrated(true);
          }

          const recycleBinSourceIds = await recycleBinSourceIdsPromise;
          const persistedRecycleBinIds = normalizeIds(recycleBinSourceIds);
          setPersistedRecycleBinCount(persistedRecycleBinIds.length);
          const cachedRecycleBinForRefresh = filterRecycleBinCandidateCache(
            cachedRecycleBin,
            persistedRecycleBinIds,
          );

          if (persistedRecycleBinIds.length === 0) {
            setState(buildHydratedRecycleBinState([], []));
            setPreviewCandidate(null);
            await saveRecycleBinSnapshotCache({
              ids: [],
              candidates: [],
              updatedAt: Date.now(),
              source: 'hydrated',
            });
            return;
          }

          const result = await scanMediaLibrary(persistedRecycleBinIds, {
            createdAfter: buildDefaultScanWindowStartAt(),
            recycleBinCandidateCache: cachedRecycleBinForRefresh,
          });

          if (!isActive) {
            return;
          }

          const nextState = buildHydratedRecycleBinState(
            result.state.activeCandidates,
            mergeHydratedRecycleBinCandidates(
              persistedRecycleBinIds,
              cachedRecycleBinForRefresh,
              result.state.recycleBin,
            ),
          );
          const hydratedRecycleBinIds = normalizeIds(nextState.recycleBin.map((candidate) => candidate.id));

          setState(nextState);
          setPreviewCandidate((current) =>
            current && hydratedRecycleBinIds.includes(current.id) ? current : null,
          );

          await saveRecycleBinSnapshotCache({
            ids: hydratedRecycleBinIds,
            candidates: nextState.recycleBin,
            updatedAt: result.summary.scannedAt,
            source: 'hydrated',
          });
          const currentNavigatorRecycleBinIds = normalizeIds(recycleBinIds ?? []);
          if (!areSameIds(currentNavigatorRecycleBinIds, persistedRecycleBinIds)) {
            onRecycleBinIdsChange?.(persistedRecycleBinIds);
          }
        } catch (error) {
          if (!isActive) {
            return;
          }

          console.error('Failed to hydrate recycle bin:', error);
          setErrorMessage(error instanceof Error ? error.message : copy.alerts.scanFailed);
        } finally {
          if (isActive) {
            setIsHydrating(false);
            setHasHydrated(true);
          }
        }
      }

      void hydrateRecycleBin();

      return () => {
        isActive = false;
      };
    }, [copy.alerts.scanFailed, onRecycleBinIdsChange, recycleBinIds])
  );

  const exitSelectionMode = useCallback(() => {
    setIsSelectionModeActive(false);
    setState((prev) => ({
      ...prev,
      selectedIds: [],
    }));
  }, []);

  const handleSelect = useCallback((id: string) => {
    setIsSelectionModeActive(true);
    setState(prev => applyCleanupAction(prev, { type: 'toggle-select', id }));
  }, []);

  const handleSelectionChange = useCallback((nextIds: string[], _reason: SwipeSelectionReason) => {
    setIsSelectionModeActive(true);
    setState((prev) => {
      const recycleBinIdSet = new Set(prev.recycleBin.map((candidate) => candidate.id));

      return {
        ...prev,
        selectedIds: nextIds.filter((id) => recycleBinIdSet.has(id)),
      };
    });
  }, []);

  const handleItemPress = useCallback((candidate: CleanupCandidate) => {
    if (isSelectionMode) {
      handleSelect(candidate.id);
      return;
    }

    setPreviewCandidate(candidate);
  }, [handleSelect, isSelectionMode]);

  const handleToggleSelectAll = useCallback(() => {
    setIsSelectionModeActive(true);
    setState((prev) => ({
      ...prev,
      selectedIds: isAllRecycleBinSelected ? [] : prev.recycleBin.map((candidate) => candidate.id),
    }));
  }, [isAllRecycleBinSelected]);

  const persistRecycleBinState = useCallback(
    async (
      nextState: CleanupState,
      options?: {
        restoredIds?: readonly string[];
        deletedIds?: readonly string[];
      },
    ) => {
      const nextRecycleBinIds = normalizeIds(nextState.recycleBin.map((candidate) => candidate.id));
      setPersistedRecycleBinCount(nextRecycleBinIds.length);
      await Promise.all([
        saveRecycleBinIds(nextRecycleBinIds),
        saveRecycleBinSnapshotCache({
          ids: nextRecycleBinIds,
          candidates: nextState.recycleBin,
          updatedAt: Date.now(),
          source: 'manual',
        }),
        syncPersistedMediaLedger({
          activeCandidates: nextState.activeCandidates,
          recycleBinCandidates: nextState.recycleBin,
          restoredIds: options?.restoredIds,
          deletedIds: options?.deletedIds,
        }),
      ]);

      onRecycleBinIdsChange?.(nextRecycleBinIds);
    },
    [onRecycleBinIdsChange],
  );

  const handleRestore = useCallback(async (ids = state.selectedIds) => {
    if (ids.length === 0) {
      return;
    }

    try {
      const nextState = applyCleanupAction(state, { type: 'restore', ids });
      await persistRecycleBinState(nextState, {
        restoredIds: ids,
      });

      setState(nextState);
      setPreviewCandidate((current) =>
        buildNextDetailCandidate(state.recycleBin, current, ids, ids[0] ?? current?.id ?? ''),
      );
    } catch (error) {
      console.error('Failed to restore recycle bin items:', error);
      setErrorMessage(error instanceof Error ? error.message : copy.alerts.deleteFailedBody);
    }
  }, [copy.alerts.deleteFailedBody, persistRecycleBinState, state]);

  const performDelete = useCallback(async (ids = state.selectedIds) => {
    if (ids.length === 0) {
      return;
    }

    try {
      const deletePermission = await ensureMediaLibraryDeletePermissionsAsync();
      if (!deletePermission.granted) {
        throw new Error(copy.alerts.deleteFailedBody);
      }

      await MediaLibrary.deleteAssetsAsync(ids);

      const nextState = applyCleanupAction(state, { type: 'hard-delete', ids });
      await persistRecycleBinState(nextState, {
        deletedIds: ids,
      });

      const nextCleanupReport = await loadCleanupReportSnapshot();
      setState(nextState);
      setCleanupReport(nextCleanupReport);
      setPreviewCandidate((current) =>
        buildNextDetailCandidate(state.recycleBin, current, ids, ids[0] ?? current?.id ?? ''),
      );
    } catch (error) {
      console.error('Failed to delete recycle bin items:', error);
      setErrorMessage(error instanceof Error ? error.message : copy.alerts.deleteFailedBody);
    }
  }, [copy.alerts.deleteFailedBody, persistRecycleBinState, state]);

  const requestDeleteConfirmation = useCallback(
    (ids = state.selectedIds, source: 'selection' | 'detail' = 'selection') => {
      if (ids.length === 0) {
        return;
      }

      Alert.alert(
        source === 'detail' ? copy.alerts.previewDeleteTitle : copy.alerts.confirmAgainTitle,
        source === 'detail' ? copy.alerts.previewDeleteBody : copy.alerts.confirmAgainBody,
        [
          { text: copy.common.cancel, style: 'cancel' },
          {
            text: copy.common.deleteConfirm,
            style: 'destructive',
            onPress: () => {
              void performDelete(ids);
            },
          },
        ],
      );
    },
    [
      copy.alerts.confirmAgainBody,
      copy.alerts.confirmAgainTitle,
      copy.alerts.previewDeleteBody,
      copy.alerts.previewDeleteTitle,
      copy.common.cancel,
      copy.common.deleteConfirm,
      performDelete,
      state.selectedIds,
    ],
  );

  const handleClosePreview = useCallback(() => {
    setPreviewCandidate(null);
  }, []);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        if (previewCandidate) {
          handleClosePreview();
          return true;
        }

        if (isSelectionMode) {
          exitSelectionMode();
          return true;
        }

        if (onBackToPhotos) {
          onBackToPhotos();
          return true;
        }

        return false;
      });

      return () => {
        subscription.remove();
      };
    }, [
      exitSelectionMode,
      handleClosePreview,
      isSelectionMode,
      onBackToPhotos,
      previewCandidate,
    ]),
  );

  const DetailScreenCompat = DetailScreen as unknown as React.ComponentType<
    React.ComponentProps<typeof DetailScreen> & {
      onPrimaryAction?: (ids?: string[]) => void | Promise<void>;
      onHardDelete?: (ids?: string[]) => void | Promise<void>;
    }
  >;

  if (previewCandidate) {
    return (
      <DetailScreenCompat
        candidate={previewCandidate}
        duplicateCandidates={previewDuplicateCandidates}
        language={language}
        theme={theme}
        mode="recycle"
        onClose={handleClosePreview}
        onPrimaryAction={(ids) => void handleRestore(ids)}
        onHardDelete={(ids) => requestDeleteConfirmation(ids, 'detail')}
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeading}>
            <TouchSurface
              style={styles.backButton}
              pressedStyle={styles.backButtonPressed}
              onPress={() => {
                if (isSelectionMode) {
                  exitSelectionMode();
                  return;
                }

                onBackToPhotos?.();
              }}
              preset="pill"
              testID="recycle-back-button"
            >
              <AppIcon
                name={isSelectionMode ? 'close' : 'arrow-back'}
                size={24}
                color={theme.pageTextPrimary}
              />
            </TouchSurface>

            <View style={styles.headerCopy}>
              <Text
                style={styles.headerTitle}
                testID="recycle-bin-header-title"
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.86}
              >
                {headerTitle}
              </Text>
            </View>
          </View>
          {hasRecycleBinItems && isSelectionMode ? (
            <TouchSurface
              style={[styles.selectionToggleButton, styles.selectionToggleButtonTop]}
              pressedStyle={styles.selectionToggleButtonPressed}
              onPress={handleToggleSelectAll}
              preset="pill"
              testID="recycle-selection-toggle-button"
            >
              <Text style={[styles.selectionActionText, styles.selectionToggleText]}>
                {selectionToggleLabel}
              </Text>
            </TouchSurface>
          ) : null}
        </View>
      </View>

      {errorMessage ? (
        <View style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>{copy.common.statusTitle}</Text>
          <Text style={styles.noticeText}>{errorMessage}</Text>
        </View>
      ) : null}

      {hasRecycleBinItems ? (
        <View style={styles.summaryCard} testID="cleanup-report-card">
          <View style={styles.summaryMetricRow}>
            <View style={styles.summaryLeadingIconShell}>
              <DesignIcon
                name="nav-trash"
                width={summaryIconSize}
                height={summaryIconSize}
                color="#ff3138"
              />
            </View>
            <View style={styles.summaryPrimaryMetric}>
              <Text style={styles.summaryTitle} testID="recycle-bin-summary-title">
                {summaryTitle}
              </Text>
            </View>
            <View style={styles.summaryMetricDivider} />
            <View style={styles.summarySizeMetric}>
              <Text style={styles.pendingMetricLabel}>{recycleBinCopy.releasableSizeLabel}</Text>
              <Text style={styles.summarySizeValue} testID="recycle-pending-bytes">
                {formatLocalizedSize(pendingBytes, language)}
              </Text>
            </View>
          </View>
          <View pointerEvents="none" style={styles.summaryBottomShadow} />
        </View>
      ) : null}

      {hasRecycleBinItems ? (
        <PhotoGrid
          candidates={state.recycleBin}
          selectedIds={state.selectedIds}
          selectionMode={isSelectionMode}
          onSelect={handleSelect}
          onSelectionChange={handleSelectionChange}
          onItemPress={handleItemPress}
          theme={theme}
          mediaType="all"
          gridTestID="recycle-bin-grid"
          itemTestID="recycle-bin-item"
          contentPadding={contentPadding}
          gridLayout={gridLayout}
        />
      ) : !hasHydrated && isHydrating ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText} testID="recycle-bin-loading-label">
            {loadingLabel}
          </Text>
        </View>
      ) : (
        <View style={styles.emptyContainer} testID="recycle-bin-empty-state">
          <View style={styles.emptyIconWrap}>
            <DesignIcon name="nav-trash" width={42} height={42} color={theme.pageTextMuted} />
          </View>
          {shouldShowCleanupHistoryLine ? (
            <Text
              style={styles.cleanupHistoryInline}
              testID="recycle-cleanup-history-released"
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.82}
            >
              <Text>{cleanupHistoryPrefix}</Text>
              <Text style={styles.cleanupHistoryValue}>{cleanupHistorySizeText}</Text>
            </Text>
          ) : null}
          <Text style={styles.emptyTitle} testID="recycle-bin-empty-title">
            {recycleBinTexts.emptyTitle}
          </Text>
          <Text style={styles.emptyBody}>{recycleBinTexts.emptyBody}</Text>
        </View>
      )}

      {hasRecycleBinItems && isSelectionMode ? (
        <View style={styles.actionBar}>
          <View style={styles.selectionActionsRow}>
            <TouchSurface
              style={[styles.selectionActionButton, styles.selectionRestoreButton]}
              pressedStyle={styles.selectionRestoreButtonPressed}
              onPress={() => void handleRestore()}
              preset="pill"
              hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
              testID="recycle-restore-selected-button"
            >
              <Text style={[styles.selectionActionText, styles.selectionRestoreText]}>
                {recycleBinCopy.keepAction}
              </Text>
            </TouchSurface>
            <TouchSurface
              style={[styles.selectionActionButton, styles.selectionDeleteButton]}
              pressedStyle={styles.selectionDeleteButtonPressed}
              onPress={() => requestDeleteConfirmation()}
              preset="pill"
              hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
              testID="recycle-delete-selected-button"
            >
              <Text style={styles.selectionActionText}>{recycleBinCopy.cleanupAction}</Text>
            </TouchSurface>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function createStyles(
  theme: AppThemePalette,
  insets: { top: number; bottom: number; left: number; right: number },
  actionLayout: {
    bottom: number;
    left: number;
    right: number;
    isSELike?: boolean;
  } = {
    bottom: Math.max(insets.bottom, 8),
    left: 16 + insets.left,
    right: 16 + insets.right,
    isSELike: true,
  },
) {
  const isCompact = actionLayout.isSELike ?? true;
  const headerInsets = buildRecycleBinHeaderInsets(insets);
  const headerTopPadding = isCompact ? insets.top + 4 : headerInsets.top;
  const headerBottomPadding = isCompact ? 0 : 10;

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.safeArea,
    },
    header: {
      paddingHorizontal: isCompact ? 20 : 24,
      paddingTop: headerTopPadding,
      paddingBottom: headerBottomPadding,
      marginLeft: headerInsets.left,
      marginRight: headerInsets.right,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    headerLeading: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    backButton: {
      width: isCompact ? 36 : 40,
      height: isCompact ? 36 : 40,
      borderRadius: isCompact ? 18 : 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    },
    backButtonPressed: {
      backgroundColor: theme.cardMutedBackground,
    },
    headerCopy: {
      flex: 1,
    },
    headerTitle: {
      fontSize: isCompact ? 18 : 26,
      lineHeight: isCompact ? 23 : 34,
      fontWeight: '800',
      color: theme.pageTextPrimary,
    },
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
      paddingBottom: isCompact ? 58 : 72,
    },
    emptyIconWrap: {
      width: 84,
      height: 84,
      borderRadius: 42,
      marginBottom: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.cardMutedBackground,
      borderWidth: 1,
      borderColor: theme.cardMutedBorder,
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: theme.pageTextSecondary,
      marginBottom: 8,
    },
    emptyBody: {
      fontSize: 14,
      color: theme.pageTextMuted,
      textAlign: 'center',
      lineHeight: 20,
    },
    cleanupHistoryInline: {
      marginTop: -4,
      marginBottom: 14,
      color: theme.pageTextMuted,
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '600',
      textAlign: 'center',
    },
    cleanupHistoryValue: {
      color: theme.buttonSuccessBackground,
      fontSize: 16,
      lineHeight: 22,
      fontWeight: '800',
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
    },
    loadingText: {
      fontSize: 14,
      color: theme.pageTextSecondary,
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
    summaryCard: {
      marginTop: isCompact ? 2 : 22,
      marginLeft: isCompact ? actionLayout.left : 24 + insets.left,
      marginRight: isCompact ? actionLayout.right : 24 + insets.right,
      paddingHorizontal: isCompact ? 16 : 20,
      paddingVertical: isCompact ? 12 : 18,
      position: 'relative',
      backgroundColor: 'transparent',
      borderWidth: 0,
      borderBottomWidth: 0,
      shadowColor: 'transparent',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
    summaryBottomShadow: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: -1,
      height: 1,
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
      backgroundColor:
        theme.scheme === 'dark'
          ? 'rgba(248, 250, 252, 0.16)'
          : 'rgba(255, 255, 255, 0.92)',
      boxShadow: [
        {
          offsetX: 0,
          offsetY: 1,
          blurRadius: 0,
          spreadDistance: 0,
          color:
            theme.scheme === 'dark'
              ? 'rgba(248, 250, 252, 0.16)'
              : 'rgba(255, 255, 255, 0.92)',
        },
      ],
    },
    summaryMetricRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: isCompact ? 10 : 14,
    },
    summaryLeadingIconShell: {
      width: isCompact ? 30 : 42,
      height: isCompact ? 42 : 52,
      borderRadius: 0,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    },
    summaryPrimaryMetric: {
      flex: 1,
      minWidth: 0,
    },
    summaryTitle: {
      color: theme.pageTextPrimary,
      fontSize: isCompact ? 18 : 24,
      lineHeight: isCompact ? 24 : 31,
      fontWeight: '800',
    },
    summaryMetricDivider: {
      width: 1,
      alignSelf: 'stretch',
      backgroundColor: theme.cardBorder,
    },
    summarySizeMetric: {
      minWidth: isCompact ? 112 : 146,
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'flex-end',
      gap: isCompact ? 7 : 9,
    },
    pendingMetricLabel: {
      color: theme.pageTextMuted,
      fontSize: isCompact ? 16 : 18,
      lineHeight: isCompact ? 22 : 25,
      fontWeight: '700',
    },
    summarySizeValue: {
      color: theme.buttonSuccessBackground,
      fontSize: isCompact ? 18 : 24,
      lineHeight: isCompact ? 24 : 31,
      fontWeight: '800',
    },
    actionBar: {
      position: 'absolute',
      bottom: 0,
      left: actionLayout.left,
      right: actionLayout.right,
      paddingTop: 6,
      paddingBottom: actionLayout.bottom,
      backgroundColor: 'transparent',
    },
    actionBarTitle: {
      marginBottom: 10,
      paddingHorizontal: 4,
      color: theme.pageTextSecondary,
      fontSize: 12,
      fontWeight: '700',
      textAlign: 'center',
    },
    selectionToggleButton: {
      minHeight: isCompact ? 30 : 40,
      minWidth: 0,
      paddingHorizontal: isCompact ? 6 : 8,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    },
    selectionToggleButtonTop: {
      alignSelf: 'flex-start',
    },
    selectionToggleButtonPressed: {
      backgroundColor: theme.cardMutedBackground,
    },
    selectionToggleText: {
      color: theme.buttonPrimaryBackground,
      fontSize: isCompact ? 12 : 16,
    },
    selectionActionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: isCompact ? 12 : 14,
    },
    selectionActionButton: {
      flex: 1,
      minHeight: isCompact ? 48 : 58,
      borderRadius: isCompact ? 14 : 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 0,
      shadowColor: theme.shadowColor,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
    selectionRestoreButton: {
      backgroundColor: theme.cardBackground,
      borderWidth: 1.5,
      borderColor: theme.buttonPrimaryBackground,
    },
    selectionRestoreButtonPressed: {
      backgroundColor: theme.cardMutedBackground,
    },
    selectionDeleteButton: {
      backgroundColor: theme.buttonDangerBackground,
    },
    selectionDeleteButtonPressed: {
      backgroundColor: theme.buttonDangerPressedBackground,
    },
    selectionActionText: {
      color: '#ffffff',
      fontSize: isCompact ? 16 : 18,
      fontWeight: '800',
      letterSpacing: 0.2,
    },
    selectionRestoreText: {
      color: theme.buttonPrimaryBackground,
    },
  });
}
