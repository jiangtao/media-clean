use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::process::Command as ProcessCommand;

use anyhow::{bail, Context, Result};
use clap::{ArgAction, Parser, Subcommand, ValueEnum};
use percent_encoding::percent_decode_str;

use crate::core_adapter::{analyze_scan_request, build_cleanup_plan, build_quarantine_dry_run};
use crate::filesystem::{build_scan_request_with_options, MediaFilter, ScanBuildOptions};
use crate::media_probe::ProbeOptions;
use crate::model::{
    write_json_pretty, CleanupPlanDocument, MediaCleanSession, QuarantineAction,
    QuarantineDryRunResult, QUARANTINE_RESULT_SCHEMA_VERSION,
};
use crate::report::write_report;

#[derive(Debug, Parser)]
#[command(name = "mc", version, about = "Media Clean Rust CLI workbench")]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Debug, Subcommand)]
enum Command {
    Scan {
        path: PathBuf,
        #[arg(long, value_enum, default_value = "json")]
        format: OutputFormat,
        #[arg(long)]
        out: Option<PathBuf>,
        #[arg(long)]
        session_id: Option<String>,
        #[arg(long, value_enum, default_value = "all")]
        media_type: ScanMediaType,
        #[arg(long = "no-progress", action = ArgAction::SetFalse, default_value_t = true)]
        progress: bool,
        #[arg(long, default_value_t = 15_000)]
        video_frame_timeout_ms: u64,
        #[arg(long = "no-video-frame-cache", action = ArgAction::SetFalse, default_value_t = true)]
        video_frame_cache: bool,
    },
    Plan {
        session: PathBuf,
        #[arg(long)]
        out: Option<PathBuf>,
    },
    Report {
        session: PathBuf,
        #[arg(long)]
        out: Option<PathBuf>,
        #[arg(long)]
        open: bool,
    },
    Quarantine {
        cleanup_plan: PathBuf,
        #[arg(long)]
        dry_run: bool,
        #[arg(long)]
        trash: bool,
        #[arg(long = "plan-id")]
        plan_ids: Vec<String>,
        #[arg(long, value_enum, default_value = "json")]
        format: OutputFormat,
        #[arg(long)]
        out: Option<PathBuf>,
    },
}

#[derive(Clone, Copy, Debug, ValueEnum)]
enum OutputFormat {
    Json,
}

#[derive(Clone, Copy, Debug, ValueEnum)]
enum ScanMediaType {
    All,
    Photo,
    Video,
}

impl From<ScanMediaType> for MediaFilter {
    fn from(value: ScanMediaType) -> Self {
        match value {
            ScanMediaType::All => MediaFilter::All,
            ScanMediaType::Photo => MediaFilter::Photo,
            ScanMediaType::Video => MediaFilter::Video,
        }
    }
}

pub fn run() -> Result<()> {
    let cli = Cli::parse();

    match cli.command {
        Command::Scan {
            path,
            format,
            out,
            session_id,
            media_type,
            progress,
            video_frame_timeout_ms,
            video_frame_cache,
        } => {
            require_json(format)?;
            let (request, diagnostics) = build_scan_request_with_options(
                &path,
                &ScanBuildOptions {
                    media_filter: media_type.into(),
                    progress,
                    probe: ProbeOptions {
                        progress,
                        video_frame_cache,
                        video_frame_timeout_ms,
                    },
                },
            )?;
            let mut session = analyze_scan_request(request, diagnostics)?;
            if let Some(session_id) = session_id {
                session.session_id = session_id;
            }
            let out = out.unwrap_or_else(|| default_session_path(&session.session_id));
            write_json_pretty(&out, &session)?;
            println!(
                "mc scan ok: {} assets, {} clusters -> {}",
                session.assets.len(),
                session.clusters.len(),
                out.display()
            );
        }
        Command::Plan { session, out } => {
            let session = read_session(&session)?;
            let plan = build_cleanup_plan(&session);
            let out = out.unwrap_or_else(|| default_cleanup_plan_path(&plan.source_session_id));
            write_json_pretty(&out, &plan)?;
            println!(
                "mc plan ok: {} cleanup plans -> {}",
                plan.plans.len(),
                out.display()
            );
        }
        Command::Report { session, out, open } => {
            let session = read_session(&session)?;
            let out = out.unwrap_or_else(|| default_report_dir(&session.session_id));
            let index = write_report(&session, &out)?;
            if open {
                open::that(&index).with_context(|| format!("open report {}", index.display()))?;
            }
            println!("mc report ok: {}", index.display());
        }
        Command::Quarantine {
            cleanup_plan,
            dry_run,
            trash,
            plan_ids,
            format,
            out,
        } => {
            require_json(format)?;
            if dry_run == trash {
                bail!("quarantine requires exactly one of --dry-run or --trash");
            }
            let plan = filter_cleanup_plan(read_cleanup_plan(&cleanup_plan)?, &plan_ids)?;
            let result = if dry_run {
                build_quarantine_dry_run(&plan)
            } else {
                move_cleanup_plan_to_trash(&plan)
            };
            if let Some(out) = out {
                write_json_pretty(&out, &result)?;
                println!(
                    "mc quarantine {} ok: {} actions -> {}",
                    result.mode,
                    result.actions.len(),
                    out.display()
                );
            } else {
                println!("{}", serde_json::to_string_pretty(&result)?);
            }
        }
    }

    Ok(())
}

