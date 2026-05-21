# Android 稳定后可维护性重构验证报告

日期：2026-05-17
分支：`refactor/ui`
执行路径：Option B，Source of truth first，分阶段吸收 RNR / Tailwind

## 背景

Android 当前稳定，本轮目标是在保持现有设计风格和 Android 行为不回归的前提下，渐进式引入 React Native Reusables、NativeWind / Tailwind、文件级 tokens、JSON i18n 和模块级 skeleton。执行方式采用 agent-team：主线程负责计划和验收，subAgent 按 owner 和写范围并行实现。

## 决策

1. 不做 big-bang UI 重写，先冻结 baseline，再迁移 source of truth。
2. Theme、primitive、skeleton tokens 都以 `src/theme/tokens/app.tokens.json` 为 source，再生成运行时和 Tailwind 输出。
3. i18n 拆为 `src/i18n/locales/{zh,en}/*.json`，通过 generator 生成 `resources.generated.ts`。
4. NativeWind / RNR 只先接基础设施和本地 primitive，不直接套用 RNR 默认视觉。
5. Skeleton 最后接入，按模块维护，不改变业务数据流。
6. PhotoGrid / RecycleBin / Detail 是高风险模块，只允许 fallback 和 leaf-level 边界迁移。

## 完成范围

| Task | 结果 | 证据 |
| --- | --- | --- |
| 001 baseline freeze | 完成 | `docs/testing/android-stable-maintainability-baseline.md`，8 个 baseline test 文件通过 |
| 002 theme token source | 完成 | `verify:theme:tokens`，`src/theme/generated/*` |
| 003-006 i18n JSON/facade/formatter | 完成 | `verify:i18n:resources`，9 namespaces，generated drift check，生产 TS/TSX 中文硬编码门禁 |
| 007 NativeWind/RNR infra | 完成 | `verify:nativewind-rnr`，Android debug arm64 build 通过 |
| 008 primitive visual contract | 完成 | primitive style contract tests，覆盖 Badge/Button/Card/IconButton/MediaFrame/Progress/Separator/Switch/Text/TouchSurface token 映射 |
| 009 low-risk UI migration | 完成 | Settings/Landing/ActionSwitch/SegmentedControl 45 tests + Detail 回归 |
| 009b RNR primitive coverage governance | 完成 | `verify:ui-composition`：29/38 总覆盖，29/29 视觉覆盖，9 个 non-consumer 显式分类 |
| 010 skeleton foundation | 完成 | SkeletonBlock 4 tests |
| 011 App bootstrap skeleton | 完成 | RootNavigator + SkeletonBlock 8 tests |
| 012 Landing/Settings skeleton | 完成 | Landing/Settings/SkeletonBlock 24 tests |
| 013 PhotoGrid skeleton | 完成 | PhotoGrid 相关 129 tests |
| 014 RecycleBin/Detail skeleton | 完成 | RecycleBin/Detail/DuplicateCarousel 45 tests |
| 015 high-risk leaf boundary | 完成 | high-risk 222 tests + `verify:high-risk-leaf-boundary` |
| 016 team closeout | 完成 | `verify:maintainability-plan`，本文档和 gates 文档 |

## 本轮新增关键门禁

- `npm run verify:maintainability`
- `npm run verify:theme:tokens`
- `npm run verify:i18n:resources`
- `npm run verify:nativewind-rnr`
- `npm run verify:ui-composition`
- `npm run verify:high-risk-leaf-boundary`
- `npm run verify:maintainability-plan`

## 已通过验证

| 命令 | 结果 |
| --- | --- |
| `npm run verify:nativewind-rnr` | 通过 |
| `npm run verify:theme:tokens` | 通过 |
| `npm run verify:i18n:resources` | 通过，9 namespaces |
| `npm run verify:ui-composition` | 通过，29/38 production UI files，29/29 visual primitive coverage，9 categorized non-consumers |
| `npm run verify:high-risk-leaf-boundary` | 通过 |
| `npm run verify:maintainability-plan` | 通过，16 tasks / 16 task files |
| `npm run typecheck -- --pretty false` | 通过 |
| `npm run test -- --run` | 通过，69 files / 846 tests |
| `npm run build:android:debug:arm64` | 通过，生成 `android/app/build/outputs/apk/debug/app-debug.apk` |
| high-risk target tests | 通过，8 files / 222 tests |
| PhotoGrid/ReycleBin/Detail/DuplicateCarousel merge tests | 通过，5 files / 174 tests |

## 最新增量验证（2026-05-18）

