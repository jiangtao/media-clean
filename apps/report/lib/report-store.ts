import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { repoRoot } from '@/lib/local-paths';
import type {
  CleanupPlan,
  CleanupPlanDocument,
  Cluster,
  MediaCleanSession,
  SessionAsset,
} from '@/lib/report-contract';
import type { ScanJobSnapshot } from '@/lib/scan-jobs';

interface DatabaseSyncLike {
  exec(sql: string): void;
  prepare(sql: string): StatementSyncLike;
}

interface StatementSyncLike {
  run(...values: unknown[]): unknown;
  all(...values: unknown[]): Array<Record<string, unknown>>;
  get(...values: unknown[]): Record<string, unknown> | undefined;
}

export interface SessionHistoryIndexInput {
  sessionPath: string;
  cleanupPlanPath: string | null;
  session: MediaCleanSession;
  source: 'mc' | 'artifact';
  cleanupHistory: {
    assetCount: number;
    fileSize: number;
  };
}

export interface PersistReportRuntimeInput extends SessionHistoryIndexInput {
  cleanupPlan: CleanupPlanDocument | null;
}

export interface StoredSessionHistoryItem {
  sessionPath: string;
  cleanupPlanPath: string | null;
  sessionId: string;
  generatedAt: string;
  root: string;
  platform: string;
  assetCount: number;
  clusterCount: number;
  cleanupPlanCount: number;
  diagnosticCount: number;
  cleanupHistory: {
    assetCount: number;
    fileSize: number;
  };
  source: 'mc' | 'artifact';
}

let database: DatabaseSyncLike | null = null;

export function reportStorePath() {
  return path.join(repoRoot(), '.mc', '_state', 'report-workbench.sqlite');
}

export function ensureReportStore() {
  return getDatabase();
}

export function upsertScanJobSnapshot(job: ScanJobSnapshot) {
  const db = getDatabase();
  db.prepare(
    `INSERT INTO desktop_scan_job (
      job_id, session_id, root, media_type, status, phase, session_path, cleanup_plan_path,
      processed, total, percent, asset_count, cluster_count, cleanup_plan_count, diagnostic_count,
      error, logs_json, started_at, updated_at, completed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(job_id) DO UPDATE SET
      status=excluded.status,
      phase=excluded.phase,
      processed=excluded.processed,
      total=excluded.total,
      percent=excluded.percent,
      asset_count=excluded.asset_count,
      cluster_count=excluded.cluster_count,
      cleanup_plan_count=excluded.cleanup_plan_count,
      diagnostic_count=excluded.diagnostic_count,
      error=excluded.error,
      logs_json=excluded.logs_json,
      updated_at=excluded.updated_at,
      completed_at=excluded.completed_at`,
  ).run(
    job.jobId,
    job.sessionId,
    job.root,
    job.mediaType,
    job.status,
    job.phase,
    job.session,
    job.cleanupPlan,
    job.progress.processed,
    job.progress.total,
    job.progress.percent,
    job.assetCount ?? null,
    job.clusterCount ?? null,
    job.cleanupPlanCount ?? null,
    job.diagnosticCount ?? null,
    job.error ?? null,
    JSON.stringify(job.logs),
    job.startedAt,
    job.updatedAt,
    job.completedAt ?? null,
  );

  db.prepare(
    `INSERT INTO scan_job (
      job_id, phase, progress_current, progress_total, processed_count, candidate_count,
      started_at, last_heartbeat_at, current_file_name, last_processed_asset_id, last_error, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(job_id) DO UPDATE SET
      phase=excluded.phase,
      progress_current=excluded.progress_current,
      progress_total=excluded.progress_total,
      processed_count=excluded.processed_count,
      candidate_count=excluded.candidate_count,
      last_heartbeat_at=excluded.last_heartbeat_at,
      current_file_name=excluded.current_file_name,
      last_processed_asset_id=excluded.last_processed_asset_id,
      last_error=excluded.last_error,
      updated_at=excluded.updated_at`,
  ).run(
    job.jobId,
    job.phase,
    job.progress.processed,
    job.progress.total,
    job.progress.processed,
    job.cleanupPlanCount ?? job.clusterCount ?? 0,
    timestampMs(job.startedAt),
    timestampMs(job.updatedAt),
    null,
    null,
    job.error ?? null,
    timestampMs(job.updatedAt),
  );
}

export function listStoredScanJobs(limit = 30): ScanJobSnapshot[] {
  const rows = getDatabase()
    .prepare('SELECT * FROM desktop_scan_job ORDER BY started_at DESC LIMIT ?')
    .all(limit);
  return rows.map(scanJobFromRow);
}

export function upsertReportSessionIndex(input: SessionHistoryIndexInput) {
  const db = getDatabase();
  upsertReportSessionRow(db, input, null);
}

