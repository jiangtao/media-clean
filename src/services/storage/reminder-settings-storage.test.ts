import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  loadReminderSettings,
  saveReminderSettings,
} from './reminder-settings-storage';
import { createDefaultReminderSettings } from '../../features/reminders/reminder-settings';

const { getItem, setItem } = vi.hoisted(() => ({
  getItem: vi.fn(),
  setItem: vi.fn(),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem,
    setItem,
  },
}));

describe('reminder settings storage', () => {
  beforeEach(() => {
    getItem.mockReset();
    setItem.mockReset();
  });

  it('falls back to the default reminder settings when nothing is stored', async () => {
    getItem.mockResolvedValueOnce(null);

    await expect(loadReminderSettings()).resolves.toEqual(createDefaultReminderSettings());
  });

  it('persists normalized reminder settings', async () => {
    const settings = {
      enabled: true,
      hour: 7,
      minute: 45,
      summary: '清晨顺手清理相册',
    };

    await saveReminderSettings(settings);

    expect(setItem).toHaveBeenCalledTimes(1);
    expect(setItem.mock.calls[0][1]).toContain('"version":1');
    expect(setItem.mock.calls[0][1]).toContain('"hour":7');
  });

  it('reloads persisted scheduling metadata across app restarts', async () => {
    getItem.mockResolvedValueOnce(
      JSON.stringify({
        version: 1,
        settings: {
          enabled: true,
          frequency: 'weekly',
          weekday: 5,
          hour: 21,
          minute: 10,
          summary: '周末前清理一次相册',
          notificationId: 'scheduled-reminder-id',
          nextTriggerAt: 1_710_000_000_000,
        },
      }),
    );

    await expect(loadReminderSettings()).resolves.toEqual({
      enabled: true,
      frequency: 'weekly',
      weekday: 5,
      hour: 21,
      minute: 10,
      summary: '周末前清理一次相册',
      notificationId: 'scheduled-reminder-id',
      nextTriggerAt: 1_710_000_000_000,
    });
  });
});
