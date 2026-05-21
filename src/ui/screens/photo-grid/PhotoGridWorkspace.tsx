import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { PhotoGrid } from '../../components/PhotoGrid';
import { AppIcon } from '../../icons/AppIcon';
import { Button, Card, IconButton, Text } from '../../primitives';
import type { CleanupCandidate } from '../../../domain/recognition/types';
import type { AppLanguage } from '../../../i18n/app-language';
import { formatLocalizedSize, getAppCopy } from '../../../i18n/app-copy';
import type { AppThemePalette } from '../../../theme/app-theme';
import type { MediaGridLayout } from '../screen-layout';
import type { SwipeSelectionReason } from '../../hooks/useSwipeSelection';
import { buildSelectionHeaderTitle } from './selection-mode-labels';

interface PhotoGridWorkspaceProps {
  title: string;
  itemCount: number;
  onBack: () => void;
  onCloseSelection?: () => void;
  displayedCandidates: CleanupCandidate[];
  selectedIds: string[];
  isSelectionMode: boolean;
  onSelect: (id: string) => void;
  onSelectionChange?: (nextIds: string[], reason: SwipeSelectionReason) => void;
  onItemPress: (candidate: CleanupCandidate) => void;
  theme: AppThemePalette;
  gridTestID: string;
  itemTestID: string;
  contentPadding: {
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
  };
  gridLayout: MediaGridLayout;
  headerTopInset: number;
  onToggleSelectAll: () => void;
  selectionToggleLabel: string;
  onCleanupSelected: () => void;
  cleanupSelectedLabel: string;
  onKeepSelected: () => void;
  keepSelectedLabel: string;
  selectedCount: number;
  selectedBytes: number;
  language: AppLanguage;
}

export function PhotoGridWorkspace({
  title,
  itemCount,
  onBack,
  onCloseSelection,
  displayedCandidates,
  selectedIds,
  isSelectionMode,
  onSelect,
  onSelectionChange,
  onItemPress,
  theme,
  gridTestID,
  itemTestID,
  contentPadding,
  gridLayout,
  headerTopInset,
  onToggleSelectAll,
  selectionToggleLabel,
  onCleanupSelected,
  cleanupSelectedLabel,
  onKeepSelected,
  keepSelectedLabel,
  selectedCount,
  selectedBytes,
  language,
}: PhotoGridWorkspaceProps) {
  const isCompact = gridLayout.isSELike;
  const styles = useMemo(
    () => createWorkspaceStyles(theme, isCompact),
    [isCompact, theme],
  );
  const copy = useMemo(() => getAppCopy(language).screens.photoGrid, [language]);
  const footerSizeText = useMemo(
    () => copy.workspaceSelectedSize(formatLocalizedSize(selectedBytes, language)),
    [copy, language, selectedBytes],
  );
  const headerShellStyle = useMemo(
    () => [
      styles.headerShell,
      {
        paddingTop: headerTopInset + 6,
        paddingLeft: (contentPadding.left ?? 0) + gridLayout.sidePadding,
        paddingRight: (contentPadding.right ?? 0) + gridLayout.sidePadding,
      },
    ],
    [
      contentPadding.left,
      contentPadding.right,
      gridLayout.sidePadding,
      headerTopInset,
      styles.headerShell,
    ],
  );
  const gridContentPadding = useMemo(
    () => ({
      ...contentPadding,
      top: (contentPadding.top ?? 0) + 4,
      bottom: (contentPadding.bottom ?? 0) + (isSelectionMode ? 86 : 24),
    }),
    [contentPadding, isSelectionMode],
  );

  return (
    <View style={styles.shell}>
      <View style={headerShellStyle}>
        <View style={styles.headerRow}>
          {isSelectionMode ? (
            <>
              <IconButton
                onPress={onCloseSelection ?? onBack}
                style={styles.backButton}
                theme={theme}
                testID="photo-grid-close-button"
              >
                <AppIcon name="close" size={24} color={theme.pageTextPrimary} />
              </IconButton>

              <View style={styles.headerCopy}>
                <Text style={styles.headerTitle} testID="photo-grid-workspace-title">
                  {buildSelectionHeaderTitle(language, selectedCount)}
                </Text>
              </View>
            </>
          ) : (
            <>
              <IconButton
                onPress={onBack}
                style={styles.backButton}
                theme={theme}
                testID="photo-grid-back-button"
              >
                <AppIcon name="arrow-back" size={24} color={theme.pageTextPrimary} />
              </IconButton>

              <View style={styles.headerCopy}>
                <Text style={styles.headerTitle} testID="photo-grid-workspace-title">
                  {copy.workspaceTitleWithCount(title, itemCount)}
                </Text>
              </View>
            </>
          )}

          {isSelectionMode ? (
            <Button
              onPress={onToggleSelectAll}
              variant="tertiary"
              theme={theme}
              style={styles.headerAction}
              textStyle={styles.headerActionText}
              testID="photo-selection-toggle-button"
            >
              {selectionToggleLabel}
            </Button>
          ) : null}
        </View>
      </View>

      <View style={styles.gridStage} testID="photo-grid-stage">
        {displayedCandidates.length > 0 ? (
          <PhotoGrid
            candidates={displayedCandidates}
            selectedIds={selectedIds}
            selectionMode={isSelectionMode}
            onSelect={onSelect}
            onSelectionChange={onSelectionChange}
            onItemPress={onItemPress}
            theme={theme}
            mediaType="all"
            gridTestID={gridTestID}
            itemTestID={itemTestID}
            contentPadding={gridContentPadding}
            gridLayout={gridLayout}
          />
        ) : (
          <View style={styles.emptyIssueState} testID="photo-grid-issue-empty-state">
            <Text variant="title" tone="secondary" theme={theme} style={styles.emptyIssueText}>
              {copy.workspaceEmptyIssueTitle}
            </Text>
          </View>
        )}
      </View>

      {isSelectionMode ? (
        <View style={styles.footerShell}>
          <Card theme={theme} style={styles.footerCard}>
            <View style={styles.footerSummary}>
              <Text variant="caption" theme={theme} style={styles.footerBody}>{footerSizeText}</Text>
            </View>

            <View style={styles.footerActions}>
              <Button
                style={[styles.footerActionButton, styles.keepButton]}
                onPress={onKeepSelected}
                variant="secondary"
                theme={theme}
                textStyle={[styles.footerActionText, styles.keepButtonText]}
                testID="keep-selected-button"
              >
                {keepSelectedLabel}
              </Button>

              <Button
                style={[styles.footerActionButton, styles.cleanupButton]}
                onPress={onCleanupSelected}
                variant="danger"
                theme={theme}
                textStyle={styles.footerActionText}
                testID="cleanup-selected-button"
              >
                {cleanupSelectedLabel}
              </Button>
            </View>
          </Card>
        </View>
      ) : null}
    </View>
  );
}

