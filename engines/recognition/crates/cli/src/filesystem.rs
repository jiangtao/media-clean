use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Instant, SystemTime, UNIX_EPOCH};

use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use percent_encoding::{utf8_percent_encode, NON_ALPHANUMERIC};
use sha2::{Digest, Sha256};
use walkdir::WalkDir;

use crate::media_probe::{probe_media_with_options, MediaKind, ProbeOptions};
use crate::model::Diagnostic;
use mc_core::{
    AssetIdentity, AssetInput, AssetSamples, CoreScanRequest, EngineInfo, EngineKind, HashKind,
    MediaMetadata, MediaType, ScanOptions, ScanSource, SourceKind, SourcePlatform, SourceRef,
    VideoFramePolicy, VideoFramePolicyKind,
};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum MediaFilter {
    All,
    Photo,
    Video,
}

#[derive(Clone, Debug)]
pub struct ScanBuildOptions {
    pub media_filter: MediaFilter,
    pub progress: bool,
    pub probe: ProbeOptions,
}

impl Default for ScanBuildOptions {
    fn default() -> Self {
        Self {
            media_filter: MediaFilter::All,
            progress: true,
            probe: ProbeOptions::default(),
        }
    }
}

pub fn build_scan_request_with_options(
    root: &Path,
    options: &ScanBuildOptions,
) -> Result<(CoreScanRequest, Vec<Diagnostic>)> {
    let root = root
        .canonicalize()
        .with_context(|| format!("resolve scan root {}", root.display()))?;
    let mut diagnostics = Vec::new();
    let mut paths = collect_media_paths(&root)?;
    paths.sort();
    paths.retain(|path| media_filter_matches(path, options.media_filter));

    let mut assets = Vec::with_capacity(paths.len());
    let progress = ScanProgress::new(options.progress, paths.len());
    progress.start(&root, options.media_filter);
    for (index, path) in paths.iter().enumerate() {
        progress.before_asset(index, path);
        match build_asset_input(&root, path, &options.probe) {
            Ok((asset, asset_diagnostics)) => {
                diagnostics.extend(asset_diagnostics);
                assets.push(asset);
            }
            Err(error) => diagnostics.push(Diagnostic {
                code: "asset-probe-failed".to_string(),
                severity: "warning".to_string(),
                asset_id: None,
                message: format!("{}: {error:#}", path.display()),
            }),
        }
        progress.after_asset(index + 1, assets.len(), diagnostics.len());
    }
    progress.finish(assets.len(), diagnostics.len());

    Ok((
        CoreScanRequest {
            schema_version: mc_core::SESSION_SCHEMA_VERSION.to_string(),
            source: ScanSource {
                kind: SourceKind::DesktopFilesystem,
                root: root.to_string_lossy().into_owned(),
                platform: current_platform(),
            },
            engine: EngineInfo {
                kind: EngineKind::DesktopRust,
                name: "mc-rust-cli".to_string(),
                version: env!("CARGO_PKG_VERSION").to_string(),
                algorithm_version: mc_core::CORE_ALGORITHM_VERSION.to_string(),
            },
            options: ScanOptions {
                hash: vec![
                    HashKind::Content,
                    HashKind::Perceptual,
                    HashKind::Difference,
                    HashKind::Frame,
                ],
                thresholds: Default::default(),
                video_frame_policy: VideoFramePolicy {
                    kind: VideoFramePolicyKind::BoundedRepresentativeFrames,
                    sample_points: vec![0.05, 0.5, 0.95],
                    short_video_threshold_ms: 3_000,
                },
                max_assets: None,
            },
            assets,
        },
        diagnostics,
    ))
}

fn collect_media_paths(root: &Path) -> Result<Vec<PathBuf>> {
    let mut paths = Vec::new();
    for entry in WalkDir::new(root).follow_links(false).sort_by_file_name() {
        let entry = entry.with_context(|| format!("walk {}", root.display()))?;
        if !entry.file_type().is_file() {
            continue;
        }
        let path = entry.path();
        if is_supported_media(path) {
            paths.push(path.to_path_buf());
        }
    }
    Ok(paths)
}

