# v0.5 Evidence and Plan Document Index

[中文版本](./_index.md)

## Current Decision Entry Points

1. [v0.5 Follow-up Goal Split Decision Record](./v0-5-follow-up-goal-split.en.md)
   - Current split: P0 Rust Core, P0 CLI, P1 Electron Desktop, P2 v0.5.1 i18n/theme governance.
   - Dependency conclusion: Rust Core is the hard dependency for CLI and Desktop; v0.5.1 governance can run in parallel but does not block P0; Desktop productization waits for stable Rust Core / CLI contracts.
   - Follow-up execution plan: [v0.5 Follow-up Goal Split Execution Plan](./v0-5-goal-split-execution/_index.md).

## Evidence and Plans for Execution

1. [Native Engine Mainline Options Research](./native-engine-options.en.md)
   - Current mainline: Android native baseline + Rust-first shared recognition core.
   - KMP is deferred as a mobile-sharing fallback; Go remains a desktop CLI / daemon comparison spike; Node.js is positioned as skill / orchestration / LLM glue.
2. [Desktop / Skill First Local Recognition and LLM Roadmap](./desktop-skill-local-llm-recognition.en.md)
   - Current innovation mainline: local directory scan, local recognition algorithms, local LLM review, safe quarantine, and Codex skill automation.
   - Implemented shared contract: `schemas/media-clean-result.schema.json`, `fixtures/media-clean-result/golden-session.json`, and `npm run verify:schema:media-clean-result`.
   - Implemented Go desktop spike: `engines/desktop-go/cmd/media-clean-scan` and `npm run verify:desktop-go:scan`.
3. [Rust-first Project Layering and Packaging Management](./project-layering-and-packaging.en.md)
   - Current management model: this repository remains the Android-first + shared engine monorepo; Rust core lives under `engines/recognition-rust`, and the npm wrapper lives under `packages/media-clean-engine`.
   - Packaging direction: `media_clean_core` is the only algorithm mainline; napi-rs, CLI, and UniFFI are adapters.
   - Desktop is decided as Electron First: Electron + Rust N-API is the Phase 1 desktop product shape, with Tauri deferred as a lightweight alternative.
4. [i18n Resource Layout Plan](./i18n-resource-layout.en.md)
   - Current i18n decision: one directory per language, one namespace file per business domain, and no forced full i18next runtime yet.
5. [Theme Tokens and Tailwind Reuse Strategy](./theme-token-tailwind-strategy.en.md)
   - Current theme decision: Token-first + Tailwind-compatible + NativeWind optional.
   - RN keeps typed `StyleSheet.create()`, Electron uses generated Tailwind CSS `@theme`, and NativeWind is only a utility layer for new / low-risk components.

## Execution Reminders

1. Do not treat TypeScript as the production scan / recognition engine.
2. Keep the Android Kotlin native executor as the production baseline.
3. Rust-first shared recognition core is the long-term algorithm mainline.
4. iOS should only enter later through stable shared schemas and parity fixtures; it is not part of the current completion criteria.
5. Go is only a desktop daemon / CLI comparison spike; Node.js only owns wrapper / orchestration / LLM glue.
6. Desktop is decided as Electron First; do not switch to Tauri as the mainline unless bundle size, idle memory, or native shell footprint becomes a hard constraint.
7. Theme work starts with a token source of truth, not a full NativeWind rewrite. Tailwind / NativeWind / Electron CSS all derive from the same tokens.
8. P0 execution order is Rust Core -> CLI; P2 v0.5.1 governance can run in parallel, and P1 Desktop productization comes later.
9. The old RN macOS / TypeScript fixture research replaced by the new decisions is no longer kept as an execution entry point.
