import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text as RNText, View } from 'react-native';

import { AppIcon } from '../../icons/AppIcon';
import { DesignIcon, SvgProcessRing, type DesignIconName } from '../../icons/DesignIcon';
import { getAppTheme, type AppThemePalette } from '../../../theme/app-theme';
import { COMPONENT_TOKENS } from '../../../theme/generated/component-tokens.generated';
import type { AppLanguage } from '../../../i18n/app-language';
import { getAppCopy } from '../../../i18n/app-copy';
import { Text } from '../../primitives';

type PhotoGridEntryCardVariant =
  | 'loading'
  | 'permissionDenied'
  | 'scanReady'
  | 'scanning'
  | 'recognizing'
  | 'scanResult'
  | 'scanEmpty'
  | 'scanAllComplete';

type ResultBreakdownItem = {
  key: 'blurry' | 'duplicate' | 'similar';
  label: string;
  count: number;
};

interface PhotoGridEntryCardProps {
  variant: PhotoGridEntryCardVariant;
  eyebrow?: string | null;
  title: string;
  body?: string | null;
  note?: string | null;
  actionLabel?: string | null;
  onAction?: () => void;
  actionDisabled?: boolean;
  actionTestID?: string;
  rootTestID?: string;
  titleTestID?: string;
  progress?: {
    current: number;
    total: number;
  } | null;
  currentFileName?: string | null;
  resultsCount?: number;
  isScanning?: boolean;
  onCancelScan?: () => void;
  theme?: AppThemePalette;
  language?: AppLanguage;
  resultBreakdown?: readonly ResultBreakdownItem[];
  onResultBreakdownPress?: (key: ResultBreakdownItem['key']) => void;
  compact?: boolean;
}

const DEFAULT_ENTRY_CARD_THEME = getAppTheme('light');
export const PHOTO_GRID_ENTRY_CARD_STYLE_TOKENS = COMPONENT_TOKENS.photoGrid.entryCard;

