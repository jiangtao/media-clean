import type { AppLanguage } from '../../i18n/app-language';
import {
  buildReminderScheduleSummary,
  getDefaultReminderSummary,
  listReminderFrequencyLabels,
  listReminderWeekdayLabels,
} from '../../i18n/app-copy';

export interface ReminderSettings {
  enabled: boolean;
  frequency: 'daily' | 'weekly';
  weekday: number;
  hour: number;
  minute: number;
  notificationId: string | null;
  nextTriggerAt: number | null;
  summary: string;
}

interface ReminderSettingsEnvelope {
  version: 1;
  settings: ReminderSettings;
}

export const REMINDER_SETTINGS_VERSION = 1 as const;
export const DEFAULT_REMINDER_SUMMARY = getDefaultReminderSummary('zh-CN');

const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  enabled: false,
  frequency: 'weekly',
  weekday: 1,
  hour: 20,
  minute: 30,
  notificationId: null,
  nextTriggerAt: null,
  summary: DEFAULT_REMINDER_SUMMARY,
};

function clampTimePart(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(Math.max(Math.trunc(value), min), max);
}

function clampWeekday(value: number | undefined) {
  if (!Number.isFinite(value)) {
    return DEFAULT_REMINDER_SETTINGS.weekday;
  }

  return Math.min(Math.max(Math.trunc(value ?? DEFAULT_REMINDER_SETTINGS.weekday), 1), 7);
}

function normalizeSummary(summary: string | undefined) {
  if (typeof summary !== 'string') {
    return DEFAULT_REMINDER_SUMMARY;
  }

  const trimmed = summary.trim();
  return trimmed.length > 0 ? trimmed : DEFAULT_REMINDER_SUMMARY;
}

export function createDefaultReminderSettings(): ReminderSettings {
  return { ...DEFAULT_REMINDER_SETTINGS };
}

export function formatReminderTime(settings: Pick<ReminderSettings, 'hour' | 'minute'>) {
  return `${settings.hour.toString().padStart(2, '0')}:${settings.minute
    .toString()
    .padStart(2, '0')}`;
}

export function listReminderFrequencyOptions(language: AppLanguage = 'zh-CN') {
  const labels = listReminderFrequencyLabels(language);
  return [
    { value: 'weekly' as const, label: labels.weekly },
    { value: 'daily' as const, label: labels.daily },
  ];
}

export function listReminderWeekdayOptions(language: AppLanguage = 'zh-CN') {
  return listReminderWeekdayLabels(language).map((label, index) => ({
    value: index + 1,
    label,
  }));
}

export function normalizeReminderSettings(input: Partial<ReminderSettings>): ReminderSettings {
  return {
    enabled: Boolean(input.enabled),
    frequency: input.frequency === 'daily' ? 'daily' : 'weekly',
    weekday: clampWeekday(input.weekday),
    hour: clampTimePart(input.hour ?? DEFAULT_REMINDER_SETTINGS.hour, 0, 23),
    minute: clampTimePart(input.minute ?? DEFAULT_REMINDER_SETTINGS.minute, 0, 59),
    notificationId: typeof input.notificationId === 'string' ? input.notificationId : null,
    nextTriggerAt: Number.isFinite(input.nextTriggerAt) ? Number(input.nextTriggerAt) : null,
    summary: normalizeSummary(input.summary),
  };
}

function didScheduleFieldsChange(current: ReminderSettings, next: ReminderSettings) {
  return (
    current.enabled !== next.enabled ||
    current.frequency !== next.frequency ||
    current.weekday !== next.weekday ||
    current.hour !== next.hour ||
    current.minute !== next.minute
  );
}

export function updateReminderSchedule(
  current: ReminderSettings,
  patch: Partial<ReminderSettings>,
): ReminderSettings {
  const next = normalizeReminderSettings({
    ...current,
    ...patch,
  });

  if (!didScheduleFieldsChange(current, next)) {
    return next;
  }

  return {
    ...next,
    notificationId: null,
    nextTriggerAt: null,
  };
}

export function buildReminderSummary(
  settings: ReminderSettings,
  language: AppLanguage = 'zh-CN',
) {
  return buildReminderScheduleSummary(settings, language);
}

export function createSchedulableReminderTrigger(settings: ReminderSettings) {
  if (settings.frequency === 'daily') {
    return {
      hour: settings.hour,
      minute: settings.minute,
      repeats: true,
    } as const;
  }

  return {
    weekday: settings.weekday,
    hour: settings.hour,
    minute: settings.minute,
    repeats: true,
  } as const;
}

export function estimateNextReminderTriggerAt(
  settings: Pick<ReminderSettings, 'enabled' | 'frequency' | 'weekday' | 'hour' | 'minute'>,
  nowInput = Date.now(),
) {
  if (!settings.enabled) {
    return null;
  }

  const now = new Date(nowInput);
  const next = new Date(now);
  next.setSeconds(0, 0);
  next.setHours(settings.hour, settings.minute, 0, 0);

  if (settings.frequency === 'daily') {
    if (next.getTime() <= now.getTime()) {
      next.setDate(next.getDate() + 1);
    }

    return next.getTime();
  }

  const currentWeekday = ((now.getDay() + 6) % 7) + 1;
  let daysToAdd = settings.weekday - currentWeekday;

  if (daysToAdd < 0 || (daysToAdd === 0 && next.getTime() <= now.getTime())) {
    daysToAdd += 7;
  }

  next.setDate(next.getDate() + daysToAdd);
  return next.getTime();
}

export function serializeReminderSettings(settings: Partial<ReminderSettings>): string {
  const envelope: ReminderSettingsEnvelope = {
    version: REMINDER_SETTINGS_VERSION,
    settings: normalizeReminderSettings(settings),
  };

  return JSON.stringify(envelope);
}

export function deserializeReminderSettings(raw: string): ReminderSettings | null {
  try {
    const parsed = JSON.parse(raw) as Partial<ReminderSettingsEnvelope>;

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      parsed.version !== REMINDER_SETTINGS_VERSION ||
      typeof parsed.settings !== 'object' ||
      parsed.settings === null
    ) {
      return null;
    }

    const settings = parsed.settings as Partial<ReminderSettings>;

    if (
      typeof settings.enabled !== 'boolean' ||
      typeof settings.hour !== 'number' ||
      typeof settings.minute !== 'number'
    ) {
      return null;
    }

    return normalizeReminderSettings(settings);
  } catch {
    return null;
  }
}