本次增量新增 `MediaFrame` primitive，将媒体预览背景、裁剪和媒体圆角统一收敛到 `src/theme/tokens/app.tokens.json` 中的 `primitives.radius.media`。`VideoPlayer` 使用 preview 变体保持原有深色圆角媒体框，`ZoomableImage` 通过 `Animated.createAnimatedComponent(MediaFrame)` 使用 transparent 变体，保留原有全幅手势舞台视觉。

i18n governance 也补齐 generated drift check：`verify:i18n:resources` 现在会确认 `src/i18n/resources.generated.ts` 与 `src/i18n/locales/**/*.json` 同步；若 drift，应先跑 `npm run generate:i18n:resources`。

UI composition governance 继续收紧 non-consumer 分类：剩余 9 个 non-consumer 必须显式归类为 helper、hook、controller、thin-wrapper 或 barrel，并通过无渲染 UI、只委托 `DetailScreen` 或只 re-export 的结构约束；不能把真实 UI 文件随意加入豁免清单。

随后继续提升 RNR/primitive 复用率：新增 `IconButton` primitive，将 icon-only action 的 size/radius 收敛到 `primitives.spacing.iconButtonSize` 和 `primitives.radius.iconButton`，并迁移 `PhotoGridWorkspace` 的返回/关闭按钮、`DetailScreen` 的 overlay 关闭按钮、`RecycleBinScreen` 的返回/关闭按钮。`RecycleBinScreen` 顶部选择切换和底部恢复/清理操作也改回 `Button` primitive，同时显式保留原紧凑 padding、边框和危险按钮视觉；`verify:ui-composition` 现在禁止 `RecycleBinScreen` 直接组合 `TouchSurface`。

本轮继续补齐基础 primitive token coverage：`Badge` 的 minHeight、padding、border width，`Progress` 的 height、border width，以及 `TouchSurface` 的 press retention 和 pressed scale/opacity 已进入 `primitives.spacing` / `primitives.interaction` 并由 `primitive-tokens.generated.ts` 输出。`verify:ui-composition` 会阻止 `Badge` / `Progress` / `TouchSurface` 回退到本地硬编码尺寸或交互反馈。

| 命令 | 结果 |
| --- | --- |
| `npm run verify:maintainability` | 通过，基础治理门禁聚合执行 |
| `npm run verify:i18n:resources` | 通过，9 namespaces，generated output 无 drift |
| `node scripts/i18n/generate-i18n-resources.mjs --check` | 通过，`resources.generated.ts` 与 locale JSON 同步 |
| `npm run verify:theme:tokens` | 通过 |
| `npm run verify:nativewind-rnr` | 通过 |
| `npm run verify:ui-composition` | 通过，29/38 总覆盖，29/29 视觉覆盖，9 个 non-consumer 已分类 |
| `npm run verify:high-risk-leaf-boundary` | 通过 |
| `npm run verify:maintainability-plan` | 通过，16 tasks / 16 task files |
| `npm run typecheck` | 通过 |
| `npm run test -- --run` | 通过，116 files / 1427 tests |
| `npm run export:android` | 通过，Android bundle 1631 modules |
| `git diff --check` | 通过 |

### IconButton 增量验证（2026-05-18）

| 命令 | 结果 |
| --- | --- |
| `npm run verify:theme:tokens` | 通过，`primitive-tokens.generated.ts` 已包含 `Badge` / `Progress` / `TouchSurface` / `IconButton` token |
| `npm run verify:ui-composition` | 通过，强制 `IconButton` export、token-backed size/radius、PhotoGridWorkspace 无手写 `Pressable` icon button |
| `npm run test -- --run src/ui/primitives/__tests__/primitive-style-contract.test.tsx` | 通过，1 file / 8 tests |
| `npm run test -- --run src/ui/primitives/__tests__/primitive-style-contract.test.tsx src/theme/app-theme.test.ts` | 通过，3 files / 19 tests |
| `npm run test -- --run src/ui/primitives/__tests__/primitive-style-contract.test.tsx src/ui/screens/__tests__/DetailScreen.test.tsx src/ui/screens/__tests__/RecycleBinScreen.test.tsx src/ui/screens/__tests__/PhotoGridScreen.test.tsx` | 通过，7 files / 187 tests |
| `npm run typecheck` | 通过 |

### Component Token 增量验证（2026-05-18）

`ActivityLoadingFallback` 的 Activity fallback skeleton contract 也完成文件化：screen/detail 两种 surface 的 skeleton 尺寸、detail 黑底和白色 spinner 都进入 `components.activityLoadingFallback`。这让 Activity fallback 到 skeleton 的视觉边界和业务 surface 保持可读、可校验。

`CandidateCard` 也进入 component token governance：卡片半径/边框/padding/gap/阴影、缩略图尺寸、pill/action geometry、typography 和理由展示上限都迁入 `components.candidateCard`。组件继续使用 `Card` / `Badge` / `Button` / `Text` / `TouchSurface` primitives，打开、选择、回收模式和候选文案语义保持不变。

