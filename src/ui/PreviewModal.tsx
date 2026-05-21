import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useMemo } from 'react';
import { Dimensions, Modal, ScrollView, StyleSheet, View } from 'react-native';

import type { CleanupCandidate } from '../domain/recognition/types';
import type { AppLanguage } from '../i18n/app-language';
import {
  formatLocalizedDateTime,
  formatLocalizedDuration,
  formatLocalizedSize,
  getAppCopy,
  getCandidateDisplayTitle,
  getDuplicateRepresentativeComparison,
  getDuplicateRepresentativeReasonLabel,
  getIssueTypeLabel,
  getMediaTypeLabel,
  translateRiskReason,
} from '../i18n/app-copy';
import type { AppThemePalette } from '../theme/app-theme';
import { resolvePreviewPrimaryActionMode } from '../application/media-cleaner-helpers';
import { buildOrientedImageFrameStyle, buildSizedImageSource } from './components/image-source';
import { COMPONENT_TOKENS } from '../theme/generated/component-tokens.generated';
import { Badge, Button, Card, MediaFrame, Text } from './primitives';

export const PREVIEW_MODAL_STYLE_TOKENS = COMPONENT_TOKENS.previewModal;

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
      fullscreenOptions={{ enable: true }}
      style={styles.previewMediaContent}
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
  const previewWidth = Math.max(
    Dimensions.get('window').width - PREVIEW_MODAL_STYLE_TOKENS.layout.previewHorizontalInset,
    PREVIEW_MODAL_STYLE_TOKENS.layout.previewMinSize,
  );
  const previewHeight = Math.max(
    Math.round(previewWidth * PREVIEW_MODAL_STYLE_TOKENS.layout.previewAspectRatio),
    PREVIEW_MODAL_STYLE_TOKENS.layout.previewMinSize,
  );

  if (!candidate) {
    return null;
  }

  const previewImageFrameStyle = buildOrientedImageFrameStyle(
    previewWidth,
    previewHeight,
    candidate.asset.orientation,
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View testID="preview-modal-container" style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>{copy.preview.title}</Text>
            <Text style={styles.headerSubtitle}>{copy.preview.subtitle}</Text>
          </View>
          <Button
            testID="preview-modal-close"
            onPress={onClose}
            variant="primary"
            theme={theme}
            style={styles.closeButton}
            textStyle={styles.closeButtonText}
          >
            {copy.common.close}
          </Button>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <MediaFrame testID="preview-modal-media" theme={theme} style={styles.previewMedia}>
            {candidate.asset.mediaType === 'video' ? (
              <VideoPreview uri={candidate.asset.uri} theme={theme} />
            ) : (
              <Image
                source={buildSizedImageSource(
                  candidate.asset.uri,
                  previewImageFrameStyle.width,
                  previewImageFrameStyle.height,
                )}
                contentFit="contain"
                style={[styles.previewMediaContent, previewImageFrameStyle]}
                allowDownscaling
              />
            )}
          </MediaFrame>

          <Card testID="preview-modal-judgement-panel" theme={theme} style={styles.panel}>
            <Text variant="title" theme={theme} style={styles.panelTitle}>{copy.preview.judgementTitle}</Text>
            <Text variant="body" theme={theme} style={styles.panelValue}>
              {getCandidateDisplayTitle(candidate, language)} · {candidate.score}{' '}
              {copy.candidate.scoreUnit}
            </Text>
            <View style={styles.issueWrap}>
              {candidate.issueTypes.map((issueType) => (
                <Badge
                  key={issueType}
                  variant="default"
                  theme={theme}
                  style={styles.issuePill}
                  textStyle={styles.issueText}
                >
                  {getIssueTypeLabel(issueType, language)}
                </Badge>
              ))}
            </View>
            {candidate.duplicateGroup ? (
              <Card variant="muted" theme={theme} style={styles.duplicateStrip}>
                <Text variant="body" tone="secondary" theme={theme} style={styles.duplicateStripText}>
                  {copy.preview.duplicateGroupHint(candidate.duplicateGroup.size - 1)}
                </Text>
                <Text variant="body" theme={theme} style={styles.duplicateReasonText}>
                  {copy.preview.duplicateRepresentativeTitle}
                  {language === 'zh-CN' ? '：' : ': '}
                  {getDuplicateRepresentativeReasonLabel(
                    candidate.duplicateGroup.representativeReason,
                    language,
                  )}
                </Text>
                <Text variant="body" tone="secondary" theme={theme} style={styles.duplicateDetailText}>
                  {getDuplicateRepresentativeComparison(candidate, language)}
                </Text>
              </Card>
            ) : null}
            <View style={styles.reasonWrap}>
              {candidate.reasons.length > 0 ? (
                candidate.reasons.map((reason) => (
                  <Badge
                    key={reason}
                    variant="secondary"
                    theme={theme}
                    style={styles.reasonPill}
                    textStyle={styles.reasonText}
                  >
                    {translateRiskReason(reason, language)}
                  </Badge>
                ))
              ) : (
                <Badge
                  variant="secondary"
                  theme={theme}
                  style={styles.reasonPill}
                  textStyle={styles.reasonText}
                >
                  {copy.candidate.noRisk}
                </Badge>
              )}
            </View>
          </Card>

          <Card theme={theme} style={styles.panel}>
            <Text variant="title" theme={theme} style={styles.panelTitle}>{copy.preview.mediaInfoTitle}</Text>
            <View style={styles.statRow}>
              <Text variant="caption" tone="muted" theme={theme} style={styles.statLabel}>{copy.preview.typeLabel}</Text>
              <Text variant="body" theme={theme} style={styles.statValue}>{getMediaTypeLabel(candidate.asset.mediaType, language)}</Text>
            </View>
            <View style={styles.statRow}>
              <Text variant="caption" tone="muted" theme={theme} style={styles.statLabel}>{copy.preview.capturedAtLabel}</Text>
              <Text variant="body" theme={theme} style={styles.statValue}>
                {formatLocalizedDateTime(candidate.asset.creationTime, language)}
              </Text>
            </View>
            <View style={styles.statRow}>
              <Text variant="caption" tone="muted" theme={theme} style={styles.statLabel}>{copy.preview.dimensionsLabel}</Text>
              <Text variant="body" theme={theme} style={styles.statValue}>
                {candidate.asset.width} × {candidate.asset.height}
              </Text>
            </View>
            <View style={styles.statRow}>
              <Text variant="caption" tone="muted" theme={theme} style={styles.statLabel}>{copy.preview.sizeLabel}</Text>
              <Text variant="body" theme={theme} style={styles.statValue}>
                {formatLocalizedSize(candidate.asset.fileSize, language)}
              </Text>
            </View>
            {candidate.asset.mediaType === 'video' ? (
              <View style={styles.statRow}>
                <Text variant="caption" tone="muted" theme={theme} style={styles.statLabel}>{copy.preview.durationLabel}</Text>
                <Text variant="body" theme={theme} style={styles.statValue}>
                  {formatLocalizedDuration(candidate.asset.duration, language)}
                </Text>
              </View>
            ) : null}
          </Card>

          <View style={styles.actionRow}>
            <Button
              testID="preview-modal-primary-action"
              onPress={onPrimaryAction}
              variant="primary"
              theme={theme}
              style={styles.safeActionButton}
              textStyle={styles.safeActionText}
            >
              {primaryActionMode === 'restore' ? copy.preview.restore : copy.preview.moveToRecycle}
            </Button>
            <Button
              testID="preview-modal-hard-delete"
              onPress={onHardDelete}
              variant="danger"
              theme={theme}
              style={styles.dangerActionButton}
              textStyle={styles.dangerActionText}
            >
              {copy.preview.deleteForever}
            </Button>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function createStyles(theme: AppThemePalette) {
  const tokens = PREVIEW_MODAL_STYLE_TOKENS;

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.safeArea,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: tokens.layout.headerPaddingHorizontal,
      paddingTop: tokens.layout.headerPaddingTop,
      paddingBottom: tokens.layout.headerPaddingBottom,
    },
    headerTitle: {
      fontSize: tokens.typography.headerTitleSize,
      fontWeight: tokens.typography.headerTitleWeight,
      color: theme.pageTextPrimary,
    },
    headerSubtitle: {
      marginTop: tokens.layout.headerSubtitleMarginTop,
      color: theme.pageTextSecondary,
    },
    closeButton: {
      borderRadius: tokens.radius.button,
      backgroundColor: theme.buttonPrimaryBackground,
      paddingHorizontal: tokens.button.closePaddingHorizontal,
      paddingVertical: tokens.button.closePaddingVertical,
    },
    closeButtonText: {
      color: theme.buttonPrimaryText,
      fontWeight: tokens.typography.closeButtonWeight,
    },
    content: {
      padding: tokens.layout.contentPadding,
      gap: tokens.layout.contentGap,
    },
    previewMedia: {
      width: '100%',
      aspectRatio: tokens.layout.previewAspectRatio,
      borderRadius: tokens.radius.media,
      backgroundColor: theme.previewBackground,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    previewMediaContent: {
      width: '100%',
      height: '100%',
    },
    panel: {
      borderRadius: tokens.radius.panel,
      padding: tokens.layout.panelPadding,
      backgroundColor: theme.cardBackground,
      borderWidth: tokens.border.panelWidth,
      borderColor: theme.cardBorder,
      gap: tokens.layout.panelGap,
    },
    panelTitle: {
      fontSize: tokens.typography.panelTitleSize,
      fontWeight: tokens.typography.panelTitleWeight,
      color: theme.pageTextPrimary,
    },
    panelValue: {
      fontSize: tokens.typography.panelValueSize,
      color: theme.pageTextPrimary,
      fontWeight: tokens.typography.panelValueWeight,
    },
    issueWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: tokens.layout.issueGap,
    },
    issuePill: {
      borderRadius: tokens.radius.pill,
      backgroundColor: theme.chipActiveBackground,
      paddingHorizontal: tokens.pill.paddingHorizontal,
      paddingVertical: tokens.pill.paddingVertical,
    },
    issueText: {
      color: theme.chipActiveText,
      fontWeight: tokens.typography.pillWeight,
      fontSize: tokens.typography.pillSize,
    },
    duplicateStrip: {
      borderRadius: tokens.radius.duplicateStrip,
      backgroundColor: theme.cardMutedBackground,
      borderWidth: tokens.border.duplicateStripWidth,
      borderColor: theme.cardMutedBorder,
      paddingHorizontal: tokens.duplicateStrip.paddingHorizontal,
      paddingVertical: tokens.duplicateStrip.paddingVertical,
    },
    duplicateStripText: {
      color: theme.pageTextSecondary,
      lineHeight: tokens.duplicateStrip.lineHeight,
    },
    duplicateReasonText: {
      color: theme.pageTextPrimary,
      fontWeight: tokens.typography.duplicateReasonWeight,
      lineHeight: tokens.duplicateStrip.lineHeight,
    },
    duplicateDetailText: {
      color: theme.pageTextSecondary,
      lineHeight: tokens.duplicateStrip.lineHeight,
    },
    reasonWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: tokens.layout.reasonGap,
    },
    reasonPill: {
      borderRadius: tokens.radius.pill,
      backgroundColor: theme.chipBackground,
      paddingHorizontal: tokens.pill.paddingHorizontal,
      paddingVertical: tokens.pill.paddingVertical,
    },
    reasonText: {
      color: theme.chipText,
      fontWeight: tokens.typography.pillWeight,
      fontSize: tokens.typography.pillSize,
    },
    statRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: tokens.layout.statGap,
    },
    statLabel: {
      color: theme.pageTextMuted,
      fontSize: tokens.typography.statLabelSize,
    },
    statValue: {
      flex: 1,
      textAlign: 'right',
      color: theme.pageTextPrimary,
      fontWeight: tokens.typography.statValueWeight,
    },
    actionRow: {
      flexDirection: 'row',
      gap: tokens.layout.actionGap,
    },
    safeActionButton: {
      flex: 1,
      borderRadius: tokens.radius.button,
      backgroundColor: theme.buttonPrimaryBackground,
      paddingHorizontal: tokens.button.actionPaddingHorizontal,
      paddingVertical: tokens.button.actionPaddingVertical,
      alignItems: 'center',
    },
    safeActionText: {
      color: theme.buttonPrimaryText,
      fontWeight: tokens.typography.actionWeight,
    },
    dangerActionButton: {
      flex: 1,
      borderRadius: tokens.radius.button,
      backgroundColor: theme.buttonDangerBackground,
      paddingHorizontal: tokens.button.actionPaddingHorizontal,
      paddingVertical: tokens.button.actionPaddingVertical,
      alignItems: 'center',
    },
    dangerActionText: {
      color: theme.buttonDangerText,
      fontWeight: tokens.typography.actionWeight,
    },
  });
}
