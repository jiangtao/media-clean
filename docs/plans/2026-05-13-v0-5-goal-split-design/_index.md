# v0.5 后续 Goal 拆分执行方案

## 背景

本方案基于 [v0.5 依据与方案文档索引](../../research/_index.md) 和 [v0.5 后续目标拆分决策记录](../../research/v0-5-follow-up-goal-split.md)。

本次只做 goal 拆分和执行方案设计，不进入实现、不跑构建、不修改 runtime 代码。

当前三个后续 goal：

1. **P0 Rust Core 和 CLI**：建立共享识别算法核心，并先通过 CLI 形成跨平台可用入口。
2. **P1 Electron Desktop**：在 Rust Core / CLI contract 稳定后，做面向小白用户的桌面产品。
3. **P2 多语言、多主题重构**：做架构治理，保持 main 分支功能一致，不扩产品能力。

## 核心决策

1. `Rust Core` 是 `CLI` 和 `Electron Desktop` 的硬依赖。
2. `CLI` 是 `Rust Core` 的第一个产品化验证入口，也是 skill / CI / automation 的稳定接口。
3. `Electron Desktop` 后置到 P1，等 Rust Core / CLI contract 稳定后产品化。
4. 多语言、多主题治理降级为 P2，可并行推进，但不阻塞 P0。
5. 本轮所有方案都必须保留 Android Kotlin native executor 作为生产基线，不把重扫描和识别逻辑搬回 TypeScript。

## Design Documents

1. [总体架构](./architecture.md)
2. [BDD 规格](./bdd-specs.md)
3. [最佳实践](./best-practices.md)
4. [P0 Rust Core 和 CLI 执行方案](./p0-rust-core-cli.md)
5. [P1 Electron Desktop 执行方案](./p1-electron-desktop.md)
6. [P2 多语言、多主题重构执行方案](./p2-i18n-theme-governance.md)
7. [仓库与发版边界](./repo-release-boundaries.md)
8. [并行执行工作板](./parallel-execution-board.md)

## 目标依赖图

```text
P0 Rust Core
  -> P0 CLI
      -> P1 Electron Desktop

P2 i18n/theme governance
  -> supports Android UI maintainability
  -> supports future Electron theme/i18n reuse
  -> does not block P0
```

## 推荐执行顺序

第一队列：

1. P0 Rust Core skeleton。
2. P0 shared schema / fixture parity。
3. P0 machine CLI。

第二队列：

1. P0 human-friendly CLI output。
2. P0 optional TUI。
3. P1 Electron architecture spike。

第三队列：

1. P1 Electron main-process integration。
2. P1 renderer workbench。
3. P2 i18n/theme governance。

P2 可以与 P0 并行，但不得与 Android native executor 大改混在同一个 PR 或同一执行波次里。

## 后续执行入口

后续进入执行时，应分别创建独立执行计划或 worktree：

1. `goal/p0-rust-core-cli`
2. `goal/p1-electron-desktop`
3. `goal/p2-i18n-theme-governance`

每个 goal 独立验收，不能因为 P2 UI 治理完成而宣称 P0 engine 完成，也不能因为 CLI 可用而宣称 Electron Desktop 完成。

Design complete. Continue with superpowers:writing-plans to convert this into an executable plan.
