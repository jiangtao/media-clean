export type ReminderTriggerReason =
  | 'disabled'
  | 'no-recent-media'
  | 'recent-media-before-first-scan'
  | 'scan-range-changed-since-last-valid-scan'
  | 'new-media-since-last-scan'
  | 'no-new-media-since-last-scan';

export interface ReminderTriggerBaseline {
  scannedAt: number;
  scannedCount: number;
  candidateCount: number;
  scanRangeMonths: number;
  latestEligibleAssetAt: number | null;
  ledgerUpdatedAt: number;
}

export interface ReminderTriggerInput {
  enabled: boolean;
  scanRangeMonths: number;
  latestEligibleAssetAt: number | null;
  lastScanAt: number | null;
  lastValidScanBaseline?: ReminderTriggerBaseline | null;
  nowInput?: number;
}

export interface ReminderTriggerAssessment {
  shouldSchedule: boolean;
  reason: ReminderTriggerReason;
  scanRangeMonths: number;
  latestEligibleAssetAt: number | null;
  lastScanAt: number | null;
  lastValidScanBaseline: ReminderTriggerBaseline | null;
  evaluatedAt: number;
}

function normalizeReminderTriggerBaseline(
  input: ReminderTriggerInput,
): ReminderTriggerBaseline | null {
  const baseline = input.lastValidScanBaseline;
  if (
    baseline &&
    Number.isFinite(baseline.scannedAt) &&
    Number.isFinite(baseline.scanRangeMonths) &&
    Number.isFinite(baseline.ledgerUpdatedAt)
  ) {
    return {
      scannedAt: baseline.scannedAt,
      scannedCount: Number.isFinite(baseline.scannedCount) ? baseline.scannedCount : 0,
      candidateCount: Number.isFinite(baseline.candidateCount) ? baseline.candidateCount : 0,
      scanRangeMonths: baseline.scanRangeMonths,
      latestEligibleAssetAt:
        typeof baseline.latestEligibleAssetAt === 'number' &&
        Number.isFinite(baseline.latestEligibleAssetAt)
          ? baseline.latestEligibleAssetAt
          : null,
      ledgerUpdatedAt: baseline.ledgerUpdatedAt,
    };
  }

  if (typeof input.lastScanAt !== 'number' || !Number.isFinite(input.lastScanAt)) {
    return null;
  }

  return {
    scannedAt: input.lastScanAt,
    scannedCount: 0,
    candidateCount: 0,
    scanRangeMonths: input.scanRangeMonths,
    latestEligibleAssetAt: input.lastScanAt,
    ledgerUpdatedAt: input.lastScanAt,
  };
}

export function assessReminderTrigger(
  input: ReminderTriggerInput,
): ReminderTriggerAssessment {
  const evaluatedAt = input.nowInput ?? Date.now();
  const lastValidScanBaseline = normalizeReminderTriggerBaseline(input);
  const lastScanAt = lastValidScanBaseline?.scannedAt ?? null;

  if (!input.enabled) {
    return {
      shouldSchedule: false,
      reason: 'disabled',
      scanRangeMonths: input.scanRangeMonths,
      latestEligibleAssetAt: input.latestEligibleAssetAt,
      lastScanAt,
      lastValidScanBaseline,
      evaluatedAt,
    };
  }

  if (!Number.isFinite(input.latestEligibleAssetAt)) {
    return {
      shouldSchedule: false,
      reason: 'no-recent-media',
      scanRangeMonths: input.scanRangeMonths,
      latestEligibleAssetAt: null,
      lastScanAt,
      lastValidScanBaseline,
      evaluatedAt,
    };
  }

  if (!lastValidScanBaseline) {
    return {
      shouldSchedule: true,
      reason: 'recent-media-before-first-scan',
      scanRangeMonths: input.scanRangeMonths,
      latestEligibleAssetAt: input.latestEligibleAssetAt,
      lastScanAt: null,
      lastValidScanBaseline: null,
      evaluatedAt,
    };
  }

  if (lastValidScanBaseline.scanRangeMonths !== input.scanRangeMonths) {
    return {
      shouldSchedule: true,
      reason: 'scan-range-changed-since-last-valid-scan',
      scanRangeMonths: input.scanRangeMonths,
      latestEligibleAssetAt: input.latestEligibleAssetAt,
      lastScanAt,
      lastValidScanBaseline,
      evaluatedAt,
    };
  }

  const baselineLatestEligibleAssetAt =
    lastValidScanBaseline.latestEligibleAssetAt ?? lastValidScanBaseline.scannedAt;
  const hasNewerMedia = (input.latestEligibleAssetAt ?? 0) > baselineLatestEligibleAssetAt;
  return {
    shouldSchedule: hasNewerMedia,
    reason: hasNewerMedia ? 'new-media-since-last-scan' : 'no-new-media-since-last-scan',
    scanRangeMonths: input.scanRangeMonths,
    latestEligibleAssetAt: input.latestEligibleAssetAt,
    lastScanAt,
    lastValidScanBaseline,
    evaluatedAt,
  };
}