`PreviewModal` 完成同类迁移：modal header/content/media/panel/pill/action 的尺寸、圆角、间距和字重进入 `components.previewModal`，组件使用 `MediaFrame` 承载预览媒体，关闭、恢复/移入回收站、永久删除和图片/视频展示行为保持不变。

`ActionSwitch` 原先在组件内部维护 `ACTION_SWITCH_STYLE_TOKENS`。本次将该视觉 contract 迁移到 `src/theme/tokens/app.tokens.json` 的 `components.actionSwitch`，由 `scripts/theme/generate-theme-tokens.mjs` 输出 `src/theme/generated/component-tokens.generated.ts`。组件继续导出 `ACTION_SWITCH_STYLE_TOKENS` 兼容测试和调用方，但值来自 generated component tokens。

`SegmentedControl` 也完成同类迁移：原本散落在组件内的 16/14/12 层级、按钮高度、padding、gap、radius、selected count 颜色，现在进入 `components.segmentedControl`，由同一个 `component-tokens.generated.ts` 输出。`verify:ui-composition` 已阻止该组件重新引入本地尺寸常量或 selected count 硬编码颜色。

`ScanCounter` 的 status typography 也迁入 `components.scanCounter`，组件继续导出 `SCAN_COUNTER_STYLE_TOKENS` 兼容测试，但值来自 generated component tokens。`verify:ui-composition` 已阻止该组件回退到本地硬编码 style token。

`SelectionBar` 完成同类迁移：selection toolbar 的间距、按钮半径、按钮 border、禁用透明度和 count/action typography 进入 `components.selectionBar`，由 `component-tokens.generated.ts` 输出。组件仍保持 `Button` / `Text` primitive 组合和原有选择/清理行为。

`TabBar` 也进入 component token governance：safe-area 最小底部留白、tab bar 高度、icon 尺寸、触控下限、badge geometry、badge max count 和 label/badge 字重都迁入 `components.tabBar`。导航 badge 的显示逻辑仍保持原有 `0/undefined 不展示，超过 99 显示 99+` 语义。

`ScanProgress` 完成安全子集迁移：pipeline 尺寸、active/done/glow/wake/shimmer 颜色、卡片半径/间距、badge/cancel typography 和 motion duration/opacity 都迁入 `components.scanProgress`。扫描进度百分比、完成态、取消行为和结果 badge 的业务状态逻辑保持不变。

Skeleton 视觉 contract 同步收紧：`Skeleton` primitive 和各模块 skeleton 容器均保持无边框灰块，并用 directional shimmer 代替带边框的静态占位；`PhotoGridSkeleton` 区分 `permissionChecking` 与 `scanReady`，授权已确认但媒体枚举未完成时跳过权限骨架，进入已授权待扫描骨架。回收站 Tab badge 也固定在 icon box 的右上角，避免随 tab label 或 badge 内容漂移。

| 命令 | 结果 |
| --- | --- |
| `npm run verify:theme:tokens` | 通过，新增验证 `component-tokens.generated.ts` 无 drift |
| `npm run verify:ui-composition` | 通过，禁止 `ActivityLoadingFallback` / `CandidateCard` / `PreviewModal` / `ActionSwitch` / `SegmentedControl` / `ScanCounter` / `SelectionBar` / `TabBar` / `ScanProgress` 回退到本地硬编码 style tokens，并校验所有 skeleton 无边框与 PhotoGrid skeleton 状态边界 |
| `npm run verify:maintainability` | 通过，i18n generated check、theme tokens、i18n resources、NativeWind/RNR infra、UI composition、high-risk boundary、plan governance、TypeScript 全部通过 |
| `npm run test -- --run src/ui/__tests__/CandidateCard.test.tsx` | 通过，1 file / 1 test |
| `npm run test -- --run src/ui/__tests__/PreviewModal.test.tsx` | 通过，1 file / 1 test |
| `npm run test -- --run src/ui/components/__tests__/ActivityLoadingFallback.test.tsx` | 通过，1 file / 2 tests |
| `npm run test -- --run src/ui/components/__tests__/ActionSwitch.test.tsx` | 通过，2 files / 7 tests |
| `npm run test -- --run src/ui/components/__tests__/SegmentedControl.test.tsx` | 通过，2 files / 45 tests |
| `npm run test -- --run src/ui/components/__tests__/ScanCounter.test.tsx` | 通过，2 files / 49 tests |
| `npm run test -- --run src/ui/components/__tests__/SelectionBar.test.tsx` | 通过，2 files / 31 tests |
| `npm run test -- --run src/navigation/__tests__/TabBar.test.tsx` | 通过，2 files / 45 tests |
| `npm run test -- --run src/ui/components/__tests__/ScanProgress.test.tsx` | 通过，2 files / 17 tests |
| `npm run test -- --run src/ui/__tests__/CandidateCard.test.tsx src/ui/components/__tests__/ActivityLoadingFallback.test.tsx src/ui/components/__tests__/ActionSwitch.test.tsx src/ui/components/__tests__/SegmentedControl.test.tsx src/ui/components/__tests__/ScanCounter.test.tsx src/ui/components/__tests__/SelectionBar.test.tsx src/navigation/__tests__/TabBar.test.tsx src/ui/components/__tests__/ScanProgress.test.tsx` | 通过，14 files / 197 tests |
| `npm run test -- --run src/ui/skeletons/__tests__/SkeletonBlock.test.tsx src/navigation/__tests__/TabBar.test.tsx src/ui/screens/__tests__/PhotoGridScreen.test.tsx src/ui/__tests__/PreviewModal.test.tsx` | 通过，6 files / 168 tests |

