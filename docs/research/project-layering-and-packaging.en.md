# Rust-first Project Layering and Packaging Management

[中文版本](./project-layering-and-packaging.md)

## Background

The current route has converged on:

```text
Android-first production baseline
Rust-first shared recognition core
CLI / skill / desktop reuse the same core
iOS later through a stable adapter
```

Project management should not mix Rust, Node, Android, and skills into one blurry layer. The important work is to define responsibilities, dependency direction, packaging boundaries, and verification gates.

## Overall Layers

Use **core first, adapters thin, packages explicit**:

```text
Product Surfaces
  Android RN app
  Codex skill
  CLI
  Electron desktop app
  future iOS app

Adapters
  Android Kotlin adapter
  Node.js / napi-rs adapter
  Rust CLI adapter
  Electron main-process adapter
  future Swift / UniFFI adapter

Shared Recognition Core
  media_clean_core
  deterministic metrics
  hash / duplicate / clustering / scoring
  cleanup candidate generation

Contracts
  schemas
  golden fixtures
  algorithmVersion
  parity tests
```

Dependency direction must stay one-way:

```text
Product surface -> adapter -> media_clean_core -> schema / model primitives
```

`media_clean_core` must not depend on React Native, Node.js, Android, iOS, desktop UI, or the Codex skill. It may only depend on Rust algorithm, data-structure, and necessary image-processing crates.

## Repository Management

Keep this work in the current repository for now, but isolate it with directory boundaries:

```text
engines/recognition-rust/
  Cargo.toml
  crates/
    media_clean_core/
    media_clean_cli/
    media_clean_napi/
    media_clean_uniffi/        # later
  fixtures/
  benches/

packages/
  media-clean-engine/          # npm package wrapper, later

schemas/
  media-clean-result.schema.json

fixtures/
  media-clean-result/

scripts/
  scan/
```

This repository currently owns:

1. Rust shared core.
2. Rust CLI spike.
3. napi-rs Node binding.
4. Schemas, fixtures, and parity tests.
5. Android adapter alignment.
6. Dev skill wrapper / smoke wrapper.

Do not put these in this repository yet:

1. Full published Codex skill template.
2. Complete Electron / Tauri desktop app.
3. User media samples, model caches, or large prompt experiments.

When skill or desktop UI becomes an independent product line, split it into:

```text
skills/media-clean
apps/desktop
```

or separate repositories.

## Rust Crate Layers

### `media_clean_core`

The only algorithm mainline.

Responsibilities:

1. Accept normalized asset metadata, thumbnail bytes, frame bytes, or temporary file paths.
2. Calculate brightness, contrast, edge, blur, and hashes.
3. Generate duplicate, near-similar, low-value, screenshot, and related candidates.
4. Own thresholds, scoring, clusters, and cleanup reasons.
5. Emit schema-compatible results.

Forbidden:

1. Depending on Node.js.
2. Depending on React Native.
3. Accessing Android MediaStore directly.
4. Implementing UI, skill workflows, or LLM providers directly.

### `media_clean_cli`

Pure Rust binary.

Responsibilities:

1. Filesystem source.
2. `media-clean scan`.
3. `media-clean plan`.
4. `media-clean quarantine --dry-run`.
5. Emit JSON / JSONL / SQLite artifacts.

It serves desktop, shell, GitHub Releases, and can be used as the npm package fallback binary.

### `media_clean_tui`

Optional Rust TUI frontend, preferably based on Ratatui.

Responsibilities:

1. Provide a terminal workbench for human users.
2. Reuse `media_clean_core`, the session store, cleanup plans, and the quarantine adapter.
3. Show scan progress, candidate lists, cluster detail, LLM reviews, and dry-run quarantine previews.
4. Stay an interactive mode only. It is not the main interface for skills / CI / automation.

Recommended entrypoints:

```bash
media-clean scan ~/Pictures --out .media-clean/session.json
media-clean review .media-clean/session.json --llm ollama:qwen3-vl --out review.json
media-clean tui .media-clean/session.json
media-clean tui ~/Pictures --scan
```

Do not make skills call the TUI. Skills should call machine-readable CLI commands:

```bash
media-clean scan ~/Pictures --format json --out session.json
media-clean plan session.json --format json --out cleanup-plan.json
media-clean quarantine cleanup-plan.json --dry-run --format json
```

TUI can reuse:

