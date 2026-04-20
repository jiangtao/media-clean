import { describe, expect, it } from 'vitest';

import { assessReminderTrigger } from './reminder-trigger';

describe('reminder trigger', () => {
  it('marks the reminder as eligible when recent media is newer than the latest scan', () => {
    expect(
      assessReminderTrigger({
        enabled: true,
        scanRangeMonths: 3,
        latestEligibleAssetAt: new Date('2026-04-16T12:00:00Z').getTime(),
        lastScanAt: new Date('2026-04-15T12:00:00Z').getTime(),
        nowInput: new Date('2026-04-18T12:00:00Z').getTime(),
      }),
    ).toMatchObject({
      shouldSchedule: true,
      reason: 'new-media-since-last-scan',
    });
  });

  it('suppresses the reminder when recent media is not newer than the latest scan', () => {
    expect(
      assessReminderTrigger({
        enabled: true,
        scanRangeMonths: 3,
        latestEligibleAssetAt: new Date('2026-04-15T12:00:00Z').getTime(),
        lastScanAt: new Date('2026-04-15T12:00:00Z').getTime(),
        nowInput: new Date('2026-04-18T12:00:00Z').getTime(),
      }),
    ).toMatchObject({
      shouldSchedule: false,
      reason: 'no-new-media-since-last-scan',
    });
  });

  it('suppresses the reminder when no recent media exists inside the configured range', () => {
    expect(
      assessReminderTrigger({
        enabled: true,
        scanRangeMonths: 6,
        latestEligibleAssetAt: null,
        lastScanAt: new Date('2026-04-15T12:00:00Z').getTime(),
        nowInput: new Date('2026-04-18T12:00:00Z').getTime(),
      }),
    ).toMatchObject({
      shouldSchedule: false,
      reason: 'no-recent-media',
    });
  });

  it('treats recent media as enough context before the first scan', () => {
    expect(
      assessReminderTrigger({
        enabled: true,
        scanRangeMonths: 6,
        latestEligibleAssetAt: new Date('2026-04-12T12:00:00Z').getTime(),
        lastScanAt: null,
        nowInput: new Date('2026-04-18T12:00:00Z').getTime(),
      }),
    ).toMatchObject({
      shouldSchedule: true,
      reason: 'recent-media-before-first-scan',
    });
  });
});