fn require_json(format: OutputFormat) -> Result<()> {
    match format {
        OutputFormat::Json => Ok(()),
    }
}

fn read_session(path: &PathBuf) -> Result<MediaCleanSession> {
    let data = std::fs::read_to_string(path)
        .with_context(|| format!("read session {}", path.display()))?;
    serde_json::from_str(&data).with_context(|| format!("parse session {}", path.display()))
}

fn read_cleanup_plan(path: &PathBuf) -> Result<CleanupPlanDocument> {
    let data = std::fs::read_to_string(path)
        .with_context(|| format!("read cleanup plan {}", path.display()))?;
    serde_json::from_str(&data).with_context(|| format!("parse cleanup plan {}", path.display()))
}

fn filter_cleanup_plan(
    mut plan: CleanupPlanDocument,
    plan_ids: &[String],
) -> Result<CleanupPlanDocument> {
    if plan_ids.is_empty() {
        return Ok(plan);
    }

    let selected: HashSet<&str> = plan_ids.iter().map(String::as_str).collect();
    let mut found = HashSet::new();
    plan.plans.retain(|plan| {
        if selected.contains(plan.id.as_str()) {
            found.insert(plan.id.clone());
            true
        } else {
            false
        }
    });

    let missing = plan_ids
        .iter()
        .filter(|plan_id| !found.contains(*plan_id))
        .cloned()
        .collect::<Vec<_>>();
    if !missing.is_empty() {
        bail!(
            "cleanup plan does not contain plan ids: {}",
            missing.join(", ")
        );
    }

    Ok(plan)
}

fn move_cleanup_plan_to_trash(plan: &CleanupPlanDocument) -> QuarantineDryRunResult {
    let asset_by_id = plan
        .assets
        .iter()
        .map(|asset| (asset.id.as_str(), asset))
        .collect::<HashMap<_, _>>();

    QuarantineDryRunResult {
        schema_version: QUARANTINE_RESULT_SCHEMA_VERSION.to_string(),
        source_session_id: plan.source_session_id.clone(),
        mode: "confirmed".to_string(),
        dry_run: false,
        generated_at: chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true),
        actions: plan
            .plans
            .iter()
            .map(|plan| {
                let mut errors = Vec::new();
                for asset_id in &plan.asset_ids {
                    let result = asset_by_id
                        .get(asset_id.as_str())
                        .context("asset missing from cleanup plan")
                        .and_then(|asset| file_uri_to_path(&asset.uri))
                        .and_then(|path| move_to_trash(&path));
                    if let Err(error) = result {
                        errors.push(format!("{asset_id}: {error:#}"));
                    }
                }

                QuarantineAction {
                    plan_id: plan.id.clone(),
                    mode: "confirmed".to_string(),
                    status: if errors.is_empty() {
                        "completed".to_string()
                    } else {
                        "failed".to_string()
                    },
                    asset_ids: plan.asset_ids.clone(),
                    error: if errors.is_empty() {
                        None
                    } else {
                        Some(errors.join("; "))
                    },
                }
            })
            .collect(),
    }
}

fn file_uri_to_path(uri: &str) -> Result<PathBuf> {
    let path = uri
        .strip_prefix("file://")
        .with_context(|| format!("only file:// media URIs can be trashed, got {uri}"))?;
    let path = if cfg!(windows) && path.starts_with('/') {
        &path[1..]
    } else {
        path
    };
    let decoded = percent_decode_str(path)
        .decode_utf8()
        .with_context(|| format!("decode file URI {uri}"))?;
    Ok(PathBuf::from(decoded.as_ref()))
}

fn move_to_trash(path: &Path) -> Result<()> {
    std::fs::metadata(path)
        .with_context(|| format!("read file before trash {}", path.display()))?;

    if cfg!(target_os = "macos") {
        let script = format!(
            "tell application \"Finder\" to delete POSIX file {}",
            apple_script_string(&path.to_string_lossy())
        );
        run_system_command("osascript", &["-e", &script])
            .with_context(|| format!("move to macOS Trash {}", path.display()))?;
        return Ok(());
    }

    if cfg!(target_os = "linux") {
        run_system_command("gio", &["trash", &path.to_string_lossy()])
            .with_context(|| format!("move to Linux trash {}", path.display()))?;
        return Ok(());
    }

    bail!(
        "moving files to system trash is not implemented on {}",
        std::env::consts::OS
    );
}

fn run_system_command(command: &str, args: &[&str]) -> Result<()> {
    let output = ProcessCommand::new(command)
        .args(args)
        .output()
        .with_context(|| format!("run {command}"))?;
    if output.status.success() {
        return Ok(());
    }

    let stderr = String::from_utf8_lossy(&output.stderr);
    bail!("{command} exited with {}: {}", output.status, stderr.trim());
}

fn apple_script_string(value: &str) -> String {
    format!("\"{}\"", value.replace('\\', "\\\\").replace('"', "\\\""))
}

fn default_session_path(session_id: &str) -> PathBuf {
    default_session_dir(session_id).join("session.json")
}

fn default_cleanup_plan_path(session_id: &str) -> PathBuf {
    default_session_dir(session_id).join("cleanup-plan.json")
}

fn default_report_dir(session_id: &str) -> PathBuf {
    default_session_dir(session_id).join("report")
}

fn default_session_dir(session_id: &str) -> PathBuf {
    PathBuf::from(".mc").join(safe_session_id(session_id))
}

fn safe_session_id(session_id: &str) -> String {
    let sanitized = session_id
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '.') {
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
