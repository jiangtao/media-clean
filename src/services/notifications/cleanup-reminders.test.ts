import { beforeEach, describe, expect, it, vi } from 'vitest';

const notificationsApi = vi.hoisted(() => ({
  setNotificationHandler: vi.fn(),
  getPermissionsAsync: vi.fn(),
  requestPermissionsAsync: vi.fn(),
  setNotificationChannelAsync: vi.fn(),
  getAllScheduledNotificationsAsync: vi.fn(),
  cancelAllScheduledNotificationsAsync: vi.fn(),
  cancelScheduledNotificationAsync: vi.fn(),
  scheduleNotificationAsync: vi.fn(),
  getNextTriggerDateAsync: vi.fn(),
}));

const mediaLibraryApi = vi.hoisted(() => ({
  getAssetsAsync: vi.fn(),
  MediaType: {
    photo: 'photo',
    video: 'video',
  },
  SortBy: {
    creationTime: 'creationTime',
  },
}));

const appStorageApi = vi.hoisted(() => ({
  loadLastScanMeta: vi.fn(),
  loadLastValidScanBaseline: vi.fn(),
}));

const scanRangeStorageApi = vi.hoisted(() => ({
  loadScanRange: vi.fn(),
  buildScanRangeStartAt: vi.fn(),
}));

vi.mock('expo-notifications', () => ({
  SchedulableTriggerInputTypes: {
    DAILY: 'daily',
    WEEKLY: 'weekly',
  },
  AndroidImportance: {
    DEFAULT: 'default',
  },
  ...notificationsApi,
}));
vi.mock('expo-media-library', () => mediaLibraryApi);

vi.mock('react-native', () => ({
  Platform: {
    OS: 'android',
  },
}));

vi.mock('../storage/app-storage', () => appStorageApi);
vi.mock('../storage/scan-range-storage', () => scanRangeStorageApi);

import {
  buildCleanupReminderRequest,
  evaluateCleanupReminderTriggerInBackground,
  formatReminderTimeLabel,
  reconcileCleanupReminderNotification,
  syncCleanupReminderNotification,
} from './cleanup-reminders';