### MediaViewer Component Token 增量验证（2026-05-19）

`VideoPlayer` 和 `ZoomableImage` 的媒体查看参数进入 `components.mediaViewer`：视频 fallback aspect ratio、最小 aspect ratio、缩放默认上下限、手势 overshoot/undershoot 因子和回弹动画时长均从 `component-tokens.generated.ts` 读取。新增 `src/ui/components/media-viewer-tokens.ts` 作为共享 token facade；`VideoPlayer` 保持 `MediaFrame` preview 容器，`ZoomableImage` 保持 transparent animated `MediaFrame` 手势根节点，不触碰扫描、识别、删除或权限状态流。

`verify:ui-composition` 同步收紧：禁止 `VideoPlayer` 回退到 `16 / 9` 或 `0.5` 本地比例；禁止 `ZoomableImage` 回退到 `3`、`1`、`0.5`、`1.1`、`150ms` 本地手势参数；`media-viewer-tokens.ts` 作为 helper facade 显式分类，视觉 primitive 覆盖仍保持 `29/29`。

| 命令 | 结果 |
| --- | --- |
| `npm run verify:theme:tokens` | 通过，`component-tokens.generated.ts` 已包含 `components.mediaViewer` |
| `npm run verify:ui-composition` | 通过，29/39 production UI files，29/29 visual primitive coverage，10 categorized non-consumers |
| `npm run test -- --run src/ui/components/__tests__/VideoPlayer.test.tsx src/ui/components/__tests__/ZoomableImage.test.tsx` | 通过，3 files / 18 tests |
| `npm run test -- --run src/ui/__tests__/CandidateCard.test.tsx src/ui/__tests__/PreviewModal.test.tsx src/ui/components/__tests__/ActivityLoadingFallback.test.tsx src/ui/components/__tests__/VideoPlayer.test.tsx src/ui/components/__tests__/ZoomableImage.test.tsx src/ui/components/__tests__/ActionSwitch.test.tsx src/ui/components/__tests__/SegmentedControl.test.tsx src/ui/components/__tests__/ScanCounter.test.tsx src/ui/components/__tests__/SelectionBar.test.tsx src/navigation/__tests__/TabBar.test.tsx src/ui/components/__tests__/ScanProgress.test.tsx` | 通过，18 files / 216 tests |
| `npm run verify:maintainability` | 通过，i18n generated check、theme tokens、i18n resources、NativeWind/RNR infra、UI composition、high-risk boundary、plan governance、TypeScript 全部通过 |
| `npm run export:android` | 通过，Android bundle 1632 modules，输出 `dist/_expo/static/js/android/index-cdcc503b19d22c1fa53651146fe9f90b.hbc` |
| `git diff --check` | 通过 |

### DuplicateCarousel Component Token 增量验证（2026-05-19）

`DuplicateCarousel` 的默认舞台尺寸、滑动窗口复用槽数量、左右导航按钮尺寸、位置、图标尺寸和 pressed/normal 背景色进入 `components.duplicateCarousel`。组件导航从直接组合 `TouchSurface` 改为 `IconButton` primitive，保留原来的左右切换、windowed viewer、视频 inactive 暂停和图片 native slot 复用逻辑。

`verify:ui-composition` 同步阻止回退：不允许重新出现 `width - 32`、`1.45`、`46px`、`18px`、`12px`、本地 rgba 导航色或直接导入 `TouchSurface` 作为 carousel nav。测试补充 `DUPLICATE_CAROUSEL_STYLE_TOKENS` 指向 generated component tokens 的断言，并继续验证 100 项 windowed media 的挂载数量与视频复用。

