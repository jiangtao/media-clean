# Native Engine 主线方案调研

[English Version](./native-engine-options.en.md)

## 背景

v0.5 的核心架构问题不是把 Android Kotlin 扫描逻辑搬回 TypeScript，而是把当前 Android-only native scan 发展成跨端可复用的 native engine contract。

React Native 官方线程模型明确区分 UI thread 和 JavaScript thread，JavaScript thread 承担 React render 和 layout；扫描、图片/视频解码、视觉指标、hash、checkpoint、恢复这类重任务不适合回到 RN 渲染链路。当前 Android 的 `AndroidNativeScanExecutor` 已经把工作放到 native executor 和 worker pool，这个方向应保留。

本调研基于 2026-05-08 社区和官方资料：

1. React Native 官方线程模型：[Threading Model](https://reactnative.dev/architecture/threading-model)。
2. React Native 官方 C++ Turbo Native Module 路线：[Cross-Platform Native Modules (C++)](https://reactnative.dev/docs/next/the-new-architecture/pure-cxx-modules)。
3. Expo Modules API 的 Swift / Kotlin native module 路线：[Expo Modules API](https://docs.expo.dev/modules/overview)。
4. Kotlin Multiplatform 与 RN 的定位对比：[Kotlin Multiplatform vs. React Native](https://kotlinlang.org/docs/multiplatform/kotlin-multiplatform-react-native.html)。
5. Kotlin/Native binary 发布能力：[Build final native binaries](https://kotlinlang.org/docs/multiplatform/multiplatform-build-native-binaries.html)。
6. Rust UniFFI binding 方案：[UniFFI](https://mozilla.github.io/uniffi-rs/0.29/)。
7. OpenCV 跨平台图像处理能力：[OpenCV Platforms](https://opencv.org/platforms/)。
8. Go mobile binding 方案：[Go Wiki: Mobile](https://go.dev/wiki/Mobile)。
9. Node.js native addon ABI 稳定接口：[Node-API](https://nodejs.org/api/n-api.html)。
10. Rust Node-API 发包框架：[NAPI-RS](https://napi.rs/cn)。
11. Node-API prebuild 发包参考：[prebuild](https://nodejs.github.io/node-addon-examples/build-tools/prebuild/)。
12. Node.js 图像处理常见 native backend：[sharp](https://sharp.pixelplumbing.com/) 与 [libvips](https://www.libvips.org/index.html)。

## 评估维度

1. 能否把重计算放在 native/background worker。
2. Android 当前 Kotlin executor 是否能低风险迁移。
3. iOS Photos / CoreGraphics / AVFoundation 是否能接入。
4. 桌面目录扫描和 CLI / skill 是否容易分发。
5. 用户是否需要安装 Kotlin、Gradle、JDK、Rust 等开发依赖。
6. 长期算法复杂化时是否能接 OpenCV / ML inference。
7. 与 Expo managed / CNG 的维护成本是否可控。
8. skill、CLI、桌面端和移动端是否能复用同一套识别算法核心，避免每个入口各自维护阈值、hash、聚类和清理建议逻辑。

## 核心复用原则

后续大方向应是 **one recognition core, many adapters**：

```text
Recognition Core
  deterministic metrics / hash / duplicate / clustering / scoring
  shared fixtures / thresholds / schema / regression tests

Adapters
  Android MediaStore adapter
  iOS Photos adapter
  Desktop filesystem adapter
  CLI / skill adapter
  Local LLM review adapter
```

skill 和 CLI 不能各自重新实现一套识别算法。它们应调用同一套 recognition core 或同一份预构建 engine binary，只负责输入源、执行编排、报告、LLM 复核和安全 quarantine。这样一端优化了 blur、hash、相似聚类、截图识别、低价值判断或阈值校准，Android、桌面 CLI、skill 和后续 iOS 都可以通过同一组 golden fixtures 和 schema validation 获益。

因此语言选型的第一约束不是“哪种语言写 CLI 最快”，而是：

1. 算法 core 能否长期被 CLI / skill / desktop / mobile 复用。
2. 用户侧能否拿到预构建产物，而不是被要求安装 Rust、Go、Kotlin、JDK、Node native build toolchain。
3. 平台 adapter 是否足够薄，只做 source enumeration、权限、生命周期、文件隔离和回收站策略。
4. schema、fixtures、阈值和 regression tests 是否在所有入口共享。

## Rust 与 Android 对齐方式

Rust shared core 不能绕开当前 Android 结构另起炉灶。它应按现有 Android native scan 的结构对齐：

```text
Android Kotlin
  MediaStore / permission / foreground service / worker lifecycle
  -> source assets / thumbnail or frame buffers
  -> Rust recognition core
      deterministic metrics / hash / scoring / clustering
  -> schema-compatible analyzed inputs / session output
  -> Kotlin emits progress / checkpoint / completion to RN
```

需要保持的 Android 责任：

1. `MediaStore` 枚举、权限、`IS_PENDING` / `IS_TRASHED` 过滤、URI 访问。
2. foreground service、通知、取消、恢复、进度事件。
3. 图片 / 视频帧获取与平台生命周期治理，尤其是大 bitmap / video frame 的内存边界。
4. RN bridge 事件和 fallback 行为。

Rust 只接管平台无关部分：

1. 灰度 / 亮度 / 对比度 / edge / blur 等 deterministic metrics。
2. `contentHash`、`perceptualHash`、`differenceHash`、frame hashes。
3. duplicate / near-similar / low-value / screenshot 等候选生成。
4. scoring、threshold、cluster、cleanup candidate reasoning。
5. schema-compatible result assembly 和 regression test fixtures。

FFI 边界必须克制：不要让 RN 或 Kotlin 逐字段频繁调用 Rust，也不要跨 JNI 传 React object。优先传批量 job、紧凑 metadata、文件路径 / content URI 解析后的临时文件、缩略图 bytes 或视频帧 buffer；Rust 返回批量结果和 checkpoint-friendly output。

## 仓库放置策略

当前阶段适合把 Rust shared core 放在本仓库，但只放 **engine core、CLI spike、schema、fixtures、parity tests**，不把完整桌面产品或发布态 Codex skill 绑死在移动 App 仓库里。

推荐目录：

```text
engines/recognition-rust/
  crates/media_clean_core/
  crates/media_clean_cli/
  fixtures/
  benches/

schemas/
fixtures/media-clean-result/
scripts/scan/
```

放在本仓库的理由：

1. Android Kotlin executor、TS bridge、schema 和 fixtures 都在这里，最容易做 parity。
2. v0.5 仍以 Android-first 为验收基线，Rust core 必须贴着现有 Android 结构演进。
3. 同一 PR 可以同时更新算法、schema、Android adapter、CLI fixture 和测试。

不应放在本仓库的内容：

1. 发布态 Codex skill 的全部运行时模板和用户安装逻辑。这里最多保留 dev wrapper / smoke wrapper。
2. 完整 macOS UI 产品。CLI / skill 跑通后，桌面 UI 可以再决定是否拆到 `apps/desktop` 或独立仓库。
3. 与移动端无关的大量 LLM prompt 实验数据、模型缓存、用户媒体样本。

## 发包与 Rust N-API 策略

Rust N-API / napi-rs 适合做 **Node / npm / skill 绑定层**，不适合定义为唯一 core 架构。原因是 N-API 解决的是 Node.js 原生扩展 ABI 和 npm 分发问题；Android Kotlin、iOS Swift 和 Rust CLI 并不应该通过 N-API 调 core。

推荐分层：

```text
engines/recognition-rust/
  crates/media_clean_core/
    pure Rust core, no Node, no RN, no Android dependency
  crates/media_clean_cli/
    Rust binary: media-clean
  crates/media_clean_napi/
    napi-rs binding for Node.js / npm / skill
  crates/media_clean_uniffi/
    future Kotlin / Swift binding boundary

packages/media-clean-engine/
  npm package, exports Node API and optional CLI shim
```

原则：

1. `media_clean_core` 是唯一算法主线；N-API、CLI、UniFFI 都只是 adapter。
2. `media_clean_napi` 只暴露批量 API，例如 `scanDirectory()`、`analyzeBatch()`、`reviewSession()`，不要暴露逐像素或逐字段调用。
3. npm 包优先发布预编译 `.node` 产物，避免用户安装 Rust toolchain、C++ build tools 或 node-gyp。
4. CLI 同时保留纯 Rust binary 路线，服务不依赖 Node 的桌面 / daemon 场景。
5. Android / iOS 后续走 UniFFI、JNI 或 Swift binding，不走 N-API。

发包阶段：

```text
Phase A: repo-local
  cargo test
  cargo run -p media_clean_cli
  node scripts wrapper calls local binary / local napi build

Phase B: internal npm
  @mistap/media-clean-engine
  prebuilt napi-rs binaries for macOS / Linux / Windows
  skill dev wrapper depends on npm package

Phase C: public CLI / skill
  npm package exposes JS API and media-clean command
  GitHub Release also ships standalone Rust binaries

Phase D: mobile return
  Android AAR / native .so + Kotlin adapter
  iOS XCFramework / Swift adapter
  same schema and fixtures as CLI / skill
```

因此不是“直接用 RustNAPI 取代 CLI / UniFFI”，而是 **Rust core + napi-rs for Node package + Rust CLI binary + future UniFFI for mobile**。

## 方案对比

| 方案 | 社区成熟度 | Android / iOS | Desktop / CLI | 用户安装负担 | 优点 | 风险 |
| --- | --- | --- | --- | --- | --- | --- |
| 平台各自 native: Kotlin + Swift | 高 | 很强 | 弱 | 低 | 最贴近系统 API，性能和调试最好 | 算法、checkpoint、阈值容易在双端漂移 |
| KMP shared engine | 高且上升 | 强 | 中到强，JVM / Native 可做 | 开发期高，用户侧可打包降低 | 复用当前 Kotlin 资产，适合 Android-first，业务逻辑共享好 | iOS native 调试和图像 API `expect/actual` 复杂 |
| C++ core + TurboModule / JSI | RN 官方支持方向 | 强 | 强 | 用户侧低 | 真跨端、高性能，适合算法和 OpenCV | CMake、ObjC++、JNI、Expo/CNG 集成复杂 |
| Rust core + UniFFI | 成熟度高 | 强 | 很强 | 用户侧低，可发预编译 binary | CLI / skill 分发最干净，内存安全，Kotlin / Swift / Python binding | 系统相册、权限、后台任务仍需平台 adapter |
| Go engine / daemon | 高 | 中 | 强 | 用户侧低，可发单 binary | CLI、daemon、本地 server、并发文件扫描很快 | 图像算法、OpenCV / FFmpeg、移动复用通常绕不开 cgo / gomobile 复杂度 |
| Node.js orchestrator / engine | 极高 | 弱 | 强 | 中，依赖 Node 或打包 runtime | skill wrapper、LLM provider、JSON/SQLite、报告和插件生态最好 | JS 不适合重图像算法，最终仍依赖 sharp/libvips、native addon 或外部 binary |
| OpenCV / C++ vision core | 图像领域成熟 | 强 | 强 | 用户侧低 | blur、edge、hash、视频帧分析匹配度高 | 包体、C++ 构建、裁剪和 license 要治理 |
| TFLite / MediaPipe native ML | 成熟 | 强 | 中 | 低到中 | 未来 AI 分类、语义识别、端侧模型推理的正路 | 当前 v0.5 非 AI 规则识别，过早引入会扩大范围 |

## 方案分析

### 平台各自 native

这是当前 Android 的现实基础。Android 继续使用 Kotlin worker、foreground service、MediaStore / Bitmap / MediaMetadataRetriever 是正确的短期选择。

问题是 iOS 如果再独立写 Swift，评分、hash、阈值、恢复游标、checkpoint 语义会逐渐分叉。它适合作为 v0.5 的保底路径，不适合作为长期跨端主线。

### KMP shared engine

KMP 适合共享这些内容：

1. `ScanJob`、`ScanAsset`、`ScanProgress`、`ScanCheckpoint`、`ScanResult`。
2. 识别评分、阈值、false-positive 过滤、recycle-bin merge。
3. checkpoint 状态机、取消、恢复、错误分类。
4. common tests 和 golden fixtures。

KMP 不应强行共享这些内容：

1. Android MediaStore 枚举。
2. iOS Photos 权限与 asset fetch。
3. Android Bitmap / MediaMetadataRetriever。
4. iOS CoreGraphics / ImageIO / AVFoundation。
5. 桌面 filesystem 权限和 quarantine 策略。

CLI 可以通过 KMP `jvmMain` 或 Kotlin/Native binary 做，但用户侧不能要求安装 Kotlin / Gradle。交付时必须是预构建 artifact，例如 npm wrapper、zip/tar binary、jpackage bundle，或内部 app framework。

KMP 的主要问题：

1. CLI / skill 分发不够自然。JVM CLI 可能带来 JRE / jpackage 负担；Kotlin/Native CLI 又会引入额外 native target 维护。
2. iOS 调用体验不是 Swift 原生。KMP 可以导出 iOS framework，但错误、集合、协程、泛型和调试体验都需要额外治理。
3. 图像处理仍要平台 `actual`。MediaStore / Photos / Bitmap / CoreGraphics / AVFoundation 不能真正放进 `commonMain`。
4. 构建系统复杂。Android Gradle、KMP、CocoaPods / Swift Package / XCFramework，再叠加 Expo CNG，会增加维护面。
5. 算法生态不是最强项。若后续进入 OpenCV、SIMD、embedding、向量检索或本地 LLM 旁路工具，Kotlin/KMP 不如 Rust / C++ 直接。

### C++ core + TurboModule / JSI

React Native 官方提供 C++ Turbo Native Module 路线，适合平台无关算法。若后续决定引入 OpenCV，C++ 主线最自然。

风险是工程复杂度较高：Android CMake、iOS Objective-C++ provider、Codegen、Expo/CNG 插件都需要维护。它适合算法变重后的中长期路线，不适合 v0.5 立刻全量切换。

### Rust core + UniFFI

Rust + UniFFI 适合把 scan engine 做成独立 SDK / CLI / skill 后端。UniFFI 可生成 Kotlin、Swift、Python binding，Rust binary 也方便分发到 macOS、Linux、Windows。

它的限制是：系统相册、权限、后台任务、通知、删除/回收站都仍需要平台 native adapter。Rust core 最适合承担纯算法、hash、结果聚合、CLI 目录扫描，不应直接处理移动端权限和 UI 生命周期。

Rust 的主要问题：

1. 移动平台 adapter 仍然要写。Android MediaStore、iOS Photos、权限、后台任务、通知都不应塞进 Rust core。
2. FFI 边界必须克制。不能频繁跨 JNI / Swift FFI 传大对象；图片像素、缩略图、视频帧要批量传，或在平台侧生成文件 / buffer 后交给 engine。
3. 团队门槛更高。Rust、Cargo、UniFFI、Android NDK、iOS XCFramework 都会进入日常维护面。
4. App 集成成本高。Android 要处理 `.so`、ABI、NDK；iOS 要处理 framework、架构、签名和 Expo/CNG 插件。
5. 移动后台生命周期不属于 Rust。foreground service、BGTask、权限恢复、进度通知仍然由 Kotlin / Swift adapter 管。

### Rust vs KMP 的移动共享取舍

如果目标是 Android + iOS 移动 App 共享 engine，两者的核心区别是：

```text
KMP:
  更适合共享 app 内业务逻辑
  更贴近当前 Android Kotlin 资产
  对 Android-first + later iOS 更稳
  对 CLI / skill 分发不够干净

Rust:
  更适合独立 engine / CLI / skill / desktop
  算法生态、native binary 分发和本地工具化更强
  对移动端需要额外 FFI 和平台 adapter
  初期集成成本更高
```

路线判断：

1. 如果目标排序是 `Android first -> iOS mobile app`，KMP 更稳。
2. 如果目标排序是 `Android first -> macOS desktop / CLI / skill -> local LLM recognition`，Rust 更有长期价值。
3. 当前项目若保持 Android 生产基线，同时把创新重心转向桌面 / skill / 本地 LLM，推荐短期保留 Android Kotlin native executor，中期做 Rust CLI / desktop recognition engine，长期再通过 UniFFI 把 Rust engine 接回 Android / iOS。
4. 不建议立刻重写 Android。应先用 shared schema + golden fixtures 做 Android Kotlin 与 Rust desktop engine 的 parity，等 Rust 证明算法能力和分发价值后，再决定是否反向替换移动端 engine。

### Go engine / daemon

Go 可以认真作为桌面 / skill 方向的备选，但它更像 CLI、daemon、本地 HTTP server 和文件扫描管线，而不是移动共享 engine。

Go 的优势：

1. 单 binary 分发体验好，用户不需要装 Go toolchain。
2. goroutine 和 channel 适合目录扫描、批处理、worker pipeline、本地 server。
3. 文件系统、HTTP、JSON、SQLite、日志和配置生态成熟。
4. 如果产品形态是“桌面本地服务 + Web UI / skill 调用”，Go 的交付速度会很高。

Go 的问题：

1. 图像算法生态不如 Rust / C++ 直接。接 OpenCV、FFmpeg、libvips 时常会进入 cgo。
2. cgo 会削弱 Go 的跨平台构建优势，尤其是 macOS arm64/x64、Linux、Windows 多产物分发。
3. 移动端复用不自然。`gomobile bind` 可以生成 Android / iOS binding，但在 RN / Expo / CNG 场景里不是主流路线，团队和生态经验弱于 Kotlin / Swift / Rust / C++。
4. Go GC 对大批图片 buffer、视频帧和 native memory 不是不能用，但要额外治理内存峰值和释放边界。

适合选 Go 的条件：

1. 目标是最快落地桌面 CLI / local daemon。
2. 短期不追求 engine 回接 Android / iOS。
3. 算法主要依赖现成外部库或调用 LLM，不深入做 SIMD / OpenCV / embedding。
4. 更看重本地服务稳定性和开发效率，而不是 engine SDK 长期复用。

### Node.js orchestrator / engine

Node.js 不应作为核心识别 engine，但应作为 skill / CLI orchestration 的强候选。

Node.js 适合做：

1. Codex skill wrapper。
2. npm CLI 入口。
3. Ollama / LM Studio / OpenAI-compatible local LLM provider glue。
4. JSON schema、SQLite、报告生成、交互式 cleanup plan。
5. 调 native engine binary、sharp/libvips、ffmpeg 或 OpenCV sidecar。

Node.js 不适合作为底层识别 core 的原因：

1. JS 主线程不适合图片 / 视频 decode、hash、相似度和 frame sampling 这类重计算。
2. 真要高性能，通常会回到 sharp/libvips、Node-API native addon、WASM 或外部 binary。
3. Node-API 可提供 ABI 稳定 native addon，但 addon 的外部库、预编译产物和平台矩阵仍要维护。
4. Node runtime 对移动端 App engine 复用不自然。
5. 若用户安装的是桌面 App / skill，Node 可以被打包或作为 npm 入口，但不应成为算法层的唯一依赖。

适合选 Node.js 的条件：

1. 目标是快速做 skill、LLM 编排和报告体验。
2. 核心算法由 Rust-first binary、必要时 C++ / OpenCV analyzer，或短期 Go comparison binary 承担。
3. 用户入口以 npm / Codex skill / 本地脚本为主。
4. 需要大量 JSON schema、prompt、provider、缓存、报告层迭代。

### OpenCV / C++ vision core

OpenCV 是视觉处理库，不是完整 app architecture。它适合作为 analyzer implementation：blur、edge density、resize、frame extract、hash 前处理。

如果未来手写 Bitmap 算法开始失控，应把 analyzer 换成 OpenCV/C++，但不必现在把整个 engine 架构定义成 OpenCV。

### TFLite / MediaPipe

当前 v0.5 是非 AI 规则识别。TFLite / MediaPipe 适合未来做相册语义分类、截图识别、人像/文档/重复场景识别、端侧模型推理。现阶段引入会带来模型、训练数据、端侧性能和包体治理，不应进入 v0.5 主线。

## 决策

按当前产品优先级，v0.5 后续主线调整为：

```text
Phase 1: Android native baseline + shared scan result contract
Phase 2: Desktop / CLI / skill recognition engine spike
Phase 3: Local LLM review layer + safe quarantine workflow
Phase 4: Mobile shared engine return path, only after desktop engine proves value
```

如果产品重新回到 `Android first -> iOS mobile app`，KMP 可升级为 Phase 2；但在当前 `Android first -> macOS desktop / CLI / skill -> local LLM recognition` 方向下，KMP 是移动共享备选，**Rust-first shared recognition core** 是长期推进主线，Go 保留为 desktop CLI / daemon spike 和工程对照。

当前推荐架构：

```text
RN UI / Expo App
  -> TypeScript ScanBridge contract
  -> Android Kotlin adapter
      当前生产路径，保留
  -> iOS Swift adapter
      后续接 Photos / CoreGraphics / AVFoundation
  -> Desktop / CLI adapter
      后续接 filesystem source

Desktop / Skill Track
  Node.js
    skill wrapper / npm CLI / LLM provider / report UX
  Shared Recognition Core
    Rust-first for long-term reuse and mobile return path
    deterministic metrics / hash / clustering / scoring
  Go Desktop Spike
    CLI / daemon feasibility probe, not a second algorithm mainline
  Optional C++ / OpenCV
    heavy image/video analyzer backend

Mobile Return Track
  KMP or Rust UniFFI
    only after shared schema + golden parity are stable
```

关键结论：

1. 不把 TypeScript 当作 scan / recognition engine。
2. Android Kotlin native executor 继续是生产基线。
3. 当前优先级下，KMP 不是立即主线，而是移动端共享备选。
4. CLI / skill 不直接暴露 KMP 工具链，最终必须预构建。
5. 在 CLI / skill 权重已经高于短期 iOS 的前提下，主线收束为 Rust + UniFFI；Go 只保留为 desktop CLI / daemon 对照。
6. 如果图像算法复杂度快速上升，引入 OpenCV / C++ analyzer，而不是继续手写像素算法。
7. 桌面 / skill / 本地 LLM 是当前中期主线，下一步应补 Rust shared core spike，并把当前 Go spike 作为对照基线。
8. Go 是 desktop daemon / CLI 的强备选；当前已增加 Go desktop spike 验证单 binary / 标准库扫描 / schema artifact 路线，但它不应默认升级为长期算法 core。
9. Node.js 应定位为 orchestration / skill wrapper / LLM glue，不作为重识别 engine。
10. skill、CLI、desktop 和 mobile 不应分叉成多套算法；主线要收敛到一套 recognition core、多层 adapter、多端共享 fixtures。
11. 除非 Rust spike 在产物体积、性能、移动绑定或团队维护上明显失败，否则默认不再新增 Go 规则能力；新增算法优先进入 Rust shared core。

## 执行 TODO

1. 修正 v0.5 架构文档：`portable-scan-core` 不能被描述为 production engine，只能是 result contract / fixture helper。
2. 新增 `native-scan-engine` contract：输入、输出、progress、checkpoint、错误、取消、恢复。
3. 抽 Android native executor 的接口边界，不改变当前 Android 行为。
4. 将当前 Go desktop spike 明确限定为 desktop / CLI feasibility probe；下一步补 Rust shared core spike，并用同一份 schema、fixtures、threshold tests 验证 Rust 作为默认共享 recognition core 的可行性。
5. 增加 local LLM review spike：Ollama、LM Studio、llama.cpp OpenAI-compatible endpoint。
6. 已增加第一版 shared schema + golden fixture；下一步把 Android Kotlin output 与 desktop engine output 都接入同一验证。
7. KMP spike 后置：只在移动共享重新成为优先级时推进 common model、scoring、checkpoint tests。
8. iOS adapter 先做 Photos / CoreGraphics / AVFoundation 设计，不在 v0.5 直接声明 iOS 扫描支持。
9. 设备验收继续以 Android native-first 为基线，desktop / CLI / skill 使用 schema fixture 和 CLI artifact 验收；iOS 只在 adapter 完成后进入执行验收。
10. 设计 `media-clean scan` CLI 时先定义 engine boundary，确保 skill 入口和 CLI 入口调用同一份算法产物，而不是在 Node.js / Go / Kotlin 中重复实现规则。
11. Rust 放在本仓库的 `engines/recognition-rust` 作为 shared core 与 CLI spike；发布态 skill 和完整桌面 UI 后置，避免当前移动 App 仓库失控膨胀。
12. Android adapter 对齐当前 `AndroidNativeScanExecutor` 的 source、worker、progress、checkpoint 结构，先替换 metrics/hash/scoring 等平台无关段，不先改 MediaStore / foreground service / RN bridge。
