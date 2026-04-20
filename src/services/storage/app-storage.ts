import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  CleanupCandidate,
  DuplicateGroup,
  MediaAssetSnapshot,
  VisualMetrics,
} from '../../domain/recognition/types';
import type { ScanSummary } from '../../features/scan/scan-media-library';

const RECYCLE_BIN_KEY = 'app-cleaner/recycle-bin-ids';
const RECYCLE_BIN_CANDIDATE_CACHE_KEY = 'app-cleaner/recycle-bin-candidate-cache';
const LAST_SCAN_KEY = 'app-cleaner/last-scan';
const PHOTO_SCAN_RESULT_CACHE_KEY = 'app-cleaner/photo-scan-result-cache';
const FALSE_POSITIVE_CANDIDATE_IDS_KEY = 'app-cleaner/false-positive-candidate-ids';
const MEDIA_ANALYSIS_CACHE_KEY = 'app-cleaner/media-analysis-cache';

export interface LastScanMeta {
  scannedAt: number;
  scannedCount: number;
  candidateCount: number;
}

export interface PhotoScanResultCache {
  activeCandidates: CleanupCandidate[];
  summary: ScanSummary;
}

export type RecycleBinCandidateCache = CleanupCandidate[];

export interface RecycleBinSnapshotCache {
  ids: string[];
  candidates: CleanupCandidate[];
  updatedAt: number;
  source: 'manual' | 'hydrated' | 'legacy';
}

export interface MediaAnalysisCacheEntry {
  assetId: string;
  signature: string;
  previewUri: string;
  fingerprint: string | null;
  differenceHash?: string | null;
  contentHash?: string | null;
  frameFingerprints: string[];
  status: 'ok' | 'fallback';
  metrics: VisualMetrics;
}

export type MediaAnalysisCache = Record<string, MediaAnalysisCacheEntry>;

type JsonRecord = Record<string, unknown>;

function normalizeIds(ids: string[]) {
  return Array.from(new Set(ids)).sort();
}

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isValidVisualMetrics(value: unknown): value is VisualMetrics {
  if (!isJsonRecord(value)) {
    return false;
  }

  const { brightness, contrast, edgeDensity } = value;
  return (
    isFiniteNumber(brightness) &&
    isFiniteNumber(contrast) &&
    isFiniteNumber(edgeDensity)
  );
}

function isValidMediaAssetSnapshot(value: unknown): value is MediaAssetSnapshot {
  if (!isJsonRecord(value)) {
    return false;
  }

  const { id, uri, previewUri, mediaType, width, height, duration, fileSize, creationTime } = value;

  return (
    typeof id === 'string' &&
    typeof uri === 'string' &&
    (previewUri === undefined || typeof previewUri === 'string') &&
    (mediaType === 'photo' || mediaType === 'video') &&
    isFiniteNumber(width) &&
    isFiniteNumber(height) &&
    isFiniteNumber(duration) &&
    isFiniteNumber(fileSize) &&
    isFiniteNumber(creationTime)
  );
}

function isValidDuplicateGroup(value: unknown): value is DuplicateGroup {
  if (!isJsonRecord(value)) {
    return false;
  }

  const {
    groupId,
    representativeId,
    relation,
    size,
    similarity,
    representativeReason,
    representativeWidth,
    representativeHeight,
    representativeFileSize,
    representativeCreationTime,
  } = value;

  return (
    typeof groupId === 'string' &&
    typeof representativeId === 'string' &&
    (relation === 'exact' || relation === 'near') &&
    isFiniteNumber(size) &&
    isFiniteNumber(similarity) &&
    (representativeReason === 'higher-resolution' ||
      representativeReason === 'larger-file' ||
      representativeReason === 'newer-capture') &&
    isFiniteNumber(representativeWidth) &&
    isFiniteNumber(representativeHeight) &&
    isFiniteNumber(representativeFileSize) &&
    isFiniteNumber(representativeCreationTime)
  );
}

function isValidCleanupCandidate(value: unknown): value is CleanupCandidate {
  if (!isJsonRecord(value)) {
    return false;
  }

  const {
    id,
    asset,
    score,
    confidence,
    kind,
    primaryIssueType,
    issueTypes,
    reasons,
    duplicateGroup,
  } = value;

  return (
    typeof id === 'string' &&
    isValidMediaAssetSnapshot(asset) &&
    isFiniteNumber(score) &&
    (confidence === 'low' || confidence === 'medium' || confidence === 'high') &&
    (kind === 'accidental-photo' ||
      kind === 'accidental-video' ||
      kind === 'abnormal-photo' ||
      kind === 'abnormal-video' ||
      kind === 'duplicate-photo' ||
      kind === 'duplicate-video') &&
    (primaryIssueType === 'accidental' ||
      primaryIssueType === 'abnormal' ||
      primaryIssueType === 'duplicate') &&
    isStringArray(issueTypes) &&
    issueTypes.every((issueType) =>
      ['accidental', 'abnormal', 'duplicate'].includes(issueType),
    ) &&
    isStringArray(reasons) &&
    (duplicateGroup === undefined || isValidDuplicateGroup(duplicateGroup))
  );
}

