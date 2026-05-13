# P0 Rust Core 和 CLI 执行方案

## 背景

P0 是后续所有方向的根。没有 Rust Core，Android、CLI、Electron、skill 和未来 iOS 会继续各自维护识别规则，算法优化无法复用。

本 goal 依据：

1. [Native Engine 主线方案调研](../native-engine-options.md)
2. [桌面 / Skill 优先的本地识别与 LLM 路线](../desktop-skill-local-llm-recognition.md)
3. [Rust-first 项目分层与发包管理](../project-layering-and-packaging.md)
4. [v0.5 后续目标拆分决策记录](../v0-5-follow-up-goal-split.md)

## 目标

建立一套 repo-local Rust recognition core 和 CLI，使其能输出 shared schema compatible artifact，并为 Android parity、skill automation、Electron fallback 打基础。

## 非目标

1. 不重写 Android native executor。
2. 不实现完整 Electron Desktop。
3. 不发布公开 npm package。
4. 不把 TUI 作为 skill / automation 接口。
5. 不引入真实用户媒体样本或模型缓存。

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

## 目录方案

```text
engines/recognition-rust/
  Cargo.toml
  crates/
    media_clean_core/
    media_clean_cli/
    media_clean_tui/          # optional after machine CLI
    media_clean_napi/         # handoff for P1
  fixtures/
  benches/

scripts/scan/
  verify-rust-core-fixtures.mjs
  verify-rust-go-android-parity.mjs
```

## 仓库生命周期

P0 允许先在主应用仓库孵化，但这不是长期归属。

留在主应用仓库孵化的原因：

1. Android baseline 在这里。
2. schema / fixture / parity tests 在这里。
3. 早期需要快速校准 Rust output 与 Android output。

达到以下条件后，应拆出到独立 `media-clean-engine` repo 或独立 package workspace：

1. CLI command contract 固定。
2. schema 达到稳定版本。
3. Rust vs Android vs Go parity report 可审计。
4. cargo / CLI / npm wrapper 可以独立 CI。
5. Android App 可以通过 released engine version 或 schema snapshot 消费结果。

拆出后，主应用仓库只保留 app adapter、contract snapshot 和回归 fixture，不继续承载 engine release pipeline。

## 分阶段执行

### Phase P0.1: Rust workspace skeleton

写文件范围：

1. `engines/recognition-rust/Cargo.toml`
2. `engines/recognition-rust/crates/media_clean_core/`
3. `engines/recognition-rust/crates/media_clean_cli/`

完成定义：

1. `cargo test` 可运行。
2. core crate 无 Node / RN / Android / Electron 依赖。
3. CLI crate 能启动并输出版本。

建议命令：

```bash
cargo test --manifest-path engines/recognition-rust/Cargo.toml
cargo run --manifest-path engines/recognition-rust/Cargo.toml -p media_clean_cli -- --version
```

### Phase P0.2: core model 和 schema output

写文件范围：

1. `media_clean_core/src/model.rs`
2. `media_clean_core/src/session.rs`
3. `media_clean_core/src/analysis.rs`
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
cargo test --manifest-path engines/recognition-rust/Cargo.toml -p media_clean_core
npm run verify:schema:media-clean-result
```

### Phase P0.3: machine CLI

写文件范围：

1. `media_clean_cli/src/main.rs`
2. `media_clean_cli/src/commands/scan.rs`
3. `media_clean_cli/src/commands/plan.rs`
4. `media_clean_cli/src/commands/quarantine.rs`
5. `scripts/scan/`
6. `package.json` scripts

CLI command contract：

```bash
media-clean scan <path> --format json --out session.json
media-clean plan session.json --format json --out cleanup-plan.json
media-clean quarantine cleanup-plan.json --dry-run --format json
```

输出要求：

1. stdout 用于 machine result。
2. stderr 用于 progress / diagnostic。
3. exit code 稳定：
   - `0` success
   - `1` user input error
   - `2` partial scan
   - `3` system / IO error
   - `4` schema / contract error

完成定义：

1. automation 可以只解析 JSON。
2. `--dry-run` 是 quarantine 默认路径。
3. CLI 不需要 Node runtime。

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

### Phase P0.5: human-friendly output

写文件范围：

1. CLI progress reporter。
2. summary renderer。
3. explain command 或 explain section。

能力：

1. 扫描进度。
2. 候选摘要。
3. cleanup reason 解释。
4. local LLM review hook 的占位参数。

完成定义：

1. 不影响 JSON / JSONL machine output。
2. human output 可以关闭。
3. 错误文案能区分 permission、unsupported media、IO、schema。

### Phase P0.6: optional TUI

写文件范围：

1. `media_clean_tui/`
2. CLI command dispatch。

范围：

1. candidate list。
2. cluster detail。
3. cleanup plan preview。
4. dry-run quarantine preview。

不做：

1. 不作为 skill / CI / automation 接口。
2. 不把终端图片预览作为核心验收。
3. 不做 Electron 级缩略图网格体验。

### Phase P0.7: N-API handoff

写文件范围：

1. `media_clean_napi/`
2. `packages/media-clean-engine/`
3. smoke test。

目标：

1. 给 Electron / skill 提供 Node binding。
2. API 必须批量化。
3. 不复制识别规则。

建议 API：

```ts
scanDirectory(options): Promise<ScanSession>
analyzeBatch(inputs): Promise<AnalyzedAsset[]>
buildCleanupPlan(session): Promise<CleanupPlan>
```

## 验收命令

最终 P0 关闭前至少需要：

```bash
cargo test --manifest-path engines/recognition-rust/Cargo.toml
cargo run --manifest-path engines/recognition-rust/Cargo.toml -p media_clean_cli -- scan fixtures --format json --out artifacts/scan/rust-session.json
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
- Write Scope: `engines/recognition-rust/`
- Verification: `cargo test --manifest-path engines/recognition-rust/Cargo.toml`
- Done When: core crate 可测试，且无平台依赖。

### Work Packet: p0-cli-machine-output

- Owner: 王朝
- Goal: 实现 `scan / plan / quarantine --dry-run` machine CLI。
- Write Scope: `media_clean_cli/`, `scripts/scan/`, `package.json`
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
- Done When: P0 输出可以交给 P1 Electron 和 skill wrapper。
