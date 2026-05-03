import type { SQLiteDatabase } from 'expo-sqlite';

import type {
  LastValidScanBaseline,
  CleanupReportDelta,
  CleanupReportSnapshot,
  MediaAnalysisCache,
  MediaAnalysisCacheEntry,
  PersistedMediaRecord,
  PhotoScanResultCache,
} from '../app-storage';
import {
  OPERATIONAL_STORE_SCHEMA_VERSION,
  OPERATIONAL_STORE_TABLE_STATEMENTS,
} from './schema';

const OPERATIONAL_STORE_DATABASE_NAME = 'app-cleaner-operational.db';
const LEGACY_IMPORT_META_KEY = 'legacy_asyncstorage_import_v1';
const SCHEMA_VERSION_META_KEY = 'schema_version';
const LINK_RELATION_TYPE = 'candidate-link';

type SqlExecutor = Pick<
  SQLiteDatabase,
  'execAsync' | 'getAllAsync' | 'getFirstAsync' | 'runAsync'
>;

export interface ActiveScanJobCheckpoint {
  jobId: string;
  phase: 'running' | 'failed' | 'cancelled';
  progressCurrent: number;
  progressTotal: number;
  processedCount: number;
  candidateCount: number;
  startedAt: number;
  lastHeartbeatAt: number;
  currentFileName: string | null;
  lastProcessedAssetId: string | null;
  lastError: string | null;
  updatedAt: number;
}

export type OperationalScanBatchMode = 'full' | 'rolling-window' | 'repair' | 'backfill';
export type OperationalScanBatchPhase =
  | 'queued'
  | 'enumeration'
  | 'analysis'
  | 'aggregation'
  | 'completed'
  | 'failed'
  | 'cancelled';
export type OperationalScanBatchItemStage =
  | 'queued'
  | 'analyzing'
  | 'aggregating'
  | 'completed'
  | 'failed'
  | 'skipped';
export type OperationalAssetMediaType = 'photo' | 'video' | 'unknown';

