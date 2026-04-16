import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { CleanupCandidate } from '../domain/recognition/types';
import type { AppLanguage } from '../i18n/app-language';
import {
  formatLocalizedDateTime,
  formatLocalizedDuration,
  formatLocalizedSize,
  getAppCopy,
  getCandidateTitle,
  getDuplicateRepresentativeComparison,
  getDuplicateRepresentativeReasonLabel,
  getIssueTypeLabel,
  getMediaTypeLabel,
  translateRiskReason,
} from '../i18n/app-copy';
import type { AppThemePalette } from '../theme/app-theme';
import { resolvePreviewPrimaryActionMode } from '../application/media-cleaner-helpers';

interface PreviewModalProps {
  candidate: CleanupCandidate | null;
  language: AppLanguage;
  theme: AppThemePalette;
  visible: boolean;
  mode: 'suggestions' | 'recycle';
  onClose: () => void;
  onPrimaryAction: () => void;
  onHardDelete: () => void;
}

function VideoPreview({ uri, theme }: { uri: string; theme: AppThemePalette }) {
  const player = useVideoPlayer({ uri }, (instance) => {
    instance.loop = true;
    instance.play();
  });
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <VideoView
      player={player}
      nativeControls
      contentFit="contain"
      allowsFullscreen
      style={styles.previewMedia}
    />
  );
}

