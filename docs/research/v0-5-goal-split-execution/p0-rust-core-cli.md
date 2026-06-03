# P0 Rust Core + mc CLI Algorithm Workbench 执行方案

## 背景

P0 是后续扫描和识别算法优化的根。没有 Rust Core 和稳定的 CLI 验证入口，Android、skill、桌面端和未来 iOS 会继续各自维护识别规则，算法优化无法复用。

本 goal 依据：

1. [Native Engine 主线方案调研](../native-engine-options.md)
2. [桌面 / Skill 优先的本地识别与 LLM 路线](../desktop-skill-local-llm-recognition.md)
3. [Rust-first 项目分层与发包管理](../project-layering-and-packaging.md)
4. [v0.5 后续目标拆分决策记录](../v0-5-follow-up-goal-split.md)

对应执行计划：

1. [P0 Rust Core + mc CLI Algorithm Workbench Plan](../../plans/2026-05-13-p0-rust-core-cli-plan/_index.md)

## 目标

建立一套 repo-local Rust recognition core 和 `mc` CLI algorithm workbench，使其能快速扫描本地样本、输出 shared schema compatible artifact、生成本地审阅报告，并为 Android parity、Go spike comparison、benchmark 和后续算法优化打基础。

## Node vs Rust 决策

当前阶段选择 **Rust CLI first**。

原因：

1. 扫描、解码、metrics、hash、聚类和评分都在 Rust core 内完成，Rust CLI 与 core 同进程调用，最适合做性能验证。
2. 避免 Node / N-API / child process 边界带来的序列化、安装和调试成本。
3. `cargo test`、`cargo bench`、fixture scan、parity report 可以形成最短算法迭代闭环。
4. 单二进制更适合后续 GitHub Release、CI smoke 和跨平台 benchmark。

Node 的定位后置：

1. skill wrapper。
2. LLM provider orchestration。
3. npm package / Node API。
4. 更复杂的 HTML / Web report packaging。
5. 后续桌面端 main process glue。

因此 P0 不做 Node shell，不做 N-API handoff。`mc` 当前就是 Rust CLI 命令。

## 输入输出 Contract

### `core` 输入结构

`core` 不直接扫描目录，也不处理 Android MediaStore、Node filesystem、Electron 文件授权或 RN bridge。它接收标准化后的 `CoreScanRequest`，由各平台 adapter / CLI 负责枚举来源、探测元数据、准备样本。

```text
CoreScanRequest
  schemaVersion
  source
    kind: android-media-store | desktop-filesystem | fixture
    root
    platform: android | macos | linux | windows | fixture
  engine
    name
    version
    algorithmVersion
  options
    hash: content | perceptual | difference | frame
    thresholds
    videoFramePolicy
    maxAssets
  assets: AssetInput[]

AssetInput
  identity
    id
    uri
    relativePath
    stableKey
  media
    mediaType: photo | video
    mimeType
    extension
    width
    height
    durationMs
    fileSize
    createdAt
    modifiedAt
  sourceRef
    kind: file-path | temp-file | bytes | opaque
    path
    byteLength
  samples
    primaryImage
    thumbnail
    videoFrames[]
```

输入边界：

1. `id` 必须由 adapter 生成并保持稳定；CLI 使用相对路径 + 文件元数据生成，Android 后续使用 MediaStore id 或等价稳定 key。
2. `sourceRef.kind=file-path` 仅用于 CLI / fixture；Android 不把 content URI 直接塞给 core，而是通过 temp file / bytes / sample 传入。
3. `core` 可以读取 `file-path` / `temp-file` / `bytes`，但不负责目录遍历、权限申请、媒体库分页、后台任务生命周期。
4. `samples` 是算法输入，不是 UI 缩略图 contract；report 阶段可以复用生成的 representative thumbnail，但不能反向污染 core model。
5. `options.videoFramePolicy` 必须显式记录，保证视频算法可复现。

### 图像输入策略

图片优先走原始文件路径或临时文件路径：

```text
photo AssetInput
  sourceRef: file-path | temp-file | bytes
  samples.primaryImage: optional
  samples.thumbnail: optional
```

处理规则：

1. P0 优先支持 JPEG / PNG / WebP，GIF 先按第一帧或静态 fallback 处理。
2. `contentHash` 基于原始文件 bytes。
3. `perceptualHash` / `differenceHash` 基于解码后的 normalized image。
4. brightness / contrast / edgeDensity / blurScore 基于 downsample 后的 normalized grayscale 数据。