export interface OperationalScanBatchRecord {
  batchId: string;
  mode: OperationalScanBatchMode;
  windowDays: number | null;
  rangeStartAt: number | null;
  rangeEndAt: number | null;
  phase: OperationalScanBatchPhase;
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

export interface OperationalScanBatchItemRecord {
  batchId: string;
  assetId: string;
  mediaType: OperationalAssetMediaType;
  stage: OperationalScanBatchItemStage;
  dirtyReason: string | null;
  attemptCount: number;
  workerSlot: string | null;
  lastHeartbeatAt: number | null;
  lastError: string | null;
  updatedAt: number;
}

export interface OperationalAssetManifestRecord {
  assetId: string;
  contentUri: string;
  mediaType: OperationalAssetMediaType;
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
  dirtyReason: string | null;
  updatedAt: number;
}

export type OperationalRecognitionGroupRelation = 'exact' | 'near';
export type OperationalRecognitionRepresentativeReason =
  | 'higher-resolution'
  | 'larger-file'
  | 'newer-capture';

export interface OperationalRecognitionGroupRecord {
  groupId: string;
  relation: OperationalRecognitionGroupRelation;
  size: number;
  similarity: number;
  representativeAssetId: string;
  representativeReason: OperationalRecognitionRepresentativeReason;
  representativeWidth: number;
  representativeHeight: number;
  representativeFileSize: number;
  representativeCreationTime: number;
  memberAssetIds: string[];
  updatedAt: number;
}

export type OperationalUserDecisionType =
  | 'kept'
  | 'recycled'
  | 'restored'
  | 'deleted'
  | 'failed';

export interface OperationalUserDecisionRecord {
  assetId: string;
  candidateId: string | null;
  decision: OperationalUserDecisionType;
  source: 'manual' | 'system';
  reason: string | null;
  decidedAt: number;
  updatedAt: number;
  snapshotJson: string | null;
}

interface OperationalStoreAdapter {
  ensureReady(): Promise<void>;
  hasLegacyImportCompleted(): Promise<boolean>;
  markLegacyImportCompleted(): Promise<void>;
  loadMediaAnalysisCache(): Promise<MediaAnalysisCache>;
  saveMediaAnalysisCache(cache: MediaAnalysisCache): Promise<void>;
  loadPersistedMediaLedger(): Promise<PersistedMediaRecord[]>;
  savePersistedMediaLedger(records: PersistedMediaRecord[]): Promise<void>;
  loadLastValidScanBaseline(): Promise<LastValidScanBaseline | null>;
  saveLastValidScanBaseline(baseline: LastValidScanBaseline): Promise<void>;
  clearPersistentScanCache(): Promise<void>;
  loadPhotoScanResultCache(): Promise<PhotoScanResultCache | null>;
  savePhotoScanResultCache(cache: PhotoScanResultCache): Promise<void>;
  clearPhotoScanResultCache(): Promise<void>;
  loadRecognitionGroups(): Promise<OperationalRecognitionGroupRecord[]>;
  loadUserDecisions(): Promise<OperationalUserDecisionRecord[]>;
  recordUserDecisions(decisions: OperationalUserDecisionRecord[]): Promise<void>;
  loadRecycleBinIds(): Promise<string[]>;
  saveRecycleBinIds(ids: string[]): Promise<void>;
  loadCleanupReportSnapshot(): Promise<CleanupReportSnapshot>;
  recordCleanupReportDelta(delta: CleanupReportDelta): Promise<CleanupReportSnapshot>;
  deleteAssetRecords(assetIds: readonly string[]): Promise<void>;
  loadActiveScanJob(): Promise<ActiveScanJobCheckpoint | null>;
  saveActiveScanJob(checkpoint: ActiveScanJobCheckpoint): Promise<void>;
  clearActiveScanJob(): Promise<void>;
  loadLatestScanBatch(): Promise<OperationalScanBatchRecord | null>;
  loadLatestCompletedScanBatch(): Promise<OperationalScanBatchRecord | null>;
  loadScanBatch(batchId: string): Promise<OperationalScanBatchRecord | null>;
  saveScanBatch(batch: OperationalScanBatchRecord): Promise<void>;
  loadScanBatchItems(batchId: string): Promise<OperationalScanBatchItemRecord[]>;
  saveScanBatchItems(
    batchId: string,
    items: OperationalScanBatchItemRecord[],
  ): Promise<void>;
  loadAssetManifestEntries(
    assetIds?: readonly string[],
  ): Promise<OperationalAssetManifestRecord[]>;
  upsertAssetManifestEntries(entries: OperationalAssetManifestRecord[]): Promise<void>;
}

interface LedgerRow {
  asset_id: string;
  stable_hash: string;
  status: number;
  last_error: string | null;
  updated_at: number;
  snapshot_json: string | null;
}

interface LinkRow {
  asset_id: string;
  linked_asset_id: string;
}

interface AnalysisRow {
  asset_id: string;
  signature: string;
  preview_uri: string;
  fingerprint: string | null;
  difference_hash: string | null;
  content_hash: string | null;
  frame_fingerprints_json: string;
  metrics_json: string;
  status: 'ok' | 'fallback';
}

interface BaselineRow {
  scanned_at: number;
  scanned_count: number;
  candidate_count: number;
  scan_range_months: number;
  latest_eligible_asset_at: number | null;
  ledger_updated_at: number;
}

interface RecycleBinRow {
  asset_id: string;
}

interface CleanupReportRow {
  cleaned_item_count: number;
  cleaned_bytes: number;
  last_cleaned_at: number | null;
  updated_at: number;
}

interface MetaRow {
  value: string;
}

interface ScanJobRow {
  job_id: string;
  phase: 'running' | 'failed' | 'cancelled';
  progress_current: number;
  progress_total: number;
  processed_count: number;
  candidate_count: number;
  started_at: number;
  last_heartbeat_at: number;
  current_file_name: string | null;
  last_processed_asset_id: string | null;
  last_error: string | null;
  updated_at: number;
}

interface ScanBatchRow {
  batch_id: string;
  mode: OperationalScanBatchMode;
  window_days: number | null;
  range_start_at: number | null;
  range_end_at: number | null;
  phase: OperationalScanBatchPhase;
  progress_current: number;
  progress_total: number;
  enumerated_count: number;
  dirty_count: number;
  analyzed_count: number;
  candidate_count: number;
  started_at: number;
  last_heartbeat_at: number;
  completed_at: number | null;
  last_error: string | null;
  updated_at: number;
}

interface ScanBatchItemRow {
  batch_id: string;
  asset_id: string;
  media_type: OperationalAssetMediaType;
  stage: OperationalScanBatchItemStage;
  dirty_reason: string | null;
  attempt_count: number;
  worker_slot: string | null;
  last_heartbeat_at: number | null;
  last_error: string | null;
  updated_at: number;
}

interface AssetManifestRow {
  asset_id: string;
  content_uri: string;
  media_type: OperationalAssetMediaType;
  mime_type: string | null;
  width: number;
  height: number;
  orientation: number | null;
  aspect_ratio: number | null;
  duration_ms: number;
  file_size_bytes: number | null;
  date_taken: number | null;
  date_modified: number | null;
  bucket_id: string | null;
  bucket_name: string | null;
  is_screenshot: number | null;
  bitrate: number | null;
  frame_rate: number | null;
  codec: string | null;
  first_seen_at: number;
  last_seen_at: number;
  is_deleted: number;
  dirty_reason: string | null;
  updated_at: number;
}

interface CandidateViewRow {
  asset_id: string;
  rank: number;
  candidate_json: string;
}

interface CandidateViewMetaRow {
  summary_json: string;
}

interface RecognitionGroupRow {
  group_id: string;
  relation: OperationalRecognitionGroupRelation;
  size: number;
  similarity: number;
  representative_asset_id: string;
  representative_reason: OperationalRecognitionRepresentativeReason;
  representative_width: number;
  representative_height: number;
  representative_file_size: number;
  representative_creation_time: number;
  updated_at: number;
}

interface RecognitionMemberRow {
  group_id: string;
  asset_id: string;
}

interface UserDecisionRow {
  asset_id: string;
  candidate_id: string | null;
  decision: OperationalUserDecisionType;
  source: 'manual' | 'system';
  reason: string | null;
  decided_at: number;
  updated_at: number;
  snapshot_json: string | null;
}

function normalizeCleanupReportSnapshot(row: CleanupReportRow | null): CleanupReportSnapshot {
  if (!row) {
    return {
      cleanedItemCount: 0,
      cleanedBytes: 0,
      lastCleanedAt: null,
    };
  }

  return {
    cleanedItemCount: row.cleaned_item_count,
    cleanedBytes: row.cleaned_bytes,
    lastCleanedAt: row.last_cleaned_at ?? null,
  };
}

function normalizeIds(ids: readonly string[]) {
  return Array.from(new Set(ids)).sort();
}

function parseJsonValue<T>(value: string | null): T | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function buildRecognitionGroupsFromCandidates(
  candidates: readonly PhotoScanResultCache['activeCandidates'][number][],
  updatedAt: number,
) {
  const groups = new Map<
    string,
    Omit<OperationalRecognitionGroupRecord, 'memberAssetIds'> & {
      members: Map<string, { candidateId: string; role: 'representative' | 'member' }>;
    }
  >();

  for (const candidate of candidates) {
    const duplicateGroup = candidate.duplicateGroup;
    if (!duplicateGroup) {
      continue;
    }

    const existing = groups.get(duplicateGroup.groupId);
    const group =
      existing ??
      {
        groupId: duplicateGroup.groupId,
        relation: duplicateGroup.relation,
        size: duplicateGroup.size,
        similarity: duplicateGroup.similarity,
        representativeAssetId: duplicateGroup.representativeId,
        representativeReason: duplicateGroup.representativeReason,
        representativeWidth: duplicateGroup.representativeWidth,
        representativeHeight: duplicateGroup.representativeHeight,
        representativeFileSize: duplicateGroup.representativeFileSize,
        representativeCreationTime: duplicateGroup.representativeCreationTime,
        updatedAt,
        members: new Map<string, { candidateId: string; role: 'representative' | 'member' }>(),
      };

    const assetId = candidate.asset.id;
    group.members.set(assetId, {
      candidateId: candidate.id,
      role:
        duplicateGroup.representativeId === assetId ||
        duplicateGroup.representativeId === candidate.id
          ? 'representative'
          : 'member',
    });
    groups.set(duplicateGroup.groupId, group);
  }

  return Array.from(groups.values());
}

function createPlaceholderList(ids: readonly string[]) {
  return ids.map(() => '?').join(', ');
}

function normalizeScanBatchRecord(row: ScanBatchRow): OperationalScanBatchRecord {
  return {
    batchId: row.batch_id,
    mode: row.mode,
    windowDays: row.window_days ?? null,
    rangeStartAt: row.range_start_at ?? null,
    rangeEndAt: row.range_end_at ?? null,
    phase: row.phase,
    progressCurrent: row.progress_current,
    progressTotal: row.progress_total,
    enumeratedCount: row.enumerated_count,
    dirtyCount: row.dirty_count,
    analyzedCount: row.analyzed_count,
    candidateCount: row.candidate_count,
    startedAt: row.started_at,
    lastHeartbeatAt: row.last_heartbeat_at,
    completedAt: row.completed_at ?? null,
    lastError: row.last_error ?? null,
    updatedAt: row.updated_at,
  };
}

function normalizeScanBatchItemRecord(row: ScanBatchItemRow): OperationalScanBatchItemRecord {
  return {
    batchId: row.batch_id,
    assetId: row.asset_id,
    mediaType: row.media_type,
    stage: row.stage,
    dirtyReason: row.dirty_reason ?? null,
    attemptCount: row.attempt_count,
    workerSlot: row.worker_slot ?? null,
    lastHeartbeatAt: row.last_heartbeat_at ?? null,
    lastError: row.last_error ?? null,
    updatedAt: row.updated_at,
  };
}

function normalizeAssetManifestRecord(row: AssetManifestRow): OperationalAssetManifestRecord {
  return {
    assetId: row.asset_id,
    contentUri: row.content_uri,
    mediaType: row.media_type,
    mimeType: row.mime_type ?? null,
    width: row.width,
    height: row.height,
    orientation: row.orientation ?? null,
    aspectRatio: row.aspect_ratio ?? null,
    durationMs: row.duration_ms,
    fileSizeBytes: row.file_size_bytes ?? null,
    dateTaken: row.date_taken ?? null,
    dateModified: row.date_modified ?? null,
    bucketId: row.bucket_id ?? null,
    bucketName: row.bucket_name ?? null,
    isScreenshot:
      row.is_screenshot === null || row.is_screenshot === undefined
        ? null
        : row.is_screenshot === 1,
    bitrate: row.bitrate ?? null,
    frameRate: row.frame_rate ?? null,
    codec: row.codec ?? null,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
    isDeleted: row.is_deleted === 1,
    dirtyReason: row.dirty_reason ?? null,
    updatedAt: row.updated_at,
  };
}

async function upsertMeta(executor: SqlExecutor, key: string, value: string) {
  await executor.runAsync(
    `
      INSERT INTO app_meta (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = excluded.updated_at
    `,
    key,
    value,
    Date.now(),
  );
}

async function readMeta(executor: SqlExecutor, key: string) {
  const row = await executor.getFirstAsync<MetaRow>(
    'SELECT value FROM app_meta WHERE key = ? LIMIT 1',
    key,
  );
  return row?.value ?? null;
}

function getSqliteErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function isMissingLastProcessedAssetIdColumnError(error: unknown) {
  const message = getSqliteErrorMessage(error).toLowerCase();
  return (
    message.includes('last_processed_asset_id') &&
    (message.includes('no such column') || message.includes('has no column named'))
  );
}

function isDuplicateLastProcessedAssetIdColumnError(error: unknown) {
  const message = getSqliteErrorMessage(error).toLowerCase();
  return (
    message.includes('last_processed_asset_id') &&
    message.includes('duplicate column name')
  );
}

async function ensureScanJobSchema(database: SQLiteDatabase) {
  try {
    await database.getFirstAsync(
      'SELECT last_processed_asset_id FROM scan_job LIMIT 1',
    );
    return;
  } catch (error) {
    if (!isMissingLastProcessedAssetIdColumnError(error)) {
      throw error;
    }
  }

  try {
    await database.execAsync(
      'ALTER TABLE scan_job ADD COLUMN last_processed_asset_id TEXT',
    );
  } catch (error) {
    if (!isDuplicateLastProcessedAssetIdColumnError(error)) {
      throw error;
    }
  }
}

async function savePersistedMediaLedgerWithExecutor(
  executor: SqlExecutor,
  records: PersistedMediaRecord[],
) {
  await executor.runAsync('DELETE FROM media_links');
  await executor.runAsync('DELETE FROM media_ledger');

  for (const record of records) {
    await executor.runAsync(
      `
        INSERT INTO media_ledger (
          asset_id,
          stable_hash,
          status,
          last_error,
          updated_at,
          snapshot_json
        ) VALUES (?, ?, ?, ?, ?, ?)
      `,
      record.assetId,
      record.stableHash,
      record.status,
      record.lastError,
      record.updatedAt,
      record.candidate ? JSON.stringify(record.candidate) : null,
    );

    for (const linkedAssetId of normalizeIds(record.linkIds)) {
      await executor.runAsync(
        `
          INSERT INTO media_links (
            asset_id,
            linked_asset_id,
            relation_type,
            updated_at
          ) VALUES (?, ?, ?, ?)
        `,
        record.assetId,
        linkedAssetId,
        LINK_RELATION_TYPE,
        record.updatedAt,
      );
    }
  }
}

async function saveMediaAnalysisCacheWithExecutor(
  executor: SqlExecutor,
  cache: MediaAnalysisCache,
) {
  await executor.runAsync('DELETE FROM media_analysis');

  for (const entry of Object.values(cache)) {
    await executor.runAsync(
      `
        INSERT INTO media_analysis (
          asset_id,
          signature,
          preview_uri,
          fingerprint,
          difference_hash,
          content_hash,
          frame_fingerprints_json,
          metrics_json,
          status,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      entry.assetId,
      entry.signature,
      entry.previewUri,
      entry.fingerprint,
      entry.differenceHash ?? null,
      entry.contentHash ?? null,
      JSON.stringify(entry.frameFingerprints ?? []),
      JSON.stringify(entry.metrics),
      entry.status,
      Date.now(),
    );
  }
}

async function saveRecycleBinIdsWithExecutor(executor: SqlExecutor, ids: readonly string[]) {
  const normalizedIds = normalizeIds(ids);
  const updatedAt = Date.now();

  await executor.runAsync('DELETE FROM recycle_bin_state');

  for (const assetId of normalizedIds) {
    await executor.runAsync(
      `
        INSERT INTO recycle_bin_state (
          asset_id,
          recycled_at,
          expires_at,
          source,
          updated_at
        ) VALUES (?, ?, ?, ?, ?)
      `,
      assetId,
      updatedAt,
      null,
      'manual',
      updatedAt,
    );
  }
}

async function saveScanBatchWithExecutor(
  executor: SqlExecutor,
  batch: OperationalScanBatchRecord,
) {
  await executor.runAsync(
    `
      INSERT INTO scan_batch (
        batch_id,
        mode,
        window_days,
        range_start_at,
        range_end_at,
        phase,
        progress_current,
        progress_total,
        enumerated_count,
        dirty_count,
        analyzed_count,
        candidate_count,
        started_at,
        last_heartbeat_at,
        completed_at,
        last_error,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(batch_id) DO UPDATE SET
        mode = excluded.mode,
        window_days = excluded.window_days,
        range_start_at = excluded.range_start_at,
        range_end_at = excluded.range_end_at,
        phase = excluded.phase,
        progress_current = excluded.progress_current,
        progress_total = excluded.progress_total,
        enumerated_count = excluded.enumerated_count,
        dirty_count = excluded.dirty_count,
        analyzed_count = excluded.analyzed_count,
        candidate_count = excluded.candidate_count,
        started_at = excluded.started_at,
        last_heartbeat_at = excluded.last_heartbeat_at,
        completed_at = excluded.completed_at,
        last_error = excluded.last_error,
        updated_at = excluded.updated_at
    `,
    batch.batchId,
    batch.mode,
    batch.windowDays,
    batch.rangeStartAt,
    batch.rangeEndAt,
    batch.phase,
    batch.progressCurrent,
    batch.progressTotal,
    batch.enumeratedCount,
    batch.dirtyCount,
    batch.analyzedCount,
    batch.candidateCount,
    batch.startedAt,
    batch.lastHeartbeatAt,
    batch.completedAt,
    batch.lastError,
    batch.updatedAt,
  );
}

async function saveScanBatchItemsWithExecutor(
  executor: SqlExecutor,
  batchId: string,
  items: OperationalScanBatchItemRecord[],
) {
  await executor.runAsync('DELETE FROM scan_batch_item WHERE batch_id = ?', batchId);

  for (const item of items) {
    await executor.runAsync(
      `
        INSERT INTO scan_batch_item (
          batch_id,
          asset_id,
          media_type,
          stage,
          dirty_reason,
          attempt_count,
          worker_slot,
          last_heartbeat_at,
          last_error,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      batchId,
      item.assetId,
      item.mediaType,
      item.stage,
      item.dirtyReason,
      item.attemptCount,
      item.workerSlot,
      item.lastHeartbeatAt,
      item.lastError,
      item.updatedAt,
    );
  }
}

async function upsertAssetManifestEntriesWithExecutor(
  executor: SqlExecutor,
  entries: OperationalAssetManifestRecord[],
) {
  for (const entry of entries) {
    await executor.runAsync(
      `
        INSERT INTO asset_manifest (
          asset_id,
          content_uri,
          media_type,
          mime_type,
          width,
          height,
          orientation,
          aspect_ratio,
          duration_ms,
          file_size_bytes,
          date_taken,
          date_modified,
          bucket_id,
          bucket_name,
          is_screenshot,
          bitrate,
          frame_rate,
          codec,
          first_seen_at,
          last_seen_at,
          is_deleted,
          dirty_reason,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(asset_id) DO UPDATE SET
          content_uri = excluded.content_uri,
          media_type = excluded.media_type,
          mime_type = excluded.mime_type,
          width = excluded.width,
          height = excluded.height,
          orientation = excluded.orientation,
          aspect_ratio = excluded.aspect_ratio,
          duration_ms = excluded.duration_ms,
          file_size_bytes = excluded.file_size_bytes,
          date_taken = excluded.date_taken,
          date_modified = excluded.date_modified,
          bucket_id = excluded.bucket_id,
          bucket_name = excluded.bucket_name,
          is_screenshot = excluded.is_screenshot,
          bitrate = excluded.bitrate,
          frame_rate = excluded.frame_rate,
          codec = excluded.codec,
          first_seen_at = CASE
            WHEN excluded.first_seen_at < asset_manifest.first_seen_at
              THEN excluded.first_seen_at
            ELSE asset_manifest.first_seen_at
          END,
          last_seen_at = CASE
            WHEN excluded.last_seen_at > asset_manifest.last_seen_at
              THEN excluded.last_seen_at
            ELSE asset_manifest.last_seen_at
          END,
          is_deleted = excluded.is_deleted,
          dirty_reason = excluded.dirty_reason,
          updated_at = excluded.updated_at
      `,
      entry.assetId,
      entry.contentUri,
      entry.mediaType,
      entry.mimeType,
      entry.width,
      entry.height,
      entry.orientation,
      entry.aspectRatio,
      entry.durationMs,
      entry.fileSizeBytes,
      entry.dateTaken,
      entry.dateModified,
      entry.bucketId,
      entry.bucketName,
      entry.isScreenshot === null ? null : entry.isScreenshot ? 1 : 0,
      entry.bitrate,
      entry.frameRate,
      entry.codec,
      entry.firstSeenAt,
      entry.lastSeenAt,
      entry.isDeleted ? 1 : 0,
      entry.dirtyReason,
      entry.updatedAt,
    );
  }
}

async function savePhotoScanResultCacheWithExecutor(
  executor: SqlExecutor,
  cache: PhotoScanResultCache,
) {
  const updatedAt = cache.summary.scannedAt;

  await executor.runAsync('DELETE FROM candidate_view');
  await executor.runAsync('DELETE FROM candidate_view_meta');
  await executor.runAsync(
    `
      INSERT INTO candidate_view_meta (
        id,
        summary_json,
        updated_at
      ) VALUES (?, ?, ?)
    `,
    1,
    JSON.stringify(cache.summary),
    updatedAt,
  );

  for (const [index, candidate] of cache.activeCandidates.entries()) {
    await executor.runAsync(
      `
        INSERT INTO candidate_view (
          asset_id,
          batch_id,
          rank,
          score,
          confidence,
          primary_issue_type,
          candidate_json,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      candidate.asset.id,
      null,
      index,
      candidate.score,
      candidate.confidence,
      candidate.primaryIssueType,
      JSON.stringify(candidate),
      updatedAt,
    );
  }

  await saveRecognitionGroupsWithExecutor(
    executor,
    buildRecognitionGroupsFromCandidates(cache.activeCandidates, updatedAt),
  );
}

async function saveRecognitionGroupsWithExecutor(
  executor: SqlExecutor,
  groups: ReturnType<typeof buildRecognitionGroupsFromCandidates>,
) {
  await executor.runAsync('DELETE FROM recognition_member');
  await executor.runAsync('DELETE FROM recognition_group');

  for (const group of groups) {
    await executor.runAsync(
      `
        INSERT INTO recognition_group (
          group_id,
          relation,
          size,
          similarity,
          representative_asset_id,
          representative_reason,
          representative_width,
          representative_height,
          representative_file_size,
          representative_creation_time,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      group.groupId,
      group.relation,
      group.size,
      group.similarity,
      group.representativeAssetId,
      group.representativeReason,
      group.representativeWidth,
      group.representativeHeight,
      group.representativeFileSize,
      group.representativeCreationTime,
      group.updatedAt,
    );

    for (const [assetId, member] of group.members.entries()) {
      await executor.runAsync(
        `
          INSERT INTO recognition_member (
            group_id,
            asset_id,
            candidate_id,
            role,
            updated_at
          ) VALUES (?, ?, ?, ?, ?)
        `,
        group.groupId,
        assetId,
        member.candidateId,
        member.role,
        group.updatedAt,
      );
    }
  }
}

async function recordUserDecisionsWithExecutor(
  executor: SqlExecutor,
  decisions: readonly OperationalUserDecisionRecord[],
) {
  for (const decision of decisions) {
    await executor.runAsync(
      `
        INSERT INTO user_decision (
          asset_id,
          candidate_id,
          decision,
          source,
          reason,
          decided_at,
          updated_at,
          snapshot_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(asset_id) DO UPDATE SET
          candidate_id = excluded.candidate_id,
          decision = excluded.decision,
          source = excluded.source,
          reason = excluded.reason,
          decided_at = excluded.decided_at,
          updated_at = excluded.updated_at,
          snapshot_json = excluded.snapshot_json
      `,
      decision.assetId,
      decision.candidateId,
      decision.decision,
      decision.source,
      decision.reason,
      decision.decidedAt,
      decision.updatedAt,
      decision.snapshotJson,
    );
  }
}

async function loadCleanupReportSnapshotWithExecutor(
  executor: SqlExecutor,
): Promise<CleanupReportSnapshot> {
  const row = await executor.getFirstAsync<CleanupReportRow>(
    `
      SELECT
        cleaned_item_count,
        cleaned_bytes,
        last_cleaned_at,
        updated_at
      FROM cleanup_report
      WHERE id = 1
      LIMIT 1
    `,
  );

  return normalizeCleanupReportSnapshot(row ?? null);
}

async function recordCleanupReportDeltaWithExecutor(
  executor: SqlExecutor,
  delta: CleanupReportDelta,
): Promise<CleanupReportSnapshot> {
  const cleanedItemCountDelta = Math.max(0, Math.trunc(delta.cleanedItemCount));
  const cleanedBytesDelta = Math.max(0, Math.trunc(delta.cleanedBytes));
  const cleanedAt = delta.cleanedAt ?? Date.now();

  if (cleanedItemCountDelta === 0 && cleanedBytesDelta === 0) {
    return loadCleanupReportSnapshotWithExecutor(executor);
  }

  await executor.runAsync(
    `
      INSERT INTO cleanup_report (
        id,
        cleaned_item_count,
        cleaned_bytes,
        last_cleaned_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        cleaned_item_count = cleaned_item_count + excluded.cleaned_item_count,
        cleaned_bytes = cleaned_bytes + excluded.cleaned_bytes,
        last_cleaned_at = excluded.last_cleaned_at,
        updated_at = excluded.updated_at
    `,
    1,
    cleanedItemCountDelta,
    cleanedBytesDelta,
    cleanedAt,
    cleanedAt,
  );

  return loadCleanupReportSnapshotWithExecutor(executor);
}

async function clearPersistentScanCacheWithExecutor(executor: SqlExecutor) {
  await executor.runAsync('DELETE FROM media_links');
  await executor.runAsync('DELETE FROM media_analysis');
  await executor.runAsync('DELETE FROM media_ledger');
  await executor.runAsync('DELETE FROM candidate_view');
  await executor.runAsync('DELETE FROM candidate_view_meta');
  await executor.runAsync('DELETE FROM recognition_member');
  await executor.runAsync('DELETE FROM recognition_group');
  await executor.runAsync('DELETE FROM scan_baseline');
  await executor.runAsync('DELETE FROM asset_manifest');
  await executor.runAsync('DELETE FROM scan_batch_item');
  await executor.runAsync('DELETE FROM scan_batch');
  await executor.runAsync('DELETE FROM scan_job');
}

async function deleteAssetRecordsWithExecutor(
  executor: SqlExecutor,
  assetIds: readonly string[],
) {
  const normalizedIds = normalizeIds(assetIds);
  if (normalizedIds.length === 0) {
    return;
  }

  const placeholders = createPlaceholderList(normalizedIds);
  const deleteSql = `(${placeholders})`;

  await executor.runAsync(
    `DELETE FROM media_links WHERE asset_id IN ${deleteSql} OR linked_asset_id IN ${deleteSql}`,
    ...normalizedIds,
    ...normalizedIds,
  );
  await executor.runAsync(
    `DELETE FROM media_analysis WHERE asset_id IN ${deleteSql}`,
    ...normalizedIds,
  );
  await executor.runAsync(
    `DELETE FROM recycle_bin_state WHERE asset_id IN ${deleteSql}`,
    ...normalizedIds,
  );
  await executor.runAsync(
    `DELETE FROM scan_batch_item WHERE asset_id IN ${deleteSql}`,
    ...normalizedIds,
  );
  await executor.runAsync(
    `DELETE FROM asset_manifest WHERE asset_id IN ${deleteSql}`,
    ...normalizedIds,
  );
  await executor.runAsync(
    `DELETE FROM media_ledger WHERE asset_id IN ${deleteSql}`,
    ...normalizedIds,
  );
  await executor.runAsync(
    `DELETE FROM candidate_view WHERE asset_id IN ${deleteSql}`,
    ...normalizedIds,
  );
  await executor.runAsync(
    `DELETE FROM recognition_member WHERE asset_id IN ${deleteSql} OR candidate_id IN ${deleteSql}`,
    ...normalizedIds,
    ...normalizedIds,
  );
  await executor.runAsync(
    `DELETE FROM recognition_group WHERE representative_asset_id IN ${deleteSql}`,
    ...normalizedIds,
  );
  await executor.runAsync(
    'DELETE FROM recognition_group WHERE group_id NOT IN (SELECT DISTINCT group_id FROM recognition_member)',
  );
}

class SQLiteOperationalStoreAdapter implements OperationalStoreAdapter {
  private databasePromise: Promise<SQLiteDatabase> | null = null;
  private operationQueue: Promise<void> = Promise.resolve();

  private async getDatabase() {
    if (!this.databasePromise) {
      this.databasePromise = import('expo-sqlite').then(({ openDatabaseAsync }) =>
        openDatabaseAsync(OPERATIONAL_STORE_DATABASE_NAME),
      );
    }

    return this.databasePromise;
  }

  private enqueueOperation<T>(operation: () => Promise<T>): Promise<T> {
    const queuedOperation = this.operationQueue
      .catch(() => undefined)
      .then(() => operation());

    this.operationQueue = queuedOperation.then(
      () => undefined,
      () => undefined,
    );

    return queuedOperation;
  }

  private async withDatabase<T>(
    operation: (database: SQLiteDatabase) => Promise<T>,
  ): Promise<T> {
    return this.enqueueOperation(async () => {
      const database = await this.getDatabase();
      return operation(database);
    });
  }

  async ensureReady(): Promise<void> {
    const database = await this.getDatabase();
    await database.execAsync([
      'PRAGMA busy_timeout = 5000;',
      ...OPERATIONAL_STORE_TABLE_STATEMENTS,
    ].join('\n'));
    await ensureScanJobSchema(database);

    const schemaVersion = await readMeta(database, SCHEMA_VERSION_META_KEY);
    if (schemaVersion !== String(OPERATIONAL_STORE_SCHEMA_VERSION)) {
      await upsertMeta(
        database,
        SCHEMA_VERSION_META_KEY,
        String(OPERATIONAL_STORE_SCHEMA_VERSION),
      );
    }
  }

  async hasLegacyImportCompleted() {
    return this.withDatabase(async (database) =>
      (await readMeta(database, LEGACY_IMPORT_META_KEY)) === 'done',
    );
  }

  async markLegacyImportCompleted() {
    await this.withDatabase((database) => upsertMeta(database, LEGACY_IMPORT_META_KEY, 'done'));
  }

  async loadMediaAnalysisCache() {
    return this.withDatabase(async (database) => {
      const rows = await database.getAllAsync<AnalysisRow>(
        `
          SELECT
            asset_id,
            signature,
            preview_uri,
            fingerprint,
            difference_hash,
            content_hash,
            frame_fingerprints_json,
            metrics_json,
            status
          FROM media_analysis
        `,
      );

      return rows.reduce<MediaAnalysisCache>((cache, row) => {
        const metrics = parseJsonValue<MediaAnalysisCacheEntry['metrics']>(row.metrics_json);
        const frameFingerprints =
          parseJsonValue<string[]>(row.frame_fingerprints_json) ?? [];

        if (!metrics) {
          return cache;
        }

        cache[row.asset_id] = {
          assetId: row.asset_id,
          signature: row.signature,
          previewUri: row.preview_uri,
          fingerprint: row.fingerprint,
          differenceHash: row.difference_hash,
          contentHash: row.content_hash,
          frameFingerprints,
          status: row.status,
          metrics,
        };
        return cache;
      }, {});
    });
  }

  async saveMediaAnalysisCache(cache: MediaAnalysisCache) {
    await this.withDatabase(async (database) => {
      await database.withExclusiveTransactionAsync(async (transaction) => {
        await saveMediaAnalysisCacheWithExecutor(transaction, cache);
      });
    });
  }

  async loadPersistedMediaLedger() {
    return this.withDatabase(async (database) => {
      const ledgerRows = await database.getAllAsync<LedgerRow>(
          `
            SELECT
              asset_id,
              stable_hash,
              status,
              last_error,
              updated_at,
              snapshot_json
            FROM media_ledger
            ORDER BY updated_at DESC, asset_id ASC
          `,
        );
      const linkRows = await database.getAllAsync<LinkRow>(
          `
            SELECT asset_id, linked_asset_id
            FROM media_links
            WHERE relation_type = ?
          `,
          LINK_RELATION_TYPE,
        );
      const linksByAssetId = new Map<string, string[]>();

      for (const row of linkRows) {
        const links = linksByAssetId.get(row.asset_id) ?? [];
        links.push(row.linked_asset_id);
        linksByAssetId.set(row.asset_id, links);
      }

      return ledgerRows.map((row) => {
        const candidate = parseJsonValue<PersistedMediaRecord['candidate']>(row.snapshot_json);

        return {
          assetId: row.asset_id,
          stableHash: row.stable_hash,
          status: row.status as PersistedMediaRecord['status'],
          linkIds: normalizeIds(linksByAssetId.get(row.asset_id) ?? []),
          updatedAt: row.updated_at,
          lastError: row.last_error ?? null,
          ...(candidate ? { candidate } : {}),
        };
      });
    });
  }

  async savePersistedMediaLedger(records: PersistedMediaRecord[]) {
    await this.withDatabase(async (database) => {
      await database.withExclusiveTransactionAsync(async (transaction) => {
        await savePersistedMediaLedgerWithExecutor(transaction, records);
      });
    });
  }

  async loadLastValidScanBaseline() {
    return this.withDatabase(async (database) => {
      const row = await database.getFirstAsync<BaselineRow>(
        `
          SELECT
            scanned_at,
            scanned_count,
            candidate_count,
            scan_range_months,
            latest_eligible_asset_at,
            ledger_updated_at
          FROM scan_baseline
          WHERE id = 1
          LIMIT 1
        `,
      );

      if (!row) {
        return null;
      }

      return {
        scannedAt: row.scanned_at,
        scannedCount: row.scanned_count,
        candidateCount: row.candidate_count,
        scanRangeMonths: row.scan_range_months,
        latestEligibleAssetAt: row.latest_eligible_asset_at ?? null,
        ledgerUpdatedAt: row.ledger_updated_at,
      };
    });
  }

  async saveLastValidScanBaseline(baseline: LastValidScanBaseline) {
    await this.withDatabase((database) =>
      database.runAsync(
        `
          INSERT INTO scan_baseline (
            id,
            scanned_at,
            scanned_count,
            candidate_count,
            scan_range_months,
            latest_eligible_asset_at,
            ledger_updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            scanned_at = excluded.scanned_at,
            scanned_count = excluded.scanned_count,
            candidate_count = excluded.candidate_count,
            scan_range_months = excluded.scan_range_months,
            latest_eligible_asset_at = excluded.latest_eligible_asset_at,
            ledger_updated_at = excluded.ledger_updated_at
        `,
        1,
        baseline.scannedAt,
        baseline.scannedCount,
        baseline.candidateCount,
        baseline.scanRangeMonths,
        baseline.latestEligibleAssetAt,
        baseline.ledgerUpdatedAt,
      ),
    );
  }

  async clearPersistentScanCache() {
    await this.withDatabase(async (database) => {
      await database.withExclusiveTransactionAsync(async (transaction) => {
        await clearPersistentScanCacheWithExecutor(transaction);
      });
    });
  }

  async loadPhotoScanResultCache() {
    return this.withDatabase(async (database) => {
      const meta = await database.getFirstAsync<CandidateViewMetaRow>(
        `
          SELECT summary_json
          FROM candidate_view_meta
          WHERE id = 1
          LIMIT 1
        `,
      );

      if (!meta) {
        return null;
      }

      const summary = parseJsonValue<PhotoScanResultCache['summary']>(meta.summary_json);
      if (!summary) {
        return null;
      }

      const rows = await database.getAllAsync<CandidateViewRow>(
        `
          SELECT
            asset_id,
            rank,
            candidate_json
          FROM candidate_view
          ORDER BY rank ASC, updated_at DESC, asset_id ASC
        `,
      );
      const activeCandidates = rows
        .map((row) => parseJsonValue<PhotoScanResultCache['activeCandidates'][number]>(row.candidate_json))
        .filter((candidate): candidate is PhotoScanResultCache['activeCandidates'][number] =>
          Boolean(candidate),
        );

      return {
        activeCandidates,
        summary: {
          ...summary,
          candidateCount: activeCandidates.length,
          highConfidenceCount: activeCandidates.filter(
            (candidate) => candidate.confidence === 'high',
          ).length,
          mediumConfidenceCount: activeCandidates.filter(
            (candidate) => candidate.confidence === 'medium',
          ).length,
        },
      };
    });
  }

  async savePhotoScanResultCache(cache: PhotoScanResultCache) {
    await this.withDatabase(async (database) => {
      await database.withExclusiveTransactionAsync(async (transaction) => {
        await savePhotoScanResultCacheWithExecutor(transaction, cache);
      });
    });
  }

  async clearPhotoScanResultCache() {
    await this.withDatabase(async (database) => {
      await database.withExclusiveTransactionAsync(async (transaction) => {
        await transaction.runAsync('DELETE FROM candidate_view');
        await transaction.runAsync('DELETE FROM candidate_view_meta');
        await transaction.runAsync('DELETE FROM recognition_member');
        await transaction.runAsync('DELETE FROM recognition_group');
      });
    });
  }

  async loadRecognitionGroups() {
    return this.withDatabase(async (database) => {
      const groupRows = await database.getAllAsync<RecognitionGroupRow>(
        `
          SELECT
            group_id,
            relation,
            size,
            similarity,
            representative_asset_id,
            representative_reason,
            representative_width,
            representative_height,
            representative_file_size,
            representative_creation_time,
            updated_at
          FROM recognition_group
          ORDER BY updated_at DESC, group_id ASC
        `,
      );
      const memberRows = await database.getAllAsync<RecognitionMemberRow>(
        `
          SELECT group_id, asset_id
          FROM recognition_member
          ORDER BY group_id ASC, asset_id ASC
        `,
      );
      const membersByGroupId = new Map<string, string[]>();

      for (const row of memberRows) {
        const members = membersByGroupId.get(row.group_id) ?? [];
        members.push(row.asset_id);
        membersByGroupId.set(row.group_id, members);
      }

      return groupRows.map((row) => ({
        groupId: row.group_id,
        relation: row.relation,
        size: row.size,
        similarity: row.similarity,
        representativeAssetId: row.representative_asset_id,
        representativeReason: row.representative_reason,
        representativeWidth: row.representative_width,
        representativeHeight: row.representative_height,
        representativeFileSize: row.representative_file_size,
        representativeCreationTime: row.representative_creation_time,
        memberAssetIds: normalizeIds(membersByGroupId.get(row.group_id) ?? []),
        updatedAt: row.updated_at,
      }));
    });
  }

  async loadUserDecisions() {
    return this.withDatabase(async (database) => {
      const rows = await database.getAllAsync<UserDecisionRow>(
        `
          SELECT
            asset_id,
            candidate_id,
            decision,
            source,
            reason,
            decided_at,
            updated_at,
            snapshot_json
          FROM user_decision
          ORDER BY decided_at DESC, asset_id ASC
        `,
      );

      return rows.map((row) => ({
        assetId: row.asset_id,
        candidateId: row.candidate_id,
        decision: row.decision,
        source: row.source,
        reason: row.reason,
        decidedAt: row.decided_at,
        updatedAt: row.updated_at,
        snapshotJson: row.snapshot_json,
      }));
    });
  }

  async recordUserDecisions(decisions: OperationalUserDecisionRecord[]) {
    await this.withDatabase(async (database) => {
      await database.withExclusiveTransactionAsync(async (transaction) => {
        await recordUserDecisionsWithExecutor(transaction, decisions);
      });
    });
  }

  async loadRecycleBinIds() {
    return this.withDatabase(async (database) => {
      const rows = await database.getAllAsync<RecycleBinRow>(
        `
          SELECT asset_id
          FROM recycle_bin_state
          ORDER BY updated_at DESC, asset_id ASC
        `,
      );

      return normalizeIds(rows.map((row) => row.asset_id));
    });
  }

  async saveRecycleBinIds(ids: string[]) {
    await this.withDatabase(async (database) => {
      await database.withExclusiveTransactionAsync(async (transaction) => {
        await saveRecycleBinIdsWithExecutor(transaction, ids);
      });
    });
  }

  async loadCleanupReportSnapshot(): Promise<CleanupReportSnapshot> {
    return this.withDatabase((database) => loadCleanupReportSnapshotWithExecutor(database));
  }

  async recordCleanupReportDelta(delta: CleanupReportDelta): Promise<CleanupReportSnapshot> {
    return this.withDatabase(async (database) => {
      await database.withExclusiveTransactionAsync(async (transaction) => {
        await recordCleanupReportDeltaWithExecutor(transaction, delta);
      });
      return loadCleanupReportSnapshotWithExecutor(database);
    });
  }

  async deleteAssetRecords(assetIds: readonly string[]) {
    await this.withDatabase(async (database) => {
      await database.withExclusiveTransactionAsync(async (transaction) => {
        await deleteAssetRecordsWithExecutor(transaction, assetIds);
      });
    });
  }

  async loadActiveScanJob() {
    return this.withDatabase(async (database) => {
      const row = await database.getFirstAsync<ScanJobRow>(
        `
          SELECT
            job_id,
            phase,
            progress_current,
            progress_total,
            processed_count,
            candidate_count,
            started_at,
            last_heartbeat_at,
            current_file_name,
            last_processed_asset_id,
            last_error,
            updated_at
          FROM scan_job
          ORDER BY updated_at DESC
          LIMIT 1
        `,
      );

      if (!row) {
        return null;
      }

      return {
        jobId: row.job_id,
        phase: row.phase,
        progressCurrent: row.progress_current,
        progressTotal: row.progress_total,
        processedCount: row.processed_count,
        candidateCount: row.candidate_count,
        startedAt: row.started_at,
        lastHeartbeatAt: row.last_heartbeat_at,
        currentFileName: row.current_file_name ?? null,
        lastProcessedAssetId: row.last_processed_asset_id ?? null,
        lastError: row.last_error ?? null,
        updatedAt: row.updated_at,
      };
    });
  }

  async saveActiveScanJob(checkpoint: ActiveScanJobCheckpoint) {
    await this.withDatabase((database) =>
      database.runAsync(
        `
          INSERT INTO scan_job (
            job_id,
            phase,
            progress_current,
            progress_total,
            processed_count,
            candidate_count,
            started_at,
            last_heartbeat_at,
            current_file_name,
            last_processed_asset_id,
            last_error,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(job_id) DO UPDATE SET
            phase = excluded.phase,
            progress_current = excluded.progress_current,
            progress_total = excluded.progress_total,
            processed_count = excluded.processed_count,
            candidate_count = excluded.candidate_count,
            started_at = excluded.started_at,
            last_heartbeat_at = excluded.last_heartbeat_at,
            current_file_name = excluded.current_file_name,
            last_processed_asset_id = excluded.last_processed_asset_id,
            last_error = excluded.last_error,
            updated_at = excluded.updated_at
        `,
        checkpoint.jobId,
        checkpoint.phase,
        checkpoint.progressCurrent,
        checkpoint.progressTotal,
        checkpoint.processedCount,
        checkpoint.candidateCount,
        checkpoint.startedAt,
        checkpoint.lastHeartbeatAt,
        checkpoint.currentFileName,
        checkpoint.lastProcessedAssetId,
        checkpoint.lastError,
        checkpoint.updatedAt,
      ),
    );
  }

  async clearActiveScanJob() {
    await this.withDatabase((database) => database.runAsync('DELETE FROM scan_job'));
  }

  async loadLatestScanBatch() {
    return this.withDatabase(async (database) => {
      const row = await database.getFirstAsync<ScanBatchRow>(
        `
          SELECT
            batch_id,
            mode,
            window_days,
            range_start_at,
            range_end_at,
            phase,
            progress_current,
            progress_total,
            enumerated_count,
            dirty_count,
            analyzed_count,
            candidate_count,
            started_at,
            last_heartbeat_at,
            completed_at,
            last_error,
            updated_at
          FROM scan_batch
          ORDER BY updated_at DESC
          LIMIT 1
        `,
      );

      return row ? normalizeScanBatchRecord(row) : null;
    });
  }

  async loadLatestCompletedScanBatch() {
    return this.withDatabase(async (database) => {
      const row = await database.getFirstAsync<ScanBatchRow>(
        `
          SELECT
            batch_id,
            mode,
            window_days,
            range_start_at,
            range_end_at,
            phase,
            progress_current,
            progress_total,
            enumerated_count,
            dirty_count,
            analyzed_count,
            candidate_count,
            started_at,
            last_heartbeat_at,
            completed_at,
            last_error,
            updated_at
          FROM scan_batch
          WHERE phase = ?
          ORDER BY updated_at DESC
          LIMIT 1
        `,
        'completed',
      );

      return row ? normalizeScanBatchRecord(row) : null;
    });
  }

  async loadScanBatch(batchId: string) {
    return this.withDatabase(async (database) => {
      const row = await database.getFirstAsync<ScanBatchRow>(
        `
          SELECT
            batch_id,
            mode,
            window_days,
            range_start_at,
            range_end_at,
            phase,
            progress_current,
            progress_total,
            enumerated_count,
            dirty_count,
            analyzed_count,
            candidate_count,
            started_at,
            last_heartbeat_at,
            completed_at,
            last_error,
            updated_at
          FROM scan_batch
          WHERE batch_id = ?
          LIMIT 1
        `,
        batchId,
      );

      return row ? normalizeScanBatchRecord(row) : null;
    });
  }

  async saveScanBatch(batch: OperationalScanBatchRecord) {
    await this.withDatabase((database) => saveScanBatchWithExecutor(database, batch));
  }

  async loadScanBatchItems(batchId: string) {
    return this.withDatabase(async (database) => {
      const rows = await database.getAllAsync<ScanBatchItemRow>(
        `
          SELECT
            batch_id,
            asset_id,
            media_type,
            stage,
            dirty_reason,
            attempt_count,
            worker_slot,
            last_heartbeat_at,
            last_error,
            updated_at
          FROM scan_batch_item
          WHERE batch_id = ?
          ORDER BY updated_at DESC, asset_id ASC
        `,
        batchId,
      );

      return rows.map((row) => normalizeScanBatchItemRecord(row));
    });
  }

  async saveScanBatchItems(batchId: string, items: OperationalScanBatchItemRecord[]) {
    await this.withDatabase(async (database) => {
      await database.withExclusiveTransactionAsync(async (transaction) => {
        await saveScanBatchItemsWithExecutor(transaction, batchId, items);
      });
    });
  }

  async loadAssetManifestEntries(assetIds?: readonly string[]) {
    return this.withDatabase(async (database) => {
      const normalizedIds = assetIds ? normalizeIds(assetIds) : null;

      const rows =
        normalizedIds && normalizedIds.length > 0
          ? await database.getAllAsync<AssetManifestRow>(
              `
                SELECT
                  asset_id,
                  content_uri,
                  media_type,
                  mime_type,
                  width,
                  height,
                  orientation,
                  aspect_ratio,
                  duration_ms,
                  file_size_bytes,
                  date_taken,
                  date_modified,
                  bucket_id,
                  bucket_name,
                  is_screenshot,
                  bitrate,
                  frame_rate,
                  codec,
                  first_seen_at,
                  last_seen_at,
                  is_deleted,
                  dirty_reason,
                  updated_at
                FROM asset_manifest
                WHERE asset_id IN (${createPlaceholderList(normalizedIds)})
                ORDER BY last_seen_at DESC, asset_id ASC
              `,
              ...normalizedIds,
            )
          : normalizedIds
            ? []
            : await database.getAllAsync<AssetManifestRow>(
                `
                  SELECT
                    asset_id,
                    content_uri,
                    media_type,
                    mime_type,
                    width,
                    height,
                    orientation,
                    aspect_ratio,
                    duration_ms,
                    file_size_bytes,
                    date_taken,
                    date_modified,
                    bucket_id,
                    bucket_name,
                    is_screenshot,
                    bitrate,
                    frame_rate,
                    codec,
                    first_seen_at,
                    last_seen_at,
                    is_deleted,
                    dirty_reason,
                    updated_at
                  FROM asset_manifest
                  ORDER BY last_seen_at DESC, asset_id ASC
                `,
              );

      return rows.map((row) => normalizeAssetManifestRecord(row));
    });
  }

  async upsertAssetManifestEntries(entries: OperationalAssetManifestRecord[]) {
    await this.withDatabase(async (database) => {
      await database.withExclusiveTransactionAsync(async (transaction) => {
        await upsertAssetManifestEntriesWithExecutor(transaction, entries);
      });
    });
  }
}

class InMemoryOperationalStoreAdapter implements OperationalStoreAdapter {
  private readonly meta = new Map<string, string>();
  private readonly mediaAnalysis = new Map<string, MediaAnalysisCacheEntry>();
  private readonly mediaLedger = new Map<string, PersistedMediaRecord>();
  private readonly recycleBinState = new Set<string>();
  private cleanupReport: CleanupReportSnapshot = {
    cleanedItemCount: 0,
    cleanedBytes: 0,
    lastCleanedAt: null,
  };
  private scanBaseline: LastValidScanBaseline | null = null;
  private activeScanJob: ActiveScanJobCheckpoint | null = null;
  private readonly scanBatches = new Map<string, OperationalScanBatchRecord>();
  private readonly scanBatchItems = new Map<string, OperationalScanBatchItemRecord[]>();
  private readonly assetManifest = new Map<string, OperationalAssetManifestRecord>();
  private recognitionGroups: OperationalRecognitionGroupRecord[] = [];
  private readonly userDecisions = new Map<string, OperationalUserDecisionRecord>();
  private photoScanResultCache: PhotoScanResultCache | null = null;

  async ensureReady() {
    this.meta.set(SCHEMA_VERSION_META_KEY, String(OPERATIONAL_STORE_SCHEMA_VERSION));
  }

  async hasLegacyImportCompleted() {
    return this.meta.get(LEGACY_IMPORT_META_KEY) === 'done';
  }

  async markLegacyImportCompleted() {
    this.meta.set(LEGACY_IMPORT_META_KEY, 'done');
  }

  async loadMediaAnalysisCache() {
    return Object.fromEntries(this.mediaAnalysis.entries());
  }

  async saveMediaAnalysisCache(cache: MediaAnalysisCache) {
    this.mediaAnalysis.clear();
    for (const [assetId, entry] of Object.entries(cache)) {
      this.mediaAnalysis.set(assetId, entry);
    }
  }

  async loadPersistedMediaLedger() {
    return Array.from(this.mediaLedger.values()).sort(
      (left, right) => right.updatedAt - left.updatedAt || left.assetId.localeCompare(right.assetId),
    );
  }

  async savePersistedMediaLedger(records: PersistedMediaRecord[]) {
    this.mediaLedger.clear();
    for (const record of records) {
      this.mediaLedger.set(record.assetId, {
        ...record,
        linkIds: normalizeIds(record.linkIds),
      });
    }
  }

  async loadLastValidScanBaseline() {
    return this.scanBaseline;
  }

  async saveLastValidScanBaseline(baseline: LastValidScanBaseline) {
    this.scanBaseline = baseline;
  }

  async clearPersistentScanCache() {
    this.mediaAnalysis.clear();
    this.mediaLedger.clear();
    this.recognitionGroups = [];
    this.photoScanResultCache = null;
    this.scanBaseline = null;
    this.activeScanJob = null;
    this.scanBatches.clear();
    this.scanBatchItems.clear();
    this.assetManifest.clear();
  }

  async loadPhotoScanResultCache() {
    return this.photoScanResultCache
      ? {
          activeCandidates: [...this.photoScanResultCache.activeCandidates],
          summary: { ...this.photoScanResultCache.summary },
        }
      : null;
  }

  async savePhotoScanResultCache(cache: PhotoScanResultCache) {
    this.photoScanResultCache = {
      activeCandidates: [...cache.activeCandidates],
      summary: { ...cache.summary },
    };
    this.recognitionGroups = buildRecognitionGroupsFromCandidates(
      cache.activeCandidates,
      cache.summary.scannedAt,
    ).map((group) => ({
      groupId: group.groupId,
      relation: group.relation,
      size: group.size,
      similarity: group.similarity,
      representativeAssetId: group.representativeAssetId,
      representativeReason: group.representativeReason,
      representativeWidth: group.representativeWidth,
      representativeHeight: group.representativeHeight,
      representativeFileSize: group.representativeFileSize,
      representativeCreationTime: group.representativeCreationTime,
      memberAssetIds: normalizeIds([...group.members.keys()]),
      updatedAt: group.updatedAt,
    }));
  }

  async clearPhotoScanResultCache() {
    this.photoScanResultCache = null;
    this.recognitionGroups = [];
  }

  async loadRecognitionGroups() {
    return this.recognitionGroups.map((group) => ({
      ...group,
      memberAssetIds: [...group.memberAssetIds],
    }));
  }

  async loadUserDecisions() {
    return Array.from(this.userDecisions.values()).sort(
      (left, right) => right.decidedAt - left.decidedAt || left.assetId.localeCompare(right.assetId),
    );
  }

  async recordUserDecisions(decisions: OperationalUserDecisionRecord[]) {
    for (const decision of decisions) {
      this.userDecisions.set(decision.assetId, decision);
    }
  }

  async loadRecycleBinIds() {
    return normalizeIds(Array.from(this.recycleBinState));
  }

  async saveRecycleBinIds(ids: string[]) {
    this.recycleBinState.clear();
    for (const assetId of normalizeIds(ids)) {
      this.recycleBinState.add(assetId);
    }
  }

  async loadCleanupReportSnapshot(): Promise<CleanupReportSnapshot> {
    return this.cleanupReport;
  }

  async recordCleanupReportDelta(delta: CleanupReportDelta): Promise<CleanupReportSnapshot> {
    const cleanedItemCountDelta = Math.max(0, Math.trunc(delta.cleanedItemCount));
    const cleanedBytesDelta = Math.max(0, Math.trunc(delta.cleanedBytes));
    if (cleanedItemCountDelta === 0 && cleanedBytesDelta === 0) {
      return this.cleanupReport;
    }

    const cleanedAt = delta.cleanedAt ?? Date.now();
    this.cleanupReport = {
      cleanedItemCount: this.cleanupReport.cleanedItemCount + cleanedItemCountDelta,
      cleanedBytes: this.cleanupReport.cleanedBytes + cleanedBytesDelta,
      lastCleanedAt: cleanedAt,
    };

    return this.cleanupReport;
  }

  async deleteAssetRecords(assetIds: readonly string[]) {
    const normalizedIds = new Set(normalizeIds(assetIds));
    for (const assetId of normalizedIds) {
      this.mediaLedger.delete(assetId);
      this.mediaAnalysis.delete(assetId);
      this.recycleBinState.delete(assetId);
      this.assetManifest.delete(assetId);
    }
    if (this.photoScanResultCache) {
      this.photoScanResultCache = {
        ...this.photoScanResultCache,
        activeCandidates: this.photoScanResultCache.activeCandidates.filter(
          (candidate) => !normalizedIds.has(candidate.asset.id),
        ),
      };
    }
    this.recognitionGroups = this.recognitionGroups
      .map((group) => ({
        ...group,
        memberAssetIds: group.memberAssetIds.filter((assetId) => !normalizedIds.has(assetId)),
      }))
      .filter(
        (group) =>
          group.memberAssetIds.length > 0 &&
          !normalizedIds.has(group.representativeAssetId),
      );

    for (const [assetId, record] of this.mediaLedger.entries()) {
      const nextLinkIds = record.linkIds.filter((linkId) => !normalizedIds.has(linkId));
      this.mediaLedger.set(assetId, {
        ...record,
        linkIds: nextLinkIds,
      });
    }

    for (const [batchId, items] of this.scanBatchItems.entries()) {
      const nextItems = items.filter((item) => !normalizedIds.has(item.assetId));
      this.scanBatchItems.set(batchId, nextItems.map((item) => ({ ...item })));
    }
  }

  async loadActiveScanJob() {
    return this.activeScanJob;
  }

  async saveActiveScanJob(checkpoint: ActiveScanJobCheckpoint) {
    this.activeScanJob = checkpoint;
  }

  async clearActiveScanJob() {
    this.activeScanJob = null;
  }

  async loadLatestScanBatch() {
    const [latest] = Array.from(this.scanBatches.values()).sort(
      (left, right) => right.updatedAt - left.updatedAt || left.batchId.localeCompare(right.batchId),
    );
    return latest ?? null;
  }

  async loadLatestCompletedScanBatch() {
    const [latest] = Array.from(this.scanBatches.values())
      .filter((batch) => batch.phase === 'completed')
      .sort(
        (left, right) =>
          right.updatedAt - left.updatedAt || left.batchId.localeCompare(right.batchId),
      );
    return latest ?? null;
  }

  async loadScanBatch(batchId: string) {
    return this.scanBatches.get(batchId) ?? null;
  }

  async saveScanBatch(batch: OperationalScanBatchRecord) {
    this.scanBatches.set(batch.batchId, { ...batch });
  }

  async loadScanBatchItems(batchId: string) {
    return (this.scanBatchItems.get(batchId) ?? []).map((item) => ({ ...item }));
  }

  async saveScanBatchItems(batchId: string, items: OperationalScanBatchItemRecord[]) {
    this.scanBatchItems.set(
      batchId,
      items.map((item) => ({ ...item, batchId })),
    );
  }

  async loadAssetManifestEntries(assetIds?: readonly string[]) {
    const normalizedIds = assetIds ? normalizeIds(assetIds) : null;
    const entries =
      normalizedIds && normalizedIds.length > 0
        ? normalizedIds
            .map((assetId) => this.assetManifest.get(assetId))
            .filter((entry): entry is OperationalAssetManifestRecord => Boolean(entry))
        : normalizedIds
          ? []
          : Array.from(this.assetManifest.values());

    return entries
      .map((entry) => ({ ...entry }))
      .sort((left, right) => right.lastSeenAt - left.lastSeenAt || left.assetId.localeCompare(right.assetId));
  }

  async upsertAssetManifestEntries(entries: OperationalAssetManifestRecord[]) {
    for (const entry of entries) {
      const previous = this.assetManifest.get(entry.assetId);
      this.assetManifest.set(entry.assetId, {
        ...entry,
        firstSeenAt: previous ? Math.min(previous.firstSeenAt, entry.firstSeenAt) : entry.firstSeenAt,
        lastSeenAt: previous ? Math.max(previous.lastSeenAt, entry.lastSeenAt) : entry.lastSeenAt,
      });
    }
  }
}

let adapterFactory: (() => OperationalStoreAdapter) | null = null;
let adapterPromise: Promise<OperationalStoreAdapter> | null = null;

async function getOperationalStoreAdapter(): Promise<OperationalStoreAdapter> {
  if (!adapterPromise) {
    const adapter: OperationalStoreAdapter =
      adapterFactory?.() ?? new SQLiteOperationalStoreAdapter();
    adapterPromise = adapter.ensureReady().then(() => adapter);
  }

  return adapterPromise;
}

export function __useInMemoryOperationalStoreForTests() {
  adapterFactory = () => new InMemoryOperationalStoreAdapter();
  adapterPromise = null;
}

export function __resetOperationalStoreForTests() {
  adapterFactory = null;
  adapterPromise = null;
}

export async function hasOperationalStoreImportedLegacyAsyncStorage() {
  const adapter = await getOperationalStoreAdapter();
  return adapter.hasLegacyImportCompleted();
}

export async function markOperationalStoreLegacyImportCompleted() {
  const adapter = await getOperationalStoreAdapter();
  await adapter.markLegacyImportCompleted();
}

export async function loadOperationalMediaAnalysisCache() {
  const adapter = await getOperationalStoreAdapter();
  return adapter.loadMediaAnalysisCache();
}

export async function saveOperationalMediaAnalysisCache(cache: MediaAnalysisCache) {
  const adapter = await getOperationalStoreAdapter();
  await adapter.saveMediaAnalysisCache(cache);
}

export async function loadOperationalPersistedMediaLedger() {
  const adapter = await getOperationalStoreAdapter();
  return adapter.loadPersistedMediaLedger();
}

export async function saveOperationalPersistedMediaLedger(records: PersistedMediaRecord[]) {
  const adapter = await getOperationalStoreAdapter();
  await adapter.savePersistedMediaLedger(records);
}

export async function loadOperationalLastValidScanBaseline() {
  const adapter = await getOperationalStoreAdapter();
  return adapter.loadLastValidScanBaseline();
}

export async function saveOperationalLastValidScanBaseline(baseline: LastValidScanBaseline) {
  const adapter = await getOperationalStoreAdapter();
  await adapter.saveLastValidScanBaseline(baseline);
}

export async function clearOperationalPersistentScanCache() {
  const adapter = await getOperationalStoreAdapter();
  await adapter.clearPersistentScanCache();
}

export async function loadOperationalPhotoScanResultCache() {
  const adapter = await getOperationalStoreAdapter();
  return adapter.loadPhotoScanResultCache();
}

export async function saveOperationalPhotoScanResultCache(cache: PhotoScanResultCache) {
  const adapter = await getOperationalStoreAdapter();
  await adapter.savePhotoScanResultCache(cache);
}

export async function clearOperationalPhotoScanResultCache() {
  const adapter = await getOperationalStoreAdapter();
  await adapter.clearPhotoScanResultCache();
}

export async function loadOperationalRecognitionGroups() {
  const adapter = await getOperationalStoreAdapter();
  return adapter.loadRecognitionGroups();
}

export async function loadOperationalUserDecisions() {
  const adapter = await getOperationalStoreAdapter();
  return adapter.loadUserDecisions();
}

export async function recordOperationalUserDecisions(
  decisions: OperationalUserDecisionRecord[],
) {
  const adapter = await getOperationalStoreAdapter();
  await adapter.recordUserDecisions(decisions);
}

export async function estimateOperationalPersistentScanCacheSizeBytes() {
  const adapter = await getOperationalStoreAdapter();
  const [
    analysisCache,
    persistedMediaLedger,
    photoScanResultCache,
    recognitionGroups,
    lastValidScanBaseline,
    latestScanBatch,
    assetManifestEntries,
  ] = await Promise.all([
    adapter.loadMediaAnalysisCache(),
    adapter.loadPersistedMediaLedger(),
    adapter.loadPhotoScanResultCache(),
    adapter.loadRecognitionGroups(),
    adapter.loadLastValidScanBaseline(),
    adapter.loadLatestScanBatch(),
    adapter.loadAssetManifestEntries(),
  ]);

  let total = 0;

  if (Object.keys(analysisCache).length > 0) {
    total += new TextEncoder().encode(JSON.stringify(analysisCache)).length;
  }

  if (persistedMediaLedger.length > 0) {
    total += new TextEncoder().encode(JSON.stringify(persistedMediaLedger)).length;
  }

  if (photoScanResultCache) {
    total += new TextEncoder().encode(JSON.stringify(photoScanResultCache)).length;
  }

  if (recognitionGroups.length > 0) {
    total += new TextEncoder().encode(JSON.stringify(recognitionGroups)).length;
  }

  if (lastValidScanBaseline) {
    total += new TextEncoder().encode(JSON.stringify(lastValidScanBaseline)).length;
  }

  if (latestScanBatch) {
    total += new TextEncoder().encode(JSON.stringify(latestScanBatch)).length;
    const batchItems = await adapter.loadScanBatchItems(latestScanBatch.batchId);
    if (batchItems.length > 0) {
      total += new TextEncoder().encode(JSON.stringify(batchItems)).length;
    }
  }

  if (assetManifestEntries.length > 0) {
    total += new TextEncoder().encode(JSON.stringify(assetManifestEntries)).length;
  }

  return total;
}

export async function loadOperationalRecycleBinIds() {
  const adapter = await getOperationalStoreAdapter();
  return adapter.loadRecycleBinIds();
}

export async function saveOperationalRecycleBinIds(ids: string[]) {
  const adapter = await getOperationalStoreAdapter();
  await adapter.saveRecycleBinIds(ids);
}

export async function loadOperationalCleanupReportSnapshot() {
  const adapter = await getOperationalStoreAdapter();
  return adapter.loadCleanupReportSnapshot();
}

export async function recordOperationalCleanupReportDelta(delta: CleanupReportDelta) {
  const adapter = await getOperationalStoreAdapter();
  return adapter.recordCleanupReportDelta(delta);
}

export async function deleteOperationalAssetRecords(assetIds: readonly string[]) {
  const adapter = await getOperationalStoreAdapter();
  await adapter.deleteAssetRecords(assetIds);
}

export async function loadOperationalActiveScanJob() {
  const adapter = await getOperationalStoreAdapter();
  return adapter.loadActiveScanJob();
}

export async function saveOperationalActiveScanJob(checkpoint: ActiveScanJobCheckpoint) {
  const adapter = await getOperationalStoreAdapter();
  await adapter.saveActiveScanJob(checkpoint);
}

export async function clearOperationalActiveScanJob() {
  const adapter = await getOperationalStoreAdapter();
  await adapter.clearActiveScanJob();
}

export async function loadOperationalLatestScanBatch() {
  const adapter = await getOperationalStoreAdapter();
  return adapter.loadLatestScanBatch();
}

export async function loadOperationalLatestCompletedScanBatch() {
  const adapter = await getOperationalStoreAdapter();
  return adapter.loadLatestCompletedScanBatch();
}

export async function loadOperationalScanBatch(batchId: string) {
  const adapter = await getOperationalStoreAdapter();
  return adapter.loadScanBatch(batchId);
}

export async function saveOperationalScanBatch(batch: OperationalScanBatchRecord) {
  const adapter = await getOperationalStoreAdapter();
  await adapter.saveScanBatch(batch);
}

export async function loadOperationalScanBatchItems(batchId: string) {
  const adapter = await getOperationalStoreAdapter();
  return adapter.loadScanBatchItems(batchId);
}

export async function saveOperationalScanBatchItems(
  batchId: string,
  items: OperationalScanBatchItemRecord[],
) {
  const adapter = await getOperationalStoreAdapter();
  await adapter.saveScanBatchItems(batchId, items);
}

export async function loadOperationalAssetManifestEntries(assetIds?: readonly string[]) {
  const adapter = await getOperationalStoreAdapter();
  return adapter.loadAssetManifestEntries(assetIds);
}

export async function upsertOperationalAssetManifestEntries(
  entries: OperationalAssetManifestRecord[],
) {
  const adapter = await getOperationalStoreAdapter();
  await adapter.upsertAssetManifestEntries(entries);
}
