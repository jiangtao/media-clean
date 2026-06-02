# Media Clean Rust Core + CLI User Guide

[中文版本](./core-cli-workbench.md)

This document is for users who want to work directly with the Media Clean Rust Core and the `mc` CLI. It covers the full path from capabilities and installation to scan, cleanup-plan generation, report review, cleanup, and how that workflow maps back to the app structure.

## Positioning

This repository currently has two runtime shapes:

1. **Mobile app**: Android-first, with local scan, recognition, recycle-bin cleanup, and SQLite-backed runtime truth.
2. **Rust Core + `mc` CLI**: a repo-local toolchain for local directories, sample validation, algorithm iteration, and desktop review workbenches.

What they share is not the UI or storage layer, but the **recognition semantics and result structure**:

1. The same recognition categories: duplicate files, similar photos, low-value media, and video candidates.
2. The same core outputs: assets, clusters, cleanup plans, and diagnostics.
3. The same “review first, then clean” operating model.

The current CLI shape is best for:

1. Scanning local photo and video directories.
2. Validating Rust recognition algorithms and thresholds quickly.
3. Producing reviewable JSON artifacts.
4. Reviewing and cleaning through the local report workbench.

## Capability Summary

`mc` currently exposes 4 top-level commands:

1. `mc scan`: scan a directory and generate `session.json`.
2. `mc plan`: generate `cleanup-plan.json` from `session.json`.
3. `mc report`: generate a static HTML report launcher.
4. `mc quarantine`: dry-run or move selected candidates into the system trash.

Recommended end-to-end flow:

1. `mc scan`
2. `mc plan`
3. `npm run report:dev -- --session ...`
4. Review in the local workbench
5. `mc quarantine --dry-run`
6. Confirm and then `mc quarantine --trash`

## Installation

### Requirements

1. Rust `1.78+`
2. Cargo
3. Node.js and npm

Why both:

1. Rust / Cargo are required to build and install `mc`.
2. Node.js / npm are only required if you want the interactive Next.js report workbench.

### Option A: Run without installing

Best for quick trial or debugging:

```bash
cargo run --manifest-path engines/recognition/Cargo.toml -p mc-cli -- --help
```

This avoids touching `PATH`, but every command needs the full `cargo run --manifest-path ... -p mc-cli --` prefix.

### Option B: Install into a repo-local directory

This is the recommended path today, and it has been validated in this repository:

```bash
cargo install --path engines/recognition/crates/cli --root ./.local/mc --locked
export PATH="$(pwd)/.local/mc/bin:$PATH"
mc --version
```

If you want it available permanently, add the `export PATH=...` line to your shell profile.

### Option C: Build the binary only

If you do not want `cargo install`, you can use the built binary directly:

```bash
cargo build --manifest-path engines/recognition/Cargo.toml -p mc-cli
./engines/recognition/target/debug/mc --help
```

## End-To-End Workflow

The examples below assume you are already at the repository root and `mc` is available in your shell.

### 1. Scan a directory

```bash
mc scan /Users/jt/places/personal/mc-test-assets --session-id demo-local
```

Default output path:

```text
.mc/demo-local/session.json
```

Common form:

```bash
mc scan <PATH> \
  --session-id demo-local \
  --media-type all \
  --out .mc/demo-local/session.json
```

Notes:

1. `--media-type` accepts `all / photo / video`.
2. `--out` overrides the default output location.
3. `--no-progress` disables scan progress logging.
4. `--video-frame-timeout-ms` controls video frame-extraction timeout.
5. `--no-video-frame-cache` disables the keyframe cache.

### 2. Generate a cleanup plan

```bash
mc plan .mc/demo-local/session.json
```

Default output path:

```text
.mc/demo-local/cleanup-plan.json
```

With a custom location:

```bash
mc plan .mc/demo-local/session.json --out artifacts/scan/demo-local/cleanup-plan.json
```

### 3. Generate the static report

```bash
mc report .mc/demo-local/session.json --open
```

Default output path:

```text
.mc/demo-local/report/index.html
```

This point matters:

1. `mc report` generates a **static launcher page**.
2. It keeps smoke and compatibility value, and injects the report JSON into HTML.
3. The day-to-day review experience is the **Next.js report workbench**, not the static page by itself.

