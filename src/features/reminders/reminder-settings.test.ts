import { describe, expect, it } from 'vitest';

import {
  buildReminderSummary,
  createDefaultReminderSettings,
  createSchedulableReminderTrigger,
  deserializeReminderSettings,
  estimateNextReminderTriggerAt,
  listReminderFrequencyOptions,
  listReminderWeekdayOptions,
  normalizeReminderSettings,
  serializeReminderSettings,
  updateReminderSchedule,
} from './reminder-settings';

describe('reminder settings', () => {
  it('creates a disabled weekly reminder by default', () => {
    expect(createDefaultReminderSettings()).toEqual({
      enabled: false,
      frequency: 'weekly',
      weekday: 1,
      hour: 20,
      minute: 30,
      summary: '定期检查最近拍摄的照片和视频，优先清理误触、异常与重复内容。',
      notificationId: null,
      nextTriggerAt: null,
    });
  });

  it('builds a disabled summary', () => {
    expect(buildReminderSummary(createDefaultReminderSettings())).toBe('未开启定期清理提醒');
  });

  it('lists frequency and weekday options for reminder configuration controls', () => {
    expect(listReminderFrequencyOptions()).toEqual([
      { value: 'weekly', label: '每周' },
      { value: 'daily', label: '每天' },
    ]);

    expect(listReminderWeekdayOptions()).toEqual([
      { value: 1, label: '周一' },
      { value: 2, label: '周二' },
      { value: 3, label: '周三' },
      { value: 4, label: '周四' },
      { value: 5, label: '周五' },
      { value: 6, label: '周六' },
      { value: 7, label: '周日' },
    ]);
  });

  it('builds a daily summary', () => {
    const settings = updateReminderSchedule(createDefaultReminderSettings(), {
      enabled: true,
      frequency: 'daily',
      hour: 9,
      minute: 0,
    });

    expect(buildReminderSummary(settings)).toBe('每天 09:00 提醒你检查识别结果');
    expect(createSchedulableReminderTrigger(settings)).toEqual({
      hour: 9,
      minute: 0,
      repeats: true,
    });
  });

  it('builds an english weekly summary and localized options', () => {
    const settings = updateReminderSchedule(createDefaultReminderSettings(), {
      enabled: true,
      frequency: 'weekly',
      weekday: 5,
      hour: 18,
      minute: 45,
    });

    expect(buildReminderSummary(settings, 'en-US')).toBe(
      'Weekly Fri at 18:45 to review recognition results',
    );
    expect(listReminderFrequencyOptions('en-US')).toEqual([
      { value: 'weekly', label: 'Weekly' },
      { value: 'daily', label: 'Daily' },
    ]);
    expect(listReminderWeekdayOptions('en-US')[0]).toEqual({ value: 1, label: 'Mon' });
  });

  it('estimates the next trigger time for daily and weekly reminders', () => {
    const dailySettings = updateReminderSchedule(createDefaultReminderSettings(), {
      enabled: true,
      frequency: 'daily',
      hour: 20,
      minute: 30,
    });
    const weeklySettings = updateReminderSchedule(createDefaultReminderSettings(), {
      enabled: true,
      frequency: 'weekly',
      weekday: 4,
      hour: 20,
      minute: 30,
    });

    expect(
      estimateNextReminderTriggerAt(dailySettings, new Date(2026, 3, 16, 20, 0, 0).getTime()),
    ).toBe(new Date(2026, 3, 16, 20, 30, 0).getTime());
    expect(
      estimateNextReminderTriggerAt(weeklySettings, new Date(2026, 3, 16, 21, 0, 0).getTime()),
    ).toBe(new Date(2026, 3, 23, 20, 30, 0).getTime());
  });

  it('builds a weekly summary and resets schedule metadata when schedule changes', () => {
    const settings = updateReminderSchedule(
      {
        ...createDefaultReminderSettings(),
        enabled: true,
        notificationId: 'scheduled-id',
        nextTriggerAt: 100,
      },
      {
        weekday: 6,
        hour: 21,
        minute: 15,
      },
    );

    expect(buildReminderSummary(settings)).toBe('每周六 21:15 提醒你检查识别结果');
    expect(settings.notificationId).toBeNull();
    expect(settings.nextTriggerAt).toBeNull();
    expect(createSchedulableReminderTrigger(settings)).toEqual({
      weekday: 6,
      hour: 21,
      minute: 15,
      repeats: true,
    });
  });

  it('preserves scheduling metadata when only the reminder summary changes', () => {
    const settings = updateReminderSchedule(
      {
        ...createDefaultReminderSettings(),
        enabled: true,
        notificationId: 'scheduled-id',
        nextTriggerAt: 1_710_000_000_000,
      },
      {
        summary: '晚饭后顺手清理相册',
      },
    );

    expect(settings.notificationId).toBe('scheduled-id');
    expect(settings.nextTriggerAt).toBe(1_710_000_000_000);
    expect(settings.summary).toBe('晚饭后顺手清理相册');
  });

  it('normalizes invalid schedule changes', () => {
    const settings = normalizeReminderSettings({
      enabled: true,
      frequency: 'weekly',
      weekday: 99,
      hour: 27,
      minute: -5,
      summary: '   ',
    });

    expect(settings).toEqual({
      enabled: true,
      frequency: 'weekly',
      weekday: 7,
      hour: 23,
      minute: 0,
      summary: '定期检查最近拍摄的照片和视频，优先清理误触、异常与重复内容。',
      notificationId: null,
      nextTriggerAt: null,
    });
  });

  it('round-trips through serialization envelope', () => {
    const serialized = serializeReminderSettings({
      enabled: true,
      frequency: 'daily',
      weekday: 2,
      hour: 7,
      minute: 45,
      summary: '清晨顺手清理相册',
      notificationId: 'reminder-id',
      nextTriggerAt: 1_710_000_000_000,
    });

    expect(deserializeReminderSettings(serialized)).toEqual({
      enabled: true,
      frequency: 'daily',
      weekday: 2,
      hour: 7,
      minute: 45,
      summary: '清晨顺手清理相册',
      notificationId: 'reminder-id',
      nextTriggerAt: 1_710_000_000_000,
    });
  });
});
