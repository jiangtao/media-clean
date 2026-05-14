use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Output, Stdio};
use std::thread;
use std::time::{Duration, UNIX_EPOCH};

use anyhow::{Context, Result};
use serde::Deserialize;
use sha2::{Digest, Sha256};
use tempfile::TempDir;

use crate::model::Diagnostic;
use mc_core::{SourceRef, VideoFrameSample};

#[derive(Debug)]
pub enum MediaKind {
    Photo,
    Video,
}

#[derive(Debug)]
pub struct MediaProbe {
    pub kind: MediaKind,
    pub width: u32,
    pub height: u32,
    pub duration_ms: Option<u64>,
    pub primary_image: Option<SourceRef>,
    pub video_frames: Vec<VideoFrameSample>,
    pub diagnostics: Vec<Diagnostic>,
}

#[derive(Clone, Debug)]
pub struct ProbeOptions {
    pub progress: bool,
    pub video_frame_cache: bool,
    pub video_frame_timeout_ms: u64,
}

impl Default for ProbeOptions {
    fn default() -> Self {
        Self {
            progress: true,
            video_frame_cache: true,
            video_frame_timeout_ms: 15_000,
        }
    }
}

pub fn probe_media_with_options(
    path: &Path,
    asset_id: &str,
    options: &ProbeOptions,
) -> Result<MediaProbe> {
    if is_video(path) {
        probe_video(path, asset_id, options)
    } else {
        probe_photo(path)
    }
}

fn probe_photo(path: &Path) -> Result<MediaProbe> {
    let (width, height) = image::image_dimensions(path)
        .with_context(|| format!("decode image dimensions {}", path.display()))?;
    let byte_length = fs::metadata(path)?.len();
    Ok(MediaProbe {
        kind: MediaKind::Photo,
        width,
        height,
        duration_ms: None,
        primary_image: Some(SourceRef::FilePath {
            path: path.to_path_buf(),
            byte_length: Some(byte_length),
        }),
        video_frames: Vec::new(),
        diagnostics: Vec::new(),
    })
}

fn probe_video(path: &Path, asset_id: &str, options: &ProbeOptions) -> Result<MediaProbe> {
    let mut diagnostics = Vec::new();
    let timeout = Duration::from_millis(options.video_frame_timeout_ms.max(1));
    let metadata = ffprobe(path, timeout);
    let (width, height, duration_ms) = match metadata {
        Ok(metadata) => (metadata.width, metadata.height, metadata.duration_ms),
        Err(error) => {
            diagnostics.push(Diagnostic {
                code: "video-metadata-unavailable".to_string(),
                severity: "warning".to_string(),
                asset_id: Some(asset_id.to_string()),
                message: format!(
                    "ffprobe metadata fallback for {}: {error:#}",
                    path.display()
                ),
            });
            (0, 0, None)
        }
    };

    let video_frames = match duration_ms {
        Some(duration_ms) if command_exists("ffmpeg") => {
            match extract_representative_frames(path, duration_ms, width, height, options) {
                Ok(frames) => frames,
                Err(error) => {
                    diagnostics.push(Diagnostic {
                        code: "video-frame-unavailable".to_string(),
                        severity: "warning".to_string(),
                        asset_id: Some(asset_id.to_string()),
                        message: format!(
                            "metadata-only video fallback for {}: {error:#}",
                            path.display()
                        ),
                    });
                    Vec::new()
                }
            }
        }
        _ => {
            diagnostics.push(Diagnostic {
                code: "video-frame-unavailable".to_string(),
                severity: "warning".to_string(),
                asset_id: Some(asset_id.to_string()),
                message: "ffmpeg unavailable or duration unknown; using metadata-only video input"
                    .to_string(),
            });
            Vec::new()
        }
    };

    Ok(MediaProbe {
        kind: MediaKind::Video,
        width,
        height,
        duration_ms,
        primary_image: None,
        video_frames,
        diagnostics,
    })
}

