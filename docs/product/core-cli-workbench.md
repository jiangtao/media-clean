# Media Clean Rust Core + CLI 用户使用指南

[English Version](./core-cli-workbench.en.md)

本文档面向希望直接使用 Media Clean Rust Core 和 `mc` CLI 的用户。范围覆盖：功能说明、安装、扫描、生成 cleanup plan、查看 report、执行 dry-run / 清理，以及这条链路和 App 结构如何对应。

## 定位

当前仓库里有两条运行形态：

1. **移动 App**：Android-first，本地扫描、识别、回收站和 SQLite 真值运行在 App 内。
2. **Rust Core + `mc` CLI**：面向本地目录、样本验证、算法迭代和桌面 workbench 的 repo-local 工具链。

两者共享的不是 UI 和存储，而是 **识别语义和结果结构**：

1. 相同的识别类别：重复文件、相似图片、低价值、视频候选。
2. 相同的核心输出：asset、cluster、cleanup plan、diagnostic。
3. 相同的“先审阅，再清理”流程。

当前 CLI 形态适合：

1. 扫描本地图片 / 视频目录。
2. 快速验证 Rust 识别算法和阈值。
3. 生成可审阅的 JSON artifact。
4. 用本地 report workbench 做人工复核和清理。

## 功能总览

`mc` 当前提供 4 个主命令：

1. `mc scan`：扫描目录，生成 `session.json`。
2. `mc plan`：从 `session.json` 生成 `cleanup-plan.json`。
3. `mc report`：生成静态 HTML report launcher。
4. `mc quarantine`：对 cleanup plan 做 dry-run 或移入系统回收站。

推荐的完整链路是：

1. `mc scan`
2. `mc plan`
3. `npm run report:dev -- --session ...`
4. 在本地 workbench 审阅
5. `mc quarantine --dry-run`
6. 确认后再 `mc quarantine --trash`

## 安装

### 环境要求

1. Rust `1.78+`
2. Cargo
3. Node.js 和 npm

其中：

1. Rust / Cargo 用于编译和安装 `mc`。
2. Node.js / npm 只在你要打开 Next.js 本地 report workbench 时需要。

### 方式 A：不安装，直接运行

适合先试用或调试：

```bash
cargo run --manifest-path engines/recognition/Cargo.toml -p mc-cli -- --help
```

这种方式不改 `PATH`，但每次命令都要带 `cargo run --manifest-path ... -p mc-cli --` 前缀。

### 方式 B：安装到仓库本地目录

这是当前推荐方式，已经在仓库内校验通过：

```bash
cargo install --path engines/recognition/crates/cli --root ./.local/mc --locked
export PATH="$(pwd)/.local/mc/bin:$PATH"
mc --version
```

如果你希望长期使用，可以把 `export PATH=...` 放进自己的 shell profile。

### 方式 C：只编译二进制

如果你不想执行 `cargo install`，也可以直接使用编译产物：

```bash
cargo build --manifest-path engines/recognition/Cargo.toml -p mc-cli
./engines/recognition/target/debug/mc --help
```

## 全链路使用

以下示例默认你已经在仓库根目录，并且 `mc` 已经可执行。

### 1. 扫描目录

```bash
mc scan /Users/jt/places/personal/mc-test-assets --session-id demo-local
```

默认输出路径：

```text
.mc/demo-local/session.json
```

常用参数：

```bash
mc scan <PATH> \
  --session-id demo-local \
  --media-type all \
  --out .mc/demo-local/session.json
```

说明：

1. `--media-type` 可选 `all / photo / video`。
2. `--out` 可覆盖默认输出位置。
3. `--no-progress` 可关闭扫描进度日志。
4. `--video-frame-timeout-ms` 控制视频抽帧超时。
5. `--no-video-frame-cache` 可关闭视频关键帧缓存。

### 2. 生成 cleanup plan

```bash
mc plan .mc/demo-local/session.json
```

默认输出路径：

```text
.mc/demo-local/cleanup-plan.json
```

如果要写入其他位置：

```bash
mc plan .mc/demo-local/session.json --out artifacts/scan/demo-local/cleanup-plan.json
```

### 3. 生成静态 report

```bash
mc report .mc/demo-local/session.json --open
```

默认输出路径：

```text
.mc/demo-local/report/index.html
```

这里要明确一点：

1. `mc report` 生成的是 **静态 launcher 页面**。
2. 它保留 smoke / 兼容用途，并注入 report JSON 数据。
3. 真正适合日常审阅的是 **Next.js report workbench**，不是这张静态页本身。

### 4. 用本地 workbench 查看 report