export function PhotoGridEntryCard({
  variant,
  eyebrow,
  title,
  body,
  note,
  actionLabel,
  onAction,
  actionDisabled = false,
  actionTestID,
  rootTestID,
  titleTestID,
  progress,
  theme,
  language = 'zh-CN',
  resultBreakdown,
  onResultBreakdownPress,
  compact = false,
}: PhotoGridEntryCardProps) {
  const resolvedTheme = theme ?? DEFAULT_ENTRY_CARD_THEME;
  const metrics = useMemo(() => createCardMetrics(compact), [compact]);
  const styles = useMemo(() => createCardStyles(resolvedTheme, metrics), [metrics, resolvedTheme]);
  const copy = useMemo(() => getAppCopy(language).screens.photoGrid, [language]);
  const accentColor = resolvedTheme.buttonPrimaryBackground;
  const successColor = resolvedTheme.buttonSuccessBackground;
  const progressPercent =
    progress && progress.total > 0
      ? Math.min(Math.round((progress.current / progress.total) * 100), 100)
      : 0;
  const breakdownItems = resultBreakdown ?? [];
  const heroIconScale = variant === 'scanReady' ? 1.5 : 1;
  const heroIconSize = Math.round(metrics.entryArtworkIcon * heroIconScale);

  if (variant === 'scanResult') {
    return (
      <View style={styles.wrapper} testID={rootTestID}>
        <StageFrame styles={styles} style={styles.resultShell}>
          <View style={styles.resultHero}>
            <View style={[styles.sparkle, styles.sparkleLeftTop]} />
            <View style={[styles.sparkle, styles.sparkleRightTop]} />
            <View style={[styles.sparkle, styles.sparkleLeftBottom]} />
            <View style={[styles.sparkle, styles.sparkleRightBottom]} />
            <View style={styles.resultBadge}>
              <DesignIcon
                name="check"
                width={metrics.resultBadgeIcon}
                height={metrics.resultBadgeIcon}
                color={successColor}
                testID="photo-grid-result-check-icon"
              />
            </View>
          </View>

          <View style={styles.resultCopy}>
            <RNText style={styles.resultTitle} testID={titleTestID}>
              {title}
            </RNText>
            {body ? <Text style={styles.resultSubtitle}>{body}</Text> : null}
          </View>

          <View style={styles.breakdownList} testID="photo-grid-scan-summary">
            {breakdownItems.map((item) => {
              const CardComponent = onResultBreakdownPress ? Pressable : View;
              return (
                <CardComponent
                  key={item.key}
                  onPress={
                    onResultBreakdownPress ? () => onResultBreakdownPress(item.key) : undefined
                  }
                  style={styles.breakdownCard}
                  testID={`photo-grid-result-breakdown-${item.key}`}
                >
                  <View
                    style={[
                      styles.breakdownIconShell,
                      { backgroundColor: resolveBreakdownIconBackground(item.key) },
                    ]}
                    testID={`photo-grid-result-breakdown-${item.key}-icon-shell`}
                  >
                    <DesignIcon
                      name={resolveBreakdownIcon(item.key)}
                      width={metrics.breakdownIcon}
                      height={metrics.breakdownIcon}
                      color={resolveBreakdownColor(item.key)}
                      secondaryColor={resolvedTheme.buttonPrimaryText}
                    />
                  </View>
                  <View style={styles.breakdownCopy}>
                    <Text style={styles.breakdownLabel}>{item.label}</Text>
                    <Text style={styles.breakdownCount}>{`${item.count} ${copy.entryUnit}`}</Text>
                  </View>
                  <AppIcon
                    name="chevron-forward"
                    size={metrics.chevronIcon}
                    color={resolvedTheme.pageTextMuted}
                  />
                </CardComponent>
              );
            })}
          </View>

          {actionLabel ? (
            <Pressable
              style={[styles.secondaryAction, actionDisabled && styles.buttonDisabled]}
              onPress={onAction}
              disabled={actionDisabled}
              testID={actionTestID}
            >
              <Text style={styles.secondaryActionText}>{actionLabel}</Text>
            </Pressable>
          ) : null}

          {note ? (
            <View style={styles.supportPill}>
              <DesignIcon name="check" width={16} height={16} color={accentColor} />
              <Text style={styles.supportText}>{note}</Text>
            </View>
          ) : null}
        </StageFrame>
      </View>
    );
  }

  if (variant === 'scanning' || variant === 'recognizing') {
    return (
      <View style={styles.wrapper} testID={rootTestID}>
        <StageFrame styles={styles}>
          <View style={styles.statusCard}>
          <View style={styles.statusIconShell}>
            <DesignIcon
              name="check"
              width={metrics.statusIcon}
              height={metrics.statusIcon}
              color={successColor}
            />
          </View>
          <View style={styles.statusCopy}>
            <Text style={styles.statusTitle}>{copy.entryPermissionGrantedTitle}</Text>
            <Text style={styles.statusSubtitle}>{copy.entryPermissionGrantedBody}</Text>
          </View>
          </View>

          <View style={styles.progressHeroCard}>
          <View style={styles.progressRingWrap}>
            <SvgProcessRing
              size={metrics.progressCircleSize}
              progress={progressPercent}
              color={accentColor}
              trackColor={
                resolvedTheme.scheme === 'dark'
                  ? PHOTO_GRID_ENTRY_CARD_STYLE_TOKENS.color.progressTrackDark
                  : PHOTO_GRID_ENTRY_CARD_STYLE_TOKENS.color.progressTrackLight
              }
              strokeWidth={metrics.progressCircleBorder}
              testID="photo-grid-circular-progress"
            >
              <Text style={styles.progressPercent}>
                {progressPercent}
                <Text style={styles.progressPercentUnit}>%</Text>
              </Text>
              {progress ? (
                <Text style={styles.progressFraction}>
                  {progress.current} / {progress.total}
                </Text>
              ) : null}
            </SvgProcessRing>
          </View>

          <RNText style={styles.progressTitle} testID={titleTestID}>
            {title}
          </RNText>
          {body ? <Text style={styles.progressBody}>{body}</Text> : null}

          <View style={styles.supportList} testID="photo-grid-support-list">
            <View style={styles.supportRow}>
              <View
                style={styles.supportIconShell}
                testID="photo-grid-scanning-support-icon-local"
              >
                <DesignIcon
                  name="local-analysis"
                  width={metrics.supportIcon}
                  height={metrics.supportIcon}
                  align="start"
                  color={accentColor}
                  secondaryColor={accentColor}
                />
              </View>
              <Text style={styles.supportRowText}>{copy.entryLocalOnly}</Text>
            </View>
            <View style={styles.supportRow}>
              <View
                style={styles.supportIconShell}
                testID="photo-grid-scanning-support-icon-media"
              >
                <DesignIcon
                  name="media-play"
                  width={metrics.supportIcon}
                  height={metrics.supportIcon}
                  align="start"
                  color={accentColor}
                />
              </View>
              <Text style={styles.supportRowText}>{copy.entrySupportsPhotosAndVideos}</Text>
            </View>
            <View style={styles.supportRow}>
              <View
                style={styles.supportIconShell}
                testID="photo-grid-scanning-support-icon-fast"
              >
                <DesignIcon
                  name="shield-check-outline"
                  width={metrics.supportIcon}
                  height={metrics.supportIcon}
                  align="start"
                  color={accentColor}
                />
              </View>
              <Text style={styles.supportRowText}>{note ?? copy.entryFastLocalScan}</Text>
            </View>
          </View>

          {actionLabel ? (
            <Text
              style={styles.instrumentationOnly}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              {actionLabel}
            </Text>
          ) : null}
          <Text
            style={styles.instrumentationOnly}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            {copy.entryScanningInstrumentationLabel}
          </Text>
          </View>
        </StageFrame>
      </View>
    );
  }

  if (variant === 'scanReady' || variant === 'loading' || variant === 'permissionDenied') {
    const isPermissionDenied = variant === 'permissionDenied';
    const statusTitle = isPermissionDenied
      ? title
      : variant === 'loading'
        ? copy.entryLoadingTitle
        : copy.entryPermissionGrantedTitle;
    const statusBody = isPermissionDenied
      ? (body ?? copy.entryLoadingBody)
      : variant === 'loading'
        ? copy.entryLoadingBody
        : copy.entryPermissionGrantedBody;
    const heroTitle = isPermissionDenied ? title : title;
    const heroBody = isPermissionDenied ? body : body;
    const heroIconName: DesignIconName = isPermissionDenied ? 'check' : 'stack';
    const primaryIconName: DesignIconName = isPermissionDenied ? 'check' : 'scan';

    return (
      <View style={styles.wrapper} testID={rootTestID}>
        <StageFrame styles={styles}>
          {variant !== 'scanReady' ? (
            <View
              style={styles.statusCard}
              testID={isPermissionDenied ? 'photo-grid-permission-status-card' : undefined}
            >
              <View style={[
                styles.statusIconShell,
                isPermissionDenied && styles.statusIconShellPending,
              ]}>
                <DesignIcon
                  name={isPermissionDenied ? 'scan' : 'check'}
                  width={metrics.statusIcon}
                  height={metrics.statusIcon}
                  color={isPermissionDenied ? accentColor : successColor}
                  secondaryColor={resolvedTheme.cardMutedBackground}
                />
              </View>
              <View style={styles.statusCopy}>
                <Text style={styles.statusTitle}>{statusTitle}</Text>
                <Text style={styles.statusSubtitle}>{statusBody}</Text>
              </View>
            </View>
          ) : null}

          <View
            style={[styles.entryCard, variant === 'scanReady' && styles.entryCardScanReady]}
            testID={
              variant === 'scanReady'
                ? 'photo-grid-ready-surface'
                : isPermissionDenied
                  ? 'photo-grid-permission-hero-card'
                  : undefined
            }
          >
          <View style={[styles.entryArtwork, variant === 'scanReady' && styles.entryArtworkScanReady]}>
            <View style={styles.entryArtworkGlow} />
            <DesignIcon
              name={heroIconName}
              width={heroIconSize}
              height={heroIconSize}
              color={accentColor}
              secondaryColor={resolvedTheme.buttonSecondaryBackground}
              testID={variant === 'scanReady' ? 'photo-grid-ready-static-file-icon' : undefined}
            />
          </View>

          {heroTitle ? (
            <RNText style={styles.entryTitle} testID={titleTestID}>
              {heroTitle}
            </RNText>
          ) : null}
          {heroBody ? <Text style={styles.entryBody}>{heroBody}</Text> : null}

          {actionLabel ? (
            <Pressable
              style={[styles.primaryAction, actionDisabled && styles.buttonDisabled]}
              onPress={onAction}
              disabled={actionDisabled}
              testID={actionTestID}
            >
              <DesignIcon
                name={primaryIconName}
                width={metrics.primaryActionIcon}
                height={metrics.primaryActionIcon}
                color={resolvedTheme.buttonPrimaryText}
                secondaryColor={accentColor}
              />
              <Text style={styles.primaryActionText}>{actionLabel}</Text>
            </Pressable>
          ) : null}

          <View style={styles.supportPill} testID="photo-grid-support-prompt">
            <View
              style={styles.supportIconShell}
              testID="photo-grid-ready-support-icon-hint"
            >
              <DesignIcon
                name="check"
                width={metrics.supportIcon}
                height={metrics.supportIcon}
                align="start"
                color={accentColor}
              />
            </View>
            <Text style={styles.supportText}>
              {note ?? copy.entryReadyHint}
            </Text>
          </View>

          <View style={styles.entryDivider} />
          <View style={styles.supportList} testID="photo-grid-support-list">
            <View style={styles.supportRow}>
              <View
                style={styles.supportIconShell}
                testID="photo-grid-ready-support-icon-local"
              >
                <DesignIcon
                  name="local-analysis"
                  width={metrics.supportIcon}
                  height={metrics.supportIcon}
                  align="start"
                  color={accentColor}
                  secondaryColor={accentColor}
                />
              </View>
              <View style={styles.supportRowCopy}>
                <Text style={styles.supportRowTitle}>{copy.entryLocalOnly}</Text>
                <Text style={styles.supportRowCaption}>{copy.entryLocalOnlyCaption}</Text>
              </View>
            </View>
            <View style={styles.supportRow}>
              <View
                style={styles.supportIconShell}
                testID="photo-grid-ready-support-icon-media"
              >
                <DesignIcon
                  name="media-play"
                  width={metrics.supportIcon}
                  height={metrics.supportIcon}
                  align="start"
                  color={accentColor}
                />
              </View>
              <View style={styles.supportRowCopy}>
                <Text style={styles.supportRowTitle}>{copy.entrySupportsPhotosAndVideos}</Text>
                <Text style={styles.supportRowCaption}>{copy.entrySupportsPhotosAndVideosCaption}</Text>
              </View>
            </View>
          </View>
          </View>
        </StageFrame>
      </View>
    );
  }

  const statusIconName: DesignIconName =
    variant === 'scanAllComplete'
      ? 'check'
      : 'scan';
  const statusActionStyle = styles.secondaryAction;
  const statusActionTextStyle = styles.secondaryActionText;

  return (
    <View style={styles.wrapper} testID={rootTestID}>
      <View style={styles.genericCard}>
        {eyebrow ? <Text style={styles.genericEyebrow}>{eyebrow}</Text> : null}
        <View style={styles.genericIconShell}>
          <DesignIcon
            name={statusIconName}
            width={metrics.genericIcon}
            height={metrics.genericIcon}
            color={accentColor}
            secondaryColor={resolvedTheme.cardMutedBackground}
          />
        </View>
        <RNText style={styles.genericTitle} testID={titleTestID}>
          {title}
        </RNText>
        {body ? <Text style={styles.genericBody}>{body}</Text> : null}
        {actionLabel ? (
          <Pressable
            style={[statusActionStyle, actionDisabled && styles.buttonDisabled]}
            onPress={onAction}
            disabled={actionDisabled}
            testID={actionTestID}
          >
            <Text style={statusActionTextStyle}>{actionLabel}</Text>
          </Pressable>
        ) : null}
        {note ? <Text style={styles.genericNote}>{note}</Text> : null}
      </View>
    </View>
  );
}

