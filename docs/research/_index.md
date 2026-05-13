# v0.5 依据与方案文档索引

[English Version](./_index.en.md)

## 当前决策入口

1. [v0.5 后续目标拆分决策记录](./v0-5-follow-up-goal-split.md)
   - 当前拆分：P0 Rust Core、P0 CLI、P1 Electron Desktop、P2 v0.5.1 多语言/主题治理。
   - 依赖结论：Rust Core 是 CLI 和 Desktop 的硬依赖；v0.5.1 治理可并行但不阻塞 P0；Desktop 等 Rust Core / CLI contract 稳定后产品化。
   - 后续执行方案：[v0.5 后续 Goal 拆分执行方案](./v0-5-goal-split-execution/_index.md)。
   - 可执行 plans：[v0.5 Goal 拆分计划包](../plans/2026-05-13-v0-5-goal-split-design/_index.md)。

## 后续执行依据

1. [Native Engine 主线方案调研](./native-engine-options.md)
   - 当前主线：Android native baseline + Rust-first shared recognition core。
   - KMP 后置为移动共享备选；Go 保留为 desktop CLI / daemon 对照 spike；Node.js 定位为 skill / orchestration / LLM glue。
2. [桌面 / Skill 优先的本地识别与 LLM 路线](./desktop-skill-local-llm-recognition.md)
   - 当前创新主线：本地目录扫描、本地识别算法、本地 LLM review、safe quarantine、Codex skill 自动化入口。
   - 已落地共享合同：`schemas/media-clean-result.schema.json`、`fixtures/media-clean-result/golden-session.json`、`npm run verify:schema:media-clean-result`。
   - 已落地 Go desktop spike：`engines/desktop-go/cmd/media-clean-scan`、`npm run verify:desktop-go:scan`。
3. [Rust-first 项目分层与发包管理](./project-layering-and-packaging.md)
   - 当前管理方式：本仓库作为 Android-first + shared engine monorepo；Rust core 放 `engines/recognition-rust`，npm wrapper 放 `packages/media-clean-engine`。
   - 发包方向：`media_clean_core` 是唯一算法主线，napi-rs、CLI、UniFFI 都只是 adapter。
   - 桌面端已决策 Electron First：Electron + Rust N-API 作为第一阶段桌面产品形态，Tauri 后置为轻量化备选。
4. [i18n 资源目录方案](./i18n-resource-layout.md)
   - 当前 i18n 决策：一种语言一个目录，一个业务域一个 namespace 文件，先不强行引入完整 i18next runtime。
5. [主题 Token 与 Tailwind 复用方案](./theme-token-tailwind-strategy.md)
   - 当前主题决策：Token-first + Tailwind-compatible + NativeWind optional。
   - RN 继续使用 typed `StyleSheet.create()`，Electron 使用 generated Tailwind CSS `@theme`，NativeWind 只作为新组件 / 低风险组件的 utility layer。

## 执行提醒

1. 不把 TypeScript 当作生产扫描/识别 engine。
2. Android Kotlin native executor 继续是生产基线。
3. Rust-first shared recognition core 是长期算法主线。
4. iOS 后续只基于稳定 shared schema 和 parity fixture 接入，不纳入当前完成标准。
5. Go 只作为 desktop daemon / CLI 对照 spike；Node.js 只承担 wrapper / orchestration / LLM glue。
6. 桌面端已决策 Electron First；除非包体、空闲内存或原生 shell 体积成为硬约束，否则不切到 Tauri 主线。
7. 主题系统先做 token source of truth，不全量改 NativeWind；Tailwind / NativeWind / Electron CSS 都从同一 token 输出。
8. P0 执行顺序为 Rust Core -> CLI；P2 v0.5.1 治理可并行，P1 Desktop 后置产品化。
9. 已被新决策替代的 RN macOS / TypeScript fixture 旧调研不再保留为执行入口。
