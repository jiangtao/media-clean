# Quality-First Execution System Design

[中文版本](./_index.md)

## Background

Per [docs/goal/v0.1.md](../../goal/v0.1.md), the project already defines a team structure and a “do not stop early” execution rule. The repository now contains multiple design, planning, standards, and implementation paths, but it still lacks a unified rule set for how the team participates in ongoing execution and how TODO work should be frozen or released when runtime issues appear.

This creates three problems:

1. Team roles exist in the goal file but are not operationalized in the current execution rules.
2. “Quality first” is repeated often, but there is no hard rule for when runtime work is truly error-free and when TODO work may continue.
3. The backlog exists, but its sequencing and blocking conditions are not unified, so lower-priority refinement work can overtake delivery blockers.

## Goals

1. Turn Bao Zheng, Gong Sun Ce, Zhan Zhao, the execution squad, and Ba Xian Wang into executable repository rules.
2. Turn “client quality first, runtime issues before feature continuation” into hard quality gates.
3. Turn future TODO work into an ordered, testable, freeze-able execution queue.
4. Keep the new rules aligned with the current live path, BDD scenarios, and existing test capabilities.

## Options

### Option A: Keep relying on the goal file and thread-level memory

- Pros: zero new documentation cost.
- Cons: team roles remain symbolic instead of enforceable.

### Option B: Add an execution standard and pair it with design/plan artifacts

- Pros: the smallest change that makes team roles, quality gates, TODO queues, and acceptance sources explicit.
- Cons: it introduces one more long-lived standard that must be maintained.

### Option C: Build automation first without documenting the rules

- Pros: low long-term execution cost if fully implemented.
- Cons: the repo does not yet have a stable lint/CI foundation, so automation would lack a durable source of truth.

## Decision

Choose **Option B**.

Reasons:

1. It is the smallest way to turn the goal file’s team setup into real repository execution discipline.
2. The repo already has standards, design docs, and plan docs. An execution standard fits the existing structure naturally.
3. Runtime gating and TODO sequencing are rule problems before they are automation problems.

## Detailed Design

### 1. Execution standards become the long-lived source of truth

- Add [execution-standards.md](../../standards/execution-standards.md) as the long-lived execution standard.
- It does not replace `v0.1`; it operationalizes the team and rule structure defined there.

### 2. Team roles map directly into sub-agent execution

- Bao Zheng: Lead in the main thread.
- Gong Sun Ce: architecture reviewer through an `explorer`-style sub-agent or equivalent main-thread review.
- Zhan Zhao: critical-path implementation and root integration.
- Zhang Long, Zhao Hu, Wang Chao, and Ma Han: parallel workers with explicit ownership.
- Ba Xian Wang: acceptance, checking goals, standards, design, BDD, and tests together.

### 3. Runtime quality gates move to the front

- Every runtime-sensitive change must pass `typecheck` and `vitest --run`.
- Any runtime error freezes non-P0 TODO waves.
- “No error” must be defined by tests, type checks, and live-path validation together.

### 4. The TODO queue is made explicit

- `P0`: runtime, crashes, blocked main paths
- `P1`: goal-critical capabilities not yet wired into the live path
- `P2`: interaction and experience refinement
- `P3`: future-facing extension and pre-research
- Every TODO must carry an owner, dependencies, a BDD scenario, verification commands, and a definition of done.

### 5. Current delivery blockers

- recycle-bin data loading
- real tab badge counts
- recycle-bin detail navigation

Those items must be treated as delivery blockers before lower-priority refinement work.

## Risks and Boundaries

1. This design does not modify [docs/goal/v0.1.md](../../goal/v0.1.md).
2. It solves execution discipline and priority control first; it does not claim to finish the entire backlog immediately.
3. The repo does not yet have a unified lint/CI pipeline, so `typecheck + vitest --run` remains the minimum quality closure for now.

## Design Documents

- [BDD Specs](./bdd-specs.en.md)
- [Architecture](./architecture.en.md)
- [Best Practices](./best-practices.en.md)