| 命令 | 结果 |
| --- | --- |
| `npm run verify:theme:tokens` | 通过，`component-tokens.generated.ts` 已包含 `components.duplicateCarousel` |
| `npm run verify:ui-composition` | 通过，阻止 DuplicateCarousel 回退到本地 carousel 参数或手写 TouchSurface nav |
| `npm run test -- --run src/ui/components/__tests__/DuplicateCarousel.test.tsx` | 通过，2 files / 12 tests |
| `npm run test -- --run src/ui/__tests__/CandidateCard.test.tsx src/ui/__tests__/PreviewModal.test.tsx src/ui/components/__tests__/ActivityLoadingFallback.test.tsx src/ui/components/__tests__/VideoPlayer.test.tsx src/ui/components/__tests__/ZoomableImage.test.tsx src/ui/components/__tests__/DuplicateCarousel.test.tsx src/ui/components/__tests__/ActionSwitch.test.tsx src/ui/components/__tests__/SegmentedControl.test.tsx src/ui/components/__tests__/ScanCounter.test.tsx src/ui/components/__tests__/SelectionBar.test.tsx src/navigation/__tests__/TabBar.test.tsx src/ui/components/__tests__/ScanProgress.test.tsx` | 通过，20 files / 228 tests |
| `npm run verify:maintainability` | 通过，i18n generated check、theme tokens、i18n resources、NativeWind/RNR infra、UI composition、high-risk boundary、plan governance、TypeScript 全部通过 |
| `npm run export:android` | 通过，Android bundle 1632 modules，输出 `dist/_expo/static/js/android/index-32775dea08ddf6331b82ec882870eef1.hbc` |
| `git diff --check` | 通过 |

### PhotoGrid Component Token 增量验证（2026-05-19）

`PhotoGrid` item 视觉 contract 进入 `components.photoGrid`：列表 edge padding、tile radius/border/pressed shadow、视频角标位置/尺寸/颜色/typography、重复数量 badge、选择空心圈/选中圈/勾选图标尺寸和阴影均由 `component-tokens.generated.ts` 输出。组件仍保留原来的 `FlatList` 虚拟化参数、`useSwipeSelection`、长按选择、点击进入详情、图片/视频缩略图解析和 duplicate group 计数逻辑。

`verify:ui-composition` 同步阻止回退：不允许重新出现 `SIZE_SMALL = 12`、`18/24` 选择圈、`16/18` tile radius、`23/25` 视频角标高度、本地 rgba 角标色、重复 badge 红色或选中蓝色等本地硬编码 marker。PhotoGrid 测试补充 `PHOTO_GRID_STYLE_TOKENS` 指向 generated component tokens 的断言，并继续覆盖视频 SVG、选择圈视觉和安全 decode sizing。

| 命令 | 结果 |
| --- | --- |
| `npm run verify:theme:tokens` | 通过，`component-tokens.generated.ts` 已包含 `components.photoGrid` |
| `npm run verify:ui-composition` | 通过，阻止 PhotoGrid 回退到本地 tile/video/duplicate/selection 视觉参数 |
| `npm run test -- --run src/ui/components/__tests__/PhotoGrid.test.tsx src/ui/components/__tests__/PhotoGridItem-selection.test.tsx` | 通过，4 files / 82 tests |
| `npm run test -- --run src/ui/__tests__/CandidateCard.test.tsx src/ui/__tests__/PreviewModal.test.tsx src/ui/components/__tests__/ActivityLoadingFallback.test.tsx src/ui/components/__tests__/VideoPlayer.test.tsx src/ui/components/__tests__/ZoomableImage.test.tsx src/ui/components/__tests__/DuplicateCarousel.test.tsx src/ui/components/__tests__/PhotoGrid.test.tsx src/ui/components/__tests__/PhotoGridItem-selection.test.tsx src/ui/components/__tests__/ActionSwitch.test.tsx src/ui/components/__tests__/SegmentedControl.test.tsx src/ui/components/__tests__/ScanCounter.test.tsx src/ui/components/__tests__/SelectionBar.test.tsx src/navigation/__tests__/TabBar.test.tsx src/ui/components/__tests__/ScanProgress.test.tsx` | 通过，24 files / 310 tests |
| `npm run verify:maintainability` | 通过，i18n generated check、theme tokens、i18n resources、NativeWind/RNR infra、UI composition、high-risk boundary、plan governance、TypeScript 全部通过 |
| `npm run export:android` | 通过，Android bundle 1632 modules，输出 `dist/_expo/static/js/android/index-49cb65aefef2b39264af46b65342ebd3.hbc` |
| `git diff --check` | 通过 |

## Android 设备验证状态

