import { beforeEach, describe, expect, it, vi } from 'vitest';

const backgroundTaskApi = vi.hoisted(() => ({
  BackgroundTaskResult: {
    Success: 'success',
    Failed: 'failed',
  },
  BackgroundTaskStatus: {
    Available: 'available',
    Restricted: 'restricted',
  },
  getStatusAsync: vi.fn(),
  registerTaskAsync: vi.fn(),
  unregisterTaskAsync: vi.fn(),
}));

const taskManagerApi = vi.hoisted(() => ({
  isTaskDefined: vi.fn(),
  defineTask: vi.fn(),
  isTaskRegisteredAsync: vi.fn(),
  unregisterTaskAsync: vi.fn(),
}));

const appCopyApi = vi.hoisted(() => ({
  getAppCopy: vi.fn(),
}));

const appLanguageStorageApi = vi.hoisted(() => ({
  loadAppLanguage: vi.fn(),
}));

const appStorageApi = vi.hoisted(() => ({
  loadLastScanMeta: vi.fn(),
}));

const reminderSettingsStorageApi = vi.hoisted(() => ({
  loadReminderSettings: vi.fn(),
  saveReminderSettings: vi.fn(),
}));

const cleanupReminderApi = vi.hoisted(() => ({
  ensureCleanupReminderPermissions: vi.fn(),
  reconcileCleanupReminderNotification: vi.fn(),
}));

const reminderCopyApi = vi.hoisted(() => ({
  buildRecentScanReminderCopy: vi.fn(),
}));

vi.mock('expo-background-task', () => backgroundTaskApi);
vi.mock('expo-task-manager', () => taskManagerApi);
vi.mock('../../i18n/app-copy', () => appCopyApi);
vi.mock('../../services/storage/app-language-storage', () => appLanguageStorageApi);
vi.mock('../../services/storage/app-storage', () => appStorageApi);
vi.mock('../../services/storage/reminder-settings-storage', () => reminderSettingsStorageApi);
vi.mock('../../services/notifications/cleanup-reminders', () => cleanupReminderApi);
vi.mock('./reminder-copy', () => reminderCopyApi);

import {
  CLEANUP_REMINDER_BACKGROUND_TASK,
  syncCleanupReminderBackgroundTaskRegistration,
} from './reminder-background-task';
import type { ReminderSettings } from './reminder-settings';

const baseSettings: ReminderSettings = {
  enabled: true,
  frequency: 'weekly',
  weekday: 1,
  hour: 20,
  minute: 30,
  notificationId: null,
  nextTriggerAt: null,
  summary: '定期检查最近拍摄的照片和视频，优先清理误触、异常与重复内容。',
};

describe('reminder background task registration', () => {
  beforeEach(() => {
    backgroundTaskApi.getStatusAsync.mockReset();
    backgroundTaskApi.registerTaskAsync.mockReset();
    backgroundTaskApi.unregisterTaskAsync.mockReset();

    taskManagerApi.isTaskRegisteredAsync.mockReset();
    taskManagerApi.unregisterTaskAsync.mockReset();

    backgroundTaskApi.getStatusAsync.mockResolvedValue(
      backgroundTaskApi.BackgroundTaskStatus.Available,
    );
    taskManagerApi.isTaskRegisteredAsync.mockResolvedValue(false);
    backgroundTaskApi.registerTaskAsync.mockResolvedValue(undefined);
    backgroundTaskApi.unregisterTaskAsync.mockResolvedValue(undefined);
    taskManagerApi.unregisterTaskAsync.mockResolvedValue(undefined);
  });

  it('falls back to TaskManager.unregisterTaskAsync when BackgroundTask reports task not found', async () => {
    taskManagerApi.isTaskRegisteredAsync.mockResolvedValue(true);
    backgroundTaskApi.unregisterTaskAsync.mockRejectedValue(
      new Error(
        `expo.modules.taskManager.exceptions.TaskNotFoundException: Task '${CLEANUP_REMINDER_BACKGROUND_TASK}' not found`,
      ),
    );

    await expect(
      syncCleanupReminderBackgroundTaskRegistration(
        {
          ...baseSettings,
          enabled: false,
        },
        { permissionGranted: true },
      ),
    ).resolves.toEqual({
      available: true,
      registered: false,
    });

    expect(backgroundTaskApi.unregisterTaskAsync).toHaveBeenCalledWith(
      CLEANUP_REMINDER_BACKGROUND_TASK,
    );
    expect(taskManagerApi.unregisterTaskAsync).toHaveBeenCalledWith(
      CLEANUP_REMINDER_BACKGROUND_TASK,
    );
    expect(backgroundTaskApi.registerTaskAsync).not.toHaveBeenCalled();
  });

  it('re-registers the reminder task after clearing a stale registration via the TaskManager fallback', async () => {
    taskManagerApi.isTaskRegisteredAsync.mockResolvedValue(true);
    backgroundTaskApi.unregisterTaskAsync.mockRejectedValue(
      new Error(`Task '${CLEANUP_REMINDER_BACKGROUND_TASK}' not found for app ID`),
    );

    await expect(
      syncCleanupReminderBackgroundTaskRegistration(baseSettings, {
        permissionGranted: true,
      }),
    ).resolves.toEqual({
      available: true,
      registered: true,
    });

    expect(taskManagerApi.unregisterTaskAsync).toHaveBeenCalledWith(
      CLEANUP_REMINDER_BACKGROUND_TASK,
    );
    expect(backgroundTaskApi.registerTaskAsync).toHaveBeenCalledWith(
      CLEANUP_REMINDER_BACKGROUND_TASK,
      {
        minimumInterval: 60 * 24 * 7,
      },
    );
  });

  it('rethrows unexpected unregister errors instead of swallowing them', async () => {
    taskManagerApi.isTaskRegisteredAsync.mockResolvedValue(true);
    backgroundTaskApi.unregisterTaskAsync.mockRejectedValue(new Error('permission denied'));

    await expect(
      syncCleanupReminderBackgroundTaskRegistration(baseSettings, {
        permissionGranted: true,
      }),
    ).rejects.toThrow('permission denied');

    expect(taskManagerApi.unregisterTaskAsync).not.toHaveBeenCalled();
    expect(backgroundTaskApi.registerTaskAsync).not.toHaveBeenCalled();
  });
});
