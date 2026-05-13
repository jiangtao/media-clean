# Desktop / Skill First Local Recognition and LLM Roadmap

[中文版本](./desktop-skill-local-llm-recognition.md)

## Background

The current product direction has shifted from "bring the Android app to iOS first" to:

```text
Keep Android-first as the production baseline
Use desktop / CLI / skill as the innovation mainline for recognition algorithms and local LLM integration
Bring iOS later through a stable contract
```

This means v0.5 architecture work should not only focus on mobile sharing. The higher-value path is to make local media recognition batchable, reviewable, and callable from AI workflows through a desktop engine.

References:

1. Ollama structured outputs for JSON-schema constrained local model output: [Ollama Structured Outputs](https://docs.ollama.com/capabilities/structured-outputs).
2. LM Studio local server / OpenAI-style endpoints: [LM Studio API](https://lmstudio.ai/docs/api).
3. LM Studio tool use through the local server: [LM Studio Tool Use](https://www.lmstudio.ai/docs/advanced/tool-use).
4. llama.cpp `llama-server` OpenAI-compatible HTTP API: [llama.cpp server](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md).
5. OpenAI Structured Outputs as the schema-constrained output reference: [Structured Outputs](https://platform.openai.com/docs/guides/structured-outputs?api-mode=chat).

## Product Positioning

The desktop / skill direction is not simply a desktop copy of the mobile cleanup app. It is:

```text
Local Media Recognition Workbench
  local directory scan
  local recognition algorithms
  local LLM review
  JSON / SQLite results
  cleanup plan
  safe quarantine
  Codex skill automation entry
```

Android remains the mobile production surface and real-device validation path. Desktop / skill becomes the fast iteration path for recognition algorithms, local LLM explanations, and batch cleanup workflows.

## Reuse Direction

Skills, CLI, desktop, and the later mobile return path should reuse the same recognition algorithm core as much as possible. The recommended constraint is:

```text
media-clean CLI / Codex skill / desktop UI
  -> call shared recognition engine
      deterministic metrics
      perceptual hash / duplicate / clustering
      scoring / cleanup candidate generation
      schema-compatible session output
  -> optional local LLM review
  -> report / plan / quarantine
```

This means:

1. CLI is the stable execution entrypoint for the skill, but it should not reimplement a separate rule set.
2. The Codex skill owns automation, reporting, user confirmation, and quarantine. It must not implement scan algorithms directly.
3. Node.js can provide the npm CLI wrapper and LLM glue, but core recognition should come from the shared engine.
4. The current Go spike only proves desktop / CLI feasibility. The long-term mainline now defaults to a Rust shared core, so Go spike rules must migrate into the shared core instead of becoming a second algorithm implementation.
5. Android Kotlin remains the production baseline for now, but it should align with the shared core through shared schemas, golden fixtures, and threshold tests.

The value is that an algorithm improvement in one place can benefit skills, CLI, the desktop workbench, Android, and later iOS while reducing maintenance cost and false-positive drift.

## Repository Boundary

The desktop / skill direction can continue in this repository, but only up to the shared engine and dev-wrapper layer:

1. Good fit for this repository:
   - `engines/recognition-rust` shared core.
   - `media-clean` CLI spike.
   - Schemas, fixtures, and Android parity tests.
   - Node.js dev wrapper for simulating a skill calling the CLI.
2. Not a good fit for this repository yet:
   - Published Codex skill package.
   - Complete macOS desktop UI.
   - Large local LLM prompt experiments, model caches, or user media samples.

The reason is that this repository is still the Android-first product repository. Keeping the Rust core here keeps Android adapters, schemas, fixtures, and verification in sync. If the skill / desktop product layer grows, it should move to a separate skill repository, a desktop app repository, or a later monorepo boundary such as `apps/desktop` / `skills/media-clean`.

## CLI / Skill Packaging Strategy

The skill direction should use an npm package for the entrypoint, but the npm package must not reimplement algorithms:

```text
@mistap/media-clean-engine
  JS API / CLI shim / skill-friendly wrapper
  -> napi-rs native addon
      -> media_clean_core
  -> or standalone media-clean binary fallback
```

Keep two distribution shapes:

1. npm + napi-rs
   - For Codex skills, Node.js workflows, LLM glue, and report generation.
   - Users install prebuilt `.node` artifacts through npm and do not need Rust.
   - Good JS APIs: `scanDirectory`, `reviewSession`, and `buildCleanupPlan`.
2. Standalone Rust binary
   - For desktop daemons, shell scripts, and GitHub Releases without a Node dependency.
   - Good for long-running jobs, local services, and later desktop UI calls.

Rust N-API is the Node packaging layer, not the mobile-sharing layer. Android / iOS should later use a Rust native library plus Kotlin / Swift adapters to call the same `media_clean_core`.

Release rules:

1. `media_clean_core` changes must pass Rust unit tests, schema fixtures, and Android parity fixtures first.
2. `media_clean_napi` may only call the core. It must not copy recognition rules.
3. The `@mistap/media-clean-engine` version should record `engine.version` and `algorithmVersion`.
4. Threshold / scoring changes must enter the changelog even when the API does not change, because user-visible results can change.
5. The skill package should depend on the npm package or CLI binary. It must not vendor Rust source directly.

## Layered Architecture

```text
CLI / Skill / macOS Workbench
  -> Local Scan Engine
      -> FileSystemSource
      -> Native Analyzer
          blur / exposure / edge / hash / duplicate / video frame
      -> Embedding / Cluster Layer
          image embedding / perceptual hash / similarity graph
      -> Local LLM Review Layer
          structured JSON output
          explain / classify / suggest cleanup
      -> Result Store
          sqlite / jsonl / thumbnails / audit trail
      -> Quarantine Adapter
          never direct delete by default

Android App
  -> keeps current Kotlin native executor
  -> aligns through shared scan result contract
```

## LLM Usage Principles

The local LLM should not replace low-level recognition algorithms, and it should not blindly inspect every image one by one. Use three stages:

1. Native deterministic first
   - Run deterministic metrics for every media item: blur, brightness, contrast, edge density, pHash/dHash, content hash, EXIF, file size, and duration.
   - First identify clear duplicate, near-similar, blurry, low-quality, oversized video, and screenshot candidates.
2. Cluster / sample
   - Group similar media.
   - Generate representative images, thumbnail contact sheets, and metadata summaries.
   - Only send valuable candidate groups to the LLM.
3. Local LLM structured review
   - Call Ollama / LM Studio / llama.cpp / OpenAI-compatible local endpoints.
   - Require JSON-schema output.
   - Let the LLM explain, classify, review risk, and produce user-readable suggestions. It must not directly delete files.

## LLM Output Contract

LLM output must be verifiable, cacheable, and replayable. Initial schema:

```json
{
  "clusterId": "cluster-001",
  "category": "duplicate | near_similar | blurry | low_value | screenshot | document | video | unknown",
  "confidence": "high | medium | low",
  "cleanupReason": "string",
  "keepReason": "string | null",
  "representativeAssetIds": ["asset-id"],
  "risk": "safe | review | keep",
  "suggestedAction": "quarantine | review | keep",
  "model": "provider:model",
  "promptVersion": "local-review/v1"
}
```

Rules:

1. `suggestedAction=quarantine` only generates a plan; it does not move files directly.
2. `risk=review` must go to a human confirmation queue.
3. Keep input summaries in the audit trail. Do not save raw image base64 by default.
4. Store prompt, model, schema version, and source cluster in the audit trail.
5. If structured output parsing fails, fall back to deterministic results and do not block scan completion.

## Implemented Shared Result Contract

The first end-to-end result contract has been added as the shared boundary for the Android native executor, the future Rust-first desktop engine, the Go comparison spike, the Node.js skill wrapper, and local LLM review:

1. Schema: `schemas/media-clean-result.schema.json`
   - Covers `session`, `assets`, `clusters`, `llmReviews`, `cleanupPlans`, and `quarantineActions`.
   - Defines `engine.kind` values for `android-native`, `desktop-rust`, `desktop-go`, `node-wrapper`, and `fixture`.
   - Allows `llmReviews` and `cleanupPlans` to be empty arrays so deterministic scans can still complete without an LLM.
2. Golden fixture: `fixtures/media-clean-result/golden-session.json`
   - Represents a replayable session: source media, deterministic metrics, candidate groups, LLM review, cleanup plan, and safe quarantine action.
3. Verification: `npm run verify:schema:media-clean-result`
   - Uses a lightweight local validator for the golden fixture without adding a JSON Schema runtime dependency yet.

This contract is not the algorithm implementation. It constrains output parity across multi-language engines so Android, desktop CLI, skill, and LLM report layers do not drift into separate result formats.

## Implemented Go Desktop Engine Spike

A minimal Go engine spike has been added to validate the decision that Go is a strong desktop daemon / CLI fit without becoming the mobile-sharing mainline:

1. Engine source: `engines/desktop-go/cmd/media-clean-scan/main.go`
   - Recursively scans a directory with the Go standard library.
   - Reads PNG / JPEG / GIF dimensions, SHA-256 content hashes, and basic brightness / contrast / edge-density metrics.
   - Emits only `review` cleanup plans and `dry-run` quarantine actions for low-value candidates.
2. Manual CLI: `npm run scan:desktop-go`
   - Scans `assets/` by default and writes `artifacts/scan/desktop-go-session.json`.
3. Verification: `npm run verify:desktop-go:scan`
   - Generates a temporary dark-image fixture.
   - Calls the Go engine to emit a desktop result artifact.
   - Reuses `media-clean-result.schema.json` for validation.
   - Asserts `engine.kind=desktop-go`, `source.kind=desktop-filesystem`, and quarantine remains `dry-run`.

This is not the final algorithm implementation and does not replace the Android Kotlin native executor. It is an auditable artifact proving that a desktop / CLI engine can independently emit the same contract, providing a Go comparison baseline for the later Rust-first shared core.

## CLI / Skill Command Shape

CLI should be the stable execution entry for the skill, but CLI and skill must call the same shared recognition engine instead of forking rules inside the skill, Node wrapper, or Go spike:

```bash
media-clean scan ~/Pictures --out .media-clean/session.jsonl
media-clean review .media-clean/session.jsonl --llm ollama:qwen3-vl --out review.json
media-clean explain review.json --cluster cluster-001
media-clean plan review.json --out cleanup-plan.json
media-clean quarantine cleanup-plan.json --dry-run
media-clean quarantine cleanup-plan.json --confirm
```

Codex skill responsibilities:

1. Call the CLI.
2. Read JSON / SQLite results.
3. Generate user-readable reports.
4. Execute quarantine only after user confirmation.
5. Do not implement scan algorithms directly.
6. Do not bypass quarantine to delete source files directly.

## Technical Choice

Current default layering:

```text
Node.js
  skill wrapper / npm CLI / LLM provider / report UX

Rust shared recognition core
  desktop recognition engine / CLI / skill backend / mobile return path

Go desktop spike
  local daemon / filesystem scan feasibility probe

Optional C++ / OpenCV
  heavy image/video analyzer backend

Android Kotlin
  Current mobile production path, preserved for now
```

Selection rules:

1. Default to Rust for long-term engine SDK, algorithm strength, and the mobile return path.
2. Keep Go as a comparison spike when the priority is fastest desktop daemon / CLI, but do not expand it into a second algorithm core by default.
3. Use Node.js for orchestration / skill wrapper / LLM glue, not as the heavy recognition engine.
4. Treat OpenCV / C++ as an analyzer backend, not the product architecture itself.
5. Do not rewrite the Android Kotlin native executor immediately. Align it with the desktop engine through shared schemas and golden fixtures.
6. The shared recognition core defaults to Rust-first. Go / Android Kotlin rules must not evolve independently for long; only thin adapters, platform-specific source / lifecycle code, and short-term comparison implementations should remain separate.

## Execution TODO

1. First-pass `media-clean-result.schema.json` and golden fixture are done; next, Android native output and desktop engine output should both pass the same validation.
2. First-pass Go desktop CLI schema artifact is done; next, add real thumbnail cache, SQLite / JSONL store, and batch checkpoints.
3. Add a local LLM provider layer:
   - Ollama.
   - LM Studio.
   - llama.cpp OpenAI-compatible endpoint.
   - Any OpenAI-compatible provider later.
4. Extend golden fixtures:
   - Android Kotlin native output.
   - Desktop engine output.
   - LLM review output.
   - Cleanup plan output.
5. Add a Codex skill wrapper design:
   - Call CLI.
   - Show results.
   - Ask for confirmation.
   - dry-run / quarantine.
   - Make it explicit that the wrapper must call the shared engine artifact instead of implementing recognition rules.
6. Defer desktop UI:
   - Electron First is decided in [Rust-first Project Layering and Packaging Management](./project-layering-and-packaging.en.md) and [v0.5 Follow-up Goal Split Decision Record](./v0-5-follow-up-goal-split.en.md).
   - Full desktop productization waits for stable Rust Core / CLI contracts.
7. Defer iOS:
   - Keep it contract-ready only; do not include it in current completion criteria.
8. Add a shared recognition core spike:
   - Add the Rust spike first, then run the same fixtures through the Rust spike, Go spike, and Android native output.
   - Compare output parity, performance, artifact size, user install burden, and mobile return-path cost.
   - Default Rust as the single algorithm mainline unless the Rust spike fails; downgrade other implementations to adapters or experiments.
9. Add Android alignment work:
   - Rust core first covers metrics / hash / scoring / cluster. It does not take over MediaStore, foreground service, or the RN bridge.
   - Android Kotlin adapter owns source enumeration, worker lifecycle, progress, checkpoint, cancel, and resume.
   - Validate Android native output and Rust CLI output through the same schema and fixture parity checks.