fn build_asset_input(
    root: &Path,
    path: &Path,
    probe_options: &ProbeOptions,
) -> Result<(AssetInput, Vec<Diagnostic>)> {
    let metadata = fs::metadata(path).with_context(|| format!("stat {}", path.display()))?;
    let relative = path
        .strip_prefix(root)
        .unwrap_or(path)
        .to_string_lossy()
        .replace('\\', "/");
    let stable_key = stable_key(&relative, metadata.len(), metadata.modified().ok());
    let id = stable_id(&stable_key);
    let probe = probe_media_with_options(path, &id, probe_options)?;
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    let mime_type = mime_guess::from_path(path)
        .first()
        .map(|mime| mime.essence_str().to_string());
    let modified_time = metadata.modified().unwrap_or(UNIX_EPOCH);
    let modified_at = metadata_time(modified_time);
    let created_at = metadata
        .created()
        .ok()
        .map(metadata_time)
        .unwrap_or_else(|| modified_at.clone());
    let media_type = match probe.kind {
        MediaKind::Photo => MediaType::Photo,
        MediaKind::Video => MediaType::Video,
    };

    Ok((
        AssetInput {
            identity: AssetIdentity {
                id,
                uri: file_uri(path),
                relative_path: Some(relative),
                stable_key: Some(stable_key),
            },
            media: MediaMetadata {
                media_type,
                mime_type,
                extension: Some(extension),
                width: probe.width,
                height: probe.height,
                duration_ms: probe.duration_ms,
                file_size: metadata.len(),
                created_at,
                modified_at: Some(modified_at),
            },
            source_ref: Some(SourceRef::FilePath {
                path: path.to_path_buf(),
                byte_length: Some(metadata.len()),
            }),
            samples: AssetSamples {
                primary_image: probe.primary_image,
                thumbnail: None,
                video_frames: probe.video_frames,
            },
        },
        probe.diagnostics,
    ))
}

fn media_filter_matches(path: &Path, filter: MediaFilter) -> bool {
    match filter {
        MediaFilter::All => true,
        MediaFilter::Photo => !is_video(path),
        MediaFilter::Video => is_video(path),
    }
}

fn is_supported_media(path: &Path) -> bool {
    let Some(extension) = path.extension().and_then(|value| value.to_str()) else {
        return false;
    };
    matches!(
        extension.to_ascii_lowercase().as_str(),
        "jpg" | "jpeg" | "png" | "webp" | "gif" | "mp4" | "mov" | "m4v" | "webm"
    )
}

fn is_video(path: &Path) -> bool {
    matches!(
        path.extension()
            .and_then(|value| value.to_str())
            .map(|value| value.to_ascii_lowercase())
            .as_deref(),
        Some("mp4" | "mov" | "m4v" | "webm")
    )
}

struct ScanProgress {
    enabled: bool,
    total: usize,
    started_at: Instant,
    last_report: std::cell::Cell<Instant>,
}

impl ScanProgress {
    fn new(enabled: bool, total: usize) -> Self {
        let now = Instant::now();
        Self {
            enabled,
            total,
            started_at: now,
            last_report: std::cell::Cell::new(now),
        }
    }

    fn start(&self, root: &Path, filter: MediaFilter) {
        if !self.enabled {
            return;
        }
        eprintln!(
            "[mc scan] root={} media_type={filter:?} assets={}",
            root.display(),
            self.total
        );
    }

    fn before_asset(&self, index: usize, path: &Path) {
        if !self.enabled || !is_video(path) {
            return;
        }
        eprintln!(
            "[mc scan] probing video {}/{} {}",
            index + 1,
            self.total,
            path.display()
        );
    }

    fn after_asset(&self, processed: usize, assets: usize, diagnostics: usize) {
        if !self.enabled {
            return;
        }
        let now = Instant::now();
        let should_report = processed == self.total
            || processed % 500 == 0
            || now.duration_since(self.last_report.get()).as_secs() >= 10;
        if !should_report {
            return;
        }
        self.last_report.set(now);
        eprintln!(
            "[mc scan] processed={processed}/{} assets={assets} diagnostics={diagnostics} elapsed={}s",
            self.total,
            now.duration_since(self.started_at).as_secs()
        );
    }

    fn finish(&self, assets: usize, diagnostics: usize) {
        if !self.enabled {
            return;
        }
        eprintln!(
            "[mc scan] build request complete assets={assets} diagnostics={diagnostics} elapsed={}s",
            self.started_at.elapsed().as_secs()
        );
    }
}

fn stable_key(relative: &str, len: u64, modified: Option<SystemTime>) -> String {
    let modified_ms = modified
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis())
        .unwrap_or_default();
    format!("{relative}:{len}:{modified_ms}")
}

fn stable_id(stable_key: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(stable_key.as_bytes());
    format!("asset-{}", &hex::encode(hasher.finalize())[..16])
}

pub fn file_uri(path: &Path) -> String {
    let absolute = path.canonicalize().unwrap_or_else(|_| path.to_path_buf());
    let raw = absolute.to_string_lossy().replace('\\', "/");
    let encoded = raw
        .split('/')
        .map(|segment| utf8_percent_encode(segment, NON_ALPHANUMERIC).to_string())
        .collect::<Vec<_>>()
        .join("/");
    if cfg!(windows) {
        format!("file:///{encoded}")
    } else {
        format!("file://{encoded}")
    }
}

fn metadata_time(time: SystemTime) -> String {
    let datetime: DateTime<Utc> = time.into();
    datetime.to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
}

fn current_platform() -> SourcePlatform {
    match std::env::consts::OS {
        "macos" => SourcePlatform::Macos,
        "linux" => SourcePlatform::Linux,
        "windows" => SourcePlatform::Windows,
        _ => SourcePlatform::Linux,
    }
}
