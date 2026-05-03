// A non-positive scan limit means "scan every eligible asset in the active window".
export const DEFAULT_SCAN_LIMIT = 0;

export const DEFAULT_SCAN_WINDOW_DAYS = 365;
export const DEFAULT_SCAN_WINDOW_MONTHS_EQUIVALENT = 12;

export function buildDefaultScanWindowStartAt(nowInput = Date.now()) {
  const cutoff = new Date(nowInput);
  cutoff.setDate(cutoff.getDate() - DEFAULT_SCAN_WINDOW_DAYS);
  return cutoff.getTime();
}