function resolveBreakdownColor(key: ResultBreakdownItem['key']) {
  if (key === 'duplicate') {
    return PHOTO_GRID_ENTRY_CARD_STYLE_TOKENS.color.breakdownDuplicate;
  }

  if (key === 'blurry') {
    return PHOTO_GRID_ENTRY_CARD_STYLE_TOKENS.color.breakdownBlurry;
  }

  return PHOTO_GRID_ENTRY_CARD_STYLE_TOKENS.color.breakdownSimilar;
}

function resolveBreakdownIconBackground(key: ResultBreakdownItem['key']) {
  if (key === 'duplicate') {
    return PHOTO_GRID_ENTRY_CARD_STYLE_TOKENS.color.breakdownDuplicateBackground;
  }

  if (key === 'blurry') {
    return PHOTO_GRID_ENTRY_CARD_STYLE_TOKENS.color.breakdownBlurryBackground;
  }

  return PHOTO_GRID_ENTRY_CARD_STYLE_TOKENS.color.breakdownSimilarBackground;
}

function resolveBreakdownIcon(key: ResultBreakdownItem['key']): DesignIconName {
  if (key === 'duplicate') {
    return 'duplicate-camera';
  }

  if (key === 'blurry') {
    return 'blurry-drop';
  }

  return 'similar-people';
}

