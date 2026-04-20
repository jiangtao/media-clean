# Architecture

[中文版本](./architecture.md)

## 1. Rule Layers

The execution system is split into four layers:

1. **Goal layer**: `docs/goal/v0.1.md`
2. **Standards layer**: `docs/standards/execution-standards.md`
3. **Design/plan layer**: this design and the follow-up execution plan
4. **Implementation/verification layer**: code, tests, `.feature` scenarios, and validation commands

The goal layer defines why the work exists, the standards layer defines how work must be executed over time, the design/plan layer defines what the current wave should do, and the implementation/verification layer proves whether it is actually complete.

## 2. Team Control Flow

```text
Bao Zheng (Lead)
  ├─ Gong Sun Ce (architecture review)
  ├─ Zhan Zhao (critical-path integration)
  ├─ Zhang Long / Zhao Hu / Wang Chao / Ma Han (parallel execution)
  └─ Ba Xian Wang (acceptance)
```

Control rules:

1. The Lead owns decomposition and freeze decisions.
2. Architecture review happens before cross-module integration.
3. Parallel execution must use disjoint file ownership.
4. Acceptance must remain independent from implementation.

## 3. Runtime Quality-Gate Architecture

Runtime work follows a “stop the bleed before expanding scope” strategy:

1. detect a runtime issue
2. freeze the current wave into `P0`
3. add the minimal failing test or targeted regression
4. fix the root cause
5. pass `typecheck`
6. pass targeted tests
7. pass full tests
8. reopen the original TODO wave

## 4. TODO Queue Architecture

Current default queue:

1. `P0` runtime main path  
   - scan cache
   - cooperative yielding
   - reminder cold-start reconcile
2. `P1` delivery blockers  
   - recycle-bin data flow
   - real badge counts
   - recycle-bin detail path
3. `P2` interaction and experience closure
4. `P3` longer-range extension work

## 5. Acceptance Architecture

Every task must pass four comparisons:

1. goal-file comparison
2. standards comparison
3. BDD comparison
4. test/command comparison

If any one of them fails, the task does not close.