### 视频输入策略

视频不在 P0 做完整逐帧识别，也不做场景理解。P0 采用 **metadata + bounded representative frames**：

```text
video AssetInput
  media.durationMs: required when known
  media.width / height: required when known
  sourceRef: file-path | temp-file
  samples.videoFrames:
    - timestampMs
      sourceRef
      width / height
      extractionMethod
```

视频分三档处理：

1. **metadata-only fallback**
   - 条件：当前平台无法抽帧、格式不支持、解码失败。
   - 输出：保留视频 asset、duration、dimension、fileSize、contentHash。
   - 限制：不生成 blur / low-value 候选，只标记 `video-frame-unavailable` diagnostic。

2. **representative-frame analysis**
   - 条件：CLI 可抽取有限帧。
   - 默认抽帧：`5%`、`50%`、`95%` 三个时间点；短视频少于 3 秒时只取中间帧。
   - 输出：每帧生成 frame hash 和 frame metrics；视频级 metrics 取聚合值。

3. **future segment policy**
   - 条件：P0 稳定后再评估。
   - 可能扩展：scene detection、更多关键帧、音频/字幕特征。
   - 当前不进入实现。

视频聚合规则：

1. `contentHash`：原始视频文件 bytes。
2. `frameHashes`：每个 representative frame 的 perceptual hash。
3. `perceptualHash` / `differenceHash`：默认取 representative frame 聚合 hash；具体策略必须写入 `algorithmVersion`。
4. metrics：brightness / contrast / edgeDensity / blurScore 取帧级统计的中位数，并保留 min / max 作为 debug artifact。
5. cleanup candidate：P0 只允许基于“明显重复 frame hash”或“所有代表帧都极低质量”生成候选；其他视频仅进入 review，不自动清理。

### 谁来做

沿用历史 goal 团队配比，但只启用 P0 相关角色：

| 角色 | Owner | 职责 |
| --- | --- | --- |
| Lead | 包拯 | 控制 P0 范围，阻止 Electron / P2 / N-API 混入当前执行 |
| 架构 | 公孙策 | 定义 `CoreScanRequest`、`AssetInput`、video frame policy、schema 边界 |
| 主执行 | 展昭 | 建 Rust workspace、`core` crate、核心 model / analysis flow |
| CLI | 王朝 | 建 `mc` CLI、filesystem probe、scan / plan / report / quarantine command |
| Fixture / parity | 张龙 | golden fixture、Rust vs Android vs Go parity、schema validation |
| Video / benchmark | 马汉 | 视频 metadata probe、bounded frame extraction、benchmark / regression |
| Report | 赵虎 | static HTML report、contact sheet、human-readable summary，不碰 RN UI |
| 验收 | 八贤王 | cargo、schema、CLI、parity、report、benchmark 终验 |

并行策略：

1. 公孙策先落 input contract 和 BDD 测试边界。
2. 展昭、王朝、张龙可在 contract 后并行推进 core skeleton、CLI shell、fixture/parity。
3. 马汉在 CLI filesystem probe 后推进视频 frame policy 和 benchmark。
4. 赵虎在 `session.json` 稳定后推进 report。
5. 八贤王最后串起所有门禁。

### `core` 输出

`core` 输出平台无关的分析结果：

```text
AnalyzedAsset
  asset metadata
  metrics: brightness / contrast / edge / blur
  hashes: contentHash / perceptualHash / differenceHash
  candidates: duplicate / low-value / screenshot / near-similar
  scores
  reasons
  algorithmVersion
```

### `cli` 输入

`cli` 负责把本地文件系统输入转换成 `core` 输入：

```text
mc scan <directory>
mc plan .mc/<session-id>/session.json
mc report .mc/<session-id>/session.json
mc quarantine <cleanup-plan.json> --dry-run
```

### `cli` 输出

`cli` 默认输出到本地 workbench 目录：

```text
.mc/<session-id>/
  session.json
  cleanup-plan.json
  report/
    index.html
```

当前阶段的人类审阅入口是 `mc report ... --open`，不是 Electron，也不是 TUI。`report/index.html` 是单文件 HTML，通过内嵌 JSON 数据渲染；当前阶段不生成独立 `assets/` 或 `contact-sheet/` 目录。

