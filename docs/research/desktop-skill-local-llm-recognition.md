# 桌面 / Skill 优先的本地识别与 LLM 路线

[English Version](./desktop-skill-local-llm-recognition.en.md)

## 背景

当前产品方向从“先把 Android App 跨到 iOS”调整为：

```text
Android-first 保持生产基线
桌面端 / CLI / skill 成为识别算法和本地 LLM 结合的创新主线
iOS 后续再基于稳定 contract 接入
```

这意味着 v0.5 的架构拆分不能只围绕移动端共享展开。更重要的是先把本地媒体识别能力做成可批处理、可复核、可被 AI 工作流调用的桌面 engine。

本路线参考：

1. Ollama structured outputs，可用 JSON schema 约束本地模型输出：[Ollama Structured Outputs](https://docs.ollama.com/capabilities/structured-outputs)。
2. LM Studio 本地 server / OpenAI-style endpoints：[LM Studio API](https://lmstudio.ai/docs/api)。
3. LM Studio tool use，可通过本地 server 调用工具：[LM Studio Tool Use](https://www.lmstudio.ai/docs/advanced/tool-use)。
4. llama.cpp `llama-server` 提供 OpenAI-compatible HTTP API：[llama.cpp server](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md)。
5. OpenAI Structured Outputs 作为 schema-constrained 输出参考：[Structured Outputs](https://platform.openai.com/docs/guides/structured-outputs?api-mode=chat)。

## 产品定位

桌面 / skill 方向的核心不是“手机清理 App 的桌面版”，而是：

```text
Local Media Recognition Workbench
  本地目录扫描
  本地识别算法
  本地 LLM 复核
  JSON / SQLite 结果
  cleanup plan
  安全 quarantine
  Codex skill 自动化入口
```

Android 继续作为移动端生产场景和真机验证场；桌面 / skill 用来快速迭代识别算法、本地 LLM 解释和批量清理工作流。

## 复用方向

skill、CLI、桌面端和后续移动回流要尽量复用同一套识别算法核心。推荐约束是：

```text
media-clean CLI / Codex skill / desktop UI
  -> call shared recognition engine
      deterministic metrics
      perceptual hash / duplicate / clustering
      scoring / cleanup candidate generation
      schema-compatible session output
  -> optional local LLM review
  -> report / plan / quarantine
```

这意味着：

1. CLI 是 skill 的稳定执行入口，但 CLI 不应该重新实现一套独立规则。
2. Codex skill 只做自动化、报告、用户确认和 quarantine，不直接写扫描算法。
3. Node.js 可以做 npm CLI wrapper 和 LLM glue，但核心识别应来自共享 engine。
4. Go 当前只证明 desktop / CLI 可行；长期主线默认收束到 Rust shared core，Go spike 的规则必须迁到共享 core，不能形成第二套算法。
5. Android Kotlin 当前保留生产基线，但后续要通过 shared schema、golden fixtures 和 threshold tests 与共享 core 对齐。

这样做的价值是：识别算法一端优化后，skill、CLI、桌面工作台、Android 和后续 iOS 都能复用同一组判断能力，维护成本和误判漂移都会降低。

## 本仓库边界

桌面 / skill 方向可以继续在本仓库推进，但只推进到 shared engine 和 dev wrapper 这一层：

1. 适合留在本仓库：
   - `engines/recognition-rust` shared core。
   - `media-clean` CLI spike。
   - schema、fixtures、Android parity tests。
   - Node.js dev wrapper，用于模拟 skill 调 CLI。
2. 暂不适合留在本仓库：
   - 发布态 Codex skill 包。
   - 完整 macOS 桌面 UI。
   - 大量本地 LLM prompt 实验、模型缓存、用户媒体样本。

原因是当前仓库仍是 Android-first 产品仓库。Rust core 放进来可以让 Android adapter、schema、fixtures 和验证闭环保持同步；但 skill / desktop 产品化层一旦过大，应拆到独立 skill repo、desktop app repo，或后续 monorepo 的 `apps/desktop` / `skills/media-clean` 边界下。

## CLI / Skill 发包策略

skill 方向推荐用 npm 包管理入口，但 npm 包内部不应该重新实现算法：

```text
@mistap/media-clean-engine
  JS API / CLI shim / skill-friendly wrapper
  -> napi-rs native addon
      -> media_clean_core
  -> or standalone media-clean binary fallback
```

推荐保留两种分发形态：

1. npm + napi-rs
   - 面向 Codex skill、Node.js workflow、LLM glue、报告生成。
   - 用户通过 npm 安装预编译 `.node`，不需要装 Rust。
   - 适合暴露 JS API：`scanDirectory`、`reviewSession`、`buildCleanupPlan`。
2. standalone Rust binary
   - 面向没有 Node 依赖的 desktop daemon、shell 脚本、GitHub Release。
   - 适合长任务、本地服务和后续桌面 UI 调用。

Rust N-API 的定位是“Node 包装层”，不是“移动共享层”。Android / iOS 后续仍应通过 Rust native library + Kotlin / Swift adapter 接入同一 `media_clean_core`。

发布规则：

1. `media_clean_core` 变更必须先过 Rust unit tests、schema fixture、Android parity fixture。
2. `media_clean_napi` 只允许调用 core，不允许复制识别规则。
3. `@mistap/media-clean-engine` 的版本要记录 `engine.version` 和 `algorithmVersion`。
4. threshold / scoring 变化即使 API 不变，也要进入 changelog，因为用户可见结果会变化。
5. skill 包只依赖 npm package 或 CLI binary，不直接 vend Rust 源码。

## 分层架构

```text
CLI / Skill / macOS Workbench
  -> Local Scan Engine
      -> FileSystemSource
      -> Native Analyzer
          blur / exposure / edge / hash / duplicate / video frame
      -> Embedding / Cluster Layer
          image embedding / perceptual hash / similarity graph
      -> Local LLM Review Layer
          structured JSON output
          explain / classify / suggest cleanup
      -> Result Store
          sqlite / jsonl / thumbnails / audit trail
      -> Quarantine Adapter
          never direct delete by default

Android App
  -> keeps current Kotlin native executor
  -> aligns through shared scan result contract
```

## LLM 使用原则

本地 LLM 不应该替代底层识别算法，也不应该逐张图片盲跑。推荐三段式：

1. Native deterministic first
   - 每张媒体先跑 deterministic 指标：blur、brightness、contrast、edge density、pHash/dHash、content hash、EXIF、file size、duration。
   - 先筛出明确的重复、近似、模糊、低质量、超大视频、截图等候选。
2. Cluster / sample
   - 对相似媒体分组。
   - 每组生成代表图、缩略图 contact sheet、元数据摘要。
   - 只把有价值的候选组交给 LLM。
3. Local LLM structured review
   - 调 Ollama / LM Studio / llama.cpp / OpenAI-compatible local endpoint。
   - 强制 JSON schema 输出。
   - LLM 只做解释、归类、风险复核、用户可读建议，不直接执行删除。

## LLM 输出合同

LLM 输出必须可验证、可缓存、可回放。建议初始 schema：

```json
{
  "clusterId": "cluster-001",
  "category": "duplicate | near_similar | blurry | low_value | screenshot | document | video | unknown",
  "confidence": "high | medium | low",
  "cleanupReason": "string",
  "keepReason": "string | null",
  "representativeAssetIds": ["asset-id"],
  "risk": "safe | review | keep",
  "suggestedAction": "quarantine | review | keep",
  "model": "provider:model",
  "promptVersion": "local-review/v1"
}
```

规则：

1. `suggestedAction=quarantine` 也只是生成 plan，不直接移动文件。
2. `risk=review` 必须进入人工确认队列。
3. 所有 LLM 输入要保留摘要，不默认保存原图 base64。
4. prompt、model、schema version、source cluster 都要进入 audit trail。
5. 结构化输出解析失败时，降级为 deterministic result，不允许阻塞扫描完成。

## 已落地的共享结果合同

当前已增加第一版端到端结果合同，作为 Android native executor、未来 Rust-first desktop engine、Go comparison spike、Node.js skill wrapper 和本地 LLM review 的共同边界：

1. Schema: `schemas/media-clean-result.schema.json`
   - 覆盖 `session`、`assets`、`clusters`、`llmReviews`、`cleanupPlans`、`quarantineActions`。
   - 明确 `engine.kind` 可取 `android-native`、`desktop-rust`、`desktop-go`、`node-wrapper`、`fixture`。
   - `llmReviews` 与 `cleanupPlans` 都可以是空数组，保证没有 LLM 时 deterministic scan 仍可完成。
2. Golden fixture: `fixtures/media-clean-result/golden-session.json`
   - 代表一个可回放 session：原始媒体、确定性指标、候选分组、LLM 复核、清理计划、安全 quarantine action。
3. Verification: `npm run verify:schema:media-clean-result`
   - 使用轻量本地校验器验证 golden fixture，先不强依赖额外 JSON Schema runtime。

这个合同不是算法实现本身；它用于约束多语言 engine 的输出一致性，避免 Android、桌面 CLI、skill 和 LLM report 各自定义结果格式。

## 已落地的 Go Desktop Engine Spike

当前已增加一个最小 Go engine spike，用来验证“Go 适合 desktop daemon / CLI，但不承担移动共享主线”的判断：

1. Engine source: `engines/desktop-go/cmd/media-clean-scan/main.go`
   - 使用 Go 标准库递归扫描目录。
   - 对 PNG / JPEG / GIF 读取尺寸、SHA-256 content hash、基础 brightness / contrast / edge-density 指标。
   - 发现低价值候选时只输出 `review` cleanup plan 和 `dry-run` quarantine action。
2. Manual CLI: `npm run scan:desktop-go`
   - 默认扫描 `assets/`，输出 `artifacts/scan/desktop-go-session.json`。
3. Verification: `npm run verify:desktop-go:scan`
   - 生成一张临时黑图 fixture。
   - 调 Go engine 输出 desktop result artifact。
   - 复用 `media-clean-result.schema.json` 校验结果。
   - 断言 `engine.kind=desktop-go`、`source.kind=desktop-filesystem`，且 quarantine 仍是 `dry-run`。

这不是最终算法实现，也不替代 Android Kotlin native executor；它是可审计 artifact，用来证明 desktop / CLI engine 可以独立输出同一合同，并为后续 Rust-first shared core 提供 Go 对照基准。

## CLI / Skill 命令形态

CLI 应是 skill 的稳定执行入口，但 CLI 和 skill 必须调用同一份 shared recognition engine，而不是在 skill、Node wrapper 或 Go spike 里分叉规则：

```bash
media-clean scan ~/Pictures --out .media-clean/session.jsonl
media-clean review .media-clean/session.jsonl --llm ollama:qwen3-vl --out review.json
media-clean explain review.json --cluster cluster-001
media-clean plan review.json --out cleanup-plan.json
media-clean quarantine cleanup-plan.json --dry-run
media-clean quarantine cleanup-plan.json --confirm
```

Codex skill 只负责：

1. 调 CLI。
2. 读取 JSON / SQLite 结果。
3. 生成用户可读报告。
4. 根据用户确认执行 quarantine。
5. 不直接实现扫描算法。
6. 不绕过 quarantine 直接删除源文件。

## 技术选型

当前默认分层：

```text
Node.js
  skill wrapper / npm CLI / LLM provider / report UX

Rust shared recognition core
  desktop recognition engine / CLI / skill backend / mobile return path

Go desktop spike
  local daemon / filesystem scan feasibility probe

Optional C++ / OpenCV
  heavy image/video analyzer backend

Android Kotlin
  当前移动生产路径，先保留
```

选择规则：

1. 如果追求长期 engine SDK、算法能力、mobile 回流，默认选择 Rust。
2. 如果追求最快 desktop daemon / CLI，Go 可保留为对照 spike，但不默认扩展为第二套算法 core。
3. Node.js 用于 orchestration / skill wrapper / LLM glue，不作为重识别 engine。
4. OpenCV / C++ 是 analyzer backend，不是产品架构本身。
5. Android Kotlin native executor 不立即重写，通过 shared schema 和 golden fixtures 与桌面 engine 对齐。
6. shared recognition core 默认 Rust-first；Go / Android Kotlin 的规则不能长期平行演化，只允许保留薄 adapter、平台专属 source / lifecycle 代码和短期对照实现。

## 执行 TODO

1. 已完成第一版 `media-clean-result.schema.json` 与 golden fixture；后续需要让 Android native output 和桌面 engine output 都跑过同一验证。
2. 已完成 Go desktop CLI spike 的第一版 schema artifact；后续需要补真实缩略图缓存、SQLite / JSONL store 和批处理 checkpoint。
3. 增加本地 LLM provider 层：
   - Ollama。
   - LM Studio。
   - llama.cpp OpenAI-compatible endpoint。
   - 后续可接任意 OpenAI-compatible provider。
4. 扩展 golden fixture：
   - Android Kotlin native output。
   - Desktop engine output。
   - LLM review output。
   - cleanup plan output。
5. 增加 Codex skill wrapper 设计：
   - 调 CLI。
   - 展示结果。
   - 用户确认。
   - dry-run / quarantine。
   - 明确 wrapper 不能实现识别规则，只能调用 shared engine artifact。
6. 桌面 UI 后置：
   - Electron First 已在 [Rust-first 项目分层与发包管理](./project-layering-and-packaging.md) 和 [v0.5 后续目标拆分决策记录](./v0-5-follow-up-goal-split.md) 中确定。
   - 完整桌面产品化等 Rust Core / CLI contract 稳定后推进。
7. iOS 后置：
   - 先只保留 contract-ready，不纳入当前交付完成标准。
8. 增加 shared recognition core spike：
   - 优先新增 Rust spike，用同一批 fixture 跑 Rust spike、Go spike 和 Android native output。
   - 比较输出一致性、性能、产物大小、用户安装负担和移动回流成本。
   - 默认 Rust 作为一套算法主线；除非 Rust spike 失败，其余实现降级为 adapter 或实验。
9. 增加 Android 对齐任务：
   - Rust core 先覆盖 metrics / hash / scoring / cluster，不接管 MediaStore、foreground service、RN bridge。
   - Android Kotlin adapter 负责 source enumeration、worker lifecycle、progress、checkpoint、cancel/resume。
   - 用 Android native output 与 Rust CLI output 跑同一 schema 和 fixture parity。
