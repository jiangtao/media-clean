import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  createDefaultReminderSettings,
  deserializeReminderSettings,
  serializeReminderSettings,
  type ReminderSettings,
} from '../../features/reminders/reminder-settings';

const REMINDER_SETTINGS_KEY = 'app-cleaner/reminder-settings';

export async function loadReminderSettings(): Promise<ReminderSettings> {
  const value = await AsyncStorage.getItem(REMINDER_SETTINGS_KEY);
  if (!value) {
    return createDefaultReminderSettings();
  }

  const parsed = deserializeReminderSettings(value);
  return parsed ?? createDefaultReminderSettings();
}

export async function saveReminderSettings(settings: Partial<ReminderSettings>): Promise<void> {
  await AsyncStorage.setItem(REMINDER_SETTINGS_KEY, serializeReminderSettings(settings));
}
