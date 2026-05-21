import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { AppLanguage } from '../../i18n/app-language';
import {
  buildScanCompletionNotificationCopy,
  getScanCompletionNotificationChannelCopy,
} from '../../i18n/app-copy';

const SCAN_COMPLETION_CHANNEL_ID = 'scan-completion';

async function ensureScanCompletionChannel(language: AppLanguage) {
  if (Platform.OS !== 'android') {
    return;
  }

  const copy = getScanCompletionNotificationChannelCopy(language);
  await Notifications.setNotificationChannelAsync(SCAN_COMPLETION_CHANNEL_ID, {
    name: copy.name,
    description: copy.description,
    importance: Notifications.AndroidImportance.DEFAULT,
    showBadge: false,
    enableVibrate: true,
  });
}

export async function notifyScanCompletionIfNeeded(options: {
  language: AppLanguage;
  scannedCount: number;
  resultCount: number;
}) {
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) {
    return false;
  }

  await ensureScanCompletionChannel(options.language);

  const copy = buildScanCompletionNotificationCopy(
    options.language,
    options.scannedCount,
    options.resultCount,
  );

  await Notifications.scheduleNotificationAsync({
    content: {
      title: copy.title,
      body: copy.body,
      sound: true,
      data: {
        type: 'scan-complete',
        scannedCount: options.scannedCount,
        resultCount: options.resultCount,
      },
    },
    trigger:
      Platform.OS === 'android'
        ? {
            channelId: SCAN_COMPLETION_CHANNEL_ID,
          }
        : null,
  });

  return true;
}
