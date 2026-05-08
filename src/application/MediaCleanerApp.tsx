import { StatusBar } from 'expo-status-bar';
import * as MediaLibrary from 'expo-media-library';
import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';

import { applyCleanupAction, createInitialCleanupState } from '../features/cleanup/cleanup-state';
import type { CleanupAction, CleanupState } from '../features/cleanup/cleanup-state';
import {
  scanMediaLibrary,
  type ScanSummary,
} from '../features/scan/scan-media-library';
import {
  DEFAULT_SCAN_LIMIT,
  DEFAULT_SCAN_WINDOW_MONTHS_EQUIVALENT,
  buildDefaultScanWindowStartAt,
} from '../features/scan/scan-config';
import { buildRecentScanReminderCopy } from '../features/reminders/reminder-copy';
import {
  DEFAULT_REMINDER_SUMMARY,
  buildReminderSummary,
  createDefaultReminderSettings,
  estimateNextReminderTriggerAt,
  listReminderFrequencyOptions,
  listReminderWeekdayOptions,
  updateReminderSchedule,
  type ReminderSettings,
} from '../features/reminders/reminder-settings';
import type { CleanupCandidate, CleanupIssueType } from '../domain/recognition/types';
import type { AppLanguage } from '../i18n/app-language';
import { detectPreferredAppLanguage } from '../i18n/app-language';
import {
  formatLocalizedDateTime,
  getAppCopy,
  resolveReminderSummary,
} from '../i18n/app-copy';
import {
  loadLastScanMeta,
  loadRecycleBinIds,
  saveLastScanMeta,
  saveLastValidScanBaseline,
  saveRecycleBinIds,
} from '../services/storage/app-storage';
import type { LastScanMeta } from '../services/storage/app-storage';
import {
  captureLastValidScanBaseline,
  ensureCleanupReminderPermissions,
  reconcileCleanupReminderNotification,
  syncCleanupReminderNotification,
} from '../services/notifications/cleanup-reminders';
import { loadAppLanguage, saveAppLanguage } from '../services/storage/app-language-storage';
import {
  loadReminderSettings,
  saveReminderSettings,
} from '../services/storage/reminder-settings-storage';
import {
  loadThemePreference,
  saveThemePreference,
} from '../services/storage/theme-preference-storage';
import {
  getAppTheme,
  resolveThemeScheme,
  type AppThemePalette,
  type AppThemePreference,
} from '../theme/app-theme';
import {
  ensureMediaLibraryDeletePermissionsAsync,
  getMediaLibraryPermissionsAsync,
  requestMediaLibraryPermissionsAsync,
} from '../services/media-library-permissions';
import { CandidateCard } from '../ui/CandidateCard';
import { PreviewModal } from '../ui/PreviewModal';
import {
  createSummaryFromState,
  derivePersistedRecycleBinIds,
  resolvePreviewPrimaryActionMode,
} from './media-cleaner-helpers';

type PermissionState = 'loading' | 'granted' | 'denied';
type ViewMode = 'suggestions' | 'recycle';
type RecognitionFilter = 'all' | CleanupIssueType;