| 命令 | 状态 | 说明 |
| --- | --- | --- |
| `npm run observability:device:doctor -- --serial d28739dc` | 通过 | 真机 `M2102J2SC` 在线，serial `d28739dc`，agent-device / adb 通信正常 |
| `npm run export:android` | 通过 | Expo Android bundle 成功，`index.ts` 1632 modules，输出 `dist/_expo/static/js/android/index-49cb65aefef2b39264af46b65342ebd3.hbc` |
| `npm run build:android:debug` | 通过 | 生成 `android/app/build/outputs/apk/debug/app-debug.apk`，Gradle `BUILD SUCCESSFUL in 3m 55s` |
| `npm run verify:android:observability -- --serial d28739dc --app-id com.jt.mistapmediacleaner.debug --artifact-root artifacts/agent-device/refactor-ui-candidate-card-capture` | 通过 | debug APK 安装并打开成功，生成 snapshot / interactive snapshot / screenshot / perf 证据 |
| `npm run verify:android:recycle` | blocked | 本轮未跑 recycle 业务流；需在真机上按模块验收时继续执行 |
| `npm run verify:android:recycle-delete` | blocked | 本轮未跑 recycle-delete 业务流；需在真机上按模块验收时继续执行 |
| `npm run verify:device:lane:android:emulator-core -- --serial <serial>` | not run | 需要显式 emulator serial |
| `npm run verify:device:lane:android:real-device-core -- --serial d28739dc` | not run | 真实设备已在线，但完整 real-device core lane 尚未执行 |

这些 blocked / not run 项不是代码失败。后续按 `docs/testing/android-stable-maintainability-gates.md` 继续跑模块级业务验收并补充证据。

`adb devices -l` 当前可识别真机：`d28739dc device usb:8-3 product:thyme model:M2102J2SC device:thyme transport_id:8`。

本轮真机最小观测证据目录：

- `artifacts/agent-device/refactor-ui-candidate-card-capture/20260518-225211/snapshot.json`
- `artifacts/agent-device/refactor-ui-candidate-card-capture/20260518-225211/snapshot-interactive.json`
- `artifacts/agent-device/refactor-ui-candidate-card-capture/20260518-225211/current-screen.png`
- `artifacts/agent-device/refactor-ui-candidate-card-capture/20260518-225211/perf.json`

## 构建产物

- Debug APK: `android/app/build/outputs/apk/debug/app-debug.apk`
- Signing report: `artifacts/android-debug/app-debug.signing.txt`
- Metadata: `artifacts/android-debug/debug-metadata.json`

`android/` 和 `artifacts/` 当前由 `.gitignore` 忽略，属于本地验证产物。

## 最新增量验证（2026-05-21）

本次增量没有重开新的重构目标，而是把最后一个用户可见但未纳入 primitive governance 的 fallback surface 收口：`src/application/AppErrorBoundary.tsx` 现在通过 `Card` / `Text` / `Button` primitive 组合渲染错误态，避免继续保留手写 `Pressable` 和局部硬编码视觉。

同时，配套门禁也已收紧：`verify:ui-composition` 现在会显式校验 `AppErrorBoundary` 必须消费 `src/ui/primitives`，并禁止回退到原生 `Pressable` fallback。`AppErrorBoundary` 对应测试也已更新为匹配 primitive 组合后的渲染树。

| 命令 | 结果 |
| --- | --- |
| `npm run test -- --run src/application/__tests__/AppErrorBoundary.test.tsx` | 通过，1 file / 1 test |
| `npm run verify:maintainability` | 通过，i18n generated check、theme tokens、i18n resources、NativeWind/RNR infra、UI composition、high-risk boundary、plan governance、TypeScript 全部通过 |
| `npm run verify:ui-composition` | 通过，29/39 production UI files，29/29 visual primitive coverage，10 categorized non-consumers |
| `npm run typecheck` | 通过 |

按当前门禁定义，这轮 Option B 重构目标已经完成。剩余 10 个 non-consumer 仍然是 helper / hook / controller / thin-wrapper / barrel 类文件，不属于需要直接消费 primitive 的视觉 UI 面。

## 后续 TODO

1. 连接 emulator 或真机后重跑 `verify:android:recycle` 和 `verify:android:recycle-delete`。
2. 若后续继续迁移高风险 UI，只从 `SelectionBar`、`ScanCounter`、`ActionSwitch` 等 leaf 控件开始，并先跑 `verify:high-risk-leaf-boundary`。
3. 若新增 primitive 或 component token，先改 `app.tokens.json`，再跑 generator/verifier，不手改 generated 文件。
4. 若新增 copy，先改 locale JSON，再跑 `npm run generate:i18n:resources` 和 `npm run verify:i18n:resources`，不在 screen 内硬编码英文 fallback，也不手改 `resources.generated.ts`。

## 最新增量验证（2026-05-21 / Landing token 化）

