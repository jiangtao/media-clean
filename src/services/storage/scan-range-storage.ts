import AsyncStorage from '@react-native-async-storage/async-storage';

const SCAN_RANGE_KEY = 'app-cleaner/scan-range';

export const VALID_SCAN_RANGES = [1, 2, 3, 6, 12] as const;

export type ScanRange = (typeof VALID_SCAN_RANGES)[number];

export function buildScanRangeStartAt(range: ScanRange, nowInput = Date.now()) {
  const cutoff = new Date(nowInput);
  cutoff.setMonth(cutoff.getMonth() - range);
  return cutoff.getTime();
}

export function normalizeScanRange(value: number | string | null | undefined): ScanRange {
  const numValue = typeof value === 'string' ? parseInt(value, 10) : value;

  if (typeof numValue === 'number' && !isNaN(numValue)) {
    const validValue = VALID_SCAN_RANGES.find((v) => v === numValue);
    if (validValue) {
      return validValue;
    }
  }

  return 12;
}

export async function loadScanRange(): Promise<ScanRange> {
  const value = await AsyncStorage.getItem(SCAN_RANGE_KEY);
  return normalizeScanRange(value);
}

export async function saveScanRange(range: ScanRange): Promise<void> {
  await AsyncStorage.setItem(SCAN_RANGE_KEY, String(range));
}