1. Rust core recognition algorithms.
2. Schema / session / plan / quarantine contracts.
3. Terminal color mapping derived from theme tokens.
4. Command/service layer: scan jobs, review jobs, and plan jobs.

TUI should not reuse:

1. Electron / RN visual components.
2. Tailwind className.
3. NativeWind.
4. Skill natural-language report templates.

TUI value:

1. Better than plain CLI for manually reviewing many candidates.
2. Lighter than Electron and useful for SSH / remote machines / developer workflows.
3. Same language as the Rust core, so it fits naturally in the standalone binary.

TUI boundaries:

1. It does not own the rich thumbnail grid and media preview experience. That remains Electron's responsibility.
2. Terminal image previews are an enhancement, not a core acceptance gate.
3. Every destructive action remains dry-run by default and requires explicit confirmation.

### `media_clean_napi`

napi-rs Node binding.

Responsibilities:

1. Expose batch APIs for the npm package, Codex skill, and Node workflows.
2. Call `media_clean_core`.
3. Return schema-compatible JSON.

Suggested APIs:

```ts
scanDirectory(options): Promise<ScanSession>
analyzeBatch(inputs): Promise<AnalyzedAsset[]>
buildCleanupPlan(session): Promise<CleanupPlan>
reviewSessionWithProvider(session, providerOptions): Promise<ReviewResult>
```

Forbidden:

1. Copying recognition rules.
2. High-frequency pixel-level or field-by-field N-API calls.
3. Treating Node.js as the mobile sharing layer.

### `media_clean_uniffi`

Deferred mobile binding.

Responsibilities:

1. Generate Kotlin / Swift bindings.
2. Serve Android / iOS adapters.
3. Keep the same core and fixtures as CLI / npm.

Do not advance this in the first phase. Add it after Rust core and CLI parity are stable.

## Android Alignment

Android keeps the current structure:

```text
AndroidNativeScanExecutor
  MediaStore source
  permission
  foreground service
  worker lifecycle
  progress / checkpoint / cancel / resume
  RN bridge events
```

Rust takeover order:

1. Metrics / hash first.
2. Scoring / cluster next.
3. Cleanup candidates next.
4. Evaluate UniFFI/JNI for more platform-agnostic logic only after that.

Do not rewrite these first:

1. MediaStore enumeration.
2. Foreground service.
3. RN bridge.
4. Permission / lifecycle.

## npm and Skill Packaging

Recommended npm package:

```text
@mistap/media-clean-engine
```

Package contents:

```text
dist/
  index.js
  index.d.ts
native/
  darwin-arm64/*.node
  darwin-x64/*.node
  linux-x64/*.node
  linux-arm64/*.node
  win32-x64/*.node
bin/
  media-clean
```

Packaging principles:

1. Install prebuilt `.node` artifacts by default so users do not need Rust.
2. The npm package only wraps `media_clean_core`; it does not copy algorithms.
3. CLI binary can be the fallback when the Node addon is unavailable.
4. The skill depends on the npm package or CLI binary. It does not vendor Rust source.
5. Node API and CLI output must include `schemaVersion`, `engine.version`, and `algorithmVersion`.

## Desktop UI Framework Decision

Use **Electron-first + Rust N-API** for desktop, with Tauri kept as a later lightweight alternative.

Why Electron fits this product stage better:

1. More stable UI experience: Electron bundles Chromium, so the same React / TypeScript UI behaves more consistently across macOS, Windows, and Linux.
2. Better reuse of the skill / npm packaging path: Electron main process can directly use `@mistap/media-clean-engine` and `media_clean_napi`.
3. More mature desktop ecosystem: complex windows, auto-update, menus, tray, drag-and-drop, DevTools, crash diagnostics, and packaging are better traveled.
4. This product is a media recognition workbench with thumbnail grids, contact sheets, LLM review, long-running progress, batch plans, and safe quarantine. Electron is more predictable for that level of Web UI complexity.

Tauri strengths:

1. Smaller bundle and lower memory footprint.
2. Rust backend is the default model and aligns well with `media_clean_core`.
3. Better fit for lightweight tools, simple UI, and local Rust-command-heavy workflows.

Tauri costs:

1. It uses system WebViews by default: WebView2 on Windows, WKWebView on macOS, and webkitgtk on Linux. UI and Web API behavior can vary more by platform.
2. If skill / npm still uses napi-rs, Tauri adds a separate Tauri command adapter and cannot reuse N-API as the main desktop path.
3. The ecosystem and debugging path for a complex desktop workbench are less mature than Electron.