本次增量继续推进 `P2 theme migration waves`：先收 `LandingScreen` 和 `LandingSkeleton` 这一条低风险但用户可见的装饰色链路。此前两处仍保留多组 `rgba(...)` 和单点 `#18bf63`，并依赖 `theme.scheme === 'dark' ? ... : ...` 在组件内直接分支。

现在这些装饰色和透明度已进入 `components.landing`，由 `src/theme/tokens/app.tokens.json` 生成到 `src/theme/generated/component-tokens.generated.ts`，`LandingScreen` / `LandingSkeleton` 通过 `COMPONENT_TOKENS.landing` 读取。`LandingScreen` 的“已授权”状态图标也改为复用 `theme.buttonSuccessBackground`，不再手写绿色常量。

同时，`verify:ui-composition` 对 Landing 这条线也补了防回退约束：如果重新引入原来的 `rgba(64, 92, 175, 0.12)`、`rgba(136, 158, 255, 0.12)` 等装饰色 marker，门禁会直接失败。

本次还顺手修了 shared primitive 暴露后的一个稳定性问题：`use-foldable-state` 不再在模块加载阶段直接依赖 `Dimensions` export。这样 `FoldableLayout` 进入 shared primitive index 之后，不会因为 import-time 设备读取把无关测试拖红。

| 命令 | 结果 |
| --- | --- |
| `node scripts/theme/generate-theme-tokens.mjs` | 通过，重新生成 theme/component/nativewind/tailwind outputs |
| `npm run verify:theme:tokens` | 通过 |
| `npm run test -- --run src/ui/screens/__tests__/LandingScreen.test.tsx` | 通过，2 files / 6 tests |
| `npm run test -- --run src/ui/screens/__tests__/LandingScreen.test.tsx src/ui/components/FoldableLayout.test.tsx src/ui/primitives/__tests__/primitive-style-contract.test.tsx` | 通过，5 files / 33 tests |
| `npm run verify:maintainability` | 通过 |

## 最新增量验证（2026-05-21 / preference owner 收口）

本次增量继续处理 `P2.6 AppPreferences ownership` 的遗留项：`src/application/MediaCleanerApp.tsx` 不再自己读取 `app-language` / `theme-preference` storage，也不再直接依赖 `useColorScheme()`。语言、主题、resolved scheme、copy 和 theme 现在统一复用 `src/application/AppPreferencesContext.tsx` 导出的共享 preference owner。

这次没有改变 `MediaCleanerApp` 的业务功能，只消除了第二套 theme/language 状态机，避免历史入口继续漂出 `AppPreferencesContext` 的治理边界。配套地，`verify:ui-composition` 也补了防回退检查：若 `MediaCleanerApp` 重新引入 `loadAppLanguage`、`saveAppLanguage`、`loadThemePreference`、`saveThemePreference` 或 `useColorScheme()`，门禁会直接失败。

| 命令 | 结果 |
| --- | --- |
| `npm run test -- --run src/application/AppPreferencesContext.test.tsx` | 通过，2 files / 5 tests |
| `npm run typecheck` | 通过 |

## 最新增量验证（2026-05-21 / Detail + Settings token 化）

本次增量继续沿 `P2 theme migration waves` 收敛仍然留在 screen/skeleton 内部的 raw color。此前 `DetailScreen` / `DetailSkeleton` 还直接写死了详情页黑底、关闭按钮透明白底和 tag 红黄灰色；`SettingsScreen` / `SettingsSkeleton` 仍然在组件内部按 `theme.scheme` 分支手写底色、卡片边框、四组 icon 底色、scan/reminder/language active chip 色以及清理按钮色。

现在这两条线都已经进入 file-backed component tokens：

- `components.detail`：收敛详情页背景、关闭按钮、tag danger/warning/neutral/text 色
- `components.settings`：收敛设置页浅色底、浅色卡片边框、四组 icon 背景、scan/reminder/language active chip 背景与边框、清理按钮背景与文字色，以及 card/overview shadow opacity

对应地，`DetailScreen` / `DetailSkeleton` 通过 `COMPONENT_TOKENS.detail` 读取 overlay 视觉；`SettingsScreen` / `SettingsSkeleton` 通过 `COMPONENT_TOKENS.settings` 读取底色、chip 和按钮色。`verify:ui-composition` 也补了防回退约束：如果重新引入 `#ff3b30`、`#f7f9fd`、`#4a242c` 这类历史 marker，门禁会直接失败。