function isValidScanSummary(value: unknown): value is ScanSummary {
  if (!isJsonRecord(value)) {
    return false;
  }

  const {
    scannedAt,
    scannedCount,
    candidateCount,
    highConfidenceCount,
    mediumConfidenceCount,
    recycleBinCount,
  } = value;

  return (
    isFiniteNumber(scannedAt) &&
    isFiniteNumber(scannedCount) &&
    isFiniteNumber(candidateCount) &&
    isFiniteNumber(highConfidenceCount) &&
    isFiniteNumber(mediumConfidenceCount) &&
    isFiniteNumber(recycleBinCount)
  );
}

function normalizePhotoScanResultCache(value: unknown): PhotoScanResultCache | null {
  if (!isJsonRecord(value) || !Array.isArray(value.activeCandidates) || !isValidScanSummary(value.summary)) {
    return null;
  }

  return {
    activeCandidates: value.activeCandidates.filter(isValidCleanupCandidate),
    summary: value.summary,
  };
}

function normalizeRecycleBinCandidateCache(value: unknown): RecycleBinCandidateCache {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isValidCleanupCandidate);
}

function normalizeRecycleBinSnapshotCache(value: unknown): RecycleBinSnapshotCache | null {
  if (Array.isArray(value)) {
    const candidates = normalizeRecycleBinCandidateCache(value);
    return {
      ids: normalizeIds(candidates.map((candidate) => candidate.id)),
      candidates,
      updatedAt: 0,
      source: 'legacy',
    };
  }

  if (!isJsonRecord(value) || !Array.isArray(value.candidates)) {
    return null;
  }

  const candidates = normalizeRecycleBinCandidateCache(value.candidates);
  const candidateIdSet = new Set(candidates.map((candidate) => candidate.id));
  const snapshotIds = isStringArray(value.ids)
    ? normalizeIds(value.ids.filter((id) => candidateIdSet.has(id)))
    : normalizeIds(candidates.map((candidate) => candidate.id));
  const visibleIdSet = new Set(snapshotIds);
  const filteredCandidates =
    snapshotIds.length === 0
      ? candidates
      : candidates.filter((candidate) => visibleIdSet.has(candidate.id));

  return {
    ids: snapshotIds.length > 0 ? snapshotIds : normalizeIds(filteredCandidates.map((candidate) => candidate.id)),
    candidates: filteredCandidates,
    updatedAt: isFiniteNumber(value.updatedAt) ? value.updatedAt : 0,
    source:
      value.source === 'manual' || value.source === 'hydrated' || value.source === 'legacy'
        ? value.source
        : 'manual',
  };
}

function buildRecycleBinSnapshotCache(
  candidates: readonly CleanupCandidate[],
  options?: {
    ids?: readonly string[];
    updatedAt?: number;
    source?: RecycleBinSnapshotCache['source'];
  },
): RecycleBinSnapshotCache {
  const normalizedCandidates = normalizeRecycleBinCandidateCache(candidates);
  const normalizedIds = normalizeIds(
    (options?.ids ?? normalizedCandidates.map((candidate) => candidate.id)).filter(
      (id): id is string => typeof id === 'string',
    ),
  );
  const visibleIdSet = new Set(normalizedIds);
  const filteredCandidates =
    normalizedIds.length === 0
      ? normalizedCandidates
      : normalizedCandidates.filter((candidate) => visibleIdSet.has(candidate.id));

  return {
    ids: normalizedIds.length > 0 ? normalizedIds : normalizeIds(filteredCandidates.map((candidate) => candidate.id)),
    candidates: filteredCandidates,
    updatedAt: options?.updatedAt ?? Date.now(),
    source: options?.source ?? 'manual',
  };
}

