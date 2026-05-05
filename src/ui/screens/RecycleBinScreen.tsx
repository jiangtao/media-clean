import * as MediaLibrary from 'expo-media-library';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import { PhotoGrid } from '../components/PhotoGrid';
import { DetailScreen } from './DetailScreen';
import { TouchSurface } from '../components/TouchSurface';
import { useAppPreferences } from '../../application/AppPreferencesContext';
import type { CleanupCandidate } from '../../domain/recognition/types';
import type { CleanupState } from '../../features/cleanup/cleanup-state';
import { createInitialCleanupState, applyCleanupAction } from '../../features/cleanup/cleanup-state';
import { formatLocalizedSize } from '../../i18n/app-copy';
import type { AppLanguage } from '../../i18n/app-language';
import type { AppThemePalette } from '../../theme/app-theme';
import { scanMediaLibrary } from '../../features/scan/scan-media-library';
import { buildDefaultScanWindowStartAt } from '../../features/scan/scan-config';
import {
  loadRecycleBinSnapshotCache,
  loadCleanupReportSnapshot,
  loadRecycleBinIds,
  saveRecycleBinIds,
  saveRecycleBinSnapshotCache,
  syncPersistedMediaLedger,
  type CleanupReportSnapshot,
} from '../../services/storage/app-storage';
import {
  buildPhotoGridContentPadding,
  buildFloatingActionBarInsets,
  buildRecycleBinHeaderInsets,
  buildRecycleBinTexts,
} from './screen-layout';
import { ensureMediaLibraryDeletePermissionsAsync } from '../../services/media-library-permissions';

