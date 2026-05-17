# Android 依赖体积盘点

## 背景

本次盘点目标不是泛泛删依赖，而是回答三个问题：

1. 哪些 direct dependency 当前没有 runtime import。
2. 哪些依赖虽然可按需加载，但不会减少 APK 下载体积。
3. 后续新增依赖时应该如何提前判断包体积风险。

## 当前扫描结果

最新扫描：

```bash
npm run analyze:android:deps
```

结果：`ok: true`，扫描 `137` 个 source files，`suspicious: []`。当前没有新的“顶层依赖存在但无 runtime import / config plugin / allowlist 解释”的可安全删除项。

已移除的直接依赖：

| 依赖 | 结论 | 处理 |
| --- | --- | --- |
| `@shopify/flash-list` | `src/` 下无 import，当前列表仍使用普通 RN 组件 | 移除 |
| `form-data` | 无 runtime import，自定义 FormData shim 不依赖该包 | 移除 |
| `react-native-polyfill-globals` | 无 import，当前只使用本地 `src/utils/formdata-polyfill.ts` | 移除 |

保留但需要解释的依赖：

| 依赖 | 保留原因 |
| --- | --- |
| `expo-splash-screen` | `app.json` 正在通过 config plugin 配置启动图 |
| `expo-system-ui` | `app.json` 的 `userInterfaceStyle: automatic` 需要它生成原生 system UI 行为；构建日志已验证缺失会产生警告 |
| `react-native-screens` | React Navigation native stack / bottom tabs 的运行依赖 |
| `expo-video` | 详情页、重复媒体 carousel、预览 modal 需要视频播放 |
| `expo-video-thumbnails` | 视频分析需要抽帧 |
| `expo-image-manipulator` | 图像 / 视频帧降采样分析需要 |
| `expo-sqlite` | operational store 已使用动态 import，但 native SQLite 仍会进入 APK |
| `base64-js` / `buffer` / `jpeg-js` | `analyze-visuals.ts` 当前用于 JPEG 指标解析 |

## 按需加载判断

可以按需加载但不直接减少 APK 的部分：

1. `expo-video` 的播放器组件可以延迟到详情 / 预览路径渲染，减少启动初始化压力。
2. `expo-image-manipulator`、`expo-video-thumbnails`、`jpeg-js`、`buffer`、`base64-js` 可以在视觉分析路径动态 import，减少非扫描路径的 JS 初始化。
3. `expo-sqlite` 已在 `operational-store.ts` 中动态 import，这是正确方向。

已完成的实测补充：

1. 当前 JS bundle 为 2.207 MiB，低于 5 MiB warning 预算。
2. `arm64-v8a` 单 ABI 实测 35.558 MiB，说明继续瘦身的主要空间仍在 ABI。
3. R8 / resource shrink 双 ABI 实测 40.642 MiB，主要收益来自 dex，而不是 JS lazy load。
4. `arm64-v8a` + R8 / resource shrink 组合实测 28.909 MiB，但必须先完成设备矩阵和真机回归。

不会因为 JS 动态 import 而减少 APK 下载体积的部分：

1. 已安装并 autolink 的 Expo / RN native module。
2. Hermes、React Native runtime、Expo modules core。
3. image / video codec 的 native `.so`。

因此 APK 下载体积的高价值动作仍然是：

1. 移除未使用的 direct dependency。
2. 控制 ABI。
3. 评估 `expo.useLegacyPackaging`、R8、resource shrink。
4. 对新增 native dependency 做 APK delta 证明。

## 后续行动项

1. 若后续发现首页启动时间或非扫描路径 JS 初始化偏重，再把 `analyze-visuals.ts` 的 image/video/JPEG 依赖改为动态 import；不要把它当成 APK 主瘦身手段。
2. 若视频预览不是首屏必要能力，可把 `VideoPlayer` 边界收敛到单一组件，并保持测试里只 mock 该边界。
3. 若列表规模继续扩大，需要重新评估 `@shopify/flash-list`，但必须以真实滚动性能和 APK 增量作为准入依据。
4. 下一次 Android release 后，对比 `apk-size-report.md` 中 native libs 是否因为移除其他未使用依赖发生变化。
