import React, { useCallback, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import { getAppTheme, type AppThemePreference, APP_THEME_PREFERENCES } from '../../theme/app-theme';
import type { AppLanguage } from '../../i18n/app-language';
import {
  buildReminderSummary,
  createDefaultReminderSettings,
  estimateNextReminderTriggerAt,
  formatReminderTime,
  listReminderFrequencyOptions,
  listReminderWeekdayOptions,
  type ReminderSettings,
} from '../../features/reminders/reminder-settings';
import {
  reconcileReminderRuntimeOnLaunch,
  reconcileReminderRuntimeSettings,
  syncReminderRuntimeSettings,
} from '../../features/reminders/reminder-runtime';
import {
  loadScanRange,
  saveScanRange,
  VALID_SCAN_RANGES,
  type ScanRange,
} from '../../services/storage/scan-range-storage';
import { loadLastScanMeta } from '../../services/storage/app-storage';
import { useAppPreferences } from '../../application/AppPreferencesContext';
import { buildSettingsScreenLayout } from './screen-layout';

interface SettingsSectionProps {
  title: string;
  children: React.ReactNode;
  theme: ReturnType<typeof getAppTheme>;
  leftInset: number;
  rightInset: number;
}

function SettingsSection({ title, children, theme, leftInset, rightInset }: SettingsSectionProps) {
  const styles = useMemo(
    () => createSectionStyles(theme, leftInset, rightInset),
    [theme, leftInset, rightInset],
  );

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionContent}>
        {children}
      </View>
    </View>
  );
}

function createSectionStyles(theme: ReturnType<typeof getAppTheme>, leftInset: number, rightInset: number) {
  return StyleSheet.create({
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.pageTextMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 12,
      paddingLeft: leftInset,
      paddingRight: rightInset,
    },
    sectionContent: {
      backgroundColor: theme.cardBackground,
      borderRadius: 12,
      marginLeft: leftInset,
      marginRight: rightInset,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.cardBorder,
    },
  });
}

interface SettingsRowProps {
  label: string;
  value?: string;
  onPress?: () => void;
  showArrow?: boolean;
  children?: React.ReactNode;
  theme: ReturnType<typeof getAppTheme>;
  isLast?: boolean;
}

function SettingsRow({ label, value, onPress, showArrow = false, children, theme, isLast = false }: SettingsRowProps) {
  const styles = useMemo(() => createRowStyles(theme, isLast), [theme, isLast]);

  const content = (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.rightContent}>
        {value ? <Text style={styles.value}>{value}</Text> : null}
        {children}
        {showArrow ? <Ionicons name="chevron-forward" size={16} color={theme.pageTextMuted} /> : null}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
        {content}
      </Pressable>
    );
  }

  return content;
}

function createRowStyles(theme: ReturnType<typeof getAppTheme>, isLast: boolean) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
      borderBottomColor: theme.cardBorder,
      minHeight: 48,
    },
    pressed: {
      backgroundColor: theme.cardMutedBackground,
    },
    label: {
      fontSize: 16,
      color: theme.pageTextPrimary,
      flex: 1,
    },
    rightContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    value: {
      fontSize: 15,
      color: theme.pageTextSecondary,
    },
  });
}

