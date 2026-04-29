import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  CleanupCandidate,
  DuplicateGroup,
  MediaAssetSnapshot,
  MediaType,
  VisualMetrics,
} from '../../domain/recognition/types';
import type { ScanSummary } from '../../features/scan/scan-media-library';
import { loadScanRange } from './scan-range-storage';
import {
  clearOperationalPersistentScanCache,
  estimateOperationalPersistentScanCacheSizeBytes,
  deleteOperationalAssetRecords,
  loadOperationalAssetManifestEntries,
  loadOperationalCleanupReportSnapshot,
  hasOperationalStoreImportedLegacyAsyncStorage,
  loadOperationalLastValidScanBaseline,
  loadOperationalLatestCompletedScanBatch,
  loadOperationalLatestScanBatch,
  loadOperationalMediaAnalysisCache,
  loadOperationalPhotoScanResultCache,
  loadOperationalPersistedMediaLedger,
  loadOperationalRecycleBinIds,
  loadOperationalScanBatch,
  loadOperationalScanBatchItems,
  loadOperationalUserDecisions,
  recordOperationalUserDecisions,
  recordOperationalCleanupReportDelta,
  markOperationalStoreLegacyImportCompleted,
  saveOperationalLastValidScanBaseline,
  saveOperationalMediaAnalysisCache,
  saveOperationalPhotoScanResultCache,
  saveOperationalPersistedMediaLedger,
  saveOperationalScanBatch,
  saveOperationalScanBatchItems,
  saveOperationalRecycleBinIds,
  clearOperationalPhotoScanResultCache,
  upsertOperationalAssetManifestEntries,
  type OperationalAssetManifestRecord,
  type OperationalAssetMediaType,
  type OperationalScanBatchItemRecord,
  type OperationalScanBatchRecord,
  type OperationalUserDecisionRecord,
} from './sqlite/operational-store';

const RECYCLE_BIN_KEY = 'app-cleaner/recycle-bin-ids';
const RECYCLE_BIN_CANDIDATE_CACHE_KEY = 'app-cleaner/recycle-bin-candidate-cache';
const LAST_SCAN_KEY = 'app-cleaner/last-scan';
const LAST_VALID_SCAN_BASELINE_KEY = 'app-cleaner/last-valid-scan-baseline';
const PHOTO_SCAN_RESULT_CACHE_KEY = 'app-cleaner/photo-scan-result-cache';
const PHOTO_SCAN_SESSION_KEY = 'app-cleaner/photo-scan-session';
const FALSE_POSITIVE_CANDIDATE_IDS_KEY = 'app-cleaner/false-positive-candidate-ids';
const MEDIA_ANALYSIS_CACHE_KEY = 'app-cleaner/media-analysis-cache';
const PERSISTED_MEDIA_LEDGER_KEY = 'app-cleaner/persisted-media-ledger';

export interface LastScanMeta {
  scannedAt: number;
  scannedCount: number;
  candidateCount: number;
  highConfidenceCount?: number;
  mediumConfidenceCount?: number;
  recycleBinCount?: number;
}

export interface CleanupReportSnapshot {
  cleanedItemCount: number;
  cleanedBytes: number;
  lastCleanedAt: number | null;
}

export interface CleanupReportDelta {
  cleanedItemCount: number;
  cleanedBytes: number;
  cleanedAt?: number;
}

export interface LastValidScanBaseline {
  scannedAt: number;
  scannedCount: number;
  candidateCount: number;
  scanRangeMonths: number;
  latestEligibleAssetAt: number | null;
  ledgerUpdatedAt: number;
}

export type PhotoScanAssetMediaType = MediaType | 'unknown';

export type PhotoScanBatchMode = 'rolling-window' | 'full' | 'repair' | 'backfill';
export type PhotoScanBatchPhase =
  | 'queued'
  | 'enumeration'
  | 'analysis'
  | 'aggregation'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface PhotoScanBatchRecord {
  batchId: string;
  mode: PhotoScanBatchMode;
  phase: PhotoScanBatchPhase;
  windowDays: number | null;
  rangeStartAt: number | null;
  rangeEndAt: number | null;
  progressCurrent: number;
  progressTotal: number;
  enumeratedCount: number;
  dirtyCount: number;
  analyzedCount: number;
  candidateCount: number;
  startedAt: number;
  lastHeartbeatAt: number;
  completedAt: number | null;
  lastError: string | null;
  updatedAt: number;
}

export type PhotoScanBatchItemStage =
  | 'queued'
  | 'analyzing'
  | 'aggregating'
  | 'completed'
  | 'failed'
  | 'skipped';

export interface PhotoScanBatchItemRecord {
  batchId: string;
  assetId: string;
  stage: PhotoScanBatchItemStage;
  mediaType: PhotoScanAssetMediaType;
  dirtyReason: string | null;
  attemptCount: number;
  workerSlot: string | null;
  lastHeartbeatAt: number | null;
  lastError: string | null;
  updatedAt: number;
}

export type AssetManifestDirtyReason =
  | 'new'
  | 'modified'
  | 'missing-analysis'
  | 'algorithm-upgrade'
  | null;

export interface AssetManifestRecord {
  assetId: string;
  contentUri: string;
  mediaType: PhotoScanAssetMediaType;
  mimeType: string | null;
  width: number;
  height: number;
  orientation: number | null;
  aspectRatio: number | null;
  durationMs: number;
  fileSizeBytes: number | null;
  dateTaken: number | null;
  dateModified: number | null;
  bucketId: string | null;
  bucketName: string | null;
  isScreenshot: boolean | null;
  bitrate: number | null;
  frameRate: number | null;
  codec: string | null;
  firstSeenAt: number;
  lastSeenAt: number;
  isDeleted: boolean;
  dirtyReason: AssetManifestDirtyReason;
  updatedAt: number;
}

export interface PhotoScanResultCache {
  activeCandidates: CleanupCandidate[];
  summary: ScanSummary;
}

export type UserDecisionRecord = OperationalUserDecisionRecord;

export type PhotoScanSessionPhase = 'idle' | 'scanning' | 'completed' | 'error';
export type PhotoScanPermissionState = 'loading' | 'granted' | 'denied';

export interface PhotoScanSessionProgress {
  current: number;
  total: number;
  currentFileName: string | null;
}

export interface PhotoScanSessionScopeSelection {
  total: number;
  photo: number;
  video: number;
}

export interface PhotoScanSessionRange {
  startAt: number | null;
  endAt: number | null;
}

