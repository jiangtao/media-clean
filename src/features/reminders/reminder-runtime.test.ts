import { beforeEach, describe, expect, it, vi } from 'vitest';

const appStorageApi = vi.hoisted(() => ({
  loadLastScanMeta: vi.fn(),
}));

const reminderStorageApi = vi.hoisted(() => ({
  loadReminderSettings: vi.fn(),
  saveReminderSettings: vi.fn(),
}));

const notificationApi = vi.hoisted(() => ({
  ensureCleanupReminderPermissions: vi.fn(),
  reconcileCleanupReminderNotification: vi.fn(),
  syncCleanupReminderNotification: vi.fn(),
}));

const backgroundTaskApi = vi.hoisted(() => ({
  syncCleanupReminderBackgroundTaskRegistration: vi.fn(),
}));

vi.mock('../../services/storage/app-storage', () => appStorageApi);
vi.mock('../../services/storage/reminder-settings-storage', () => reminderStorageApi);
vi.mock('../../services/notifications/cleanup-reminders', () => notificationApi);
vi.mock('./reminder-background-task', () => backgroundTaskApi);

import {
  reconcileReminderRuntimeInForeground,
  reconcileReminderRuntimeOnLaunch,
  reconcileReminderRuntimeSettings,
  syncReminderRuntimeSettings,
} from './reminder-runtime';
import type { ReminderSettings } from './reminder-settings';

const baseSettings: ReminderSettings = {
  enabled: true,
  frequency: 'weekly',
  weekday: 1,
  hour: 20,
  minute: 30,
  notificationId: 'existing-reminder-id',
  nextTriggerAt: 1_710_000_000_000,
  summary: '定期检查最近拍摄的照片和视频，优先清理误触、异常与重复内容。',
};

