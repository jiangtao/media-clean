# Android APK 体积治理

[English Version](./android-apk-size.en.md)

本文档定义 Media Clean Android APK 的体积分析、ABI 策略、预算和 release gate。目标是让用户侧下载包尽量小，同时保留内部验证需要的 universal 产物能力。

阶段治理总结见：[Android APK 体积阶段治理总结](./android-apk-size-governance-report.md)。

## 当前结论

当前接近 100MB 的 APK 不是业务 JS 代码撑大的，主要原因是历史 release APK 同时包含四套 native ABI：

```text
armeabi-v7a
arm64-v8a
x86
x86_64
```

对手机用户来说，`x86` / `x86_64` 主要服务模拟器，不应默认进入 page 下载 APK。用户侧 release 默认只打包：

```text
armeabi-v7a,arm64-v8a
```

如果未来设备矩阵确认不再需要 32-bit ARM，可进一步收敛到：

```text
arm64-v8a
```

当前本地 smoke 实测：

| 候选 | APK MiB | 说明 |
| --- | ---: | --- |
| 默认用户侧 ARM APK | 47.291 | `armeabi-v7a,arm64-v8a`，当前推荐正式 release 默认值 |
| arm64 单 ABI | 35.558 | 需要确认不再支持 32-bit ARM |
| ARM APK + R8/resource shrink | 40.642 | 需要完整真机回归 |
| arm64 + R8/resource shrink | 28.909 | 当前最小候选，需要同时满足设备矩阵和 R8 回归 |

## 构建策略

正式 release workflow 默认使用：

```text
ANDROID_RELEASE_ARCHITECTURES=armeabi-v7a,arm64-v8a
```

本地临时 release smoke 也采用同样默认值：

```bash
bash scripts/android/build-release-apk.sh --temp-keystore --skip-install
```

常用候选 smoke 命令：

```bash
npm run build:android:release:smoke:arm64
npm run build:android:release:smoke:shrink
npm run build:android:release:smoke:arm64-shrink
```

如需内部 universal APK，可显式传入：

```bash
bash scripts/android/build-release-apk.sh \
  --temp-keystore \
  --skip-install \
  --architectures universal
```

不要把 universal APK 作为 `media-clean-android-latest.apk` 的默认用户侧产物。

正式 workflow 支持三个手动输入用于复现实验候选：

1. `release_architectures`：默认 `armeabi-v7a,arm64-v8a`，可显式传 `arm64-v8a`。
2. `enable_minify`：默认 `false`。
3. `enable_resource_shrink`：默认 `false`。

## 分析命令

分析任意 APK：

```bash
npm run analyze:android:apk -- path/to/app.apk --profile internal-universal
```

验证 release APK 是否符合用户侧体积和 ABI 预算：

```bash
npm run verify:android:apk-size
```

脚本输出：

1. `artifacts/android-release/apk-size-report.md`
2. `artifacts/android-release/apk-size-report.json`

分析器不依赖 Android Studio build-tools；如果 `apkanalyzer` 不可用，会自动使用 ZIP Central Directory 解析 APK 结构。

扫描 Android 相关 direct dependency 是否有未解释的 runtime import 缺口：

```bash
npm run analyze:android:deps
```

对比多个阶段的 APK size report：

```bash
npm run compare:android:apk-size -- \
  baseline=artifacts/apk-size-analysis/report/apk-size-report.json \
  stage-1=artifacts/apk-size-stages/stage-1-arm-only/apk-size-report.json
```

## Pre-commit 前置检查

不要只等 release workflow 才发现包体积问题。开发机需要先安装本仓库 hook：

```bash
npm run hooks:install
```

安装后，`.githooks/pre-commit` 会执行：

```bash
npm run verify:precommit
```

前置检查包含两层：

1. 每次提交都检查 APK size analyzer 语法和 release/page contract。
2. 每次提交都扫描 direct dependency 使用情况，避免未使用依赖重新进入安装面。
3. 如果 staged files 触及依赖、`app.json`、Android native、release workflow、release 脚本或签名插件，必须先生成并分析本地 release smoke APK。

本地生成并分析：

```bash
npm run build:android:release:smoke
npm run verify:precommit:android-size
```

如果当前机器无法构建 Android release smoke APK，不能静默跳过；需要在提交说明或 PR 中记录原因，并让 CI 的 `apk-size-report.md` 成为合并前必看产物。只有文档类或紧急修复允许临时设置：

```bash
SKIP_ANDROID_APK_SIZE_PRECOMMIT=1
```

## 预算

| 产物 | 目标 | Gate |
| --- | ---: | --- |
| 用户侧 arm64 APK | <= 50MB | warning > 50MiB, fail > 60MiB |
| 用户侧 ARM APK | <= 60MB | warning > 60MiB, fail > 70MiB |
| 内部 universal APK | <= 110MB | warning > 100MiB, fail > 120MiB |
| JS bundle | <= 5MB | warning > 5MiB, fail > 8MiB |
| fonts | <= 3MB compressed | warning > 3MiB |

Release workflow 使用 `--fail-on-budget`，因此用户侧 APK 如果包含 `x86` / `x86_64` 或超过预算，会直接失败。

当前 Stage 1 本地 release smoke 实测为 47.291 MiB，ABI 为 `armeabi-v7a,arm64-v8a`，已经低于用户侧 ARM APK 的 warning 预算。`arm64-v8a` 单 ABI 实测为 35.558 MiB，低于用户侧 arm64 APK 的 warning 预算。

## R8 与 resource shrink

R8 / resource shrink 当前不默认开启，因为本项目包含 Expo modules、SQLite、media library、notifications、foreground service、image / video preview 和自定义 Android native scan modules。

如需验证，可显式开启：

```bash
bash scripts/android/build-release-apk.sh \
  --temp-keystore \
  --skip-install \
  --enable-minify \
  --enable-resource-shrink
```

当前双 ABI smoke 实测为 40.642 MiB；与默认 Stage 1 相比减少 6.649 MiB，主要来自 dex 从 10.817 MiB 降到 4.452 MiB。组合 `arm64-v8a` 单 ABI 后实测为 28.909 MiB。

开启前必须覆盖：

1. media library permission。
2. notifications。
3. background scan foreground service。
4. SQLite operational store。
5. expo-image / expo-video preview。
6. Android native scan modules。
7. page 下载 APK 的签名、安装和真机启动。

## Release 产物

每次 Android release 必须保留：

1. `app-release.apk`
2. `app-release.signing.txt`
3. `app-release.sha256`
4. `release-metadata.json`
5. `apk-size-report.md`
6. `apk-size-report.json`
7. `media-clean-android-v<version>.size-report.md`
8. `media-clean-android-v<version>.size-report.json`

体积报告必须进入 GitHub Actions artifact，并写入 workflow summary。

## 依赖准入

新增或升级以下依赖前必须说明体积影响：

1. Expo native modules。
2. React Native native modules。
3. image / video codec。
4. ML / OCR / vision 模型。
5. SQLite / database engine。
6. icon font / full font family。

说明至少包含：新增 native `.so`、受影响 ABI、APK 增量、用户价值、替代方案和回滚策略。

当前依赖扫描结论见：[Android 依赖体积盘点](../research/android-apk-size-analysis/dependency-footprint.md)。
