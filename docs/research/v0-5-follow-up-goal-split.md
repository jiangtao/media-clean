# v0.5 后续目标拆分决策记录

[English Version](./v0-5-follow-up-goal-split.en.md)

## 结论

状态：已决策。

当前拆分：

1. **P0 Rust Core**：共享识别算法核心，是后续识别、扫描、评分、聚类优化的主线。
2. **P0 CLI**：Rust Core 的第一个跨平台产品化入口，也是 skill / CI / automation 的稳定接口。
3. **P2 v0.5.1 多语言 / 主题治理**：保持 main 分支功能一致，只做架构治理。
4. **P1 Electron Desktop**：面向小白用户的桌面端产品化入口，等 Rust Core / CLI contract 稳定后推进。

依赖结论：

1. **Rust Core 是 CLI 和 Desktop 的硬依赖**。
2. **CLI 硬依赖 Rust Core 和 shared schema**。
3. **v0.5.1 多语言 / 主题治理可并行，但不阻塞 P0**。
4. **Desktop 等 Rust Core / CLI contract 稳定后产品化**。
5. **TUI 可以作为 CLI 的人工交互层，但 skill / CI / automation 只依赖 machine CLI**。

## 背景

v0.5 后续目标较多，已拆成可并行但有清晰依赖的四条目标线：

1. **v0.5.1 多语言、多主题架构治理**：P2，功能与 main 分支保持一致，不扩产品能力。
2. **Rust Core**：P0，建立共享识别算法核心，为 Android 识别和扫描算法优化提供基础。
3. **CLI**：P0，在跨平台端先可用，提供好的机器输出和 human-friendly 输出体验。
4. **桌面端**：P1，面向小白用户，已决策 Electron First。

这四条目标不是线性串行，但存在硬依赖和软依赖。整体原则是：**P0 先打通算法与跨平台执行闭环，P1 做桌面用户入口，P2 做架构治理，P1/P2 都不阻塞 P0 的工程验证。**

## 总览

```text
P0 Rust Core
  -> P0 CLI
      -> P1 Electron Desktop

P2 v0.5.1 i18n/theme governance
  -> supports Android UI stability
  -> supports future Electron shared theme/i18n
  -> does not block Rust Core / CLI
```

## 目标 1：v0.5.1 多语言、多主题架构治理

优先级：P2

定位：架构治理，不扩功能。功能体验需要与 main 分支保持一致。

范围：

1. i18n：一种语言一个目录，一个 namespace 一个文件。
2. 主题：Token-first + Tailwind-compatible + NativeWind optional。
3. `AppThemePalette` 降级为兼容 facade。
4. `AppPreferencesContext` 统一语言和主题状态。
5. 清理硬编码颜色和测试 mock theme。

依赖：

1. 不依赖 Rust Core。
2. 不依赖 CLI。
3. 不依赖桌面端。
4. 需要避免和 Android UI 大改同时进行，防止回归定位困难。

被依赖：

1. Electron 未来复用主题 token、Tailwind CSS `@theme` 和 i18n namespace。
2. Android UI 长期维护依赖这次治理。

验收：

1. 与 main 分支功能一致。
2. light / dark / system 行为不变。
3. 中英文 copy 结构稳定。
4. 无新增 raw color。
5. `typecheck` 和 RN tests 通过。

## 目标 2：Rust Core

优先级：P0

定位：长期算法主线。没有 Rust Core，Android 识别和扫描算法优化会继续被 Kotlin / TS / Go / Node 分散实现拖累。

范围：

1. `engines/recognition-rust/crates/media_clean_core`。
2. 最小识别能力：metrics、hash、scoring、low-value / duplicate candidate。
3. 输出 `media-clean-result.schema.json` compatible session。
4. `algorithmVersion`。
5. parity fixture：Rust output vs Android native output vs Go spike output。

依赖：

1. 依赖现有 schema / golden fixture。
2. 依赖 Android 当前 native executor 的数据模型和分析行为作为 parity baseline。
3. 不依赖 v0.5.1 主题/i18n。
4. 不依赖 Electron。

被依赖：

1. CLI P0 硬依赖 Rust Core。
2. Electron Desktop P1 硬依赖 Rust Core。
3. Android 算法优化软依赖 Rust Core：先通过 parity 验证，再逐步迁移平台无关逻辑。
4. Future iOS hard dependency：iOS 不应重写另一套算法。

验收：

1. `cargo test`。
2. Rust CLI fixture 输出通过 schema validation。
3. 与 Android baseline 的核心指标可比较。
4. 与 Go spike 形成对照，不形成第二套算法。

## 目标 3：CLI

优先级：P0

定位：跨平台先用。CLI 是 Rust Core 的第一个产品化验证入口，也是 skill / CI / automation 的稳定接口。

范围：

1. `media_clean_cli`。
2. non-interactive machine CLI：JSON / JSONL output。
3. human-friendly output：progress、summary、explain。
4. optional TUI：`media_clean_tui` / `media-clean tui`，只面向人工交互。
5. dry-run quarantine。
6. local LLM review hook。

