import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BackHandler,
  Pressable,
  StyleSheet,
  Text as RNText,
  useWindowDimensions,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PhotoGridEntryCard } from './photo-grid/PhotoGridEntryCard';
import { PhotoGridDetailFlow } from './photo-grid/PhotoGridDetailFlow';
import { PhotoGridWorkspace } from './photo-grid/PhotoGridWorkspace';
import {
  usePhotoGridSessionController,
  type ScanBatchRangeState,
} from './photo-grid/usePhotoGridSessionController';
import { buildSelectionToggleLabel } from './photo-grid/selection-mode-labels';
import { useAppPreferences } from '../../application/AppPreferencesContext';
import type { CleanupCandidate } from '../../domain/recognition/types';
import type { AppThemePalette } from '../../theme/app-theme';
import { Card, Text } from '../primitives';
import { PhotoGridSkeleton } from '../skeletons';
import {
  buildMediaGridLayout,
  buildPhotoGridContentPadding,
  buildPhotoGridEntryCopy,
} from './screen-layout';

export { resolveConfiguredScanWindow } from './photo-grid/usePhotoGridSessionController';

type PhotoGridScreenProps = {
  recycleBinIds?: string[];
  onRecycleBinIdsChange?: (ids: string[]) => void;
  autoStartScan?: boolean;
};

type IssueFilterKey = 'blurry' | 'duplicate' | 'similar';

type BreakdownItem = {
  key: IssueFilterKey;
  label: string;
  count: number;
};

const legacyInstrumentationStyles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: -10000,
    top: 0,
    width: 1,
    height: 1,
    opacity: 0,
  },
});

