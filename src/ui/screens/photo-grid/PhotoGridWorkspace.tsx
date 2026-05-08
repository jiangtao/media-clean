import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { PhotoGrid } from '../../components/PhotoGrid';
import { TouchSurface } from '../../components/TouchSurface';
import type { CleanupCandidate } from '../../../domain/recognition/types';
import type { AppLanguage } from '../../../i18n/app-language';
import { formatLocalizedSize } from '../../../i18n/app-copy';
import type { AppThemePalette } from '../../../theme/app-theme';
import type { MediaGridLayout } from '../screen-layout';

interface PhotoGridWorkspaceProps {
  title: string;
  itemCount: number;
  onBack: () => void;
  displayedCandidates: CleanupCandidate[];
  selectedIds: string[];
  isSelectionMode: boolean;
  onSelect: (id: string) => void;
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
  displayedCandidates,
  selectedIds,
  isSelectionMode,
  onSelect,
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
  const copy = useMemo(
    () =>
      language === 'en-US'
        ? {
            titleWithCount: (value: string, count: number) => `${value} (${count})`,
            footerTitle: (count: number) => `${count} items selected`,
            footerSize: (formattedSize: string) => formattedSize,
          }
        : {
            titleWithCount: (value: string, count: number) => `${value} (${count})`,
            footerTitle: (count: number) => `已选 ${count} 项`,
            footerSize: (formattedSize: string) => formattedSize,
          },
    [language],
  );
  const footerSizeText = useMemo(
    () => copy.footerSize(formatLocalizedSize(selectedBytes, language)),
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
          <Pressable
            accessibilityRole="button"
            onPress={onBack}
            style={styles.backButton}
            testID="photo-grid-back-button"
          >
            <Ionicons name="arrow-back" size={24} color={theme.pageTextPrimary} />
          </Pressable>

          <View style={styles.headerCopy}>
            <Text style={styles.headerTitle} testID="photo-grid-workspace-title">
              {copy.titleWithCount(title, itemCount)}
            </Text>
          </View>

          {isSelectionMode ? (
            <Pressable
              accessibilityRole="button"
              onPress={onToggleSelectAll}
              style={styles.headerAction}
              testID="photo-selection-toggle-button"
            >
              <Text style={styles.headerActionText}>{selectionToggleLabel}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.gridStage} testID="photo-grid-stage">
        <PhotoGrid
          candidates={displayedCandidates}
          selectedIds={selectedIds}
          selectionMode={isSelectionMode}
          onSelect={onSelect}
          onItemPress={onItemPress}
          theme={theme}
          mediaType="all"
          gridTestID={gridTestID}
          itemTestID={itemTestID}
          contentPadding={gridContentPadding}
          gridLayout={gridLayout}
        />
      </View>

      {isSelectionMode ? (
        <View style={styles.footerShell}>
          <View style={styles.footerCard}>
            <View style={styles.footerSummary}>
              <Text style={styles.footerTitle}>{copy.footerTitle(selectedCount)}</Text>
              <Text style={styles.footerBody}>{footerSizeText}</Text>
            </View>

            <View style={styles.footerActions}>
              <TouchSurface
                style={[styles.footerActionButton, styles.keepButton]}
                pressedStyle={styles.keepButtonPressed}
                onPress={onKeepSelected}
                preset="pill"
                testID="keep-selected-button"
              >
                <Text style={[styles.footerActionText, styles.keepButtonText]}>{keepSelectedLabel}</Text>
              </TouchSurface>

              <TouchSurface
                style={[styles.footerActionButton, styles.cleanupButton]}
                pressedStyle={styles.cleanupButtonPressed}
                onPress={onCleanupSelected}
                preset="pill"
                testID="cleanup-selected-button"
              >
                <Text style={styles.footerActionText}>{cleanupSelectedLabel}</Text>
              </TouchSurface>
            </View>
          </View>
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
      paddingHorizontal: 6,
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
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: isCompact ? 10 : 14,
    },
    footerActionText: {
      color: '#ffffff',
      fontSize: isCompact ? 13 : 15,
      fontWeight: '800',
    },
    keepButton: {
      backgroundColor: theme.buttonSecondaryBackground,
    },
    keepButtonPressed: {
      backgroundColor: theme.cardMutedBorder,
    },
    keepButtonText: {
      color: theme.buttonSecondaryText,
    },
    cleanupButton: {
      backgroundColor: theme.buttonDangerBackground,
    },
    cleanupButtonPressed: {
      backgroundColor: theme.buttonDangerPressedBackground,
    },
  });
}