| 命令 | 结果 |
| --- | --- |
| `node scripts/theme/generate-theme-tokens.mjs` | 通过，重新生成 component/nativewind/tailwind outputs |
| `npm run verify:theme:tokens` | 通过 |
| `npm run verify:ui-composition` | 通过，29/39 production UI files，29/29 visual primitive coverage，10 categorized non-consumers |
| `npm run test -- --run src/ui/screens/__tests__/DetailScreen.test.tsx src/ui/screens/__tests__/SettingsScreen.test.tsx` | 通过，4 files / 68 tests |
| `npm run typecheck` | 通过 |

## 最新增量验证（2026-05-21 / PhotoGridEntryCard token 化）

本次增量继续处理 `photoGrid` 体系里还留在本地文件的 entry-card 视觉 contract。此前 `PhotoGridEntryCard` 还直接手写了扫描进度环 track 色、扫描完成 result breakdown 的三组前景/底色、结果页 sparkle 装饰色，以及 fallback generic card 的 shadow opacity；同时还依赖局部 `#23b58f` 成功色和一串 light-mode fallback 色值。

现在这些剩余 contract 已进入 `components.photoGrid.entryCard`，由 `src/theme/tokens/app.tokens.json` 生成到 `src/theme/generated/component-tokens.generated.ts`，并通过 `PHOTO_GRID_ENTRY_CARD_STYLE_TOKENS` 暴露给 `PhotoGridEntryCard`。组件内部不再保留原来的 `#1e3769`、`#ff9f2e`、`#dce8ff` 这类局部 marker；成功态图标和主按钮前景也改为复用 theme palette，而不是在组件内再抄一份颜色。

配套地，`verify:ui-composition` 已补充对 `COMPONENT_TOKENS.photoGrid.entryCard` 的强制检查，并阻止原先的 progress/result/sparkle 硬编码色回退。测试侧新增 `PhotoGridEntryCard.test.tsx`，直接验证 entry-card token facade、result breakdown 配色、progress track light/dark 分支和 generic fallback shadow opacity。

| 命令 | 结果 |
| --- | --- |
| `node scripts/theme/generate-theme-tokens.mjs` | 通过，重新生成 photoGrid entry-card token outputs |
| `npm run verify:theme:tokens` | 通过 |
| `npm run verify:ui-composition` | 通过，29/39 production UI files，29/29 visual primitive coverage，10 categorized non-consumers |
| `npm run test -- --run src/ui/screens/photo-grid/__tests__/PhotoGridEntryCard.test.tsx src/ui/screens/__tests__/PhotoGridScreen.test.tsx` | 通过，3 files / 123 tests |

## 最新增量验证（2026-05-21 / overlay + icon defaults 收口）

本次增量继续把剩余零散 contract 从“局部常量”压回 file-backed governance。覆盖三块：

1. `IconButton` 的 `overlay` variant 不再直接写 `rgba(255, 255, 255, 0.14 / 0.22)`，而是改为消费 `PRIMITIVE_TOKENS.color.iconButtonOverlayBackground` 和 `iconButtonOverlayPressedBackground`
2. `DuplicateCarousel` / `PhotoGridWorkspace` / `RecycleBinScreen` 里残留的白色或红色前景统一改回 theme palette，避免再抄一份按钮前景/危险色
3. `RecycleBinScreen` 的 summary shadow 半透明色进入 `components.recycleBin`

同时，`DesignIcon` / `SvgProcessRing` 的默认色不再保留局部 hex fallback，`StackIcon` 内部的白色 path 也回到 `secondaryColor`。这样 `src/ui` 生产代码里已经扫不到本地 `hex/rgba` 颜色字面量；`verify:ui-composition` 也新增了对 `DesignIcon` 默认色 marker 的防回退检查。

| 命令 | 结果 |
| --- | --- |
| `rg -n "rgba\\(|#[0-9A-Fa-f]{3,8}" src/ui --glob '!**/__tests__/**' --glob '!**/*.test.*'` | 无结果，`src/ui` 生产代码无本地 hex/rgba marker |
| `npm run test -- --run src/ui/icons/__tests__/DesignIcon.test.tsx src/ui/primitives/__tests__/primitive-style-contract.test.tsx src/ui/components/__tests__/DuplicateCarousel.test.tsx src/ui/screens/photo-grid/__tests__/PhotoGridEntryCard.test.tsx src/ui/screens/__tests__/PhotoGridScreen.test.tsx src/ui/screens/__tests__/RecycleBinScreen.test.tsx src/ui/screens/__tests__/LandingScreen.test.tsx src/ui/screens/__tests__/SettingsScreen.test.tsx` | 通过，13 files / 241 tests |
| `npm run build:android:debug:arm64` | 通过，输出 `/Users/jt/places/personal/app-cleaner/android/app/build/outputs/apk/debug/app-debug.apk` |
| `npm run verify:maintainability` | 通过，i18n/theme/nativewind/ui-composition/high-risk/typecheck 全部通过 |
