# 架构与诊断模型

## 目标

建立一个从“看到 APK 很大”到“知道该改哪一层”的诊断模型，避免把所有体积问题都归因到业务功能或 JS bundle。

## 分层模型

Android 包体积按以下层级诊断：

```text
Release Artifact
  APK / AAB
  debug / release
  signed / unsigned
  universal / ABI split

Native Runtime
  React Native runtime
  Hermes
  Expo modules
  image / video codecs
  SQLite
  custom native modules

Managed Runtime
  dex
  Kotlin / Java dependencies
  R8 / Proguard shrink result

JS Runtime
  assets/index.android.bundle
  embedded JS assets

Resources
  fonts
  PNG / WebP
  adaptive icons
  resources.arsc
```

本次样本证明最大层级是 Native Runtime。

## 实证数据

样本：

```text
artifacts/apk-size-analysis/android-latest.apk
102,513,501 bytes
```

按顶层目录：

| 类别 | 文件数 | 未压缩体积 | 压缩体积 |
| --- | ---: | ---: | ---: |
| lib | 92 | 77.37 MiB | 77.37 MiB |
| dex | 4 | 29.20 MiB | 10.91 MiB |
| res | 1306 | 5.94 MiB | 3.61 MiB |
| assets | 4 | 3.17 MiB | 3.17 MiB |
| resources.arsc | 1 | 1.63 MiB | 1.63 MiB |

按 ABI：

| ABI | 文件数 | 压缩体积 |
| --- | ---: | ---: |
| arm64-v8a | 23 | 20.19 MiB |
| armeabi-v7a | 23 | 13.96 MiB |
| x86 | 23 | 21.52 MiB |
| x86_64 | 23 | 21.70 MiB |

最大的 native 库：

| native library | ABI 数 | 压缩体积 |
| --- | ---: | ---: |
| libreactnative.so | 4 | 21.48 MiB |
| libhermes.so | 4 | 8.06 MiB |
| libexpo-sqlite.so | 4 | 6.61 MiB |
| libappmodules.so | 4 | 4.92 MiB |
| libreanimated.so | 4 | 4.90 MiB |
| libexpo-modules-core.so | 4 | 4.60 MiB |
| libavif_android.so | 4 | 4.48 MiB |
| libc++_shared.so | 4 | 4.46 MiB |

## 当前配置观察

本地 prebuild 后的 `android/gradle.properties` 显示：

```properties
reactNativeArchitectures=armeabi-v7a,arm64-v8a,x86,x86_64
newArchEnabled=true
hermesEnabled=true
expo.gif.enabled=true
expo.webp.enabled=true
expo.useLegacyPackaging=false
```

本地 prebuild 后的 `android/app/build.gradle` 显示 release 默认：

```groovy
shrinkResources false
minifyEnabled false
```

因此当前 release APK 是：

1. 四 ABI universal APK。
2. native `.so` 未压缩打包。
3. R8 / resource shrink 默认未开启。

## 主要方案

### 方案 A: 保留 universal APK，只做压缩与 shrink

操作：

1. 评估 `expo.useLegacyPackaging=true`。
2. 开启 `android.enableMinifyInReleaseBuilds=true`。
3. 开启 `android.enableShrinkResourcesInReleaseBuilds=true`。

收益：

1. 不改变分发模型。
2. native `.so` 压缩后，估算 `lib/` 可从 77.37 MiB 降到约 28MB。

风险：

1. 可能改变安装后 native lib 提取行为。
2. R8 需要验证 Expo modules、reflection、native bridge、notifications、SQLite、media library 等路径。

### 方案 B: Page 直下载改成 arm-only APK

操作：

1. 用户侧 page APK 不再包含 x86 / x86_64。
2. 先支持 `arm64-v8a + armeabi-v7a`，后续根据设备矩阵决定是否只保留 `arm64-v8a`。

收益：

1. 删除 x86 / x86_64 立刻节省 43.23 MiB。
2. arm-only APK 预计从 98MB 降到约 56MB 到 60MB。
3. arm64-only APK 理论上可降到约 45MB。

风险：

1. x86 模拟器不能直接安装用户侧 APK，需要保留内部 debug/universal 产物。
2. 如果仍要支持极老 32-bit ARM 设备，不能只发 arm64。

### 方案 C: 改为 AAB / split APK 分发

操作：

1. Play Store 或 bundletool 按设备生成 split APK。
2. Page 侧如果继续直下载，需要自己维护 device-specific APK 或至少提供 arm64 APK。

收益：

1. Store 分发会自然按 ABI / density / language 裁剪。
2. 最符合 Android 官方方向。

风险：

1. `mc.jerret.me` 直下载不能自动享受 Play 动态交付。
2. 自建 split 分发会增加安装和验证复杂度。

## 推荐决策

推荐组合是 B + 体积报告先行：

1. 先把包体积分析脚本和报告 gate 做出来。
2. 然后把 page 用户侧 APK 改成 arm-only。
3. universal APK 保留为内部 artifact，不作为用户下载入口。
4. 再评估 `expo.useLegacyPackaging=true` 与 R8/resource shrink。

这个顺序风险最低，因为 ABI 裁剪是当前最大、最确定的收益来源；R8 与 native lib compression 需要更多兼容性验证。

## 阶段实测更新

后续本地 release smoke 已完成多组候选实测：

| 候选 | APK MiB | 关键变化 |
| --- | ---: | --- |
| baseline universal APK | 97.764 | 四 ABI：`arm64-v8a`, `armeabi-v7a`, `x86`, `x86_64` |
| Stage 1 ARM APK | 47.291 | 去掉 `x86` / `x86_64` |
| Stage 4 arm64 APK | 35.558 | 只保留 `arm64-v8a` |
| Stage 6 ARM APK + R8/resource shrink | 40.642 | 保留双 ARM ABI，dex 降到 4.452 MiB |
| Stage 7 arm64 + R8/resource shrink | 28.909 | 当前最小实测候选 |

结论：当前最高效的技术抓手仍然是 ABI 策略；R8/resource shrink 已证明有额外收益，但必须通过正式签名 APK 的真机回归后才能默认启用。

阶段报告见：[Android APK 体积阶段治理总结](../../release/android-apk-size-governance-report.md)。

## 参考资料

1. Android 官方 Reduce your app size: https://developer.android.com/topic/performance/reduce-apk-size
2. Android 官方 Shrink, obfuscate, and optimize your app: https://developer.android.com/topic/performance/app-optimization/enable-app-optimization
3. Android Studio APK Analyzer: https://developer.android.com/studio/debug/apk-analyzer
4. Expo Android app size: https://docs.expo.dev/guides/analyzing-bundles/