## 非目标

1. 不重写 Android native executor。
2. 不实现完整 Electron Desktop。
3. 不发布公开 npm package。
4. 不把 TUI 作为 skill / automation 接口。
5. 不引入真实用户媒体样本或模型缓存。
6. 不为 Electron 做 N-API、IPC、renderer 或桌面 OS 交互设计。

## 依赖

硬依赖：

1. `schemas/media-clean-result.schema.json`
2. `fixtures/media-clean-result/golden-session.json`
3. 当前 Android native executor 的输出语义
4. 已有 Go desktop spike 作为 comparison baseline

不依赖：

1. P2 i18n/theme。
2. Electron renderer。
3. iOS adapter。
4. N-API / Node package。

## 目录方案

```text
engines/recognition/
  Cargo.toml
  crates/
    core/
    cli/          # mc command and algorithm workbench
  fixtures/
  benches/

scripts/scan/
  verify-rust-core-fixtures.mjs
  verify-rust-go-android-parity.mjs
  verify-rust-core-benchmark.mjs
```

## 仓库生命周期

P0 允许先在主应用仓库孵化，但这不是长期归属。

留在主应用仓库孵化的原因：

1. Android baseline 在这里。
2. schema / fixture / parity tests 在这里。
3. 早期需要快速校准 Rust output 与 Android output。

达到以下条件后，应拆出到独立 `mc-engine` repo 或独立 package workspace：

1. CLI command contract 固定。
2. schema 达到稳定版本。
3. Rust vs Android vs Go parity report 可审计。
4. cargo / CLI / report / benchmark 可以独立 CI。
5. Android App 可以通过 released engine version 或 schema snapshot 消费结果。

拆出后，主应用仓库只保留 app adapter、contract snapshot 和回归 fixture，不继续承载 engine release pipeline。

## 分阶段执行

### Phase P0.1: Rust workspace skeleton

写文件范围：

1. `engines/recognition/Cargo.toml`
2. `engines/recognition/crates/core/`
3. `engines/recognition/crates/cli/`

完成定义：

1. `cargo test` 可运行。
2. core crate 无 Node / RN / Android / Electron 依赖。
3. CLI crate 能启动并输出版本。

建议命令：

```bash
cargo test --manifest-path engines/recognition/Cargo.toml
cargo run --manifest-path engines/recognition/Cargo.toml -p cli -- --version
```

### Phase P0.2: core model 和 schema output

写文件范围：

1. `core/src/model.rs`
2. `core/src/session.rs`
3. `core/src/analysis.rs`
4. `fixtures/media-clean-result/`
5. `schemas/media-clean-result.schema.json`

能力范围：

1. Asset metadata。
2. brightness / contrast / edge / blur placeholder 或 deterministic implementation。
3. contentHash / perceptualHash / differenceHash。
4. duplicate / low-value candidate。
5. `algorithmVersion`。
6. schema-compatible session assembly。

完成定义：

1. Rust output 能通过现有 schema。
2. golden fixture 可作为 regression baseline。
3. schema 变化必须保持向后说明。

建议命令：

```bash
cargo test --manifest-path engines/recognition/Cargo.toml -p core
npm run verify:schema:media-clean-result
```

### Phase P0.3: `mc` CLI command contract

写文件范围：

1. `engines/recognition/crates/cli/src/main.rs`
2. `engines/recognition/crates/cli/src/commands/scan.rs`
3. `engines/recognition/crates/cli/src/commands/plan.rs`
4. `engines/recognition/crates/cli/src/commands/quarantine.rs`
5. `engines/recognition/crates/cli/src/commands/report.rs`
6. `scripts/scan/`
7. `package.json` scripts

命令 contract：

```bash
mc scan <path> --format json --out session.json
mc plan session.json --format json --out cleanup-plan.json
mc report session.json --out .mc/<session-id>/report --open
mc quarantine cleanup-plan.json --dry-run --format json
```

默认输出 contract：

```bash
mc scan <path> --format json --session-id <session-id>
mc plan .mc/<session-id>/session.json
mc report .mc/<session-id>/session.json --open
```

不传 `--out` 时，`mc` 必须写入 `.mc/<session-id>/session.json`、`.mc/<session-id>/cleanup-plan.json` 和 `.mc/<session-id>/report/index.html`。CI / case 脚本可以继续显式传 `--out` 写入 `artifacts/scan/...`，但用户本地 workbench 默认走 `.mc`。

