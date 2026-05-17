import { beforeEach, describe, expect, it, vi } from 'vitest';

const notificationsApi = vi.hoisted(() => ({
  getPermissionsAsync: vi.fn(),
  setNotificationChannelAsync: vi.fn(),
  scheduleNotificationAsync: vi.fn(),
  AndroidImportance: {
    DEFAULT: 'default',
  },
}));

const platformRuntime = vi.hoisted(() => ({
  os: 'android',
}));

vi.mock('expo-notifications', () => notificationsApi);
vi.mock('react-native', () => ({
  Platform: {
    get OS() {
      return platformRuntime.os;
    },
  },
}));

import { notifyScanCompletionIfNeeded } from './scan-completion-notifications';

describe('scan completion notifications', () => {
  beforeEach(() => {
    notificationsApi.getPermissionsAsync.mockReset();
    notificationsApi.setNotificationChannelAsync.mockReset();
    notificationsApi.scheduleNotificationAsync.mockReset();
    platformRuntime.os = 'android';
    notificationsApi.getPermissionsAsync.mockResolvedValue({ granted: true });
    notificationsApi.setNotificationChannelAsync.mockResolvedValue(undefined);
    notificationsApi.scheduleNotificationAsync.mockResolvedValue('notification-id');
  });

  it('does not notify when notification permission is denied', async () => {
    notificationsApi.getPermissionsAsync.mockResolvedValueOnce({ granted: false });

    await expect(
      notifyScanCompletionIfNeeded({
        language: 'zh-CN',
        scannedCount: 360,
        resultCount: 12,
      }),
    ).resolves.toBe(false);

    expect(notificationsApi.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('schedules a localized completion notification when permission is granted', async () => {
    await expect(
      notifyScanCompletionIfNeeded({
        language: 'zh-CN',
        scannedCount: 360,
        resultCount: 12,
      }),
    ).resolves.toBe(true);

    expect(notificationsApi.setNotificationChannelAsync).toHaveBeenCalledWith(
      'scan-completion',
      expect.objectContaining({
        name: '扫描完成提醒',
      }),
    );
    expect(notificationsApi.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          title: '扫描完成',
          body: '已检查 360 个媒体，发现 12 个待处理媒体。',
        }),
        trigger: {
          channelId: 'scan-completion',
        },
      }),
    );
  });
});
