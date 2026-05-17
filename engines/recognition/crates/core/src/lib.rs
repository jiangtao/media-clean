use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};

use chrono::{DateTime, SecondsFormat, Utc};
use image::imageops::FilterType;
use image::{DynamicImage, ImageError};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use thiserror::Error;

pub const SESSION_SCHEMA_VERSION: &str = "media-clean-result/v0.5";
pub const CORE_ALGORITHM_VERSION: &str = "rust-core/v0.5.0";

#[derive(Debug, Error)]
pub enum CoreError {
    #[error("asset `{asset_id}` has no readable image source")]
    MissingImageSource { asset_id: String },
    #[error("failed to read source `{path}`: {source}")]
    SourceRead {
        path: PathBuf,
        #[source]
        source: std::io::Error,
    },
    #[error("failed to decode image for asset `{asset_id}`: {source}")]
    ImageDecode {
        asset_id: String,
        #[source]
        source: ImageError,
    },
}

pub type CoreResult<T> = Result<T, CoreError>;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CoreScanRequest {
    pub schema_version: String,
    pub source: ScanSource,
    pub engine: EngineInfo,
    pub options: ScanOptions,
    pub assets: Vec<AssetInput>,
}

impl CoreScanRequest {
    pub fn new(source: ScanSource, engine: EngineInfo, assets: Vec<AssetInput>) -> Self {
        Self {
            schema_version: SESSION_SCHEMA_VERSION.to_string(),
            source,
            engine,
            options: ScanOptions::default(),
            assets,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ScanSource {
    pub kind: SourceKind,
    pub root: String,
    pub platform: SourcePlatform,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum SourceKind {
    AndroidMediaStore,
    DesktopFilesystem,
    Fixture,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum SourcePlatform {
    Android,
    Macos,
    Linux,
    Windows,
    Fixture,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct EngineInfo {
    pub kind: EngineKind,
    pub name: String,
    pub version: String,
    pub algorithm_version: String,
}

impl EngineInfo {
    pub fn core_default() -> Self {
        Self {
            kind: EngineKind::DesktopRust,
            name: "mc-recognition-core".to_string(),
            version: env!("CARGO_PKG_VERSION").to_string(),
            algorithm_version: CORE_ALGORITHM_VERSION.to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum EngineKind {
    AndroidNative,
    DesktopRust,
    DesktopGo,
    NodeWrapper,
    Fixture,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ScanOptions {
    pub hash: Vec<HashKind>,
    pub thresholds: ThresholdOptions,
    pub video_frame_policy: VideoFramePolicy,
    pub max_assets: Option<usize>,
}

impl Default for ScanOptions {
    fn default() -> Self {
        Self {
            hash: vec![
                HashKind::Content,
                HashKind::Perceptual,
                HashKind::Difference,
                HashKind::Frame,
            ],
            thresholds: ThresholdOptions::default(),
            video_frame_policy: VideoFramePolicy::default(),
            max_assets: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum HashKind {
    Content,
    Perceptual,
    Difference,
    Frame,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ThresholdOptions {
    pub low_brightness: f64,
    pub low_contrast: f64,
    pub low_edge_density: f64,
    pub high_blur_score: f64,
}

impl Default for ThresholdOptions {
    fn default() -> Self {
        Self {
            low_brightness: 0.26,
            low_contrast: 0.14,
            low_edge_density: 0.12,
            high_blur_score: 0.74,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct VideoFramePolicy {
    pub kind: VideoFramePolicyKind,
    pub sample_points: Vec<f64>,
    pub short_video_threshold_ms: u64,
}

impl Default for VideoFramePolicy {
    fn default() -> Self {
        Self {
            kind: VideoFramePolicyKind::BoundedRepresentativeFrames,
            sample_points: vec![0.05, 0.5, 0.95],
            short_video_threshold_ms: 3_000,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum VideoFramePolicyKind {
    MetadataOnly,
    BoundedRepresentativeFrames,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AssetInput {
    pub identity: AssetIdentity,
    pub media: MediaMetadata,
    pub source_ref: Option<SourceRef>,
    pub samples: AssetSamples,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AssetIdentity {
    pub id: String,
    pub uri: String,
    pub relative_path: Option<String>,
    pub stable_key: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MediaMetadata {
    pub media_type: MediaType,
    pub mime_type: Option<String>,
    pub extension: Option<String>,
    pub width: u32,
    pub height: u32,
    pub duration_ms: Option<u64>,
    pub file_size: u64,
    pub created_at: String,
    pub modified_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum MediaType {
    Photo,
    Video,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum SourceRef {
    FilePath {
        path: PathBuf,
        byte_length: Option<u64>,
    },
    TempFile {
        path: PathBuf,
        byte_length: Option<u64>,
    },
    Bytes {
        bytes: Vec<u8>,
        byte_length: Option<u64>,
    },
    Opaque {
        byte_length: Option<u64>,
    },
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AssetSamples {
    pub primary_image: Option<SourceRef>,
    pub thumbnail: Option<SourceRef>,
    pub video_frames: Vec<VideoFrameSample>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct VideoFrameSample {
    pub timestamp_ms: u64,
    pub source_ref: SourceRef,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub extraction_method: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MediaCleanSession {
    pub schema_version: String,
    pub session_id: String,
    pub generated_at: String,
    pub source: ScanSource,
    pub engine: SessionEngine,
    pub assets: Vec<AnalyzedAsset>,
    pub clusters: Vec<Cluster>,
    pub llm_reviews: Vec<LlmReview>,
    pub cleanup_plans: Vec<CleanupPlan>,
    pub quarantine_actions: Vec<QuarantineAction>,
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub diagnostics: Vec<Diagnostic>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SessionEngine {
    pub kind: EngineKind,
    pub name: String,
    pub version: String,
}

impl From<&EngineInfo> for SessionEngine {
    fn from(value: &EngineInfo) -> Self {
        Self {
            kind: value.kind.clone(),
            name: value.name.clone(),
            version: value.version.clone(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AnalyzedAsset {
    pub id: String,
    pub uri: String,
    pub media_type: MediaType,
    pub width: u32,
    pub height: u32,
    pub duration: Option<f64>,
    pub file_size: u64,
    pub created_at: String,
    pub metrics: VisualMetrics,
    pub hashes: AssetHashes,
    #[serde(skip_serializing)]
    pub frame_analyses: Vec<FrameAnalysis>,
    #[serde(skip_serializing)]
    pub candidates: Vec<Candidate>,
    #[serde(skip_serializing)]
    pub scores: Vec<Score>,
    #[serde(skip_serializing)]
    pub reasons: Vec<String>,
    #[serde(skip_serializing)]
    pub algorithm_version: String,
}

#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct VisualMetrics {
    pub brightness: f64,
    pub contrast: f64,
    pub edge_density: f64,
    pub blur_score: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AssetHashes {
    pub content_hash: Option<String>,
    pub perceptual_hash: Option<String>,
    pub difference_hash: Option<String>,
    #[serde(default)]
    pub frame_hashes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FrameAnalysis {
    pub timestamp_ms: u64,
    pub metrics: VisualMetrics,
    pub perceptual_hash: Option<String>,
    pub difference_hash: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Candidate {
    pub category: ClusterCategory,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Score {
    pub name: String,
    pub value: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Cluster {
    pub id: String,
    pub category: ClusterCategory,
    pub asset_ids: Vec<String>,
    pub representative_asset_id: String,
    pub score: f64,
    pub reasons: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ClusterCategory {
    Duplicate,
    NearSimilar,
    Blurry,
    LowValue,
    Screenshot,
    Document,
    Video,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LlmReview {
    pub cluster_id: String,
    pub provider: String,
    pub model: String,
    pub prompt_version: String,
    pub category: ClusterCategory,
    pub confidence: String,
    pub cleanup_reason: String,
    pub keep_reason: Option<String>,
    pub risk: String,
    pub suggested_action: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CleanupPlan {
    pub id: String,
    pub cluster_id: String,
    pub action: String,
    pub asset_ids: Vec<String>,
    pub requires_confirmation: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct QuarantineAction {
    pub plan_id: String,
    pub mode: String,
    pub status: String,
    pub asset_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct Diagnostic {
    pub code: String,
    pub severity: DiagnosticSeverity,
    pub asset_id: Option<String>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum DiagnosticSeverity {
    Info,
    Warning,
    Error,
}

pub fn analyze_request(request: CoreScanRequest) -> CoreResult<MediaCleanSession> {
    let generated_at = Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true);
    analyze_request_with_time(request, &generated_at)
}

pub fn analyze_request_with_time(
    request: CoreScanRequest,
    generated_at: &str,
) -> CoreResult<MediaCleanSession> {
    let mut assets = Vec::new();
    let mut diagnostics = Vec::new();

    let max_assets = request.options.max_assets.unwrap_or(request.assets.len());
    for input in request.assets.iter().take(max_assets) {
        let analyzed = match input.media.media_type {
            MediaType::Photo => analyze_photo(input, &request.options)?,
            MediaType::Video => analyze_video(input, &request.options, &mut diagnostics)?,
        };
        assets.push(analyzed);
    }

    let clusters = build_clusters(&assets);

    Ok(MediaCleanSession {
        schema_version: SESSION_SCHEMA_VERSION.to_string(),
        session_id: session_id(&request),
        generated_at: generated_at.to_string(),
        source: request.source,
        engine: SessionEngine::from(&request.engine),
        assets,
        clusters,
        llm_reviews: Vec::new(),
        cleanup_plans: Vec::new(),
        quarantine_actions: Vec::new(),
        diagnostics,
    })
}

fn analyze_photo(input: &AssetInput, options: &ScanOptions) -> CoreResult<AnalyzedAsset> {
    let source = image_source_for(input).ok_or_else(|| CoreError::MissingImageSource {
        asset_id: input.identity.id.clone(),
    })?;
    let bytes = read_source(source)?;
    let decoded = image::load_from_memory(&bytes).map_err(|source| CoreError::ImageDecode {
        asset_id: input.identity.id.clone(),
        source,
    })?;
    let frame = analyze_dynamic_image(&decoded, None);
    let reasons = low_value_reasons(frame.metrics, &options.thresholds);

    Ok(AnalyzedAsset {
        id: input.identity.id.clone(),
        uri: input.identity.uri.clone(),
        media_type: MediaType::Photo,
        width: normalized_width(input, decoded.width()),
        height: normalized_height(input, decoded.height()),
        duration: None,
        file_size: normalized_file_size(input, bytes.len() as u64),
        created_at: input.media.created_at.clone(),
        metrics: frame.metrics,
        hashes: AssetHashes {
            content_hash: Some(sha256_hex(&bytes)),
            perceptual_hash: frame.perceptual_hash.clone(),
            difference_hash: frame.difference_hash.clone(),
            frame_hashes: frame.perceptual_hash.iter().cloned().collect(),
        },
        frame_analyses: Vec::new(),
        candidates: candidate_from_reasons(&reasons),
        scores: score_from_reasons(&reasons),
        reasons,
        algorithm_version: CORE_ALGORITHM_VERSION.to_string(),
    })
}

fn analyze_video(
    input: &AssetInput,
    options: &ScanOptions,
    diagnostics: &mut Vec<Diagnostic>,
) -> CoreResult<AnalyzedAsset> {
    let content_hash = input
        .source_ref
        .as_ref()
        .filter(|source| !matches!(source, SourceRef::Opaque { .. }))
        .and_then(|source| read_source(source).ok())
        .map(|bytes| sha256_hex(&bytes));

    if input.samples.video_frames.is_empty()
        || options.video_frame_policy.kind == VideoFramePolicyKind::MetadataOnly
    {
        diagnostics.push(Diagnostic {
            code: "video-frame-unavailable".to_string(),
            severity: DiagnosticSeverity::Warning,
            asset_id: Some(input.identity.id.clone()),
            message: "No representative video frames were supplied to the platform-neutral core."
                .to_string(),
        });

        return Ok(AnalyzedAsset {
            id: input.identity.id.clone(),
            uri: input.identity.uri.clone(),
            media_type: MediaType::Video,
            width: input.media.width,
            height: input.media.height,
            duration: duration_seconds(input),
            file_size: input.media.file_size,
            created_at: input.media.created_at.clone(),
            metrics: VisualMetrics::default(),
            hashes: AssetHashes {
                content_hash,
                perceptual_hash: None,
                difference_hash: None,
                frame_hashes: Vec::new(),
            },
            frame_analyses: Vec::new(),
            candidates: Vec::new(),
            scores: Vec::new(),
            reasons: vec!["video-frame-unavailable".to_string()],
            algorithm_version: CORE_ALGORITHM_VERSION.to_string(),
        });
    }

    let mut frames = Vec::new();
    for sample in &input.samples.video_frames {
        let bytes = read_source(&sample.source_ref)?;
        let decoded = image::load_from_memory(&bytes).map_err(|source| CoreError::ImageDecode {
            asset_id: input.identity.id.clone(),
            source,
        })?;
        frames.push(analyze_dynamic_image(&decoded, Some(sample.timestamp_ms)));
    }

    let frame_hashes = frames
        .iter()
        .filter_map(|frame| frame.perceptual_hash.clone())
        .collect::<Vec<_>>();
    let difference_hashes = frames
        .iter()
        .filter_map(|frame| frame.difference_hash.clone())
        .collect::<Vec<_>>();
    let metrics = aggregate_metrics(&frames);
    let reasons = video_reasons(&frames, metrics, &options.thresholds);

    Ok(AnalyzedAsset {
        id: input.identity.id.clone(),
        uri: input.identity.uri.clone(),
        media_type: MediaType::Video,
        width: input.media.width,
        height: input.media.height,
        duration: duration_seconds(input),
        file_size: input.media.file_size,
        created_at: input.media.created_at.clone(),
        metrics,
        hashes: AssetHashes {
            content_hash,
            perceptual_hash: combine_hashes(&frame_hashes),
            difference_hash: combine_hashes(&difference_hashes),
            frame_hashes,
        },
        frame_analyses: frames,
        candidates: candidate_from_reasons(&reasons),
        scores: score_from_reasons(&reasons),
        reasons,
        algorithm_version: CORE_ALGORITHM_VERSION.to_string(),
    })
}

fn image_source_for(input: &AssetInput) -> Option<&SourceRef> {
    input
        .samples
        .primary_image
        .as_ref()
        .or(input.samples.thumbnail.as_ref())
        .or(input.source_ref.as_ref())
}

fn read_source(source: &SourceRef) -> CoreResult<Vec<u8>> {
    match source {
        SourceRef::FilePath { path, .. } | SourceRef::TempFile { path, .. } => {
            read_path_source(path)
        }
        SourceRef::Bytes { bytes, .. } => Ok(bytes.clone()),
        SourceRef::Opaque { .. } => Ok(Vec::new()),
    }
}

fn read_path_source(path: &Path) -> CoreResult<Vec<u8>> {
    fs::read(path).map_err(|source| CoreError::SourceRead {
        path: path.to_path_buf(),
        source,
    })
}

fn analyze_dynamic_image(image: &DynamicImage, timestamp_ms: Option<u64>) -> FrameAnalysis {
    let gray = image.resize_exact(48, 48, FilterType::Triangle).to_luma8();
    let grayscale = gray.as_raw();
    let metrics = calculate_metrics(grayscale, 48, 48);

    FrameAnalysis {
        timestamp_ms: timestamp_ms.unwrap_or(0),
        metrics,
        perceptual_hash: Some(average_hash(image)),
        difference_hash: Some(difference_hash(image)),
    }
}

fn calculate_metrics(grayscale: &[u8], width: usize, height: usize) -> VisualMetrics {
    if grayscale.is_empty() {
        return VisualMetrics::default();
    }

    let normalized = grayscale
        .iter()
        .map(|value| f64::from(*value) / 255.0)
        .collect::<Vec<_>>();
    let brightness = normalized.iter().sum::<f64>() / normalized.len() as f64;
    let variance = normalized
        .iter()
        .map(|value| {
            let delta = value - brightness;
            delta * delta
        })
        .sum::<f64>()
        / normalized.len() as f64;
    let contrast = variance.sqrt().clamp(0.0, 1.0);

    let mut edges = 0usize;
    let mut total = 0usize;
    let mut laplacian_sum = 0.0;
    if width >= 3 && height >= 3 {
        for y in 1..height - 1 {
            for x in 1..width - 1 {
                let top_left = grayscale[(y - 1) * width + (x - 1)] as i32;
                let top = grayscale[(y - 1) * width + x] as i32;
                let top_right = grayscale[(y - 1) * width + (x + 1)] as i32;
                let left = grayscale[y * width + (x - 1)] as i32;
                let center = grayscale[y * width + x] as i32;
                let right = grayscale[y * width + (x + 1)] as i32;
                let bottom_left = grayscale[(y + 1) * width + (x - 1)] as i32;
                let bottom = grayscale[(y + 1) * width + x] as i32;
                let bottom_right = grayscale[(y + 1) * width + (x + 1)] as i32;

                let gx =
                    -top_left + top_right - (2 * left) + (2 * right) - bottom_left + bottom_right;
                let gy =
                    -top_left - (2 * top) - top_right + bottom_left + (2 * bottom) + bottom_right;
                let magnitude = ((gx * gx + gy * gy) as f64).sqrt() / 1020.0;
                if magnitude > 0.18 {
                    edges += 1;
                }

                let laplacian =
                    (4 * center - top - left - right - bottom).unsigned_abs() as f64 / 1020.0;
                laplacian_sum += laplacian;
                total += 1;
            }
        }
    }

    let edge_density = if total > 0 {
        edges as f64 / total as f64
    } else {
        0.0
    };
    let sharpness = if total > 0 {
        laplacian_sum / total as f64
    } else {
        0.0
    };

    VisualMetrics {
        brightness: round4(brightness.clamp(0.0, 1.0)),
        contrast: round4(contrast),
        edge_density: round4(edge_density.clamp(0.0, 1.0)),
        blur_score: round4((1.0 - sharpness * 8.0).clamp(0.0, 1.0)),
    }
}

fn average_hash(image: &DynamicImage) -> String {
    let gray = image.resize_exact(8, 8, FilterType::Triangle).to_luma8();
    let grayscale = gray.as_raw();
    let average = grayscale.iter().map(|value| u64::from(*value)).sum::<u64>() as f64
        / grayscale.len() as f64;
    let mut hash = 0u64;
    for (index, value) in grayscale.iter().enumerate() {
        if f64::from(*value) >= average {
            hash |= 1u64 << index;
        }
    }
    format!("{hash:016x}")
}

fn difference_hash(image: &DynamicImage) -> String {
    let gray = image.resize_exact(9, 8, FilterType::Triangle).to_luma8();
    let grayscale = gray.as_raw();
    let mut hash = 0u64;
    let mut bit_index = 0u64;
    for y in 0..8 {
        for x in 0..8 {
            let left = grayscale[y * 9 + x];
            let right = grayscale[y * 9 + x + 1];
            if left >= right {
                hash |= 1u64 << bit_index;
            }
            bit_index += 1;
        }
    }
    format!("{hash:016x}")
}

fn aggregate_metrics(frames: &[FrameAnalysis]) -> VisualMetrics {
    VisualMetrics {
        brightness: median(
            frames
                .iter()
                .map(|frame| frame.metrics.brightness)
                .collect(),
        ),
        contrast: median(frames.iter().map(|frame| frame.metrics.contrast).collect()),
        edge_density: median(
            frames
                .iter()
                .map(|frame| frame.metrics.edge_density)
                .collect(),
        ),
        blur_score: median(
            frames
                .iter()
                .map(|frame| frame.metrics.blur_score)
                .collect(),
        ),
    }
}

fn median(mut values: Vec<f64>) -> f64 {
    if values.is_empty() {
        return 0.0;
    }
    values.sort_by(|left, right| left.total_cmp(right));
    let mid = values.len() / 2;
    if values.len() % 2 == 0 {
        round4((values[mid - 1] + values[mid]) / 2.0)
    } else {
        round4(values[mid])
    }
}

fn combine_hashes(hashes: &[String]) -> Option<String> {
    if hashes.is_empty() {
        return None;
    }

    let mut accumulator = 0u64;
    for hash in hashes {
        if let Ok(value) = u64::from_str_radix(&hash[..hash.len().min(16)], 16) {
            accumulator ^= value;
        }
    }

    Some(format!("{accumulator:016x}"))
}

fn low_value_reasons(metrics: VisualMetrics, thresholds: &ThresholdOptions) -> Vec<String> {
    let mut reasons = Vec::new();
    if metrics.brightness < thresholds.low_brightness {
        reasons.push("low-brightness".to_string());
    }
    if metrics.contrast < thresholds.low_contrast {
        reasons.push("low-contrast".to_string());
    }
    if metrics.edge_density < thresholds.low_edge_density {
        reasons.push("low-edge-density".to_string());
    }
    if metrics.blur_score >= thresholds.high_blur_score {
        reasons.push("high-blur-score".to_string());
    }
    reasons
}

fn video_reasons(
    frames: &[FrameAnalysis],
    metrics: VisualMetrics,
    thresholds: &ThresholdOptions,
) -> Vec<String> {
    let all_low_value = frames
        .iter()
        .all(|frame| !low_value_reasons(frame.metrics, thresholds).is_empty());
    let repeated_frame_hashes = frames.len() > 1
        && frames
            .iter()
            .filter_map(|frame| frame.perceptual_hash.as_ref())
            .collect::<std::collections::HashSet<_>>()
            .len()
            == 1;

    let mut reasons = Vec::new();
    if all_low_value {
        reasons.push("all-representative-frames-low-value".to_string());
        reasons.extend(low_value_reasons(metrics, thresholds));
    }
    if repeated_frame_hashes {
        reasons.push("repeated-representative-frame-hash".to_string());
    }
    reasons
}

fn candidate_from_reasons(reasons: &[String]) -> Vec<Candidate> {
    if reasons.is_empty() {
        Vec::new()
    } else {
        vec![Candidate {
            category: ClusterCategory::LowValue,
            reason: reasons.join(","),
        }]
    }
}

fn score_from_reasons(reasons: &[String]) -> Vec<Score> {
    if reasons.is_empty() {
        Vec::new()
    } else {
        vec![Score {
            name: "lowValue".to_string(),
            value: (reasons.len() as f64 * 20.0).min(100.0),
        }]
    }
}

const NEAR_SIMILAR_HAMMING_THRESHOLD: u32 = 8;

fn build_clusters(assets: &[AnalyzedAsset]) -> Vec<Cluster> {
    let mut clusters = Vec::new();
    let mut clustered_asset_ids = HashSet::new();

    for cluster in build_duplicate_clusters(assets) {
        clustered_asset_ids.extend(cluster.asset_ids.iter().cloned());
        clusters.push(cluster);
    }

    for cluster in build_near_similar_clusters(assets, &clustered_asset_ids) {
        clustered_asset_ids.extend(cluster.asset_ids.iter().cloned());
        clusters.push(cluster);
    }

    clusters.extend(build_low_value_clusters(assets, &clustered_asset_ids));
    clusters
}

fn build_duplicate_clusters(assets: &[AnalyzedAsset]) -> Vec<Cluster> {
    let mut by_content_hash: HashMap<&str, Vec<&AnalyzedAsset>> = HashMap::new();
    for asset in assets
        .iter()
        .filter(|asset| asset.media_type == MediaType::Photo)
    {
        if let Some(content_hash) = asset.hashes.content_hash.as_deref() {
            by_content_hash.entry(content_hash).or_default().push(asset);
        }
    }

    let mut clusters = by_content_hash
        .into_values()
        .filter(|group| group.len() > 1)
        .map(|group| {
            let representative = group[0];
            Cluster {
                id: format!("cluster-duplicate-{}", representative.id),
                category: ClusterCategory::Duplicate,
                asset_ids: group.iter().map(|asset| asset.id.clone()).collect(),
                representative_asset_id: representative.id.clone(),
                score: 100.0,
                reasons: vec!["same-content-hash".to_string()],
            }
        })
        .collect::<Vec<_>>();
    clusters.sort_by(|left, right| left.id.cmp(&right.id));
    clusters
}

fn build_near_similar_clusters(
    assets: &[AnalyzedAsset],
    excluded_asset_ids: &HashSet<String>,
) -> Vec<Cluster> {
    let candidates = assets
        .iter()
        .enumerate()
        .filter(|(_, asset)| {
            asset.media_type == MediaType::Photo && !excluded_asset_ids.contains(&asset.id)
        })
        .filter_map(|(asset_index, asset)| {
            asset
                .hashes
                .perceptual_hash
                .as_deref()
                .and_then(parse_hash64)
                .map(|perceptual_hash| SimilarityCandidate {
                    asset_index,
                    perceptual_hash,
                    difference_hash: asset
                        .hashes
                        .difference_hash
                        .as_deref()
                        .and_then(parse_hash64),
                    metrics: asset.metrics,
                })
        })
        .collect::<Vec<_>>();

    let mut union_find = UnionFind::new(candidates.len());
    let mut buckets: HashMap<(usize, u16), Vec<usize>> = HashMap::new();
    for (candidate_position, candidate) in candidates.iter().enumerate() {
        for chunk_index in 0..4 {
            let bucket_key = (
                chunk_index,
                hash_chunk(candidate.perceptual_hash, chunk_index),
            );
            for other_position in buckets.get(&bucket_key).into_iter().flatten() {
                let other = &candidates[*other_position];
                if are_near_similar(candidate, other) {
                    union_find.union(candidate_position, *other_position);
                }
            }
            buckets
                .entry(bucket_key)
                .or_default()
                .push(candidate_position);
        }
    }

    let mut groups: HashMap<usize, Vec<&AnalyzedAsset>> = HashMap::new();
    for (candidate_position, candidate) in candidates.iter().enumerate() {
        let root = union_find.find(candidate_position);
        groups
            .entry(root)
            .or_default()
            .push(&assets[candidate.asset_index]);
    }

    let mut clusters = groups
        .into_values()
        .filter(|group| group.len() > 1)
        .map(|mut group| {
            group.sort_by(|left, right| left.id.cmp(&right.id));
            let representative = group[0];
            Cluster {
                id: format!("cluster-near-{}", representative.id),
                category: ClusterCategory::NearSimilar,
                asset_ids: group.iter().map(|asset| asset.id.clone()).collect(),
                representative_asset_id: representative.id.clone(),
                score: 92.0,
                reasons: vec![format!(
                    "perceptual-hash-distance<={NEAR_SIMILAR_HAMMING_THRESHOLD}"
                )],
            }
        })
        .collect::<Vec<_>>();
    clusters.sort_by(|left, right| left.id.cmp(&right.id));
    clusters
}

fn build_low_value_clusters(
    assets: &[AnalyzedAsset],
    excluded_asset_ids: &HashSet<String>,
) -> Vec<Cluster> {
    assets
        .iter()
        .filter(|asset| {
            !asset.reasons.is_empty()
                && asset.media_type == MediaType::Photo
                && !excluded_asset_ids.contains(&asset.id)
        })
        .map(|asset| Cluster {
            id: format!("cluster-{}", asset.id),
            category: ClusterCategory::LowValue,
            asset_ids: vec![asset.id.clone()],
            representative_asset_id: asset.id.clone(),
            score: asset
                .scores
                .first()
                .map(|score| score.value)
                .unwrap_or(50.0),
            reasons: asset.reasons.clone(),
        })
        .collect()
}

#[derive(Clone, Copy, Debug)]
struct SimilarityCandidate {
    asset_index: usize,
    perceptual_hash: u64,
    difference_hash: Option<u64>,
    metrics: VisualMetrics,
}

#[derive(Debug)]
struct UnionFind {
    parents: Vec<usize>,
    ranks: Vec<u8>,
}

impl UnionFind {
    fn new(len: usize) -> Self {
        Self {
            parents: (0..len).collect(),
            ranks: vec![0; len],
        }
    }

    fn find(&mut self, item: usize) -> usize {
        if self.parents[item] != item {
            self.parents[item] = self.find(self.parents[item]);
        }
        self.parents[item]
    }

    fn union(&mut self, left: usize, right: usize) {
        let left_root = self.find(left);
        let right_root = self.find(right);
        if left_root == right_root {
            return;
        }
        match self.ranks[left_root].cmp(&self.ranks[right_root]) {
            std::cmp::Ordering::Less => self.parents[left_root] = right_root,
            std::cmp::Ordering::Greater => self.parents[right_root] = left_root,
            std::cmp::Ordering::Equal => {
                self.parents[right_root] = left_root;
                self.ranks[left_root] += 1;
            }
        }
    }
}

fn parse_hash64(hash: &str) -> Option<u64> {
    u64::from_str_radix(hash.get(..16)?, 16).ok()
}

fn hash_chunk(hash: u64, chunk_index: usize) -> u16 {
    ((hash >> (chunk_index * 16)) & 0xffff) as u16
}

fn hamming_distance(left: u64, right: u64) -> u32 {
    (left ^ right).count_ones()
}

fn are_near_similar(left: &SimilarityCandidate, right: &SimilarityCandidate) -> bool {
    if hamming_distance(left.perceptual_hash, right.perceptual_hash)
        > NEAR_SIMILAR_HAMMING_THRESHOLD
    {
        return false;
    }
    if let (Some(left_hash), Some(right_hash)) = (left.difference_hash, right.difference_hash) {
        if hamming_distance(left_hash, right_hash) > NEAR_SIMILAR_HAMMING_THRESHOLD {
            return false;
        }
    }
    metrics_are_close(left.metrics, right.metrics)
}

fn metrics_are_close(left: VisualMetrics, right: VisualMetrics) -> bool {
    (left.brightness - right.brightness).abs() <= 0.10
        && (left.contrast - right.contrast).abs() <= 0.12
        && (left.edge_density - right.edge_density).abs() <= 0.12
        && (left.blur_score - right.blur_score).abs() <= 0.18
}

fn duration_seconds(input: &AssetInput) -> Option<f64> {
    input
        .media
        .duration_ms
        .map(|duration_ms| round4(duration_ms as f64 / 1000.0))
}

fn normalized_width(input: &AssetInput, decoded_width: u32) -> u32 {
    if input.media.width > 0 {
        input.media.width
    } else {
        decoded_width
    }
}

fn normalized_height(input: &AssetInput, decoded_height: u32) -> u32 {
    if input.media.height > 0 {
        input.media.height
    } else {
        decoded_height
    }
}

fn normalized_file_size(input: &AssetInput, byte_len: u64) -> u64 {
    if input.media.file_size > 0 {
        input.media.file_size
    } else {
        byte_len
    }
}

fn session_id(request: &CoreScanRequest) -> String {
    let mut digest = Sha256::new();
    digest.update(request.schema_version.as_bytes());
    digest.update(request.source.root.as_bytes());
    digest.update(request.engine.name.as_bytes());
    for asset in &request.assets {
        digest.update(asset.identity.id.as_bytes());
        digest.update(asset.identity.uri.as_bytes());
    }
    let hash = hex_digest(digest.finalize().as_slice());
    format!("rust-core-{}", &hash[..16])
}

fn sha256_hex(bytes: &[u8]) -> String {
    let mut digest = Sha256::new();
    digest.update(bytes);
    hex_digest(digest.finalize().as_slice())
}

fn hex_digest(bytes: &[u8]) -> String {
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

fn round4(value: f64) -> f64 {
    (value * 10_000.0).round() / 10_000.0
}

pub fn iso_now() -> String {
    DateTime::<Utc>::from(std::time::SystemTime::now()).to_rfc3339_opts(SecondsFormat::Millis, true)
}
