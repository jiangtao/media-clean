import type { AppLanguage } from '../../i18n/app-language';
import { loadLastScanMeta } from '../../services/storage/app-storage';
import {
  ensureCleanupReminderPermissions,
  reconcileCleanupReminderNotification,
  syncCleanupReminderNotification,
} from '../../services/notifications/cleanup-reminders';
import {
  loadReminderSettings,
  saveReminderSettings,
} from '../../services/storage/reminder-settings-storage';
import { buildRecentScanReminderCopy } from './reminder-copy';
import {
  updateReminderSchedule,
  type ReminderSettings,
} from './reminder-settings';

export interface ReminderChannelCopy {
  name: string;
  description: string;
}

export interface ReminderRuntimeState {
  settings: ReminderSettings;
  permissionGranted: boolean;
}

function mergeReminderScheduleMetadata(
  settings: ReminderSettings,
  schedule: { notificationId: string | null; nextTriggerAt: number | null },
): ReminderSettings {
  return {
    ...settings,
    notificationId: schedule.notificationId,
    nextTriggerAt: schedule.nextTriggerAt,
  };
}

async function buildReminderCopy(
  settings: Pick<ReminderSettings, 'enabled' | 'hour' | 'minute' | 'summary'>,
  language: AppLanguage,
) {
  const latestScanMeta = await loadLastScanMeta();
  const latestScan = latestScanMeta
    ? {
        ...latestScanMeta,
        highConfidenceCount: 0,
        mediumConfidenceCount: 0,
        recycleBinCount: 0,
      }
    : null;
  return buildRecentScanReminderCopy(latestScan, settings, language);
}

async function persistReminderSettingsIfChanged(
  current: ReminderSettings,
  next: ReminderSettings,
) {
  if (JSON.stringify(current) === JSON.stringify(next)) {
    return;
  }

  await saveReminderSettings(next);
}

export async function reconcileReminderRuntimeSettings(
  settings: ReminderSettings,
  language: AppLanguage,
  channelCopy: ReminderChannelCopy,
): Promise<ReminderRuntimeState> {
  const permissionGranted = await ensureCleanupReminderPermissions(false);
  if (!settings.enabled || !permissionGranted) {
    return {
      settings,
      permissionGranted,
    };
  }

  const reminderCopy = await buildReminderCopy(settings, language);
  const schedule = await reconcileCleanupReminderNotification(
    settings,
    reminderCopy,
    channelCopy,
  );
  const nextSettings = mergeReminderScheduleMetadata(settings, schedule);
  await persistReminderSettingsIfChanged(settings, nextSettings);

  return {
    settings: nextSettings,
    permissionGranted,
  };
}

export async function reconcileReminderRuntimeOnLaunch(
  language: AppLanguage,
  channelCopy: ReminderChannelCopy,
): Promise<ReminderRuntimeState> {
  const settings = await loadReminderSettings();
  return reconcileReminderRuntimeSettings(settings, language, channelCopy);
}

export async function syncReminderRuntimeSettings(
  current: ReminderSettings,
  patch: Partial<ReminderSettings>,
  language: AppLanguage,
  channelCopy: ReminderChannelCopy,
  options: {
    requestPermissionOnEnable?: boolean;
  } = {},
): Promise<ReminderRuntimeState> {
  const nextSettings = updateReminderSchedule(current, patch);
  const shouldRequestPermission = Boolean(
    nextSettings.enabled && options.requestPermissionOnEnable,
  );
  const permissionGranted = await ensureCleanupReminderPermissions(
    shouldRequestPermission,
  );

  if (nextSettings.enabled && !permissionGranted) {
    const disabledSettings = updateReminderSchedule(nextSettings, {
      enabled: false,
    });
    await persistReminderSettingsIfChanged(current, disabledSettings);
    return {
      settings: disabledSettings,
      permissionGranted,
    };
  }

  const reminderCopy = await buildReminderCopy(nextSettings, language);
  const schedule = await syncCleanupReminderNotification(
    {
      ...nextSettings,
      previousNotificationId: current.notificationId,
    },
    reminderCopy,
    channelCopy,
  );
  const persistedSettings = mergeReminderScheduleMetadata(nextSettings, schedule);
  await persistReminderSettingsIfChanged(current, persistedSettings);

  return {
    settings: persistedSettings,
    permissionGranted,
  };
}
