# Rust-first 项目分层与发包管理

[English Version](./project-layering-and-packaging.en.md)

## 背景

当前路线已经收束为：

```text
Android-first production baseline
Rust-first shared recognition core
CLI / skill / desktop reuse the same core
iOS later through a stable adapter
```

因此项目管理的重点不是“把 Rust、Node、Android、skill 都混在一起”，而是明确每层职责、依赖方向、发包边界和验证门禁。

## 总体分层

推荐采用 **core first, adapters thin, packages explicit**：

```text
Product Surfaces
  Android RN app
  Codex skill
  CLI
  Electron desktop app
  future iOS app

Adapters
  Android Kotlin adapter
  Node.js / napi-rs adapter
  Rust CLI adapter
  Electron main-process adapter
  future Swift / UniFFI adapter

Shared Recognition Core
  media_clean_core
  deterministic metrics
  hash / duplicate / clustering / scoring
  cleanup candidate generation

Contracts
  schemas
  golden fixtures
  algorithmVersion
  parity tests
```

依赖方向必须单向：

```text
Product surface -> adapter -> media_clean_core -> schema / model primitives
```

`media_clean_core` 不能依赖 React Native、Node.js、Android、iOS、桌面 UI 或 Codex skill。它只能依赖 Rust 生态里的算法、数据结构和必要的图像处理库。

## 仓库管理策略

当前阶段继续放在本仓库，但用目录边界隔离：

```text
engines/recognition-rust/
  Cargo.toml
  crates/
    media_clean_core/
    media_clean_cli/
    media_clean_napi/
    media_clean_uniffi/        # later
  fixtures/
  benches/

packages/
  media-clean-engine/          # npm package wrapper, later

schemas/
  media-clean-result.schema.json

fixtures/
  media-clean-result/

scripts/
  scan/
```

本仓库当前只管理：

1. Rust shared core。
2. Rust CLI spike。
3. napi-rs Node binding。
4. schema、fixtures、parity tests。
5. Android adapter 对齐。
6. dev skill wrapper / smoke wrapper。

暂不在本仓库承载：

1. 发布态 Codex skill 完整模板。
2. 完整 Electron / Tauri desktop app。
3. 用户媒体样本、模型缓存、大量 prompt 实验。

当 skill 或 desktop UI 成为独立产品线时，再拆到：

```text
skills/media-clean
apps/desktop
```

或者独立仓库。

## Rust Crate 分层

### `media_clean_core`

唯一算法主线。

职责：

1. 输入标准化后的 asset metadata、thumbnail bytes、frame bytes 或临时文件路径。
2. 计算 brightness、contrast、edge、blur、hash。
3. 生成 duplicate / near-similar / low-value / screenshot 等候选。
4. 维护 threshold、scoring、cluster、cleanup reason。
5. 输出 schema-compatible result。

禁止：

1. 依赖 Node.js。
2. 依赖 React Native。
3. 直接访问 Android MediaStore。
4. 直接实现 UI、skill workflow 或 LLM provider。

### `media_clean_cli`

纯 Rust binary。

职责：

1. filesystem source。
2. `media-clean scan`。
3. `media-clean plan`。
4. `media-clean quarantine --dry-run`。
5. 输出 JSON / JSONL / SQLite artifact。

它服务 desktop、shell、GitHub Release，也可作为 npm package 的 fallback binary。

### `media_clean_tui`

可选 Rust TUI frontend，推荐基于 Ratatui。

职责：

1. 给人类用户提供 terminal workbench。
2. 复用 `media_clean_core`、session store、cleanup plan、quarantine adapter。
3. 展示 scan progress、candidate list、cluster detail、LLM review、dry-run quarantine preview。
4. 只作为 interactive mode，不作为 skill / CI / automation 的主接口。

推荐入口：

```bash
media-clean scan ~/Pictures --out .media-clean/session.json
media-clean review .media-clean/session.json --llm ollama:qwen3-vl --out review.json
media-clean tui .media-clean/session.json
media-clean tui ~/Pictures --scan
```

不推荐让 skill 调 TUI。skill 应调用机器可读 CLI：

```bash
media-clean scan ~/Pictures --format json --out session.json
media-clean plan session.json --format json --out cleanup-plan.json
media-clean quarantine cleanup-plan.json --dry-run --format json
```

TUI 可复用的内容：

1. Rust core 识别算法。
2. schema / session / plan / quarantine contract。
3. theme token 的终端颜色映射。
4. command/service 层：scan job、review job、plan job。

TUI 不复用的内容：