export interface PhotoScanSessionSnapshot {
  permissionState: PhotoScanPermissionState;
  phase: PhotoScanSessionPhase;
  authorizedCandidates: CleanupCandidate[];
  visibleCandidates: CleanupCandidate[];
  scanResultsCount: number;
  scanProgress: PhotoScanSessionProgress;
  scanScopeSelection: PhotoScanSessionScopeSelection;
  scanBatchRange: PhotoScanSessionRange | null;
  summary: Pick<ScanSummary, 'scannedAt' | 'scannedCount' | 'recycleBinCount'>;
  hasCompletedFullScan?: boolean;
  errorMessage: string | null;
  updatedAt: number;
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

export type PersistedMediaStatus = -2 | -1 | 0 | 1;

export interface PersistedMediaRecord {
  assetId: string;
  stableHash: string;
  status: PersistedMediaStatus;
  linkIds: string[];
  updatedAt: number;
  lastError: string | null;
  candidate?: CleanupCandidate;
}

let operationalStoreImportPromise: Promise<void> | null = null;

export function __resetOperationalStoreImportForTests() {
  operationalStoreImportPromise = null;
}

type JsonRecord = Record<string, unknown>;

function normalizeIds(ids: readonly string[]) {
  return Array.from(new Set(ids)).sort();
}

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isBooleanOrNull(value: unknown): value is boolean | null {
  return value === null || typeof value === 'boolean';
}

function isValidPhotoScanAssetMediaType(value: unknown): value is PhotoScanAssetMediaType {
  return value === 'photo' || value === 'video' || value === 'unknown';
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function getUtf8ByteLength(value: string) {
  return new TextEncoder().encode(value).length;
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

function isValidPhotoScanBatchMode(value: unknown): value is PhotoScanBatchMode {
  return value === 'rolling-window' || value === 'full' || value === 'repair' || value === 'backfill';
}

function isValidPhotoScanBatchPhase(value: unknown): value is PhotoScanBatchPhase {
  return (
    value === 'queued' ||
    value === 'enumeration' ||
    value === 'analysis' ||
    value === 'aggregation' ||
    value === 'completed' ||
    value === 'failed' ||
    value === 'cancelled'
  );
}

function isValidPhotoScanBatchItemStage(value: unknown): value is PhotoScanBatchItemStage {
  return (
    value === 'queued' ||
    value === 'analyzing' ||
    value === 'aggregating' ||
    value === 'completed' ||
    value === 'failed' ||
    value === 'skipped'
  );
}

function isValidAssetManifestDirtyReason(value: unknown): value is AssetManifestDirtyReason {
  return (
    value === null ||
    value === 'new' ||
    value === 'modified' ||
    value === 'missing-analysis' ||
    value === 'algorithm-upgrade'
  );
}

function normalizePhotoScanBatchRecord(value: unknown): PhotoScanBatchRecord | null {
  if (
    !isJsonRecord(value) ||
    typeof value.batchId !== 'string' ||
    !isValidPhotoScanBatchMode(value.mode) ||
    !isValidPhotoScanBatchPhase(value.phase) ||
    (value.windowDays !== null && value.windowDays !== undefined && !isFiniteNumber(value.windowDays)) ||
    !isFiniteNumber(value.progressCurrent) ||
    !isFiniteNumber(value.progressTotal) ||
    !isFiniteNumber(value.enumeratedCount) ||
    !isFiniteNumber(value.dirtyCount) ||
    !isFiniteNumber(value.analyzedCount) ||
    !isFiniteNumber(value.candidateCount) ||
    !isFiniteNumber(value.startedAt) ||
    !isFiniteNumber(value.lastHeartbeatAt) ||
    !isFiniteNumber(value.updatedAt)
  ) {
    return null;
  }

  return {
    batchId: value.batchId,
    mode: value.mode,
    phase: value.phase,
    windowDays:
      value.windowDays === null || value.windowDays === undefined
        ? null
        : isFiniteNumber(value.windowDays)
          ? value.windowDays
          : null,
    rangeStartAt:
      value.rangeStartAt === null || value.rangeStartAt === undefined
        ? null
        : isFiniteNumber(value.rangeStartAt)
          ? value.rangeStartAt
          : null,
    rangeEndAt:
      value.rangeEndAt === null || value.rangeEndAt === undefined
        ? null
        : isFiniteNumber(value.rangeEndAt)
          ? value.rangeEndAt
          : null,
    progressCurrent: value.progressCurrent,
    progressTotal: value.progressTotal,
    enumeratedCount: value.enumeratedCount,
    dirtyCount: value.dirtyCount,
    analyzedCount: value.analyzedCount,
    candidateCount: value.candidateCount,
    startedAt: value.startedAt,
    completedAt:
      value.completedAt === null || value.completedAt === undefined
        ? null
        : isFiniteNumber(value.completedAt)
          ? value.completedAt
          : null,
    lastHeartbeatAt: value.lastHeartbeatAt,
    lastError:
      value.lastError === null || value.lastError === undefined
        ? null
        : typeof value.lastError === 'string'
          ? value.lastError
          : null,
    updatedAt: value.updatedAt,
  };
}

function normalizePhotoScanBatchItemRecord(value: unknown): PhotoScanBatchItemRecord | null {
  if (
    !isJsonRecord(value) ||
    typeof value.batchId !== 'string' ||
    typeof value.assetId !== 'string' ||
    !isValidPhotoScanBatchItemStage(value.stage) ||
    !isValidPhotoScanAssetMediaType(value.mediaType) ||
    !isFiniteNumber(value.attemptCount) ||
    !isFiniteNumber(value.updatedAt)
  ) {
    return null;
  }

  return {
    batchId: value.batchId,
    assetId: value.assetId,
    stage: value.stage,
    mediaType: value.mediaType,
    dirtyReason:
      value.dirtyReason === null || value.dirtyReason === undefined
        ? null
        : typeof value.dirtyReason === 'string'
          ? value.dirtyReason
          : null,
    attemptCount: value.attemptCount,
    workerSlot:
      value.workerSlot === null || value.workerSlot === undefined
        ? null
        : typeof value.workerSlot === 'string'
          ? value.workerSlot
          : null,
    lastHeartbeatAt:
      value.lastHeartbeatAt === null || value.lastHeartbeatAt === undefined
        ? null
        : isFiniteNumber(value.lastHeartbeatAt)
          ? value.lastHeartbeatAt
          : null,
    lastError:
      value.lastError === null || value.lastError === undefined
        ? null
        : typeof value.lastError === 'string'
          ? value.lastError
          : null,
    updatedAt: value.updatedAt,
  };
}

function isValidAssetManifestRecord(value: unknown): value is AssetManifestRecord {
  if (!isJsonRecord(value)) {
    return false;
  }

  return (
    typeof value.assetId === 'string' &&
    typeof value.contentUri === 'string' &&
    isValidPhotoScanAssetMediaType(value.mediaType) &&
    (value.mimeType === null || value.mimeType === undefined || typeof value.mimeType === 'string') &&
    isFiniteNumber(value.width) &&
    isFiniteNumber(value.height) &&
    (value.orientation === null || value.orientation === undefined || isFiniteNumber(value.orientation)) &&
    (value.aspectRatio === null || value.aspectRatio === undefined || isFiniteNumber(value.aspectRatio)) &&
    isFiniteNumber(value.durationMs) &&
    (value.fileSizeBytes === null || value.fileSizeBytes === undefined || isFiniteNumber(value.fileSizeBytes)) &&
    (value.dateTaken === null || value.dateTaken === undefined || isFiniteNumber(value.dateTaken)) &&
    (value.dateModified === null || value.dateModified === undefined || isFiniteNumber(value.dateModified)) &&
    (value.bucketId === null || value.bucketId === undefined || typeof value.bucketId === 'string') &&
    (value.bucketName === null || value.bucketName === undefined || typeof value.bucketName === 'string') &&
    isBooleanOrNull(value.isScreenshot ?? null) &&
    (value.bitrate === null || value.bitrate === undefined || isFiniteNumber(value.bitrate)) &&
    (value.frameRate === null || value.frameRate === undefined || isFiniteNumber(value.frameRate)) &&
    (value.codec === null || value.codec === undefined || typeof value.codec === 'string') &&
    isFiniteNumber(value.firstSeenAt) &&
    isFiniteNumber(value.lastSeenAt) &&
    typeof value.isDeleted === 'boolean' &&
    isValidAssetManifestDirtyReason(value.dirtyReason) &&
    isFiniteNumber(value.updatedAt)
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

function isValidPersistedMediaStatus(value: unknown): value is PersistedMediaStatus {
  return value === -2 || value === -1 || value === 0 || value === 1;
}

function isValidPersistedMediaRecord(value: unknown): value is PersistedMediaRecord {
  if (!isJsonRecord(value)) {
    return false;
  }

  return (
    typeof value.assetId === 'string' &&
    typeof value.stableHash === 'string' &&
    isValidPersistedMediaStatus(value.status) &&
    isStringArray(value.linkIds) &&
    isFiniteNumber(value.updatedAt) &&
    (value.lastError === null || value.lastError === undefined || typeof value.lastError === 'string') &&
    (value.candidate === undefined || isValidCleanupCandidate(value.candidate))
  );
}

function normalizeLastValidScanBaseline(value: unknown): LastValidScanBaseline | null {
  if (!isJsonRecord(value)) {
    return null;
  }

  if (
    !isFiniteNumber(value.scannedAt) ||
    !isFiniteNumber(value.scannedCount) ||
    !isFiniteNumber(value.candidateCount) ||
    !isFiniteNumber(value.scanRangeMonths) ||
    !isFiniteNumber(value.ledgerUpdatedAt)
  ) {
    return null;
  }

  const latestEligibleAssetAt =
    value.latestEligibleAssetAt === null || value.latestEligibleAssetAt === undefined
      ? null
      : isFiniteNumber(value.latestEligibleAssetAt)
        ? value.latestEligibleAssetAt
        : null;

  return {
    scannedAt: value.scannedAt,
    scannedCount: value.scannedCount,
    candidateCount: value.candidateCount,
    scanRangeMonths: value.scanRangeMonths,
    latestEligibleAssetAt,
    ledgerUpdatedAt: value.ledgerUpdatedAt,
  };
}

function buildLastValidScanBaseline(
  meta: LastScanMeta,
  options: {
    scanRangeMonths: number;
    latestEligibleAssetAt?: number | null;
    ledgerUpdatedAt?: number;
  },
): LastValidScanBaseline {
  return {
    scannedAt: meta.scannedAt,
    scannedCount: meta.scannedCount,
    candidateCount: meta.candidateCount,
    scanRangeMonths: options.scanRangeMonths,
    latestEligibleAssetAt:
      options.latestEligibleAssetAt === undefined
        ? meta.scannedAt
        : options.latestEligibleAssetAt,
    ledgerUpdatedAt: options.ledgerUpdatedAt ?? meta.scannedAt,
  };
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

function selectNewestPhotoScanResultCache(
  primary: PhotoScanResultCache | null,
  fallback: PhotoScanResultCache | null,
): PhotoScanResultCache | null {
  if (!primary) {
    return fallback;
  }
  if (!fallback) {
    return primary;
  }

  return fallback.summary.scannedAt > primary.summary.scannedAt ? fallback : primary;
}

function isValidPhotoScanPermissionState(value: unknown): value is PhotoScanPermissionState {
  return value === 'loading' || value === 'granted' || value === 'denied';
}

function isValidPhotoScanSessionPhase(value: unknown): value is PhotoScanSessionPhase {
  return value === 'idle' || value === 'scanning' || value === 'completed' || value === 'error';
}

function isValidPhotoScanSessionProgress(value: unknown): value is PhotoScanSessionProgress {
  return (
    isJsonRecord(value) &&
    isFiniteNumber(value.current) &&
    isFiniteNumber(value.total) &&
    (value.currentFileName === null ||
      value.currentFileName === undefined ||
      typeof value.currentFileName === 'string')
  );
}

function isValidPhotoScanSessionScopeSelection(
  value: unknown,
): value is PhotoScanSessionScopeSelection {
  return (
    isJsonRecord(value) &&
    isFiniteNumber(value.total) &&
    isFiniteNumber(value.photo) &&
    isFiniteNumber(value.video)
  );
}

function isValidPhotoScanSessionSummary(
  value: unknown,
): value is Pick<ScanSummary, 'scannedAt' | 'scannedCount' | 'recycleBinCount'> {
  return (
    isJsonRecord(value) &&
    isFiniteNumber(value.scannedAt) &&
    isFiniteNumber(value.scannedCount) &&
    isFiniteNumber(value.recycleBinCount)
  );
}

function normalizePhotoScanSessionSnapshot(value: unknown): PhotoScanSessionSnapshot | null {
  if (
    !isJsonRecord(value) ||
    !isValidPhotoScanPermissionState(value.permissionState) ||
    !isValidPhotoScanSessionPhase(value.phase) ||
    !Array.isArray(value.authorizedCandidates) ||
    !Array.isArray(value.visibleCandidates) ||
    !isFiniteNumber(value.scanResultsCount) ||
    !isValidPhotoScanSessionProgress(value.scanProgress) ||
    !isValidPhotoScanSessionScopeSelection(value.scanScopeSelection) ||
    !isValidPhotoScanSessionSummary(value.summary) ||
    !isFiniteNumber(value.updatedAt)
  ) {
    return null;
  }

  const authorizedCandidates = value.authorizedCandidates.filter(isValidCleanupCandidate);
  const visibleCandidates = value.visibleCandidates.filter(isValidCleanupCandidate);

  return {
    permissionState: value.permissionState,
    phase: value.phase,
    authorizedCandidates,
    visibleCandidates,
    scanResultsCount: value.scanResultsCount,
    scanProgress: {
      current: value.scanProgress.current,
      total: value.scanProgress.total,
      currentFileName: value.scanProgress.currentFileName ?? null,
    },
    scanScopeSelection: {
      total: value.scanScopeSelection.total,
      photo: value.scanScopeSelection.photo,
      video: value.scanScopeSelection.video,
    },
    scanBatchRange:
      isJsonRecord(value.scanBatchRange) &&
      (value.scanBatchRange.startAt === null ||
        value.scanBatchRange.startAt === undefined ||
        isFiniteNumber(value.scanBatchRange.startAt)) &&
      (value.scanBatchRange.endAt === null ||
        value.scanBatchRange.endAt === undefined ||
        isFiniteNumber(value.scanBatchRange.endAt))
        ? {
            startAt:
              value.scanBatchRange.startAt === null ||
              value.scanBatchRange.startAt === undefined
                ? null
                : value.scanBatchRange.startAt,
            endAt:
              value.scanBatchRange.endAt === null ||
              value.scanBatchRange.endAt === undefined
                ? null
                : value.scanBatchRange.endAt,
          }
        : null,
    summary: {
      scannedAt: value.summary.scannedAt,
      scannedCount: value.summary.scannedCount,
      recycleBinCount: value.summary.recycleBinCount,
    },
    hasCompletedFullScan: value.hasCompletedFullScan === true,
    errorMessage:
      value.errorMessage === null || value.errorMessage === undefined
        ? null
        : typeof value.errorMessage === 'string'
          ? value.errorMessage
          : null,
    updatedAt: value.updatedAt,
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

function mapOperationalMediaTypeToPhotoScanMediaType(
  mediaType: OperationalAssetMediaType,
): PhotoScanAssetMediaType {
  return mediaType;
}

function mapPhotoScanMediaTypeToOperationalMediaType(
  mediaType: PhotoScanAssetMediaType,
): OperationalAssetMediaType {
  return mediaType;
}

function mapOperationalScanBatchToPhotoScanBatch(
  record: OperationalScanBatchRecord,
): PhotoScanBatchRecord {
  return {
    batchId: record.batchId,
    mode: record.mode,
    windowDays: record.windowDays,
    rangeStartAt: record.rangeStartAt,
    rangeEndAt: record.rangeEndAt,
    phase: record.phase,
    progressCurrent: record.progressCurrent,
    progressTotal: record.progressTotal,
    enumeratedCount: record.enumeratedCount,
    dirtyCount: record.dirtyCount,
    analyzedCount: record.analyzedCount,
    candidateCount: record.candidateCount,
    startedAt: record.startedAt,
    lastHeartbeatAt: record.lastHeartbeatAt,
    completedAt: record.completedAt,
    lastError: record.lastError,
    updatedAt: record.updatedAt,
  };
}

function mapPhotoScanBatchToOperationalScanBatch(
  record: PhotoScanBatchRecord,
): OperationalScanBatchRecord {
  return {
    batchId: record.batchId,
    mode: record.mode,
    windowDays: record.windowDays,
    rangeStartAt: record.rangeStartAt,
    rangeEndAt: record.rangeEndAt,
    phase: record.phase,
    progressCurrent: record.progressCurrent,
    progressTotal: record.progressTotal,
    enumeratedCount: record.enumeratedCount,
    dirtyCount: record.dirtyCount,
    analyzedCount: record.analyzedCount,
    candidateCount: record.candidateCount,
    startedAt: record.startedAt,
    lastHeartbeatAt: record.lastHeartbeatAt,
    completedAt: record.completedAt,
    lastError: record.lastError,
    updatedAt: record.updatedAt,
  };
}

function mapOperationalScanBatchItemToPhotoScanBatchItem(
  item: OperationalScanBatchItemRecord,
): PhotoScanBatchItemRecord {
  return {
    batchId: item.batchId,
    assetId: item.assetId,
    stage: item.stage,
    mediaType: mapOperationalMediaTypeToPhotoScanMediaType(item.mediaType),
    dirtyReason: item.dirtyReason,
    attemptCount: item.attemptCount,
    workerSlot: item.workerSlot,
    lastHeartbeatAt: item.lastHeartbeatAt,
    lastError: item.lastError,
    updatedAt: item.updatedAt,
  };
}

function mapPhotoScanBatchItemToOperationalScanBatchItem(
  item: PhotoScanBatchItemRecord,
): OperationalScanBatchItemRecord {
  return {
    batchId: item.batchId,
    assetId: item.assetId,
    mediaType: mapPhotoScanMediaTypeToOperationalMediaType(item.mediaType),
    stage: item.stage,
    dirtyReason: item.dirtyReason,
    attemptCount: item.attemptCount,
    workerSlot: item.workerSlot,
    lastHeartbeatAt: item.lastHeartbeatAt,
    lastError: item.lastError,
    updatedAt: item.updatedAt,
  };
}

function mapOperationalAssetManifestToAssetManifest(
  entry: OperationalAssetManifestRecord,
): AssetManifestRecord {
  return {
    assetId: entry.assetId,
    contentUri: entry.contentUri,
    mediaType: mapOperationalMediaTypeToPhotoScanMediaType(entry.mediaType),
    mimeType: entry.mimeType,
    width: entry.width,
    height: entry.height,
    orientation: entry.orientation,
    aspectRatio: entry.aspectRatio,
    durationMs: entry.durationMs,
    fileSizeBytes: entry.fileSizeBytes,
    dateTaken: entry.dateTaken,
    dateModified: entry.dateModified,
    bucketId: entry.bucketId,
    bucketName: entry.bucketName,
    isScreenshot: entry.isScreenshot,
    bitrate: entry.bitrate,
    frameRate: entry.frameRate,
    codec: entry.codec,
    firstSeenAt: entry.firstSeenAt,
    lastSeenAt: entry.lastSeenAt,
    isDeleted: entry.isDeleted,
    dirtyReason:
      entry.dirtyReason === null || entry.dirtyReason === undefined
        ? null
        : isValidAssetManifestDirtyReason(entry.dirtyReason)
          ? entry.dirtyReason
          : null,
    updatedAt: entry.updatedAt,
  };
}

function mapAssetManifestToOperationalAssetManifest(
  entry: AssetManifestRecord,
): OperationalAssetManifestRecord {
  return {
    assetId: entry.assetId,
    contentUri: entry.contentUri,
    mediaType: mapPhotoScanMediaTypeToOperationalMediaType(entry.mediaType),
    mimeType: entry.mimeType,
    width: entry.width,
    height: entry.height,
    orientation: entry.orientation,
    aspectRatio: entry.aspectRatio,
    durationMs: entry.durationMs,
    fileSizeBytes: entry.fileSizeBytes,
    dateTaken: entry.dateTaken,
    dateModified: entry.dateModified,
    bucketId: entry.bucketId,
    bucketName: entry.bucketName,
    isScreenshot: entry.isScreenshot,
    bitrate: entry.bitrate,
    frameRate: entry.frameRate,
    codec: entry.codec,
    firstSeenAt: entry.firstSeenAt,
    lastSeenAt: entry.lastSeenAt,
    isDeleted: entry.isDeleted,
    dirtyReason: entry.dirtyReason,
    updatedAt: entry.updatedAt,
  };
}

function normalizePersistedMediaLedger(value: unknown): PersistedMediaRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(isValidPersistedMediaRecord)
    .map((record) => ({
      assetId: record.assetId,
      stableHash: record.stableHash,
      status: record.status,
      linkIds: normalizeIds(record.linkIds),
      updatedAt: record.updatedAt,
      lastError: record.lastError ?? null,
      ...(record.candidate ? { candidate: record.candidate } : {}),
    }))
    .sort((left, right) => right.updatedAt - left.updatedAt || left.assetId.localeCompare(right.assetId));
}

function buildPersistedMediaLinkIds(candidate: CleanupCandidate) {
  const linkIds = new Set<string>();

  if (
    candidate.duplicateGroup?.representativeId &&
    candidate.duplicateGroup.representativeId !== candidate.id
  ) {
    linkIds.add(candidate.duplicateGroup.representativeId);
  }

  return normalizeIds([...linkIds]);
}

function buildPersistedMediaStableHash(
  assetId: string,
  analysisCacheEntry?: MediaAnalysisCacheEntry,
) {
  return (
    analysisCacheEntry?.contentHash ??
    analysisCacheEntry?.differenceHash ??
    analysisCacheEntry?.fingerprint ??
    assetId
  );
}

function upsertPersistedMediaRecord(
  recordsById: Map<string, PersistedMediaRecord>,
  record: PersistedMediaRecord,
) {
  recordsById.set(record.assetId, {
    ...record,
    linkIds: normalizeIds(record.linkIds),
    lastError: record.lastError ?? null,
  });
}

function buildPersistedMediaRecordFromCandidate(
  candidate: CleanupCandidate,
  status: PersistedMediaStatus,
  updatedAt: number,
  analysisCacheEntry?: MediaAnalysisCacheEntry,
  previous?: PersistedMediaRecord,
): PersistedMediaRecord {
  return {
    assetId: candidate.id,
    stableHash: buildPersistedMediaStableHash(candidate.asset.id || candidate.id, analysisCacheEntry),
    status,
    linkIds: buildPersistedMediaLinkIds(candidate),
    updatedAt,
    lastError: status === -1 ? previous?.lastError ?? null : null,
    candidate,
  };
}

function buildUserDecisionRecord(
  params: {
    assetId: string;
    candidateId?: string | null;
    decision: OperationalUserDecisionRecord['decision'];
    reason?: string | null;
    updatedAt: number;
    candidate?: CleanupCandidate;
  },
): OperationalUserDecisionRecord {
  return {
    assetId: params.assetId,
    candidateId: params.candidateId ?? null,
    decision: params.decision,
    source: 'manual',
    reason: params.reason ?? null,
    decidedAt: params.updatedAt,
    updatedAt: params.updatedAt,
    snapshotJson: params.candidate ? JSON.stringify(params.candidate) : null,
  };
}

function addUserDecision(
  decisionsByAssetId: Map<string, OperationalUserDecisionRecord>,
  record: OperationalUserDecisionRecord,
) {
  decisionsByAssetId.set(record.assetId, record);
}

async function loadLegacyRecycleBinIdsFromAsyncStorage(): Promise<string[]> {
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

async function saveLegacyRecycleBinIdsToAsyncStorage(ids: string[]): Promise<void> {
  await AsyncStorage.setItem(RECYCLE_BIN_KEY, JSON.stringify(normalizeIds(ids)));
}

async function loadLegacyLastValidScanBaselineFromAsyncStorage(): Promise<LastValidScanBaseline | null> {
  const value = await AsyncStorage.getItem(LAST_VALID_SCAN_BASELINE_KEY);
  if (value) {
    try {
      const parsed = normalizeLastValidScanBaseline(JSON.parse(value));
      if (parsed) {
        return parsed;
      }
    } catch {
      // Fall through to the legacy last-scan metadata for backward compatibility.
    }
  }

  const [lastScanMeta, scanRangeMonths] = await Promise.all([
    loadLastScanMeta(),
    loadScanRange(),
  ]);

  return lastScanMeta
    ? buildLastValidScanBaseline(lastScanMeta, { scanRangeMonths })
    : null;
}

async function saveLegacyLastValidScanBaselineToAsyncStorage(
  baseline: LastValidScanBaseline,
): Promise<void> {
  await AsyncStorage.setItem(
    LAST_VALID_SCAN_BASELINE_KEY,
    JSON.stringify(baseline),
  );
}

async function loadLegacyMediaAnalysisCacheFromAsyncStorage(): Promise<MediaAnalysisCache> {
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

async function saveLegacyMediaAnalysisCacheToAsyncStorage(cache: MediaAnalysisCache): Promise<void> {
  await AsyncStorage.setItem(
    MEDIA_ANALYSIS_CACHE_KEY,
    JSON.stringify(normalizeMediaAnalysisCache(cache)),
  );
}

async function loadLegacyPersistedMediaLedgerFromAsyncStorage(): Promise<PersistedMediaRecord[]> {
  const value = await AsyncStorage.getItem(PERSISTED_MEDIA_LEDGER_KEY);
  if (!value) {
    return [];
  }

  try {
    return normalizePersistedMediaLedger(JSON.parse(value));
  } catch {
    return [];
  }
}

async function saveLegacyPersistedMediaLedgerToAsyncStorage(
  records: PersistedMediaRecord[],
): Promise<void> {
  await AsyncStorage.setItem(
    PERSISTED_MEDIA_LEDGER_KEY,
    JSON.stringify(normalizePersistedMediaLedger(records)),
  );
}

async function loadLegacyPhotoScanResultCacheFromAsyncStorage(): Promise<PhotoScanResultCache | null> {
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

async function ensureOperationalStoreImported() {
  if (!operationalStoreImportPromise) {
    operationalStoreImportPromise = (async () => {
      const alreadyImported = await hasOperationalStoreImportedLegacyAsyncStorage();
      if (alreadyImported) {
        return;
      }

      const [
        recycleBinIds,
        baseline,
        analysisCache,
        photoScanResultCache,
        persistedMediaLedger,
      ] = await Promise.all([
        loadLegacyRecycleBinIdsFromAsyncStorage(),
        loadLegacyLastValidScanBaselineFromAsyncStorage(),
        loadLegacyMediaAnalysisCacheFromAsyncStorage(),
        loadLegacyPhotoScanResultCacheFromAsyncStorage(),
        loadLegacyPersistedMediaLedgerFromAsyncStorage(),
      ]);

      await Promise.all([
        saveOperationalRecycleBinIds(recycleBinIds),
        baseline ? saveOperationalLastValidScanBaseline(baseline) : Promise.resolve(),
        saveOperationalMediaAnalysisCache(analysisCache),
        photoScanResultCache
          ? saveOperationalPhotoScanResultCache(photoScanResultCache)
          : Promise.resolve(),
        saveOperationalPersistedMediaLedger(persistedMediaLedger),
      ]);
      await markOperationalStoreLegacyImportCompleted();
    })().catch((error) => {
      operationalStoreImportPromise = null;
      throw error;
    });
  }

  return operationalStoreImportPromise;
}

async function withOperationalStoreFallback<T>(
  sqliteAction: () => Promise<T>,
  fallbackAction: () => Promise<T>,
) {
  try {
    await ensureOperationalStoreImported();
    return await sqliteAction();
  } catch {
    return fallbackAction();
  }
}

export async function loadRecycleBinIds(): Promise<string[]> {
  return withOperationalStoreFallback(
    async () => normalizeIds(await loadOperationalRecycleBinIds()),
    () => loadLegacyRecycleBinIdsFromAsyncStorage(),
  );
}

export async function saveRecycleBinIds(ids: string[]): Promise<void> {
  await withOperationalStoreFallback(
    () => saveOperationalRecycleBinIds(normalizeIds(ids)),
    () => saveLegacyRecycleBinIdsToAsyncStorage(ids),
  );
}

export async function loadCleanupReportSnapshot(): Promise<CleanupReportSnapshot> {
  return withOperationalStoreFallback(
    async () => loadOperationalCleanupReportSnapshot(),
    async () => ({
      cleanedItemCount: 0,
      cleanedBytes: 0,
      lastCleanedAt: null,
    }),
  );
}

export async function recordCleanupReportDelta(
  delta: CleanupReportDelta,
): Promise<CleanupReportSnapshot> {
  return withOperationalStoreFallback(
    async () =>
      recordOperationalCleanupReportDelta({
        cleanedItemCount: delta.cleanedItemCount,
        cleanedBytes: delta.cleanedBytes,
        cleanedAt: delta.cleanedAt,
      }),
    async () => ({
      cleanedItemCount: 0,
      cleanedBytes: 0,
      lastCleanedAt: null,
    }),
  );
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

export async function loadLastValidScanBaseline(): Promise<LastValidScanBaseline | null> {
  return withOperationalStoreFallback(
    async () => {
      const baseline = await loadOperationalLastValidScanBaseline();
      return baseline ? normalizeLastValidScanBaseline(baseline) : null;
    },
    () => loadLegacyLastValidScanBaselineFromAsyncStorage(),
  );
}

export async function saveLastValidScanBaseline(
  baseline: LastValidScanBaseline,
): Promise<void> {
  await withOperationalStoreFallback(
    () => saveOperationalLastValidScanBaseline(baseline),
    () => saveLegacyLastValidScanBaselineToAsyncStorage(baseline),
  );
}

export async function loadLatestPhotoScanBatch(): Promise<PhotoScanBatchRecord | null> {
  return withOperationalStoreFallback(
    async () => {
      const batch = await loadOperationalLatestScanBatch();
      return batch ? mapOperationalScanBatchToPhotoScanBatch(batch) : null;
    },
    async () => null,
  );
}

export async function loadLatestCompletedPhotoScanBatch(): Promise<PhotoScanBatchRecord | null> {
  return withOperationalStoreFallback(
    async () => {
      const batch = await loadOperationalLatestCompletedScanBatch();
      return batch ? mapOperationalScanBatchToPhotoScanBatch(batch) : null;
    },
    async () => null,
  );
}

export async function loadPhotoScanBatch(batchId: string): Promise<PhotoScanBatchRecord | null> {
  return withOperationalStoreFallback(
    async () => {
      const batch = await loadOperationalScanBatch(batchId);
      return batch ? mapOperationalScanBatchToPhotoScanBatch(batch) : null;
    },
    async () => null,
  );
}

export async function savePhotoScanBatch(batch: PhotoScanBatchRecord): Promise<void> {
  const normalizedBatch = normalizePhotoScanBatchRecord(batch);

  if (!normalizedBatch) {
    throw new Error('Invalid photo scan batch record.');
  }

  await withOperationalStoreFallback(
    () => saveOperationalScanBatch(mapPhotoScanBatchToOperationalScanBatch(normalizedBatch)),
    async () => undefined,
  );
}

export async function loadPhotoScanBatchItems(batchId: string): Promise<PhotoScanBatchItemRecord[]> {
  return withOperationalStoreFallback(
    async () =>
      (await loadOperationalScanBatchItems(batchId)).map(
        mapOperationalScanBatchItemToPhotoScanBatchItem,
      ),
    async () => [],
  );
}

export async function savePhotoScanBatchItems(
  batchId: string,
  items: PhotoScanBatchItemRecord[],
): Promise<void> {
  const normalizedItems = items
    .map((item) => normalizePhotoScanBatchItemRecord(item))
    .filter((item): item is PhotoScanBatchItemRecord => Boolean(item));

  await withOperationalStoreFallback(
    () =>
      saveOperationalScanBatchItems(
        batchId,
        normalizedItems.map(mapPhotoScanBatchItemToOperationalScanBatchItem),
      ),
    async () => undefined,
  );
}

export async function loadAssetManifestEntries(assetIds?: readonly string[]): Promise<AssetManifestRecord[]> {
  return withOperationalStoreFallback(
    async () =>
      (await loadOperationalAssetManifestEntries(assetIds)).map(
        mapOperationalAssetManifestToAssetManifest,
      ),
    async () => [],
  );
}

export async function upsertAssetManifestEntries(entries: AssetManifestRecord[]): Promise<void> {
  const normalizedEntries = entries.filter(isValidAssetManifestRecord);

  await withOperationalStoreFallback(
    () =>
      upsertOperationalAssetManifestEntries(
        normalizedEntries.map(mapAssetManifestToOperationalAssetManifest),
      ),
    async () => undefined,
  );
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
      typeof parsed?.candidateCount === 'number' &&
      (parsed?.highConfidenceCount === undefined ||
        typeof parsed.highConfidenceCount === 'number') &&
      (parsed?.mediumConfidenceCount === undefined ||
        typeof parsed.mediumConfidenceCount === 'number') &&
      (parsed?.recycleBinCount === undefined ||
        typeof parsed.recycleBinCount === 'number')
    ) {
      return parsed as LastScanMeta;
    }
  } catch {
    return null;
  }

  return null;
}

export async function saveLastScanMeta(meta: LastScanMeta): Promise<void> {
  const scanRangeMonths = await loadScanRange();
  const baseline = buildLastValidScanBaseline(meta, { scanRangeMonths });

  await Promise.all([
    AsyncStorage.setItem(LAST_SCAN_KEY, JSON.stringify(meta)),
    saveLastValidScanBaseline(baseline),
  ]);
}

export async function loadPhotoScanResultCache(): Promise<PhotoScanResultCache | null> {
  return withOperationalStoreFallback(
    async () => {
      const [operationalCache, legacyCache] = await Promise.all([
        loadOperationalPhotoScanResultCache().then(normalizePhotoScanResultCache),
        loadLegacyPhotoScanResultCacheFromAsyncStorage(),
      ]);
      return selectNewestPhotoScanResultCache(operationalCache, legacyCache);
    },
    loadLegacyPhotoScanResultCacheFromAsyncStorage,
  );
}

export async function savePhotoScanResultCache(cache: PhotoScanResultCache): Promise<void> {
  const normalizedCache = normalizePhotoScanResultCache(cache);
  if (!normalizedCache) {
    throw new Error('Invalid photo scan result cache.');
  }

  await Promise.all([
    AsyncStorage.setItem(PHOTO_SCAN_RESULT_CACHE_KEY, JSON.stringify(normalizedCache)),
    withOperationalStoreFallback(
      () => saveOperationalPhotoScanResultCache(normalizedCache),
      async () => undefined,
    ),
  ]);
}

export async function clearPhotoScanResultCache(): Promise<void> {
  await Promise.all([
    AsyncStorage.removeItem(PHOTO_SCAN_RESULT_CACHE_KEY),
    withOperationalStoreFallback(
      () => clearOperationalPhotoScanResultCache(),
      async () => undefined,
    ),
  ]);
}

export async function loadPhotoScanSessionSnapshot(): Promise<PhotoScanSessionSnapshot | null> {
  const value = await AsyncStorage.getItem(PHOTO_SCAN_SESSION_KEY);
  if (!value) {
    return null;
  }

  try {
    return normalizePhotoScanSessionSnapshot(JSON.parse(value));
  } catch {
    return null;
  }
}

export async function savePhotoScanSessionSnapshot(
  snapshot: PhotoScanSessionSnapshot,
): Promise<void> {
  const normalizedSnapshot = normalizePhotoScanSessionSnapshot(snapshot);

  if (!normalizedSnapshot) {
    throw new Error('Invalid photo scan session snapshot.');
  }

  await AsyncStorage.setItem(
    PHOTO_SCAN_SESSION_KEY,
    JSON.stringify(normalizedSnapshot),
  );
}

export async function clearPhotoScanSessionSnapshot(): Promise<void> {
  await AsyncStorage.removeItem(PHOTO_SCAN_SESSION_KEY);
}

export async function clearPersistentScanCache(): Promise<void> {
  await Promise.all([
    AsyncStorage.removeItem(PHOTO_SCAN_RESULT_CACHE_KEY),
    AsyncStorage.removeItem(PHOTO_SCAN_SESSION_KEY),
    AsyncStorage.removeItem(FALSE_POSITIVE_CANDIDATE_IDS_KEY),
    AsyncStorage.removeItem(LAST_SCAN_KEY),
    AsyncStorage.removeItem(LAST_VALID_SCAN_BASELINE_KEY),
    AsyncStorage.removeItem(MEDIA_ANALYSIS_CACHE_KEY),
    AsyncStorage.removeItem(PERSISTED_MEDIA_LEDGER_KEY),
    AsyncStorage.removeItem(RECYCLE_BIN_CANDIDATE_CACHE_KEY),
  ]);

  await withOperationalStoreFallback(
    () => clearOperationalPersistentScanCache(),
    async () => undefined,
  );
}

export async function loadPersistentScanCacheSizeBytes(): Promise<number> {
  const removableAsyncStorageValues = await Promise.all([
    AsyncStorage.getItem(PHOTO_SCAN_RESULT_CACHE_KEY),
    AsyncStorage.getItem(PHOTO_SCAN_SESSION_KEY),
    AsyncStorage.getItem(FALSE_POSITIVE_CANDIDATE_IDS_KEY),
    AsyncStorage.getItem(LAST_SCAN_KEY),
    AsyncStorage.getItem(LAST_VALID_SCAN_BASELINE_KEY),
    AsyncStorage.getItem(MEDIA_ANALYSIS_CACHE_KEY),
    AsyncStorage.getItem(PERSISTED_MEDIA_LEDGER_KEY),
    AsyncStorage.getItem(RECYCLE_BIN_CANDIDATE_CACHE_KEY),
  ]);

  const asyncStorageBytes = removableAsyncStorageValues.reduce(
    (total, value) => total + (value ? getUtf8ByteLength(value) : 0),
    0,
  );

  const operationalStoreBytes = await withOperationalStoreFallback(
    () => estimateOperationalPersistentScanCacheSizeBytes(),
    async () => 0,
  );

  return asyncStorageBytes + operationalStoreBytes;
}

export async function loadMediaAnalysisCache(): Promise<MediaAnalysisCache> {
  return withOperationalStoreFallback(
    async () => normalizeMediaAnalysisCache(await loadOperationalMediaAnalysisCache()),
    () => loadLegacyMediaAnalysisCacheFromAsyncStorage(),
  );
}

export async function saveMediaAnalysisCache(cache: MediaAnalysisCache): Promise<void> {
  await withOperationalStoreFallback(
    () => saveOperationalMediaAnalysisCache(normalizeMediaAnalysisCache(cache)),
    () => saveLegacyMediaAnalysisCacheToAsyncStorage(cache),
  );
}

export async function loadPersistedMediaLedger(): Promise<PersistedMediaRecord[]> {
  return withOperationalStoreFallback(
    async () => normalizePersistedMediaLedger(await loadOperationalPersistedMediaLedger()),
    () => loadLegacyPersistedMediaLedgerFromAsyncStorage(),
  );
}

export async function savePersistedMediaLedger(
  records: PersistedMediaRecord[],
): Promise<void> {
  await withOperationalStoreFallback(
    () => saveOperationalPersistedMediaLedger(normalizePersistedMediaLedger(records)),
    () => saveLegacyPersistedMediaLedgerToAsyncStorage(records),
  );
}

export async function loadUserDecisions(): Promise<UserDecisionRecord[]> {
  return withOperationalStoreFallback(
    () => loadOperationalUserDecisions(),
    async () => [],
  );
}

export async function syncPersistedMediaLedger(options: {
  activeCandidates?: readonly CleanupCandidate[];
  recycleBinCandidates?: readonly CleanupCandidate[];
  keptIds?: readonly string[];
  restoredIds?: readonly string[];
  deletedIds?: readonly string[];
  errorById?: Readonly<Record<string, string>>;
  updatedAt?: number;
}): Promise<PersistedMediaRecord[]> {
  const [
    existingRecords,
    analysisCache,
  ] = await Promise.all([
    loadPersistedMediaLedger(),
    loadMediaAnalysisCache(),
  ]);
  const updatedAt = options.updatedAt ?? Date.now();
  const recordsById = new Map(existingRecords.map((record) => [record.assetId, record]));
  const decisionsByAssetId = new Map<string, OperationalUserDecisionRecord>();
  const activeCandidateByIdentifier = new Map<string, CleanupCandidate>();

  for (const candidate of options.activeCandidates ?? []) {
    activeCandidateByIdentifier.set(candidate.id, candidate);
    activeCandidateByIdentifier.set(candidate.asset.id, candidate);
  }

  for (const candidate of options.activeCandidates ?? []) {
    const analysisEntry = analysisCache[candidate.id] ?? analysisCache[candidate.asset.id];
    const previous = recordsById.get(candidate.id);
    upsertPersistedMediaRecord(
      recordsById,
      buildPersistedMediaRecordFromCandidate(
        candidate,
        0,
        updatedAt,
        analysisEntry,
        previous,
      ),
    );
  }

  for (const candidate of options.recycleBinCandidates ?? []) {
    const analysisEntry = analysisCache[candidate.id] ?? analysisCache[candidate.asset.id];
    const previous = recordsById.get(candidate.id);
    if (previous?.status !== -2) {
      addUserDecision(
        decisionsByAssetId,
        buildUserDecisionRecord({
          assetId: candidate.asset.id,
          candidateId: candidate.id,
          decision: 'recycled',
          reason: 'move-to-recycle-bin',
          updatedAt,
          candidate,
        }),
      );
    }
    upsertPersistedMediaRecord(
      recordsById,
      buildPersistedMediaRecordFromCandidate(
        candidate,
        -2,
        updatedAt,
        analysisEntry,
        previous,
      ),
    );
  }

  for (const restoredId of normalizeIds(options.restoredIds ?? [])) {
    const candidate = activeCandidateByIdentifier.get(restoredId);
    const previous = recordsById.get(candidate?.id ?? restoredId);
    const restoredCandidate = candidate ?? previous?.candidate;
    addUserDecision(
      decisionsByAssetId,
      buildUserDecisionRecord({
        assetId: restoredCandidate?.asset.id ?? previous?.candidate?.asset.id ?? restoredId,
        candidateId: restoredCandidate?.id ?? restoredId,
        decision: 'restored',
        reason: 'restore-from-recycle-bin',
        updatedAt,
        candidate: restoredCandidate,
      }),
    );

    if (restoredCandidate) {
      const analysisEntry =
        analysisCache[restoredCandidate.id] ?? analysisCache[restoredCandidate.asset.id];
      upsertPersistedMediaRecord(
        recordsById,
        buildPersistedMediaRecordFromCandidate(
          restoredCandidate,
          0,
          updatedAt,
          analysisEntry,
          previous,
        ),
      );
    } else {
      upsertPersistedMediaRecord(recordsById, {
        assetId: restoredId,
        stableHash: previous?.stableHash ?? buildPersistedMediaStableHash(restoredId),
        status: 0,
        linkIds: previous?.linkIds ?? [],
        updatedAt,
        lastError: null,
      });
    }
  }

  for (const keptId of options.keptIds ?? []) {
    const previous = recordsById.get(keptId);
    addUserDecision(
      decisionsByAssetId,
      buildUserDecisionRecord({
        assetId: previous?.candidate?.asset.id ?? keptId,
        candidateId: keptId,
        decision: 'kept',
        reason: 'marked-false-positive',
        updatedAt,
        candidate: previous?.candidate,
      }),
    );
    upsertPersistedMediaRecord(recordsById, {
      assetId: keptId,
      stableHash: previous?.stableHash ?? buildPersistedMediaStableHash(keptId),
      status: 1,
      linkIds: previous?.linkIds ?? [],
      updatedAt,
      lastError: null,
      ...(previous?.candidate ? { candidate: previous.candidate } : {}),
    });
  }

  for (const [assetId, errorMessage] of Object.entries(options.errorById ?? {})) {
    const previous = recordsById.get(assetId);
    addUserDecision(
      decisionsByAssetId,
      buildUserDecisionRecord({
        assetId: previous?.candidate?.asset.id ?? assetId,
        candidateId: assetId,
        decision: 'failed',
        reason: errorMessage,
        updatedAt,
        candidate: previous?.candidate,
      }),
    );
    upsertPersistedMediaRecord(recordsById, {
      assetId,
      stableHash: previous?.stableHash ?? buildPersistedMediaStableHash(assetId),
      status: -1,
      linkIds: previous?.linkIds ?? [],
      updatedAt,
      lastError: errorMessage,
      ...(previous?.candidate ? { candidate: previous.candidate } : {}),
    });
  }

  const deletedOperationalIds = new Set<string>();
  const normalizedDeletedIds = normalizeIds(options.deletedIds ?? []);
  let deletedBytes = 0;

  for (const deletedId of normalizedDeletedIds) {
    deletedOperationalIds.add(deletedId);
    const previous = recordsById.get(deletedId);
    addUserDecision(
      decisionsByAssetId,
      buildUserDecisionRecord({
        assetId: previous?.candidate?.asset.id ?? deletedId,
        candidateId: deletedId,
        decision: 'deleted',
        reason: 'hard-delete',
        updatedAt,
        candidate: previous?.candidate,
      }),
    );
    if (previous?.candidate?.asset.id) {
      deletedOperationalIds.add(previous.candidate.asset.id);
    }
    deletedBytes += previous?.candidate?.asset.fileSize ?? 0;
    recordsById.delete(deletedId);
  }

  if (normalizedDeletedIds.length > 0) {
    await recordCleanupReportDelta({
      cleanedItemCount: normalizedDeletedIds.length,
      cleanedBytes: deletedBytes,
      cleanedAt: updatedAt,
    });
  }

  if (deletedOperationalIds.size > 0) {
    for (const [assetId, record] of recordsById.entries()) {
      const nextLinkIds = record.linkIds.filter((linkId) => !deletedOperationalIds.has(linkId));
      if (nextLinkIds.length === record.linkIds.length) {
        continue;
      }

      recordsById.set(assetId, {
        ...record,
        linkIds: nextLinkIds,
      });
    }
  }

  const nextRecords = Array.from(recordsById.values()).sort(
    (left, right) => right.updatedAt - left.updatedAt || left.assetId.localeCompare(right.assetId),
  );
  await savePersistedMediaLedger(nextRecords);

  const userDecisions = Array.from(decisionsByAssetId.values());
  if (userDecisions.length > 0) {
    await withOperationalStoreFallback(
      () => recordOperationalUserDecisions(userDecisions),
      async () => undefined,
    );
  }

  if ((options.deletedIds?.length ?? 0) > 0) {
    try {
      await deleteOperationalAssetRecords(Array.from(deletedOperationalIds));
    } catch {
      // Ignore SQLite eviction failures so legacy fallback callers keep working.
    }
  }

  return nextRecords;
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