function createCardMetrics(compact: boolean) {
  return {
    wrapperMarginTop: compact ? 16 : 24,
    wrapperMarginHorizontal: compact ? 0 : 24,
    wrapperMaxWidth: compact ? 319 : undefined,
    statusGap: compact ? 12 : 16,
    statusPaddingHorizontal: compact ? 16 : 20,
    statusPaddingVertical: compact ? 16 : 20,
    statusRadius: compact ? 22 : 24,
    statusIconShell: compact ? 50 : 72,
    statusIcon: compact ? 20 : 26,
    statusTitleSize: compact ? 16 : 24,
    statusTitleLine: compact ? 22 : 30,
    statusSubtitleSize: compact ? 13 : 18,
    statusSubtitleLine: compact ? 18 : 26,
    entryRadius: compact ? 24 : 28,
    entryPaddingHorizontal: compact ? 20 : 24,
    entryPaddingVertical: compact ? 22 : 28,
    entryArtworkHeight: compact ? 168 : 220,
    entryArtworkRadius: compact ? 24 : 28,
    entryArtworkGlowSize: compact ? 190 : 240,
    entryArtworkIcon: compact ? 58 : 72,
    scanReadyTopOffset: compact ? 34 : 54,
    entryArtworkMarginBottom: compact ? 18 : 24,
    entryTitleSize: compact ? 22 : 28,
    entryTitleLine: compact ? 28 : 36,
    entryBodySize: compact ? 13 : 16,
    entryBodyLine: compact ? 20 : 24,
    primaryActionHeight: compact ? 54 : 62,
    primaryActionRadius: compact ? 27 : 31,
    primaryActionTextSize: compact ? 15 : 18,
    primaryActionIcon: compact ? 18 : 20,
    secondaryActionHeight: compact ? 50 : 58,
    secondaryActionTextSize: compact ? 14 : 18,
    supportPillMarginTop: compact ? 14 : 18,
    supportPillPaddingVertical: compact ? 9 : 11,
    supportTextSize: compact ? 12 : 14,
    supportTextLine: compact ? 17 : 20,
    supportListGap: compact ? 11 : 14,
    supportListMaxWidth: compact ? 270 : 360,
    supportRowGap: compact ? 8 : 10,
    supportIconShell: compact ? 24 : 28,
    supportIcon: compact ? 16 : 18,
    supportRowTitleSize: compact ? 13 : 16,
    supportRowCaptionSize: compact ? 12 : 14,
    supportRowCaptionLine: compact ? 17 : 20,
    supportRowTextSize: compact ? 12 : 16,
    supportRowTextLine: compact ? 18 : 24,
    progressPaddingTop: compact ? 34 : 54,
    progressPaddingBottom: compact ? 14 : 18,
    progressCircleSize: compact ? 196 : 292,
    progressCircleBorder: compact ? 14 : 18,
    progressCircleMarginBottom: compact ? 30 : 42,
    progressSegmentLength: compact ? 17 : 22,
    progressSegmentThickness: compact ? 8 : 10,
    progressCircleInnerSize: compact ? 146 : 216,
    progressPercentSize: compact ? 48 : 72,
    progressPercentLine: compact ? 54 : 78,
    progressPercentUnitSize: compact ? 24 : 30,
    progressPercentUnitLine: compact ? 30 : 36,
    progressFractionSize: compact ? 17 : 28,
    progressFractionLine: compact ? 23 : 34,
    progressTitleSize: compact ? 22 : 30,
    progressTitleLine: compact ? 28 : 38,
    progressBodySize: compact ? 13 : 18,
    progressBodyLine: compact ? 20 : 26,
    progressBodyMarginBottom: compact ? 24 : 34,
    resultPaddingTop: compact ? 24 : 42,
    resultHeroHeight: compact ? 92 : 118,
    resultHeroMarginBottom: compact ? 14 : 18,
    resultBadgeSize: compact ? 62 : 96,
    resultBadgeIcon: compact ? 48 : 72,
    resultCopyMarginBottom: compact ? 22 : 42,
    resultTitleSize: compact ? 18 : 28,
    resultTitleLine: compact ? 24 : 36,
    resultSubtitleSize: compact ? 12 : 18,
    resultSubtitleLine: compact ? 18 : 26,
    breakdownGap: compact ? 12 : 18,
    breakdownMarginBottom: compact ? 24 : 34,
    breakdownRadius: compact ? 20 : 24,
    breakdownPaddingHorizontal: compact ? 18 : 22,
    breakdownPaddingVertical: compact ? 16 : 24,
    breakdownRowGap: compact ? 14 : 18,
    breakdownIconShell: compact ? 44 : 64,
    breakdownIconRadius: compact ? 14 : 20,
    breakdownIcon: compact ? 28 : 36,
    breakdownLabelSize: compact ? 15 : 22,
    breakdownLabelLine: compact ? 21 : 28,
    breakdownCountSize: compact ? 18 : 28,
    breakdownCountLine: compact ? 24 : 34,
    chevronIcon: compact ? 18 : 22,
    genericRadius: compact ? 24 : 28,
    genericPaddingHorizontal: compact ? 20 : 24,
    genericPaddingVertical: compact ? 22 : 28,
    genericIconShell: compact ? 58 : 72,
    genericIcon: compact ? 28 : 32,
    genericTitleSize: compact ? 18 : 24,
    genericTitleLine: compact ? 24 : 32,
    genericBodySize: compact ? 13 : 15,
    genericBodyLine: compact ? 19 : 22,
    genericNoteSize: compact ? 12 : 13,
    genericNoteLine: compact ? 18 : 20,
  };
}

