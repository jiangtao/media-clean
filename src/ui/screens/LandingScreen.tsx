import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppPreferences } from '../../application/AppPreferencesContext';
import type { AppLanguage } from '../../i18n/app-language';
import type { AppThemePalette } from '../../theme/app-theme';

interface LandingNavigation {
  replace: (routeName: 'Main') => void;
}

interface LandingStep {
  key: string;
  title: string;
  description: string;
}

interface LandingTrustPoint {
  title: string;
  description: string;
}

function getLandingCopy(language: AppLanguage) {
  if (language === 'en-US') {
    return {
      eyebrow: 'Local album assistant',
      title: 'Five steps to a cleaner gallery',
      subtitle: 'Scan, identify, filter, clean, and review the report in one calm flow.',
      body: 'Built for quick sessions: clear decisions, local processing, and safe cleanup.',
      action: 'Continue to Main',
      footer: 'Processing stays on device first, with clear review points before deletion.',
      sectionTitle: 'The flow',
      trustTitle: 'Trust points',
      steps: [
        { key: 'scan', title: 'Scan', description: 'Collect recent photos and videos into a clear review set.' },
        { key: 'identify', title: 'Identify', description: 'Spot duplicates, blurry shots, screenshots, and similar media.' },
        { key: 'filter', title: 'Filter', description: 'Narrow the list with simple, local-first review decisions.' },
        { key: 'clean', title: 'Clean', description: 'Remove what you choose, with a predictable and reversible flow.' },
        { key: 'report', title: 'Report', description: 'Summarize what changed so you can verify the result quickly.' },
      ] satisfies LandingStep[],
      trustPoints: [
        {
          title: 'Local first',
          description: 'Media analysis starts on the device and does not rely on cloud processing.',
        },
        {
          title: 'Safe cleanup',
          description: 'Deletion happens only after review, so the result stays understandable and controlled.',
        },
        {
          title: 'Background processing',
          description: 'Scanning and sorting can continue in the background without interrupting your session.',
        },
      ] satisfies LandingTrustPoint[],
    };
  }

  return {
    eyebrow: '本地相册助手',
    title: '五步完成清理',
    subtitle: '扫描、识别、筛选、清理、报告，一条清晰的本地处理流程。',
    body: '适合碎片时间快速处理相册，重点是看得清、判得准、删得安心。',
    action: '继续进入 Main',
    footer: '所有处理优先在设备本地完成，删除前保持清晰可复核。',
    sectionTitle: '五步流程',
    trustTitle: '信任点',
    steps: [
      { key: 'scan', title: '扫描', description: '快速聚合最近媒体，先把要处理的内容找出来。' },
      { key: 'identify', title: '识别', description: '识别重复、模糊、截图和相似媒体，减少误删。' },
      { key: 'filter', title: '筛选', description: '按保留、待定、清理分层，判断更直接。' },
      { key: 'clean', title: '清理', description: '只清理你确认的内容，动作清楚，结果可预期。' },
      { key: 'report', title: '报告', description: '完成后给出结果摘要，方便你快速回看。' },
    ] satisfies LandingStep[],
    trustPoints: [
      {
        title: '本地优先',
        description: '原始媒体和识别过程优先留在设备本地，不先上传云端。',
      },
      {
        title: '安全清理',
        description: '删除前可复核，清理过程尽量保持可理解、可预期。',
      },
      {
        title: '后台处理',
        description: '扫描和整理可以在后台继续，不打断你当前操作。',
      },
    ] satisfies LandingTrustPoint[],
  };
}

