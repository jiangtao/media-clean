import AsyncStorage from '@react-native-async-storage/async-storage';

const RECYCLE_BIN_KEY = 'app-cleaner/recycle-bin-ids';
const LAST_SCAN_KEY = 'app-cleaner/last-scan';

export interface LastScanMeta {
  scannedAt: number;
  scannedCount: number;
  candidateCount: number;
}

function normalizeIds(ids: string[]) {
  return Array.from(new Set(ids)).sort();
}

export async function loadRecycleBinIds(): Promise<string[]> {
  const value = await AsyncStorage.getItem(RECYCLE_BIN_KEY);
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? normalizeIds(parsed.filter((item) => typeof item === 'string')) : [];
  } catch {
    return [];
  }
}

export async function saveRecycleBinIds(ids: string[]): Promise<void> {
  await AsyncStorage.setItem(RECYCLE_BIN_KEY, JSON.stringify(normalizeIds(ids)));
}

export async function loadLastScanMeta(): Promise<LastScanMeta | null> {
  const value = await AsyncStorage.getItem(LAST_SCAN_KEY);
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value);
    if (
      typeof parsed?.scannedAt === 'number' &&
      typeof parsed?.scannedCount === 'number' &&
      typeof parsed?.candidateCount === 'number'
    ) {
      return parsed as LastScanMeta;
    }
  } catch {
    return null;
  }

  return null;
}

export async function saveLastScanMeta(meta: LastScanMeta): Promise<void> {
  await AsyncStorage.setItem(LAST_SCAN_KEY, JSON.stringify(meta));
}