describe('cleanup reminders', () => {
  beforeEach(() => {
    notificationsApi.setNotificationChannelAsync.mockReset();
    notificationsApi.getAllScheduledNotificationsAsync.mockReset();
    notificationsApi.cancelAllScheduledNotificationsAsync.mockReset();
    notificationsApi.cancelScheduledNotificationAsync.mockReset();
    notificationsApi.scheduleNotificationAsync.mockReset();
    notificationsApi.getNextTriggerDateAsync.mockReset();
    mediaLibraryApi.getAssetsAsync.mockReset();
    appStorageApi.loadLastScanMeta.mockReset();
    appStorageApi.loadLastValidScanBaseline.mockReset();
    scanRangeStorageApi.loadScanRange.mockReset();
    scanRangeStorageApi.buildScanRangeStartAt.mockReset();

    mediaLibraryApi.getAssetsAsync.mockResolvedValue({
      assets: [
        {
          id: 'newer-photo',
          creationTime: 1_710_100_000_000,
          mediaType: mediaLibraryApi.MediaType.photo,
        },
      ],
      hasNextPage: false,
      endCursor: undefined,
    });
    appStorageApi.loadLastScanMeta.mockResolvedValue({
      scannedAt: 1_710_000_000_000,
      scannedCount: 180,
      candidateCount: 12,
    });
    appStorageApi.loadLastValidScanBaseline.mockResolvedValue({
      scannedAt: 1_710_000_000_000,
      scannedCount: 180,
      candidateCount: 12,
      scanRangeMonths: 3,
      latestEligibleAssetAt: 1_710_000_000_000,
      ledgerUpdatedAt: 1_710_000_000_000,
    });
    scanRangeStorageApi.loadScanRange.mockResolvedValue(3);
    scanRangeStorageApi.buildScanRangeStartAt.mockReturnValue(1_709_000_000_000);
  });

  it('formats reminder time consistently', () => {
    expect(formatReminderTimeLabel({ hour: 9, minute: 5 })).toBe('09:05');
  });

  it('builds a daily reminder request from settings and copy', () => {
    const request = buildCleanupReminderRequest(
      {
        enabled: true,
        frequency: 'daily',
        weekday: 1,
        hour: 21,
        minute: 30,
        summary: '定期检查最近拍摄的照片和视频，优先清理误触、异常与重复内容。',
      },
      {
        title: '定期清理提醒',
        summary: '最近一次扫描发现 8 个待处理识别结果，建议在 21:30 再检查一次。',
        detail: '本次扫描共检查 180 项媒体，其中 5 项高置信度。',
      },
    );

    expect(request.content.title).toBe('定期清理提醒');
    expect(request.content.body).toContain('最近一次扫描发现 8 个待处理识别结果');
    expect(request.trigger).toMatchObject({
      type: 'daily',
      hour: 21,
      minute: 30,
      channelId: 'cleanup-reminders',
    });
  });

  it('builds a weekly reminder trigger when the schedule is weekly', () => {
    const request = buildCleanupReminderRequest(
      {
        enabled: true,
        frequency: 'weekly',
        weekday: 6,
        hour: 10,
        minute: 0,
        summary: '周末清理相册',
      },
      {
        title: '定期清理提醒',
        summary: '周末再清理一次最近拍摄的内容。',
        detail: '建议先重新扫描，再决定是否移入回收站。',
      },
    );

    expect(request.content.title).toBe('周末清理相册');
    expect(request.trigger).toMatchObject({
      type: 'weekly',
      weekday: 6,
      hour: 10,
      minute: 0,
      channelId: 'cleanup-reminders',
    });
  });

  it('treats the english default reminder summary as a generic notification title', () => {
    const request = buildCleanupReminderRequest(
      {
        enabled: true,
        frequency: 'daily',
        weekday: 1,
        hour: 8,
        minute: 0,
        summary: 'Regularly review recent photos and videos, prioritizing accidental, anomalous, and duplicate media.',
      },
      {
        title: 'Cleanup Reminder',
        summary: 'The last scan found 2 suspicious items. Check again at 08:00.',
        detail: 'This scan checked 64 media items.',
      },
    );

    expect(request.content.title).toBe('Cleanup Reminder');
  });

  it('suppresses the evaluator when reminders are disabled', () => {
    expect(
      evaluateCleanupReminderTriggerInBackground({
        enabled: false,
        scanRangeMonths: 3,
        latestEligibleAssetAt: 1_710_100_000_000,
        lastScanAt: 1_710_000_000_000,
        lastValidScanBaseline: {
          scannedAt: 1_710_000_000_000,
          scannedCount: 180,
          candidateCount: 12,
          scanRangeMonths: 3,
          latestEligibleAssetAt: 1_710_000_000_000,
          ledgerUpdatedAt: 1_710_000_000_000,
        },
        nowInput: 1_710_200_000_000,
      }),
    ).toMatchObject({
      shouldSchedule: false,
      reason: 'disabled',
    });
  });

  it('suppresses the evaluator when no eligible media was added after the last valid scan baseline', () => {
    expect(
      evaluateCleanupReminderTriggerInBackground({
        enabled: true,
        scanRangeMonths: 3,
        latestEligibleAssetAt: 1_710_000_000_000,
        lastScanAt: 1_710_000_000_000,
        lastValidScanBaseline: {
          scannedAt: 1_710_000_000_000,
          scannedCount: 180,
          candidateCount: 12,
          scanRangeMonths: 3,
          latestEligibleAssetAt: 1_710_000_000_000,
          ledgerUpdatedAt: 1_710_000_000_000,
        },
        nowInput: 1_710_200_000_000,
      }),
    ).toMatchObject({
      shouldSchedule: false,
      reason: 'no-new-media-since-last-scan',
    });
  });

  it('treats recent eligible media as enough context before the first valid scan baseline exists', () => {
    expect(
      evaluateCleanupReminderTriggerInBackground({
        enabled: true,
        scanRangeMonths: 6,
        latestEligibleAssetAt: 1_710_100_000_000,
        lastScanAt: null,
        lastValidScanBaseline: null,
        nowInput: 1_710_200_000_000,
      }),
    ).toMatchObject({
      shouldSchedule: true,
      reason: 'recent-media-before-first-scan',
    });
  });

  it('marks the evaluator as eligible when new media arrives after the last valid scan baseline', () => {
    expect(
      evaluateCleanupReminderTriggerInBackground({
        enabled: true,
        scanRangeMonths: 3,
        latestEligibleAssetAt: 1_710_100_000_000,
        lastScanAt: 1_710_000_000_000,
        lastValidScanBaseline: {
          scannedAt: 1_710_000_000_000,
          scannedCount: 180,
          candidateCount: 12,
          scanRangeMonths: 3,
          latestEligibleAssetAt: 1_710_000_000_000,
          ledgerUpdatedAt: 1_710_000_000_000,
        },
        nowInput: 1_710_200_000_000,
      }),
    ).toMatchObject({
      shouldSchedule: true,
      reason: 'new-media-since-last-scan',
    });
  });

  it('returns scheduled metadata and cancels only the previous reminder when resyncing', async () => {
    notificationsApi.scheduleNotificationAsync.mockResolvedValueOnce('next-reminder-id');
    notificationsApi.getNextTriggerDateAsync.mockResolvedValueOnce(1_710_000_000_000);

    await expect(
      syncCleanupReminderNotification(
        {
          enabled: true,
          frequency: 'weekly',
          weekday: 2,
          hour: 8,
          minute: 15,
          summary: '工作日清理提醒',
          previousNotificationId: 'old-reminder-id',
        },
        {
          title: '工作日清理提醒',
          summary: '记得重新打开应用清理最近媒体。',
          detail: '先扫描，再决定是否放入回收站。',
        },
      ),
    ).resolves.toEqual({
      notificationId: 'next-reminder-id',
      nextTriggerAt: 1_710_000_000_000,
    });

    expect(notificationsApi.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      'old-reminder-id',
    );
    expect(notificationsApi.cancelAllScheduledNotificationsAsync).not.toHaveBeenCalled();
    expect(notificationsApi.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
  });

  it('reuses persisted metadata when the scheduled reminder still exists on cold start', async () => {
    notificationsApi.getAllScheduledNotificationsAsync.mockResolvedValueOnce([
      {
        identifier: 'saved-reminder-id',
        content: {},
        trigger: {
          type: 'weekly',
          weekday: 3,
          hour: 19,
          minute: 45,
          channelId: 'cleanup-reminders',
        },
      },
    ]);
    notificationsApi.getNextTriggerDateAsync.mockResolvedValueOnce(1_710_100_000_000);

    await expect(
      reconcileCleanupReminderNotification(
        {
          enabled: true,
          frequency: 'weekly',
          weekday: 3,
          hour: 19,
          minute: 45,
          notificationId: 'saved-reminder-id',
        },
        {
          title: '定期清理提醒',
          summary: '重新打开应用检查最近媒体。',
          detail: '不会在后台偷偷扫描。',
        },
      ),
    ).resolves.toEqual({
      notificationId: 'saved-reminder-id',
      nextTriggerAt: 1_710_100_000_000,
    });

    expect(notificationsApi.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(notificationsApi.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
  });

  it('schedules a fresh reminder when the persisted notification is missing on cold start', async () => {
    notificationsApi.getAllScheduledNotificationsAsync.mockResolvedValueOnce([]);
    notificationsApi.scheduleNotificationAsync.mockResolvedValueOnce('new-reminder-id');
    notificationsApi.getNextTriggerDateAsync.mockResolvedValueOnce(1_710_200_000_000);

    await expect(
      reconcileCleanupReminderNotification(
        {
          enabled: true,
          frequency: 'daily',
          weekday: 1,
          hour: 20,
          minute: 30,
          notificationId: 'missing-reminder-id',
        },
        {
          title: '定期清理提醒',
          summary: '重新打开应用检查最近媒体。',
          detail: '不会在后台偷偷扫描。',
        },
      ),
    ).resolves.toEqual({
      notificationId: 'new-reminder-id',
      nextTriggerAt: 1_710_200_000_000,
    });

    expect(notificationsApi.scheduleNotificationAsync).toHaveBeenCalledTimes(1);
    expect(notificationsApi.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
  });

  it('clears reminder metadata when the reminder is disabled', async () => {
    await expect(
      syncCleanupReminderNotification(
        {
          enabled: false,
          frequency: 'daily',
          weekday: 1,
          hour: 20,
          minute: 30,
          previousNotificationId: 'old-reminder-id',
        },
        {
          title: '定期清理提醒',
          summary: '重新打开应用检查最近媒体。',
          detail: '不会在后台偷偷扫描。',
        },
      ),
    ).resolves.toEqual({
      notificationId: null,
      nextTriggerAt: null,
    });

    expect(notificationsApi.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      'old-reminder-id',
    );
    expect(notificationsApi.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('does not schedule a reminder when the configured recent range has no newer media', async () => {
    mediaLibraryApi.getAssetsAsync.mockResolvedValueOnce({
      assets: [
        {
          id: 'older-photo',
          creationTime: 1_709_000_000_000,
          mediaType: mediaLibraryApi.MediaType.photo,
        },
      ],
      hasNextPage: false,
      endCursor: undefined,
    });

    await expect(
      syncCleanupReminderNotification(
        {
          enabled: true,
          frequency: 'daily',
          weekday: 1,
          hour: 20,
          minute: 30,
          previousNotificationId: 'old-reminder-id',
        },
        {
          title: '定期清理提醒',
          summary: '重新打开应用检查最近媒体。',
          detail: '不会在后台偷偷扫描。',
        },
      ),
    ).resolves.toEqual({
      notificationId: null,
      nextTriggerAt: null,
    });

    expect(notificationsApi.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(notificationsApi.getNextTriggerDateAsync).not.toHaveBeenCalled();
  });

  it('cancels an existing reminder when trigger conditions are no longer met on cold start', async () => {
    mediaLibraryApi.getAssetsAsync.mockResolvedValueOnce({
      assets: [
        {
          id: 'older-photo',
          creationTime: 1_709_000_000_000,
          mediaType: mediaLibraryApi.MediaType.photo,
        },
      ],
      hasNextPage: false,
      endCursor: undefined,
    });

    await expect(
      reconcileCleanupReminderNotification(
        {
          enabled: true,
          frequency: 'daily',
          weekday: 1,
          hour: 20,
          minute: 30,
          notificationId: 'stale-reminder-id',
        },
        {
          title: '定期清理提醒',
          summary: '重新打开应用检查最近媒体。',
          detail: '不会在后台偷偷扫描。',
        },
      ),
    ).resolves.toEqual({
      notificationId: null,
      nextTriggerAt: null,
    });

    expect(notificationsApi.cancelScheduledNotificationAsync).toHaveBeenCalledWith(
      'stale-reminder-id',
    );
    expect(notificationsApi.scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});
