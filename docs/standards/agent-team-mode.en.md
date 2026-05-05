# Agent Team Mode Standard

[中文版本](./agent-team-mode.md)

## Scope

This document defines how team mode actually runs in this repository. It is not a symbolic role list. It defines when the lead must enable sub-agents, how work is split, how reports are structured, and how review gates work.

`execution-standards.md` defines durable discipline. This document defines the runtime mechanics.

## 1. What counts as team mode

Team mode only exists when all of the following are true:

1. the main thread continuously acts as Bao Zheng / Lead,
2. the current wave is split into at least two independent work packets,
3. each packet has an owner, write scope, verification command, and done condition,
4. worker reports carry evidence instead of status-only claims,
5. explicit remaining TODOs keep the wave moving after a local green checkpoint.

## 2. Default role mapping

- Bao Zheng: main thread lead
- Gong Sun Ce: `explorer` for architecture and truth-source review
- Zhan Zhao: main-path implementation in the main thread or a `worker`
- Zhang Long / Zhao Hu / Wang Chao / Ma Han: bounded `worker` packets
- Ba Xian Wang: acceptance through the main thread or a review-oriented agent

## 3. When team mode is mandatory

Enable team mode by default when:

1. the current wave has at least two independent `P0/P1` packets,
2. implementation can run in parallel with tests, verification, or architecture review,
3. staying single-threaded would obviously slow the main path.

Do not enable it when the work is tightly coupled, only one tiny change remains, or parallel work would create clear write conflicts.

## 4. Work packet format

Each packet must define:

1. owner
2. goal
3. write scope
4. readable context
5. verification commands
6. done condition
7. blockers

## 5. Reporting format

Every worker report must include:

1. change scope
2. verification evidence
3. unresolved risks
4. recommended next step

## 6. Review order

Default review order:

1. spec review
2. code-quality review
3. wave acceptance

Code-quality review does not start before spec review passes.

## 7. Speed rules

1. run docs, implementation, and verification in parallel when they can be split cleanly,
2. the lead does not block on non-critical-path research,
3. after two failed repair loops on one packet, escalate to the architect,
4. runtime-sensitive changes must add regression coverage in the same wave,
5. a local green result does not stop the whole wave if explicit TODOs remain.

## 8. Current default team mode for this repo

For the current `v0.3` wave:

1. Bao Zheng: main-thread scheduling for the `v0.3` wave
2. Gong Sun Ce: product-flow boundaries, cleanup-report truth, and observability-foundation scope
3. Zhan Zhao: main-path implementation and cross-module integration
4. worker squad:
   - Zhang Long: landing workflow and productized entry
   - Zhao Hu: scan-page recognition summary and state wiring
   - Wang Chao: keep-and-clean reporting and `SQLite` aggregation
   - Ma Han: observability foundation and ignore-rule hygiene
5. Ba Xian Wang: final wave acceptance

## 9. Entry points

1. [Execution Standards](./execution-standards.en.md)
2. [v0.3 Execution Design](/Users/jt/places/personal/app-cleaner/docs/plans/2026-04-22-v0-3-productization-design/_index.en.md)
3. [v0.3 Execution Plan](/Users/jt/places/personal/app-cleaner/docs/plans/2026-04-22-v0-3-productization-plan/_index.md)
4. [Team Mode Board](/Users/jt/places/personal/app-cleaner/docs/plans/2026-04-22-v0-3-productization-plan/team-mode-board.md)