export function PreviewModal({
  candidate,
  language,
  theme,
  visible,
  mode,
  onClose,
  onPrimaryAction,
  onHardDelete,
}: PreviewModalProps) {
  const copy = getAppCopy(language);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const primaryActionMode = resolvePreviewPrimaryActionMode(mode);

  if (!candidate) {
    return null;
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>{copy.preview.title}</Text>
            <Text style={styles.headerSubtitle}>{copy.preview.subtitle}</Text>
          </View>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>{copy.common.close}</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {candidate.asset.mediaType === 'video' ? (
            <VideoPreview uri={candidate.asset.uri} theme={theme} />
          ) : (
            <Image
              source={{ uri: candidate.asset.uri }}
              contentFit="contain"
              style={styles.previewMedia}
            />
          )}

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>{copy.preview.judgementTitle}</Text>
            <Text style={styles.panelValue}>
              {getCandidateTitle(candidate.kind, language)} · {candidate.score}{' '}
              {copy.candidate.scoreUnit}
            </Text>
            <View style={styles.issueWrap}>
              {candidate.issueTypes.map((issueType) => (
                <View key={issueType} style={styles.issuePill}>
                  <Text style={styles.issueText}>{getIssueTypeLabel(issueType, language)}</Text>
                </View>
              ))}
            </View>
            {candidate.duplicateGroup ? (
              <View style={styles.duplicateStrip}>
                <Text style={styles.duplicateStripText}>
                  {copy.preview.duplicateGroupHint(candidate.duplicateGroup.size - 1)}
                </Text>
                <Text style={styles.duplicateReasonText}>
                  {copy.preview.duplicateRepresentativeTitle}
                  {language === 'zh-CN' ? '：' : ': '}
                  {getDuplicateRepresentativeReasonLabel(
                    candidate.duplicateGroup.representativeReason,
                    language,
                  )}
                </Text>
                <Text style={styles.duplicateDetailText}>
                  {getDuplicateRepresentativeComparison(candidate, language)}
                </Text>
              </View>
            ) : null}
            <View style={styles.reasonWrap}>
              {candidate.reasons.length > 0 ? (
                candidate.reasons.map((reason) => (
                  <View key={reason} style={styles.reasonPill}>
                    <Text style={styles.reasonText}>{translateRiskReason(reason, language)}</Text>
                  </View>
                ))
              ) : (
                <View style={styles.reasonPill}>
                  <Text style={styles.reasonText}>{copy.candidate.noRisk}</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.panel}>
            <Text style={styles.panelTitle}>{copy.preview.mediaInfoTitle}</Text>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>{copy.preview.typeLabel}</Text>
              <Text style={styles.statValue}>{getMediaTypeLabel(candidate.asset.mediaType, language)}</Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>{copy.preview.capturedAtLabel}</Text>
              <Text style={styles.statValue}>
                {formatLocalizedDateTime(candidate.asset.creationTime, language)}
              </Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>{copy.preview.dimensionsLabel}</Text>
              <Text style={styles.statValue}>
                {candidate.asset.width} × {candidate.asset.height}
              </Text>
            </View>
            <View style={styles.statRow}>
              <Text style={styles.statLabel}>{copy.preview.sizeLabel}</Text>
              <Text style={styles.statValue}>
                {formatLocalizedSize(candidate.asset.fileSize, language)}
              </Text>
            </View>
            {candidate.asset.mediaType === 'video' ? (
              <View style={styles.statRow}>
                <Text style={styles.statLabel}>{copy.preview.durationLabel}</Text>
                <Text style={styles.statValue}>
                  {formatLocalizedDuration(candidate.asset.duration, language)}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.actionRow}>
            <Pressable onPress={onPrimaryAction} style={styles.safeActionButton}>
              <Text style={styles.safeActionText}>
                {primaryActionMode === 'restore' ? copy.preview.restore : copy.preview.moveToRecycle}
              </Text>
            </Pressable>
            <Pressable onPress={onHardDelete} style={styles.dangerActionButton}>
              <Text style={styles.dangerActionText}>{copy.preview.deleteForever}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function createStyles(theme: AppThemePalette) {
  return StyleSheet.create({
    container: {
    flex: 1,
    backgroundColor: theme.safeArea,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: theme.pageTextPrimary,
  },
  headerSubtitle: {
    marginTop: 4,
    color: theme.pageTextSecondary,
  },
  closeButton: {
    borderRadius: 999,
    backgroundColor: theme.buttonPrimaryBackground,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  closeButtonText: {
    color: theme.buttonPrimaryText,
    fontWeight: '700',
  },
  content: {
    padding: 20,
    gap: 18,
  },
  previewMedia: {
    width: '100%',
    aspectRatio: 0.9,
    borderRadius: 28,
    backgroundColor: theme.previewBackground,
    overflow: 'hidden',
  },
  panel: {
    borderRadius: 26,
    padding: 18,
    backgroundColor: theme.cardBackground,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    gap: 12,
  },
  panelTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.pageTextPrimary,
  },
  panelValue: {
    fontSize: 16,
    color: theme.pageTextPrimary,
    fontWeight: '600',
  },
  issueWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  issuePill: {
    borderRadius: 999,
    backgroundColor: theme.chipActiveBackground,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  issueText: {
    color: theme.chipActiveText,
    fontWeight: '700',
    fontSize: 12,
  },
  duplicateStrip: {
    borderRadius: 16,
    backgroundColor: theme.cardMutedBackground,
    borderWidth: 1,
    borderColor: theme.cardMutedBorder,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  duplicateStripText: {
    color: theme.pageTextSecondary,
    lineHeight: 20,
  },
  duplicateReasonText: {
    color: theme.pageTextPrimary,
    fontWeight: '600',
    lineHeight: 20,
  },
  duplicateDetailText: {
    color: theme.pageTextSecondary,
    lineHeight: 20,
  },
  reasonWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reasonPill: {
    borderRadius: 999,
    backgroundColor: theme.chipBackground,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  reasonText: {
    color: theme.chipText,
    fontWeight: '700',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  statLabel: {
    color: theme.pageTextMuted,
    fontSize: 14,
  },
  statValue: {
    flex: 1,
    textAlign: 'right',
    color: theme.pageTextPrimary,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  safeActionButton: {
    flex: 1,
    borderRadius: 999,
    backgroundColor: theme.buttonPrimaryBackground,
    paddingHorizontal: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  safeActionText: {
    color: theme.buttonPrimaryText,
    fontWeight: '800',
  },
  dangerActionButton: {
    flex: 1,
    borderRadius: 999,
    backgroundColor: theme.buttonDangerBackground,
    paddingHorizontal: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  dangerActionText: {
    color: theme.buttonDangerText,
    fontWeight: '800',
  },
  });
}
