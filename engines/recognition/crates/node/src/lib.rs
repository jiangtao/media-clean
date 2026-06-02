use std::path::PathBuf;

use mc_cli::core_adapter::{analyze_scan_request, build_cleanup_plan};
use mc_cli::filesystem::{build_scan_request_with_options, MediaFilter, ScanBuildOptions};
use mc_cli::media_probe::ProbeOptions;
use mc_cli::model::write_json_pretty;
use napi_derive::napi;
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ScanDirectoryInput {
    root: PathBuf,
    session_id: Option<String>,
    session_path: Option<PathBuf>,
    cleanup_plan_path: Option<PathBuf>,
    media_type: Option<String>,
    progress: Option<bool>,
    video_frame_timeout_ms: Option<u64>,
    video_frame_cache: Option<bool>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ScanDirectoryOutput {
    mode: &'static str,
    session_id: String,
    session: String,
    cleanup_plan: String,
    asset_count: usize,
    cluster_count: usize,
    cleanup_plan_count: usize,
    diagnostic_count: usize,
}

#[napi]
pub fn analyze_request_json(input: String) -> napi::Result<String> {
    let request = serde_json::from_str::<mc_core::CoreScanRequest>(&input).map_err(to_napi_error)?;
    let session = mc_core::analyze_request(request).map_err(to_napi_error)?;
    serde_json::to_string(&session).map_err(to_napi_error)
}

#[napi]
pub fn scan_directory_json(input: String) -> napi::Result<String> {
    let input = serde_json::from_str::<ScanDirectoryInput>(&input).map_err(to_napi_error)?;
    let session_id = safe_session_id(input.session_id.as_deref().unwrap_or("desktop-napi"));
    let session_path = input
        .session_path
        .unwrap_or_else(|| PathBuf::from(".mc").join(&session_id).join("session.json"));
    let cleanup_plan_path = input
        .cleanup_plan_path
        .unwrap_or_else(|| PathBuf::from(".mc").join(&session_id).join("cleanup-plan.json"));
    let (request, diagnostics) = build_scan_request_with_options(
        &input.root,
        &ScanBuildOptions {
            media_filter: media_filter(input.media_type.as_deref()),
            progress: input.progress.unwrap_or(true),
            probe: ProbeOptions {
                progress: input.progress.unwrap_or(true),
                video_frame_cache: input.video_frame_cache.unwrap_or(true),
                video_frame_timeout_ms: input.video_frame_timeout_ms.unwrap_or(15_000),
            },
        },
    )
    .map_err(to_napi_error)?;
    let mut session = analyze_scan_request(request, diagnostics).map_err(to_napi_error)?;
    session.session_id = session_id.clone();
    session.engine.name = "mc-rust-napi".to_string();
    session.engine.version = env!("CARGO_PKG_VERSION").to_string();
    let cleanup_plan = build_cleanup_plan(&session);
    write_json_pretty(&session_path, &session).map_err(to_napi_error)?;
    write_json_pretty(&cleanup_plan_path, &cleanup_plan).map_err(to_napi_error)?;

    let output = ScanDirectoryOutput {
        mode: "napi",
        session_id,
        session: session_path.to_string_lossy().into_owned(),
        cleanup_plan: cleanup_plan_path.to_string_lossy().into_owned(),
        asset_count: session.assets.len(),
        cluster_count: session.clusters.len(),
        cleanup_plan_count: cleanup_plan.plans.len(),
        diagnostic_count: session.diagnostics.len(),
    };
    serde_json::to_string(&output).map_err(to_napi_error)
}

fn media_filter(value: Option<&str>) -> MediaFilter {
    match value {
        Some("photo") => MediaFilter::Photo,
        Some("video") => MediaFilter::Video,
        _ => MediaFilter::All,
    }
}

fn safe_session_id(value: &str) -> String {
    let sanitized = value
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || matches!(character, '_' | '-' | '.') {
                character
            } else {
                '-'
            }
        })
        .collect::<String>();
    if sanitized.is_empty() {
        "session".to_string()
    } else {
        sanitized
    }
}

fn to_napi_error(error: impl std::fmt::Display) -> napi::Error {
    napi::Error::from_reason(error.to_string())
}