export function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const layout = useMemo(() => buildSettingsScreenLayout(insets), [insets]);
  const {
    language,
    themePreference,
    resolvedThemeScheme,
    theme,
    copy,
    setLanguage,
    setThemePreference,
  } = useAppPreferences();
  const [scanRange, setScanRange] = useState<ScanRange>(3);
  const [reminderSettings, setReminderSettings] = useState<ReminderSettings>(
    createDefaultReminderSettings(),
  );
  const [notificationPermissionGranted, setNotificationPermissionGranted] = useState(false);
  const [lastScanTime, setLastScanTime] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const styles = useMemo(() => createStyles(theme, layout), [theme, layout]);
  const reminderChannelCopy = useMemo(
    () => ({
      name: copy.reminder.channelName,
      description: copy.reminder.channelDescription,
    }),
    [copy.reminder.channelDescription, copy.reminder.channelName],
  );
  const reminderFrequencyOptions = useMemo(
    () => listReminderFrequencyOptions(language),
    [language],
  );
  const reminderWeekdayOptions = useMemo(
    () => listReminderWeekdayOptions(language),
    [language],
  );

  // Load saved settings when screen is focused
  useFocusEffect(
    useCallback(() => {
      let isActive = true;

      async function loadSettings() {
        try {
          const [savedScanRange, lastScanMeta, reminderRuntime] = await Promise.all([
            loadScanRange(),
            loadLastScanMeta(),
            reconcileReminderRuntimeOnLaunch(language, reminderChannelCopy),
          ]);

          if (isActive) {
            setScanRange(savedScanRange);
            setLastScanTime(lastScanMeta?.scannedAt ?? null);
            setReminderSettings(reminderRuntime.settings);
            setNotificationPermissionGranted(reminderRuntime.permissionGranted);
            setIsLoading(false);
          }
        } catch (error) {
          console.error('Failed to load settings:', error);
          if (isActive) {
            setIsLoading(false);
          }
        }
      }

      void loadSettings();

      return () => {
        isActive = false;
      };
    }, [language, reminderChannelCopy])
  );

  const handleLanguageChange = useCallback(async (newLanguage: AppLanguage) => {
    if (newLanguage === language) return;

    await setLanguage(newLanguage);
  }, [language, setLanguage]);

  const handleThemeChange = useCallback(async (newTheme: AppThemePreference) => {
    if (newTheme === themePreference) return;

    await setThemePreference(newTheme);
  }, [setThemePreference, themePreference]);

  const handleScanRangeChange = useCallback(async (newRange: ScanRange) => {
    if (newRange === scanRange) return;

    setScanRange(newRange);
    try {
      await saveScanRange(newRange);

      if (reminderSettings.enabled) {
        const reminderRuntime = await reconcileReminderRuntimeSettings(
          reminderSettings,
          language,
          reminderChannelCopy,
        );
        setReminderSettings(reminderRuntime.settings);
        setNotificationPermissionGranted(reminderRuntime.permissionGranted);
      }
    } catch (error) {
      console.error('Failed to save scan range:', error);
    }
  }, [language, reminderChannelCopy, reminderSettings, scanRange]);

  const handleReminderToggle = useCallback(async () => {
    try {
      const reminderRuntime = await syncReminderRuntimeSettings(
        reminderSettings,
        {
          enabled: !reminderSettings.enabled,
        },
        language,
        reminderChannelCopy,
        {
          requestPermissionOnEnable: !reminderSettings.enabled,
        },
      );
      setReminderSettings(reminderRuntime.settings);
      setNotificationPermissionGranted(reminderRuntime.permissionGranted);
    } catch (error) {
      console.error('Failed to toggle reminder settings:', error);
    }
  }, [language, reminderChannelCopy, reminderSettings]);

  const handleReminderFrequencyChange = useCallback(async (
    frequency: ReminderSettings['frequency'],
  ) => {
    if (frequency === reminderSettings.frequency) {
      return;
    }

    try {
      const reminderRuntime = await syncReminderRuntimeSettings(
        reminderSettings,
        { frequency },
        language,
        reminderChannelCopy,
      );
      setReminderSettings(reminderRuntime.settings);
      setNotificationPermissionGranted(reminderRuntime.permissionGranted);
    } catch (error) {
      console.error('Failed to update reminder frequency:', error);
    }
  }, [language, reminderChannelCopy, reminderSettings]);

  const handleReminderWeekdayChange = useCallback(async (weekday: number) => {
    if (weekday === reminderSettings.weekday) {
      return;
    }

    try {
      const reminderRuntime = await syncReminderRuntimeSettings(
        reminderSettings,
        { weekday },
        language,
        reminderChannelCopy,
      );
      setReminderSettings(reminderRuntime.settings);
      setNotificationPermissionGranted(reminderRuntime.permissionGranted);
    } catch (error) {
      console.error('Failed to update reminder weekday:', error);
    }
  }, [language, reminderChannelCopy, reminderSettings]);

  const handleReminderTimeAdjust = useCallback(async (deltaMinutes: number) => {
    const currentMinutes = reminderSettings.hour * 60 + reminderSettings.minute;
    const normalizedMinutes = ((currentMinutes + deltaMinutes) % (24 * 60) + (24 * 60)) % (24 * 60);
    const hour = Math.floor(normalizedMinutes / 60);
    const minute = normalizedMinutes % 60;

    try {
      const reminderRuntime = await syncReminderRuntimeSettings(
        reminderSettings,
        { hour, minute },
        language,
        reminderChannelCopy,
      );
      setReminderSettings(reminderRuntime.settings);
      setNotificationPermissionGranted(reminderRuntime.permissionGranted);
    } catch (error) {
      console.error('Failed to update reminder time:', error);
    }
  }, [language, reminderChannelCopy, reminderSettings]);

  const getThemeLabel = (pref: AppThemePreference): string => {
    switch (pref) {
      case 'system':
        return copy.appearance.system;
      case 'light':
        return copy.appearance.light;
      case 'dark':
        return copy.appearance.dark;
      default:
        return copy.appearance.system;
    }
  };

  const getScanRangeDisplay = (range: ScanRange): string => {
    if (language === 'zh-CN') {
      return `最近 ${range} 个月`;
    }
    return `Last ${range} month${range > 1 ? 's' : ''}`;
  };

  const getLastScanDisplay = (): string => {
    if (!lastScanTime) {
      return copy.common.neverScanned;
    }
    return new Date(lastScanTime).toLocaleString(language, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getCurrentThemeValue = (): string => {
    const currentLabel = getThemeLabel(themePreference);
    if (themePreference === 'system') {
      const systemLabel = resolvedThemeScheme === 'dark' ? copy.appearance.dark : copy.appearance.light;
      return `${currentLabel} (${systemLabel})`;
    }
    return currentLabel;
  };

  const getReminderStatusLabel = (): string => {
    if (!reminderSettings.enabled) {
      return copy.reminder.disabled;
    }

    if (!notificationPermissionGranted) {
      return copy.reminder.unauthorized;
    }

    if (reminderSettings.notificationId) {
      return copy.reminder.scheduled;
    }

    return copy.reminder.pending;
  };

  const getReminderNextLabel = (): string => {
    if (reminderSettings.notificationId) {
      return copy.reminder.nextReminder;
    }

    return notificationPermissionGranted
      ? copy.reminder.estimatedReminder
      : copy.reminder.plannedReminder;
  };

  const getReminderNextDisplay = (): string => {
    const nextTriggerAt =
      reminderSettings.nextTriggerAt ?? estimateNextReminderTriggerAt(reminderSettings);

    if (!nextTriggerAt) {
      return copy.common.notScheduled;
    }

    return new Date(nextTriggerAt).toLocaleString(language, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      testID="settings-scroll-view"
    >
      <View style={styles.header} testID="settings-header">
        <Text style={styles.headerTitle}>{copy.common.statusTitle}</Text>
      </View>

      <SettingsSection
        title={language === 'zh-CN' ? '扫描范围' : 'Scan Range'}
        theme={theme}
        leftInset={layout.left}
        rightInset={layout.right}
      >
        <View style={styles.scanRangeContainer}>
          <Text style={styles.scanRangeValue}>{getScanRangeDisplay(scanRange)}</Text>
          <View style={styles.scanRangeOptions}>
            {VALID_SCAN_RANGES.map((range) => (
              <Pressable
                key={range}
                onPress={() => handleScanRangeChange(range)}
                style={[
                  styles.scanRangeOption,
                  scanRange === range && styles.scanRangeOptionActive,
                ]}
              >
                <Text
                  style={[
                    styles.scanRangeOptionText,
                    scanRange === range && styles.scanRangeOptionTextActive,
                  ]}
                >
                  {range}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </SettingsSection>

      <SettingsSection title={copy.reminder.title} theme={theme} leftInset={layout.left} rightInset={layout.right}>
        <View style={styles.reminderContainer}>
          <View style={styles.reminderHeaderRow}>
            <View style={styles.reminderHeaderText}>
              <Text style={styles.reminderSummaryValue}>
                {buildReminderSummary(reminderSettings, language)}
              </Text>
              <Text style={styles.reminderStatusValue}>
                {copy.reminder.permissionLabel}
                {language === 'zh-CN' ? '：' : ': '}
                {notificationPermissionGranted
                  ? copy.reminder.permissionOn
                  : copy.reminder.permissionOff}
                {' · '}
                {getReminderStatusLabel()}
              </Text>
            </View>
            <Switch
              value={reminderSettings.enabled}
              onValueChange={() => void handleReminderToggle()}
              trackColor={{
                false: theme.cardMutedBackground,
                true: theme.buttonPrimaryBackground,
              }}
              thumbColor={theme.buttonPrimaryText}
            />
          </View>
          <Text style={styles.reminderHint}>
            {copy.reminder.eligibilityHint(scanRange)}
          </Text>
          <Text style={styles.reminderFootnote}>{copy.reminder.footnote}</Text>
        </View>
        {reminderSettings.enabled ? (
          <>
            <SettingsRow
              label={getReminderNextLabel()}
              value={getReminderNextDisplay()}
              theme={theme}
            />
            <View style={styles.reminderControlsSection}>
              <Text style={styles.reminderFieldLabel}>{copy.reminder.frequencyLabel}</Text>
              <View style={styles.reminderChipRow}>
                {reminderFrequencyOptions.map((option) => {
                  const active = reminderSettings.frequency === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => void handleReminderFrequencyChange(option.value)}
                      style={[
                        styles.reminderChip,
                        active && styles.reminderChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.reminderChipText,
                          active && styles.reminderChipTextActive,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            {reminderSettings.frequency === 'weekly' ? (
              <View style={styles.reminderControlsSection}>
                <Text style={styles.reminderFieldLabel}>{copy.reminder.weekdayLabel}</Text>
                <View style={styles.reminderChipRow}>
                  {reminderWeekdayOptions.map((option) => {
                    const active = reminderSettings.weekday === option.value;
                    return (
                      <Pressable
                        key={option.value}
                        onPress={() => void handleReminderWeekdayChange(option.value)}
                        style={[
                          styles.reminderChip,
                          active && styles.reminderChipActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.reminderChipText,
                            active && styles.reminderChipTextActive,
                          ]}
                        >
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}
            <View style={styles.reminderControlsSection}>
              <Text style={styles.reminderFieldLabel}>{copy.reminder.timeLabel}</Text>
              <Text style={styles.reminderTimeValue}>
                {formatReminderTime(reminderSettings)}
              </Text>
              <View style={styles.reminderAdjustRow}>
                <Pressable
                  onPress={() => void handleReminderTimeAdjust(-60)}
                  style={styles.reminderAdjustButton}
                >
                  <Text style={styles.reminderAdjustButtonText}>{copy.reminder.hourMinus}</Text>
                </Pressable>
                <Pressable
                  onPress={() => void handleReminderTimeAdjust(60)}
                  style={styles.reminderAdjustButton}
                >
                  <Text style={styles.reminderAdjustButtonText}>{copy.reminder.hourPlus}</Text>
                </Pressable>
                <Pressable
                  onPress={() => void handleReminderTimeAdjust(-15)}
                  style={styles.reminderAdjustButton}
                >
                  <Text style={styles.reminderAdjustButtonText}>{copy.reminder.minuteMinus}</Text>
                </Pressable>
                <Pressable
                  onPress={() => void handleReminderTimeAdjust(15)}
                  style={styles.reminderAdjustButton}
                >
                  <Text style={styles.reminderAdjustButtonText}>{copy.reminder.minutePlus}</Text>
                </Pressable>
              </View>
            </View>
          </>
        ) : null}
      </SettingsSection>

      <SettingsSection title={copy.languageLabel} theme={theme} leftInset={layout.left} rightInset={layout.right}>
        <View style={styles.languageSelector}>
          {copy.languageOptions.map((option, index) => (
            <Pressable
              key={option.value}
              onPress={() => handleLanguageChange(option.value)}
              style={[
                styles.languageOption,
                language === option.value && styles.languageOptionActive,
                index === copy.languageOptions.length - 1 && styles.languageOptionLast,
              ]}
            >
              <Text
                style={[
                  styles.languageOptionText,
                  language === option.value && styles.languageOptionTextActive,
                ]}
              >
                {option.label}
              </Text>
              {language === option.value ? (
                <Ionicons name="checkmark-circle" size={18} color={theme.buttonPrimaryBackground} />
              ) : null}
            </Pressable>
          ))}
        </View>
      </SettingsSection>

      <SettingsSection title={copy.appearance.title} theme={theme} leftInset={layout.left} rightInset={layout.right}>
        <View style={styles.themeSelector}>
          {APP_THEME_PREFERENCES.map((pref, index) => (
            <Pressable
              key={pref}
              onPress={() => handleThemeChange(pref)}
              style={[
                styles.themeOption,
                themePreference === pref && styles.themeOptionActive,
                index === APP_THEME_PREFERENCES.length - 1 && styles.themeOptionLast,
              ]}
            >
              <View style={styles.themeOptionLeft}>
                <View
                  style={[
                    styles.themePreview,
                    pref === 'light' && styles.themePreviewLight,
                    pref === 'dark' && styles.themePreviewDark,
                    pref === 'system' && (
                      resolvedThemeScheme === 'dark'
                        ? styles.themePreviewDark
                        : styles.themePreviewLight
                    ),
                  ]}
                />
                <Text
                  style={[
                    styles.themeOptionText,
                    themePreference === pref && styles.themeOptionTextActive,
                  ]}
                >
                  {getThemeLabel(pref)}
                </Text>
              </View>
              {themePreference === pref ? (
                <Ionicons name="checkmark-circle" size={18} color={theme.buttonPrimaryBackground} />
              ) : null}
            </Pressable>
          ))}
        </View>
      </SettingsSection>

      <SettingsSection
        title={language === 'zh-CN' ? '上次扫描' : 'Last Scan'}
        theme={theme}
        leftInset={layout.left}
        rightInset={layout.right}
      >
        <View style={styles.lastScanContainer}>
          <Text style={styles.lastScanValue}>{getLastScanDisplay()}</Text>
        </View>
      </SettingsSection>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {language === 'zh-CN'
            ? '当前主题: '
            : 'Current theme: '}
          <Text style={styles.footerValue}>{getCurrentThemeValue()}</Text>
        </Text>
      </View>
    </ScrollView>
  );
}

function createStyles(
  theme: ReturnType<typeof getAppTheme>,
  layout: ReturnType<typeof buildSettingsScreenLayout>,
) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.safeArea,
    },
    contentContainer: {
      paddingBottom: layout.contentBottom,
    },
    loadingContainer: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      color: theme.pageTextSecondary,
      fontSize: 16,
    },
    header: {
      paddingLeft: layout.left,
      paddingRight: layout.right,
      paddingTop: layout.headerTop,
      paddingBottom: 8,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: '700',
      color: theme.pageTextPrimary,
    },
    languageSelector: {
      paddingVertical: 8,
    },
    languageOption: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.cardBorder,
    },
    languageOptionLast: {
      borderBottomWidth: 0,
    },
    languageOptionActive: {
      backgroundColor: theme.cardMutedBackground,
    },
    languageOptionText: {
      fontSize: 16,
      color: theme.pageTextPrimary,
    },
    languageOptionTextActive: {
      fontWeight: '600',
      color: theme.pageTextPrimary,
    },
    themeSelector: {
      paddingVertical: 8,
    },
    themeOption: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.cardBorder,
    },
    themeOptionLast: {
      borderBottomWidth: 0,
    },
    themeOptionActive: {
      backgroundColor: theme.cardMutedBackground,
    },
    themeOptionLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    themePreview: {
      width: 24,
      height: 24,
      borderRadius: 6,
      borderWidth: 1,
    },
    themePreviewLight: {
      backgroundColor: '#f3ecdf',
      borderColor: '#e7dcc7',
    },
    themePreviewDark: {
      backgroundColor: '#0d1218',
      borderColor: '#283342',
    },
    themeOptionText: {
      fontSize: 16,
      color: theme.pageTextPrimary,
    },
    themeOptionTextActive: {
      fontWeight: '600',
      color: theme.pageTextPrimary,
    },
    scanRangeContainer: {
      paddingVertical: 16,
      paddingHorizontal: 16,
    },
    scanRangeValue: {
      fontSize: 16,
      fontWeight: '500',
      color: theme.pageTextPrimary,
      marginBottom: 16,
      textAlign: 'center',
    },
    scanRangeOptions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 8,
    },
    scanRangeOption: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 10,
      borderRadius: 8,
      backgroundColor: theme.cardMutedBackground,
      borderWidth: 1,
      borderColor: theme.cardBorder,
    },
    scanRangeOptionActive: {
      backgroundColor: theme.buttonPrimaryBackground,
      borderColor: theme.buttonPrimaryBackground,
    },
    scanRangeOptionText: {
      fontSize: 15,
      fontWeight: '500',
      color: theme.pageTextPrimary,
    },
    scanRangeOptionTextActive: {
      color: theme.buttonPrimaryText,
      fontWeight: '600',
    },
    reminderContainer: {
      paddingVertical: 16,
      paddingHorizontal: 16,
      gap: 10,
    },
    reminderHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
    },
    reminderHeaderText: {
      flex: 1,
      gap: 4,
    },
    reminderSummaryValue: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.pageTextPrimary,
    },
    reminderStatusValue: {
      fontSize: 13,
      color: theme.pageTextSecondary,
    },
    reminderHint: {
      fontSize: 13,
      color: theme.pageTextSecondary,
      lineHeight: 18,
    },
    reminderFootnote: {
      fontSize: 12,
      color: theme.pageTextMuted,
      lineHeight: 18,
    },
    reminderControlsSection: {
      paddingHorizontal: 16,
      paddingBottom: 16,
    },
    reminderFieldLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.pageTextMuted,
      marginBottom: 10,
    },
    reminderChipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    reminderChip: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.cardBorder,
      backgroundColor: theme.cardMutedBackground,
    },
    reminderChipActive: {
      backgroundColor: theme.buttonPrimaryBackground,
      borderColor: theme.buttonPrimaryBackground,
    },
    reminderChipText: {
      fontSize: 13,
      fontWeight: '500',
      color: theme.pageTextPrimary,
    },
    reminderChipTextActive: {
      color: theme.buttonPrimaryText,
    },
    reminderTimeValue: {
      fontSize: 24,
      fontWeight: '700',
      color: theme.pageTextPrimary,
      marginBottom: 12,
    },
    reminderAdjustRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    reminderAdjustButton: {
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 10,
      backgroundColor: theme.cardMutedBackground,
      borderWidth: 1,
      borderColor: theme.cardBorder,
    },
    reminderAdjustButtonText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.pageTextPrimary,
    },
    lastScanContainer: {
      paddingVertical: 14,
      paddingHorizontal: 16,
    },
    lastScanValue: {
      fontSize: 16,
      color: theme.pageTextPrimary,
    },
    footer: {
      paddingLeft: layout.left,
      paddingRight: layout.right,
      paddingTop: 8,
      paddingBottom: 24,
    },
    footerText: {
      fontSize: 13,
      color: theme.pageTextMuted,
    },
    footerValue: {
      color: theme.pageTextSecondary,
      fontWeight: '500',
    },
  });
}
