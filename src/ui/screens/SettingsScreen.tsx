import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';

import {
  getAppTheme,
  type AppThemePalette,
  type AppThemePreference,
  APP_THEME_PREFERENCES,
} from '../../theme/app-theme';
import type { AppLanguage, AppLanguagePreference } from '../../i18n/app-language';
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
  reconcileReminderRuntimeInForeground,
  reconcileReminderRuntimeSettings,
  syncReminderRuntimeSettings,
} from '../../features/reminders/reminder-runtime';
import {
  loadScanRange,
  saveScanRange,
  type ScanRange,
} from '../../services/storage/scan-range-storage';
import {
  clearPersistentScanCache,
  loadLastScanMeta,
  loadPersistentScanCacheSizeBytes,
} from '../../services/storage/app-storage';
import {
  clearGeneratedAnalysisFileCache,
  loadGeneratedAnalysisFileCacheSizeBytes,
} from '../../services/media/analysis-temp-file-cache';
import { useAppPreferences } from '../../application/AppPreferencesContext';
import {
  buildSettingsScreenLayout,
  type SettingsScreenLayout,
} from './screen-layout';
import { formatLocalizedSize } from '../../i18n/app-copy';
import { AppIcon } from '../icons/AppIcon';
import { DesignIcon } from '../icons/DesignIcon';

const LIGHT_THEME_PREVIEW = getAppTheme('light');
const DARK_THEME_PREVIEW = getAppTheme('dark');
const SETTINGS_SCAN_RANGE_OPTIONS = [1, 3, 6, 12, 24] as const;

