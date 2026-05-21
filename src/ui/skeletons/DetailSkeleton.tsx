import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { AppLanguage } from '../../i18n/app-language';
import { getAppCopy } from '../../i18n/app-copy';
import type { AppThemePalette } from '../../theme/app-theme';
import { COMPONENT_TOKENS } from '../../theme/generated/component-tokens.generated';
import { SKELETON_TOKENS } from '../../theme/generated/skeleton-tokens.generated';
import { Card } from '../primitives';
import { SkeletonBlock } from './SkeletonBlock';

const DETAIL_STYLE_TOKENS = COMPONENT_TOKENS.detail;

interface DetailSkeletonCopy {
  skeletonLabel: string;
}

interface DetailSkeletonProps {
  language: AppLanguage;
  theme: AppThemePalette;
}

export const DetailSkeleton = memo(function DetailSkeleton({
  language,
  theme,
}: DetailSkeletonProps) {
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(insets), [insets]);
  const copy = getAppCopy(language);
  const accessibilityLabel = (copy.preview as typeof copy.preview & DetailSkeletonCopy)
    .skeletonLabel;

  return (
    <View style={styles.container} testID="detail-skeleton">
      <View style={styles.header}>
        <SkeletonBlock
          accessibilityLabel={accessibilityLabel}
          height={18}
          scheme={theme.scheme}
          testID="detail-skeleton-index"
          width={58}
        />
        <SkeletonBlock
          accessibilityLabel={accessibilityLabel}
          height={44}
          scheme={theme.scheme}
          style={styles.closeButton}
          testID="detail-skeleton-close"
          width={44}
        />
      </View>

      <View style={styles.stageWrap}>
        <SkeletonBlock
          accessibilityLabel={accessibilityLabel}
          height={420}
          scheme={theme.scheme}
          style={styles.stage}
          testID="detail-skeleton-stage"
          width="100%"
        />
      </View>

      <Card theme={theme} style={styles.footerOverlay}>
        <View style={styles.tagRow}>
          {[0, 1, 2].map((index) => (
            <SkeletonBlock
              key={index}
              accessibilityLabel={accessibilityLabel}
              height={24}
              scheme={theme.scheme}
              style={styles.tag}
              testID={`detail-skeleton-tag-${index}`}
              width={index === 0 ? 48 : 72}
            />
          ))}
        </View>
        <View style={styles.actionRow}>
          <SkeletonBlock
            accessibilityLabel={accessibilityLabel}
            height={44}
            scheme={theme.scheme}
            style={styles.action}
            testID="detail-skeleton-primary-action"
            width={92}
          />
          <SkeletonBlock
            accessibilityLabel={accessibilityLabel}
            height={44}
            scheme={theme.scheme}
            style={styles.action}
            testID="detail-skeleton-secondary-action"
            width={92}
          />
        </View>
      </Card>
    </View>
  );
});

function createStyles(insets: { top: number; bottom: number; left: number; right: number }) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: DETAIL_STYLE_TOKENS.color.background,
      paddingTop: Math.max(insets.top, 16),
      paddingBottom: Math.max(insets.bottom, 18),
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      minHeight: 34,
      marginBottom: 10,
      paddingLeft: 16 + insets.left,
      paddingRight: 16 + insets.right,
      zIndex: 10,
      elevation: 10,
    },
    closeButton: {
      borderRadius: 22,
    },
    stageWrap: {
      flex: 1,
      width: '100%',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: 280,
      paddingHorizontal: 16 + Math.max(insets.left, insets.right),
      paddingBottom: 124,
    },
    stage: {
      minHeight: 420,
      borderRadius: SKELETON_TOKENS.layout.blockRadius,
    },
    footerOverlay: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      gap: 10,
      borderWidth: 0,
      backgroundColor: 'transparent',
      padding: 0,
      paddingLeft: 16 + insets.left,
      paddingRight: 16 + insets.right,
      paddingBottom: Math.max(insets.bottom, 12),
    },
    tagRow: {
      flexDirection: 'row',
      gap: 5,
      alignItems: 'center',
      minHeight: 36,
      overflow: 'hidden',
    },
    tag: {
      borderRadius: 12,
    },
    actionRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 10,
    },
    action: {
      borderRadius: 14,
    },
  });
}
