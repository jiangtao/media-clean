import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';

import { getAppCopy } from '../../i18n/app-copy';
import { loadAppLanguage } from '../../services/storage/app-language-storage';
import { loadLastScanMeta } from '../../services/storage/app-storage';
import {
  loadReminderSettings,
  saveReminderSettings,
} from '../../services/storage/reminder-settings-storage';
import {
  ensureCleanupReminderPermissions,
  reconcileCleanupReminderNotification,
} from '../../services/notifications/cleanup-reminders';
import type { ReminderCopy } from './reminder-copy';
import { buildRecentScanReminderCopy } from './reminder-copy';
import type { ReminderSettings } from './reminder-settings';

export const CLEANUP_REMINDER_BACKGROUND_TASK = 'cleanup-reminder-background-reconcile';

function buildReminderMinimumIntervalMinutes(settings: ReminderSettings) {
  return settings.frequency === 'daily' ? 60 * 24 : 60 * 24 * 7;
}

async function buildBackgroundReminderCopy(
  settings: Pick<ReminderSettings, 'enabled' | 'hour' | 'minute' | 'summary'>,
) : Promise<ReminderCopy> {
  const language = await loadAppLanguage();
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

async function runCleanupReminderBackgroundPass() {
  const settings = await loadReminderSettings();
  const permissionGranted = await ensureCleanupReminderPermissions(false);

  if (!settings.enabled || !permissionGranted) {
    return BackgroundTask.BackgroundTaskResult.Success;
  }

  const language = await loadAppLanguage();
  const copy = getAppCopy(language);
  const nextSchedule = await reconcileCleanupReminderNotification(
    settings,
    await buildBackgroundReminderCopy(settings),
    {
      name: copy.reminder.channelName,
      description: copy.reminder.channelDescription,
    },
  );
  const nextSettings = {
    ...settings,
    ...nextSchedule,
  };

  if (JSON.stringify(nextSettings) !== JSON.stringify(settings)) {
    await saveReminderSettings(nextSettings);
  }

  return BackgroundTask.BackgroundTaskResult.Success;
}

if (!TaskManager.isTaskDefined(CLEANUP_REMINDER_BACKGROUND_TASK)) {
  TaskManager.defineTask(CLEANUP_REMINDER_BACKGROUND_TASK, async () => {
    try {
      return await runCleanupReminderBackgroundPass();
    } catch (error) {
      console.error('Failed to run cleanup reminder background task:', error);
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}

async function getBackgroundTaskStatusSafe() {
  try {
    return await BackgroundTask.getStatusAsync();
  } catch {
    return BackgroundTask.BackgroundTaskStatus.Restricted;
  }
}

async function isCleanupReminderBackgroundTaskRegisteredSafe() {
  try {
    return await TaskManager.isTaskRegisteredAsync(CLEANUP_REMINDER_BACKGROUND_TASK);
  } catch {
    return false;
  }
}

export async function syncCleanupReminderBackgroundTaskRegistration(
  settings: ReminderSettings,
  options: {
    permissionGranted?: boolean;
  } = {},
) {
  const permissionGranted =
    typeof options.permissionGranted === 'boolean'
      ? options.permissionGranted
      : await ensureCleanupReminderPermissions(false);
  const status = await getBackgroundTaskStatusSafe();
  const isRegistered = await isCleanupReminderBackgroundTaskRegisteredSafe();

  if (
    !settings.enabled ||
    !permissionGranted ||
    status !== BackgroundTask.BackgroundTaskStatus.Available
  ) {
    if (isRegistered) {
      await BackgroundTask.unregisterTaskAsync(CLEANUP_REMINDER_BACKGROUND_TASK);
    }

    return {
      available: status === BackgroundTask.BackgroundTaskStatus.Available,
      registered: false,
    };
  }

  if (isRegistered) {
    await BackgroundTask.unregisterTaskAsync(CLEANUP_REMINDER_BACKGROUND_TASK);
  }

  await BackgroundTask.registerTaskAsync(CLEANUP_REMINDER_BACKGROUND_TASK, {
    minimumInterval: buildReminderMinimumIntervalMinutes(settings),
  });

  return {
    available: true,
    registered: true,
  };
}