function createWorkspaceStyles(theme: AppThemePalette, isCompact = false) {
  return StyleSheet.create({
    shell: {
      flex: 1,
    },
    headerShell: {
      paddingBottom: 0,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerCopy: {
      flex: 1,
    },
    headerTitle: {
      fontSize: isCompact ? 21 : 24,
      lineHeight: isCompact ? 27 : 31,
      fontWeight: '800',
      color: theme.pageTextPrimary,
    },
    headerAction: {
      minHeight: 40,
      borderRadius: 20,
      borderWidth: 0,
      backgroundColor: 'transparent',
      paddingHorizontal: 6,
      paddingVertical: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerActionText: {
      fontSize: isCompact ? 14 : 16,
      fontWeight: '700',
      color: theme.buttonPrimaryBackground,
    },
    gridStage: {
      flex: 1,
      paddingTop: isCompact ? 10 : 8,
    },
    emptyIssueState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 24,
      paddingBottom: isCompact ? 72 : 96,
    },
    emptyIssueText: {
      fontSize: isCompact ? 16 : 18,
      lineHeight: isCompact ? 22 : 24,
      fontWeight: '700',
      textAlign: 'center',
      color: theme.pageTextSecondary,
    },
    footerShell: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: 12,
      paddingBottom: 8,
    },
    footerCard: {
      borderRadius: isCompact ? 24 : 26,
      paddingHorizontal: isCompact ? 14 : 18,
      paddingVertical: isCompact ? 12 : 15,
      backgroundColor: theme.actionBarBackground,
      borderWidth: 1,
      borderColor: theme.cardBorder,
      shadowColor: theme.shadowColor,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: theme.scheme === 'dark' ? 0.24 : 0.1,
      shadowRadius: 18,
      elevation: 4,
      flexDirection: 'row',
      alignItems: 'center',
      gap: isCompact ? 12 : 16,
    },
    footerSummary: {
      gap: 4,
      flex: 0.72,
      minWidth: 76,
    },
    footerTitle: {
      fontSize: isCompact ? 14 : 16,
      fontWeight: '800',
      color: theme.actionBarText,
    },
    footerBody: {
      fontSize: isCompact ? 12 : 13,
      lineHeight: isCompact ? 17 : 18,
      color: theme.actionBarText,
      opacity: 0.78,
    },
    footerActions: {
      flex: 1.28,
      flexDirection: 'row',
      alignItems: 'center',
      gap: isCompact ? 8 : 10,
    },
    footerActionButton: {
      flex: 1,
      minHeight: isCompact ? 38 : 44,
      borderRadius: isCompact ? 13 : 15,
      borderWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: isCompact ? 10 : 14,
      paddingVertical: 0,
    },
    footerActionText: {
      color: theme.buttonPrimaryText,
      fontSize: isCompact ? 13 : 15,
      fontWeight: '800',
    },
    keepButton: {
      backgroundColor: theme.buttonSecondaryBackground,
    },
    keepButtonText: {
      color: theme.buttonSecondaryText,
    },
    cleanupButton: {
      backgroundColor: theme.buttonDangerBackground,
    },
  });
}
