use std::fs;
use std::path::Path;

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};

pub const CLEANUP_PLAN_SCHEMA_VERSION: &str = "media-clean-cleanup-plan/v0.1";
pub const QUARANTINE_RESULT_SCHEMA_VERSION: &str = "media-clean-quarantine-result/v0.1";

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaCleanSession {
    pub schema_version: String,
    pub session_id: String,
    pub generated_at: String,
    pub source: SessionSource,
    pub engine: SessionEngine,
    pub assets: Vec<SessionAsset>,
    pub clusters: Vec<Cluster>,
    pub llm_reviews: Vec<LlmReview>,
    pub cleanup_plans: Vec<CleanupPlan>,
    pub quarantine_actions: Vec<QuarantineAction>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub diagnostics: Vec<Diagnostic>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SessionSource {
    pub kind: String,
    pub root: String,
    pub platform: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SessionEngine {
    pub kind: String,
    pub name: String,
    pub version: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionAsset {
    pub id: String,
    pub uri: String,
    pub media_type: String,
    pub width: u32,
    pub height: u32,
    pub duration: Option<f64>,
    pub file_size: u64,
    pub created_at: String,
    pub metrics: Metrics,
    pub hashes: Hashes,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Metrics {
    pub brightness: f64,
    pub contrast: f64,
    pub edge_density: f64,
    pub blur_score: f64,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Hashes {
    pub content_hash: Option<String>,
    pub perceptual_hash: Option<String>,
    pub difference_hash: Option<String>,
    #[serde(default)]
    pub frame_hashes: Vec<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Cluster {
    pub id: String,
    pub category: String,
    pub asset_ids: Vec<String>,
    pub representative_asset_id: String,
    pub score: f64,
    pub reasons: Vec<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LlmReview {
    pub cluster_id: String,
    pub provider: String,
    pub model: String,
    pub prompt_version: String,
    pub category: String,
    pub confidence: String,
    pub cleanup_reason: String,
    pub keep_reason: Option<String>,
    pub risk: String,
    pub suggested_action: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanupPlan {
    pub id: String,
    pub cluster_id: String,
    pub action: String,
    pub asset_ids: Vec<String>,
    pub requires_confirmation: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuarantineAction {
    pub plan_id: String,
    pub mode: String,
    pub status: String,
    pub asset_ids: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Diagnostic {
    pub code: String,
    pub severity: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub asset_id: Option<String>,
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanupPlanDocument {
    pub schema_version: String,
    pub source_session_id: String,
    pub generated_at: String,
    pub plans: Vec<CleanupPlan>,
    pub assets: Vec<CleanupPlanAsset>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanupPlanAsset {
    pub id: String,
    pub uri: String,
    pub media_type: String,
    pub file_size: u64,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuarantineDryRunResult {
    pub schema_version: String,
    pub source_session_id: String,
    pub mode: String,
    pub dry_run: bool,
    pub generated_at: String,
    pub actions: Vec<QuarantineAction>,
}

pub fn write_json_pretty<T: Serialize>(path: &Path, value: &T) -> Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .with_context(|| format!("create output directory {}", parent.display()))?;
    }
    let data = serde_json::to_vec_pretty(value)?;
    fs::write(path, data).with_context(|| format!("write {}", path.display()))
}