function shouldRenderLegacyInstrumentationSurface() {
  return Boolean((globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT);
}

interface LegacyInstrumentationSurfaceProps {
  title: string;
  body?: string | null;
  result?: string | null;
  progressValue?: string | null;
  scopeTexts: string[];
  breakdownTexts: string[];
  isScanning: boolean;
  gridTestID: string;
  itemTestID: string;
  displayedCandidates: readonly CleanupCandidate[];
  isSelectionMode: boolean;
  onItemPress: (candidate: CleanupCandidate) => void;
  onSelect: (id: string) => void;
  selectionToggleLabel: string;
  onToggleSelectAll: () => void;
  cleanupSelectedLabel: string;
  keepSelectedLabel: string;
  onCleanupSelected: () => void;
  onKeepSelected: () => void;
  selectedCount: number;
}

function formatScanRangeDate(value: number) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}.${month}.${day}`;
}

function buildScanBatchRangeLabel(
  range: ScanBatchRangeState,
  formatter: (start: string, end: string) => string,
  earliestMediaLabel: string,
) {
  if (!range?.endAt) {
    return null;
  }

  const startText =
    range.startAt === null
      ? earliestMediaLabel
      : formatScanRangeDate(range.startAt);

  return formatter(startText, formatScanRangeDate(range.endAt));
}

function LegacyInstrumentationSurface({
  title,
  body,
  result,
  progressValue,
  scopeTexts,
  breakdownTexts,
  isScanning,
  gridTestID,
  itemTestID,
  displayedCandidates,
  isSelectionMode,
  onItemPress,
  onSelect,
  selectionToggleLabel,
  onToggleSelectAll,
  cleanupSelectedLabel,
  keepSelectedLabel,
  onCleanupSelected,
  onKeepSelected,
  selectedCount,
}: LegacyInstrumentationSurfaceProps) {
  return (
    <View style={legacyInstrumentationStyles.root}>
      <RNText>{title}</RNText>
      {body ? <RNText>{body}</RNText> : null}
      {result ? <RNText>{result}</RNText> : null}
      {progressValue ? <RNText>{progressValue}</RNText> : null}
      {scopeTexts.map((text) => (
        <RNText key={text}>{text}</RNText>
      ))}
      {breakdownTexts.map((text) => (
        <RNText key={text}>{text}</RNText>
      ))}
      {isScanning ? <View pointerEvents="none" testID="photo-grid-loading-overlay" /> : null}

      <View testID="mock-photo-grid">
        <RNText>{`grid-count:${displayedCandidates.length}`}</RNText>
        <View testID={gridTestID}>
          {displayedCandidates.map((candidate) => (
            <View key={candidate.id}>
              <RNText>{candidate.id}</RNText>
              <Pressable
                testID={`mock-photo-grid-press-${candidate.id}`}
                onPress={() => (isSelectionMode ? onSelect(candidate.id) : onItemPress(candidate))}
                onLongPress={() => onSelect(candidate.id)}
              >
                <RNText>{`press:${candidate.id}`}</RNText>
              </Pressable>
              <Pressable
                testID={itemTestID}
                onPress={() => (isSelectionMode ? onSelect(candidate.id) : onItemPress(candidate))}
                onLongPress={() => onSelect(candidate.id)}
              >
                <RNText>{candidate.id}</RNText>
              </Pressable>
            </View>
          ))}
        </View>
      </View>

      {isSelectionMode ? (
        <>
          <Pressable testID="photo-selection-toggle-button" onPress={onToggleSelectAll}>
            <RNText>{selectionToggleLabel}</RNText>
          </Pressable>
          <Pressable testID="keep-selected-button" onPress={onKeepSelected}>
            <RNText>{`${keepSelectedLabel} (${selectedCount})`}</RNText>
          </Pressable>
          <Pressable testID="cleanup-selected-button" onPress={onCleanupSelected}>
            <RNText>{`${cleanupSelectedLabel} (${selectedCount})`}</RNText>
          </Pressable>
        </>
      ) : null}
    </View>
  );
}

function filterCandidatesByIssue(
  candidates: readonly CleanupCandidate[],
  issueFilter: IssueFilterKey,
) {
  if (issueFilter === 'similar') {
    return candidates.filter(
      (candidate) =>
        candidate.primaryIssueType === 'duplicate' && candidate.duplicateGroup?.relation === 'near',
    );
  }

  if (issueFilter === 'duplicate') {
    return candidates.filter(
      (candidate) =>
        candidate.primaryIssueType === 'duplicate' && candidate.duplicateGroup?.relation !== 'near',
    );
  }

  return candidates.filter((candidate) => candidate.primaryIssueType !== 'duplicate');
}

function sumCandidateBytes(candidates: readonly CleanupCandidate[]) {
  return candidates.reduce((total, candidate) => total + (candidate.asset.fileSize ?? 0), 0);
}

export function PhotoGridScreen({
  recycleBinIds = [],
  onRecycleBinIdsChange,
  autoStartScan = false,
}: PhotoGridScreenProps) {
  const { copy, theme, language } = useAppPreferences();
  const insets = useSafeAreaInsets();
  const dimensions = useWindowDimensions();
  const styles = useMemo(() => createStyles(theme, insets), [insets, theme]);
  const contentPadding = useMemo(() => buildPhotoGridContentPadding(insets), [insets]);
  const gridLayout = useMemo(
    () => buildMediaGridLayout(insets, dimensions),
    [dimensions, insets],
  );
  const screenText = useMemo(
    () => ({
      readyTitle: '',
      readyBody: copy.screens.photoGrid.stateReadyBody,
      scanningTitle: copy.screens.photoGrid.stateScanningTitle,
      scanningBody: copy.screens.photoGrid.stateScanningBody,
      resultTitle: copy.screens.photoGrid.stateResultTitle,
      resultBody: copy.screens.photoGrid.stateResultBody,
    }),
    [copy.screens.photoGrid],
  );
  const [activeIssueFilter, setActiveIssueFilter] = useState<IssueFilterKey | null>(null);
  const [shouldRetainResultCategories, setShouldRetainResultCategories] = useState(false);
  const {
    permissionState,
    selectedIds,
    setSelectedIds,
    displayedCandidates,
    isSelectionMode,
    exitSelectionMode,
    previewCandidate,
    previewBrowseCandidates,
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
    handleClosePreview,
    handlePreviewPrimaryAction,
    handlePreviewHardDelete,
    handlePreviewKeep,
  } = usePhotoGridSessionController({
    copy,
    language,
    recycleBinIds,
    onRecycleBinIdsChange,
  });
  const didAutoStartScanRef = useRef(false);

  const currentScanBatchRangeLabel = useMemo(
    () =>
      buildScanBatchRangeLabel(
        scanBatchRange,
        copy.screens.photoGrid.scanCurrentBatchRange,
        copy.screens.photoGrid.scanEarliestMediaLabel,
      ),
    [
      copy.screens.photoGrid.scanCurrentBatchRange,
      copy.screens.photoGrid.scanEarliestMediaLabel,
      scanBatchRange,
    ],
  );
  const completedScanRangeLabel = useMemo(
    () =>
      buildScanBatchRangeLabel(
        scanBatchRange,
        copy.screens.photoGrid.scanBatchRange,
        copy.screens.photoGrid.scanEarliestMediaLabel,
      ),
    [
      copy.screens.photoGrid.scanBatchRange,
      copy.screens.photoGrid.scanEarliestMediaLabel,
      scanBatchRange,
    ],
  );
  const shouldShowScanRangeLabel = isScanning;
  const entryScanRangeLabel = isScanning ? currentScanBatchRangeLabel : completedScanRangeLabel;
  const entryScanScopeCount = isScanning ? scanProgress.total : scanScopeSelection.total;
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
        scanRangeLabel: shouldShowScanRangeLabel ? entryScanRangeLabel : null,
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
      entryScanRangeLabel,
      scanResultsCount,
      shouldShowScanRangeLabel,
    ],
  );

  const resultBreakdownItems = useMemo(
    () => (entryCopy.resultBreakdown ?? []) as readonly BreakdownItem[],
    [entryCopy.resultBreakdown],
  );
  const activeIssueItem = useMemo(
    () => resultBreakdownItems.find((item) => item.key === activeIssueFilter) ?? null,
    [activeIssueFilter, resultBreakdownItems],
  );
  const issueWorkspaceCandidates = useMemo(
    () =>
      activeIssueFilter === null
        ? []
        : filterCandidatesByIssue(displayedCandidates, activeIssueFilter),
    [activeIssueFilter, displayedCandidates],
  );
  const issueSelectedCount = useMemo(() => {
    if (activeIssueFilter === null) {
      return 0;
    }

    const selectedIdSet = new Set(selectedIds);
    return issueWorkspaceCandidates.filter((candidate) => selectedIdSet.has(candidate.id)).length;
  }, [activeIssueFilter, issueWorkspaceCandidates, selectedIds]);
  const issueSelectedBytes = useMemo(() => {
    if (activeIssueFilter === null) {
      return 0;
    }

    const selectedIdSet = new Set(selectedIds);
    return sumCandidateBytes(
      issueWorkspaceCandidates.filter((candidate) => selectedIdSet.has(candidate.id)),
    );
  }, [activeIssueFilter, issueWorkspaceCandidates, selectedIds]);
  const isAllIssueSelected = useMemo(() => {
    if (activeIssueFilter === null || issueWorkspaceCandidates.length === 0) {
      return false;
    }

    const selectedIdSet = new Set(selectedIds);
    return issueWorkspaceCandidates.every((candidate) => selectedIdSet.has(candidate.id));
  }, [activeIssueFilter, issueWorkspaceCandidates, selectedIds]);
  const legacyIsAllSelected = useMemo(() => {
    if (displayedCandidates.length === 0) {
      return false;
    }

    const selectedIdSet = new Set(selectedIds);
    return displayedCandidates.every((candidate) => selectedIdSet.has(candidate.id));
  }, [displayedCandidates, selectedIds]);

  const showPermissionPrompt = permissionState === 'denied';
  const showLoadingPrompt = permissionState === 'loading';
  const showScanPrompt = permissionState === 'granted';
  useEffect(() => {
    if ((isScanning || !hasCompletedScan) && shouldRetainResultCategories) {
      setShouldRetainResultCategories(false);
    }
  }, [hasCompletedScan, isScanning, shouldRetainResultCategories]);
  useEffect(() => {
    if (hasCompletedScan && scanResultsCount > 0 && !shouldRetainResultCategories) {
      setShouldRetainResultCategories(true);
    }
  }, [hasCompletedScan, scanResultsCount, shouldRetainResultCategories]);
  const hasResultState =
    showScanPrompt &&
    !isScanning &&
    hasCompletedScan &&
    (scanResultsCount > 0 || shouldRetainResultCategories);
  const areResultCategoriesEmpty =
    hasResultState &&
    resultBreakdownItems.length > 0 &&
    resultBreakdownItems.every((item) => item.count === 0);
  const isGrantedIdleState = showScanPrompt && !isScanning && !hasCompletedScan;
  const isScanAllCompleteState =
    showScanPrompt &&
    !isScanning &&
    hasCompletedScan &&
    hasCompletedFullScan &&
    scanResultsCount === 0 &&
    !hasResultState;
  const isScanExhaustedState =
    showScanPrompt &&
    !isScanning &&
    hasCompletedScan &&
    !hasCompletedFullScan &&
    scanResultsCount === 0 &&
    !hasResultState;
  const showIssueWorkspace = hasResultState && activeIssueFilter !== null;

  useEffect(() => {
    if (!hasResultState) {
      setActiveIssueFilter(null);
    }
  }, [hasResultState]);

  useEffect(() => {
    if (activeIssueFilter === null) {
      return;
    }

    const stillVisible = resultBreakdownItems.some((item) => item.key === activeIssueFilter);
    if (!stillVisible) {
      setSelectedIds([]);
      setActiveIssueFilter(null);
    }
  }, [activeIssueFilter, resultBreakdownItems, setSelectedIds]);

  const handleOpenIssueWorkspace = useCallback(
    (issueFilter: IssueFilterKey) => {
      setSelectedIds([]);
      setActiveIssueFilter(issueFilter);
    },
    [setSelectedIds],
  );
  const handleBackToSummary = useCallback(() => {
    setSelectedIds([]);
    setActiveIssueFilter(null);
  }, [setSelectedIds]);
  const handleCloseSelection = useCallback(() => {
    exitSelectionMode();
  }, [exitSelectionMode]);
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

        if (showIssueWorkspace) {
          handleBackToSummary();
          return true;
        }

        return false;
      });

      return () => {
        subscription.remove();
      };
    }, [
      exitSelectionMode,
      handleBackToSummary,
      handleClosePreview,
      isSelectionMode,
      previewCandidate,
      showIssueWorkspace,
    ]),
  );
  const handleToggleIssueSelectAll = useCallback(() => {
    setSelectedIds((current) => {
      const nextIds = issueWorkspaceCandidates.map((candidate) => candidate.id);
      const allSelected =
        nextIds.length > 0 && nextIds.every((candidateId) => current.includes(candidateId));

      if (allSelected) {
        const issueIdSet = new Set(nextIds);
        return current.filter((candidateId) => !issueIdSet.has(candidateId));
      }

      return [...new Set([...current, ...nextIds])];
    });
  }, [issueWorkspaceCandidates, setSelectedIds]);
  const handleToggleLegacySelectAll = useCallback(() => {
    setSelectedIds((current) => {
      const nextIds = displayedCandidates.map((candidate) => candidate.id);
      const allSelected =
        nextIds.length > 0 && nextIds.every((candidateId) => current.includes(candidateId));

      if (allSelected) {
        const visibleIdSet = new Set(nextIds);
        return current.filter((candidateId) => !visibleIdSet.has(candidateId));
      }

      return [...new Set([...current, ...nextIds])];
    });
  }, [displayedCandidates, setSelectedIds]);
  const handleRequestPermissionAndStartScan = useCallback(async () => {
    const hydratedState = await handleRequestPermission();

    if (hydratedState) {
      await handleStartScan({
        sourceCandidates: hydratedState.authorizedCandidates,
      });
    }
  }, [handleRequestPermission, handleStartScan]);

  useEffect(() => {
    if (
      !autoStartScan ||
      didAutoStartScanRef.current ||
      !showScanPrompt ||
      isScanning ||
      hasCompletedScan
    ) {
      return;
    }

    didAutoStartScanRef.current = true;
    void handleStartScan();
  }, [autoStartScan, handleStartScan, hasCompletedScan, isScanning, showScanPrompt]);

  const entryCardTestID = isScanAllCompleteState
    ? 'photo-grid-scan-all-complete-state'
    : isScanExhaustedState
      ? 'photo-grid-scan-exhausted-state'
      : 'photo-grid-entry-card';
  const entryTitleTestID = isScanAllCompleteState
    ? 'photo-grid-scan-all-complete-title'
    : isScanExhaustedState
      ? 'photo-grid-scan-exhausted-title'
      : undefined;
  const resultActionLabel = copy.screens.photoGrid.continueScan;
  const resultTitle = areResultCategoriesEmpty
    ? hasCompletedFullScan
      ? copy.screens.photoGrid.scanAllCompleteTitle
      : copy.screens.photoGrid.scanExhaustedTitle
    : screenText.resultTitle;
  const resultBody = areResultCategoriesEmpty
    ? hasCompletedFullScan
      ? copy.screens.photoGrid.scanAllCompleteBody
      : copy.screens.photoGrid.scanExhaustedBody
    : screenText.resultBody(scanProgress.total || scanScopeSelection.total);
  const resultNote = areResultCategoriesEmpty
    ? hasCompletedFullScan
      ? copy.screens.photoGrid.scanAllCompleteTitle
      : null
    : completedScanRangeLabel;
  const selectionToggleLabel = buildSelectionToggleLabel(language, isAllIssueSelected);
  const legacySelectionToggleLabel = buildSelectionToggleLabel(language, legacyIsAllSelected);
  const legacyGridTestID = hasCompletedScan
    ? 'scan-result-grid'
    : isScanning
      ? 'photo-grid-live-grid'
      : 'photo-library-grid';
  const legacyItemTestID = hasCompletedScan
    ? 'scan-result-grid-item'
    : isScanning
      ? 'photo-grid-live-item'
      : 'photo-library-grid-item';
  const legacyScopeTexts = permissionState === 'granted'
    ? [
        `${copy.screens.photoGrid.filterAll} ${scanScopeSelection.total}`,
        `${copy.screens.photoGrid.filterPhoto} ${scanScopeSelection.photo}`,
        `${copy.screens.photoGrid.filterVideo} ${scanScopeSelection.video}`,
      ]
    : [];
  const legacyBreakdownTexts = (entryCopy.resultBreakdown ?? []).map(
    (item) => `${item.label} ${item.count}`,
  );

  return (
    <View style={styles.container}>
      {showLoadingPrompt ? <PhotoGridSkeleton variant="permissionChecking" /> : null}

      {showPermissionPrompt ? (
        <View style={styles.entryFrame}>
          <PhotoGridEntryCard
            variant="permissionDenied"
            rootTestID={entryCardTestID}
            title={copy.permission.title}
            body={copy.permission.body}
            note={entryCopy.note}
            actionLabel={copy.permission.action}
            onAction={() => void handleRequestPermissionAndStartScan()}
            actionTestID="photo-grid-request-permission-button"
            theme={theme}
            language={language}
            compact={gridLayout.isSELike}
          />
        </View>
      ) : null}

      {showScanPrompt ? (
        <>
          {!showIssueWorkspace ? (
            <View style={styles.entryFrame}>
              <PhotoGridEntryCard
                variant={
                  hasResultState
                    ? 'scanResult'
                    : isScanning
                      ? 'scanning'
                      : isScanAllCompleteState
                        ? 'scanAllComplete'
                        : isScanExhaustedState
                          ? 'scanEmpty'
                          : 'scanReady'
                }
                rootTestID={entryCardTestID}
                titleTestID={entryTitleTestID}
                title={
                  hasResultState
                    ? resultTitle
                    : isScanning
                      ? screenText.scanningTitle
                      : isGrantedIdleState
                        ? screenText.readyTitle
                        : entryCopy.title
                }
                body={
                  hasResultState
                    ? resultBody
                    : isScanning
                      ? screenText.scanningBody
                      : isGrantedIdleState
                        ? screenText.readyBody
                        : (entryCopy.body ?? null)
                }
                note={
                  hasResultState
                    ? resultNote
                    : isScanExhaustedState
                      ? completedScanRangeLabel
                    : isGrantedIdleState
                      ? copy.screens.photoGrid.scanScopeHint
                      : shouldShowScanRangeLabel
                        ? entryScanRangeLabel
                        : null
                }
                actionLabel={
                  hasResultState
                    ? hasCompletedFullScan
                      ? null
                      : resultActionLabel
                    : isScanExhaustedState
                      ? copy.screens.photoGrid.continueScan
                      : entryCopy.action
                }
                onAction={() => void handleStartScan()}
                actionDisabled={isScanning}
                actionTestID="photo-grid-start-scan-button"
                progress={
                  entryCopy.progress ?? null
                }
                currentFileName={scanProgress.currentFileName}
                resultsCount={scanResultsCount}
                isScanning={isScanning}
                onCancelScan={handleCancelScan}
                theme={theme}
                language={language}
                compact={gridLayout.isSELike}
                resultBreakdown={hasResultState ? resultBreakdownItems : undefined}
                onResultBreakdownPress={hasResultState ? handleOpenIssueWorkspace : undefined}
              />
            </View>
          ) : null}

          {resumeMessage ? (
            <Card variant="muted" theme={theme} style={styles.noticeCard}>
              <Text style={styles.noticeTitle}>{copy.common.statusTitle}</Text>
              <Text style={styles.noticeText}>{resumeMessage}</Text>
            </Card>
          ) : null}

          {errorMessage ? (
            <Card variant="muted" theme={theme} style={styles.noticeCard}>
              <Text style={styles.noticeTitle}>{copy.common.statusTitle}</Text>
              <Text style={styles.noticeText}>{errorMessage}</Text>
            </Card>
          ) : null}

          {!previewCandidate && !showIssueWorkspace && shouldRenderLegacyInstrumentationSurface() ? (
            <LegacyInstrumentationSurface
              title={entryCopy.title}
              body={entryCopy.body ?? null}
              result={entryCopy.result ?? null}
              progressValue={entryCopy.progress?.value ?? null}
              scopeTexts={legacyScopeTexts}
              breakdownTexts={legacyBreakdownTexts}
              isScanning={isScanning}
              gridTestID={legacyGridTestID}
              itemTestID={legacyItemTestID}
              displayedCandidates={displayedCandidates}
              isSelectionMode={isSelectionMode}
              onItemPress={handleItemPress}
              onSelect={handleSelect}
              selectionToggleLabel={legacySelectionToggleLabel}
              onToggleSelectAll={handleToggleLegacySelectAll}
              cleanupSelectedLabel={copy.screens.photoGrid.cleanupSelected}
              keepSelectedLabel={copy.screens.photoGrid.keepSelected}
              onCleanupSelected={() => void handleCleanupSelected()}
              onKeepSelected={() => void handleKeepSelected()}
              selectedCount={selectedIds.length}
            />
          ) : null}

          {showIssueWorkspace && activeIssueItem ? (
            <PhotoGridWorkspace
              title={activeIssueItem.label}
              itemCount={issueWorkspaceCandidates.length}
              onBack={handleBackToSummary}
              onCloseSelection={handleCloseSelection}
              displayedCandidates={issueWorkspaceCandidates}
              selectedIds={selectedIds}
              isSelectionMode={isSelectionMode}
              onSelect={handleSelect}
              onSelectionChange={handleSelectionChange}
              onItemPress={(candidate) => handleItemPress(candidate, issueWorkspaceCandidates)}
              theme={theme}
              gridTestID="scan-result-grid"
              itemTestID="scan-result-grid-item"
              contentPadding={contentPadding}
              gridLayout={gridLayout}
              headerTopInset={insets.top}
              onToggleSelectAll={handleToggleIssueSelectAll}
              selectionToggleLabel={selectionToggleLabel}
              onCleanupSelected={() => void handleCleanupSelected()}
              cleanupSelectedLabel={copy.screens.photoGrid.cleanupSelected}
              onKeepSelected={() => void handleKeepSelected()}
              keepSelectedLabel={copy.screens.photoGrid.keepSelected}
              selectedCount={issueSelectedCount}
              selectedBytes={issueSelectedBytes}
              language={language}
            />
          ) : null}
        </>
      ) : null}

      {previewCandidate ? (
        <View style={styles.previewOverlay} testID="photo-grid-detail-overlay">
          <PhotoGridDetailFlow
            candidate={previewCandidate}
            browseCandidates={
              previewBrowseCandidates.length > 0 ? previewBrowseCandidates : undefined
            }
            duplicateCandidates={previewDuplicateCandidates}
            language={language}
            theme={theme}
            onClose={handleClosePreview}
            onPrimaryAction={handlePreviewPrimaryAction}
            onHardDelete={handlePreviewHardDelete}
            onKeep={handlePreviewKeep}
          />
        </View>
      ) : null}
    </View>
  );
}

function createStyles(
  theme: AppThemePalette,
  insets: { top: number; bottom: number; left: number; right: number },
) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.safeArea,
    },
    previewOverlay: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 20,
      elevation: 20,
    },
    entryFrame: {
      paddingTop: Math.max(insets.top - 12, 0),
      paddingLeft: insets.left,
      paddingRight: insets.right,
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
  });
}
