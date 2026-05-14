# 并行执行工作板

## 背景

本工作板用于后续并行执行，不代表本轮已经开始实现。三个 goal 可以并行，但必须按 contract 和文件范围隔离。

## 总体队列

| Goal | 优先级 | 可开始条件 | 阻塞条件 | 交付物 |
| --- | --- | --- | --- | --- |
| Rust Core + CLI | P0 | schema / fixture 已存在 | 无 | Rust core、machine CLI、parity report |
| Electron Desktop | P1 | P0 CLI contract 初步稳定 | P0 schema 大幅变动 | Electron shell、engine adapter、renderer workbench |
| i18n/theme governance | P2 | main 功能 baseline 可确认 | Android UI 大改同波次冲突 | namespace、tokens、generated outputs |

## 并行规则

可以并行：

1. P0 Rust workspace skeleton 与 P2 i18n/theme scaffold。
2. P0 machine CLI 与 P1 Electron architecture spike。
3. P0 N-API handoff 与 P1 engine adapter。
4. P2 token output 与 P1 renderer theme consumption design。

不建议并行：

1. P0 Android parity 替换与 P2 大范围 UI snapshot 修改。
2. P1 完整 renderer 产品化与 P0 schema 不稳定期。
3. P0 TUI、P1 Electron UI、skill report UI 三个交互层同时做细节。

## 第一波执行建议

### Packet A: P0 core skeleton

- Owner: 展昭
- Write Scope:
  - `engines/recognition-rust/`
- Read Context:
  - `docs/research/native-engine-options.md`
  - `schemas/media-clean-result.schema.json`
  - `fixtures/media-clean-result/golden-session.json`
- Verification:
  - `cargo test --manifest-path engines/recognition-rust/Cargo.toml`
- Done When:
  - Rust workspace 和 core crate 可测试。

### Packet B: P0 CLI contract

- Owner: 王朝
- Write Scope:
  - `engines/recognition-rust/crates/media_clean_cli/`
  - `scripts/scan/`
  - `package.json`
- Read Context:
  - `docs/research/project-layering-and-packaging.md`
- Verification:
  - CLI smoke
  - `npm run verify:schema:media-clean-result`
- Done When:
  - `scan / plan / quarantine --dry-run` command contract 固定。

### Packet C: P2 i18n scaffold

- Owner: 张龙
- Write Scope:
  - `src/i18n/`
  - `scripts/i18n/`
- Read Context:
  - `docs/research/i18n-resource-layout.md`
- Verification:
  - `npm run test -- --run src/i18n`
  - `npm run verify:i18n:resources`
- Done When:
  - 语言目录和 namespace schema 完整。

### Packet D: P2 theme scaffold

- Owner: 马汉
- Write Scope:
  - `src/theme/`
  - `scripts/theme/`
- Read Context:
  - `docs/research/theme-token-tailwind-strategy.md`
- Verification:
  - `npm run test -- --run src/theme`
  - `npm run verify:theme:tokens`
- Done When:
  - token source 和 generated outputs 可验证。

## 第二波执行建议

### Packet E: P0 parity

- Owner: 张龙
- Depends On:
  - Packet A
  - Packet B
- Write Scope:
  - `fixtures/media-clean-result/`
  - `scripts/scan/`
- Verification:
  - `npm run verify:rust-go-android:parity`
- Done When:
  - Rust、Go、Android baseline 差异可审计。

### Packet F: P1 Electron shell

- Owner: 展昭
- Depends On:
  - Packet B CLI contract
- Write Scope:
  - 独立 `media-clean-desktop` repo，或当前仓库临时 `apps/desktop/` spike
  - `packages/media-clean-engine/`
- Verification:
  - `npm run desktop:smoke`
- Done When:
  - Electron shell 可启动，typed IPC 可 smoke。

### Packet G: P2 UI cleanup

- Owner: 赵虎
- Depends On:
  - Packet C
  - Packet D
- Write Scope:
  - selected `src/ui/`
  - selected tests
- Verification:
  - targeted screen tests
  - `npm run typecheck -- --pretty false`
- Done When:
  - 高频 hardcoded copy / raw color 收敛，不改功能。

## 第三波执行建议

### Packet H: P0 N-API handoff

- Owner: 公孙策
- Depends On:
  - P0 core API stable
- Write Scope:
  - `engines/recognition-rust/crates/media_clean_napi/`
  - `packages/media-clean-engine/`
- Verification:
  - Node addon load smoke
- Done When:
  - Electron / skill 可消费 Node API。

### Packet I: P1 Desktop workbench

- Owner: 王朝
- Depends On:
  - Packet F
  - Packet H or CLI fallback
- Write Scope:
  - 独立 `media-clean-desktop` renderer，或当前仓库临时 `apps/desktop/electron/renderer/` spike
- Verification:
  - desktop smoke
- Done When:
  - sample session 可从扫描到 cleanup plan 浏览。

### Packet J: final gate

- Owner: 八贤王
- Depends On:
  - 当前 goal 的所有 packets
- Verification:
  - P0 cargo + schema + parity
  - P1 desktop smoke
  - P2 typecheck + i18n/theme tests
- Done When:
  - 每个 goal 独立满足完成定义，且没有跨 goal contract 漂移。

## 风险和处理

| 风险 | 影响 | 处理 |
| --- | --- | --- |
| Rust schema 输出频繁变化 | 阻塞 Electron UI | P1 只做 shell 和 adapter，renderer 等 sample session 稳定后推进 |
| P2 大范围 UI 改动引入回归 | 干扰 Android 验收 | P2 按 namespace/token 波次拆小，不与 Android native 大改同波次 |
| N-API build 不稳定 | 阻塞 Electron | Electron 保留 CLI fallback |
| TUI 范围膨胀 | 稀释 P0 | TUI 只在 machine CLI 稳定后做 optional |
| Go spike 继续扩规则 | 形成第二 core | Go 只保留 comparison baseline，规则迁入 Rust Core |

## 当前轮次状态

本轮只完成文档方案拆分。所有 packet 均为后续执行队列，状态为 `pending`。