输出要求：

1. `mc` 负责 scan / plan / report / quarantine 的 canonical contract。
2. stdout 用于 machine result。
3. stderr 用于 progress / diagnostic。
4. `mc` 默认可以输出摘要、产物路径和后续建议，但 `--json` / `--quiet` 必须可关闭这些人类输出。
5. exit code 稳定：
   - `0` success
   - `1` user input error
   - `2` partial scan
   - `3` system / IO error
   - `4` schema / contract error

完成定义：

1. automation 可以只解析 JSON。
2. `--dry-run` 是 quarantine 默认路径。
3. 用户侧命令固定为 `mc`。
4. 当前阶段不要求 Node runtime。

### Phase P0.4: parity and Android alignment

写文件范围：

1. `scripts/scan/verify-rust-go-android-parity.mjs`
2. `fixtures/media-clean-result/`
3. Android output fixture 或 fixture exporter
4. 必要时更新 `src/features/scan/android-native-scan.ts` 测试，不改生产行为

对齐对象：

1. Rust output。
2. Go spike output。
3. Android native output。

完成定义：

1. parity report 明确字段差异。
2. hash / scoring / cluster 差异有阈值或解释。
3. Go 仍是 comparison spike，不扩展成第二套算法 core。

### Phase P0.5: review artifact 和 human-friendly output

写文件范围：

1. CLI progress reporter。
2. summary renderer。
3. static HTML report generator。
4. explain command 或 explain section。

能力：

1. 扫描进度。
2. 候选摘要。
3. cleanup reason 解释。
4. `report/index.html` 本地审阅页。
5. local LLM review hook 的占位参数。

建议输出结构：

```text
.mc/<session-id>/
  session.json
  cleanup-plan.json
  report/
    index.html
```

完成定义：

1. 不影响 JSON / JSONL machine output。
2. `mc report <session.json> --open` 可以直接打开本地审阅页。
3. human output 可以关闭。
4. 错误文案能区分 permission、unsupported media、IO、schema。

### Phase P0.6: benchmark and regression loop

写文件范围：

1. `scripts/scan/verify-rust-core-benchmark.mjs`
2. `engines/recognition/benches/`
3. `fixtures/media-clean-result/benchmark/`

范围：

1. scan throughput。
2. metrics / hash runtime。
3. duplicate / cluster runtime。
4. report generation runtime。
5. algorithmVersion regression summary。

不做：

1. 不做 N-API handoff。
2. 不做 Electron adapter。
3. 不做 TUI。

## 验收命令

最终 P0 关闭前至少需要：

```bash
cargo test --manifest-path engines/recognition/Cargo.toml
cargo run --manifest-path engines/recognition/Cargo.toml -p cli -- scan fixtures --format json --out artifacts/scan/rust-session.json
npm run verify:schema:media-clean-result
npm run verify:desktop-go:scan
npm run typecheck -- --pretty false
```

如新增 npm scripts，应补：

```bash
npm run verify:rust-core:scan
npm run verify:rust-go-android:parity
```

## 工作包建议

### Work Packet: p0-core-skeleton

- Owner: 展昭
- Goal: 建立 Rust workspace 和 core crate。
- Write Scope: `engines/recognition/`
- Verification: `cargo test --manifest-path engines/recognition/Cargo.toml`
- Done When: core crate 可测试，且无平台依赖。

### Work Packet: p0-cli-machine-output

- Owner: 王朝
- Goal: 实现 `scan / plan / report / quarantine --dry-run` machine CLI。
- Write Scope: `engines/recognition/crates/cli/`, `scripts/scan/`, `package.json`
- Verification: CLI smoke + schema validation。
- Done When: JSON output 可被 automation 稳定解析。

### Work Packet: p0-parity

- Owner: 张龙
- Goal: 建立 Rust vs Go vs Android parity report。
- Write Scope: `fixtures/`, `scripts/scan/`
- Verification: parity script。
- Done When: 差异可见、可解释、可回归。

### Work Packet: p0-review

- Owner: 八贤王
- Goal: 终验 P0 contract。
- Write Scope: docs only if gaps found。
- Verification: cargo + schema + CLI + parity。
- Done When: P0 输出可以支撑算法调优、Android parity、Go comparison 和本地人工审阅。
