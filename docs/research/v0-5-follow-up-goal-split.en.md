# v0.5 Follow-up Goal Split Decision Record

[中文版本](./v0-5-follow-up-goal-split.md)

## Conclusion

Status: decided.

Current split:

1. **P0 Rust Core**: the shared recognition algorithm core and the mainline for future recognition, scanning, scoring, and clustering improvements.
2. **P0 CLI**: the first cross-platform product surface for Rust Core and the stable interface for skill / CI / automation.
3. **P2 v0.5.1 i18n / theme governance**: feature-equivalent with main; architecture governance only.
4. **P1 Electron Desktop**: desktop productization for non-technical users, after the Rust Core / CLI contract stabilizes.

Dependency conclusion:

1. **Rust Core is the hard dependency for CLI and Desktop**.
2. **CLI hard-depends on Rust Core and the shared schema**.
3. **v0.5.1 i18n / theme governance can run in parallel, but it does not block P0**.
4. **Desktop productization waits for stable Rust Core / CLI contracts**.
5. **TUI can be the human interaction layer for CLI, but skill / CI / automation depend only on the machine CLI**.

## Background

The v0.5 follow-up work has several goals and is split into four workstreams with explicit dependencies:

1. **v0.5.1 i18n and theme architecture governance**: P2, feature-equivalent with main, no product expansion.
2. **Rust Core**: P0, shared recognition algorithm core that enables Android recognition and scan algorithm improvements.
3. **CLI**: P0, cross-platform first-use surface with strong machine output and better human output.
4. **Desktop**: P1, for non-technical users, decided as Electron First.

These goals are not fully sequential, but they have hard and soft dependencies. The overall principle is: **P0 establishes the algorithm and cross-platform execution loop first; P1 owns the desktop user entrypoint, P2 owns architecture governance, and neither P1 nor P2 blocks P0 validation.**

## Overview

```text
P0 Rust Core
  -> P0 CLI
      -> P1 Electron Desktop

P2 v0.5.1 i18n/theme governance
  -> supports Android UI stability
  -> supports future Electron shared theme/i18n
  -> does not block Rust Core / CLI
```

## Goal 1: v0.5.1 i18n and Theme Governance

Priority: P2

Positioning: architecture governance, no feature expansion. The product behavior should stay equivalent to main.

Scope:

1. i18n: one directory per language, one namespace file per business domain.
2. Theme: Token-first + Tailwind-compatible + NativeWind optional.
3. Downgrade `AppThemePalette` into a compatibility facade.
4. Use `AppPreferencesContext` as the single language and theme state owner.
5. Clean up hardcoded colors and test mock themes.

Dependencies:

1. Does not depend on Rust Core.
2. Does not depend on CLI.
3. Does not depend on Desktop.
4. Should avoid landing together with large Android UI changes, otherwise regressions become hard to isolate.

Depended on by:

1. Future Electron can reuse theme tokens, Tailwind CSS `@theme`, and i18n namespaces.
2. Android UI long-term maintainability depends on this governance.

Acceptance:

1. Feature-equivalent with main.
2. light / dark / system behavior unchanged.
3. Chinese / English copy structure stable.
4. No new raw colors.
5. `typecheck` and RN tests pass.

## Goal 2: Rust Core

Priority: P0

Positioning: long-term algorithm mainline. Without Rust Core, Android recognition and scan algorithm improvements will continue to drift across Kotlin / TS / Go / Node.

Scope:

1. `engines/recognition-rust/crates/media_clean_core`.
2. Minimum recognition: metrics, hashes, scoring, low-value / duplicate candidates.
3. Emit `media-clean-result.schema.json` compatible sessions.
4. `algorithmVersion`.
5. Parity fixtures: Rust output vs Android native output vs Go spike output.

Dependencies:

1. Depends on the existing schema / golden fixture.
2. Depends on the current Android native executor data model and analysis behavior as parity baseline.
3. Does not depend on v0.5.1 theme/i18n.
4. Does not depend on Electron.

Depended on by:

1. CLI P0 hard-depends on Rust Core.
2. Electron Desktop P1 hard-depends on Rust Core.
3. Android algorithm optimization soft-depends on Rust Core: prove parity first, then gradually migrate platform-agnostic logic.
4. Future iOS hard-depends on it: iOS should not rewrite another algorithm.

Acceptance:

1. `cargo test`.
2. Rust CLI fixture output passes schema validation.
3. Core metrics are comparable with Android baseline.
4. Go spike remains a comparison point, not a second algorithm implementation.

## Goal 3: CLI

Priority: P0

Positioning: cross-platform first-use surface. CLI is the first product validation surface for Rust Core and the stable interface for skill / CI / automation.

Scope:

1. `media_clean_cli`.
2. Non-interactive machine CLI: JSON / JSONL output.
3. Human-friendly output: progress, summary, explain.
4. Optional TUI: `media_clean_tui` / `media-clean tui`, only for human interaction.
5. dry-run quarantine.
6. local LLM review hook.

Dependencies:

1. Hard-depends on Rust Core.
2. Depends on schema / fixtures.
3. Soft-depends on npm package / N-API: CLI can ship before N-API.
4. Does not depend on Electron.
5. Does not depend on v0.5.1 theme/i18n, but can reuse theme token terminal color mapping.

Depended on by:

1. Electron can reuse CLI fallback.
2. Skill can call machine CLI first.
3. CI / parity can use CLI as validation entrypoint.

Acceptance:

1. `media-clean scan --format json` is stable.
2. `media-clean plan` is stable.
3. `media-clean quarantine --dry-run` is safe by default.
4. TUI opens, navigates, and previews plans, but is not the automation interface.

## Goal 4: Desktop

Priority: P1

Positioning: complete desktop product for non-technical users. The first desktop phase is decided as Electron First; Tauri remains only as a later lightweight alternative.

Scope:

1. Electron app.
2. Main process calls `@mistap/media-clean-engine` / `media_clean_napi`.
3. CLI fallback.
4. Renderer uses typed IPC.
5. scan / review / plan / quarantine UI.
6. local LLM provider settings.
7. Reuse theme tokens to generate Tailwind CSS `@theme`.

Dependencies:

1. Hard-depends on Rust Core.
2. Hard-depends on N-API npm package or CLI fallback.
3. Soft-depends on CLI for fallback and same-behavior validation.
4. Soft-depends on v0.5.1 theme/i18n: complete desktop product should reuse tokens/i18n, but early spike can use a minimal theme.

Depended on by:

1. Does not block Rust Core.
2. Does not block CLI.
3. Does not block v0.5.1.

Acceptance:

1. Electron main-process package smoke.
2. native addon load smoke.
3. CLI fallback smoke.
4. renderer IPC smoke.
5. quarantine dry-run safety check.

## Dependency Matrix

| Goal | Priority | Hard dependencies | Soft dependencies | Blocks |
| --- | --- | --- | --- | --- |
| v0.5.1 i18n/theme | P2 | main feature baseline | Electron future UI | Does not block P0 |
| Rust Core | P0 | schema, Android baseline | Go spike comparison | CLI, Desktop, future iOS |
| CLI | P0 | Rust Core, schema | TUI, N-API, theme terminal colors | Skill, Desktop fallback, CI parity |
| Desktop Electron | P1 | Rust Core, N-API or CLI fallback | v0.5.1 theme/i18n, CLI | Does not block P0 |

## Execution Order

### Track A: P0 Engine / CLI

```text
A1. Rust Core skeleton
A2. schema-compatible output
A3. parity fixture: Rust vs Android vs Go
A4. media_clean_cli scan / plan / dry-run
A5. human-friendly output
A6. optional TUI
A7. N-API wrapper
```

This is the P0 line and should keep moving first.

### Track B: P2 App Governance

```text
B1. v0.5.1 i18n namespace cleanup
B2. token foundation
B3. AppThemePalette compatibility facade
B4. hardcoded color cleanup
B5. NativeWind / Tailwind output pilot
```

This does not block Track A and can run in parallel. The rule is: preserve behavior and reduce future desktop reuse cost.

### Track C: P1 Desktop

```text
C1. Electron architecture spike
C2. main process calls N-API
C3. CLI fallback
C4. typed IPC
C5. scan/review/plan/quarantine UI
C6. packaged smoke
```

Move this into full productization after Rust Core + CLI contract is stable.

## Parallel Strategy

Can run in parallel:

1. Rust Core skeleton and v0.5.1 theme/i18n docs/governance.
2. CLI machine output and v0.5.1 token cleanup.
3. Electron architecture design and N-API package design.

Do not run in parallel:

1. Large Android native executor changes and v0.5.1 UI changes in the same landing window.
2. Full Electron UI while Rust Core schema is unstable.
3. TUI / Electron / skill UI details all at once.

## Decision

1. P0 mainline: Rust Core -> CLI.
2. P2 governance: v0.5.1 i18n/theme, feature-equivalent with main.
3. P1 productization: Electron Desktop after Rust Core + CLI contract stabilizes.
4. CLI TUI is human mode, not the skill/automation interface.
5. All goals share schemas, algorithmVersion, themeVersion / i18n namespaces to avoid future drift.

## Explicit TODO

1. Create an execution plan for P0 Rust Core.
2. Create an execution plan for P0 CLI, explicitly separating machine CLI and optional TUI.
3. Create a governance plan for P2 v0.5.1, constrained to no feature changes.
4. Create a deferred plan for P1 Electron Desktop, depending on Rust Core / CLI contract.
5. Execute by track; do not mix UI governance and algorithm migration into one PR.
