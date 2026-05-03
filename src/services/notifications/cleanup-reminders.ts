import * as Notifications from 'expo-notifications';
import * as MediaLibrary from 'expo-media-library';
import { Platform } from 'react-native';

import { isDefaultReminderSummary } from '../../i18n/app-copy';
import { assessReminderTrigger } from '../../features/reminders/reminder-trigger';
import type { ReminderCopy } from '../../features/reminders/reminder-copy';
import {
  formatReminderTime,
  type ReminderSettings,
} from '../../features/reminders/reminder-settings';
import {
  loadLastValidScanBaseline,
  type LastValidScanBaseline,
} from '../storage/app-storage';
import {
  buildScanRangeStartAt,
  loadScanRange,
  normalizeScanRange,
} from '../storage/scan-range-storage';

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

export interface CleanupReminderEvaluationContext {
  scanRangeMonths: number;
  latestEligibleAssetAt: number | null;
  baseline: LastValidScanBaseline | null;
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

async function loadLatestEligibleAssetCreatedAt(createdAfter: number) {
  const page = await MediaLibrary.getAssetsAsync({
    first: 1,
    createdAfter,
    mediaType: [MediaLibrary.MediaType.photo, MediaLibrary.MediaType.video],
    sortBy: [[MediaLibrary.SortBy.creationTime, false]],
  });

  return page.assets[0]?.creationTime ?? null;
}

export async function loadCleanupReminderEvaluationContext(): Promise<CleanupReminderEvaluationContext> {
  const scanRangeMonths = await loadScanRange();
  const [baseline, latestEligibleAssetAt] = await Promise.all([
    loadLastValidScanBaseline(),
    loadLatestEligibleAssetCreatedAt(buildScanRangeStartAt(scanRangeMonths)),
  ]);

  return {
    scanRangeMonths,
    latestEligibleAssetAt,
    baseline,
  };
}

export function assessCleanupReminderSchedule(
  enabled: boolean,
  context: CleanupReminderEvaluationContext,
) {
  return assessReminderTrigger({
    enabled,
    scanRangeMonths: context.scanRangeMonths,
    latestEligibleAssetAt: context.latestEligibleAssetAt,
    lastScanAt: context.baseline?.scannedAt ?? null,
    lastValidScanBaseline: context.baseline,
  });
}

export function evaluateCleanupReminderTriggerInBackground(input: {
  enabled: boolean;
  scanRangeMonths: number;
  latestEligibleAssetAt: number | null;
  lastScanAt: number | null;
  lastValidScanBaseline: LastValidScanBaseline | null;
  nowInput?: number;
}) {
  const baseline =
    input.lastValidScanBaseline ?? (
      Number.isFinite(input.lastScanAt)
        ? {
            scannedAt: input.lastScanAt as number,
            scannedCount: 0,
            candidateCount: 0,
            scanRangeMonths: input.scanRangeMonths,
            latestEligibleAssetAt: input.lastScanAt,
            ledgerUpdatedAt: input.lastScanAt as number,
          }
        : null
    );

  return assessReminderTrigger({
    enabled: input.enabled,
    scanRangeMonths: input.scanRangeMonths,
    latestEligibleAssetAt: input.latestEligibleAssetAt,
    lastScanAt: input.lastScanAt,
    lastValidScanBaseline: baseline,
    nowInput: input.nowInput,
  });
}

export async function evaluateCleanupReminderTriggerInForeground(enabled: boolean) {
  if (!enabled) {
    const scanRangeMonths = await loadScanRange();
    const baseline = await loadLastValidScanBaseline();

    return evaluateCleanupReminderTriggerInBackground({
      enabled,
      scanRangeMonths,
      latestEligibleAssetAt: null,
      lastScanAt: baseline?.scannedAt ?? null,
      lastValidScanBaseline: baseline,
    });
  }

  return assessCleanupReminderSchedule(
    enabled,
    await loadCleanupReminderEvaluationContext(),
  );
}

export async function evaluateCleanupReminderTrigger(enabled: boolean) {
  return evaluateCleanupReminderTriggerInForeground(enabled);
}

export async function captureLastValidScanBaseline(input: {
  scannedAt: number;
  scannedCount: number;
  candidateCount: number;
  ledgerUpdatedAt?: number;
}, options?: {
  scanRangeMonths?: number;
  createdAfter?: number;
}): Promise<LastValidScanBaseline> {
  const scanRangeMonths = options?.scanRangeMonths ?? (await loadScanRange());
  const latestEligibleAssetAt = await loadLatestEligibleAssetCreatedAt(
    options?.createdAfter ?? buildScanRangeStartAt(normalizeScanRange(scanRangeMonths)),
  );

  return {
    scannedAt: input.scannedAt,
    scannedCount: input.scannedCount,
    candidateCount: input.candidateCount,
    scanRangeMonths,
    latestEligibleAssetAt,
    ledgerUpdatedAt: input.ledgerUpdatedAt ?? input.scannedAt,
  };
}

async function scheduleCleanupReminderNotification(
  settings: ReminderScheduleLike,
  copy: ReminderCopy,
) {
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

export async function syncCleanupReminderNotification(
  settings: ReminderScheduleLike,
  copy: ReminderCopy,
  channelCopy?: ReminderChannelCopy,
): Promise<ReminderScheduleSyncResult> {
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

  const triggerAssessment = await evaluateCleanupReminderTriggerInForeground(settings.enabled);
  if (!triggerAssessment.shouldSchedule) {
    return {
      notificationId: null,
      nextTriggerAt: null,
    };
  }

  return scheduleCleanupReminderNotification(settings, copy);
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

  const triggerAssessment = await evaluateCleanupReminderTriggerInForeground(settings.enabled);
  if (!triggerAssessment.shouldSchedule) {
    if (settings.notificationId) {
      await Notifications.cancelScheduledNotificationAsync(settings.notificationId);
    }

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

  return scheduleCleanupReminderNotification(settings, copy);
}
