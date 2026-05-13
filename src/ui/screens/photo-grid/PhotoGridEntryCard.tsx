import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { DesignIcon, SvgProcessRing, type DesignIconName } from '../../icons/DesignIcon';
import type { AppThemePalette } from '../../../theme/app-theme';
import type { AppLanguage } from '../../../i18n/app-language';

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
  const metrics = useMemo(() => createCardMetrics(compact), [compact]);
  const styles = useMemo(() => createCardStyles(theme, metrics), [metrics, theme]);
  const copy = useMemo(() => getChromeCopy(language), [language]);
  const accentColor = theme?.buttonPrimaryBackground ?? '#2f80ff';
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
        <StageFade stageKey={variant} styles={styles} style={styles.resultShell}>
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
                color="#23b58f"
                testID="photo-grid-result-check-icon"
              />
            </View>
          </View>

          <View style={styles.resultCopy}>
            <Text style={styles.resultTitle} testID={titleTestID}>
              {title}
            </Text>
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
                      secondaryColor="#FFFFFF"
                    />
                  </View>
                  <View style={styles.breakdownCopy}>
                    <Text style={styles.breakdownLabel}>{item.label}</Text>
                    <Text style={styles.breakdownCount}>{`${item.count} ${copy.unit}`}</Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={metrics.chevronIcon}
                    color={theme?.pageTextMuted ?? '#94a3b8'}
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
        </StageFade>
      </View>
    );
  }

  if (variant === 'scanning' || variant === 'recognizing') {
    return (
      <View style={styles.wrapper} testID={rootTestID}>
        <StageFade stageKey={variant} styles={styles}>
          <View style={styles.statusCard}>
          <View style={styles.statusIconShell}>
            <DesignIcon
              name="check"
              width={metrics.statusIcon}
              height={metrics.statusIcon}
              color="#23b58f"
            />
          </View>
          <View style={styles.statusCopy}>
            <Text style={styles.statusTitle}>{copy.permissionGrantedTitle}</Text>
            <Text style={styles.statusSubtitle}>{copy.permissionGrantedBody}</Text>
          </View>
          </View>

          <View style={styles.progressHeroCard}>
          <View style={styles.progressRingWrap}>
            <SvgProcessRing
              size={metrics.progressCircleSize}
              progress={progressPercent}
              color={accentColor}
              trackColor={theme?.scheme === 'dark' ? '#1e3769' : '#d8e6ff'}
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

          <Text style={styles.progressTitle} testID={titleTestID}>
            {title}
          </Text>
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
              <Text style={styles.supportRowText}>{copy.localOnly}</Text>
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
              <Text style={styles.supportRowText}>{copy.supportsPhotosAndVideos}</Text>
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
              <Text style={styles.supportRowText}>{note ?? copy.fastLocalScan}</Text>
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
            {language === 'zh-CN' ? '扫描中' : 'Scanning'}
          </Text>
          </View>
        </StageFade>
      </View>
    );
  }

  if (variant === 'scanReady' || variant === 'loading' || variant === 'permissionDenied') {
    const isPermissionDenied = variant === 'permissionDenied';
    const statusTitle = isPermissionDenied
      ? title
      : variant === 'loading'
        ? copy.loadingTitle
        : copy.permissionGrantedTitle;
    const statusBody = isPermissionDenied
      ? (body ?? copy.loadingBody)
      : variant === 'loading'
        ? copy.loadingBody
        : copy.permissionGrantedBody;
    const heroTitle = isPermissionDenied ? title : title;
    const heroBody = isPermissionDenied ? body : body;
    const heroIconName: DesignIconName = isPermissionDenied ? 'check' : 'stack';
    const primaryIconName: DesignIconName = isPermissionDenied ? 'check' : 'scan';

    return (
      <View style={styles.wrapper} testID={rootTestID}>
        <StageFade stageKey={variant} styles={styles}>
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
                  color={isPermissionDenied ? accentColor : '#23b58f'}
                  secondaryColor={theme?.cardMutedBackground ?? '#EFF6FF'}
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
              secondaryColor={theme?.buttonSecondaryBackground ?? '#BFDBFE'}
              testID={variant === 'scanReady' ? 'photo-grid-ready-static-file-icon' : undefined}
            />
          </View>

          {heroTitle ? (
            <Text style={styles.entryTitle} testID={titleTestID}>
              {heroTitle}
            </Text>
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
                color="#ffffff"
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
              {note ?? (isPermissionDenied ? copy.readyHint : copy.readyHint)}
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
                <Text style={styles.supportRowTitle}>{copy.localOnly}</Text>
                <Text style={styles.supportRowCaption}>{copy.localOnlyCaption}</Text>
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
                <Text style={styles.supportRowTitle}>{copy.supportsPhotosAndVideos}</Text>
                <Text style={styles.supportRowCaption}>{copy.supportsPhotosAndVideosCaption}</Text>
              </View>
            </View>
          </View>
          </View>
        </StageFade>
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
            secondaryColor={theme?.cardMutedBackground ?? '#EFF6FF'}
          />
        </View>
        <Text style={styles.genericTitle} testID={titleTestID}>
          {title}
        </Text>
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
    return '#ff9f2e';
  }

  if (key === 'blurry') {
    return '#ff5b4d';
  }

  return '#6b4dff';
}

function resolveBreakdownIconBackground(key: ResultBreakdownItem['key']) {
  if (key === 'duplicate') {
    return '#fff3e1';
  }

  if (key === 'blurry') {
    return '#fff0f2';
  }

  return '#f1eaff';
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

function getChromeCopy(language: AppLanguage) {
  if (language === 'en-US') {
    return {
      unit: 'items',
      permissionGrantedTitle: 'Permission granted',
      permissionGrantedBody: 'The library is ready for local scanning',
      loadingTitle: 'Preparing access',
      loadingBody: 'Reading local media and staging the next session',
      readyHint: 'Photos and videos stay local during scan and cleanup review',
      localOnly: 'Processed locally, no media is uploaded',
      localOnlyCaption: 'Every recognition and cleanup step stays on the device',
      supportsPhotosAndVideos: 'Supports both photos and videos',
      supportsPhotosAndVideosCaption: 'Duplicate, blurry, and similar items are reviewed together',
      fastLocalScan: 'Return to the page to reattach to the current batch progress',
    };
  }

  return {
    unit: '项',
    permissionGrantedTitle: '授权已完成',
    permissionGrantedBody: '可开始扫描相册',
    loadingTitle: '正在准备访问',
    loadingBody: '读取本地媒体并恢复当前工作台',
    readyHint: '即将扫描照片与视频，结果会直接留在当前页面',
    localOnly: '仅在本地分析，不上传任何数据',
    localOnlyCaption: '所有识别与清理操作均在本地完成',
    supportsPhotosAndVideos: '支持照片与视频',
    supportsPhotosAndVideosCaption: '重复、模糊与相似内容会统一进入后续判断',
    fastLocalScan: '离开后再回到页面，会自动接回当前批次进度',
  };
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

interface StageFadeProps {
  stageKey: string;
  styles: PhotoGridEntryCardStyles;
  style?: object;
  children: React.ReactNode;
}

function StageFade({ stageKey, styles, style, children }: StageFadeProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const offset = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    opacity.setValue(0);
    offset.setValue(8);
    const opacityAnimation = Animated.timing(opacity, {
      toValue: 1,
      duration: 260,
      useNativeDriver: true,
    });
    const offsetAnimation = Animated.timing(offset, {
      toValue: 0,
      duration: 260,
      useNativeDriver: true,
    });

    if (Animated.parallel) {
      Animated.parallel([opacityAnimation, offsetAnimation]).start();
      return;
    }

    opacityAnimation.start();
    offsetAnimation.start();
  }, [offset, opacity, stageKey]);

  return (
    <Animated.View style={[styles.stageFade, style, { opacity, transform: [{ translateY: offset }] }]}>
      {children}
    </Animated.View>
  );
}

function createCardStyles(theme: AppThemePalette | undefined, metrics: PhotoGridEntryCardMetrics) {
  const accent = theme?.buttonPrimaryBackground ?? '#2f80ff';
  const background = theme?.cardBackground ?? '#ffffff';
  const border = theme?.cardBorder ?? '#e2e8f0';
  const pageTextPrimary = theme?.pageTextPrimary ?? '#0f172a';
  const pageTextSecondary = theme?.pageTextSecondary ?? '#64748b';
  const pageTextMuted = theme?.pageTextMuted ?? '#94a3b8';
  const surface = theme?.cardMutedBackground ?? '#f8fafc';
  const halo = theme?.heroAccent ?? '#e6efff';
  const shadowColor = theme?.shadowColor ?? '#0f172a';

  return StyleSheet.create({
    wrapper: {
      marginTop: metrics.wrapperMarginTop,
      marginHorizontal: metrics.wrapperMarginHorizontal,
      width: metrics.wrapperMaxWidth,
      maxWidth: '100%',
      alignSelf: metrics.wrapperMaxWidth ? 'center' : 'stretch',
      gap: 12,
    },
    stageFade: {
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
      color: '#ffffff',
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
      borderColor: theme?.scheme === 'dark' ? '#1e3769' : '#d8e6ff',
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
      shadowOpacity: theme?.scheme === 'dark' ? 0.36 : 0.2,
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
      backgroundColor: '#dce8ff',
      opacity: 0.9,
    },
    sparkleLeftTop: {
      left: 58,
      top: 10,
    },
    sparkleRightTop: {
      right: 62,
      top: 0,
      backgroundColor: '#e7d9ff',
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
      backgroundColor: '#dce8ff',
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
      shadowOpacity: theme?.scheme === 'dark' ? 0.24 : 0.08,
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
