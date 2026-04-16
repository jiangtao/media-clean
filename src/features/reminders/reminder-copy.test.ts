import { describe, expect, it } from 'vitest';

import { buildRecentScanReminderCopy } from './reminder-copy';
import { createDefaultReminderSettings } from './reminder-settings';

describe('reminder copy', () => {
  it('falls back to a generic copy when there is no recent scan', () => {
    expect(buildRecentScanReminderCopy(null, createDefaultReminderSettings())).toEqual({
      title: '定期清理提醒',
      summary: '还没有最近扫描记录，先打开应用完成一次本地扫描，再开始定期清理。',
      detail: '建议把扫描和提醒都保留在本地，避免把照片与视频上传到云端。',
    });
  });

  it('derives copy from the latest scan summary', () => {
    expect(
      buildRecentScanReminderCopy(
        {
          scannedAt: 1_710_123_000_000,
          scannedCount: 312,
          candidateCount: 18,
          highConfidenceCount: 6,
          mediumConfidenceCount: 12,
          recycleBinCount: 4,
        },
        {
          enabled: true,
          hour: 20,
          minute: 15,
          summary: '今晚检查最近拍摄的识别结果',
        },
      ),
    ).toEqual({
      title: '今晚检查最近拍摄的识别结果',
      summary: '最近一次扫描发现 18 个待处理识别结果，建议在 20:15 再检查一次。',
      detail: '本次扫描共检查 312 项媒体，其中 6 项高置信度、12 项中置信度，回收站里还有 4 项待处理。',
    });
  });

  it('builds english reminder copy and localizes the default reminder title', () => {
    expect(
      buildRecentScanReminderCopy(
        {
          scannedAt: 1_710_123_000_000,
          scannedCount: 120,
          candidateCount: 3,
          highConfidenceCount: 2,
          mediumConfidenceCount: 1,
          recycleBinCount: 0,
        },
        createDefaultReminderSettings(),
        'en-US',
      ),
    ).toEqual({
      title: 'Cleanup Reminder',
      summary: 'The last scan found 3 recognition results to review. Check again at 20:30.',
      detail:
        'This scan checked 120 media items: 2 high-confidence, 1 medium-confidence, and 0 still waiting in the recycle bin.',
    });
  });
});
