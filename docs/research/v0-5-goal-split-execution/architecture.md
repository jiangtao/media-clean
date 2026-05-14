# 总体架构

## 背景

当前 v0.5 后续方向已经从“一个大目标”拆成三个可独立推进的 goal。拆分后的关键是保持依赖方向清晰，避免 UI 治理、桌面产品化、算法迁移互相拖住。

架构总原则：

```text
Product Surfaces
  Android RN app
  CLI
  Electron Desktop
  Codex skill
  future iOS

Adapters
  Android Kotlin adapter
  Rust CLI adapter
  Node / napi-rs adapter
  Electron main-process adapter
  future Swift / UniFFI adapter

Shared Recognition Core
  media_clean_core
  metrics / hash / scoring / clustering / cleanup candidate

Contracts
  schemas
  fixtures
  algorithmVersion
  parity tests
```

依赖方向必须单向：

```text
surface -> adapter -> media_clean_core -> schema/model primitives
```

## Goal 分层

### P0 Rust Core 和 CLI

P0 的目标是先建立能被验证的算法与跨平台执行闭环：

```text
engines/recognition-rust/
  crates/media_clean_core
  crates/media_clean_cli
  crates/media_clean_tui       # optional
  crates/media_clean_napi      # Electron / skill handoff

schemas/media-clean-result.schema.json
fixtures/media-clean-result/
scripts/scan/
```

`media_clean_core` 只负责平台无关识别逻辑。它不能依赖 React Native、Node、Android、Electron 或 Codex skill。

`media_clean_cli` 是第一产品化入口，优先保证：

1. machine-readable JSON / JSONL。
2. schema-compatible session output。
3. safe dry-run quarantine。
4. 可被 skill / CI / Electron fallback 调用。

### P1 Electron Desktop

P1 的目标是面向小白用户的桌面产品。它依赖 P0 的稳定 contract：

```text
media-clean-desktop/
  main process
    native addon loader
    CLI fallback
    filesystem / quarantine / LLM provider orchestration
  preload
    typed IPC bridge
  renderer
    scan / review / plan / quarantine workbench

packages/media-clean-engine/
  npm wrapper for media_clean_napi
  optional CLI shim
```

如需在主应用仓库做短期 architecture spike，可临时映射为 `apps/desktop/`，但完整发布态 Desktop 不长期留在主应用仓库。

Electron 只负责桌面体验、文件授权、长任务编排和安全清理，不复制识别算法。

### P2 多语言、多主题重构

P2 的目标是治理 RN UI 基础设施，保持功能与 main 一致：

```text
src/i18n/
  locales/<language>/<namespace>.ts
  resources.ts
  schema.ts
  formatters.ts
  app-copy.ts compatibility facade

src/theme/
  tokens/
  generated/
  adapters/
  app-theme.ts compatibility facade
```

P2 不依赖 Rust Core，也不阻塞 CLI。它为 Android UI 长期维护和 Electron renderer 未来复用 token / i18n 做准备。

## Contract 边界

三个 goal 的共享 contract：

1. `media-clean-result.schema.json`
2. `golden-session.json`
3. `algorithmVersion`
4. `themeVersion`
5. i18n namespace schema
6. cleanup plan / quarantine dry-run contract

P0 可以修改 schema，但必须同步 fixture 和验证脚本。P1 只能消费稳定 schema。P2 可以新增 themeVersion / i18n namespace，但不得改变产品功能。

## Android 对齐

Android 保持当前生产职责：

1. MediaStore 枚举。
2. 权限和 foreground service。
3. worker lifecycle。
4. 进度、checkpoint、cancel/resume。
5. RN bridge 和 fallback。

Rust Core 后续逐步接管平台无关逻辑：

1. metrics。
2. content / perceptual / difference hash。
3. duplicate / near-similar / low-value candidate。
4. scoring / threshold / clustering。

Android 迁移必须先做 parity，再替换逻辑。

## 发布和包管理

详细仓库边界见 [仓库与发版边界](./repo-release-boundaries.md)。核心决策是：当前仓库是主应用仓库，Rust Core / CLI 只在 P0 初期孵化，稳定后优先拆到 engine/package 边界；Electron Desktop 和 Codex skill 不作为主应用仓库的长期发布产物。

短期：

1. Rust core 和 CLI 在本仓库 repo-local 验证。
2. npm package 只作为 P1/P0 handoff 的包装目标。
3. Electron Desktop 不进入完整发布，先做 architecture spike 和 package smoke。

中期：

1. `@mistap/media-clean-engine` 发布预构建 N-API 产物。
2. Rust CLI 通过 GitHub Release 或 npm binary shim 分发。
3. Electron app 使用 N-API，保留 CLI fallback。

后期：

1. Android AAR / native library 接入。
2. iOS XCFramework / UniFFI 接入。
3. skill 发布包和桌面产品线拆出独立仓库或独立发布单元。

## 不做范围

本轮方案不做：

1. 不实现 Rust Core。
2. 不创建 Electron app。
3. 不迁移 i18n/theme 代码。
4. 不跑构建或真机验证。
5. 不修改 `docs/goal` 原始目标文件。
