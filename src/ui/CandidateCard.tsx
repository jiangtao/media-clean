import { Image } from 'expo-image';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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
import { buildSizedImageSource } from './components/image-source';

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
    <View style={[styles.card, mode === 'recycle' && styles.recycleCard]}>
      <Pressable onPress={onOpen} style={styles.hero}>
        <Image
          source={buildSizedImageSource(candidate.asset.previewUri ?? candidate.asset.uri, 92, 92)}
          style={styles.thumbnail}
          contentFit="cover"
          allowDownscaling
          decodeFormat="rgb"
        />
        <View style={styles.body}>
          <View style={styles.headerRow}>
            <View style={styles.headerText}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>
                {getConfidenceLabel(candidate.confidence, language)} · {candidate.score}{' '}
                {copy.candidate.scoreUnit}
              </Text>
            </View>
            <View style={[styles.scoreBadge, selected && styles.scoreBadgeSelected]}>
              <Text style={[styles.scoreBadgeText, selected && styles.scoreBadgeTextSelected]}>
                {selected ? copy.candidate.selected : copy.candidate.actionable}
              </Text>
            </View>
          </View>
          <Text style={styles.meta}>
            {candidate.asset.mediaType === 'video'
              ? formatLocalizedDuration(candidate.asset.duration, language)
              : `${candidate.asset.width} × ${candidate.asset.height}`}{' '}
            · {formatLocalizedSize(candidate.asset.fileSize, language)}
          </Text>
          <View style={styles.issueWrap}>
            {candidate.issueTypes.map((issueType) => (
              <View key={issueType} style={styles.issuePill}>
                <Text style={styles.issueText}>{getIssueTypeLabel(issueType, language)}</Text>
              </View>
            ))}
          </View>
          <View style={styles.reasonWrap}>
            {candidate.reasons.length > 0 ? (
              candidate.reasons.slice(0, 3).map((reason) => (
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
          {duplicateSummary ? (
            <Text style={styles.duplicateSummaryText}>{duplicateSummary}</Text>
          ) : null}
        </View>
      </Pressable>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {mode === 'recycle' ? copy.candidate.recycleHint : copy.candidate.previewHint}
        </Text>
        <Pressable
          onPress={onToggleSelect}
          style={[styles.actionButton, selected && styles.actionButtonSelected]}
        >
          <Text style={[styles.actionButtonText, selected && styles.actionButtonTextSelected]}>
            {selected ? copy.candidate.unselect : copy.candidate.addAction}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function createStyles(theme: AppThemePalette) {
  return StyleSheet.create({
    card: {
    borderRadius: 28,
    backgroundColor: theme.cardBackground,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    padding: 16,
    gap: 14,
    shadowColor: theme.shadowColor,
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4,
  },
  recycleCard: {
    backgroundColor: theme.cardMutedBackground,
    borderColor: theme.cardMutedBorder,
  },
  hero: {
    flexDirection: 'row',
    gap: 14,
  },
  thumbnail: {
    width: 92,
    height: 92,
    borderRadius: 22,
    backgroundColor: theme.thumbnailBackground,
  },
  body: {
    flex: 1,
    gap: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.pageTextPrimary,
  },
  subtitle: {
    fontSize: 13,
    color: theme.pageTextSecondary,
  },
  scoreBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: theme.chipBackground,
  },
  scoreBadgeSelected: {
    backgroundColor: theme.chipActiveBackground,
  },
  scoreBadgeText: {
    color: theme.chipText,
    fontSize: 12,
    fontWeight: '700',
  },
  scoreBadgeTextSelected: {
    color: theme.chipActiveText,
  },
  meta: {
    fontSize: 12,
    color: theme.pageTextMuted,
  },
  reasonWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  issueWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  issuePill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: theme.chipActiveBackground,
  },
  issueText: {
    color: theme.chipActiveText,
    fontSize: 12,
    fontWeight: '700',
  },
  reasonPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: theme.chipBackground,
  },
  reasonText: {
    color: theme.chipText,
    fontSize: 12,
    fontWeight: '600',
  },
  duplicateSummaryText: {
    fontSize: 12,
    lineHeight: 18,
    color: theme.pageTextSecondary,
    fontWeight: '600',
  },
  footer: {
    gap: 10,
  },
  footerText: {
    fontSize: 13,
    lineHeight: 18,
    color: theme.pageTextSecondary,
  },
  actionButton: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: theme.buttonSecondaryBackground,
  },
  actionButtonSelected: {
    backgroundColor: theme.buttonPrimaryBackground,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.buttonSecondaryText,
  },
  actionButtonTextSelected: {
    color: theme.buttonPrimaryText,
  },
  });
}