推荐命令：

```bash
npm install
npm run report:dev -- --session .mc/demo-local/session.json
```

默认会在本地启动：

```text
http://127.0.0.1:4310/
```

如果 `.mc/demo-local/cleanup-plan.json` 与 `session.json` 在同一目录，脚本会自动推断 `plan`。

你也可以显式传入：

```bash
npm run report:dev -- \
  --session .mc/demo-local/session.json \
  --plan .mc/demo-local/cleanup-plan.json \
  --port 4310
```

当前 workbench 提供：

1. 分类 tabs
2. 图片 / 视频预览
3. 详情 gallery
4. 本地选择与批量确认
5. 回收站清理桥接

### 5. 先做 dry-run

在真正清理前，先生成一份 dry-run 结果：

```bash
mc quarantine .mc/demo-local/cleanup-plan.json \
  --dry-run \
  --out .mc/demo-local/quarantine-dry-run.json
```

说明：

1. `--dry-run` 不会修改本地文件。
2. 输出会列出每个 plan 的 action、asset id 和状态。
3. 这是审阅前后都建议保留的可审计结果。

### 6. 确认后移入系统回收站

```bash
mc quarantine .mc/demo-local/cleanup-plan.json \
  --trash \
  --plan-id <cleanup-plan-id> \
  --out .mc/demo-local/quarantine-result.json
```

说明：

1. `--trash` 会真正把命中的文件移入系统回收站。
2. 当前实现支持 macOS 和 Linux；Windows 还没有实现。
3. 当前只支持 `file://` URI 对应的本地文件。
4. 如果不传 `--plan-id`，会按整个 cleanup plan 执行。
5. 更稳妥的做法是先用 workbench 人工确认，再按 `plan-id` 做定向清理。

## 产物目录约定

默认情况下，一次 CLI 会话会把产物写进：

```text
.mc/<session-id>/
  session.json
  cleanup-plan.json
  report/
    index.html
  quarantine-dry-run.json
  quarantine-result.json
```

其中：

1. `session.json`：扫描与识别主结果。
2. `cleanup-plan.json`：待清理候选及其 plan。
3. `report/index.html`：静态 launcher。
4. `quarantine-dry-run.json`：dry-run 审计结果。
5. `quarantine-result.json`：真实清理结果。

## 和 App 结构如何对应

CLI workbench 和移动 App 在“流程语义”上是一致的，但入口和真值存储不同。

| 用户链路 | CLI / Core 对应 | App 对应 |
| --- | --- | --- |
| 扫描目录 / 枚举媒体 | `mc scan` + `engines/recognition/crates/cli` filesystem probe | `src/features/scan/` + Android native media enumeration |
| 识别与分组 | `engines/recognition/crates/core` | `src/domain/recognition/` |
| 生成可清理候选 | `mc plan` | `src/features/cleanup/` + candidate view |
| 审阅结果 | `apps/report/` 本地 workbench | `src/ui/` 审阅与详情界面 |
| 预演清理 | `mc quarantine --dry-run` | App 内确认前的候选预演 |
| 执行清理 | `mc quarantine --trash` | App 内回收站 / 删除动作 |

最重要的差异是：

1. App 运行时真值是 SQLite。
2. CLI 运行时真值是 `.mc/<session-id>/` 下的 JSON artifact。
3. 二者共享识别输出结构，但不共享同一份运行时存储。

## 常见问题

### 为什么 `mc report` 之后还推荐 `npm run report:dev`？

因为当前仓库里：

1. `mc report` 是静态 HTML launcher。
2. 真正好用的分类筛选、详情查看、批量选择和本地清理桥接，都在 `apps/report/` 的 Next.js workbench 里。

### 为什么 report 页面有时打不开？

因为 `npm run report:dev` 是本地开发服务，不是常驻后台服务。只要启动它的终端会话结束，`127.0.0.1:4310` 就会失效。

### 现在能否脱离仓库直接安装公开 CLI？

还不能作为稳定结论写给用户。当前仓库已经支持：

```bash
cargo install --path engines/recognition/crates/cli --root ./.local/mc --locked
```

但公开预编译 release、独立下载页和跨平台安装说明，还没有作为正式发布契约固定下来。

## 相关入口

1. 仓库总览：[README.md](../../README.md)
2. 英文文档：[core-cli-workbench.en.md](./core-cli-workbench.en.md)
3. Rust Core + CLI 执行方案：[docs/research/v0-5-goal-split-execution/p0-rust-core-cli.md](../research/v0-5-goal-split-execution/p0-rust-core-cli.md)