interface SettingsSectionProps {
  title: string;
  children: React.ReactNode;
  theme: AppThemePalette;
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

function createSectionStyles(theme: AppThemePalette, leftInset: number, rightInset: number) {
  return StyleSheet.create({
    section: {
      marginBottom: 22,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.pageTextPrimary,
      marginBottom: 10,
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
  theme: AppThemePalette;
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
        {showArrow ? <AppIcon name="chevron-forward" size={16} color={theme.pageTextMuted} /> : null}
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

function createRowStyles(theme: AppThemePalette, isLast: boolean) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
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
      fontWeight: '600',
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
  const dimensions = useWindowDimensions();
  const layout = useMemo(
    () => buildSettingsScreenLayout(insets, dimensions),
    [dimensions, insets],
  );
  const {
    language,
    languagePreference,
    themePreference,
    resolvedThemeScheme,
    theme,
    copy,
    setLanguage,
    setThemePreference,
  } = useAppPreferences();
  const [scanRange, setScanRange] = useState<ScanRange>(12);
  const [reminderSettings, setReminderSettings] = useState<ReminderSettings>(
    createDefaultReminderSettings(),
  );
  const [notificationPermissionGranted, setNotificationPermissionGranted] = useState(false);
  const [lastScanTime, setLastScanTime] = useState<number | null>(null);
  const [persistentCacheSizeBytes, setPersistentCacheSizeBytes] = useState(0);
  const [isClearingPersistentCache, setIsClearingPersistentCache] = useState(false);
  const styles = useMemo(() => createStyles(theme, layout), [theme, layout]);
  const settingsCopy = copy.settings;
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
          const [
            savedScanRange,
            lastScanMeta,
            reminderRuntime,
            nextPersistentCacheSizeBytes,
            nextGeneratedAnalysisFileCacheSizeBytes,
          ] = await Promise.all([
            loadScanRange(),
            loadLastScanMeta(),
            reconcileReminderRuntimeInForeground(language, reminderChannelCopy),
            loadPersistentScanCacheSizeBytes(),
            loadGeneratedAnalysisFileCacheSizeBytes(),
          ]);

          if (isActive) {
            setScanRange(savedScanRange);
            setLastScanTime(lastScanMeta?.scannedAt ?? null);
            setPersistentCacheSizeBytes(
              nextPersistentCacheSizeBytes + nextGeneratedAnalysisFileCacheSizeBytes,
            );
            setReminderSettings(reminderRuntime.settings);
            setNotificationPermissionGranted(reminderRuntime.permissionGranted);
          }
        } catch (error) {
          console.error('Failed to load settings:', error);
        }
      }

      void loadSettings();

      return () => {
        isActive = false;
      };
    }, [language, reminderChannelCopy])
  );

  const handleLanguageChange = useCallback(async (newLanguage: AppLanguagePreference) => {
    if (newLanguage === languagePreference) return;

    await setLanguage(newLanguage);
  }, [languagePreference, setLanguage]);

  const handleThemeChange = useCallback(async (newTheme: AppThemePreference) => {
    if (newTheme === themePreference) return;

    await setThemePreference(newTheme);
  }, [setThemePreference, themePreference]);

  const handleScanRangeChange = useCallback(async (newRange: ScanRange) => {
    if (newRange === scanRange) return;

    setScanRange(newRange);
    try {
      await saveScanRange(newRange);

      if (
        reminderSettings.enabled ||
        reminderSettings.notificationId !== null ||
        reminderSettings.nextTriggerAt !== null
      ) {
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

  const handleReminderTimeSet = useCallback(async (hour: number, minute: number) => {
    if (hour === reminderSettings.hour && minute === reminderSettings.minute) {
      return;
    }

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

  const handleClearPersistentScanCache = useCallback(async () => {
    if (isClearingPersistentCache) {
      return;
    }

    setIsClearingPersistentCache(true);
    try {
      await Promise.all([
        clearPersistentScanCache(),
        clearGeneratedAnalysisFileCache(),
      ]);
      setLastScanTime(null);
      setPersistentCacheSizeBytes(0);
    } catch (error) {
      console.error('Failed to clear persistent scan cache:', error);
    } finally {
      setIsClearingPersistentCache(false);
    }
  }, [isClearingPersistentCache]);

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
    return settingsCopy.scanRangeRecentMonths(range);
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

  const languageOptions = useMemo(
    () => [
      {
        value: 'system' as const,
        label: settingsCopy.followSystemLanguage(
          copy.languageOptions.find((option) => option.value === language)?.label ?? 'English',
        ),
      },
      ...copy.languageOptions,
    ],
    [copy.languageOptions, language, settingsCopy],
  );
  const currentLanguageValue = useMemo(
    () =>
      languageOptions.find((option) => option.value === languagePreference)?.label ??
      copy.languageOptions.find((option) => option.value === language)?.label ??
      'English',
    [copy.languageOptions, language, languageOptions, languagePreference],
  );
  const reminderSummary = useMemo(
    () => buildReminderSummary(reminderSettings, language),
    [language, reminderSettings],
  );

  const getPersistentCacheActionLabel = (): string => {
    if (isClearingPersistentCache) {
      return settingsCopy.clearingAction;
    }

    return settingsCopy.clearAction;
  };

  const getPersistentCacheRowLabel = (): string => {
    if (persistentCacheSizeBytes > 0) {
      const formattedSize = formatLocalizedSize(persistentCacheSizeBytes, language);
      return settingsCopy.clearCacheWithSize(formattedSize);
    }

    return settingsCopy.clearCache;
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

  const cacheSizeText = formatLocalizedSize(persistentCacheSizeBytes, language);
  const cacheMetaText = `${settingsCopy.lastScanTitle} ${getLastScanDisplay()}`;
  const reminderToggleLabel = reminderSettings.enabled
    ? settingsCopy.reminderDisableAction
    : settingsCopy.reminderEnableAction;
  const dailyReminderOption = reminderFrequencyOptions.find((option) => option.value === 'daily');
  const weeklyReminderOption = reminderFrequencyOptions.find((option) => option.value === 'weekly');
  const mondayOption = reminderWeekdayOptions.find((option) => option.value === 1);
  const settingsIconSize = layout.isSELike ? 14 : 21;
  const scanIconSize = layout.isSELike ? 15 : 24;
  const footerIconSize = layout.isSELike ? 14 : 22;
  const compactSystemLabel = language === 'zh-CN' ? '系统' : 'System';
  const reminderPrimaryLabel =
    layout.isSELike && !reminderSettings.enabled
      ? copy.reminder.disabled
      : reminderSummary;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      testID="settings-scroll-view"
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle} testID="settings-header">
          {settingsCopy.headerTitle}
        </Text>
      </View>

      <View style={styles.designCard} testID="settings-scan-range-card">
        <View style={styles.cardHeaderRow}>
          <View style={[styles.cardIcon, styles.scanIcon]}>
            <DesignIcon
              name="scan"
              width={scanIconSize}
              height={scanIconSize}
              color={theme.buttonPrimaryBackground}
            />
          </View>
          <Text style={styles.cardTitle}>{settingsCopy.scanRangeTitle}</Text>
        </View>
        <View style={styles.cardMainRow}>
          <Text
            style={styles.primaryValue}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.82}
          >
            {getScanRangeDisplay(scanRange)}
          </Text>
          <View style={styles.compactChipRow}>
            {SETTINGS_SCAN_RANGE_OPTIONS.map((range) => {
              const active = scanRange === range;
              return (
                <Pressable
                  key={range}
                  onPress={() => void handleScanRangeChange(range)}
                  style={[styles.chip, active && styles.scanChipActive]}
                  testID={`scan-range-option-${range}`}
                >
                  <Text
                    style={[styles.chipText, active && styles.scanChipTextActive]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.82}
                  >
                    {range}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      <View style={styles.designCard} testID="settings-reminder-card">
        <View style={styles.cardHeaderRow}>
          <View style={[styles.cardIcon, styles.reminderIcon]}>
            <DesignIcon
              name="check"
              width={settingsIconSize}
              height={settingsIconSize}
              color={theme.buttonSuccessBackground}
            />
          </View>
          <Text style={styles.cardTitle}>{settingsCopy.reminderTitle}</Text>
        </View>
        <View style={styles.cardMainRow}>
          <View style={styles.reminderCopyGroup}>
            <Text
              style={styles.primaryValue}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.78}
            >
              {reminderPrimaryLabel}
            </Text>
            <Text style={styles.secondaryLine}>
              {reminderSettings.enabled
                ? notificationPermissionGranted
                  ? copy.reminder.permissionOn
                  : copy.reminder.permissionOff
                : getReminderStatusLabel()}
            </Text>
          </View>
          <View style={styles.compactChipRow}>
            <Pressable
              onPress={() => void handleReminderToggle()}
              style={[
                styles.chip,
                reminderSettings.enabled && styles.reminderChipActive,
              ]}
              testID="reminder-settings-toggle"
            >
              <Text
                style={[
                  styles.chipText,
                  reminderSettings.enabled && styles.reminderChipTextActive,
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.82}
              >
                {reminderToggleLabel}
              </Text>
            </Pressable>
            {dailyReminderOption ? (
              <Pressable
                onPress={() => void handleReminderFrequencyChange('daily')}
                style={[
                  styles.chip,
                  reminderSettings.frequency === 'daily' && styles.reminderChipActive,
                ]}
                testID="reminder-frequency-daily"
              >
                <Text
                  style={[
                    styles.chipText,
                    reminderSettings.frequency === 'daily' && styles.reminderChipTextActive,
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.82}
              >
                {dailyReminderOption.label}
                </Text>
              </Pressable>
            ) : null}
            {weeklyReminderOption ? (
              <Pressable
                onPress={() => void handleReminderFrequencyChange('weekly')}
                style={[
                  styles.chip,
                  reminderSettings.frequency === 'weekly' && styles.reminderChipActive,
                ]}
                testID="reminder-frequency-weekly"
              >
                <Text
                  style={[
                    styles.chipText,
                    reminderSettings.frequency === 'weekly' && styles.reminderChipTextActive,
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.82}
              >
                {weeklyReminderOption.label}
                </Text>
              </Pressable>
            ) : null}
            {mondayOption && reminderSettings.frequency === 'weekly' ? (
              <Pressable
                onPress={() => void handleReminderWeekdayChange(1)}
                style={[
                  styles.chip,
                  reminderSettings.weekday === 1 && styles.reminderChipActive,
                ]}
                testID="reminder-weekday-monday"
              >
                <Text
                  style={[
                    styles.chipText,
                    reminderSettings.weekday === 1 && styles.reminderChipTextActive,
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.82}
              >
                {mondayOption.label}
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => void handleReminderTimeSet(8, 30)}
              style={[
                styles.chip,
                reminderSettings.hour === 8 && reminderSettings.minute === 30 && styles.reminderChipActive,
              ]}
              testID="reminder-time-0830"
            >
              <Text
                style={[
                  styles.chipText,
                  reminderSettings.hour === 8 && reminderSettings.minute === 30 && styles.reminderChipTextActive,
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.82}
              >
                08:30
              </Text>
            </Pressable>
            <Pressable
              onPress={() => void handleReminderTimeSet(20, 30)}
              style={[
                styles.chip,
                reminderSettings.hour === 20 && reminderSettings.minute === 30 && styles.reminderChipActive,
              ]}
              testID="reminder-time-2030"
            >
              <Text
                style={[
                  styles.chipText,
                  reminderSettings.hour === 20 && reminderSettings.minute === 30 && styles.reminderChipTextActive,
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.82}
              >
                20:30
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      <View style={styles.designCard} testID="settings-language-theme-card">
        <View style={styles.cardHeaderRow}>
          <View style={[styles.cardIcon, styles.languageIcon]}>
            <DesignIcon
              name="local-analysis"
              width={settingsIconSize}
              height={settingsIconSize}
              color={theme.chipActiveText}
              secondaryColor={theme.buttonPrimaryBackground}
            />
          </View>
          <Text style={styles.cardTitle}>{settingsCopy.languageThemeTitle}</Text>
        </View>
        <View style={styles.preferenceLine}>
          <Text style={styles.preferenceLabel}>{copy.languageLabel}</Text>
          <View style={styles.compactChipRow}>
            {languageOptions.map((option) => {
              const active = languagePreference === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => void handleLanguageChange(option.value)}
                  style={[styles.chip, styles.preferenceChip, active && styles.languageChipActive]}
                  testID={`language-option-${option.value}`}
                >
                  <Text
                    style={[styles.chipText, active && styles.languageChipTextActive]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.72}
                  >
                    {layout.isSELike && option.value === 'system' ? compactSystemLabel : option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        <View style={styles.preferenceDivider} />
        <View style={styles.preferenceLine}>
          <Text style={styles.preferenceLabel}>{copy.appearance.title}</Text>
          <View style={styles.compactChipRow}>
            {APP_THEME_PREFERENCES.map((pref) => {
              const active = themePreference === pref;
              return (
                <Pressable
                  key={pref}
                  onPress={() => void handleThemeChange(pref)}
                  style={[styles.chip, styles.preferenceChip, active && styles.languageChipActive]}
                  testID={`theme-option-${pref}`}
                >
                  <Text
                    style={[styles.chipText, active && styles.languageChipTextActive]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.72}
                  >
                    {layout.isSELike && pref === 'system' ? compactSystemLabel : getThemeLabel(pref)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      <View style={styles.designCard} testID="settings-cache-card">
        <View style={styles.cardHeaderRow}>
          <View style={[styles.cardIcon, styles.cacheIcon]}>
            <DesignIcon
              name="nav-trash"
              width={settingsIconSize}
              height={settingsIconSize}
              color={theme.buttonDangerBackground}
            />
          </View>
          <Text style={styles.cardTitle}>{settingsCopy.cachedDataTitle}</Text>
        </View>
        <View style={styles.cacheMainRow}>
          <View style={styles.cacheMetricGroup}>
            <Text
              style={styles.primaryValue}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.82}
            >
              {cacheSizeText}
            </Text>
            <Text
              style={styles.secondaryLine}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.78}
            >
              {cacheMetaText}
            </Text>
          </View>
          <Pressable
            testID="clear-persistent-scan-cache-button"
            onPress={() => void handleClearPersistentScanCache()}
            disabled={isClearingPersistentCache}
            style={({ pressed }) => [
              styles.clearButton,
              (pressed || isClearingPersistentCache) && styles.clearButtonPressed,
            ]}
          >
            <Text style={styles.clearButtonText}>{getPersistentCacheActionLabel()}</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.localOnlyFooter}>
        <DesignIcon
          name="check"
          width={footerIconSize}
          height={footerIconSize}
          color={theme.pageTextMuted}
        />
        <Text style={styles.localOnlyText} testID="settings-local-only-note">
          {settingsCopy.localOnlyNote}
        </Text>
      </View>
    </ScrollView>
  );
}

function createStyles(
  theme: AppThemePalette,
  layout: SettingsScreenLayout,
) {
  const isCompact = layout.isSELike;
  const screenBackground = theme.scheme === 'light' ? '#f7f9fd' : theme.safeArea;
  const cardBorder = theme.scheme === 'light' ? '#edf2fa' : theme.cardBorder;

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: screenBackground,
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
      paddingBottom: isCompact ? 6 : 10,
      alignItems: 'center',
    },
    headerEyebrow: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.pageTextMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 8,
    },
    headerTitle: {
      fontSize: isCompact ? 18 : 28,
      lineHeight: isCompact ? 23 : 36,
      fontWeight: '800',
      color: theme.pageTextPrimary,
      marginBottom: isCompact ? 6 : 8,
      textAlign: 'center',
    },
    headerBody: {
      fontSize: 14,
      lineHeight: 22,
      color: theme.pageTextSecondary,
    },
    designCard: {
      marginLeft: layout.left,
      marginRight: layout.right,
      marginBottom: layout.cardGap,
      padding: layout.cardPadding,
      borderRadius: isCompact ? 18 : 28,
      backgroundColor: theme.cardBackground,
      borderWidth: 1,
      borderColor: cardBorder,
      shadowColor: theme.shadowColor,
      shadowOffset: { width: 0, height: isCompact ? 5 : 14 },
      shadowOpacity: theme.scheme === 'dark' ? 0.14 : 0.045,
      shadowRadius: isCompact ? 14 : 28,
      elevation: isCompact ? 1 : 3,
    },
    cardHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: isCompact ? 8 : 16,
      marginBottom: isCompact ? 7 : 20,
    },
    cardIcon: {
      width: isCompact ? 22 : 44,
      height: isCompact ? 22 : 44,
      borderRadius: isCompact ? 8 : 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scanIcon: {
      backgroundColor: theme.scheme === 'dark' ? '#1a2a4f' : '#e9efff',
    },
    reminderIcon: {
      backgroundColor: theme.scheme === 'dark' ? '#103c33' : '#e3f8f1',
    },
    languageIcon: {
      backgroundColor: theme.scheme === 'dark' ? '#2c2249' : '#efe8ff',
    },
    cacheIcon: {
      backgroundColor: theme.scheme === 'dark' ? '#3b2028' : '#ffe8eb',
    },
    cardTitle: {
      fontSize: isCompact ? 13 : 22,
      lineHeight: isCompact ? 18 : 28,
      fontWeight: '800',
      color: theme.pageTextPrimary,
    },
    cardMainRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: isCompact ? 8 : 18,
    },
    primaryValue: {
      flexShrink: 1,
      fontSize: isCompact ? 18 : 34,
      lineHeight: isCompact ? 23 : 42,
      fontWeight: '700',
      color: theme.pageTextPrimary,
    },
    secondaryLine: {
      fontSize: isCompact ? 11 : 17,
      lineHeight: isCompact ? 15 : 24,
      color: theme.pageTextSecondary,
    },
    compactChipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'flex-end',
      gap: isCompact ? 5 : 10,
      flexShrink: 1,
    },
    chip: {
      minWidth: layout.chipMinWidth,
      minHeight: layout.chipMinHeight,
      paddingVertical: isCompact ? 3 : 10,
      paddingHorizontal: isCompact ? 8 : 18,
      borderRadius: isCompact ? 12 : 24,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.cardMutedBackground,
      borderWidth: 1,
      borderColor: theme.cardMutedBorder,
    },
    chipText: {
      fontSize: isCompact ? 11 : 18,
      lineHeight: isCompact ? 15 : 24,
      color: theme.pageTextSecondary,
      fontWeight: '500',
    },
    scanChipActive: {
      backgroundColor: theme.scheme === 'dark' ? '#1d3671' : '#dfe8ff',
      borderColor: theme.scheme === 'dark' ? '#274a98' : '#d7e3ff',
    },
    scanChipTextActive: {
      color: '#4f7cff',
      fontWeight: '800',
    },
    chipDisabled: {
      opacity: 0.82,
    },
    chipDisabledText: {
      color: theme.pageTextMuted,
    },
    reminderCopyGroup: {
      flexShrink: 1,
      gap: isCompact ? 4 : 8,
    },
    reminderChipActive: {
      backgroundColor: theme.scheme === 'dark' ? '#174b3f' : '#dcf7ec',
      borderColor: theme.scheme === 'dark' ? '#1d694f' : '#c9f0e2',
    },
    reminderChipTextActive: {
      color: theme.buttonSuccessBackground,
      fontWeight: '800',
    },
    preferenceLine: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: isCompact ? 8 : 18,
    },
    preferenceDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.cardBorder,
      marginVertical: isCompact ? 12 : 24,
    },
    preferenceLabel: {
      minWidth: isCompact ? 38 : 64,
      paddingTop: isCompact ? 3 : 10,
      fontSize: isCompact ? 11 : 18,
      lineHeight: isCompact ? 15 : 24,
      color: theme.pageTextSecondary,
    },
    preferenceChip: {
      minWidth: isCompact ? 52 : 112,
    },
    languageChipActive: {
      backgroundColor: theme.scheme === 'dark' ? '#34274d' : '#efe6ff',
      borderColor: theme.scheme === 'dark' ? '#4b3a72' : '#e4d7ff',
    },
    languageChipTextActive: {
      color: theme.scheme === 'dark' ? '#b99cff' : '#765fff',
      fontWeight: '800',
    },
    cacheMetricGroup: {
      flexShrink: 1,
      gap: isCompact ? 4 : 8,
    },
    cacheMainRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: isCompact ? 8 : 18,
    },
    clearButton: {
      minHeight: isCompact ? 28 : 54,
      paddingHorizontal: isCompact ? 12 : 28,
      borderRadius: 27,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.scheme === 'dark' ? '#4a242c' : '#ffe8eb',
    },
    clearButtonPressed: {
      opacity: 0.72,
    },
    clearButtonText: {
      fontSize: isCompact ? 11 : 18,
      lineHeight: isCompact ? 15 : 24,
      color: theme.scheme === 'dark' ? '#ff8790' : '#ff6570',
      fontWeight: '800',
    },
    localOnlyFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginLeft: layout.left,
      marginRight: layout.right,
      marginTop: isCompact ? 14 : 24,
      marginBottom: isCompact ? 16 : 22,
    },
    localOnlyText: {
      fontSize: isCompact ? 11 : 18,
      lineHeight: isCompact ? 16 : 24,
      color: theme.pageTextMuted,
    },
    overviewCard: {
      marginLeft: layout.left,
      marginRight: layout.right,
      marginBottom: 24,
      padding: 18,
      borderRadius: 22,
      backgroundColor: theme.cardBackground,
      borderWidth: 1,
      borderColor: theme.cardBorder,
      shadowColor: theme.shadowColor,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: theme.scheme === 'dark' ? 0.16 : 0.08,
      shadowRadius: 18,
      elevation: 3,
    },
    overviewTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: theme.pageTextPrimary,
      marginBottom: 12,
    },
    overviewMetricsRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 12,
    },
    overviewMetricCard: {
      flex: 1,
      minHeight: 92,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: 16,
      backgroundColor: theme.cardMutedBackground,
      borderWidth: 1,
      borderColor: theme.cardBorder,
      justifyContent: 'space-between',
    },
    overviewMetricLabel: {
      fontSize: 12,
      color: theme.pageTextMuted,
    },
    overviewMetricValue: {
      fontSize: 15,
      lineHeight: 22,
      fontWeight: '700',
      color: theme.pageTextPrimary,
    },
    overviewPillRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    overviewPill: {
      borderRadius: 999,
      paddingVertical: 8,
      paddingHorizontal: 12,
      backgroundColor: theme.buttonSecondaryBackground,
      borderWidth: 1,
      borderColor: theme.cardBorder,
    },
    overviewPillText: {
      fontSize: 13,
      color: theme.buttonSecondaryText,
      fontWeight: '600',
    },
    sectionBlock: {
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 8,
      gap: 6,
    },
    blockTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.pageTextPrimary,
    },
    blockHint: {
      fontSize: 13,
      lineHeight: 20,
      color: theme.pageTextSecondary,
    },
    sectionDivider: {
      marginHorizontal: 16,
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.cardBorder,
    },
    languageSelector: {
      paddingBottom: 8,
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
      paddingBottom: 8,
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
      backgroundColor: LIGHT_THEME_PREVIEW.safeArea,
      borderColor: LIGHT_THEME_PREVIEW.cardBorder,
    },
    themePreviewDark: {
      backgroundColor: DARK_THEME_PREVIEW.safeArea,
      borderColor: DARK_THEME_PREVIEW.cardBorder,
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
    reminderChipText: {
      fontSize: 13,
      fontWeight: '500',
      color: theme.pageTextPrimary,
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
    maintenanceHintBlock: {
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 8,
      gap: 6,
    },
    cacheActionRow: {
      minHeight: 64,
      paddingVertical: 14,
      paddingHorizontal: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
    },
    cacheActionRowPressed: {
      backgroundColor: theme.cardMutedBackground,
    },
    cacheActionTextGroup: {
      flex: 1,
    },
    cacheActionLabel: {
      fontSize: 16,
      color: theme.pageTextPrimary,
    },
    cacheActionValue: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.buttonPrimaryBackground,
    },
  });
}
