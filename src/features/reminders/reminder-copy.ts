import type { AppLanguage } from '../../i18n/app-language';
import {
  buildRecentScanReminderContent,
  resolveReminderTitle as resolveLocalizedReminderTitle,
} from '../../i18n/app-copy';
import type { ScanSummary } from '../scan/scan-media-library';
import { DEFAULT_REMINDER_SUMMARY, type ReminderSettings } from './reminder-settings';

export interface ReminderCopy {
  title: string;
  summary: string;
  detail: string;
}

export function buildRecentScanReminderCopy(
  latestScan: ScanSummary | null,
  settings: Pick<ReminderSettings, 'enabled' | 'hour' | 'minute'> & { summary?: string },
  language: AppLanguage = 'zh-CN',
): ReminderCopy {
  if (language === 'zh-CN') {
    const trimmed = settings.summary?.trim();
    const reminderTitle =
      !trimmed || trimmed === DEFAULT_REMINDER_SUMMARY ? '定期清理提醒' : trimmed;

    if (!latestScan) {
      return {
        title: reminderTitle,
        summary: '还没有最近扫描记录，先打开应用完成一次本地扫描，再开始定期清理。',
        detail: '建议把扫描和提醒都保留在本地，避免把照片与视频上传到云端。',
      };
    }

    const reminderTime = `${settings.hour.toString().padStart(2, '0')}:${settings.minute
      .toString()
      .padStart(2, '0')}`;
    const candidateSentence =
      latestScan.candidateCount > 0
        ? `最近一次扫描发现 ${latestScan.candidateCount} 个待处理识别结果，建议在 ${reminderTime} 再检查一次。`
        : `最近一次扫描没有发现明显待处理项，建议在 ${reminderTime} 再确认一下相册。`;

    return {
      title: reminderTitle,
      summary: candidateSentence,
      detail: `本次扫描共检查 ${latestScan.scannedCount} 项媒体，其中 ${latestScan.highConfidenceCount} 项建议清理、${latestScan.mediumConfidenceCount} 项建议复核，保留和清理页里还有 ${latestScan.recycleBinCount} 项待处理。`,
    };
  }

  return buildRecentScanReminderContent(
    latestScan,
    {
      hour: settings.hour,
      minute: settings.minute,
      summary: resolveLocalizedReminderTitle(settings.summary, language),
    },
    language,
  );
}
