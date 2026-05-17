import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { AppLanguage } from '../../i18n/app-language';

const SCAN_COMPLETION_CHANNEL_ID = 'scan-completion';

function buildScanCompletionCopy(
  language: AppLanguage,
  scannedCount: number,
  resultCount: number,
) {
  if (language === 'zh-CN') {
    return resultCount > 0
      ? {
          title: '扫描完成',
          body: `已检查 ${scannedCount} 个媒体，发现 ${resultCount} 个待处理媒体。`,
        }
      : {
          title: '扫描完成',
          body: `已检查 ${scannedCount} 个媒体，当前这一批已处理完成。`,
        };
  }

  return resultCount > 0
    ? {
        title: 'Scan complete',
        body: `Checked ${scannedCount} media items and found ${resultCount} flagged results.`,
      }
    : {
        title: 'Scan complete',
        body: `Checked ${scannedCount} media items. This batch is fully processed.`,
      };
}

async function ensureScanCompletionChannel() {
  if (Platform.OS !== 'android') {
    return;
  }

  await Notifications.setNotificationChannelAsync(SCAN_COMPLETION_CHANNEL_ID, {
    name: '扫描完成提醒',
    description: '在应用不处于前台时，提醒本地扫描已经完成。',
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

  await ensureScanCompletionChannel();

  const copy = buildScanCompletionCopy(
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
