import type { AppLanguage } from '../../i18n/app-language';
import {
  buildRecentScanReminderContent,
  resolveReminderTitle as resolveLocalizedReminderTitle,
} from '../../i18n/app-copy';
import type { ScanSummary } from '../scan/scan-media-library';
import type { ReminderSettings } from './reminder-settings';

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
