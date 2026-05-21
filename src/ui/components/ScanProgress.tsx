import React, { useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';

import { getAppCopy } from '../../i18n/app-copy';
import type { AppThemePalette } from '../../theme/app-theme';
import { COMPONENT_TOKENS } from '../../theme/generated/component-tokens.generated';
import { Progress } from '../primitives';

export const SCAN_PROGRESS_STYLE_TOKENS = COMPONENT_TOKENS.scanProgress;

const PIPELINE_SEGMENT_WIDTH = SCAN_PROGRESS_STYLE_TOKENS.pipeline.segmentWidth;
const PIPELINE_WAKE_WIDTH = SCAN_PROGRESS_STYLE_TOKENS.pipeline.wakeWidth;
const PIPELINE_TRAVEL_WIDTH = SCAN_PROGRESS_STYLE_TOKENS.pipeline.travelWidth;
const PIPELINE_FLOW_DURATION = SCAN_PROGRESS_STYLE_TOKENS.motion.flowDurationMs;
const PIPELINE_FLOW_PAUSE_DURATION = SCAN_PROGRESS_STYLE_TOKENS.motion.flowPauseDurationMs;
const PIPELINE_BREATH_IN_DURATION = SCAN_PROGRESS_STYLE_TOKENS.motion.breathInDurationMs;
const PIPELINE_BREATH_OUT_DURATION = SCAN_PROGRESS_STYLE_TOKENS.motion.breathOutDurationMs;
const PIPELINE_BREATH_PAUSE_DURATION = SCAN_PROGRESS_STYLE_TOKENS.motion.breathPauseDurationMs;
const PIPELINE_SETTLE_DURATION = SCAN_PROGRESS_STYLE_TOKENS.motion.settleDurationMs;
const PIPELINE_RESULT_REVEAL_DURATION = SCAN_PROGRESS_STYLE_TOKENS.motion.resultRevealDurationMs;
const PIPELINE_RESULT_REVEAL_DELAY = SCAN_PROGRESS_STYLE_TOKENS.motion.resultRevealDelayMs;

function createPauseAnimation(duration: number) {
  return Animated.timing(new Animated.Value(0), {
    toValue: 0,
    duration,
    useNativeDriver: true,
  });
}

export interface ScanProgressProps {
  isVisible: boolean;
  current: number;
  total: number;
  currentFileName?: string | null;
  resultsCount?: number;
  theme: AppThemePalette;
  onCancel?: () => void;
  onComplete?: () => void;
  locale?: 'zh-CN' | 'en-US';
  embedded?: boolean;
}

export function ScanProgress({
  isVisible,
  current,
  total,
  currentFileName,
  resultsCount = 0,
  theme,
  onCancel,
  onComplete,
  locale = 'zh-CN',
  embedded = false,
}: ScanProgressProps) {
  void currentFileName;
  void onComplete;

  const shimmerProgress = useRef(new Animated.Value(0)).current;
  const breathOpacity = useRef(new Animated.Value(SCAN_PROGRESS_STYLE_TOKENS.motion.breathInitialOpacity)).current;
  const motionOpacity = useRef(new Animated.Value(1)).current;
  const resultOpacity = useRef(new Animated.Value(0)).current;
  const shimmerLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const breathLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  const styles = useMemo(() => createStyles(theme, embedded), [embedded, theme]);
  const activeFillColor = theme.scheme === 'dark'
    ? SCAN_PROGRESS_STYLE_TOKENS.color.activeFillDark
    : SCAN_PROGRESS_STYLE_TOKENS.color.activeFillLight;
  const doneFillColor = theme.scheme === 'dark'
    ? SCAN_PROGRESS_STYLE_TOKENS.color.doneFillDark
    : SCAN_PROGRESS_STYLE_TOKENS.color.doneFillLight;
  const safeTotal = total > 0 ? total : 0;
  const safeCurrent = safeTotal > 0 ? Math.min(current, safeTotal) : 0;
  const percentage = safeTotal > 0 ? Math.min(Math.round((safeCurrent / safeTotal) * 100), 100) : 0;
  const isComplete = safeTotal > 0 && safeCurrent >= safeTotal;
  const isPreparing = isVisible && safeTotal === 0 && !isComplete;
  const shouldRender = isVisible || isComplete;
  const shouldShowResultBadge = isComplete && resultsCount > 0;
  const shimmerTranslateX = shimmerProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [-PIPELINE_WAKE_WIDTH, PIPELINE_TRAVEL_WIDTH + PIPELINE_SEGMENT_WIDTH],
  });
  const wakeTranslateX = shimmerProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [-PIPELINE_WAKE_WIDTH, PIPELINE_TRAVEL_WIDTH + PIPELINE_WAKE_WIDTH],
  });
  const shimmerOpacity = shimmerProgress.interpolate({
    inputRange: [0, 0.08, 0.18, 0.8, 0.92, 1],
    outputRange: [0, 0.24, 0.86, 0.86, 0.24, 0],
  });
  const wakeOpacity = shimmerProgress.interpolate({
    inputRange: [0, 0.06, 0.2, 0.82, 0.96, 1],
    outputRange: [0, 0.16, 0.42, 0.42, 0.12, 0],
  });
  const shimmerScaleX = shimmerProgress.interpolate({
    inputRange: [0, 0.22, 0.56, 1],
    outputRange: [0.92, 0.98, 1.08, 0.94],
  });
  const wakeScaleX = shimmerProgress.interpolate({
    inputRange: [0, 0.16, 0.58, 1],
    outputRange: [0.88, 0.96, 1.14, 1],
  });

  useEffect(() => {
    if (!shouldRender) {
      shimmerLoopRef.current?.stop();
      breathLoopRef.current?.stop();
      shimmerLoopRef.current = null;
      breathLoopRef.current = null;
      shimmerProgress.setValue(0);
      breathOpacity.setValue(1);
      motionOpacity.setValue(1);
      resultOpacity.setValue(0);
      return;
    }

    if (isComplete) {
      shimmerLoopRef.current?.stop();
      breathLoopRef.current?.stop();
      shimmerLoopRef.current = null;
      breathLoopRef.current = null;
      resultOpacity.stopAnimation();

      Animated.parallel([
        Animated.timing(motionOpacity, {
          toValue: 0,
          duration: PIPELINE_SETTLE_DURATION,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.sequence([
          createPauseAnimation(PIPELINE_RESULT_REVEAL_DELAY),
          Animated.timing(resultOpacity, {
            toValue: 1,
            duration: PIPELINE_RESULT_REVEAL_DURATION,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ]).start(({ finished }) => {
        if (!finished) {
          return;
        }

        breathOpacity.setValue(SCAN_PROGRESS_STYLE_TOKENS.motion.breathDoneOpacity);
      });

      return;
    }

    motionOpacity.stopAnimation();
    resultOpacity.stopAnimation();
    motionOpacity.setValue(1);
    resultOpacity.setValue(0);
    shimmerProgress.setValue(0);
    breathOpacity.setValue(SCAN_PROGRESS_STYLE_TOKENS.motion.breathInitialOpacity);

    const shimmerLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerProgress, {
          toValue: 1,
          duration: PIPELINE_FLOW_DURATION,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        createPauseAnimation(PIPELINE_FLOW_PAUSE_DURATION),
      ]),
    );
    const breathLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathOpacity, {
          toValue: SCAN_PROGRESS_STYLE_TOKENS.motion.breathMaxOpacity,
          duration: PIPELINE_BREATH_IN_DURATION,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(breathOpacity, {
          toValue: SCAN_PROGRESS_STYLE_TOKENS.motion.breathMinOpacity,
          duration: PIPELINE_BREATH_OUT_DURATION,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        createPauseAnimation(PIPELINE_BREATH_PAUSE_DURATION),
      ]),
    );

    shimmerLoopRef.current = shimmerLoop;
    breathLoopRef.current = breathLoop;
    shimmerLoop.start();
    breathLoop.start();

    return () => {
      shimmerLoopRef.current?.stop();
      breathLoopRef.current?.stop();
      shimmerLoopRef.current = null;
      breathLoopRef.current = null;
    };
  }, [
    breathOpacity,
    isComplete,
    motionOpacity,
    resultOpacity,
    shimmerProgress,
    shouldRender,
  ]);

  if (!shouldRender) {
    return null;
  }

  const copy = getAppCopy(locale).components.scanProgress;
  const statusText = isComplete
    ? copy.complete
    : isPreparing
      ? copy.preparing
      : copy.scanning;
  const countText = safeTotal > 0 ? `${safeCurrent}/${safeTotal}` : copy.pendingCount;
  const resultText = copy.completedResults(resultsCount);
  const fillWidth = (safeTotal > 0
    ? `${Math.max(percentage, SCAN_PROGRESS_STYLE_TOKENS.pipeline.minimumFillPercent)}%`
    : `${SCAN_PROGRESS_STYLE_TOKENS.pipeline.preparingFillPercent}%`) as `${number}%`;

  return (
    <View style={styles.container} testID="scan-progress-inline">
      <View style={styles.headerRow}>
        <View style={styles.headerTextGroup}>
          <Text style={styles.statusText}>{statusText}</Text>
          {shouldShowResultBadge ? (
            <Animated.View
              style={[
                styles.resultBadge,
                {
                  opacity: resultOpacity,
                  transform: [
                    {
                      translateY: resultOpacity.interpolate({
                        inputRange: [0, 1],
                        outputRange: [3, 0],
                      }),
                    },
                    {
                      scale: resultOpacity.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.97, 1],
                      }),
                    },
                  ],
                },
              ]}
              testID="scan-progress-result-badge"
            >
              <Text style={styles.resultBadgeText} testID="scan-progress-result-text">
                {resultText}
              </Text>
            </Animated.View>
          ) : null}
        </View>

        <View style={styles.headerMetaGroup}>
          <Text style={styles.countText}>{countText}</Text>
          {!isComplete && isVisible ? (
            <Pressable
              style={styles.cancelButton}
              onPress={onCancel}
              testID="cancel-scan-button"
            >
              <Text style={styles.cancelText}>{copy.cancel}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <Progress
        theme={theme}
        value={safeTotal > 0
          ? Math.max(percentage, SCAN_PROGRESS_STYLE_TOKENS.pipeline.minimumFillPercent)
          : SCAN_PROGRESS_STYLE_TOKENS.pipeline.preparingFillPercent}
        trackStyle={styles.pipelineTrack}
        indicatorStyle={[
          styles.pipelineFill,
          { backgroundColor: isComplete ? doneFillColor : activeFillColor },
        ]}
        testID="scan-progress-track"
        indicatorTestID="scan-progress-fill"
      >
        <Animated.View
          style={[styles.pipelineMotionLayer, { opacity: motionOpacity }]}
          testID="scan-progress-motion-layer"
        >
          <Animated.View
            style={[
              styles.pipelineFill,
              styles.pipelineGlow,
              {
                width: fillWidth,
                opacity: breathOpacity,
              },
            ]}
          />
          <Animated.View
            style={[
              styles.pipelineWake,
              {
                opacity: wakeOpacity,
                transform: [{ translateX: wakeTranslateX }, { scaleX: wakeScaleX }],
              },
            ]}
            testID="scan-progress-wake"
          />
          <Animated.View
            style={[
              styles.pipelineShimmer,
              {
                opacity: shimmerOpacity,
                transform: [{ translateX: shimmerTranslateX }, { scaleX: shimmerScaleX }],
              },
            ]}
            testID="scan-progress-shimmer"
          />
        </Animated.View>
      </Progress>
    </View>
  );
}

function createStyles(theme: AppThemePalette, embedded: boolean) {
  const glowColor = theme.scheme === 'dark'
    ? SCAN_PROGRESS_STYLE_TOKENS.color.glowDark
    : SCAN_PROGRESS_STYLE_TOKENS.color.glowLight;
  const wakeColor = theme.scheme === 'dark'
    ? SCAN_PROGRESS_STYLE_TOKENS.color.wakeDark
    : SCAN_PROGRESS_STYLE_TOKENS.color.wakeLight;
  const shimmerColor = theme.scheme === 'dark'
    ? SCAN_PROGRESS_STYLE_TOKENS.color.shimmerDark
    : SCAN_PROGRESS_STYLE_TOKENS.color.shimmerLight;

  return StyleSheet.create({
    container: {
      marginTop: embedded ? 2 : SCAN_PROGRESS_STYLE_TOKENS.layout.containerMarginTop,
      marginHorizontal: embedded ? 0 : SCAN_PROGRESS_STYLE_TOKENS.layout.containerMarginHorizontal,
      paddingHorizontal: embedded ? 0 : SCAN_PROGRESS_STYLE_TOKENS.layout.containerPaddingHorizontal,
      paddingVertical: embedded ? 0 : SCAN_PROGRESS_STYLE_TOKENS.layout.containerPaddingVertical,
      borderRadius: embedded ? 0 : SCAN_PROGRESS_STYLE_TOKENS.radius.card,
      borderWidth: embedded ? 0 : 1,
      borderColor: theme.cardBorder,
      backgroundColor: embedded ? 'transparent' : theme.cardBackground,
      shadowColor: theme.shadowColor,
      shadowOffset: { width: 0, height: SCAN_PROGRESS_STYLE_TOKENS.layout.shadowOffsetY },
      shadowOpacity: embedded ? 0 : theme.scheme === 'dark' ? 0.18 : 0.08,
      shadowRadius: embedded ? 0 : SCAN_PROGRESS_STYLE_TOKENS.layout.shadowRadius,
      elevation: embedded ? 0 : SCAN_PROGRESS_STYLE_TOKENS.layout.elevation,
      gap: SCAN_PROGRESS_STYLE_TOKENS.gap.container,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: SCAN_PROGRESS_STYLE_TOKENS.gap.headerRow,
    },
    headerTextGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SCAN_PROGRESS_STYLE_TOKENS.gap.headerTextGroup,
      flexShrink: 1,
      flex: 1,
      minWidth: 0,
    },
    headerMetaGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SCAN_PROGRESS_STYLE_TOKENS.gap.headerMetaGroup,
      flexShrink: 0,
    },
    statusText: {
      fontSize: SCAN_PROGRESS_STYLE_TOKENS.typography.statusSize,
      fontWeight: SCAN_PROGRESS_STYLE_TOKENS.typography.statusWeight,
      color: theme.pageTextSecondary,
      letterSpacing: SCAN_PROGRESS_STYLE_TOKENS.typography.statusLetterSpacing,
    },
    resultBadge: {
      maxWidth: '100%',
      paddingHorizontal: SCAN_PROGRESS_STYLE_TOKENS.badge.paddingHorizontal,
      paddingVertical: SCAN_PROGRESS_STYLE_TOKENS.badge.paddingVertical,
      borderRadius: SCAN_PROGRESS_STYLE_TOKENS.radius.pill,
      borderWidth: SCAN_PROGRESS_STYLE_TOKENS.badge.borderWidth,
      borderColor: theme.noticeBorder,
      backgroundColor: theme.noticeBackground,
    },
    resultBadgeText: {
      fontSize: SCAN_PROGRESS_STYLE_TOKENS.typography.resultBadgeSize,
      fontWeight: SCAN_PROGRESS_STYLE_TOKENS.typography.resultBadgeWeight,
      color: theme.noticeTitle,
    },
    countText: {
      fontSize: SCAN_PROGRESS_STYLE_TOKENS.typography.countSize,
      fontWeight: SCAN_PROGRESS_STYLE_TOKENS.typography.countWeight,
      color: theme.pageTextPrimary,
    },
    cancelButton: {
      paddingHorizontal: SCAN_PROGRESS_STYLE_TOKENS.cancelButton.paddingHorizontal,
      paddingVertical: SCAN_PROGRESS_STYLE_TOKENS.cancelButton.paddingVertical,
      borderRadius: SCAN_PROGRESS_STYLE_TOKENS.radius.pill,
      backgroundColor: theme.buttonSecondaryBackground,
    },
    cancelText: {
      fontSize: SCAN_PROGRESS_STYLE_TOKENS.typography.cancelSize,
      fontWeight: SCAN_PROGRESS_STYLE_TOKENS.typography.cancelWeight,
      color: theme.buttonSecondaryText,
    },
    pipelineTrack: {
      position: 'relative',
      height: SCAN_PROGRESS_STYLE_TOKENS.pipeline.height,
      borderRadius: SCAN_PROGRESS_STYLE_TOKENS.radius.pill,
      overflow: 'hidden',
      backgroundColor: theme.cardMutedBackground,
      borderWidth: SCAN_PROGRESS_STYLE_TOKENS.pipeline.borderWidth,
      borderColor: theme.cardMutedBorder,
    },
    pipelineFill: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      borderRadius: SCAN_PROGRESS_STYLE_TOKENS.radius.pill,
    },
    pipelineMotionLayer: {
      ...StyleSheet.absoluteFillObject,
    },
    pipelineGlow: {
      backgroundColor: glowColor,
    },
    pipelineWake: {
      position: 'absolute',
      top: SCAN_PROGRESS_STYLE_TOKENS.pipeline.edgeInset,
      bottom: SCAN_PROGRESS_STYLE_TOKENS.pipeline.edgeInset,
      width: PIPELINE_WAKE_WIDTH,
      borderRadius: SCAN_PROGRESS_STYLE_TOKENS.radius.pill,
      backgroundColor: wakeColor,
    },
    pipelineShimmer: {
      position: 'absolute',
      top: SCAN_PROGRESS_STYLE_TOKENS.pipeline.edgeInset,
      bottom: SCAN_PROGRESS_STYLE_TOKENS.pipeline.edgeInset,
      width: PIPELINE_SEGMENT_WIDTH,
      borderRadius: SCAN_PROGRESS_STYLE_TOKENS.radius.pill,
      backgroundColor: shimmerColor,
    },
  });
}
