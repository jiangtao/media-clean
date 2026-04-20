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
import type { AppThemePalette } from '../../theme/app-theme';
import { scanMediaLibrary } from '../../features/scan/scan-media-library';
import {
  loadRecycleBinSnapshotCache,
  loadRecycleBinIds,
  saveRecycleBinIds,
  saveRecycleBinSnapshotCache,
} from '../../services/storage/app-storage';
import {
  buildPhotoGridContentPadding,
  buildRecycleBinHeaderInsets,
  buildRecycleBinTexts,
} from './screen-layout';

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

type RecycleBinScreenProps = {
  recycleBinIds?: string[];
  onRecycleBinIdsChange?: (ids: string[]) => void;
};

export function RecycleBinScreen({
  recycleBinIds,
  onRecycleBinIdsChange,
}: RecycleBinScreenProps = {}) {
  const { copy, theme, language } = useAppPreferences();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme, insets), [insets, theme]);
  const contentPadding = useMemo(() => buildPhotoGridContentPadding(insets), [insets]);
  const recycleBinTexts = useMemo(() => buildRecycleBinTexts(copy, EXPIRATION_DAYS), [copy]);
  const loadingLabel = language === 'zh-CN' ? '加载回收站…' : 'Loading recycle bin…';

  const [state, setState] = useState<CleanupState>(createInitialCleanupState([]));
  const [previewCandidate, setPreviewCandidate] = useState<CleanupCandidate | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isHydrating, setIsHydrating] = useState(true);
  const [hasHydrated, setHasHydrated] = useState(false);
  const isSelectionMode = state.selectedIds.length > 0;
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
          const recycleBinSnapshotPromise = loadRecycleBinSnapshotCache();
          const recycleBinSourceIdsPromise =
            recycleBinIds && recycleBinIds.length > 0
              ? Promise.resolve(recycleBinIds)
              : loadRecycleBinIds();
          const recycleBinSnapshot = await recycleBinSnapshotPromise;
          const cachedRecycleBin = recycleBinSnapshot?.candidates ?? [];

          if (!isActive) {
            return;
          }

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

  const persistRecycleBinState = useCallback(
    async (nextState: CleanupState) => {
      const nextRecycleBinIds = normalizeIds(nextState.recycleBin.map((candidate) => candidate.id));
      await Promise.all([
        saveRecycleBinIds(nextRecycleBinIds),
        saveRecycleBinSnapshotCache({
          ids: nextRecycleBinIds,
          candidates: nextState.recycleBin,
          updatedAt: Date.now(),
          source: 'manual',
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
      await persistRecycleBinState(nextState);

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
      await MediaLibrary.deleteAssetsAsync(ids);

      const nextState = applyCleanupAction(state, { type: 'hard-delete', ids });
      await persistRecycleBinState(nextState);

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
        <Text style={styles.headerTitle}>{recycleBinTexts.title}</Text>
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
          contentPadding={contentPadding}
        />
      ) : !hasHydrated && isHydrating ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>{loadingLabel}</Text>
        </View>
      ) : (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="trash-outline" size={42} color={theme.pageTextMuted} />
          </View>
          <Text style={styles.emptyTitle}>{recycleBinTexts.emptyTitle}</Text>
          <Text style={styles.emptyBody}>{recycleBinTexts.emptyBody}</Text>
        </View>
      )}

      {isSelectionMode && (
        <View style={styles.actionBar}>
          <View style={styles.selectionActionsRow}>
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