const EXPIRATION_DAYS = 30;

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
  return applyCleanupAction(createInitialCleanupState([]), {
    type: 'hydrate',
    activeCandidates,
    recycleBin,
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

function buildSelectionToggleLabel(language: string, isAllSelected: boolean) {
  if (language === 'en-US') {
    return isAllSelected ? 'Deselect All' : 'Select All';
  }

  return isAllSelected ? '取消全选' : '全选';
}

const ZERO_CLEANUP_REPORT: CleanupReportSnapshot = {
  cleanedItemCount: 0,
  cleanedBytes: 0,
  lastCleanedAt: null,
};

function buildCleanupReportCopy(language: string) {
  if (language === 'en-US') {
    return {
      title: 'Cleanup report',
      itemCountLabel: 'Cleaned items',
      sizeLabel: 'Cleaned size',
      lastCleanedLabel: 'Last cleaned',
      emptyLabel: 'No cleanup yet',
    };
  }

  return {
    title: '累计清理报告',
    itemCountLabel: '累计清理条目',
    sizeLabel: '累计清理体积',
    lastCleanedLabel: '最近清理',
    emptyLabel: '暂无清理记录',
  };
}

function formatCleanupReportTime(timestamp: number, language: string) {
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, '0');
  return language === 'en-US'
    ? `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
    : `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

type RecycleBinScreenProps = {
  recycleBinIds?: string[];
  onRecycleBinIdsChange?: (ids: string[]) => void;
};

export function RecycleBinScreen({
  recycleBinIds,
  onRecycleBinIdsChange,
}: RecycleBinScreenProps = {}) {
  const { copy, theme, language } = useAppPreferences();
  const appLanguage: AppLanguage = language === 'en-US' ? 'en-US' : 'zh-CN';
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme, insets), [insets, theme]);
  const baseContentPadding = useMemo(() => buildPhotoGridContentPadding(insets), [insets]);
  const contentPadding = useMemo(
    () => ({
      ...baseContentPadding,
      bottom: baseContentPadding.bottom + 180,
    }),
    [baseContentPadding],
  );
  const recycleBinTexts = useMemo(() => buildRecycleBinTexts(copy, EXPIRATION_DAYS), [copy]);
  const cleanupReportCopy = useMemo(() => buildCleanupReportCopy(appLanguage), [appLanguage]);
  const loadingLabel = appLanguage === 'zh-CN' ? '加载保留和清理…' : 'Loading keep and clean…';

  const [state, setState] = useState<CleanupState>(createInitialCleanupState([]));
  const [previewCandidate, setPreviewCandidate] = useState<CleanupCandidate | null>(null);
  const [cleanupReport, setCleanupReport] = useState<CleanupReportSnapshot>(ZERO_CLEANUP_REPORT);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isHydrating, setIsHydrating] = useState(true);
  const [hasHydrated, setHasHydrated] = useState(false);
  const isSelectionMode = state.selectedIds.length > 0;
  const isAllRecycleBinSelected =
    state.recycleBin.length > 0 &&
    state.recycleBin.every((candidate) => state.selectedIds.includes(candidate.id));
  const cleanupReportBottom = isSelectionMode
    ? buildFloatingActionBarInsets(insets).bottom
    : 16 + insets.bottom;
  const previewDuplicateCandidates = useMemo(
    () => getDuplicateGroupCandidates(state.recycleBin, previewCandidate),
    [previewCandidate, state.recycleBin],
  );

  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function hydrateRecycleBin() {
        setIsHydrating(true);
        setErrorMessage(null);

        try {
          const cleanupReportPromise = loadCleanupReportSnapshot().catch(() => ZERO_CLEANUP_REPORT);
          const recycleBinSnapshotPromise = loadRecycleBinSnapshotCache();
          const recycleBinSourceIdsPromise =
            recycleBinIds && recycleBinIds.length > 0
              ? Promise.resolve(recycleBinIds)
              : loadRecycleBinIds();
          const [cleanupReportSnapshot, recycleBinSnapshot] = await Promise.all([
            cleanupReportPromise,
            recycleBinSnapshotPromise,
          ]);
          const cachedRecycleBin = recycleBinSnapshot?.candidates ?? [];

          if (!isActive) {
            return;
          }

          setCleanupReport(cleanupReportSnapshot);

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
            result.state.recycleBin,
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

          if (!areSameIds(persistedRecycleBinIds, hydratedRecycleBinIds)) {
            await saveRecycleBinIds(hydratedRecycleBinIds);
            onRecycleBinIdsChange?.(hydratedRecycleBinIds);
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

  const handleSelect = useCallback((id: string) => {
    setState(prev => applyCleanupAction(prev, { type: 'toggle-select', id }));
  }, []);

  const handleItemPress = useCallback((candidate: CleanupCandidate) => {
    if (isSelectionMode) {
      setState((prev) => applyCleanupAction(prev, { type: 'toggle-select', id: candidate.id }));
      return;
    }

    setPreviewCandidate(candidate);
  }, [isSelectionMode]);

  const handleToggleSelectAll = useCallback(() => {
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

      if ((options?.deletedIds?.length ?? 0) > 0) {
        const nextCleanupReport = await loadCleanupReportSnapshot().catch(() => ZERO_CLEANUP_REPORT);
        setCleanupReport(nextCleanupReport);
      }

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

  const handleDelete = useCallback(async (ids = state.selectedIds) => {
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

      setState(nextState);
      setPreviewCandidate((current) =>
        buildNextDetailCandidate(state.recycleBin, current, ids, ids[0] ?? current?.id ?? ''),
      );
    } catch (error) {
      console.error('Failed to delete recycle bin items:', error);
      setErrorMessage(error instanceof Error ? error.message : copy.alerts.deleteFailedBody);
    }
  }, [copy.alerts.deleteFailedBody, persistRecycleBinState, state]);

  const handleClosePreview = useCallback(() => {
    setPreviewCandidate(null);
  }, []);

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
        onHardDelete={(ids) => void handleDelete(ids)}
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle} testID="recycle-bin-header-title">
          {recycleBinTexts.title}
        </Text>
        <Text style={styles.expireHint}>{recycleBinTexts.expireHint}</Text>
      </View>

      {errorMessage ? (
        <View style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>{copy.common.statusTitle}</Text>
          <Text style={styles.noticeText}>{errorMessage}</Text>
        </View>
      ) : null}

      {state.recycleBin.length > 0 ? (
        <PhotoGrid
          candidates={state.recycleBin}
          selectedIds={state.selectedIds}
          selectionMode={isSelectionMode}
          onSelect={handleSelect}
          onItemPress={handleItemPress}
          theme={theme}
          mediaType="all"
          gridTestID="recycle-bin-grid"
          itemTestID="recycle-bin-item"
          contentPadding={contentPadding}
        />
      ) : !hasHydrated && isHydrating ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText} testID="recycle-bin-loading-label">
            {loadingLabel}
          </Text>
        </View>
      ) : (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="trash-outline" size={42} color={theme.pageTextMuted} />
          </View>
          <Text style={styles.emptyTitle} testID="recycle-bin-empty-title">
            {recycleBinTexts.emptyTitle}
          </Text>
          <Text style={styles.emptyBody}>{recycleBinTexts.emptyBody}</Text>
        </View>
      )}

      <View
        style={[styles.cleanupReportCard, { bottom: cleanupReportBottom }]}
        testID="cleanup-report-card"
      >
        <Text style={styles.cleanupReportTitle}>{cleanupReportCopy.title}</Text>
        <View style={styles.cleanupReportMetricsRow}>
          <View style={styles.cleanupReportMetric}>
            <Text style={styles.cleanupReportMetricLabel}>{cleanupReportCopy.itemCountLabel}</Text>
            <Text style={styles.cleanupReportMetricValue} testID="cleanup-report-count">
              {cleanupReport.cleanedItemCount}
            </Text>
          </View>
          <View style={styles.cleanupReportMetric}>
            <Text style={styles.cleanupReportMetricLabel}>{cleanupReportCopy.sizeLabel}</Text>
            <Text style={styles.cleanupReportMetricValue} testID="cleanup-report-bytes">
              {formatLocalizedSize(cleanupReport.cleanedBytes, appLanguage)}
            </Text>
          </View>
        </View>
        <Text style={styles.cleanupReportFooterText} testID="cleanup-report-last-cleaned">
          {cleanupReport.lastCleanedAt
            ? `${cleanupReportCopy.lastCleanedLabel} · ${formatCleanupReportTime(
                cleanupReport.lastCleanedAt,
                appLanguage,
              )}`
            : cleanupReportCopy.emptyLabel}
        </Text>
      </View>

      {isSelectionMode && (
        <View style={styles.actionBar}>
          <View style={styles.selectionActionsRow}>
            <TouchSurface
              style={[styles.selectionActionButton, styles.selectionToggleButton]}
              pressedStyle={styles.selectionToggleButtonPressed}
              onPress={handleToggleSelectAll}
              preset="pill"
              testID="recycle-selection-toggle-button"
            >
              <Text style={[styles.selectionActionText, styles.selectionToggleText]}>
                {buildSelectionToggleLabel(appLanguage, isAllRecycleBinSelected)}
              </Text>
            </TouchSurface>
            <TouchSurface
              style={[styles.selectionActionButton, styles.selectionRestoreButton]}
              pressedStyle={styles.selectionRestoreButtonPressed}
              onPress={() => void handleRestore()}
              preset="pill"
              testID="recycle-restore-selected-button"
            >
              <Text style={styles.selectionActionText}>
                {copy.screens.recycleBin.restore} ({state.selectedIds.length})
              </Text>
            </TouchSurface>
            <TouchSurface
              style={[styles.selectionActionButton, styles.selectionDeleteButton]}
              pressedStyle={styles.selectionDeleteButtonPressed}
              onPress={() => void handleDelete()}
              preset="pill"
              testID="recycle-delete-selected-button"
            >
              <Text style={styles.selectionActionText}>
                {copy.screens.recycleBin.delete} ({state.selectedIds.length})
              </Text>
            </TouchSurface>
          </View>
        </View>
      )}
    </View>
  );
}

