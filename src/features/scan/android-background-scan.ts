import type { AppLanguage } from '../../i18n/app-language';
import { NativeModules, Platform } from 'react-native';

const MAX_FILE_NAME_LENGTH = 48;

interface BackgroundScanForegroundServiceModule {
  isSupported(): Promise<boolean>;
  start(options: AndroidBackgroundScanNotificationPayload): Promise<void>;
  stop(): Promise<void>;
}

export interface AndroidBackgroundScanNotificationPayload {
  title: string;
  body: string;
  currentFileName: string | null;
  progressCurrent: number;
  progressTotal: number;
}

function getBackgroundScanNativeModule(): BackgroundScanForegroundServiceModule | null {
  const nativeModule = NativeModules.BackgroundScanForegroundService as
    | BackgroundScanForegroundServiceModule
    | undefined;

  return nativeModule ?? null;
}

function trimFileName(fileName: string | null) {
  if (!fileName) {
    return null;
  }

  if (fileName.length <= MAX_FILE_NAME_LENGTH) {
    return fileName;
  }

  return `${fileName.slice(0, MAX_FILE_NAME_LENGTH - 3)}...`;
}

export function buildAndroidBackgroundScanNotificationPayload(options: {
  language: AppLanguage;
  progressCurrent: number;
  progressTotal: number;
  currentFileName: string | null;
}): AndroidBackgroundScanNotificationPayload {
  const progressLabel =
    options.progressTotal > 0
      ? `${Math.min(options.progressCurrent, options.progressTotal)}/${options.progressTotal}`
      : `${options.progressCurrent}`;
  const currentFileName = trimFileName(options.currentFileName);

  if (options.language === 'zh-CN') {
    return {
      title: '扫描进行中',
      body: currentFileName
        ? `已处理 ${progressLabel}，当前：${currentFileName}`
        : `已处理 ${progressLabel}，离开应用后仍会继续扫描。`,
      currentFileName,
      progressCurrent: options.progressCurrent,
      progressTotal: options.progressTotal,
    };
  }

  return {
    title: 'Scanning in progress',
    body: currentFileName
      ? `Processed ${progressLabel}. Current: ${currentFileName}`
      : `Processed ${progressLabel}. Scanning continues after leaving the app.`,
    currentFileName,
    progressCurrent: options.progressCurrent,
    progressTotal: options.progressTotal,
  };
}

export async function syncAndroidBackgroundScanForegroundService(options: {
  language: AppLanguage;
  isScanning: boolean;
  progressCurrent: number;
  progressTotal: number;
  currentFileName: string | null;
}) {
  if (Platform.OS !== 'android') {
    return false;
  }

  const nativeModule = getBackgroundScanNativeModule();
  if (!nativeModule) {
    return false;
  }

  const isSupported = await nativeModule.isSupported().catch(() => false);
  if (!isSupported) {
    return false;
  }

  if (!options.isScanning) {
    await nativeModule.stop();
    return true;
  }

  await nativeModule.start(
    buildAndroidBackgroundScanNotificationPayload({
      language: options.language,
      progressCurrent: options.progressCurrent,
      progressTotal: options.progressTotal,
      currentFileName: options.currentFileName,
    }),
  );

  return true;
}