Important nuance: Tauri is also a Web technology stack. It is not "not viable". It can use React / TypeScript for the renderer and call `media_clean_core` through a Rust backend. The real difference is the desktop shell and native bridge:

| Dimension | Electron + Rust N-API | Tauri + Rust command |
| --- | --- | --- |
| Renderer stack | React / TypeScript / Chromium | React / TypeScript / system WebView |
| WebView consistency | Bundled Chromium, more consistent cross-platform rendering | System WebView, more platform variation |
| Rust core access | napi-rs `.node`, shared with npm / skill | Tauri command, separate adapter |
| skill / npm reuse | Direct: desktop and skill share `@mistap/media-clean-engine` | skill still uses napi-rs, desktop uses Tauri command, creating two bindings |
| Bundle / memory | Larger | Smaller |
| Complex workbench UI | More predictable Chromium capability and debugging path | Possible, but carries WebView variation and Tauri adapter cost |
| Update / packaging ecosystem | Mature Electron Forge / Builder path | Supported by Tauri, but less aligned with npm native-addon reuse |
| Long-running job isolation | main / utility process / worker + N-API | Rust core process + WebView IPC |
| Best phase | Current phase: complex UI + skill/npm reuse + fast productization | Later phase: when bundle size / memory becomes a hard constraint |

Concrete reasons Tauri is not the current first choice:

1. **It is not the same Node packaging entrypoint**
   The skill, CLI wrapper, and Node workflow are already leaning toward `@mistap/media-clean-engine -> media_clean_napi -> media_clean_core`. Electron main process can reuse that chain directly. Tauri naturally uses `Tauri command -> media_clean_core`, which creates a second binding that needs separate parity and release gates.

2. **Its WebView is not one unified Chromium runtime**
   Tauri gets smaller bundles by using system WebViews. The cost is that rendering, media behavior, drag-and-drop, clipboard, fonts, scrolling, Web APIs, and debugging can vary across macOS, Windows, and Linux. Our UI is a media recognition workbench, not a simple form: thumbnail grids, contact sheets, batch selection, long-running progress, and LLM review panels all rely on more complex Web UI behavior.

3. **Complex desktop capability needs separate Tauri plugin / command boundaries**
   This product needs filesystem access, directory authorization, quarantine, opening Finder / Explorer, system notifications, menus, tray, auto-update, local LLM providers, background jobs, and crash diagnostics. Tauri can do these, but each capability runs through Tauri plugin / command / permission boundaries. Electron is the more common and better-traveled path for this kind of complex desktop workbench, especially when we also want Node ecosystem reuse.

4. **N-API is not Tauri's natural main path**
   Tauri already has a Rust backend, so it does not naturally need N-API. If we embed Node / N-API into Tauri for npm/skill reuse, we lose much of Tauri's lightweight advantage. If we avoid N-API, the desktop binding diverges from the skill/npm package path.

So Tauri is not rejected; it is deferred behind clear conditions:

```text
Choose Electron:
  complex desktop workbench, cross-platform UI consistency, npm/napi-rs reuse, fast productization

Choose Tauri:
  smaller bundle, lower memory, Rust-command-first backend, simpler UI, and willingness to maintain a separate Tauri adapter
```

Recommended path:

```text
Phase 1 desktop: Electron + Rust N-API
  Electron main process -> @mistap/media-clean-engine -> media_clean_napi -> media_clean_core
  Renderer -> typed IPC only

Later optimization: evaluate Tauri
  only if package size / idle memory / native shell footprint becomes a blocking product issue
```

Electron safety boundary:

1. Native addon loads only in the main process or a controlled worker / utility process.
2. Renderer must not directly access `.node`, the filesystem, delete capabilities, or LLM provider secrets.
3. Preload exposes minimal typed IPC, such as `scanDirectory`, `loadSession`, `buildPlan`, and `quarantineDryRun`.
4. CLI binary remains a fallback so a platform-specific native addon load failure does not make the desktop app unusable.

## Version Management

Manage four versions separately:

```text
schemaVersion
  result JSON contract version

algorithmVersion
  threshold / scoring / hash / cluster behavior version

engine.version
  Rust engine implementation version

package version
  npm / CLI / app release version
```

Rules:

1. Schema changes must bump `schemaVersion`.
2. Scoring / threshold / hash changes must bump `algorithmVersion`, even when the API is unchanged.
3. Rust crates, npm packages, and CLI binaries can share a release version, but that does not replace `algorithmVersion`.
4. Android app versioning is independent, but release notes must record the bundled engine version.
5. Skill package versioning is independent, but it must declare the supported engine version range.

## Release Phases

### Phase A: Repo-local

Goal: prove the Rust core is viable.

Artifacts:

1. `media_clean_core`
2. `media_clean_cli`
3. schema output
4. Go spike / Android native / Rust CLI parity report

Gates:

```bash
cargo test
cargo run -p media_clean_cli -- scan <fixture>
npm run verify:schema:media-clean-result
npm run verify:desktop-go:scan
```

### Phase B: Internal npm

Goal: let skills / Node wrappers call Rust through npm.

Artifacts:

1. `media_clean_napi`
2. `@mistap/media-clean-engine`
3. prebuilt `.node`
4. dev skill wrapper

Gates:

```bash
cargo test
npm test
npm run verify:schema:media-clean-result
node scripts/scan/verify-media-clean-engine-package.mjs
```

### Phase C: Public CLI / Skill

Goal: users can install and run it.

Artifacts:

1. npm package.
2. GitHub Release standalone binaries.
3. skill package.
4. changelog with schema / algorithm / engine versions.
5. optional `media-clean tui` interactive mode.

Gates:

1. macOS arm64 smoke.
2. macOS x64 smoke.
3. Linux x64 smoke.
4. Windows x64 smoke.
5. skill dry-run scan.
6. quarantine dry-run safety check.
7. TUI open / navigate / dry-run smoke, without requiring terminal image preview support.

### Phase D: Electron Desktop

Goal: form the desktop Electron app.

Artifacts:

1. `apps/desktop` Electron app.
2. Bundled N-API addon from `@mistap/media-clean-engine`.
3. `media-clean` CLI fallback.
4. Local LLM provider settings.
5. Scan / review / plan / quarantine UI.

Gates:

1. Electron main-process package smoke.
2. Renderer IPC smoke.
3. Native addon load smoke.
4. CLI fallback smoke.
5. Quarantine dry-run safety check.
6. macOS / Windows / Linux packaging smoke.

### Phase E: Mobile Return

Goal: Android / iOS call the same Rust core.

Artifacts:

1. Android `.so` / AAR / Kotlin adapter.
2. iOS XCFramework / Swift adapter.
3. mobile parity fixtures.

Gates:

1. Android emulator-core lane.
2. Android real-device lane.
3. iOS adapter smoke, once implemented.
4. CLI / Android / iOS same fixture parity.

## CI Management

Split CI into four workflow groups:

```text
mobile-android.yml
  typecheck
  tests
  Android assemble
  emulator lane

engine-rust.yml
  cargo fmt
  cargo clippy
  cargo test
  CLI fixture scan

engine-node.yml
  napi build
  npm test
  package smoke

contract-parity.yml
  schema validation
  golden fixtures
  Android output vs Rust output
  Go spike output vs Rust output
```

## Decision

Recommended management approach:

1. Keep this repository as an Android-first + shared engine monorepo for now.
2. Put Rust core under `engines/recognition-rust`.
3. Put npm wrapper under `packages/media-clean-engine`; it only wraps napi-rs.
4. Use Electron-first + Rust N-API for desktop; keep Tauri as a later lightweight alternative.
5. CLI can reuse a TUI, but TUI is only the human interactive mode; skills / CI / automation must use non-interactive JSON CLI commands.
6. Every entrypoint must call `media_clean_core`; no duplicated recognition rules.
7. Record behavior with four version layers: `schemaVersion + algorithmVersion + engine.version + package version`.

## Explicit TODO

1. Add Rust workspace: `engines/recognition-rust`.
2. Add `media_clean_core` and migrate the smallest subset of metrics / hash / scoring first.
3. Add `media_clean_cli` and emit the current `media-clean-result.schema.json`.
4. Add parity fixtures: Rust CLI output vs Go spike output vs Android native output.
5. Add `media_clean_napi` as batch API wrapper only.
6. Add Electron desktop design spike: main process calls N-API, renderer only uses typed IPC.
7. Later decide whether `packages/media-clean-engine` and `apps/desktop` ship from this repository or move to separate package / desktop repositories.
