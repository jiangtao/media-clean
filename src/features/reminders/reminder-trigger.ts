export type ReminderTriggerReason =
  | 'disabled'
  | 'no-recent-media'
  | 'recent-media-before-first-scan'
  | 'new-media-since-last-scan'
  | 'no-new-media-since-last-scan';

export interface ReminderTriggerInput {
  enabled: boolean;
  scanRangeMonths: number;
  latestEligibleAssetAt: number | null;
  lastScanAt: number | null;
  nowInput?: number;
}

export interface ReminderTriggerAssessment {
  shouldSchedule: boolean;
  reason: ReminderTriggerReason;
  scanRangeMonths: number;
  latestEligibleAssetAt: number | null;
  lastScanAt: number | null;
  evaluatedAt: number;
}

export function assessReminderTrigger(
  input: ReminderTriggerInput,
): ReminderTriggerAssessment {
  const evaluatedAt = input.nowInput ?? Date.now();

  if (!input.enabled) {
    return {
      shouldSchedule: false,
      reason: 'disabled',
      scanRangeMonths: input.scanRangeMonths,
      latestEligibleAssetAt: input.latestEligibleAssetAt,
      lastScanAt: input.lastScanAt,
      evaluatedAt,
    };
  }

  if (!Number.isFinite(input.latestEligibleAssetAt)) {
    return {
      shouldSchedule: false,
      reason: 'no-recent-media',
      scanRangeMonths: input.scanRangeMonths,
      latestEligibleAssetAt: null,
      lastScanAt: input.lastScanAt,
      evaluatedAt,
    };
  }

  if (!Number.isFinite(input.lastScanAt)) {
    return {
      shouldSchedule: true,
      reason: 'recent-media-before-first-scan',
      scanRangeMonths: input.scanRangeMonths,
      latestEligibleAssetAt: input.latestEligibleAssetAt,
      lastScanAt: null,
      evaluatedAt,
    };
  }

  const hasNewerMedia = (input.latestEligibleAssetAt ?? 0) > (input.lastScanAt ?? 0);
  return {
    shouldSchedule: hasNewerMedia,
    reason: hasNewerMedia ? 'new-media-since-last-scan' : 'no-new-media-since-last-scan',
    scanRangeMonths: input.scanRangeMonths,
    latestEligibleAssetAt: input.latestEligibleAssetAt,
    lastScanAt: input.lastScanAt,
    evaluatedAt,
  };
}
