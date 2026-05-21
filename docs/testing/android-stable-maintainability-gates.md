# Android 稳定后可维护性重构验证门禁

更新时间：2026-05-21

本文件记录本轮 RNR / Tailwind / tokens / i18n / skeleton 渐进式升级后的最低门禁。后续任务拆分时，不能只跑局部测试；至少要按触达范围选择下面的门禁组合。

## 基础门禁

一键基础门禁：

```bash
npm run verify:maintainability
```

该命令覆盖下表中除 Android 设备验证外的基础治理项。触达具体 UI 或业务模块时，仍需追加对应测试组合和 Android 门禁。

| 范围 | 命令 | 通过标准 |
| --- | --- | --- |
| maintainability aggregate | `npm run verify:maintainability` | i18n generated check、theme tokens、i18n resources、NativeWind/RNR infra、UI composition、high-risk boundary、plan governance、TypeScript 全部通过 |
| theme tokens | `npm run verify:theme:tokens` | generated theme、NativeWind vars、primitive tokens、component tokens、skeleton tokens、Tailwind fragment 无 drift |
| i18n resources | `npm run verify:i18n:resources` | zh/en 9 个 namespace key 完整，`src/i18n/resources.generated.ts` 与 locale JSON 无 drift，且生产 `src/**/*.ts(x)` 不允许出现非 locale/generated 的中文文案 |
| NativeWind/RNR infra | `npm run verify:nativewind-rnr` | Metro resolver patch、Babel plugin 顺序、Tailwind token import、global CSS 入口均存在 |
| UI composition | `npm run verify:ui-composition` | RNR-style primitives 导出完整；视觉 UI 文件必须消费 `src/ui/primitives`；Badge、Progress、TouchSurface、IconButton 等基础 primitive 必须由文件化 token 驱动；Skeleton primitive 与所有 skeleton 容器必须无边框并保留 directional shimmer；ActivityLoadingFallback、CandidateCard、PreviewModal、MediaViewer、DuplicateCarousel、PhotoGrid、ActionSwitch、SegmentedControl、ScanCounter、SelectionBar、TabBar、ScanProgress 等组件级视觉 contract 必须从 `component-tokens.generated.ts` 读取；VideoPlayer/ZoomableImage 必须通过共享 media viewer token facade 消费比例、缩放和回弹参数；DuplicateCarousel 必须通过 `IconButton` primitive 和 component token 消费舞台、windowing、导航参数；PhotoGrid item 必须通过 component token 消费 tile、视频角标、重复 badge 和选择圈视觉参数；PhotoGridEntryCard 的 progress track、result breakdown、sparkle 和 fallback shadow contract 必须通过 `components.photoGrid.entryCard` token 消费；DetailScreen / DetailSkeleton 的 overlay 底色、关闭按钮和 tag 色必须通过 `components.detail` token 消费；SettingsScreen / SettingsSkeleton 的底色、卡片边框、状态 chip 和清理按钮色必须通过 `components.settings` token 消费；LandingScreen / LandingSkeleton 的装饰色与透明度必须通过 `components.landing` token 消费，而不是手写 `rgba/hex`；PhotoGrid skeleton 必须区分 permissionChecking 与 scanReady；`AppErrorBoundary` fallback surface 也必须通过 `Card` / `Button` / `Text` primitive 组合，而不是手写 `Pressable`；`MediaCleanerApp` 不得再自行读取语言/主题 storage 或 `useColorScheme()`，必须复用共享 preference owner；非消费文件必须显式分类为 helper/hook/controller/thin-wrapper/barrel，并满足对应无渲染 UI、只委托或只 re-export 约束 |
| high-risk boundary | `npm run verify:high-risk-leaf-boundary` | PhotoGrid / RecycleBin / Detail 的关键 state/data/action marker 未丢失 |
| plan governance | `npm run verify:maintainability-plan` | 001-016 task、owner、depends-on、写范围、验证 alias 完整 |
| TypeScript | `npm run typecheck -- --pretty false` | 无 TS diagnostics |

## UI 测试组合