function createStyles(
  theme: AppThemePalette,
  insets: { top: number; bottom: number; left: number; right: number },
) {
  const SIZE_DEFAULT = 14;
  const MUTED_DANGER = '#d8646a';
  const MUTED_DANGER_PRESSED = '#c65a60';
  const MUTED_KEEP = '#18bf63';
  const MUTED_KEEP_PRESSED = '#15ad59';
  const headerInsets = buildRecycleBinHeaderInsets(insets);

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.safeArea,
    },
    header: {
      paddingHorizontal: 16,
      paddingTop: headerInsets.top,
      paddingBottom: 8,
      marginLeft: headerInsets.left,
      marginRight: headerInsets.right,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: '700',
      color: theme.pageTextPrimary,
      marginBottom: 4,
    },
    expireHint: {
      fontSize: 13,
      color: theme.pageTextMuted,
    },
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
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
    cleanupReportCard: {
      position: 'absolute',
      left: 16 + insets.left,
      right: 16 + insets.right,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 18,
      backgroundColor: theme.cardBackground,
      borderWidth: 1,
      borderColor: theme.cardBorder,
      shadowColor: theme.shadowColor,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: theme.scheme === 'dark' ? 0.18 : 0.08,
      shadowRadius: 14,
      elevation: 3,
    },
    cleanupReportTitle: {
      color: theme.pageTextPrimary,
      fontSize: 16,
      fontWeight: '800',
      marginBottom: 10,
    },
    cleanupReportMetricsRow: {
      flexDirection: 'row',
      gap: 12,
    },
    cleanupReportMetric: {
      flex: 1,
      borderRadius: 14,
      paddingVertical: 10,
      paddingHorizontal: 12,
      backgroundColor: theme.cardMutedBackground,
    },
    cleanupReportMetricLabel: {
      color: theme.pageTextMuted,
      fontSize: 12,
      marginBottom: 6,
    },
    cleanupReportMetricValue: {
      color: theme.pageTextPrimary,
      fontSize: 18,
      fontWeight: '800',
    },
    cleanupReportFooterText: {
      marginTop: 10,
      color: theme.pageTextSecondary,
      fontSize: 12,
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
      backgroundColor: theme.buttonSecondaryBackground,
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
    selectionRestoreButton: {
      backgroundColor: MUTED_KEEP,
    },
    selectionRestoreButtonPressed: {
      backgroundColor: MUTED_KEEP_PRESSED,
    },
    selectionDeleteButton: {
      backgroundColor: MUTED_DANGER,
    },
    selectionDeleteButtonPressed: {
      backgroundColor: MUTED_DANGER_PRESSED,
    },
    selectionActionText: {
      color: '#ffffff',
      fontSize: SIZE_DEFAULT,
      fontWeight: '800',
      letterSpacing: 0.2,
    },
  });
}