1. Electron / RN 的视觉组件。
2. Tailwind className。
3. NativeWind。
4. skill 的自然语言报告模板。

TUI 的价值：

1. 比纯 CLI 更适合人工复核大量候选。
2. 比 Electron 更轻，适合 SSH / 远程机器 / 开发者工作流。
3. 与 Rust core 同语言，分发为同一个 standalone binary 更自然。

TUI 的边界：

1. 不承担复杂缩略图网格和富媒体预览主体验；那是 Electron 的责任。
2. 终端图片预览只作为增强能力，不作为核心验收标准。
3. 所有 destructive action 仍必须默认 dry-run，并要求明确确认。

### `media_clean_napi`

napi-rs Node binding。

职责：

1. 给 npm package、Codex skill、Node workflow 暴露批量 API。
2. 调用 `media_clean_core`。
3. 返回 schema-compatible JSON。

建议 API：

```ts
scanDirectory(options): Promise<ScanSession>
analyzeBatch(inputs): Promise<AnalyzedAsset[]>
buildCleanupPlan(session): Promise<CleanupPlan>
reviewSessionWithProvider(session, providerOptions): Promise<ReviewResult>
```

禁止：

1. 复制识别规则。
2. 逐像素或逐字段跨 N-API 高频调用。
3. 把 Node.js 作为移动端共享层。

### `media_clean_uniffi`

后置移动 binding。

职责：

1. 生成 Kotlin / Swift binding。
2. 服务 Android / iOS adapter。
3. 保持与 CLI / npm 相同 core 和 fixtures。

不在第一阶段推进；等 Rust core 和 CLI parity 稳定后再接。

## Android 对齐

Android 继续保留当前结构：

```text
AndroidNativeScanExecutor
  MediaStore source
  permission
  foreground service
  worker lifecycle
  progress / checkpoint / cancel / resume
  RN bridge events
```

Rust 接管顺序：

1. 先接 metrics / hash。
2. 再接 scoring / cluster。
3. 再接 cleanup candidate。
4. 最后评估是否用 UniFFI/JNI 替换更多平台无关逻辑。

不应先重写：

1. MediaStore enumeration。
2. foreground service。
3. RN bridge。
4. permission / lifecycle。

## npm 与 Skill 发包

推荐 npm 包：

```text
@mistap/media-clean-engine
```

包内容：

```text
dist/
  index.js
  index.d.ts
native/
  darwin-arm64/*.node
  darwin-x64/*.node
  linux-x64/*.node
  linux-arm64/*.node
  win32-x64/*.node
bin/
  media-clean
```

发包原则：

1. 默认安装预编译 `.node`，用户不需要 Rust。
2. npm package 只包装 `media_clean_core`，不复制算法。
3. CLI binary 可作为 Node addon 不可用时的 fallback。
4. skill 依赖 npm package 或 CLI binary，不 vend Rust 源码。
5. Node API 和 CLI output 都必须包含 `schemaVersion`、`engine.version`、`algorithmVersion`。

## 桌面 UI 框架决策

桌面端推荐 **Electron-first + Rust N-API**，Tauri 作为后续轻量化备选。

对当前产品，Electron 更合适的原因：

1. UI 体验更稳定：Electron 自带 Chromium，同一套 React / TypeScript UI 在 macOS、Windows、Linux 上更一致。
2. 与 skill / npm 发包路径一致：Electron main process 可以直接复用 `@mistap/media-clean-engine` 和 `media_clean_napi`。
3. 桌面生态更成熟：复杂窗口、自动更新、菜单、托盘、文件拖放、DevTools、崩溃诊断、打包发布经验更充足。
4. 本产品是媒体识别工作台，需要缩略图网格、contact sheet、LLM review、长任务进度、批量 plan 和安全 quarantine，Electron 的 Web UI 复杂度承载更稳。

Tauri 的优势：

1. 包体和内存占用更低。
2. Rust 后端是默认模型，和 `media_clean_core` 理念接近。
3. 更适合轻量工具、简单 UI、本地 Rust 命令为主的场景。

Tauri 的主要代价：

1. 默认使用系统 WebView，Windows 是 WebView2，macOS 是 WKWebView，Linux 是 webkitgtk；UI 和 Web API 行为更容易出现平台差异。
2. 如果 skill / npm 仍走 napi-rs，Tauri 会多出一套 Tauri command adapter，不能直接复用 N-API 作为桌面主路径。
3. 复杂桌面工作台的生态和排障经验弱于 Electron。