#[derive(Debug)]
struct VideoMetadata {
    width: u32,
    height: u32,
    duration_ms: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct FfprobeOutput {
    streams: Vec<FfprobeStream>,
    format: Option<FfprobeFormat>,
}

#[derive(Debug, Deserialize)]
struct FfprobeStream {
    codec_type: Option<String>,
    width: Option<u32>,
    height: Option<u32>,
    duration: Option<String>,
}

#[derive(Debug, Deserialize)]
struct FfprobeFormat {
    duration: Option<String>,
}

fn ffprobe(path: &Path, timeout: Duration) -> Result<VideoMetadata> {
    let mut command = Command::new("ffprobe");
    command
        .args([
            "-v",
            "error",
            "-print_format",
            "json",
            "-show_streams",
            "-show_format",
        ])
        .arg(path);
    let output =
        command_output_with_timeout(&mut command, timeout).with_context(|| "run ffprobe")?;
    if !output.status.success() {
        anyhow::bail!("{}", String::from_utf8_lossy(&output.stderr).trim());
    }
    let parsed: FfprobeOutput = serde_json::from_slice(&output.stdout)?;
    let video_stream = parsed
        .streams
        .iter()
        .find(|stream| stream.codec_type.as_deref() == Some("video"));
    let width = video_stream.and_then(|stream| stream.width).unwrap_or(0);
    let height = video_stream.and_then(|stream| stream.height).unwrap_or(0);
    let duration = video_stream
        .and_then(|stream| stream.duration.as_deref())
        .or(parsed
            .format
            .as_ref()
            .and_then(|format| format.duration.as_deref()))
        .and_then(parse_duration_ms);
    Ok(VideoMetadata {
        width,
        height,
        duration_ms: duration,
    })
}

fn extract_representative_frames(
    path: &Path,
    duration_ms: u64,
    width: u32,
    height: u32,
    options: &ProbeOptions,
) -> Result<Vec<VideoFrameSample>> {
    let temp_dir = TempDir::new()?;
    let timestamps = representative_timestamps(duration_ms);
    let mut frames = Vec::new();
    for timestamp_ms in timestamps {
        let (persisted, extraction_method) =
            extract_representative_frame(path, temp_dir.path(), timestamp_ms, options)?;
        let byte_length = fs::metadata(&persisted)?.len();
        let (frame_width, frame_height) =
            image::image_dimensions(&persisted).unwrap_or((width, height));
        frames.push(VideoFrameSample {
            timestamp_ms,
            source_ref: SourceRef::TempFile {
                path: persisted,
                byte_length: Some(byte_length),
            },
            width: Some(frame_width),
            height: Some(frame_height),
            extraction_method,
        });
    }
    Ok(frames)
}

fn extract_representative_frame(
    video_path: &Path,
    temp_root: &Path,
    timestamp_ms: u64,
    options: &ProbeOptions,
) -> Result<(PathBuf, String)> {
    if options.video_frame_cache {
        let cached = cached_frame_path(video_path, timestamp_ms)?;
        if cached.exists() && image::image_dimensions(&cached).is_ok() {
            if options.progress {
                eprintln!(
                    "[mc scan] video frame cache hit timestamp_ms={timestamp_ms} path={}",
                    video_path.display()
                );
            }
            return Ok((cached, "ffmpeg-cache".to_string()));
        }
        if let Some(parent) = cached.parent() {
            fs::create_dir_all(parent)?;
        }
        let temp_frame_path = cached.with_file_name(format!(
            "{}.part-{}.jpg",
            cached
                .file_stem()
                .and_then(|value| value.to_str())
                .unwrap_or("frame"),
            std::process::id()
        ));
        extract_frame_to_path(video_path, timestamp_ms, &temp_frame_path, options).inspect_err(
            |_| {
                let _ = fs::remove_file(&temp_frame_path);
            },
        )?;
        fs::rename(&temp_frame_path, &cached)?;
        return Ok((cached, "ffmpeg".to_string()));
    }

    let frame_path = temp_root.join(format!("frame-{timestamp_ms}.jpg"));
    extract_frame_to_path(video_path, timestamp_ms, &frame_path, options)?;
    Ok((
        persist_temp_frame(temp_root, &frame_path)?,
        "ffmpeg".to_string(),
    ))
}

fn extract_frame_to_path(
    video_path: &Path,
    timestamp_ms: u64,
    frame_path: &Path,
    options: &ProbeOptions,
) -> Result<()> {
    if options.progress {
        eprintln!(
            "[mc scan] extracting video frame timestamp_ms={timestamp_ms} timeout_ms={} path={}",
            options.video_frame_timeout_ms,
            video_path.display()
        );
    }
    let seconds = format!("{:.3}", timestamp_ms as f64 / 1000.0);
    let mut command = Command::new("ffmpeg");
    command
        .args(["-v", "error", "-ss", &seconds, "-i"])
        .arg(video_path)
        .args(["-frames:v", "1", "-y"])
        .arg(frame_path);
    let output = command_output_with_timeout(
        &mut command,
        Duration::from_millis(options.video_frame_timeout_ms.max(1)),
    )
    .with_context(|| "run ffmpeg")?;
    if !output.status.success() {
        anyhow::bail!("{}", String::from_utf8_lossy(&output.stderr).trim());
    }
    Ok(())
}

fn persist_temp_frame(temp_root: &Path, frame_path: &Path) -> Result<PathBuf> {
    let keep_root = std::env::temp_dir().join("mc-cli-video-frames");
    fs::create_dir_all(&keep_root)?;
    let file_name = frame_path.file_name().unwrap_or_default();
    let persisted = keep_root.join(format!(
        "{}-{}",
        temp_root
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("frames"),
        file_name.to_string_lossy()
    ));
    fs::copy(frame_path, &persisted)?;
    Ok(persisted)
}

fn representative_timestamps(duration_ms: u64) -> Vec<u64> {
    if duration_ms < 3_000 {
        return vec![duration_ms / 2];
    }
    [0.05, 0.5, 0.95]
        .into_iter()
        .map(|percent| (duration_ms as f64 * percent).round() as u64)
        .collect()
}

fn cached_frame_path(video_path: &Path, timestamp_ms: u64) -> Result<PathBuf> {
    let metadata = fs::metadata(video_path)?;
    let modified_ms = metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis())
        .unwrap_or_default();
    let canonical = video_path
        .canonicalize()
        .unwrap_or_else(|_| video_path.to_path_buf());
    let mut hasher = Sha256::new();
    hasher.update(canonical.to_string_lossy().as_bytes());
    hasher.update(b":");
    hasher.update(metadata.len().to_string().as_bytes());
    hasher.update(b":");
    hasher.update(modified_ms.to_string().as_bytes());
    hasher.update(b":");
    hasher.update(timestamp_ms.to_string().as_bytes());
    let key = hex::encode(hasher.finalize());
    Ok(video_frame_cache_root().join(format!("{key}-{timestamp_ms}.jpg")))
}

fn video_frame_cache_root() -> PathBuf {
    std::env::var_os("MC_VIDEO_FRAME_CACHE_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|| std::env::temp_dir().join("mc-cli-video-frame-cache"))
}

fn parse_duration_ms(value: &str) -> Option<u64> {
    value
        .parse::<f64>()
        .ok()
        .map(|seconds| (seconds * 1000.0).round() as u64)
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

fn command_exists(command: &str) -> bool {
    Command::new(command)
        .arg("-version")
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
}

fn command_output_with_timeout(command: &mut Command, timeout: Duration) -> Result<Output> {
    let mut child = command
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()?;
    let started_at = std::time::Instant::now();
    loop {
        if child.try_wait()?.is_some() {
            return Ok(child.wait_with_output()?);
        }
        if started_at.elapsed() >= timeout {
            let _ = child.kill();
            let output = child.wait_with_output()?;
            anyhow::bail!(
                "command timed out after {}ms: {}",
                timeout.as_millis(),
                String::from_utf8_lossy(&output.stderr).trim()
            );
        }
        thread::sleep(Duration::from_millis(50));
    }
}