export function LandingScreen({ navigation }: { navigation: LandingNavigation }) {
  const { language, theme } = useAppPreferences();
  const insets = useSafeAreaInsets();
  const copy = useMemo(() => getLandingCopy(language), [language]);
  const styles = useMemo(() => createStyles(theme, insets), [insets, theme]);

  return (
    <View style={styles.container} testID="landing-screen">
      <View style={styles.halo} />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
        testID="landing-scroll-view"
      >
        <View style={styles.card}>
          <View style={styles.hero}>
            <View style={styles.iconShell}>
              <Ionicons name="shield-checkmark-outline" size={22} color={theme.buttonPrimaryBackground} />
            </View>

            <Text style={styles.eyebrow}>{copy.eyebrow}</Text>
            <Text style={styles.title}>{copy.title}</Text>
            <Text style={styles.subtitle}>{copy.subtitle}</Text>
            <Text style={styles.body}>{copy.body}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{copy.sectionTitle}</Text>
            <View style={styles.stepList} testID="landing-step-list">
              {copy.steps.map((step, index) => (
                <View key={step.key} style={styles.stepCard} testID="landing-step">
                  <View style={styles.stepNumberShell}>
                    <Text style={styles.stepNumber}>{String(index + 1).padStart(2, '0')}</Text>
                  </View>
                  <View style={styles.stepBody}>
                    <Text style={styles.stepTitle}>{step.title}</Text>
                    <Text style={styles.stepDescription}>{step.description}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{copy.trustTitle}</Text>
            <View style={styles.trustList} testID="landing-trust-list">
              {copy.trustPoints.map((point) => (
                <View key={point.title} style={styles.trustCard} testID="landing-trust-point">
                  <Text style={styles.trustTitle}>{point.title}</Text>
                  <Text style={styles.trustDescription}>{point.description}</Text>
                </View>
              ))}
            </View>
          </View>

          <Pressable
            onPress={() => navigation.replace('Main')}
            style={styles.actionButton}
            testID="landing-primary-action"
          >
            <Text style={styles.actionText}>{copy.action}</Text>
          </Pressable>

          <Text style={styles.footer}>{copy.footer}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

function createStyles(
  theme: AppThemePalette,
  insets: { top: number; bottom: number; left: number; right: number },
) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.safeArea,
      paddingTop: insets.top + 24,
      paddingBottom: insets.bottom + 24,
      paddingLeft: 20 + insets.left,
      paddingRight: 20 + insets.right,
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: 'center',
    },
    halo: {
      position: 'absolute',
      top: insets.top + 32,
      right: -24,
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: theme.heroAccent,
      opacity: 0.12,
    },
    card: {
      gap: 18,
      borderRadius: 24,
      padding: 20,
      backgroundColor: theme.cardBackground,
      borderWidth: 1,
      borderColor: theme.cardBorder,
      shadowColor: theme.shadowColor,
      shadowOpacity: 0.08,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 10 },
      elevation: 3,
    },
    iconShell: {
      width: 42,
      height: 42,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.buttonSecondaryBackground,
    },
    hero: {
      gap: 10,
    },
    eyebrow: {
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.5,
      color: theme.pageTextSecondary,
      textTransform: 'uppercase',
    },
    title: {
      fontSize: 30,
      lineHeight: 36,
      fontWeight: '800',
      color: theme.pageTextPrimary,
      letterSpacing: -0.4,
    },
    subtitle: {
      fontSize: 15,
      lineHeight: 22,
      fontWeight: '600',
      color: theme.pageTextSecondary,
    },
    body: {
      fontSize: 13,
      lineHeight: 20,
      color: theme.pageTextMuted,
    },
    section: {
      gap: 10,
    },
    sectionTitle: {
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '800',
      color: theme.pageTextPrimary,
      letterSpacing: -0.1,
    },
    stepList: {
      gap: 10,
    },
    stepCard: {
      flexDirection: 'row',
      gap: 12,
      padding: 12,
      borderRadius: 18,
      backgroundColor: theme.buttonSecondaryBackground,
      borderWidth: 1,
      borderColor: theme.cardBorder,
    },
    stepNumberShell: {
      width: 32,
      height: 32,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.cardBackground,
      borderWidth: 1,
      borderColor: theme.cardBorder,
    },
    stepNumber: {
      fontSize: 11,
      fontWeight: '800',
      color: theme.pageTextSecondary,
      letterSpacing: 0.4,
    },
    stepBody: {
      flex: 1,
      gap: 3,
      minWidth: 0,
    },
    stepTitle: {
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '800',
      color: theme.pageTextPrimary,
    },
    stepDescription: {
      fontSize: 12,
      lineHeight: 18,
      color: theme.pageTextSecondary,
    },
    trustList: {
      gap: 8,
    },
    trustCard: {
      gap: 4,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 16,
      backgroundColor: theme.noticeBackground,
      borderWidth: 1,
      borderColor: theme.noticeBorder,
    },
    trustTitle: {
      fontSize: 13,
      lineHeight: 18,
      fontWeight: '800',
      color: theme.noticeTitle,
    },
    trustDescription: {
      fontSize: 12,
      lineHeight: 18,
      color: theme.noticeText,
    },
    actionButton: {
      marginTop: 8,
      alignSelf: 'flex-start',
      borderRadius: 999,
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: theme.buttonPrimaryBackground,
    },
    actionText: {
      fontSize: 14,
      fontWeight: '800',
      color: theme.buttonPrimaryText,
    },
    footer: {
      fontSize: 12,
      lineHeight: 18,
      color: theme.pageTextMuted,
    },
  });
}
