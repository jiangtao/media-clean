# Native Engine Mainline Options Research

[中文版本](./native-engine-options.md)

## Background

The v0.5 architecture problem is not to move Android Kotlin scan work back into TypeScript. The real goal is to evolve the current Android-only native scan path into a reusable cross-platform native engine contract.

React Native's official threading model separates the UI thread from the JavaScript thread. The JavaScript thread runs React render and layout work, so scan enumeration, image/video decode, visual metrics, hashing, checkpointing, and resume logic should not move back into the RN rendering path. The current Android `AndroidNativeScanExecutor` already uses a native executor and worker pools, and that direction should be preserved.

This research is based on community and official sources checked on 2026-05-08:

1. React Native official threading model: [Threading Model](https://reactnative.dev/architecture/threading-model).
2. React Native official C++ Turbo Native Module path: [Cross-Platform Native Modules (C++)](https://reactnative.dev/docs/next/the-new-architecture/pure-cxx-modules).
3. Expo Modules API for Swift / Kotlin native modules: [Expo Modules API](https://docs.expo.dev/modules/overview).
4. Kotlin Multiplatform positioning versus RN: [Kotlin Multiplatform vs. React Native](https://kotlinlang.org/docs/multiplatform/kotlin-multiplatform-react-native.html).
5. Kotlin/Native binary distribution: [Build final native binaries](https://kotlinlang.org/docs/multiplatform/multiplatform-build-native-binaries.html).
6. Rust UniFFI binding approach: [UniFFI](https://mozilla.github.io/uniffi-rs/0.29/).
7. OpenCV cross-platform image processing support: [OpenCV Platforms](https://opencv.org/platforms/).
8. Go mobile binding approach: [Go Wiki: Mobile](https://go.dev/wiki/Mobile).
9. Node.js stable native addon ABI: [Node-API](https://nodejs.org/api/n-api.html).
10. Rust Node-API packaging framework: [NAPI-RS](https://napi.rs/).
11. Node-API prebuild packaging reference: [prebuild](https://nodejs.github.io/node-addon-examples/build-tools/prebuild/).
12. Common Node.js native image backends: [sharp](https://sharp.pixelplumbing.com/) and [libvips](https://www.libvips.org/index.html).

## Evaluation Criteria

1. Can heavy work run in native/background workers?
2. Can the current Android Kotlin executor migrate with low risk?
3. Can iOS Photos / CoreGraphics / AVFoundation be integrated?
4. Is desktop directory scan and CLI / skill distribution practical?
5. Does the user need to install Kotlin, Gradle, JDK, Rust, or other developer tooling?
6. Can the path support OpenCV / ML inference if algorithms get heavier?
7. Is the Expo managed / CNG maintenance cost acceptable?
8. Can skill, CLI, desktop, and mobile reuse the same recognition algorithm core instead of maintaining separate thresholds, hashes, clustering, and cleanup suggestion logic per entrypoint?

## Core Reuse Principle

The long-term direction should be **one recognition core, many adapters**:

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

Skills and CLI commands must not reimplement their own recognition algorithms. They should call the same recognition core, or the same prebuilt engine binary, and only own source wiring, orchestration, reporting, LLM review, and safe quarantine. With that shape, any improvement to blur detection, hashing, similarity clustering, screenshot detection, low-value scoring, or threshold calibration can benefit Android, desktop CLI, skills, and later iOS through the same golden fixtures and schema validation.

This makes the first language-selection constraint broader than "which language builds the CLI fastest":

1. Can the algorithm core be reused by CLI / skill / desktop / mobile over time?
2. Can users receive prebuilt artifacts instead of installing Rust, Go, Kotlin, JDK, Node native build tooling, or other developer dependencies?
3. Are platform adapters thin enough to only handle source enumeration, permissions, lifecycle, file isolation, and trash/quarantine policy?
4. Are schema, fixtures, thresholds, and regression tests shared by every entrypoint?

## Rust and Android Alignment

The Rust shared core must not bypass the current Android structure and start a separate pipeline. It should align with the existing Android native scan shape:

```text
Android Kotlin
  MediaStore / permission / foreground service / worker lifecycle
  -> source assets / thumbnail or frame buffers
  -> Rust recognition core
      deterministic metrics / hash / scoring / clustering
  -> schema-compatible analyzed inputs / session output
  -> Kotlin emits progress / checkpoint / completion to RN
```

Android should keep owning:

1. `MediaStore` enumeration, permissions, `IS_PENDING` / `IS_TRASHED` filtering, and URI access.
2. Foreground service, notifications, cancellation, resume, and progress events.
3. Image / video frame acquisition and platform lifecycle governance, especially large bitmap / video-frame memory boundaries.
4. RN bridge events and fallback behavior.

Rust should only own platform-agnostic work:

1. Deterministic metrics such as grayscale, brightness, contrast, edge, and blur.
2. `contentHash`, `perceptualHash`, `differenceHash`, and frame hashes.
3. Candidate generation for duplicate, near-similar, low-value, screenshot, and related groups.
4. Scoring, thresholds, clusters, and cleanup-candidate reasoning.
5. Schema-compatible result assembly and regression-test fixtures.

The FFI boundary must stay disciplined: do not call Rust field-by-field from RN or Kotlin, and do not pass React objects across JNI. Prefer batch jobs, compact metadata, file paths / temporary files resolved from content URIs, thumbnail bytes, or video-frame buffers. Rust should return batch results and checkpoint-friendly output.

## Repository Placement Strategy

At this stage, the Rust shared core should live in this repository, but only for **engine core, CLI spike, schemas, fixtures, and parity tests**. The full desktop product and published Codex skill should not be coupled to the mobile app repository yet.

Recommended layout:

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

Reasons to keep it here now:

1. The Android Kotlin executor, TS bridge, schemas, and fixtures already live here, making parity work easiest.
2. v0.5 still uses Android-first as the acceptance baseline, so the Rust core must evolve close to the current Android structure.
3. One PR can update algorithms, schemas, Android adapter code, CLI fixtures, and tests together.

Do not keep these in this repository yet:

1. The full runtime template and install logic for a published Codex skill. Keep only a dev wrapper / smoke wrapper here.
2. A complete macOS UI product. After CLI / skill works, decide whether desktop UI belongs in `apps/desktop` or a separate repository.
3. Large LLM prompt experiments, model caches, or user media samples unrelated to the mobile app.

## Packaging and Rust N-API Strategy

Rust N-API / napi-rs is a good fit for the **Node / npm / skill binding layer**, but it should not define the only core architecture. N-API solves Node.js native-addon ABI and npm distribution. Android Kotlin, iOS Swift, and the Rust CLI should not call the core through N-API.

Recommended layering:

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

Principles:

1. `media_clean_core` is the only algorithm mainline; N-API, CLI, and UniFFI are adapters.
2. `media_clean_napi` should expose batch APIs such as `scanDirectory()`, `analyzeBatch()`, and `reviewSession()`. Do not expose pixel-level or field-by-field calls.
3. The npm package should publish prebuilt `.node` artifacts first, so users do not need Rust toolchains, C++ build tools, or node-gyp.
4. Keep the pure Rust binary path for desktop / daemon scenarios that should not depend on Node.
5. Android / iOS should later use UniFFI, JNI, or Swift bindings, not N-API.

Release phases:

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

So the decision is not "use Rust N-API instead of CLI / UniFFI". It is **Rust core + napi-rs for the Node package + Rust CLI binary + future UniFFI for mobile**.

## Comparison

| Option | Community maturity | Android / iOS | Desktop / CLI | User install burden | Strengths | Risks |
| --- | --- | --- | --- | --- | --- | --- |
| Platform-native: Kotlin + Swift | High | Very strong | Weak | Low | Closest to system APIs, best performance and debugging | Algorithm, checkpoint, and threshold drift across platforms |
| KMP shared engine | High and growing | Strong | Medium to strong through JVM / Native | High in development, reducible for users through packaging | Reuses current Kotlin assets, good Android-first fit, strong business-logic sharing | iOS native debugging and image API `expect/actual` complexity |
| C++ core + TurboModule / JSI | Official RN path | Strong | Strong | Low for users | Truly cross-platform and high performance, good for algorithms and OpenCV | CMake, Objective-C++, JNI, and Expo/CNG integration complexity |
| Rust core + UniFFI | Mature | Strong | Very strong | Low for users with prebuilt binaries | Clean CLI / skill distribution, memory safety, Kotlin / Swift / Python bindings | System album, permissions, and background jobs still need platform adapters |
| Go engine / daemon | High | Medium | Strong | Low for users through single binaries | Fast CLI, daemon, local server, and concurrent filesystem scanning | Image algorithms, OpenCV / FFmpeg, and mobile reuse often bring cgo / gomobile complexity |
| Node.js orchestrator / engine | Very high | Weak | Strong | Medium, requires Node or a bundled runtime | Best for skill wrappers, LLM providers, JSON/SQLite, reports, and plugin ecosystems | JS is not ideal for heavy image algorithms; it usually delegates to sharp/libvips, native addons, or external binaries |
| OpenCV / C++ vision core | Mature in computer vision | Strong | Strong | Low for users | Good fit for blur, edge, hash, and frame analysis | Binary size, C++ build, trimming, and license governance |
| TFLite / MediaPipe native ML | Mature | Strong | Medium | Low to medium | Right path for future AI classification and on-device model inference | Current v0.5 is non-AI rule recognition, so this expands scope too early |

## Option Analysis

### Platform-native

This is the current Android baseline. Kotlin workers, foreground service, MediaStore, Bitmap, and MediaMetadataRetriever should stay in the production path.

The problem is drift. If iOS is written as a fully separate Swift implementation, scoring, hashing, thresholds, checkpoint cursors, and resume semantics can diverge. This is a good v0.5 fallback path, but not the best long-term cross-platform mainline.

### KMP Shared Engine

KMP is a good fit for sharing:

1. `ScanJob`, `ScanAsset`, `ScanProgress`, `ScanCheckpoint`, and `ScanResult`.
2. Recognition scoring, thresholds, false-positive filtering, and recycle-bin merge.
3. Checkpoint state machine, cancellation, resume, and error taxonomy.
4. Common tests and golden fixtures.

KMP should not force sharing:

1. Android MediaStore enumeration.
2. iOS Photos permission and asset fetch.
3. Android Bitmap / MediaMetadataRetriever.
4. iOS CoreGraphics / ImageIO / AVFoundation.
5. Desktop filesystem permission and quarantine policy.

CLI can be built through a KMP `jvmMain` target or Kotlin/Native binary, but users must not be asked to install Kotlin / Gradle. Distribution must be a prebuilt artifact, such as an npm wrapper, zip/tar binary, jpackage bundle, or app-internal framework.

Main KMP problems:

1. CLI / skill distribution is not natural. A JVM CLI may bring JRE / jpackage overhead, while Kotlin/Native CLI adds extra native target maintenance.
2. The iOS calling experience is not Swift-native. KMP can export an iOS framework, but errors, collections, coroutines, generics, and debugging all need extra governance.
3. Image processing still needs platform `actual` code. MediaStore / Photos / Bitmap / CoreGraphics / AVFoundation cannot truly live in `commonMain`.
4. The build system gets complex. Android Gradle, KMP, CocoaPods / Swift Package / XCFramework, and Expo CNG all expand the maintenance surface.
5. The algorithm ecosystem is not the strongest part. If the project moves into OpenCV, SIMD, embeddings, vector search, or local LLM sidecar tooling, Kotlin/KMP is less direct than Rust / C++.

### C++ Core + TurboModule / JSI

React Native officially supports C++ Turbo Native Modules for platform-agnostic code. If the project later adopts OpenCV, a C++ core becomes a natural fit.

The cost is engineering complexity: Android CMake, iOS Objective-C++ providers, Codegen, and Expo/CNG plugin maintenance. It is a good medium-to-long-term path if algorithms get heavier, but not the lowest-risk v0.5 rewrite path.

### Rust Core + UniFFI

Rust + UniFFI is strong when the scan engine becomes an independent SDK, CLI, or skill backend. UniFFI generates Kotlin, Swift, and Python bindings, and Rust binaries are easy to distribute across macOS, Linux, and Windows.

The limitation is that system albums, permissions, background tasks, notifications, deletion, and recycle-bin behavior still need native platform adapters. Rust should own pure algorithm, hashing, result aggregation, and CLI directory scan work, not mobile lifecycle and permissions.

Main Rust problems:

1. Mobile platform adapters still need to be written. Android MediaStore, iOS Photos, permissions, background jobs, and notifications should not be pushed into the Rust core.
2. FFI boundaries must stay disciplined. Do not pass large objects across JNI / Swift FFI frequently; pixels, thumbnails, and video frames should be batched, or generated as files / buffers by platform code before entering the engine.
3. The team bar is higher. Rust, Cargo, UniFFI, Android NDK, and iOS XCFrameworks all enter daily maintenance.
4. App integration cost is high. Android must handle `.so`, ABI, and NDK details; iOS must handle frameworks, architectures, signing, and Expo/CNG plugins.
5. Mobile background lifecycle remains outside Rust. Foreground services, BGTask, permission recovery, and progress notifications still belong to Kotlin / Swift adapters.

### Rust vs KMP for Mobile Sharing

If the goal is a shared Android + iOS mobile engine, the core difference is:

```text
KMP:
  Better for sharing in-app business logic
  Closest to the current Android Kotlin assets
  More stable for Android-first + later iOS
  Less clean for CLI / skill distribution

Rust:
  Better for an independent engine / CLI / skill / desktop
  Stronger for algorithms, native binary distribution, and local tooling
  Needs additional FFI and platform adapters on mobile
  Higher initial integration cost
```

Route selection:

1. If the priority order is `Android first -> iOS mobile app`, KMP is safer.
2. If the priority order is `Android first -> macOS desktop / CLI / skill -> local LLM recognition`, Rust has more long-term value.
3. If this project keeps Android as the production baseline while moving product innovation toward desktop / skill / local LLM, the recommended path is to keep the Android Kotlin native executor in the short term, build a Rust CLI / desktop recognition engine in the mid term, and later connect that Rust engine back into Android / iOS through UniFFI.
4. Do not rewrite Android immediately. First use shared schemas + golden fixtures for parity between the Android Kotlin path and the Rust desktop engine. Only decide whether to replace the mobile engine after Rust proves algorithm and distribution value.

### Go Engine / Daemon

Go is a serious desktop / skill alternative, but it is better viewed as a CLI, daemon, local HTTP server, and filesystem scanning pipeline than as a mobile shared engine.

Go strengths:

1. Single-binary distribution is good, and users do not need the Go toolchain.
2. Goroutines and channels fit directory scans, batch processing, worker pipelines, and local servers.
3. Filesystem, HTTP, JSON, SQLite, logging, and configuration ecosystems are mature.
4. If the product shape is "local desktop service + Web UI / skill calls", Go can move very quickly.

Go problems:

1. The image algorithm ecosystem is less direct than Rust / C++. OpenCV, FFmpeg, and libvips often pull the project into cgo.
2. cgo weakens Go's cross-platform build advantage, especially across macOS arm64/x64, Linux, and Windows artifacts.
3. Mobile reuse is not natural. `gomobile bind` can generate Android / iOS bindings, but it is not the mainstream path in RN / Expo / CNG projects, and ecosystem experience is weaker than Kotlin / Swift / Rust / C++.
4. Go's GC can handle large image buffers and video frames, but memory peaks and native-memory release boundaries need explicit governance.

Choose Go when:

1. The goal is the fastest desktop CLI / local daemon.
2. Short-term mobile engine reuse is not required.
3. Algorithms mostly rely on existing external libraries or LLM calls, rather than deep SIMD / OpenCV / embedding work.
4. Local service stability and development speed matter more than long-term engine SDK reuse.

### Node.js Orchestrator / Engine

Node.js should not be the core recognition engine, but it is a strong candidate for skill / CLI orchestration.

Node.js is good for:

1. Codex skill wrappers.
2. npm CLI entrypoints.
3. Ollama / LM Studio / OpenAI-compatible local LLM provider glue.
4. JSON schema, SQLite, reports, interactive cleanup plans.
5. Calling a native engine binary, sharp/libvips, ffmpeg, or an OpenCV sidecar.

Why Node.js should not be the low-level recognition core:

1. The JS main thread is not a good fit for heavy image/video decode, hashing, similarity, and frame sampling.
2. For performance, it usually returns to sharp/libvips, Node-API native addons, WASM, or external binaries.
3. Node-API provides stable ABI for native addons, but external libraries, prebuilt artifacts, and platform matrices still need maintenance.
4. Node runtime reuse inside a mobile app engine is not natural.
5. If users install a desktop app / skill, Node can be bundled or used as an npm entrypoint, but it should not be the only algorithm-layer dependency.

Choose Node.js when:

1. The goal is fast skill, LLM orchestration, and report UX iteration.
2. Core algorithms are handled by a Rust-first binary, a C++ / OpenCV analyzer when needed, or a short-term Go comparison binary.
3. The user entrypoint is npm / Codex skill / local scripts.
4. JSON schema, prompts, providers, cache, and reporting need frequent iteration.

### OpenCV / C++ Vision Core

OpenCV is an image processing library, not the full app architecture. It is a good analyzer implementation for blur, edge density, resize, frame extraction, and hash preprocessing.

If handwritten Bitmap logic grows too complex, the analyzer can move to OpenCV/C++. The entire engine does not need to be defined as OpenCV now.

### TFLite / MediaPipe

The current v0.5 scope is non-AI rule recognition. TFLite / MediaPipe are good future paths for album semantic classification, screenshot detection, portrait/document categories, and on-device model inference. Introducing them now would add model, training data, performance, and binary governance work too early.

## Decision

Given the current product priority, the v0.5 follow-up mainline is:

```text
Phase 1: Android native baseline + shared scan result contract
Phase 2: Desktop / CLI / skill recognition engine spike
Phase 3: Local LLM review layer + safe quarantine workflow
Phase 4: Mobile shared engine return path, only after desktop engine proves value
```

If the product returns to `Android first -> iOS mobile app`, KMP can move up to Phase 2. Under the current `Android first -> macOS desktop / CLI / skill -> local LLM recognition` direction, KMP is a mobile-sharing fallback, the **Rust-first shared recognition core** is the long-term mainline, and Go remains a desktop CLI / daemon spike plus engineering comparison point.

Recommended architecture:

```text
RN UI / Expo App
  -> TypeScript ScanBridge contract
  -> Android Kotlin adapter
      Current production path, preserved
  -> iOS Swift adapter
      Future Photos / CoreGraphics / AVFoundation path
  -> Desktop / CLI adapter
      Future filesystem source path

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

Key conclusions:

1. TypeScript is not the scan / recognition engine.
2. The Android Kotlin native executor remains the production baseline.
3. Under the current priority, KMP is not the immediate mainline; it is the mobile-sharing fallback.
4. CLI / skill must not expose the KMP toolchain directly. It needs prebuilt artifacts.
5. Since CLI / skill is now more important than short-term iOS work, converge the mainline on Rust + UniFFI; keep Go only as a desktop CLI / daemon comparison point.
6. If image algorithms become significantly more complex, introduce an OpenCV / C++ analyzer instead of continuing handwritten pixel logic.
7. Desktop / skill / local LLM is the current mid-term mainline. Next, add the Rust shared core spike and use the current Go spike as the comparison baseline.
8. Go is a strong desktop daemon / CLI alternative; the Go desktop spike now validates the single-binary / standard-library scan / schema artifact path, but it should not become the default long-term algorithm core.
9. Node.js should be positioned as orchestration / skill wrapper / LLM glue, not as the heavy recognition engine.
10. Skill, CLI, desktop, and mobile should not drift into separate algorithm implementations. The mainline should converge on one recognition core, thin adapters, and shared fixtures across entrypoints.
11. Unless the Rust spike clearly fails on artifact size, performance, mobile binding, or team maintenance cost, new recognition rules should enter the Rust shared core first rather than expanding the Go spike.

## Execution TODO

1. Correct the v0.5 architecture docs: `portable-scan-core` must not be described as a production engine. It is only a result contract / fixture helper.
2. Add a `native-scan-engine` contract covering input, output, progress, checkpoint, errors, cancellation, and resume.
3. Extract the Android native executor interface boundary without changing current Android behavior.
4. Keep the current Go desktop spike scoped as a desktop / CLI feasibility probe. Next, add the Rust shared core spike and validate Rust as the default shared recognition core against the same schema, fixtures, and threshold tests.
5. Add a local LLM review spike covering Ollama, LM Studio, and llama.cpp OpenAI-compatible endpoints.
6. First-pass shared schema + golden fixture are done; next, make Android Kotlin output and desktop engine output pass the same validation.
7. Defer the KMP spike. Only advance common model, scoring, and checkpoint tests if mobile sharing becomes the priority again.
8. Design the iOS adapter around Photos / CoreGraphics / AVFoundation first. Do not claim iOS scan support in v0.5.
9. Continue device acceptance with Android native-first as the baseline. Desktop / CLI / skill should be validated through schema fixtures and CLI artifacts; iOS should only enter execution acceptance after its adapter exists.
10. Design the `media-clean scan` CLI around the engine boundary first, so the skill entrypoint and CLI entrypoint call the same algorithm artifact instead of duplicating rules in Node.js, Go, or Kotlin.
11. Put Rust in this repository under `engines/recognition-rust` as the shared core and CLI spike. Defer the published skill and full desktop UI so the mobile app repository does not grow without boundaries.
12. Align the Android adapter with the current `AndroidNativeScanExecutor` source, worker, progress, and checkpoint shape. Replace platform-agnostic metrics/hash/scoring first; do not rewrite MediaStore, foreground service, or RN bridge first.