需要强调：Tauri 也是 Web 技术栈，不是不行。它同样可以用 React / TypeScript 写 renderer，也能通过 Rust backend 调 `media_clean_core`。真正差异在于桌面 shell 和 native bridge：

| 维度 | Electron + Rust N-API | Tauri + Rust command |
| --- | --- | --- |
| Renderer 技术 | React / TypeScript / Chromium | React / TypeScript / 系统 WebView |
| WebView 一致性 | 自带 Chromium，跨平台渲染更一致 | 使用系统 WebView，平台差异更明显 |
| Rust core 接入 | 通过 napi-rs `.node`，与 npm / skill 共用 | 通过 Tauri command，需单独 adapter |
| skill / npm 复用 | 最直接，桌面和 skill 可共用 `@mistap/media-clean-engine` | skill 仍走 napi-rs，桌面走 Tauri command，会有两套 binding |
| 包体 / 内存 | 更大 | 更小 |
| 复杂工作台 UI | 更稳，Chromium 能力和排障路径成熟 | 可做，但要承担 WebView 差异和 Tauri adapter 成本 |
| 自动更新 / 打包生态 | Electron Forge / Builder 路线成熟 | Tauri 也支持，但团队经验和 npm native addon 复用较弱 |
| 长任务隔离 | main / utility process / worker + N-API | Rust core process + WebView IPC |
| 适合阶段 | 当前阶段：复杂 UI + skill/npm 复用 + 快速产品化 | 后续阶段：包体/内存成为硬约束后再评估 |

Tauri 不适合作为当前首选的具体点：

1. **不是同一个 Node 发包入口**
   我们的 skill、CLI wrapper、Node workflow 已经倾向 `@mistap/media-clean-engine -> media_clean_napi -> media_clean_core`。Electron main process 可以直接复用这条链路；Tauri 桌面端更自然是 `Tauri command -> media_clean_core`，这会让桌面端和 skill 端出现两套 binding，需要额外 parity 和 release gate。

2. **WebView 不是统一 Chromium**
   Tauri 省包体的核心原因是使用系统 WebView。代价是 macOS、Windows、Linux 的渲染、媒体能力、文件拖放、剪贴板、字体、滚动、Web API 支持和调试表现可能不同。我们的 UI 是媒体识别工作台，不只是简单表单，缩略图网格、contact sheet、批量选择、长任务进度和 LLM review 面板都依赖较复杂的 Web UI 行为。

3. **复杂桌面能力要重新接 Tauri 插件 / command 边界**
   本产品需要文件系统、目录授权、quarantine、打开 Finder / Explorer、系统通知、菜单、托盘、自动更新、本地 LLM provider、后台任务、崩溃诊断。Tauri 能做，但每一项都要走 Tauri plugin / command / permission model；Electron 这类复杂桌面工作台路径更常见，也更容易复用 Node 生态排障。

4. **N-API 在 Tauri 中不是天然主路径**
   Tauri 后端本身就是 Rust，理论上不需要 N-API。如果为了和 skill/npm 复用而在 Tauri 里再嵌 Node/N-API，反而抵消 Tauri 的轻量优势；如果不用 N-API，桌面端又和 skill/npm 发包路径分叉。

因此当前不是否定 Tauri，而是把它放到后置条件：

```text
选 Electron:
  当目标是复杂桌面工作台、跨平台 UI 一致性、复用 npm/napi-rs、快速产品化

选 Tauri:
  当目标是轻量包体、低内存、Rust command 为主、UI 较简单，且接受单独维护 Tauri adapter
```

推荐结论：

```text
Phase 1 desktop: Electron + Rust N-API
  Electron main process -> @mistap/media-clean-engine -> media_clean_napi -> media_clean_core
  Renderer -> typed IPC only

Later optimization: evaluate Tauri
  only if package size / idle memory / native shell footprint becomes a blocking product issue
```

Electron 安全边界：

1. Native addon 只在 main process 或受控 worker / utility process 里加载。
2. Renderer 不直接访问 `.node`、文件系统、删除能力或 LLM provider secret。
3. Preload 暴露最小 typed IPC，例如 `scanDirectory`、`loadSession`、`buildPlan`、`quarantineDryRun`。
4. CLI binary 作为 fallback，避免某个平台 native addon 加载失败时桌面端不可用。

## 版本管理

需要分开管理四种版本：

```text
schemaVersion
  result JSON contract version

algorithmVersion
  threshold / scoring / hash / cluster behavior version

engine.version
  Rust engine implementation version

package version
  npm / CLI / app release version
```

