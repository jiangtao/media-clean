export const OPERATIONAL_STORE_SCHEMA_VERSION = 7;

export const OPERATIONAL_STORE_TABLE_STATEMENTS = [
  `
    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `,
  `
    CREATE TABLE IF NOT EXISTS media_ledger (
      asset_id TEXT PRIMARY KEY NOT NULL,
      stable_hash TEXT NOT NULL,
      status INTEGER NOT NULL,
      last_error TEXT,
      updated_at INTEGER NOT NULL,
      snapshot_json TEXT
    );
  `,
  `
    CREATE TABLE IF NOT EXISTS media_links (
      asset_id TEXT NOT NULL,
      linked_asset_id TEXT NOT NULL,
      relation_type TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (asset_id, linked_asset_id, relation_type)
    );
  `,
  `
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
  `,
  `
    CREATE TABLE IF NOT EXISTS scan_baseline (
      id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
      scanned_at INTEGER NOT NULL,
      scanned_count INTEGER NOT NULL,
      candidate_count INTEGER NOT NULL,
      scan_range_months INTEGER NOT NULL,
      latest_eligible_asset_at INTEGER,
      ledger_updated_at INTEGER NOT NULL
    );
  `,
  `
    CREATE TABLE IF NOT EXISTS recycle_bin_state (
      asset_id TEXT PRIMARY KEY NOT NULL,
      recycled_at INTEGER NOT NULL,
      expires_at INTEGER,
      source TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `,
  `
    CREATE TABLE IF NOT EXISTS cleanup_report (
      id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
      cleaned_item_count INTEGER NOT NULL,
      cleaned_bytes INTEGER NOT NULL,
      last_cleaned_at INTEGER,
      updated_at INTEGER NOT NULL
    );
  `,
  `
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
  `,
  `
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
  `,
  `
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
  `,
  `
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
  `,
  `
    CREATE TABLE IF NOT EXISTS candidate_view_meta (
      id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
      summary_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `,
  `
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
  `,
  `
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
  `,
  `
    CREATE TABLE IF NOT EXISTS recognition_member (
      group_id TEXT NOT NULL,
      asset_id TEXT NOT NULL,
      candidate_id TEXT NOT NULL,
      role TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (group_id, asset_id)
    );
  `,
  `
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
  `,
  `
    CREATE INDEX IF NOT EXISTS idx_media_ledger_status_updated_at
      ON media_ledger (status, updated_at DESC);
  `,
  `
    CREATE INDEX IF NOT EXISTS idx_media_links_linked_asset
      ON media_links (linked_asset_id);
  `,
  `
    CREATE INDEX IF NOT EXISTS idx_media_analysis_updated_at
      ON media_analysis (updated_at DESC);
  `,
  `
    CREATE INDEX IF NOT EXISTS idx_recycle_bin_state_updated_at
      ON recycle_bin_state (updated_at DESC);
  `,
  `
    CREATE INDEX IF NOT EXISTS idx_scan_batch_phase_updated_at
      ON scan_batch (phase, updated_at DESC);
  `,
  `
    CREATE INDEX IF NOT EXISTS idx_scan_batch_item_batch_updated_at
      ON scan_batch_item (batch_id, updated_at DESC, asset_id ASC);
  `,
  `
    CREATE INDEX IF NOT EXISTS idx_scan_batch_item_asset_updated_at
      ON scan_batch_item (asset_id, updated_at DESC);
  `,
  `
    CREATE INDEX IF NOT EXISTS idx_asset_manifest_deleted_last_seen
      ON asset_manifest (is_deleted, last_seen_at DESC, asset_id ASC);
  `,
  `
    CREATE INDEX IF NOT EXISTS idx_asset_manifest_bucket_last_seen
      ON asset_manifest (bucket_id, last_seen_at DESC);
  `,
  `
    CREATE INDEX IF NOT EXISTS idx_candidate_view_rank
      ON candidate_view (rank ASC, updated_at DESC);
  `,
  `
    CREATE INDEX IF NOT EXISTS idx_candidate_view_issue_score
      ON candidate_view (primary_issue_type, score DESC);
  `,
  `
    CREATE INDEX IF NOT EXISTS idx_recognition_group_updated_at
      ON recognition_group (updated_at DESC, group_id ASC);
  `,
  `
    CREATE INDEX IF NOT EXISTS idx_recognition_member_asset
      ON recognition_member (asset_id, group_id);
  `,
  `
    CREATE INDEX IF NOT EXISTS idx_user_decision_decided_at
      ON user_decision (decision, decided_at DESC, asset_id ASC);
  `,
];
