import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { isDefaultReminderSummary } from '../../i18n/app-copy';
import type { ReminderCopy } from '../../features/reminders/reminder-copy';
import {
  formatReminderTime,
  type ReminderSettings,
} from '../../features/reminders/reminder-settings';

export const REMINDER_CHANNEL_ID = 'cleanup-reminders';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

type ReminderScheduleLike = Pick<
  ReminderSettings,
  'enabled' | 'frequency' | 'weekday' | 'hour' | 'minute'
> & {
  notificationId?: string | null;
  previousNotificationId?: string | null;
  summary?: string;
};

export interface ReminderScheduleSyncResult {
  notificationId: string | null;
  nextTriggerAt: number | null;
}

interface ReminderChannelCopy {
  name: string;
  description: string;
}

export function formatReminderTimeLabel(input: Pick<ReminderScheduleLike, 'hour' | 'minute'>) {
  return formatReminderTime(input);
}

export function buildCleanupReminderTrigger(settings: ReminderScheduleLike) {
  if (settings.frequency === 'weekly') {
    return {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      channelId: REMINDER_CHANNEL_ID,
      weekday: settings.weekday,
      hour: settings.hour,
      minute: settings.minute,
    } as const;
  }

  return {
    type: Notifications.SchedulableTriggerInputTypes.DAILY,
    channelId: REMINDER_CHANNEL_ID,
    hour: settings.hour,
    minute: settings.minute,
  } as const;
}

export function buildCleanupReminderRequest(
  settings: ReminderScheduleLike,
  copy: ReminderCopy,
) {
  const customTitle =
    typeof settings.summary === 'string' &&
    settings.summary.trim().length > 0 &&
    !isDefaultReminderSummary(settings.summary)
      ? settings.summary.trim()
      : copy.title;

  return {
    content: {
      title: customTitle,
      body: copy.summary,
      data: {
        detail: copy.detail,
        summary: settings.summary ?? copy.summary,
      },
    },
    trigger: buildCleanupReminderTrigger(settings),
  };
}

function isSchedulableTrigger(
  trigger: Notifications.NotificationTrigger,
): trigger is Notifications.SchedulableNotificationTriggerInput {
  return (
    trigger !== null &&
    'type' in trigger &&
    trigger.type !== 'push' &&
    trigger.type !== 'location' &&
    trigger.type !== 'unknown'
  );
}

export async function ensureCleanupReminderPermissions(requestIfNeeded = false) {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) {
    return true;
  }

  if (!requestIfNeeded) {
    return false;
  }

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

export async function configureCleanupReminderChannel(copy?: ReminderChannelCopy) {
  if (Platform.OS !== 'android') {
    return;
  }

  await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
    name: copy?.name ?? '定期清理提醒',
    importance: Notifications.AndroidImportance.DEFAULT,
    description: copy?.description ?? '提醒你重新扫描最近媒体并清理误触、异常与重复内容。',
    enableVibrate: true,
    showBadge: false,
  });
}

export async function syncCleanupReminderNotification(
  settings: ReminderScheduleLike,
  copy: ReminderCopy,
  channelCopy?: ReminderChannelCopy,
) : Promise<ReminderScheduleSyncResult> {
  await configureCleanupReminderChannel(channelCopy);

  if (settings.previousNotificationId) {
    await Notifications.cancelScheduledNotificationAsync(settings.previousNotificationId);
  }

  if (!settings.enabled) {
    return {
      notificationId: null,
      nextTriggerAt: null,
    };
  }

  const request = buildCleanupReminderRequest(settings, copy);
  const [notificationId, nextTriggerAt] = await Promise.all([
    Notifications.scheduleNotificationAsync(request),
    Notifications.getNextTriggerDateAsync(request.trigger),
  ]);

  return {
    notificationId,
    nextTriggerAt: typeof nextTriggerAt === 'number' ? nextTriggerAt : null,
  };
}

export async function reconcileCleanupReminderNotification(
  settings: ReminderScheduleLike,
  copy: ReminderCopy,
  channelCopy?: ReminderChannelCopy,
): Promise<ReminderScheduleSyncResult> {
  await configureCleanupReminderChannel(channelCopy);

  if (!settings.enabled) {
    return {
      notificationId: null,
      nextTriggerAt: null,
    };
  }

  if (settings.notificationId) {
    const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
    const existingRequest = scheduledNotifications.find(
      (notification) => notification.identifier === settings.notificationId,
    );

    if (existingRequest) {
      const nextTriggerAt = isSchedulableTrigger(existingRequest.trigger)
        ? await Notifications.getNextTriggerDateAsync(existingRequest.trigger)
        : null;
      return {
        notificationId: settings.notificationId,
        nextTriggerAt: typeof nextTriggerAt === 'number' ? nextTriggerAt : null,
      };
    }
  }

  const request = buildCleanupReminderRequest(settings, copy);
  const [notificationId, nextTriggerAt] = await Promise.all([
    Notifications.scheduleNotificationAsync(request),
    Notifications.getNextTriggerDateAsync(request.trigger),
  ]);

  return {
    notificationId,
    nextTriggerAt: typeof nextTriggerAt === 'number' ? nextTriggerAt : null,
  };
}