规则：

1. schema 变化必须升级 `schemaVersion`。
2. scoring / threshold / hash 变化必须升级 `algorithmVersion`，即使 API 没变。
3. Rust crate、npm package、CLI binary 可以同版本发布，但不能替代 `algorithmVersion`。
4. Android app version 独立，但 release note 要记录 bundled engine version。
5. skill package version 独立，但要声明依赖的 engine version range。

## 发布阶段

### Phase A: Repo-local

目标：证明 Rust core 可行。

产物：

1. `media_clean_core`
2. `media_clean_cli`
3. schema output
4. Go spike / Android native / Rust CLI parity report

门禁：

```bash
cargo test
cargo run -p media_clean_cli -- scan <fixture>
npm run verify:schema:media-clean-result
npm run verify:desktop-go:scan
```

### Phase B: Internal npm

目标：让 skill / Node wrapper 通过 npm 包调用 Rust。

产物：

1. `media_clean_napi`
2. `@mistap/media-clean-engine`
3. prebuilt `.node`
4. dev skill wrapper

门禁：

```bash
cargo test
npm test
npm run verify:schema:media-clean-result
node scripts/scan/verify-media-clean-engine-package.mjs
```

### Phase C: Public CLI / Skill

目标：用户可以安装并执行。

产物：

1. npm package。
2. GitHub Release standalone binaries。
3. skill package。
4. changelog with schema / algorithm / engine versions。
5. optional `media-clean tui` interactive mode。

门禁：

1. macOS arm64 smoke。
2. macOS x64 smoke。
3. Linux x64 smoke。
4. Windows x64 smoke。
5. skill dry-run scan。
6. quarantine dry-run safety check。
7. TUI open / navigate / dry-run smoke, without requiring terminal image preview support。

### Phase D: Electron Desktop

目标：桌面端形成 Electron app。

产物：

1. `apps/desktop` Electron app。
2. `@mistap/media-clean-engine` bundled N-API addon。
3. `media-clean` CLI fallback。
4. local LLM provider settings。
5. scan / review / plan / quarantine UI。

门禁：

1. Electron main-process package smoke。
2. Renderer IPC smoke。
3. Native addon load smoke。
4. CLI fallback smoke。
5. quarantine dry-run safety check。
6. macOS / Windows / Linux packaging smoke。

### Phase E: Mobile Return

目标：Android / iOS 接入同一 Rust core。

产物：

1. Android `.so` / AAR / Kotlin adapter。
2. iOS XCFramework / Swift adapter。
3. mobile parity fixtures。

门禁：

1. Android emulator-core lane。
2. Android real-device lane。
3. iOS adapter smoke, once implemented。
4. CLI / Android / iOS same fixture parity。

## CI 管理

建议拆成四组 workflow：

```text
mobile-android.yml
  typecheck
  tests
  Android assemble
  emulator lane

engine-rust.yml
  cargo fmt
  cargo clippy
  cargo test
  CLI fixture scan

engine-node.yml
  napi build
  npm test
  package smoke

contract-parity.yml
  schema validation
  golden fixtures
  Android output vs Rust output
  Go spike output vs Rust output
```

## 决策

推荐管理方式：

1. 本仓库先作为 Android-first + shared engine monorepo。
2. Rust core 放 `engines/recognition-rust`。
3. npm 包放 `packages/media-clean-engine`，只做 napi-rs wrapper。
4. 桌面端采用 Electron-first + Rust N-API；Tauri 作为后续轻量化备选。
5. CLI 可以复用 TUI，但 TUI 只作为 human interactive mode；skill / CI / automation 必须走 non-interactive JSON CLI。
6. 所有入口只允许调用 `media_clean_core`，不允许复制识别规则。
7. 发版以 `schemaVersion + algorithmVersion + engine.version + package version` 四层版本记录行为。

## 明确 TODO

1. 新增 Rust workspace：`engines/recognition-rust`。
2. 新增 `media_clean_core`，先迁移 metrics / hash / scoring 的最小子集。
3. 新增 `media_clean_cli`，输出当前 `media-clean-result.schema.json`。
4. 新增 parity fixture：Rust CLI output vs Go spike output vs Android native output。
5. 新增 `media_clean_napi`，只做批量 API wrapper。
6. 新增 Electron desktop design spike：main process 调 N-API，renderer 只走 typed IPC。
7. 后续再决定 `packages/media-clean-engine` 与 `apps/desktop` 是否在本仓库发布，或拆到独立 package / desktop repo。
