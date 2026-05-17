import React, { useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';

import type { AppThemePalette } from '../../theme/app-theme';

const PIPELINE_SEGMENT_WIDTH = 40;
const PIPELINE_WAKE_WIDTH = 72;
const PIPELINE_TRAVEL_WIDTH = 320;
const PIPELINE_FLOW_DURATION = 2_080;
const PIPELINE_FLOW_PAUSE_DURATION = 120;
const PIPELINE_BREATH_IN_DURATION = 960;
const PIPELINE_BREATH_OUT_DURATION = 1_260;
const PIPELINE_BREATH_PAUSE_DURATION = 140;
const PIPELINE_SETTLE_DURATION = 460;
const PIPELINE_RESULT_REVEAL_DURATION = 360;
const PIPELINE_RESULT_REVEAL_DELAY = 70;

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
  const breathOpacity = useRef(new Animated.Value(0.62)).current;
  const motionOpacity = useRef(new Animated.Value(1)).current;
  const resultOpacity = useRef(new Animated.Value(0)).current;
  const shimmerLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const breathLoopRef = useRef<Animated.CompositeAnimation | null>(null);

  const styles = useMemo(() => createStyles(theme, embedded), [embedded, theme]);
  const activeFillColor = theme.scheme === 'dark' ? '#82cfc1' : '#1f6b64';
  const doneFillColor = theme.scheme === 'dark' ? '#9edc95' : '#3f8f58';
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

        breathOpacity.setValue(1);
      });

      return;
    }

    motionOpacity.stopAnimation();
    resultOpacity.stopAnimation();
    motionOpacity.setValue(1);
    resultOpacity.setValue(0);
    shimmerProgress.setValue(0);
    breathOpacity.setValue(0.62);

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
          toValue: 0.94,
          duration: PIPELINE_BREATH_IN_DURATION,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(breathOpacity, {
          toValue: 0.58,
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

  const copy = getCopy(locale);
  const statusText = isComplete
    ? copy.complete
    : isPreparing
      ? copy.preparing
      : copy.scanning;
  const countText = safeTotal > 0 ? `${safeCurrent}/${safeTotal}` : copy.pendingCount;
  const resultText = copy.completedResults(resultsCount);
  const fillWidth = (safeTotal > 0 ? `${Math.max(percentage, 6)}%` : '12%') as `${number}%`;

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

      <View style={styles.pipelineTrack} testID="scan-progress-track">
        <View
          style={[
            styles.pipelineFill,
            { width: fillWidth, backgroundColor: isComplete ? doneFillColor : activeFillColor },
          ]}
          testID="scan-progress-fill"
        />
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
      </View>
    </View>
  );
}

function getCopy(locale: 'zh-CN' | 'en-US') {
  if (locale === 'en-US') {
    return {
      scanning: 'Scanning',
      preparing: 'Preparing',
      complete: 'Scan Complete',
      cancel: 'Cancel',
      pendingCount: '0/0',
      completedResults: (count: number) => `Found ${count} items to review`,
    };
  }

  return {
    scanning: '扫描中',
    preparing: '扫描准备中',
    complete: '扫描完成',
    cancel: '取消',
    pendingCount: '0/0',
    completedResults: (count: number) => `发现 ${count} 个待处理媒体`,
  };
}

function createStyles(theme: AppThemePalette, embedded: boolean) {
  const glowColor = theme.scheme === 'dark' ? 'rgba(130, 207, 193, 0.34)' : 'rgba(31, 107, 100, 0.18)';
  const wakeColor = theme.scheme === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.24)';
  const shimmerColor = theme.scheme === 'dark' ? 'rgba(255, 255, 255, 0.28)' : 'rgba(255, 255, 255, 0.54)';

  return StyleSheet.create({
    container: {
      marginTop: embedded ? 2 : 8,
      marginHorizontal: embedded ? 0 : 16,
      paddingHorizontal: embedded ? 0 : 14,
      paddingVertical: embedded ? 0 : 12,
      borderRadius: embedded ? 0 : 16,
      borderWidth: embedded ? 0 : 1,
      borderColor: theme.cardBorder,
      backgroundColor: embedded ? 'transparent' : theme.cardBackground,
      shadowColor: theme.shadowColor,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: embedded ? 0 : theme.scheme === 'dark' ? 0.18 : 0.08,
      shadowRadius: embedded ? 0 : 18,
      elevation: embedded ? 0 : 4,
      gap: 10,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    headerTextGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flexShrink: 1,
      flex: 1,
      minWidth: 0,
    },
    headerMetaGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      flexShrink: 0,
    },
    statusText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.pageTextSecondary,
      letterSpacing: 0.4,
    },
    resultBadge: {
      maxWidth: '100%',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.noticeBorder,
      backgroundColor: theme.noticeBackground,
    },
    resultBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.noticeTitle,
    },
    countText: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.pageTextPrimary,
    },
    cancelButton: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: theme.buttonSecondaryBackground,
    },
    cancelText: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.buttonSecondaryText,
    },
    pipelineTrack: {
      position: 'relative',
      height: 10,
      borderRadius: 999,
      overflow: 'hidden',
      backgroundColor: theme.cardMutedBackground,
      borderWidth: 1,
      borderColor: theme.cardMutedBorder,
    },
    pipelineFill: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      borderRadius: 999,
    },
    pipelineMotionLayer: {
      ...StyleSheet.absoluteFillObject,
    },
    pipelineGlow: {
      backgroundColor: glowColor,
    },
    pipelineWake: {
      position: 'absolute',
      top: 1,
      bottom: 1,
      width: PIPELINE_WAKE_WIDTH,
      borderRadius: 999,
      backgroundColor: wakeColor,
    },
    pipelineShimmer: {
      position: 'absolute',
      top: 1,
      bottom: 1,
      width: PIPELINE_SEGMENT_WIDTH,
      borderRadius: 999,
      backgroundColor: shimmerColor,
    },
  });
}