function isValidMediaAnalysisCacheEntry(value: unknown): value is MediaAnalysisCacheEntry {
  if (!isJsonRecord(value)) {
    return false;
  }

  const {
    assetId,
    signature,
    previewUri,
    fingerprint,
    differenceHash,
    contentHash,
    frameFingerprints,
    status,
    metrics,
  } = value;

  return (
    typeof assetId === 'string' &&
    typeof signature === 'string' &&
    typeof previewUri === 'string' &&
    (fingerprint === null || typeof fingerprint === 'string') &&
    (differenceHash === undefined || differenceHash === null || typeof differenceHash === 'string') &&
    (contentHash === undefined || contentHash === null || typeof contentHash === 'string') &&
    isStringArray(frameFingerprints) &&
    (status === 'ok' || status === 'fallback') &&
    isValidVisualMetrics(metrics)
  );
}

function normalizeMediaAnalysisCache(value: unknown): MediaAnalysisCache {
  if (!isJsonRecord(value)) {
    return {};
  }

  return Object.entries(value).reduce<MediaAnalysisCache>((cache, [assetId, entry]) => {
    if (isValidMediaAnalysisCacheEntry(entry)) {
      cache[assetId] = entry;
    }

    return cache;
  }, {});
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

export async function loadRecycleBinCandidateCache(): Promise<RecycleBinCandidateCache> {
  const snapshot = await loadRecycleBinSnapshotCache();
  return snapshot?.candidates ?? [];
}

export async function loadRecycleBinSnapshotCache(): Promise<RecycleBinSnapshotCache | null> {
  const value = await AsyncStorage.getItem(RECYCLE_BIN_CANDIDATE_CACHE_KEY);
  if (!value) {
    return null;
  }

  try {
    return normalizeRecycleBinSnapshotCache(JSON.parse(value));
  } catch {
    return null;
  }
}

export async function saveRecycleBinCandidateCache(
  candidates: RecycleBinCandidateCache,
): Promise<void> {
  await saveRecycleBinSnapshotCache(buildRecycleBinSnapshotCache(candidates, { source: 'manual' }));
}

export async function saveRecycleBinSnapshotCache(
  snapshot: RecycleBinSnapshotCache,
): Promise<void> {
  await AsyncStorage.setItem(
    RECYCLE_BIN_CANDIDATE_CACHE_KEY,
    JSON.stringify(
      buildRecycleBinSnapshotCache(snapshot.candidates, {
        ids: snapshot.ids,
        updatedAt: snapshot.updatedAt,
        source: snapshot.source,
      }),
    ),
  );
}

export async function saveManualRecycleBinSnapshot(
  candidates: readonly CleanupCandidate[],
): Promise<RecycleBinSnapshotCache> {
  const snapshot = buildRecycleBinSnapshotCache(candidates, { source: 'manual' });
  await saveRecycleBinSnapshotCache(snapshot);
  return snapshot;
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

export async function loadPhotoScanResultCache(): Promise<PhotoScanResultCache | null> {
  const value = await AsyncStorage.getItem(PHOTO_SCAN_RESULT_CACHE_KEY);
  if (!value) {
    return null;
  }

  try {
    return normalizePhotoScanResultCache(JSON.parse(value));
  } catch {
    return null;
  }
}

export async function savePhotoScanResultCache(cache: PhotoScanResultCache): Promise<void> {
  await AsyncStorage.setItem(PHOTO_SCAN_RESULT_CACHE_KEY, JSON.stringify(cache));
}

export async function clearPhotoScanResultCache(): Promise<void> {
  await AsyncStorage.removeItem(PHOTO_SCAN_RESULT_CACHE_KEY);
}

export async function loadMediaAnalysisCache(): Promise<MediaAnalysisCache> {
  const value = await AsyncStorage.getItem(MEDIA_ANALYSIS_CACHE_KEY);
  if (!value) {
    return {};
  }

  try {
    return normalizeMediaAnalysisCache(JSON.parse(value));
  } catch {
    return {};
  }
}

export async function saveMediaAnalysisCache(cache: MediaAnalysisCache): Promise<void> {
  await AsyncStorage.setItem(
    MEDIA_ANALYSIS_CACHE_KEY,
    JSON.stringify(normalizeMediaAnalysisCache(cache)),
  );
}

export async function loadFalsePositiveCandidateIds(): Promise<string[]> {
  const value = await AsyncStorage.getItem(FALSE_POSITIVE_CANDIDATE_IDS_KEY);
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

export async function saveFalsePositiveCandidateIds(ids: string[]): Promise<void> {
  await AsyncStorage.setItem(
    FALSE_POSITIVE_CANDIDATE_IDS_KEY,
    JSON.stringify(normalizeIds(ids)),
  );
}

export async function appendFalsePositiveCandidateIds(ids: string[]): Promise<string[]> {
  const merged = normalizeIds([...(await loadFalsePositiveCandidateIds()), ...ids]);
  await saveFalsePositiveCandidateIds(merged);
  return merged;
}