export function MediaCleanerApp() {
  const [permissionState, setPermissionState] = useState<PermissionState>('loading');
  const [isScanning, setIsScanning] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('suggestions');
  const [recognitionFilter, setRecognitionFilter] = useState<RecognitionFilter>('all');
  const [previewCandidate, setPreviewCandidate] = useState<CleanupCandidate | null>(null);
  const [lastScanMeta, setLastScanMeta] = useState<LastScanMeta | null>(null);
  const [summary, setSummary] = useState<ScanSummary | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [appLanguage, setAppLanguage] = useState<AppLanguage>(detectPreferredAppLanguage);
  const [themePreference, setThemePreference] = useState<AppThemePreference>('system');
  const [reminderSettings, setReminderSettings] = useState<ReminderSettings>(
    createDefaultReminderSettings,
  );
  const [reminderSummaryDraft, setReminderSummaryDraft] = useState(DEFAULT_REMINDER_SUMMARY);
  const [notificationPermissionGranted, setNotificationPermissionGranted] = useState(false);
  const [cleanupState, setCleanupState] = useState<CleanupState>(() => createInitialCleanupState([]));
  const cleanupStateRef = useRef(cleanupState);
  const lastScanMetaRef = useRef(lastScanMeta);
  const reminderSettingsRef = useRef(reminderSettings);
  const recycleBinIdsRef = useRef<string[]>([]);
  const notificationPermissionGrantedRef = useRef(notificationPermissionGranted);
  const appLanguageRef = useRef(appLanguage);
  const systemTheme = useColorScheme();

  useEffect(() => {
    cleanupStateRef.current = cleanupState;
  }, [cleanupState]);

  useEffect(() => {
    lastScanMetaRef.current = lastScanMeta;
  }, [lastScanMeta]);

  useEffect(() => {
    reminderSettingsRef.current = reminderSettings;
  }, [reminderSettings]);

  useEffect(() => {
    notificationPermissionGrantedRef.current = notificationPermissionGranted;
  }, [notificationPermissionGranted]);

  useEffect(() => {
    appLanguageRef.current = appLanguage;
  }, [appLanguage]);

  const copy = useMemo(() => getAppCopy(appLanguage), [appLanguage]);
  const reminderFrequencyOptions = useMemo(
    () => listReminderFrequencyOptions(appLanguage),
    [appLanguage],
  );
  const reminderWeekdayOptions = useMemo(
    () => listReminderWeekdayOptions(appLanguage),
    [appLanguage],
  );
  const resolvedThemeScheme = useMemo(
    () => resolveThemeScheme(themePreference, systemTheme),
    [systemTheme, themePreference],
  );
  const theme = useMemo(() => getAppTheme(resolvedThemeScheme), [resolvedThemeScheme]);
  const styles = useMemo(() => createStyles(theme), [theme]);

  const persistRecycleBin = useCallback(async (ids: string[]) => {
    recycleBinIdsRef.current = ids;
    await saveRecycleBinIds(ids);
  }, []);

  const syncReminderState = useCallback(
    async (
      nextSettings: ReminderSettings,
      nextSummary: ScanSummary | null,
      previousNotificationId: string | null,
    ) => {
      const runtimeCopy = getAppCopy(appLanguageRef.current);
      const syncResult = await syncCleanupReminderNotification(
        {
          ...nextSettings,
          previousNotificationId,
        },
        buildRecentScanReminderCopy(nextSummary, nextSettings, appLanguageRef.current),
        {
          name: runtimeCopy.reminder.channelName,
          description: runtimeCopy.reminder.channelDescription,
        },
      );

      const syncedSettings = {
        ...nextSettings,
        ...syncResult,
      };

      reminderSettingsRef.current = syncedSettings;
      setReminderSettings(syncedSettings);
      setReminderSummaryDraft(resolveReminderSummary(syncedSettings.summary, appLanguageRef.current));
      await saveReminderSettings(syncedSettings);

      return syncedSettings;
    },
    [],
  );

  const reconcileReminderState = useCallback(
    async (
      savedReminderSettings: ReminderSettings,
      nextSummary: ScanSummary | null,
      hasNotificationPermission: boolean,
      language: AppLanguage,
    ) => {
      const runtimeCopy = getAppCopy(language);
      if (!savedReminderSettings.enabled) {
        return savedReminderSettings;
      }

      if (!hasNotificationPermission) {
        if (!savedReminderSettings.notificationId && !savedReminderSettings.nextTriggerAt) {
          return savedReminderSettings;
        }

        const clearedSettings = {
          ...savedReminderSettings,
          notificationId: null,
          nextTriggerAt: null,
        };

        await saveReminderSettings(clearedSettings);
        return clearedSettings;
      }

      const syncResult = await reconcileCleanupReminderNotification(
        savedReminderSettings,
        buildRecentScanReminderCopy(nextSummary, savedReminderSettings, language),
        {
          name: runtimeCopy.reminder.channelName,
          description: runtimeCopy.reminder.channelDescription,
        },
      );

      const reconciledSettings = {
        ...savedReminderSettings,
        ...syncResult,
      };

      if (
        reconciledSettings.notificationId !== savedReminderSettings.notificationId ||
        reconciledSettings.nextTriggerAt !== savedReminderSettings.nextTriggerAt
      ) {
        await saveReminderSettings(reconciledSettings);
      }

      return reconciledSettings;
    },
    [],
  );

  const commitCleanupAction = useCallback(
    async (action: CleanupAction, persist = true) => {
      const nextState = applyCleanupAction(cleanupStateRef.current, action);
      const nextSummary = createSummaryFromState(nextState, lastScanMetaRef.current);

      cleanupStateRef.current = nextState;
      setCleanupState(nextState);
      setSummary(nextSummary);

      if (persist) {
        const nextRecycleBinIds = derivePersistedRecycleBinIds(
          recycleBinIdsRef.current,
          nextState.recycleBin.map((candidate) => candidate.id),
          action,
        );

        await persistRecycleBin(nextRecycleBinIds);

        if (reminderSettingsRef.current.enabled && notificationPermissionGrantedRef.current) {
          await syncReminderState(
            reminderSettingsRef.current,
            nextSummary,
            reminderSettingsRef.current.notificationId,
          );
        }
      }

      return nextState;
    },
    [persistRecycleBin, syncReminderState],
  );

  const hydrateFromScan = useCallback(
    async (recycleBinIds?: string[]) => {
      setIsScanning(true);
      setErrorMessage(null);

      try {
        const ids = recycleBinIds ?? (await loadRecycleBinIds());
        recycleBinIdsRef.current = ids;
        const createdAfter = buildDefaultScanWindowStartAt();
        const result = await scanMediaLibrary(ids, {
          createdAfter,
        });
        const hydrateAction: CleanupAction = {
          type: 'hydrate',
          activeCandidates: result.state.activeCandidates,
          recycleBin: result.state.recycleBin,
        };
        const nextState = applyCleanupAction(cleanupStateRef.current, hydrateAction);
        const meta = {
          scannedAt: result.summary.scannedAt,
          scannedCount: result.summary.scannedCount,
          candidateCount: result.summary.candidateCount,
        };
        const nextSummary = createSummaryFromState(nextState, meta);
        const nextRecycleBinIds = derivePersistedRecycleBinIds(
          ids,
          nextState.recycleBin.map((candidate) => candidate.id),
          hydrateAction,
        );

        cleanupStateRef.current = nextState;
        setCleanupState(nextState);
        setSummary(nextSummary);
        setLastScanMeta(meta);
        lastScanMetaRef.current = meta;
        recycleBinIdsRef.current = nextRecycleBinIds;
        const baseline = await captureLastValidScanBaseline({
          scannedAt: meta.scannedAt,
          scannedCount: meta.scannedCount,
          candidateCount: meta.candidateCount,
          ledgerUpdatedAt: meta.scannedAt,
        }, {
          scanRangeMonths: DEFAULT_SCAN_WINDOW_MONTHS_EQUIVALENT,
          createdAfter,
        });
        await Promise.all([
          saveRecycleBinIds(nextRecycleBinIds),
          saveLastScanMeta(meta),
          saveLastValidScanBaseline(baseline),
        ]);

        if (reminderSettingsRef.current.enabled && notificationPermissionGrantedRef.current) {
          await syncReminderState(
            reminderSettingsRef.current,
            nextSummary,
            reminderSettingsRef.current.notificationId,
          );
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : copy.alerts.scanFailed;
        setErrorMessage(message);
      } finally {
        setIsScanning(false);
      }
    },
    [copy.alerts.scanFailed, syncReminderState],
  );

  const bootstrap = useCallback(async () => {
    setErrorMessage(null);

    try {
      const [
        savedLanguage,
        savedThemePreference,
        savedMeta,
        recycleBinIds,
        permission,
        savedReminderSettings,
        notificationPermission,
      ] = await Promise.all([
        loadAppLanguage(),
        loadThemePreference(),
        loadLastScanMeta(),
        loadRecycleBinIds(),
        getMediaLibraryPermissionsAsync(),
        loadReminderSettings(),
        Notifications.getPermissionsAsync(),
      ]);

      const savedSummary = savedMeta
        ? createSummaryFromState(cleanupStateRef.current, savedMeta)
        : null;
      const hasNotificationPermission = notificationPermission.granted;
      const initialReminderSettings = await reconcileReminderState(
        savedReminderSettings,
        savedSummary,
        hasNotificationPermission,
        savedLanguage,
      );

      setAppLanguage(savedLanguage);
      setThemePreference(savedThemePreference);
      appLanguageRef.current = savedLanguage;
      setLastScanMeta(savedMeta);
      lastScanMetaRef.current = savedMeta;
      setSummary(savedSummary);
      recycleBinIdsRef.current = recycleBinIds;
      setReminderSettings(initialReminderSettings);
      reminderSettingsRef.current = initialReminderSettings;
      setReminderSummaryDraft(resolveReminderSummary(initialReminderSettings.summary, savedLanguage));
      setNotificationPermissionGranted(hasNotificationPermission);
      notificationPermissionGrantedRef.current = hasNotificationPermission;

      if (permission.granted) {
        setPermissionState('granted');
        await hydrateFromScan(recycleBinIds);
      } else {
        setPermissionState('denied');
      }
    } catch {
      setPermissionState('denied');
      setErrorMessage(copy.alerts.initFailed);
    }
  }, [copy.alerts.initFailed, hydrateFromScan, reconcileReminderState]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const requestPermission = useCallback(async () => {
    const permission = await requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setPermissionState('denied');
      return;
    }

    setPermissionState('granted');
    const recycleBinIds = await loadRecycleBinIds();
    await hydrateFromScan(recycleBinIds);
  }, [hydrateFromScan]);

  const performHardDelete = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) {
        return;
      }

      try {
        const deletePermission = await ensureMediaLibraryDeletePermissionsAsync();
        if (!deletePermission.granted) {
          throw new Error(copy.alerts.deleteFailedBody);
        }

        await MediaLibrary.deleteAssetsAsync(ids);
        await commitCleanupAction({ type: 'hard-delete', ids });
        setPreviewCandidate(null);
      } catch {
        Alert.alert(copy.alerts.deleteFailedTitle, copy.alerts.deleteFailedBody);
      }
    },
    [commitCleanupAction, copy.alerts.deleteFailedBody, copy.alerts.deleteFailedTitle],
  );

  const selectedIds = cleanupState.selectedIds;
  const selectedCount = selectedIds.length;
  const filteredSuggestions = useMemo(
    () =>
      recognitionFilter === 'all'
        ? cleanupState.activeCandidates
        : cleanupState.activeCandidates.filter((candidate) =>
            candidate.issueTypes.includes(recognitionFilter),
          ),
    [cleanupState.activeCandidates, recognitionFilter],
  );
  const visibleCandidates =
    viewMode === 'suggestions' ? filteredSuggestions : cleanupState.recycleBin;
  const recognitionFilterOptions = useMemo(
    () => [
      {
        value: 'all' as const,
        label: copy.filters.all,
        count: cleanupState.activeCandidates.length,
      },
      {
        value: 'accidental' as const,
        label: copy.filters.accidental,
        count: cleanupState.activeCandidates.filter((candidate) =>
          candidate.issueTypes.includes('accidental'),
        ).length,
      },
      {
        value: 'abnormal' as const,
        label: copy.filters.abnormal,
        count: cleanupState.activeCandidates.filter((candidate) =>
          candidate.issueTypes.includes('abnormal'),
        ).length,
      },
      {
        value: 'duplicate' as const,
        label: copy.filters.duplicate,
        count: cleanupState.activeCandidates.filter((candidate) =>
          candidate.issueTypes.includes('duplicate'),
        ).length,
      },
    ],
    [cleanupState.activeCandidates, copy.filters],
  );

  const activeHighConfidenceCount = useMemo(
    () => cleanupState.activeCandidates.filter((candidate) => candidate.confidence === 'high').length,
    [cleanupState.activeCandidates],
  );

  const handleAutoCleanup = useCallback(() => {
    if (activeHighConfidenceCount === 0) {
      Alert.alert(copy.alerts.noAutoCleanupTitle, copy.alerts.noAutoCleanupBody);
      return;
    }

    Alert.alert(
      copy.alerts.autoCleanupTitle,
      copy.alerts.autoCleanupBody(activeHighConfidenceCount),
      [
        { text: copy.common.cancel, style: 'cancel' },
        {
          text: copy.alerts.confirmMoveToRecycle,
          onPress: () => {
            void commitCleanupAction({ type: 'auto-soft-delete' });
          },
        },
      ],
    );
  }, [activeHighConfidenceCount, commitCleanupAction, copy.alerts, copy.common.cancel]);

  const handleSelectedCleanup = useCallback(() => {
    if (selectedCount === 0) {
      return;
    }

    Alert.alert(copy.alerts.selectedCleanupTitle, copy.alerts.selectedCleanupBody(selectedCount), [
      { text: copy.common.cancel, style: 'cancel' },
      {
        text: copy.alerts.moveToRecycle,
        onPress: () => {
          void commitCleanupAction({ type: 'soft-delete', ids: selectedIds });
        },
      },
      {
        text: copy.alerts.deleteForever,
        style: 'destructive',
        onPress: () => {
          Alert.alert(copy.alerts.confirmAgainTitle, copy.alerts.confirmAgainBody, [
            { text: copy.common.cancel, style: 'cancel' },
            {
              text: copy.common.deleteConfirm,
              style: 'destructive',
              onPress: () => {
                void performHardDelete(selectedIds);
              },
            },
          ]);
        },
      },
    ]);
  }, [commitCleanupAction, copy.alerts, copy.common.cancel, copy.common.deleteConfirm, performHardDelete, selectedCount, selectedIds]);

  const handleRestoreSelected = useCallback(() => {
    if (selectedCount === 0) {
      return;
    }

    void commitCleanupAction({ type: 'restore', ids: selectedIds });
  }, [commitCleanupAction, selectedCount, selectedIds]);

  const handlePreviewHardDelete = useCallback(() => {
    if (!previewCandidate) {
      return;
    }

    Alert.alert(copy.alerts.previewDeleteTitle, copy.alerts.previewDeleteBody, [
      { text: copy.common.cancel, style: 'cancel' },
      {
        text: copy.common.deleteConfirm,
        style: 'destructive',
        onPress: () => {
          void performHardDelete([previewCandidate.id]);
        },
      },
    ]);
  }, [copy.alerts.previewDeleteBody, copy.alerts.previewDeleteTitle, copy.common.cancel, copy.common.deleteConfirm, performHardDelete, previewCandidate]);

  const handlePreviewPrimaryAction = useCallback(() => {
    if (!previewCandidate) {
      return;
    }

    const actionMode = resolvePreviewPrimaryActionMode(viewMode);
    const action: CleanupAction =
      actionMode === 'restore'
        ? { type: 'restore', ids: [previewCandidate.id] }
        : { type: 'soft-delete', ids: [previewCandidate.id] };

    void commitCleanupAction(action);
    setPreviewCandidate(null);
  }, [commitCleanupAction, previewCandidate, viewMode]);

  const renderPermissionState = permissionState !== 'granted';
  const effectiveSummary = summary ?? createSummaryFromState(cleanupState, lastScanMeta);
  const reminderCopy = useMemo(
    () => buildRecentScanReminderCopy(summary, reminderSettings, appLanguage),
    [appLanguage, reminderSettings, summary],
  );
  const reminderScheduleSummary = buildReminderSummary(reminderSettings, appLanguage);
  const nextReminderAt = useMemo(
    () => reminderSettings.nextTriggerAt ?? estimateNextReminderTriggerAt(reminderSettings),
    [reminderSettings],
  );
  const localizedReminderSummaryDraft = useMemo(
    () => resolveReminderSummary(reminderSummaryDraft, appLanguage),
    [appLanguage, reminderSummaryDraft],
  );
  const nextReminderLabel = nextReminderAt
    ? formatLocalizedDateTime(nextReminderAt, appLanguage)
    : copy.common.notScheduled;
  const reminderStatusLabel = reminderSettings.enabled
    ? !notificationPermissionGranted
      ? copy.reminder.unauthorized
      : reminderSettings.notificationId
        ? copy.reminder.scheduled
        : copy.reminder.pending
    : copy.reminder.disabled;
  const nextReminderLabelPrefix = reminderSettings.notificationId
    ? copy.reminder.nextReminder
    : notificationPermissionGranted
      ? copy.reminder.estimatedReminder
      : copy.reminder.plannedReminder;

  const persistReminderSettings = useCallback(
    async (nextSettings: ReminderSettings, requestPermission = false) => {
      if (nextSettings.enabled) {
        const granted = await ensureCleanupReminderPermissions(requestPermission);
        setNotificationPermissionGranted(granted);
        notificationPermissionGrantedRef.current = granted;

        if (!granted) {
          const disabledSettings = updateReminderSchedule(nextSettings, { enabled: false });
          await syncReminderState(
            disabledSettings,
            summary,
            reminderSettingsRef.current.notificationId,
          );
          Alert.alert(copy.alerts.reminderDisabledTitle, copy.alerts.reminderDisabledBody);
          return;
        }
      }

      await syncReminderState(
        nextSettings,
        summary,
        reminderSettingsRef.current.notificationId,
      );
    },
    [copy.alerts.reminderDisabledBody, copy.alerts.reminderDisabledTitle, summary, syncReminderState],
  );

  const adjustReminderTime = useCallback(
    async (type: 'hour' | 'minute', delta: number) => {
      const totalMinutes =
        reminderSettings.hour * 60 + reminderSettings.minute + (type === 'hour' ? delta * 60 : delta);
      const normalized = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
      const nextSettings = updateReminderSchedule(reminderSettings, {
        hour: Math.floor(normalized / 60),
        minute: normalized % 60,
      });

      await persistReminderSettings(nextSettings);
    },
    [persistReminderSettings, reminderSettings],
  );

  const toggleReminder = useCallback(async () => {
    const nextSettings = updateReminderSchedule(reminderSettings, {
      enabled: !reminderSettings.enabled,
      summary: reminderSummaryDraft,
    });

    await persistReminderSettings(nextSettings, nextSettings.enabled);
  }, [persistReminderSettings, reminderSettings, reminderSummaryDraft]);

  const saveReminderSummary = useCallback(async () => {
    const nextSettings = updateReminderSchedule(reminderSettings, {
      summary: reminderSummaryDraft,
    });

    await persistReminderSettings(nextSettings);
  }, [persistReminderSettings, reminderSettings, reminderSummaryDraft]);

  const selectReminderFrequency = useCallback(
    async (frequency: ReminderSettings['frequency']) => {
      if (frequency === reminderSettings.frequency) {
        return;
      }

      const nextSettings = updateReminderSchedule(reminderSettings, { frequency });
      await persistReminderSettings(nextSettings);
    },
    [persistReminderSettings, reminderSettings],
  );

  const selectReminderWeekday = useCallback(
    async (weekday: number) => {
      if (weekday === reminderSettings.weekday) {
        return;
      }

      const nextSettings = updateReminderSchedule(reminderSettings, { weekday });
      await persistReminderSettings(nextSettings);
    },
    [persistReminderSettings, reminderSettings],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style={theme.statusBarStyle} />
      <View style={styles.backgroundOrbTop} />
      <View style={styles.backgroundOrbBottom} />

      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.hero}>
          <View style={styles.heroTextWrap}>
            <Text style={styles.kicker}>{copy.hero.kicker}</Text>
            <Text style={styles.title}>{copy.hero.title}</Text>
            <Text style={styles.description}>{copy.hero.description}</Text>
          </View>
          <View style={styles.heroStats}>
            <Text style={styles.heroStatLabel}>{copy.hero.lastScan}</Text>
            <Text style={styles.heroStatValue}>
              {formatLocalizedDateTime(lastScanMeta?.scannedAt, appLanguage)}
            </Text>
            <Text style={styles.heroHint}>{copy.hero.autoCleanupHint}</Text>
          </View>
          <View style={styles.languageRow}>
            <Text style={styles.languageLabel}>{copy.languageLabel}</Text>
            <View style={styles.languageOptions}>
              {copy.languageOptions.map((option) => {
                const active = appLanguage === option.value;

                return (
                  <Pressable
                    key={option.value}
                    onPress={() => {
                      if (option.value === appLanguage) {
                        return;
                      }

                      setAppLanguage(option.value);
                      appLanguageRef.current = option.value;
                      setReminderSummaryDraft(
                        resolveReminderSummary(reminderSettingsRef.current.summary, option.value),
                      );
                      void saveAppLanguage(option.value);
                    }}
                    style={[styles.languageOption, active && styles.languageOptionActive]}
                  >
                    <Text
                      style={[styles.languageOptionText, active && styles.languageOptionTextActive]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View style={styles.languageRow}>
            <Text style={styles.languageLabel}>{copy.appearance.title}</Text>
            <View style={styles.languageOptions}>
              {[
                { value: 'system' as const, label: copy.appearance.system },
                { value: 'light' as const, label: copy.appearance.light },
                { value: 'dark' as const, label: copy.appearance.dark },
              ].map((option) => {
                const active = themePreference === option.value;

                return (
                  <Pressable
                    key={option.value}
                    onPress={() => {
                      if (option.value === themePreference) {
                        return;
                      }

                      setThemePreference(option.value);
                      void saveThemePreference(option.value);
                    }}
                    style={[styles.languageOption, active && styles.languageOptionActive]}
                  >
                    <Text
                      style={[styles.languageOptionText, active && styles.languageOptionTextActive]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>{copy.summary.scannedLabel}</Text>
            <Text style={styles.summaryValue}>{effectiveSummary.scannedCount}</Text>
            <Text style={styles.summaryCaption}>{copy.summary.scannedCaption}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>{copy.summary.candidatesLabel}</Text>
            <Text style={styles.summaryValue}>{effectiveSummary.candidateCount}</Text>
            <Text style={styles.summaryCaption}>{copy.summary.candidatesCaption}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>{copy.summary.suggestedCleanupLabel}</Text>
            <Text style={styles.summaryValue}>{effectiveSummary.highConfidenceCount}</Text>
            <Text style={styles.summaryCaption}>{copy.summary.suggestedCleanupCaption}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>{copy.summary.recycleLabel}</Text>
            <Text style={styles.summaryValue}>{cleanupState.recycleBin.length}</Text>
            <Text style={styles.summaryCaption}>{copy.summary.recycleCaption}</Text>
          </View>
        </View>

        <View style={styles.controlRow}>
          <Pressable
            onPress={() => void hydrateFromScan()}
            style={[styles.primaryButton, isScanning && styles.buttonDisabled]}
            disabled={isScanning}
          >
            <Text style={styles.primaryButtonText}>
              {isScanning ? copy.controls.scanning : copy.controls.rescan}
            </Text>
          </Pressable>
          <Pressable onPress={handleAutoCleanup} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>{copy.controls.autoCleanup}</Text>
          </Pressable>
        </View>

        {errorMessage ? (
          <View style={styles.noticeCard}>
            <Text style={styles.noticeTitle}>{copy.common.statusTitle}</Text>
            <Text style={styles.noticeText}>{errorMessage}</Text>
          </View>
        ) : null}

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>{copy.info.title}</Text>
          <Text style={styles.infoText}>{copy.info.firstLine}</Text>
          <Text style={styles.infoText}>{copy.info.secondLine}</Text>
        </View>

        <View style={styles.reminderCard}>
          <View style={styles.reminderHeader}>
            <View style={styles.reminderHeaderText}>
              <Text style={styles.reminderTitle}>{copy.reminder.title}</Text>
              <Text style={styles.reminderSubtitle}>
                {reminderScheduleSummary} · {reminderStatusLabel} · {copy.reminder.permissionLabel}
                {notificationPermissionGranted ? copy.reminder.permissionOn : copy.reminder.permissionOff}
              </Text>
            </View>
            <Switch value={reminderSettings.enabled} onValueChange={() => void toggleReminder()} />
          </View>
          <Text style={styles.reminderSummary}>{reminderCopy.summary}</Text>
          <Text style={styles.reminderDetail}>{reminderCopy.detail}</Text>
          <Text style={styles.reminderThemePreview}>
            {copy.reminder.themePreview}：{reminderCopy.title}
          </Text>
          <Text style={styles.reminderMeta}>
            {nextReminderLabelPrefix}：{nextReminderLabel}
          </Text>
          <Text style={styles.reminderFieldLabel}>{copy.reminder.frequencyLabel}</Text>
          <View style={styles.reminderFrequencyRow}>
            {reminderFrequencyOptions.map((option) => {
              const active = reminderSettings.frequency === option.value;

              return (
                <Pressable
                  key={option.value}
                  onPress={() => void selectReminderFrequency(option.value)}
                  style={[styles.frequencyButton, active && styles.frequencyButtonActive]}
                >
                  <Text
                    style={[
                      styles.frequencyButtonText,
                      active && styles.frequencyButtonTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {reminderSettings.frequency === 'weekly' ? (
            <>
              <Text style={styles.reminderFieldLabel}>{copy.reminder.weekdayLabel}</Text>
              <View style={styles.reminderWeekdayGrid}>
                {reminderWeekdayOptions.map((option) => {
                  const active = reminderSettings.weekday === option.value;

                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => void selectReminderWeekday(option.value)}
                      style={[styles.weekdayBadge, active && styles.weekdayBadgeActive]}
                    >
                      <Text
                        style={[styles.weekdayBadgeText, active && styles.weekdayBadgeTextActive]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}
          <Text style={styles.reminderFieldLabel}>{copy.reminder.timeLabel}</Text>
          <View style={styles.reminderAdjustRow}>
            <Pressable
              onPress={() => void adjustReminderTime('hour', -1)}
              style={styles.adjustButton}
            >
              <Text style={styles.adjustButtonText}>{copy.reminder.hourMinus}</Text>
            </Pressable>
            <Pressable
              onPress={() => void adjustReminderTime('hour', 1)}
              style={styles.adjustButton}
            >
              <Text style={styles.adjustButtonText}>{copy.reminder.hourPlus}</Text>
            </Pressable>
            <Pressable
              onPress={() => void adjustReminderTime('minute', -15)}
              style={styles.adjustButton}
            >
              <Text style={styles.adjustButtonText}>{copy.reminder.minuteMinus}</Text>
            </Pressable>
            <Pressable
              onPress={() => void adjustReminderTime('minute', 15)}
              style={styles.adjustButton}
            >
              <Text style={styles.adjustButtonText}>{copy.reminder.minutePlus}</Text>
            </Pressable>
          </View>
          <TextInput
            value={localizedReminderSummaryDraft}
            onChangeText={setReminderSummaryDraft}
            placeholder={copy.reminder.themePlaceholder}
            placeholderTextColor={theme.pageTextMuted}
            style={styles.reminderInput}
          />
          <Pressable onPress={() => void saveReminderSummary()} style={styles.secondaryButtonCompact}>
            <Text style={styles.secondaryButtonText}>{copy.reminder.saveTheme}</Text>
          </Pressable>
          <Text style={styles.reminderFootnote}>{copy.reminder.footnote}</Text>
        </View>

        {renderPermissionState ? (
          <View style={styles.permissionCard}>
            <Text style={styles.permissionTitle}>{copy.permission.title}</Text>
            <Text style={styles.permissionText}>{copy.permission.body}</Text>
            <Pressable onPress={() => void requestPermission()} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>{copy.permission.action}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.tabBar}>
              <Pressable
                onPress={() => {
                  void commitCleanupAction({ type: 'clear-selection' }, false);
                  setViewMode('suggestions');
                }}
                style={[styles.tabButton, viewMode === 'suggestions' && styles.tabButtonActive]}
              >
                <Text
                  style={[styles.tabButtonText, viewMode === 'suggestions' && styles.tabButtonTextActive]}
                >
                  {copy.tabs.suggestions}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  void commitCleanupAction({ type: 'clear-selection' }, false);
                  setViewMode('recycle');
                }}
                style={[styles.tabButton, viewMode === 'recycle' && styles.tabButtonActive]}
              >
                <Text
                  style={[styles.tabButtonText, viewMode === 'recycle' && styles.tabButtonTextActive]}
                >
                  {copy.tabs.recycle}
                </Text>
              </Pressable>
            </View>

            {viewMode === 'suggestions' ? (
              <View style={styles.filterRow}>
                {recognitionFilterOptions.map((option) => {
                  const active = recognitionFilter === option.value;

                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => {
                        if (recognitionFilter === option.value) {
                          return;
                        }

                        void commitCleanupAction({ type: 'clear-selection' }, false);
                        setRecognitionFilter(option.value);
                      }}
                      style={[styles.filterChip, active && styles.filterChipActive]}
                    >
                      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                        {option.label} {option.count}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            <View style={styles.listSection}>
              {visibleCandidates.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>
                    {viewMode === 'suggestions' ? copy.empty.suggestionsTitle : copy.empty.recycleTitle}
                  </Text>
                  <Text style={styles.emptyText}>
                    {viewMode === 'suggestions'
                      ? copy.empty.suggestionsBody
                      : copy.empty.recycleBody}
                  </Text>
                </View>
              ) : (
                visibleCandidates.map((candidate) => (
                  <CandidateCard
                    key={candidate.id}
                    candidate={candidate}
                    language={appLanguage}
                    theme={theme}
                    mode={viewMode}
                    selected={cleanupState.selectedIds.includes(candidate.id)}
                    onOpen={() => setPreviewCandidate(candidate)}
                    onToggleSelect={() => {
                      void commitCleanupAction({ type: 'toggle-select', id: candidate.id }, false);
                    }}
                  />
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>

      {selectedCount > 0 ? (
        <View style={styles.actionBar}>
          <Text style={styles.actionBarText}>{copy.actionBar.selectedItems(selectedCount)}</Text>
          <View style={styles.actionBarButtons}>
            {viewMode === 'recycle' ? (
              <Pressable onPress={handleRestoreSelected} style={styles.secondaryButtonCompact}>
                <Text style={styles.secondaryButtonText}>{copy.actionBar.restoreSelected}</Text>
              </Pressable>
            ) : (
              <Pressable onPress={handleSelectedCleanup} style={styles.secondaryButtonCompact}>
                <Text style={styles.secondaryButtonText}>{copy.actionBar.cleanupSelected}</Text>
              </Pressable>
            )}
            <Pressable
              onPress={() => {
                void commitCleanupAction({ type: 'clear-selection' }, false);
              }}
              style={styles.clearButtonCompact}
            >
              <Text style={styles.clearButtonText}>{copy.actionBar.clearSelection}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <PreviewModal
        candidate={previewCandidate}
        language={appLanguage}
        theme={theme}
        visible={Boolean(previewCandidate)}
        mode={viewMode}
        onClose={() => setPreviewCandidate(null)}
        onPrimaryAction={handlePreviewPrimaryAction}
        onHardDelete={handlePreviewHardDelete}
      />
    </SafeAreaView>
  );
}

function createStyles(theme: AppThemePalette) {
  return StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.safeArea,
  },
  backgroundOrbTop: {
    position: 'absolute',
    top: -80,
    right: -20,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: theme.orbTop,
    opacity: 0.8,
  },
  backgroundOrbBottom: {
    position: 'absolute',
    bottom: 120,
    left: -40,
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: theme.orbBottom,
    opacity: 0.55,
  },
  container: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 140,
    gap: 18,
  },
  hero: {
    borderRadius: 32,
    backgroundColor: theme.heroBackground,
    padding: 22,
    gap: 18,
  },
  heroTextWrap: {
    gap: 10,
  },
  kicker: {
    color: theme.heroAccent,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  title: {
    color: theme.heroTitle,
    fontSize: 32,
    fontWeight: '800',
    lineHeight: 38,
  },
  description: {
    color: theme.heroText,
    fontSize: 15,
    lineHeight: 22,
  },
  heroStats: {
    borderRadius: 24,
    backgroundColor: theme.heroSurface,
    padding: 16,
    gap: 6,
  },
  heroStatLabel: {
    color: theme.heroAccent,
    fontSize: 12,
    fontWeight: '700',
  },
  heroStatValue: {
    color: theme.heroTitle,
    fontSize: 20,
    fontWeight: '700',
  },
  heroHint: {
    color: theme.heroHint,
    fontSize: 13,
    lineHeight: 18,
  },
  languageRow: {
    gap: 10,
  },
  languageLabel: {
    color: theme.heroText,
    fontSize: 12,
    fontWeight: '700',
  },
  languageOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  languageOption: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: theme.heroSurface,
  },
  languageOptionActive: {
    backgroundColor: theme.chipActiveBackground,
  },
  languageOptionText: {
    color: theme.heroText,
    fontSize: 12,
    fontWeight: '700',
  },
  languageOptionTextActive: {
    color: theme.chipActiveText,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  summaryCard: {
    width: '48%',
    borderRadius: 24,
    backgroundColor: theme.cardBackground,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    gap: 4,
  },
  summaryLabel: {
    color: theme.pageTextSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  summaryValue: {
    color: theme.pageTextPrimary,
    fontSize: 28,
    fontWeight: '800',
  },
  summaryCaption: {
    color: theme.pageTextMuted,
    fontSize: 12,
  },
  controlRow: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryButton: {
    flex: 1,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: theme.buttonPrimaryBackground,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  primaryButtonText: {
    color: theme.buttonPrimaryText,
    fontWeight: '800',
    fontSize: 15,
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: theme.buttonSecondaryBackground,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: theme.buttonSecondaryText,
    fontWeight: '800',
    fontSize: 15,
  },
  noticeCard: {
    borderRadius: 24,
    backgroundColor: theme.noticeBackground,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.noticeBorder,
    gap: 6,
  },
  noticeTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.noticeTitle,
  },
  noticeText: {
    color: theme.noticeText,
    lineHeight: 20,
  },
  reminderCard: {
    borderRadius: 28,
    padding: 18,
    backgroundColor: theme.cardBackground,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    gap: 12,
  },
  reminderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  reminderHeaderText: {
    flex: 1,
    gap: 4,
  },
  reminderTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.pageTextPrimary,
  },
  reminderSubtitle: {
    color: theme.pageTextSecondary,
    lineHeight: 20,
  },
  reminderSummary: {
    color: theme.pageTextPrimary,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
  },
  reminderDetail: {
    color: theme.pageTextSecondary,
    lineHeight: 21,
  },
  reminderFieldLabel: {
    color: theme.pageTextMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  reminderThemePreview: {
    color: theme.pageTextSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  reminderMeta: {
    color: theme.pageTextMuted,
    fontSize: 13,
  },
  reminderAdjustRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  reminderFrequencyRow: {
    flexDirection: 'row',
    gap: 10,
  },
  frequencyButton: {
    borderRadius: 999,
    backgroundColor: theme.chipBackground,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  frequencyButtonActive: {
    backgroundColor: theme.chipActiveBackground,
  },
  frequencyButtonText: {
    color: theme.chipText,
    fontWeight: '700',
  },
  frequencyButtonTextActive: {
    color: theme.chipActiveText,
  },
  adjustButton: {
    borderRadius: 999,
    backgroundColor: theme.buttonSecondaryBackground,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  adjustButtonText: {
    color: theme.buttonSecondaryText,
    fontWeight: '700',
    fontSize: 13,
  },
  reminderInput: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.inputBorder,
    backgroundColor: theme.inputBackground,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: theme.inputText,
  },
  reminderWeekdayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  reminderWeekdayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  weekdayBadge: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: theme.chipBackground,
    borderWidth: 1,
    borderColor: theme.chipBorder,
    alignItems: 'center',
    minWidth: 64,
  },
  weekdayBadgeActive: {
    backgroundColor: theme.chipActiveBackground,
    borderColor: theme.chipActiveBackground,
  },
  weekdayBadgeText: {
    color: theme.chipText,
    fontWeight: '700',
  },
  weekdayBadgeTextActive: {
    color: theme.chipActiveText,
  },
  reminderFootnote: {
    color: theme.pageTextMuted,
    lineHeight: 19,
    fontSize: 12,
  },
  infoCard: {
    borderRadius: 24,
    backgroundColor: theme.infoBackground,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.infoBorder,
    gap: 8,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.pageTextPrimary,
  },
  infoText: {
    color: theme.pageTextSecondary,
    lineHeight: 20,
  },
  permissionCard: {
    borderRadius: 28,
    padding: 20,
    backgroundColor: theme.cardBackground,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    gap: 14,
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: theme.pageTextPrimary,
  },
  permissionText: {
    fontSize: 15,
    lineHeight: 22,
    color: theme.pageTextSecondary,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: theme.tabBackground,
    borderRadius: 999,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: theme.tabActiveBackground,
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: theme.tabText,
  },
  tabButtonTextActive: {
    color: theme.tabActiveText,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  filterChip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: theme.chipBackground,
  },
  filterChipActive: {
    backgroundColor: theme.chipActiveBackground,
  },
  filterChipText: {
    color: theme.chipText,
    fontWeight: '700',
    fontSize: 13,
  },
  filterChipTextActive: {
    color: theme.chipActiveText,
  },
  listSection: {
    gap: 14,
  },
  emptyCard: {
    borderRadius: 28,
    padding: 20,
    backgroundColor: theme.cardBackground,
    borderWidth: 1,
    borderColor: theme.cardBorder,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.pageTextPrimary,
  },
  emptyText: {
    color: theme.pageTextSecondary,
    lineHeight: 22,
  },
  actionBar: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    borderRadius: 28,
    backgroundColor: theme.actionBarBackground,
    padding: 16,
    gap: 12,
  },
  actionBarText: {
    color: theme.actionBarText,
    fontSize: 16,
    fontWeight: '700',
  },
  actionBarButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryButtonCompact: {
    flex: 1,
    borderRadius: 999,
    backgroundColor: theme.buttonSecondaryBackground,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  clearButtonCompact: {
    borderRadius: 999,
    backgroundColor: theme.buttonTertiaryBackground,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  clearButtonText: {
    color: theme.buttonTertiaryText,
    fontWeight: '700',
  },
});
}
