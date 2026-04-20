import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppPreferences } from '../../application/AppPreferencesContext';
import type { AppLanguage } from '../../i18n/app-language';
import type { AppThemePalette } from '../../theme/app-theme';

interface LandingNavigation {
  replace: (routeName: 'Main') => void;
}

function getLandingCopy(language: AppLanguage) {
  if (language === 'en-US') {
    return {
      eyebrow: 'MediaClean',
      title: 'Media cleanup',
      subtitle: 'Local, calm, and focused cleanup for photos and videos.',
      body: 'Scan recent media, review results, and keep decisions on device.',
      action: 'Enter media cleanup',
      footer: 'Everything stays on this device until you decide.',
    };
  }

  return {
    eyebrow: 'MediaClean',
    title: '媒体清理',
    subtitle: '简洁、利落、可信的本地媒体清理入口。',
    body: '先看结果，再做决定。扫描、筛选、保留都在本机完成。',
    action: '进入媒体清理',
    footer: '所有识别与整理都在设备本地进行。',
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
      <View style={styles.card}>
        <View style={styles.iconShell}>
          <Ionicons name="images-outline" size={22} color={theme.buttonPrimaryBackground} />
        </View>

        <Text style={styles.eyebrow}>{copy.eyebrow}</Text>
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.subtitle}>{copy.subtitle}</Text>
        <Text style={styles.body}>{copy.body}</Text>

        <Pressable
          onPress={() => navigation.replace('Main')}
          style={styles.actionButton}
          testID="landing-primary-action"
        >
          <Text style={styles.actionText}>{copy.action}</Text>
        </Pressable>

        <Text style={styles.footer}>{copy.footer}</Text>
      </View>
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
      justifyContent: 'center',
      backgroundColor: theme.safeArea,
      paddingTop: insets.top + 24,
      paddingBottom: insets.bottom + 24,
      paddingLeft: 20 + insets.left,
      paddingRight: 20 + insets.right,
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
      gap: 10,
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