describe('reminder runtime', () => {
  beforeEach(() => {
    appStorageApi.loadLastScanMeta.mockReset();
    reminderStorageApi.loadReminderSettings.mockReset();
    reminderStorageApi.saveReminderSettings.mockReset();
    notificationApi.ensureCleanupReminderPermissions.mockReset();
    notificationApi.reconcileCleanupReminderNotification.mockReset();
    notificationApi.syncCleanupReminderNotification.mockReset();
    backgroundTaskApi.syncCleanupReminderBackgroundTaskRegistration.mockReset();

    appStorageApi.loadLastScanMeta.mockResolvedValue({
      scannedAt: 1_710_100_000_000,
      scannedCount: 180,
      candidateCount: 12,
      highConfidenceCount: 8,
      mediumConfidenceCount: 4,
      recycleBinCount: 1,
    });
    reminderStorageApi.saveReminderSettings.mockResolvedValue(undefined);
    backgroundTaskApi.syncCleanupReminderBackgroundTaskRegistration.mockResolvedValue({
      available: true,
      registered: true,
    });
  });

  it('reconciles persisted reminder metadata on app launch in the live runtime path', async () => {
    reminderStorageApi.loadReminderSettings.mockResolvedValue(baseSettings);
    notificationApi.ensureCleanupReminderPermissions.mockResolvedValue(true);
    notificationApi.reconcileCleanupReminderNotification.mockResolvedValue({
      notificationId: 'reconciled-reminder-id',
      nextTriggerAt: 1_710_300_000_000,
    });

    await expect(
      reconcileReminderRuntimeOnLaunch('zh-CN', {
        name: '定期清理提醒',
        description: '提醒你重新扫描最近媒体并清理误触、异常与重复内容。',
      }),
    ).resolves.toEqual({
      settings: {
        ...baseSettings,
        notificationId: 'reconciled-reminder-id',
        nextTriggerAt: 1_710_300_000_000,
      },
      permissionGranted: true,
    });

    expect(notificationApi.reconcileCleanupReminderNotification).toHaveBeenCalledTimes(1);
    expect(reminderStorageApi.saveReminderSettings).toHaveBeenCalledWith({
      ...baseSettings,
      notificationId: 'reconciled-reminder-id',
      nextTriggerAt: 1_710_300_000_000,
    });
    expect(
      backgroundTaskApi.syncCleanupReminderBackgroundTaskRegistration,
    ).toHaveBeenCalledWith(
      {
        ...baseSettings,
        notificationId: 'reconciled-reminder-id',
        nextTriggerAt: 1_710_300_000_000,
      },
      { permissionGranted: true },
    );
  });

  it('loads stored settings through the foreground reconcile entry', async () => {
    reminderStorageApi.loadReminderSettings.mockResolvedValue(baseSettings);
    notificationApi.ensureCleanupReminderPermissions.mockResolvedValue(true);
    notificationApi.reconcileCleanupReminderNotification.mockResolvedValue({
      notificationId: 'reconciled-reminder-id',
      nextTriggerAt: 1_710_300_000_000,
    });

    await expect(
      reconcileReminderRuntimeInForeground('zh-CN', {
        name: '定期清理提醒',
        description: '提醒你重新扫描最近媒体并清理误触、异常与重复内容。',
      }),
    ).resolves.toEqual({
      settings: {
        ...baseSettings,
        notificationId: 'reconciled-reminder-id',
        nextTriggerAt: 1_710_300_000_000,
      },
      permissionGranted: true,
    });

    expect(reminderStorageApi.loadReminderSettings).toHaveBeenCalledTimes(1);
  });

  it('syncs reminder settings when the user enables reminders and scheduling succeeds', async () => {
    notificationApi.ensureCleanupReminderPermissions.mockResolvedValue(true);
    notificationApi.syncCleanupReminderNotification.mockResolvedValue({
      notificationId: 'new-reminder-id',
      nextTriggerAt: 1_710_400_000_000,
    });

    await expect(
      syncReminderRuntimeSettings(
        {
          ...baseSettings,
          enabled: false,
          notificationId: null,
          nextTriggerAt: null,
        },
        { enabled: true, frequency: 'daily', weekday: 3, hour: 9, minute: 15 },
        'zh-CN',
        {
          name: '定期清理提醒',
          description: '提醒你重新扫描最近媒体并清理误触、异常与重复内容。',
        },
        { requestPermissionOnEnable: true },
      ),
    ).resolves.toEqual({
      settings: {
        ...baseSettings,
        enabled: true,
        frequency: 'daily',
        weekday: 3,
        hour: 9,
        minute: 15,
        notificationId: 'new-reminder-id',
        nextTriggerAt: 1_710_400_000_000,
      },
      permissionGranted: true,
    });

    expect(notificationApi.ensureCleanupReminderPermissions).toHaveBeenCalledWith(true);
    expect(notificationApi.syncCleanupReminderNotification).toHaveBeenCalledTimes(1);
    expect(
      backgroundTaskApi.syncCleanupReminderBackgroundTaskRegistration,
    ).toHaveBeenCalledWith(
      {
        ...baseSettings,
        enabled: true,
        frequency: 'daily',
        weekday: 3,
        hour: 9,
        minute: 15,
        notificationId: 'new-reminder-id',
        nextTriggerAt: 1_710_400_000_000,
      },
      { permissionGranted: true },
    );
  });

  it('keeps reminders disabled when enabling fails because notification permission is denied', async () => {
    notificationApi.ensureCleanupReminderPermissions.mockResolvedValue(false);

    await expect(
      syncReminderRuntimeSettings(
        {
          ...baseSettings,
          enabled: false,
          notificationId: null,
          nextTriggerAt: null,
        },
        { enabled: true },
        'zh-CN',
        {
          name: '定期清理提醒',
          description: '提醒你重新扫描最近媒体并清理误触、异常与重复内容。',
        },
        { requestPermissionOnEnable: true },
      ),
    ).resolves.toEqual({
      settings: {
        ...baseSettings,
        enabled: false,
        notificationId: null,
        nextTriggerAt: null,
      },
      permissionGranted: false,
    });

    expect(notificationApi.syncCleanupReminderNotification).not.toHaveBeenCalled();
    expect(reminderStorageApi.saveReminderSettings).not.toHaveBeenCalled();
    expect(
      backgroundTaskApi.syncCleanupReminderBackgroundTaskRegistration,
    ).toHaveBeenCalledWith(
      {
        ...baseSettings,
        enabled: false,
        notificationId: null,
        nextTriggerAt: null,
      },
      { permissionGranted: false },
    );
  });

  it('reconciles an enabled reminder after external conditions such as scan range change', async () => {
    notificationApi.ensureCleanupReminderPermissions.mockResolvedValue(true);
    notificationApi.reconcileCleanupReminderNotification.mockResolvedValue({
      notificationId: null,
      nextTriggerAt: null,
    });

    await expect(
      reconcileReminderRuntimeSettings(baseSettings, 'zh-CN', {
        name: '定期清理提醒',
        description: '提醒你重新扫描最近媒体并清理误触、异常与重复内容。',
      }),
    ).resolves.toEqual({
      settings: {
        ...baseSettings,
        notificationId: null,
        nextTriggerAt: null,
      },
      permissionGranted: true,
    });

    expect(notificationApi.reconcileCleanupReminderNotification).toHaveBeenCalledTimes(1);
    expect(
      backgroundTaskApi.syncCleanupReminderBackgroundTaskRegistration,
    ).toHaveBeenCalledWith(
      {
        ...baseSettings,
        notificationId: null,
        nextTriggerAt: null,
      },
      { permissionGranted: true },
    );
  });

  it('clears stale reminder metadata when foreground reconcile loses notification permission', async () => {
    notificationApi.ensureCleanupReminderPermissions.mockResolvedValue(false);
    notificationApi.syncCleanupReminderNotification.mockResolvedValue({
      notificationId: null,
      nextTriggerAt: null,
    });

    await expect(
      reconcileReminderRuntimeSettings(baseSettings, 'zh-CN', {
        name: '定期清理提醒',
        description: '提醒你重新扫描最近媒体并清理误触、异常与重复内容。',
      }),
    ).resolves.toEqual({
      settings: {
        ...baseSettings,
        notificationId: null,
        nextTriggerAt: null,
      },
      permissionGranted: false,
    });

    expect(notificationApi.syncCleanupReminderNotification).toHaveBeenCalledWith(
      {
        ...baseSettings,
        enabled: false,
        previousNotificationId: 'existing-reminder-id',
      },
      expect.objectContaining({
        title: expect.any(String),
        summary: expect.any(String),
        detail: expect.any(String),
      }),
      {
        name: '定期清理提醒',
        description: '提醒你重新扫描最近媒体并清理误触、异常与重复内容。',
      },
    );
    expect(reminderStorageApi.saveReminderSettings).toHaveBeenCalledWith({
      ...baseSettings,
      notificationId: null,
      nextTriggerAt: null,
    });
    expect(
      backgroundTaskApi.syncCleanupReminderBackgroundTaskRegistration,
    ).toHaveBeenCalledWith(
      {
        ...baseSettings,
        notificationId: null,
        nextTriggerAt: null,
      },
      { permissionGranted: false },
    );
  });
});