export function persistReportRuntime(input: PersistReportRuntimeInput) {
  const db = getDatabase();
  const now = Date.now();

  db.exec('BEGIN IMMEDIATE');
  try {
    upsertReportSessionRow(db, input, input.cleanupPlan);
    saveScanBatch(db, input, now);
    saveAssets(db, input.session, now);
    saveCandidateView(db, input.session, input.cleanupPlan, now);
    saveRecognitionGroups(db, input.session, now);
    refreshCleanupReport(db, now);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function loadReportDocumentsFromStore(sessionPath: string) {
  const row = getDatabase()
    .prepare('SELECT * FROM report_session WHERE session_path = ?')
    .get(sessionPath);
  if (!row || typeof row.session_json !== 'string') return null;

  const session = JSON.parse(row.session_json) as MediaCleanSession;
  const cleanupPlan =
    typeof row.cleanup_plan_json === 'string'
      ? (JSON.parse(row.cleanup_plan_json) as CleanupPlanDocument)
      : null;

  return {
    session,
    cleanupPlan,
    paths: {
      session: String(row.session_path),
      cleanupPlan:
        typeof row.cleanup_plan_path === 'string' ? String(row.cleanup_plan_path) : null,
    },
  };
}

export function listReportSessionsFromStore(limit = 30): StoredSessionHistoryItem[] {
  const rows = getDatabase()
    .prepare('SELECT * FROM report_session ORDER BY generated_at DESC LIMIT ?')
    .all(limit);
  return rows.map(sessionHistoryFromRow);
}

export function deleteReportSessionFromStore(sessionPath: string) {
  const db = getDatabase();
  const row = db.prepare('SELECT session_id FROM report_session WHERE session_path = ?').get(sessionPath);
  const sessionId = typeof row?.session_id === 'string' ? row.session_id : null;
  db.prepare('DELETE FROM report_session WHERE session_path = ?').run(sessionPath);
  if (!sessionId) return;
  db.prepare('DELETE FROM scan_batch_item WHERE batch_id = ?').run(sessionId);
  db.prepare('DELETE FROM scan_batch WHERE batch_id = ?').run(sessionId);
}

export function readTrashedAssetIdsFromStore() {
  const rows = getDatabase().prepare('SELECT asset_id FROM recycle_bin_state').all();
  return new Set(rows.map((row) => String(row.asset_id)));
}

export function markAssetsTrashedInStore(
  sourcePath: string,
  assets: Array<{ id: string; fileSize: number }>,
) {
  const db = getDatabase();
  const updatedAt = Date.now();
  const updatedAtIso = new Date(updatedAt).toISOString();

  db.exec('BEGIN IMMEDIATE');
  try {
    const legacyState = db.prepare(
      `INSERT INTO report_asset_state (session_path, asset_id, state, file_size, updated_at)
       VALUES (?, ?, 'trashed', ?, ?)
       ON CONFLICT(session_path, asset_id) DO UPDATE SET
         state=excluded.state,
         file_size=excluded.file_size,
         updated_at=excluded.updated_at`,
    );
    const recycle = db.prepare(
      `INSERT INTO recycle_bin_state (
        asset_id, recycled_at, expires_at, source, updated_at
      ) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(asset_id) DO UPDATE SET
        recycled_at=excluded.recycled_at,
        expires_at=excluded.expires_at,
        source=excluded.source,
        updated_at=excluded.updated_at`,
    );
    const decision = db.prepare(
      `INSERT INTO user_decision (
        asset_id, candidate_id, decision, source, reason, decided_at, updated_at, snapshot_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(asset_id) DO UPDATE SET
        candidate_id=excluded.candidate_id,
        decision=excluded.decision,
        source=excluded.source,
        reason=excluded.reason,
        decided_at=excluded.decided_at,
        updated_at=excluded.updated_at,
        snapshot_json=excluded.snapshot_json`,
    );

    for (const asset of assets) {
      legacyState.run(sourcePath, asset.id, asset.fileSize, updatedAtIso);
      recycle.run(asset.id, updatedAt, null, 'desktop-report', updatedAt);
      decision.run(
        asset.id,
        null,
        'trash',
        'desktop-report',
        'confirmed-cleanup',
        updatedAt,
        updatedAt,
        JSON.stringify({ sourcePath, fileSize: asset.fileSize }),
      );
    }

    refreshCleanupReport(db, updatedAt);
    refreshReportSessionCleanupCounts(db);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function reportStoreSummary() {
  const db = getDatabase();
  const sessionCount = db.prepare('SELECT COUNT(*) AS count FROM report_session').get()?.count ?? 0;
  const jobCount = db.prepare('SELECT COUNT(*) AS count FROM scan_job').get()?.count ?? 0;
  const desktopJobCount =
    db.prepare('SELECT COUNT(*) AS count FROM desktop_scan_job').get()?.count ?? 0;
  const assetStateCount =
    db.prepare('SELECT COUNT(*) AS count FROM recycle_bin_state').get()?.count ?? 0;
  return {
    path: reportStorePath(),
    sessionCount: Number(sessionCount),
    jobCount: Number(jobCount),
    desktopJobCount: Number(desktopJobCount),
    assetStateCount: Number(assetStateCount),
  };
}

function getDatabase() {
  if (database) return database;
  const sqlite = loadNodeSqlite();
  const dbPath = reportStorePath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  database = new sqlite.DatabaseSync(dbPath);
  migrateLegacyScanJob(database);
  database.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS schema_meta (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS report_session (
      session_path TEXT PRIMARY KEY NOT NULL,
      cleanup_plan_path TEXT,
      session_id TEXT NOT NULL,
      generated_at TEXT NOT NULL,
      root TEXT NOT NULL,
      platform TEXT NOT NULL,
      source TEXT NOT NULL CHECK (source IN ('mc', 'artifact')),
      asset_count INTEGER NOT NULL,
      cluster_count INTEGER NOT NULL,
      cleanup_plan_count INTEGER NOT NULL,
      diagnostic_count INTEGER NOT NULL,
      cleanup_asset_count INTEGER NOT NULL DEFAULT 0,
      cleanup_file_size INTEGER NOT NULL DEFAULT 0,
      session_json TEXT,
      cleanup_plan_json TEXT,
      indexed_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS report_asset_state (
      session_path TEXT NOT NULL,
      asset_id TEXT NOT NULL,
      state TEXT NOT NULL CHECK (state IN ('trashed')),
      file_size INTEGER,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (session_path, asset_id)
    );
  `);
  ensureDesktopScanJobTable(database);
  ensureAppAlignedTables(database);
  ensureReportSessionColumns(database);
  database
    .prepare(
      `INSERT INTO schema_meta (key, value, updated_at)
       VALUES ('schemaVersion', 'media-clean-report-store/v0.2-app-aligned', ?)
       ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`,
    )
    .run(new Date().toISOString());
  return database;
}

function ensureDesktopScanJobTable(db: DatabaseSyncLike) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS desktop_scan_job (
      job_id TEXT PRIMARY KEY NOT NULL,
      session_id TEXT NOT NULL,
      root TEXT NOT NULL,
      media_type TEXT NOT NULL,
      status TEXT NOT NULL,
      phase TEXT NOT NULL,
      session_path TEXT NOT NULL,
      cleanup_plan_path TEXT NOT NULL,
      processed INTEGER NOT NULL,
      total INTEGER NOT NULL,
      percent INTEGER NOT NULL,
      asset_count INTEGER,
      cluster_count INTEGER,
      cleanup_plan_count INTEGER,
      diagnostic_count INTEGER,
      error TEXT,
      logs_json TEXT NOT NULL,
      started_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      completed_at TEXT
    );
  `);
}

function ensureAppAlignedTables(db: DatabaseSyncLike) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS media_ledger (
      asset_id TEXT PRIMARY KEY NOT NULL,
      stable_hash TEXT NOT NULL,
      status INTEGER NOT NULL,
      last_error TEXT,
      updated_at INTEGER NOT NULL,
      snapshot_json TEXT
    );
    CREATE TABLE IF NOT EXISTS media_links (
      asset_id TEXT NOT NULL,
      linked_asset_id TEXT NOT NULL,
      relation_type TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (asset_id, linked_asset_id, relation_type)
    );
    CREATE TABLE IF NOT EXISTS media_analysis (
      asset_id TEXT PRIMARY KEY NOT NULL,
      signature TEXT NOT NULL,
      preview_uri TEXT NOT NULL,
      fingerprint TEXT,
      difference_hash TEXT,
      content_hash TEXT,
      frame_fingerprints_json TEXT NOT NULL,
      metrics_json TEXT NOT NULL,
      status TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS scan_baseline (
      id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
      scanned_at INTEGER NOT NULL,
      scanned_count INTEGER NOT NULL,
      candidate_count INTEGER NOT NULL,
      scan_range_months INTEGER NOT NULL,
      latest_eligible_asset_at INTEGER,
      ledger_updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS recycle_bin_state (
      asset_id TEXT PRIMARY KEY NOT NULL,
      recycled_at INTEGER NOT NULL,
      expires_at INTEGER,
      source TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS cleanup_report (
      id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
      cleaned_item_count INTEGER NOT NULL,
      cleaned_bytes INTEGER NOT NULL,
      last_cleaned_at INTEGER,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS scan_job (
      job_id TEXT PRIMARY KEY NOT NULL,
      phase TEXT NOT NULL,
      progress_current INTEGER NOT NULL,
      progress_total INTEGER NOT NULL,
      processed_count INTEGER NOT NULL,
      candidate_count INTEGER NOT NULL,
      started_at INTEGER NOT NULL,
      last_heartbeat_at INTEGER NOT NULL,
      current_file_name TEXT,
      last_processed_asset_id TEXT,
      last_error TEXT,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS scan_batch (
      batch_id TEXT PRIMARY KEY NOT NULL,
      mode TEXT NOT NULL,
      window_days INTEGER,
      range_start_at INTEGER,
      range_end_at INTEGER,
      phase TEXT NOT NULL,
      progress_current INTEGER NOT NULL,
      progress_total INTEGER NOT NULL,
      enumerated_count INTEGER NOT NULL,
      dirty_count INTEGER NOT NULL,
      analyzed_count INTEGER NOT NULL,
      candidate_count INTEGER NOT NULL,
      started_at INTEGER NOT NULL,
      last_heartbeat_at INTEGER NOT NULL,
      completed_at INTEGER,
      last_error TEXT,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS scan_batch_item (
      batch_id TEXT NOT NULL,
      asset_id TEXT NOT NULL,
      media_type TEXT NOT NULL,
      stage TEXT NOT NULL,
      dirty_reason TEXT,
      attempt_count INTEGER NOT NULL,
      worker_slot TEXT,
      last_heartbeat_at INTEGER,
      last_error TEXT,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (batch_id, asset_id)
    );
    CREATE TABLE IF NOT EXISTS asset_manifest (
      asset_id TEXT PRIMARY KEY NOT NULL,
      content_uri TEXT NOT NULL,
      media_type TEXT NOT NULL,
      mime_type TEXT,
      width INTEGER NOT NULL,
      height INTEGER NOT NULL,
      orientation INTEGER,
      aspect_ratio REAL,
      duration_ms INTEGER NOT NULL,
      file_size_bytes INTEGER,
      date_taken INTEGER,
      date_modified INTEGER,
      bucket_id TEXT,
      bucket_name TEXT,
      is_screenshot INTEGER,
      bitrate INTEGER,
      frame_rate REAL,
      codec TEXT,
      first_seen_at INTEGER NOT NULL,
      last_seen_at INTEGER NOT NULL,
      is_deleted INTEGER NOT NULL,
      dirty_reason TEXT,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS candidate_view_meta (
      id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
      summary_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS candidate_view (
      asset_id TEXT PRIMARY KEY NOT NULL,
      batch_id TEXT,
      rank INTEGER NOT NULL,
      score REAL NOT NULL,
      confidence TEXT NOT NULL,
      primary_issue_type TEXT NOT NULL,
      candidate_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS recognition_group (
      group_id TEXT PRIMARY KEY NOT NULL,
      relation TEXT NOT NULL,
      size INTEGER NOT NULL,
      similarity REAL NOT NULL,
      representative_asset_id TEXT NOT NULL,
      representative_reason TEXT NOT NULL,
      representative_width INTEGER NOT NULL,
      representative_height INTEGER NOT NULL,
      representative_file_size INTEGER NOT NULL,
      representative_creation_time INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS recognition_member (
      group_id TEXT NOT NULL,
      asset_id TEXT NOT NULL,
      candidate_id TEXT NOT NULL,
      role TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (group_id, asset_id)
    );
    CREATE TABLE IF NOT EXISTS user_decision (
      asset_id TEXT PRIMARY KEY NOT NULL,
      candidate_id TEXT,
      decision TEXT NOT NULL,
      source TEXT NOT NULL,
      reason TEXT,
      decided_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      snapshot_json TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_media_ledger_status_updated_at
      ON media_ledger (status, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_media_links_linked_asset
      ON media_links (linked_asset_id);
    CREATE INDEX IF NOT EXISTS idx_media_analysis_updated_at
      ON media_analysis (updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_recycle_bin_state_updated_at
      ON recycle_bin_state (updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_scan_batch_phase_updated_at
      ON scan_batch (phase, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_scan_batch_item_batch_updated_at
      ON scan_batch_item (batch_id, updated_at DESC, asset_id ASC);
    CREATE INDEX IF NOT EXISTS idx_scan_batch_item_asset_updated_at
      ON scan_batch_item (asset_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_asset_manifest_deleted_last_seen
      ON asset_manifest (is_deleted, last_seen_at DESC, asset_id ASC);
    CREATE INDEX IF NOT EXISTS idx_asset_manifest_bucket_last_seen
      ON asset_manifest (bucket_id, last_seen_at DESC);
    CREATE INDEX IF NOT EXISTS idx_candidate_view_rank
      ON candidate_view (rank ASC, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_candidate_view_issue_score
      ON candidate_view (primary_issue_type, score DESC);
    CREATE INDEX IF NOT EXISTS idx_recognition_group_updated_at
      ON recognition_group (updated_at DESC, group_id ASC);
    CREATE INDEX IF NOT EXISTS idx_recognition_member_asset
      ON recognition_member (asset_id, group_id);
    CREATE INDEX IF NOT EXISTS idx_user_decision_decided_at
      ON user_decision (decision, decided_at DESC, asset_id ASC);
  `);
}

function migrateLegacyScanJob(db: DatabaseSyncLike) {
  ensureDesktopScanJobTable(db);
  const columns = tableColumns(db, 'scan_job');
  if (columns.size === 0 || columns.has('progress_current')) return;
  if (!columns.has('session_id') || !columns.has('session_path')) return;

  db.exec(`
    INSERT OR REPLACE INTO desktop_scan_job (
      job_id, session_id, root, media_type, status, phase, session_path, cleanup_plan_path,
      processed, total, percent, asset_count, cluster_count, cleanup_plan_count, diagnostic_count,
      error, logs_json, started_at, updated_at, completed_at
    )
    SELECT
      job_id, session_id, root, media_type, status, phase, session_path, cleanup_plan_path,
      processed, total, percent, asset_count, cluster_count, cleanup_plan_count, diagnostic_count,
      error, logs_json, started_at, updated_at, completed_at
    FROM scan_job;
    DROP TABLE scan_job;
  `);
}

function ensureReportSessionColumns(db: DatabaseSyncLike) {
  const columns = tableColumns(db, 'report_session');
  if (!columns.has('session_json')) {
    db.exec('ALTER TABLE report_session ADD COLUMN session_json TEXT');
  }
  if (!columns.has('cleanup_plan_json')) {
    db.exec('ALTER TABLE report_session ADD COLUMN cleanup_plan_json TEXT');
  }
}

function upsertReportSessionRow(
  db: DatabaseSyncLike,
  input: SessionHistoryIndexInput,
  cleanupPlan: CleanupPlanDocument | null,
) {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO report_session (
      session_path, cleanup_plan_path, session_id, generated_at, root, platform, source,
      asset_count, cluster_count, cleanup_plan_count, diagnostic_count,
      cleanup_asset_count, cleanup_file_size, session_json, cleanup_plan_json, indexed_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(session_path) DO UPDATE SET
      cleanup_plan_path=excluded.cleanup_plan_path,
      generated_at=excluded.generated_at,
      root=excluded.root,
      platform=excluded.platform,
      source=excluded.source,
      asset_count=excluded.asset_count,
      cluster_count=excluded.cluster_count,
      cleanup_plan_count=excluded.cleanup_plan_count,
      diagnostic_count=excluded.diagnostic_count,
      cleanup_asset_count=excluded.cleanup_asset_count,
      cleanup_file_size=excluded.cleanup_file_size,
      session_json=COALESCE(excluded.session_json, report_session.session_json),
      cleanup_plan_json=COALESCE(excluded.cleanup_plan_json, report_session.cleanup_plan_json),
      updated_at=excluded.updated_at`,
  ).run(
    input.sessionPath,
    input.cleanupPlanPath,
    input.session.sessionId,
    input.session.generatedAt,
    input.session.source.root,
    input.session.source.platform,
    input.source,
    input.session.assets.length,
    input.session.clusters.length,
    cleanupPlan?.plans.length ?? input.session.cleanupPlans.length,
    input.session.diagnostics?.length ?? 0,
    input.cleanupHistory.assetCount,
    input.cleanupHistory.fileSize,
    JSON.stringify(input.session),
    cleanupPlan ? JSON.stringify(cleanupPlan) : null,
    now,
    now,
  );
}

function saveScanBatch(db: DatabaseSyncLike, input: PersistReportRuntimeInput, now: number) {
  const createdTimes = input.session.assets.map((asset) => timestampMs(asset.createdAt));
  const rangeStartAt = createdTimes.length ? Math.min(...createdTimes) : null;
  const rangeEndAt = createdTimes.length ? Math.max(...createdTimes) : null;
  db.prepare(
    `INSERT INTO scan_batch (
      batch_id, mode, window_days, range_start_at, range_end_at, phase,
      progress_current, progress_total, enumerated_count, dirty_count, analyzed_count,
      candidate_count, started_at, last_heartbeat_at, completed_at, last_error, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(batch_id) DO UPDATE SET
      mode=excluded.mode,
      range_start_at=excluded.range_start_at,
      range_end_at=excluded.range_end_at,
      phase=excluded.phase,
      progress_current=excluded.progress_current,
      progress_total=excluded.progress_total,
      enumerated_count=excluded.enumerated_count,
      dirty_count=excluded.dirty_count,
      analyzed_count=excluded.analyzed_count,
      candidate_count=excluded.candidate_count,
      last_heartbeat_at=excluded.last_heartbeat_at,
      completed_at=excluded.completed_at,
      last_error=excluded.last_error,
      updated_at=excluded.updated_at`,
  ).run(
    input.session.sessionId,
    input.session.source.kind,
    null,
    rangeStartAt,
    rangeEndAt,
    'completed',
    input.session.assets.length,
    input.session.assets.length,
    input.session.assets.length,
    input.session.assets.length,
    input.session.assets.length,
    input.session.clusters.length,
    timestampMs(input.session.generatedAt),
    now,
    now,
    null,
    now,
  );

  db.prepare('DELETE FROM scan_batch_item WHERE batch_id = ?').run(input.session.sessionId);
  const item = db.prepare(
    `INSERT INTO scan_batch_item (
      batch_id, asset_id, media_type, stage, dirty_reason, attempt_count,
      worker_slot, last_heartbeat_at, last_error, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const asset of input.session.assets) {
    item.run(
      input.session.sessionId,
      asset.id,
      asset.mediaType,
      'completed',
      'desktop-scan',
      1,
      null,
      now,
      null,
      now,
    );
  }
}

function saveAssets(db: DatabaseSyncLike, session: MediaCleanSession, now: number) {
  const manifest = db.prepare(
    `INSERT INTO asset_manifest (
      asset_id, content_uri, media_type, mime_type, width, height, orientation,
      aspect_ratio, duration_ms, file_size_bytes, date_taken, date_modified,
      bucket_id, bucket_name, is_screenshot, bitrate, frame_rate, codec,
      first_seen_at, last_seen_at, is_deleted, dirty_reason, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(asset_id) DO UPDATE SET
      content_uri=excluded.content_uri,
      media_type=excluded.media_type,
      mime_type=excluded.mime_type,
      width=excluded.width,
      height=excluded.height,
      orientation=excluded.orientation,
      aspect_ratio=excluded.aspect_ratio,
      duration_ms=excluded.duration_ms,
      file_size_bytes=excluded.file_size_bytes,
      date_taken=excluded.date_taken,
      date_modified=excluded.date_modified,
      bucket_id=excluded.bucket_id,
      bucket_name=excluded.bucket_name,
      is_screenshot=excluded.is_screenshot,
      bitrate=excluded.bitrate,
      frame_rate=excluded.frame_rate,
      codec=excluded.codec,
      first_seen_at=MIN(asset_manifest.first_seen_at, excluded.first_seen_at),
      last_seen_at=MAX(asset_manifest.last_seen_at, excluded.last_seen_at),
      is_deleted=excluded.is_deleted,
      dirty_reason=excluded.dirty_reason,
      updated_at=excluded.updated_at`,
  );
  const analysis = db.prepare(
    `INSERT INTO media_analysis (
      asset_id, signature, preview_uri, fingerprint, difference_hash, content_hash,
      frame_fingerprints_json, metrics_json, status, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(asset_id) DO UPDATE SET
      signature=excluded.signature,
      preview_uri=excluded.preview_uri,
      fingerprint=excluded.fingerprint,
      difference_hash=excluded.difference_hash,
      content_hash=excluded.content_hash,
      frame_fingerprints_json=excluded.frame_fingerprints_json,
      metrics_json=excluded.metrics_json,
      status=excluded.status,
      updated_at=excluded.updated_at`,
  );

  for (const asset of session.assets) {
    const createdAt = timestampMs(asset.createdAt);
    const bucket = bucketInfo(asset.uri, session.source.root);
    manifest.run(
      asset.id,
      asset.uri,
      asset.mediaType,
      mimeTypeForAsset(asset),
      asset.width,
      asset.height,
      null,
      asset.height > 0 ? asset.width / asset.height : null,
      Math.round((asset.duration ?? 0) * 1000),
      asset.fileSize,
      createdAt,
      createdAt,
      bucket.id,
      bucket.name,
      isScreenshot(asset) ? 1 : 0,
      null,
      null,
      null,
      createdAt,
      now,
      0,
      null,
      now,
    );
    analysis.run(
      asset.id,
      asset.hashes.contentHash ??
        asset.hashes.perceptualHash ??
        asset.hashes.differenceHash ??
        asset.id,
      asset.uri,
      asset.hashes.perceptualHash ?? null,
      asset.hashes.differenceHash ?? null,
      asset.hashes.contentHash ?? null,
      JSON.stringify(asset.hashes.frameHashes ?? []),
      JSON.stringify(asset.metrics),
      'ready',
      now,
    );
  }
}

function saveCandidateView(
  db: DatabaseSyncLike,
  session: MediaCleanSession,
  cleanupPlan: CleanupPlanDocument | null,
  now: number,
) {
  const planByClusterId = new Map(
    (cleanupPlan?.plans ?? session.cleanupPlans).map((plan) => [plan.clusterId, plan]),
  );
  const assetById = new Map(session.assets.map((asset) => [asset.id, asset]));
  const countsByType = new Map<string, number>();
  for (const cluster of session.clusters) {
    countsByType.set(cluster.category, (countsByType.get(cluster.category) ?? 0) + 1);
  }

  db.prepare('DELETE FROM candidate_view').run();
  db.prepare('DELETE FROM candidate_view_meta').run();
  db.prepare(
    `INSERT INTO candidate_view_meta (id, summary_json, updated_at) VALUES (?, ?, ?)`,
  ).run(
    1,
    JSON.stringify({
      scannedAt: now,
      source: 'desktop-report',
      totalAssets: session.assets.length,
      totalCandidates: session.clusters.length,
      cleanupPlanCount: cleanupPlan?.plans.length ?? session.cleanupPlans.length,
      byIssueType: Object.fromEntries(countsByType),
    }),
    now,
  );

  const statement = db.prepare(
    `INSERT INTO candidate_view (
      asset_id, batch_id, rank, score, confidence, primary_issue_type, candidate_json, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const [index, cluster] of session.clusters.entries()) {
    const representative = assetById.get(cluster.representativeAssetId);
    if (!representative) continue;
    const plan = planByClusterId.get(cluster.id) ?? null;
    statement.run(
      representative.id,
      session.sessionId,
      index,
      cluster.score,
      confidenceForScore(cluster.score),
      cluster.category,
      JSON.stringify(candidateJson(cluster, representative, session.assets, plan)),
      now,
    );
  }
}

function saveRecognitionGroups(db: DatabaseSyncLike, session: MediaCleanSession, now: number) {
  const assetById = new Map(session.assets.map((asset) => [asset.id, asset]));
  db.prepare('DELETE FROM recognition_member').run();
  db.prepare('DELETE FROM recognition_group').run();

  const groupStatement = db.prepare(
    `INSERT INTO recognition_group (
      group_id, relation, size, similarity, representative_asset_id, representative_reason,
      representative_width, representative_height, representative_file_size,
      representative_creation_time, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const memberStatement = db.prepare(
    `INSERT INTO recognition_member (
      group_id, asset_id, candidate_id, role, updated_at
    ) VALUES (?, ?, ?, ?, ?)`,
  );

  for (const cluster of session.clusters) {
    const representative = assetById.get(cluster.representativeAssetId);
    if (!representative) continue;
    groupStatement.run(
      cluster.id,
      cluster.category,
      cluster.assetIds.length,
      normalizedSimilarity(cluster.score),
      representative.id,
      cluster.reasons[0] ?? cluster.category,
      representative.width,
      representative.height,
      representative.fileSize,
      timestampMs(representative.createdAt),
      now,
    );

    for (const assetId of cluster.assetIds) {
      memberStatement.run(
        cluster.id,
        assetId,
        cluster.id,
        assetId === representative.id ? 'representative' : 'member',
        now,
      );
    }
  }
}

function refreshCleanupReport(db: DatabaseSyncLike, updatedAt: number) {
  const row = db
    .prepare(
      `SELECT
        COUNT(recycle_bin_state.asset_id) AS count,
        COALESCE(SUM(asset_manifest.file_size_bytes), 0) AS bytes,
        MAX(recycle_bin_state.recycled_at) AS last_cleaned_at
      FROM recycle_bin_state
      LEFT JOIN asset_manifest ON asset_manifest.asset_id = recycle_bin_state.asset_id`,
    )
    .get();
  db.prepare(
    `INSERT INTO cleanup_report (
      id, cleaned_item_count, cleaned_bytes, last_cleaned_at, updated_at
    ) VALUES (1, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      cleaned_item_count=excluded.cleaned_item_count,
      cleaned_bytes=excluded.cleaned_bytes,
      last_cleaned_at=excluded.last_cleaned_at,
      updated_at=excluded.updated_at`,
  ).run(
    Number(row?.count ?? 0),
    Number(row?.bytes ?? 0),
    row?.last_cleaned_at ?? null,
    updatedAt,
  );
}

function refreshReportSessionCleanupCounts(db: DatabaseSyncLike) {
  const trashed = new Set(
    db.prepare('SELECT asset_id FROM recycle_bin_state').all().map((row) => String(row.asset_id)),
  );
  const update = db.prepare(
    `UPDATE report_session
     SET cleanup_asset_count = ?, cleanup_file_size = ?, updated_at = ?
     WHERE session_path = ?`,
  );
  const updatedAt = new Date().toISOString();
  const rows = db.prepare('SELECT session_path, session_json FROM report_session').all();
  for (const row of rows) {
    if (typeof row.session_json !== 'string') continue;
    const session = JSON.parse(row.session_json) as MediaCleanSession;
    const cleanedAssets = session.assets.filter((asset) => trashed.has(asset.id));
    update.run(
      cleanedAssets.length,
      cleanedAssets.reduce((total, asset) => total + asset.fileSize, 0),
      updatedAt,
      row.session_path,
    );
  }
}

function loadNodeSqlite() {
  const loader = (process as typeof process & {
    getBuiltinModule?: (id: string) => unknown;
  }).getBuiltinModule;
  if (!loader) {
    throw new Error('node:sqlite requires process.getBuiltinModule support');
  }
  return loader('node:sqlite') as { DatabaseSync: new (path: string) => DatabaseSyncLike };
}

function tableColumns(db: DatabaseSyncLike, table: string) {
  try {
    return new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((row) => String(row.name)));
  } catch {
    return new Set<string>();
  }
}

function scanJobFromRow(row: Record<string, unknown>): ScanJobSnapshot {
  const logs = typeof row.logs_json === 'string' ? JSON.parse(row.logs_json) : [];
  return {
    jobId: String(row.job_id),
    sessionId: String(row.session_id),
    root: String(row.root),
    mediaType: String(row.media_type),
    status: String(row.status) as ScanJobSnapshot['status'],
    phase: String(row.phase),
    session: String(row.session_path),
    cleanupPlan: String(row.cleanup_plan_path),
    progress: {
      processed: Number(row.processed),
      total: Number(row.total),
      percent: Number(row.percent),
    },
    assetCount: optionalNumber(row.asset_count),
    clusterCount: optionalNumber(row.cluster_count),
    cleanupPlanCount: optionalNumber(row.cleanup_plan_count),
    diagnosticCount: optionalNumber(row.diagnostic_count),
    error: typeof row.error === 'string' ? row.error : undefined,
    logs: Array.isArray(logs) ? logs.map(String) : [],
    startedAt: String(row.started_at),
    updatedAt: String(row.updated_at),
    completedAt: typeof row.completed_at === 'string' ? row.completed_at : undefined,
  };
}

function sessionHistoryFromRow(row: Record<string, unknown>): StoredSessionHistoryItem {
  return {
    sessionPath: String(row.session_path),
    cleanupPlanPath:
      typeof row.cleanup_plan_path === 'string' ? String(row.cleanup_plan_path) : null,
    sessionId: String(row.session_id),
    generatedAt: String(row.generated_at),
    root: String(row.root),
    platform: String(row.platform),
    assetCount: Number(row.asset_count),
    clusterCount: Number(row.cluster_count),
    cleanupPlanCount: Number(row.cleanup_plan_count),
    diagnosticCount: Number(row.diagnostic_count),
    cleanupHistory: {
      assetCount: Number(row.cleanup_asset_count ?? 0),
      fileSize: Number(row.cleanup_file_size ?? 0),
    },
    source: String(row.source) === 'artifact' ? 'artifact' : 'mc',
  };
}

function candidateJson(
  cluster: Cluster,
  representative: SessionAsset,
  assets: SessionAsset[],
  plan: CleanupPlan | null,
) {
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  return {
    id: cluster.id,
    asset: representative,
    score: cluster.score,
    confidence: confidenceForScore(cluster.score),
    primaryIssueType: cluster.category,
    reasons: cluster.reasons,
    relatedAssets: cluster.assetIds.map((assetId) => assetById.get(assetId)).filter(Boolean),
    cleanupPlan: plan,
  };
}

function confidenceForScore(score: number) {
  if (score >= 90) return 'high';
  if (score >= 70) return 'medium';
  return 'low';
}

function normalizedSimilarity(score: number) {
  return score > 1 ? score / 100 : score;
}

function timestampMs(value: string | number | null | undefined) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (!value) return Date.now();
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function optionalNumber(value: unknown) {
  return value === null || value === undefined ? undefined : Number(value);
}

function mimeTypeForAsset(asset: SessionAsset) {
  const filePath = localPathFromUri(asset.uri);
  const extension = filePath ? path.extname(filePath).toLowerCase() : '';
  if (extension === '.jpg' || extension === '.jpeg') return 'image/jpeg';
  if (extension === '.png') return 'image/png';
  if (extension === '.webp') return 'image/webp';
  if (extension === '.heic') return 'image/heic';
  if (extension === '.mp4') return 'video/mp4';
  if (extension === '.mov') return 'video/quicktime';
  return asset.mediaType === 'video' ? 'video/*' : 'image/*';
}

function bucketInfo(uri: string, fallbackRoot: string) {
  const filePath = localPathFromUri(uri) ?? fallbackRoot;
  const dir = path.dirname(filePath);
  return {
    id: dir,
    name: path.basename(dir),
  };
}

function isScreenshot(asset: SessionAsset) {
  const localPath = localPathFromUri(asset.uri)?.toLowerCase() ?? asset.uri.toLowerCase();
  return localPath.includes('screenshot') || localPath.includes('screen_shot');
}

function localPathFromUri(uri: string) {
  if (!uri.startsWith('file://')) return null;
  try {
    return fileURLToPath(uri);
  } catch {
    return null;
  }
}
