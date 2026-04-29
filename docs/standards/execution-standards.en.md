# Execution Standards

[中文版本](./execution-standards.md)

## Scope

This document defines the required team structure, quality gates, TODO sequencing, and acceptance discipline for future work in this repository. It applies to design, planning, implementation, verification, and delivery.

## 1. Goal File and Acceptance Sources

1. All `docs/goal/*.md` files are immutable goal files. They may be read, referenced, and compared against, but they must not be edited.
2. When multiple goal versions exist, the newest version explicitly activated by the user becomes the active goal source.
3. The current active goal source is `docs/goal/v0.3.md`; `docs/goal/v0.2.md` and `docs/goal/v0.1.md` remain historical baselines for comparison only and must not keep driving the current wave.
4. Every execution cycle must be checked against all of the following:
   - `docs/goal/v0.3.md`
   - `docs/goal/v0.2.md` for previous-wave comparison only
   - `docs/goal/v0.1.md` for historical comparison only
   - active standards
   - the relevant design docs
   - the relevant execution plan
   - the relevant BDD scenarios or `.feature` files
5. If code, plans, and standards diverge, the active goal source and confirmed standards win. Existing code does not get to redefine the target.

## 2. Team Structure

1. **Bao Zheng** is the Lead. The main thread acts as Bao Zheng and controls scope, trade-offs, and whether the next TODO wave is frozen or released.
2. **Gong Sun Ce** owns architecture review, including boundaries, sources of truth, coupling, extensibility, and correct live-path ownership.
3. **Zhan Zhao** owns core implementation and integration across the main path.
4. **Zhang Long, Zhao Hu, Wang Chao, and Ma Han** form the execution squad and only take explicitly assigned tasks with clear file ownership.
5. **Ba Xian Wang** owns acceptance. Work is not “done” until acceptance passes.
6. When sub-agents are used, the role mapping must stay stable:
   - Lead: main thread
   - Architect: `explorer` or an equivalent review-oriented agent
   - Implementer: `worker` or an equivalent implementation-oriented agent
   - Acceptance: review agent or final main-thread review
7. Any sub-agent report must include:
   - change scope
   - verification evidence
   - unresolved risks
   A bare “done” claim without evidence is not accepted.

## 3. Execution Chain

1. The default chain is:
   - `brainstorming`
   - `writing-plans`
   - `executing-plans`
   - `behavior-driven-development / agent-team-driven-development`
   - `verification`
2. If the user already provides an executable plan, execution may start directly without forcing another design pass.
3. If the task contains two or more independent workstreams, the Lead should explicitly use sub-agents and assign non-overlapping ownership.
4. If the task is tightly coupled and the next step depends on immediate shared context, the main thread should execute it directly.

## 4. Quality-First Rule

1. Client quality comes first. If a `runtime error` appears, all non-P0 feature work must stop until the runtime issue is fixed.
2. Any change that touches runtime-sensitive paths includes at least:
   - `App.tsx`
   - navigation
   - screen entry points
   - scan flows
   - reminder flows
   - video or image detail rendering
3. After every runtime-sensitive change, the repo must be verified as “no error” before moving on to the next TODO.
4. “No error” means at minimum:
   - type checking passes
   - relevant tests pass
   - there is no known red screen, crash, or unhandled async exception
   - the live entry path is not bypassed by a legacy entry
5. If the root cause comes from a split between a legacy path and the live path, the live path must be fixed first.

## 5. Quality Gates

1. `npm run typecheck -- --pretty false` is a hard gate.
2. `npm run test -- --run` is a hard gate.
3. If the change is local, targeted tests may run first, but full tests are still required before closing the task.
4. Any runtime-sensitive change must add or update regression coverage for at least:
   - closing a playing video detail view without crashing
   - reusing persisted analysis cache on repeated scans
   - scan analysis yielding back to the UI instead of monopolizing it
   - reminder cold-start reconcile and sync scheduling
   - detail and scan actions avoiding unhandled exceptions
5. The repo currently has no `lint` script, so `typecheck + vitest --run` together form the minimum quality bar.
6. If new logic cannot be tested, the reason and an alternate acceptance method must be stated explicitly.

## 6. TODO Sequencing

1. TODOs must be prioritized instead of advanced as a flat list.
2. Default priority levels:
   - `P0`: runtime, crashes, corrupted state, blocked main paths
   - `P1`: goal-critical capabilities that are still not wired into the live path
   - `P2`: experience refinements and extension work
   - `P3`: reserve optimizations and longer-range capabilities
3. If any `P0` remains, `P1/P2/P3` must not advance.
4. Before entering execution, every TODO must have:
   - an owner
   - dependencies
   - a BDD scenario
   - verification commands
   - a definition of done
5. A TODO without tests or verification commands is not executable. It is only a note.

## 7. Current Default TODO Queue

1. First queue: `v0.3` product workflow shell
   - upgrade standards and plans so the current wave is explicitly driven by `docs/goal/v0.3.md`
   - make the landing page explain the `scan -> recognize -> filter -> clean -> report` workflow
   - make the scan page expose recognition-category summaries instead of only a result list
2. Second queue: keep-and-clean plus cumulative reporting
   - tighten recycle-bin semantics into keep-and-clean
   - make hard delete write a `SQLite`-backed cumulative cleanup report
   - ensure restore actions never roll back cumulative report totals
3. Third queue: remote observability foundation
   - Firebase / Crashlytics / Analytics are out of scope for the current Android-first build
   - the current version keeps only the local error fallback and does not require remote-device reporting acceptance
   - when a later version re-enables this lane, it must include service files, native configuration, and real-device acceptance
4. Fourth queue: later end-state capabilities
   - Rust shared core, iOS adapters, and skill / desktop reuse stay in later waves
   - they must not block the current product-shell delivery

## 8. Current Delivery-Blocking TODOs

1. [LandingScreen.tsx](/Users/jt/places/personal/app-cleaner/src/ui/screens/LandingScreen.tsx:1) does not yet act as the five-step product-workflow homepage required by `v0.3`.
2. [PhotoGridScreen.tsx](/Users/jt/places/personal/app-cleaner/src/ui/screens/PhotoGridScreen.tsx:1) does not yet expose an explicit recognition-category summary layer.
3. [RecycleBinScreen.tsx](/Users/jt/places/personal/app-cleaner/src/ui/screens/RecycleBinScreen.tsx:1) does not yet show a `SQLite`-backed cumulative cleanup report.
4. Firebase / Crashlytics / Analytics have been removed from the current Android-first delivery blockers; do not treat the noop fallback warning as a current-version defect.
5. Until the first three gaps are closed, the current Android-first slice of `docs/goal/v0.3.md` must not be considered delivered.

## 9. Documentation Discipline

1. Chinese documents are the primary documents and English documents are mirrors. They must cross-link.
2. Plans, tests, and reports may remain single-language. Standards and design docs should be mirrored.
3. When a standard changes, the related design, plan, or BDD scenarios must be updated as well.
4. Documentation must match the live code path. A documented behavior that is not wired into the live path is not complete work.

The runtime mechanics for team mode live in [agent-team-mode.en.md](./agent-team-mode.en.md).

## 10. Definition of Done

1. Quality gates pass.
2. The result matches the active goal source.
3. The result matches the standards and BDD scenarios.
4. Sub-agent verification evidence is complete.
5. No blocking TODO remains in the current delivery wave.