### 4. Review in the local workbench

Recommended command:

```bash
npm install
npm run report:dev -- --session .mc/demo-local/session.json
```

By default it starts:

```text
http://127.0.0.1:4310/
```

If `.mc/demo-local/cleanup-plan.json` sits next to `session.json`, the script infers the plan automatically.

You can also pass it explicitly:

```bash
npm run report:dev -- \
  --session .mc/demo-local/session.json \
  --plan .mc/demo-local/cleanup-plan.json \
  --port 4310
```

The current workbench provides:

1. Category tabs
2. Image and video previews
3. Detail gallery
4. Local selection and confirmation flows
5. Recycle-bin cleanup bridging

### 5. Run a dry-run first

Before any real cleanup, generate a dry-run result:

```bash
mc quarantine .mc/demo-local/cleanup-plan.json \
  --dry-run \
  --out .mc/demo-local/quarantine-dry-run.json
```

Notes:

1. `--dry-run` does not modify local files.
2. The output enumerates actions, asset ids, and statuses per plan.
3. It is the recommended auditable artifact before and after review.

### 6. Confirm and move to the system trash

```bash
mc quarantine .mc/demo-local/cleanup-plan.json \
  --trash \
  --plan-id <cleanup-plan-id> \
  --out .mc/demo-local/quarantine-result.json
```

Notes:

1. `--trash` really moves matching files into the system trash.
2. The current implementation supports macOS and Linux; Windows is not implemented yet.
3. Only `file://` URIs that resolve to local files are supported.
4. If you omit `--plan-id`, the whole cleanup plan will be executed.
5. The safer operating model is still: review in the workbench first, then run targeted cleanup by `plan-id`.

## Artifact Layout

By default, one CLI session writes into:

```text
.mc/<session-id>/
  session.json
  cleanup-plan.json
  report/
    index.html
  quarantine-dry-run.json
  quarantine-result.json
```

Where:

1. `session.json`: main scan and recognition result.
2. `cleanup-plan.json`: cleanup-ready candidate plans.
3. `report/index.html`: static launcher.
4. `quarantine-dry-run.json`: dry-run audit result.
5. `quarantine-result.json`: real cleanup result.

## How It Maps To The App

The CLI workbench and the mobile app align on workflow semantics, while using different entrypoints and runtime truth storage.

| User workflow | CLI / Core mapping | App mapping |
| --- | --- | --- |
| Scan a directory / enumerate media | `mc scan` + filesystem probe in `engines/recognition/crates/cli` | `src/features/scan/` + Android native media enumeration |
| Recognition and clustering | `engines/recognition/crates/core` | `src/domain/recognition/` |
| Generate cleanup candidates | `mc plan` | `src/features/cleanup/` + candidate view |
| Review results | `apps/report/` local workbench | `src/ui/` review and detail screens |
| Preview cleanup | `mc quarantine --dry-run` | app-side confirmation preview |
| Execute cleanup | `mc quarantine --trash` | app recycle-bin / delete actions |

The most important difference:

1. The app uses SQLite as runtime truth.
2. The CLI uses JSON artifacts under `.mc/<session-id>/`.
3. They share recognition result semantics, but not the same runtime store.

## FAQ

### Why recommend `npm run report:dev` after `mc report`?

Because in the current repository:

1. `mc report` is a static HTML launcher.
2. The usable category filters, detail view, batch selection, and local cleanup bridge all live in the Next.js workbench under `apps/report/`.

### Why does the report page sometimes stop opening?

Because `npm run report:dev` is a local development server, not a persistent background service. Once the terminal session that started it exits, `127.0.0.1:4310` is gone.

### Can this CLI already be installed as a public standalone release?

Not as a stable public promise yet. The repository already supports:

```bash
cargo install --path engines/recognition/crates/cli --root ./.local/mc --locked
```

But public prebuilt releases, a standalone download page, and cross-platform install contracts are not fixed yet as formal release deliverables.

## Related Entry Points

1. Repository overview: [README.en.md](../../README.en.md)
2. Chinese document: [core-cli-workbench.md](./core-cli-workbench.md)
3. Rust Core + CLI execution plan: [docs/research/v0-5-goal-split-execution/p0-rust-core-cli.md](../research/v0-5-goal-split-execution/p0-rust-core-cli.md)
