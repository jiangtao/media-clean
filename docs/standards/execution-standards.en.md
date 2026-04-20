# Execution Standards

[中文版本](./execution-standards.md)

## Scope

This document defines the required team structure, quality gates, TODO sequencing, and acceptance discipline for future work in this repository. It applies to design, planning, implementation, verification, and delivery.

## 1. Goal File and Acceptance Sources

1. [v0.1.md](../goal/v0.1.md) is the immutable goal file. It may be read, referenced, and compared against, but it must not be edited.
2. Every execution cycle must be checked against all of the following:
   - `docs/goal/v0.1.md`
   - active standards
   - the relevant design docs
   - the relevant execution plan
   - the relevant BDD scenarios or `.feature` files
3. If code, plans, and standards diverge, the goal file and confirmed standards win. Existing code does not get to redefine the target.

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

1. First queue: runtime-path stabilization  
   - keep scan cache, cooperative yielding, and reminder cold-start reconcile aligned with tests.
2. Second queue: continued scan-entry interaction rollout  
   - centered on the Photos scan entry and result interaction path.
3. Third queue: legacy gap closure  
   - AppPreferences unification
   - i18n and theme coverage
   - special-screen adaptation and verification
4. Fourth queue: real recycle-bin data flow  
   - storage-backed loading
   - real badge counts
   - detail-view path

## 8. Current Delivery-Blocking TODOs

1. [RecycleBinScreen.tsx](/Users/jt/places/personal/app-cleaner/src/ui/screens/RecycleBinScreen.tsx:33) still lacks real recycle-bin data loading.
2. [MainTabNavigator.tsx](/Users/jt/places/personal/app-cleaner/src/navigation/MainTabNavigator.tsx:16) still does not wire the recycle-bin badge to real state.
3. [RecycleBinScreen.tsx](/Users/jt/places/personal/app-cleaner/src/ui/screens/RecycleBinScreen.tsx:46) still lacks a real detail-navigation path from the recycle bin.
4. Until those three gaps are closed, the recycle-bin flow must not be considered complete.

## 9. Documentation Discipline

1. Chinese documents are the primary documents and English documents are mirrors. They must cross-link.
2. Plans, tests, and reports may remain single-language. Standards and design docs should be mirrored.
3. When a standard changes, the related design, plan, or BDD scenarios must be updated as well.
4. Documentation must match the live code path. A documented behavior that is not wired into the live path is not complete work.

## 10. Definition of Done

1. Quality gates pass.
2. The result matches the goal file.
3. The result matches the standards and BDD scenarios.
4. Sub-agent verification evidence is complete.
5. No blocking TODO remains in the current delivery wave.