type PhotoGridEntryCardMetrics = ReturnType<typeof createCardMetrics>;
type PhotoGridEntryCardStyles = ReturnType<typeof createCardStyles>;

interface StageFrameProps {
  styles: PhotoGridEntryCardStyles;
  style?: object;
  children: React.ReactNode;
}

function StageFrame({ styles, style, children }: StageFrameProps) {
  return <View style={[styles.stageFrame, style]}>{children}</View>;
}

function createCardStyles(theme: AppThemePalette, metrics: PhotoGridEntryCardMetrics) {
  const accent = theme.buttonPrimaryBackground;
  const background = theme.cardBackground;
  const border = theme.cardBorder;
  const pageTextPrimary = theme.pageTextPrimary;
  const pageTextSecondary = theme.pageTextSecondary;
  const pageTextMuted = theme.pageTextMuted;
  const surface = theme.cardMutedBackground;
  const halo = theme.heroAccent;
  const shadowColor = theme.shadowColor;
  const isDark = theme.scheme === 'dark';

  return StyleSheet.create({
    wrapper: {
      marginTop: metrics.wrapperMarginTop,
      marginHorizontal: metrics.wrapperMarginHorizontal,
      width: metrics.wrapperMaxWidth,
      maxWidth: '100%',
      alignSelf: metrics.wrapperMaxWidth ? 'center' : 'stretch',
      gap: 12,
    },
    stageFrame: {
      width: '100%',
    },
    statusCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: metrics.statusGap,
      paddingHorizontal: 0,
      paddingVertical: metrics.statusPaddingVertical,
      borderRadius: metrics.statusRadius,
      backgroundColor: 'transparent',
      borderWidth: 0,
      shadowOpacity: 0,
      elevation: 0,
    },
    statusIconShell: {
      width: metrics.statusIconShell,
      height: metrics.statusIconShell,
      borderRadius: metrics.statusIconShell / 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    },
    statusIconShellPending: {
      backgroundColor: 'transparent',
    },
    statusCopy: {
      flex: 1,
      gap: 6,
    },
    statusTitle: {
      fontSize: metrics.statusTitleSize,
      lineHeight: metrics.statusTitleLine,
      fontWeight: '800',
      color: pageTextPrimary,
    },
    statusSubtitle: {
      fontSize: metrics.statusSubtitleSize,
      lineHeight: metrics.statusSubtitleLine,
      color: pageTextSecondary,
    },
    entryCard: {
      borderRadius: metrics.entryRadius,
      paddingHorizontal: metrics.entryPaddingHorizontal,
      paddingVertical: metrics.entryPaddingVertical,
      backgroundColor: 'transparent',
      borderWidth: 0,
      shadowOpacity: 0,
      elevation: 0,
    },
    entryCardScanReady: {
      marginTop: metrics.scanReadyTopOffset,
      paddingTop: Math.max(10, Math.floor(metrics.entryPaddingVertical * 0.58)),
    },
    entryArtwork: {
      height: metrics.entryArtworkHeight,
      borderRadius: metrics.entryArtworkRadius,
      marginBottom: metrics.entryArtworkMarginBottom,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      backgroundColor: 'transparent',
    },
    entryArtworkScanReady: {
      height: Math.max(76, Math.floor(metrics.entryArtworkHeight * 0.58)),
      marginBottom: Math.max(12, Math.floor(metrics.entryArtworkMarginBottom * 0.7)),
    },
    entryArtworkGlow: {
      position: 'absolute',
      width: metrics.entryArtworkGlowSize,
      height: metrics.entryArtworkGlowSize,
      borderRadius: metrics.entryArtworkGlowSize / 2,
      backgroundColor: halo,
      opacity: 0.7,
    },
    entryTitle: {
      fontSize: metrics.entryTitleSize,
      lineHeight: metrics.entryTitleLine,
      fontWeight: '800',
      color: pageTextPrimary,
      textAlign: 'center',
    },
    entryBody: {
      marginTop: 12,
      fontSize: metrics.entryBodySize,
      lineHeight: metrics.entryBodyLine,
      color: pageTextSecondary,
      textAlign: 'center',
    },
    primaryAction: {
      marginTop: 24,
      minHeight: metrics.primaryActionHeight,
      borderRadius: metrics.primaryActionRadius,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      backgroundColor: accent,
      shadowOpacity: 0,
      elevation: 0,
    },
    primaryActionText: {
      fontSize: metrics.primaryActionTextSize,
      fontWeight: '800',
      color: theme.buttonPrimaryText,
    },
    secondaryAction: {
      alignSelf: 'stretch',
      minHeight: metrics.secondaryActionHeight,
      borderRadius: metrics.secondaryActionHeight / 2,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: accent,
      backgroundColor: 'transparent',
    },
    secondaryActionText: {
      fontSize: metrics.secondaryActionTextSize,
      fontWeight: '700',
      color: accent,
    },
    buttonDisabled: {
      opacity: 0.55,
    },
    supportPill: {
      marginTop: metrics.supportPillMarginTop,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-start',
      gap: metrics.supportRowGap,
      width: '100%',
      maxWidth: metrics.supportListMaxWidth,
      alignSelf: 'flex-start',
      borderRadius: 999,
      paddingVertical: metrics.supportPillPaddingVertical,
      backgroundColor: 'transparent',
    },
    supportText: {
      flexShrink: 1,
      fontSize: metrics.supportTextSize,
      lineHeight: metrics.supportTextLine,
      color: accent,
      textAlign: 'left',
    },
    entryDivider: {
      height: 1,
      marginTop: 22,
      marginBottom: 18,
      backgroundColor: border,
    },
    supportList: {
      gap: metrics.supportListGap,
      width: '100%',
      maxWidth: metrics.supportListMaxWidth,
      alignSelf: 'flex-start',
    },
    supportRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: metrics.supportRowGap,
    },
    supportIconShell: {
      width: metrics.supportIconShell,
      height: metrics.supportIconShell,
      alignItems: 'flex-start',
      justifyContent: 'center',
      flexShrink: 0,
      overflow: 'visible',
    },
    supportRowCopy: {
      flex: 1,
      gap: 3,
    },
    supportRowTitle: {
      fontSize: metrics.supportRowTitleSize,
      fontWeight: '700',
      color: pageTextPrimary,
    },
    supportRowCaption: {
      fontSize: metrics.supportRowCaptionSize,
      lineHeight: metrics.supportRowCaptionLine,
      color: pageTextSecondary,
    },
    supportRowText: {
      flex: 1,
      fontSize: metrics.supportRowTextSize,
      lineHeight: metrics.supportRowTextLine,
      color: pageTextSecondary,
    },
    progressHeroCard: {
      paddingHorizontal: 8,
      paddingTop: metrics.progressPaddingTop,
      paddingBottom: metrics.progressPaddingBottom,
      backgroundColor: 'transparent',
      alignItems: 'center',
    },
    progressRingWrap: {
      marginBottom: metrics.progressCircleMarginBottom,
    },
    progressCircle: {
      width: metrics.progressCircleSize,
      height: metrics.progressCircleSize,
      borderRadius: metrics.progressCircleSize / 2,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: metrics.progressCircleMarginBottom,
    },
    progressCircleTrack: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: metrics.progressCircleSize / 2,
      borderWidth: metrics.progressCircleBorder,
      borderColor: isDark
        ? PHOTO_GRID_ENTRY_CARD_STYLE_TOKENS.color.progressTrackDark
        : PHOTO_GRID_ENTRY_CARD_STYLE_TOKENS.color.progressTrackLight,
    },
    progressCircleSegment: {
      position: 'absolute',
      top: metrics.progressCircleSize / 2 - metrics.progressSegmentLength / 2,
      left: metrics.progressCircleSize / 2 - metrics.progressSegmentThickness / 2,
      width: metrics.progressSegmentThickness,
      height: metrics.progressSegmentLength,
      borderRadius: metrics.progressSegmentThickness / 2,
      backgroundColor: accent,
      shadowColor: accent,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: isDark
        ? PHOTO_GRID_ENTRY_CARD_STYLE_TOKENS.opacity.progressAccentShadowDark
        : PHOTO_GRID_ENTRY_CARD_STYLE_TOKENS.opacity.progressAccentShadowLight,
      shadowRadius: 3,
      elevation: 2,
    },
    progressCircleInner: {
      width: metrics.progressCircleInnerSize,
      height: metrics.progressCircleInnerSize,
      borderRadius: metrics.progressCircleInnerSize / 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: background,
    },
    progressPercent: {
      fontSize: metrics.progressPercentSize,
      lineHeight: metrics.progressPercentLine,
      fontWeight: '800',
      color: accent,
    },
    progressPercentUnit: {
      fontSize: metrics.progressPercentUnitSize,
      lineHeight: metrics.progressPercentUnitLine,
      fontWeight: '800',
    },
    progressFraction: {
      marginTop: 8,
      fontSize: metrics.progressFractionSize,
      lineHeight: metrics.progressFractionLine,
      fontWeight: '600',
      color: pageTextPrimary,
    },
    progressTitle: {
      fontSize: metrics.progressTitleSize,
      lineHeight: metrics.progressTitleLine,
      fontWeight: '800',
      color: pageTextPrimary,
      textAlign: 'center',
    },
    progressBody: {
      marginTop: 8,
      marginBottom: metrics.progressBodyMarginBottom,
      fontSize: metrics.progressBodySize,
      lineHeight: metrics.progressBodyLine,
      color: pageTextSecondary,
      textAlign: 'center',
    },
    inlineProgressBlock: {
      width: '100%',
      marginTop: 18,
      paddingTop: 14,
    },
    resultShell: {
      paddingHorizontal: 8,
      paddingTop: metrics.resultPaddingTop,
      paddingBottom: 18,
      backgroundColor: 'transparent',
    },
    resultHero: {
      height: metrics.resultHeroHeight,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: metrics.resultHeroMarginBottom,
    },
    resultBadge: {
      width: metrics.resultBadgeSize,
      height: metrics.resultBadgeSize,
      borderRadius: metrics.resultBadgeSize / 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'transparent',
    },
    sparkle: {
      position: 'absolute',
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: PHOTO_GRID_ENTRY_CARD_STYLE_TOKENS.color.sparklePrimary,
      opacity: PHOTO_GRID_ENTRY_CARD_STYLE_TOKENS.opacity.sparkle,
    },
    sparkleLeftTop: {
      left: 58,
      top: 10,
    },
    sparkleRightTop: {
      right: 62,
      top: 0,
      backgroundColor: PHOTO_GRID_ENTRY_CARD_STYLE_TOKENS.color.sparkleSecondary,
    },
    sparkleLeftBottom: {
      left: 96,
      bottom: 22,
      width: 12,
      height: 12,
      borderRadius: 6,
    },
    sparkleRightBottom: {
      right: 100,
      bottom: 14,
      backgroundColor: PHOTO_GRID_ENTRY_CARD_STYLE_TOKENS.color.sparklePrimary,
      width: 12,
      height: 12,
      borderRadius: 6,
    },
    resultCopy: {
      alignItems: 'center',
      gap: 8,
      marginBottom: metrics.resultCopyMarginBottom,
    },
    resultTitle: {
      fontSize: metrics.resultTitleSize,
      lineHeight: metrics.resultTitleLine,
      fontWeight: '800',
      color: pageTextPrimary,
      textAlign: 'center',
    },
    resultSubtitle: {
      fontSize: metrics.resultSubtitleSize,
      lineHeight: metrics.resultSubtitleLine,
      color: pageTextSecondary,
      textAlign: 'center',
    },
    breakdownList: {
      gap: metrics.breakdownGap,
      marginBottom: metrics.breakdownMarginBottom,
    },
    breakdownCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: metrics.breakdownRowGap,
      paddingHorizontal: metrics.breakdownPaddingHorizontal,
      paddingVertical: metrics.breakdownPaddingVertical,
      backgroundColor: 'transparent',
      borderWidth: 0,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: border,
      shadowOpacity: 0,
      elevation: 0,
    },
    breakdownIconShell: {
      width: metrics.breakdownIconShell,
      height: metrics.breakdownIconShell,
      borderRadius: metrics.breakdownIconRadius,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      overflow: 'visible',
      backgroundColor: 'transparent',
    },
    breakdownCopy: {
      flex: 1,
      gap: 4,
    },
    breakdownLabel: {
      fontSize: metrics.breakdownLabelSize,
      lineHeight: metrics.breakdownLabelLine,
      fontWeight: '700',
      color: pageTextPrimary,
    },
    breakdownCount: {
      fontSize: metrics.breakdownCountSize,
      lineHeight: metrics.breakdownCountLine,
      fontWeight: '800',
      color: pageTextSecondary,
    },
    genericCard: {
      borderRadius: metrics.genericRadius,
      paddingHorizontal: metrics.genericPaddingHorizontal,
      paddingVertical: metrics.genericPaddingVertical,
      backgroundColor: background,
      borderWidth: 1,
      borderColor: border,
      shadowColor,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: isDark
        ? PHOTO_GRID_ENTRY_CARD_STYLE_TOKENS.opacity.genericShadowDark
        : PHOTO_GRID_ENTRY_CARD_STYLE_TOKENS.opacity.genericShadowLight,
      shadowRadius: 22,
      elevation: 4,
      alignItems: 'center',
      gap: 14,
    },
    genericEyebrow: {
      fontSize: 14,
      fontWeight: '700',
      color: pageTextMuted,
    },
    genericIconShell: {
      width: metrics.genericIconShell,
      height: metrics.genericIconShell,
      borderRadius: metrics.genericIconShell / 2,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: surface,
    },
    genericTitle: {
      fontSize: metrics.genericTitleSize,
      lineHeight: metrics.genericTitleLine,
      fontWeight: '800',
      color: pageTextPrimary,
      textAlign: 'center',
    },
    genericBody: {
      fontSize: metrics.genericBodySize,
      lineHeight: metrics.genericBodyLine,
      color: pageTextSecondary,
      textAlign: 'center',
    },
    genericNote: {
      fontSize: metrics.genericNoteSize,
      lineHeight: metrics.genericNoteLine,
      color: pageTextMuted,
      textAlign: 'center',
    },
    instrumentationOnly: {
      position: 'absolute',
      left: -10000,
      top: 0,
      width: 1,
      height: 1,
      opacity: 0,
    },
  });
}