| 触达范围 | 命令 |
| --- | --- |
| primitive composition | `npm run verify:ui-composition` |
| primitive contract | `npm run test -- --run src/ui/primitives/__tests__/primitive-style-contract.test.tsx src/theme/app-theme.test.ts` |
| icon action primitive migration | `npm run test -- --run src/ui/primitives/__tests__/primitive-style-contract.test.tsx src/ui/screens/__tests__/DetailScreen.test.tsx src/ui/screens/__tests__/RecycleBinScreen.test.tsx src/ui/screens/__tests__/PhotoGridScreen.test.tsx` |
| component token migration | `npm run test -- --run src/ui/__tests__/CandidateCard.test.tsx src/ui/__tests__/PreviewModal.test.tsx src/ui/components/__tests__/ActivityLoadingFallback.test.tsx src/ui/components/__tests__/VideoPlayer.test.tsx src/ui/components/__tests__/ZoomableImage.test.tsx src/ui/components/__tests__/DuplicateCarousel.test.tsx src/ui/components/__tests__/PhotoGrid.test.tsx src/ui/components/__tests__/PhotoGridItem-selection.test.tsx src/ui/components/__tests__/ActionSwitch.test.tsx src/ui/components/__tests__/SegmentedControl.test.tsx src/ui/components/__tests__/ScanCounter.test.tsx src/ui/components/__tests__/SelectionBar.test.tsx src/navigation/__tests__/TabBar.test.tsx src/ui/components/__tests__/ScanProgress.test.tsx src/ui/screens/photo-grid/__tests__/PhotoGridEntryCard.test.tsx` |
| low-risk UI | `npm run test -- --run src/ui/screens/__tests__/SettingsScreen.test.tsx src/ui/screens/__tests__/LandingScreen.test.tsx src/ui/components/__tests__/ActionSwitch.test.tsx src/ui/components/__tests__/SegmentedControl.test.tsx` |
| skeleton foundation/bootstrap | `npm run test -- --run src/navigation/__tests__/RootNavigator.test.tsx src/ui/skeletons/__tests__/SkeletonBlock.test.tsx` |
| skeleton modules | `npm run test -- --run src/ui/screens/__tests__/LandingScreen.test.tsx src/ui/screens/__tests__/SettingsScreen.test.tsx src/ui/screens/__tests__/PhotoGridScreen.test.tsx src/ui/screens/__tests__/RecycleBinScreen.test.tsx src/ui/screens/__tests__/DetailScreen.test.tsx` |
| skeleton state and tab badge | `npm run test -- --run src/ui/skeletons/__tests__/SkeletonBlock.test.tsx src/navigation/__tests__/TabBar.test.tsx src/ui/screens/__tests__/PhotoGridScreen.test.tsx` |
| high-risk modules | `npm run test -- --run src/ui/screens/__tests__/PhotoGridScreen.test.tsx src/ui/screens/__tests__/RecycleBinScreen.test.tsx src/ui/screens/__tests__/DetailScreen.test.tsx src/ui/components/__tests__/PhotoGrid.test.tsx src/ui/components/__tests__/DuplicateCarousel.test.tsx src/ui/components/__tests__/SelectionBar.test.tsx src/ui/components/__tests__/ScanCounter.test.tsx src/ui/components/__tests__/ActionSwitch.test.tsx` |

## Android 门禁

| 命令 | 用途 | 当前状态记录规则 |
| --- | --- | --- |
| `npm run build:android:debug:arm64` | 确认 NativeWind/RNR infra 不破坏 Android debug build | 必须记录 APK 路径或失败原因 |
| `npm run verify:android:recycle` | 回收站主流程设备验证 | 无设备时记录为 blocked，不算通过 |
| `npm run verify:android:recycle-delete` | 回收站删除流程设备验证 | 无设备时记录为 blocked，不算通过 |
| `npm run verify:device:lane:android:emulator-core -- --serial <serial>` | emulator core lane | 需要显式 serial |
| `npm run verify:device:lane:android:real-device-core -- --serial <serial>` | real-device core lane | 需要显式真机 serial |

## 阻塞处置

1. 若 Node/Vitest/TypeScript 失败，先修到 green，再跑 Android。
2. 若 Android 命令提示未检测到设备，先 `adb devices` 确认 emulator/real device，再重跑；不要把设备缺失记成代码失败。
3. 若 high-risk boundary verifier 失败，先确认是否误删关键 testID/import/handler，再决定是否允许修改 screen；默认不允许整屏重写。
4. 若 theme/component generated 文件 drift，先跑对应 generator，再跑 verifier，不手改 generated 文件。
5. 若 i18n generated 文件 drift，先跑 `npm run generate:i18n:resources`，再跑 `npm run verify:i18n:resources`，不手改 `resources.generated.ts`。