依赖：

1. 硬依赖 Rust Core。
2. 依赖 schema / fixtures。
3. 软依赖 npm package / N-API：CLI 可以先不等 N-API。
4. 不依赖 Electron。
5. 不依赖 v0.5.1 主题/i18n，但可复用 theme token 的 terminal color mapping。

被依赖：

1. Electron 可复用 CLI fallback。
2. skill 可以先调用 machine CLI。
3. CI / parity 可以用 CLI 作为验证入口。

验收：

1. `media-clean scan --format json` 稳定输出。
2. `media-clean plan` 稳定输出。
3. `media-clean quarantine --dry-run` 永远默认安全。
4. TUI 可打开、导航、预览 plan，但不是 automation 接口。

## 目标 4：桌面端

优先级：P1

定位：面向小白用户的完整桌面产品。桌面端第一阶段已决策为 Electron First，Tauri 仅保留为后续轻量化备选。

范围：

1. Electron app。
2. main process 调 `@mistap/media-clean-engine` / `media_clean_napi`。
3. CLI fallback。
4. renderer 走 typed IPC。
5. scan / review / plan / quarantine UI。
6. local LLM provider 设置。
7. 复用主题 token 生成 Tailwind CSS `@theme`。

依赖：

1. 硬依赖 Rust Core。
2. 硬依赖 N-API npm package 或 CLI fallback。
3. 软依赖 CLI：fallback 和同源行为验证。
4. 软依赖 v0.5.1 theme/i18n：桌面端完整产品应复用 token/i18n，但 early spike 可先使用最小主题。

被依赖：

1. 不阻塞 Rust Core。
2. 不阻塞 CLI。
3. 不阻塞 v0.5.1。

验收：

1. Electron main-process package smoke。
2. native addon load smoke。
3. CLI fallback smoke。
4. renderer IPC smoke。
5. quarantine dry-run safety check。

## 依赖矩阵

| 目标 | 优先级 | 硬依赖 | 软依赖 | 阻塞谁 |
| --- | --- | --- | --- | --- |
| v0.5.1 i18n/theme | P2 | main 功能 baseline | Electron future UI | 不阻塞 P0 |
| Rust Core | P0 | schema、Android baseline | Go spike 对照 | CLI、Desktop、future iOS |
| CLI | P0 | Rust Core、schema | TUI、N-API、theme terminal colors | Skill、Desktop fallback、CI parity |
| Desktop Electron | P1 | Rust Core、N-API 或 CLI fallback | v0.5.1 theme/i18n、CLI | 不阻塞 P0 |

## 执行顺序

### Track A：P0 Engine / CLI

```text
A1. Rust Core skeleton
A2. schema-compatible output
A3. parity fixture: Rust vs Android vs Go
A4. media_clean_cli scan / plan / dry-run
A5. human-friendly output
A6. optional TUI
A7. N-API wrapper
```

这条线是 P0，应优先持续推进。

### Track B：P2 App Governance

```text
B1. v0.5.1 i18n namespace cleanup
B2. token foundation
B3. AppThemePalette compatibility facade
B4. hardcoded color cleanup
B5. NativeWind / Tailwind output pilot
```

这条线不阻塞 Track A，但可以并行。原则是功能不变、降低后续桌面复用成本。

### Track C：P1 Desktop

```text
C1. Electron architecture spike
C2. main process calls N-API
C3. CLI fallback
C4. typed IPC
C5. scan/review/plan/quarantine UI
C6. packaged smoke
```

这条线等 Rust Core + CLI 有稳定 contract 后再推进完整产品化。

## 并行策略

可以并行：

1. Rust Core skeleton 与 v0.5.1 theme/i18n 文档/治理。
2. CLI machine output 与 v0.5.1 token cleanup。
3. Electron 架构设计与 N-API 包设计。

不建议并行：

1. Android native executor 大改 与 v0.5.1 UI 大改同时落地。
2. Electron 完整 UI 与 Rust Core schema 未稳定时同步推进。
3. TUI / Electron / skill 三个交互层同时做大量 UI 细节。

## 决策

1. P0 主线：Rust Core -> CLI。
2. P2 治理：v0.5.1 i18n/theme，保持 main 功能一致。
3. P1 产品化：Electron Desktop，在 Rust Core + CLI contract 稳定后推进。
4. CLI 的 TUI 是 human mode，不是 skill/automation 接口。
5. 所有目标共享 schema、algorithmVersion、themeVersion / i18n namespace 这些 contract，避免后续分叉。

## 明确 TODO

1. 为 P0 Rust Core 创建执行计划。
2. 为 P0 CLI 创建执行计划，明确 machine CLI 和 optional TUI。
3. 为 P2 v0.5.1 创建治理计划，限制功能不变。
4. 为 P1 Electron Desktop 创建后置计划，依赖 Rust Core / CLI contract。
5. 后续执行时分 track 推进，不把 UI 治理和算法迁移混成一个 PR。
