import { Image } from 'expo-image';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import type { CleanupCandidate } from '../domain/recognition/types';
import type { AppLanguage } from '../i18n/app-language';
import {
  formatLocalizedDuration,
  formatLocalizedSize,
  getAppCopy,
  getCandidateDisplayTitle,
  getConfidenceLabel,
  getDuplicateCardSummary,
  getIssueTypeLabel,
  translateRiskReason,
} from '../i18n/app-copy';
import type { AppThemePalette } from '../theme/app-theme';
import { COMPONENT_TOKENS } from '../theme/generated/component-tokens.generated';
import { buildOrientedImageFrameStyle, buildSizedImageSource } from './components/image-source';
import { Badge, Button, Card, Text, TouchSurface } from './primitives';

export const CANDIDATE_CARD_STYLE_TOKENS = COMPONENT_TOKENS.candidateCard;

interface CandidateCardProps {
  candidate: CleanupCandidate;
  language: AppLanguage;
  theme: AppThemePalette;
  selected: boolean;
  mode: 'suggestions' | 'recycle';
  onOpen: () => void;
  onToggleSelect: () => void;
}

export function CandidateCard({
  candidate,
  language,
  theme,
  selected,
  mode,
  onOpen,
  onToggleSelect,
}: CandidateCardProps) {
  const copy = getAppCopy(language);
  const title = getCandidateDisplayTitle(candidate, language);
  const duplicateSummary = getDuplicateCardSummary(candidate, language);
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <Card
      variant={mode === 'recycle' ? 'muted' : 'default'}
      theme={theme}
      style={[styles.card, mode === 'recycle' && styles.recycleCard]}
      testID="candidate-card"
    >
      <TouchSurface onPress={onOpen} preset="tile" style={styles.hero} testID="candidate-card-hero">
        <Image
          source={buildSizedImageSource(
            candidate.asset.previewUri ?? candidate.asset.uri,
            CANDIDATE_CARD_STYLE_TOKENS.layout.thumbnailSize,
            CANDIDATE_CARD_STYLE_TOKENS.layout.thumbnailSize,
          )}
          style={[
            styles.thumbnail,
            buildOrientedImageFrameStyle(
              CANDIDATE_CARD_STYLE_TOKENS.layout.thumbnailSize,
              CANDIDATE_CARD_STYLE_TOKENS.layout.thumbnailSize,
              candidate.asset.orientation,
            ),
          ]}
          contentFit="cover"
          allowDownscaling
          decodeFormat="rgb"
          testID="candidate-card-thumbnail"
        />
        <View style={styles.body}>
          <View style={styles.headerRow}>
            <View style={styles.headerText}>
              <Text variant="title" theme={theme} style={styles.title}>{title}</Text>
              <Text variant="caption" theme={theme} style={styles.subtitle}>
                {getConfidenceLabel(candidate.confidence, language)} · {candidate.score}{' '}
                {copy.candidate.scoreUnit}
              </Text>
            </View>
            <Badge
              variant="secondary"
              theme={theme}
              style={[styles.scoreBadge, selected && styles.scoreBadgeSelected]}
              textStyle={[styles.scoreBadgeText, selected && styles.scoreBadgeTextSelected]}
            >
              {selected ? copy.candidate.selected : copy.candidate.actionable}
            </Badge>
          </View>
          <Text variant="caption" theme={theme} style={styles.meta}>
            {candidate.asset.mediaType === 'video'
              ? formatLocalizedDuration(candidate.asset.duration, language)
              : `${candidate.asset.width} × ${candidate.asset.height}`}{' '}
            · {formatLocalizedSize(candidate.asset.fileSize, language)}
          </Text>
          <View style={styles.issueWrap}>
            {candidate.issueTypes.map((issueType) => (
              <Badge
                key={issueType}
                variant="secondary"
                theme={theme}
                style={styles.issuePill}
                textStyle={styles.issueText}
              >
                {getIssueTypeLabel(issueType, language)}
              </Badge>
            ))}
          </View>
          <View style={styles.reasonWrap}>
            {candidate.reasons.length > 0 ? (
              candidate.reasons.slice(0, CANDIDATE_CARD_STYLE_TOKENS.layout.reasonLimit).map((reason) => (
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
          {duplicateSummary ? (
            <Text variant="caption" theme={theme} style={styles.duplicateSummaryText}>{duplicateSummary}</Text>
          ) : null}
        </View>
      </TouchSurface>

      <View style={styles.footer}>
        <Text variant="caption" theme={theme} style={styles.footerText}>
          {mode === 'recycle' ? copy.candidate.recycleHint : copy.candidate.previewHint}
        </Text>
        <Button
          variant={selected ? 'primary' : 'secondary'}
          theme={theme}
          onPress={onToggleSelect}
          style={[styles.actionButton, selected && styles.actionButtonSelected]}
          textStyle={[styles.actionButtonText, selected && styles.actionButtonTextSelected]}
          testID="candidate-card-action"
        >
          {selected ? copy.candidate.unselect : copy.candidate.addAction}
        </Button>
      </View>
    </Card>
  );
}

function createStyles(theme: AppThemePalette) {
  return StyleSheet.create({
    card: {
      borderRadius: CANDIDATE_CARD_STYLE_TOKENS.layout.cardRadius,
      backgroundColor: theme.cardBackground,
      borderWidth: CANDIDATE_CARD_STYLE_TOKENS.layout.cardBorderWidth,
      borderColor: theme.cardBorder,
      padding: CANDIDATE_CARD_STYLE_TOKENS.layout.cardPadding,
      gap: CANDIDATE_CARD_STYLE_TOKENS.layout.cardGap,
      shadowColor: theme.shadowColor,
      shadowOpacity: CANDIDATE_CARD_STYLE_TOKENS.layout.shadowOpacity,
      shadowRadius: CANDIDATE_CARD_STYLE_TOKENS.layout.shadowRadius,
      shadowOffset: { width: 0, height: CANDIDATE_CARD_STYLE_TOKENS.layout.shadowOffsetY },
      elevation: CANDIDATE_CARD_STYLE_TOKENS.layout.elevation,
    },
    recycleCard: {
      backgroundColor: theme.cardMutedBackground,
      borderColor: theme.cardMutedBorder,
    },
    hero: {
      flexDirection: 'row',
      gap: CANDIDATE_CARD_STYLE_TOKENS.layout.heroGap,
    },
    thumbnail: {
      width: CANDIDATE_CARD_STYLE_TOKENS.layout.thumbnailSize,
      height: CANDIDATE_CARD_STYLE_TOKENS.layout.thumbnailSize,
      borderRadius: CANDIDATE_CARD_STYLE_TOKENS.layout.thumbnailRadius,
      backgroundColor: theme.thumbnailBackground,
    },
    body: {
      flex: 1,
      gap: CANDIDATE_CARD_STYLE_TOKENS.layout.bodyGap,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: CANDIDATE_CARD_STYLE_TOKENS.layout.headerGap,
    },
    headerText: {
      flex: 1,
      gap: CANDIDATE_CARD_STYLE_TOKENS.layout.headerTextGap,
    },
    title: {
      fontSize: CANDIDATE_CARD_STYLE_TOKENS.typography.titleSize,
      fontWeight: CANDIDATE_CARD_STYLE_TOKENS.typography.titleWeight,
      color: theme.pageTextPrimary,
    },
    subtitle: {
      fontSize: CANDIDATE_CARD_STYLE_TOKENS.typography.subtitleSize,
      color: theme.pageTextSecondary,
    },
    scoreBadge: {
      alignSelf: 'flex-start',
      borderRadius: CANDIDATE_CARD_STYLE_TOKENS.pill.radius,
      paddingHorizontal: CANDIDATE_CARD_STYLE_TOKENS.pill.paddingHorizontal,
      paddingVertical: CANDIDATE_CARD_STYLE_TOKENS.pill.paddingVertical,
      backgroundColor: theme.chipBackground,
      borderWidth: CANDIDATE_CARD_STYLE_TOKENS.pill.borderWidth,
    },
    scoreBadgeSelected: {
      backgroundColor: theme.chipActiveBackground,
    },
    scoreBadgeText: {
      color: theme.chipText,
      fontSize: CANDIDATE_CARD_STYLE_TOKENS.typography.badgeSize,
      fontWeight: CANDIDATE_CARD_STYLE_TOKENS.typography.badgeWeight,
    },
    scoreBadgeTextSelected: {
      color: theme.chipActiveText,
    },
    meta: {
      fontSize: CANDIDATE_CARD_STYLE_TOKENS.typography.metaSize,
      color: theme.pageTextMuted,
    },
    reasonWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: CANDIDATE_CARD_STYLE_TOKENS.layout.pillGap,
    },
    issueWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: CANDIDATE_CARD_STYLE_TOKENS.layout.pillGap,
    },
    issuePill: {
      borderRadius: CANDIDATE_CARD_STYLE_TOKENS.pill.radius,
      paddingHorizontal: CANDIDATE_CARD_STYLE_TOKENS.pill.paddingHorizontal,
      paddingVertical: CANDIDATE_CARD_STYLE_TOKENS.pill.paddingVertical,
      backgroundColor: theme.chipActiveBackground,
      borderWidth: CANDIDATE_CARD_STYLE_TOKENS.pill.borderWidth,
    },
    issueText: {
      color: theme.chipActiveText,
      fontSize: CANDIDATE_CARD_STYLE_TOKENS.typography.issueSize,
      fontWeight: CANDIDATE_CARD_STYLE_TOKENS.typography.issueWeight,
    },
    reasonPill: {
      borderRadius: CANDIDATE_CARD_STYLE_TOKENS.pill.radius,
      paddingHorizontal: CANDIDATE_CARD_STYLE_TOKENS.pill.paddingHorizontal,
      paddingVertical: CANDIDATE_CARD_STYLE_TOKENS.pill.paddingVertical,
      backgroundColor: theme.chipBackground,
      borderWidth: CANDIDATE_CARD_STYLE_TOKENS.pill.borderWidth,
    },
    reasonText: {
      color: theme.chipText,
      fontSize: CANDIDATE_CARD_STYLE_TOKENS.typography.reasonSize,
      fontWeight: CANDIDATE_CARD_STYLE_TOKENS.typography.reasonWeight,
    },
    duplicateSummaryText: {
      fontSize: CANDIDATE_CARD_STYLE_TOKENS.typography.duplicateSummarySize,
      lineHeight: CANDIDATE_CARD_STYLE_TOKENS.typography.duplicateSummaryLineHeight,
      color: theme.pageTextSecondary,
      fontWeight: CANDIDATE_CARD_STYLE_TOKENS.typography.duplicateSummaryWeight,
    },
    footer: {
      gap: CANDIDATE_CARD_STYLE_TOKENS.layout.footerGap,
    },
    footerText: {
      fontSize: CANDIDATE_CARD_STYLE_TOKENS.typography.footerSize,
      lineHeight: CANDIDATE_CARD_STYLE_TOKENS.typography.footerLineHeight,
      color: theme.pageTextSecondary,
    },
    actionButton: {
      alignSelf: 'flex-start',
      minHeight: CANDIDATE_CARD_STYLE_TOKENS.actionButton.minHeight,
      borderRadius: CANDIDATE_CARD_STYLE_TOKENS.actionButton.radius,
      paddingHorizontal: CANDIDATE_CARD_STYLE_TOKENS.actionButton.paddingHorizontal,
      paddingVertical: CANDIDATE_CARD_STYLE_TOKENS.actionButton.paddingVertical,
      backgroundColor: theme.buttonSecondaryBackground,
    },
    actionButtonSelected: {
      backgroundColor: theme.buttonPrimaryBackground,
    },
    actionButtonText: {
      fontSize: CANDIDATE_CARD_STYLE_TOKENS.typography.actionSize,
      fontWeight: CANDIDATE_CARD_STYLE_TOKENS.typography.actionWeight,
      color: theme.buttonSecondaryText,
    },
    actionButtonTextSelected: {
      color: theme.buttonPrimaryText,
    },
  });
}
