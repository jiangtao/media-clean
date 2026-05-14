# Android APK 体积阶段治理总结

[English Version](./android-apk-size-governance-report.en.md)

本文档按优先级记录 Media Clean Android APK 体积治理阶段、每阶段产物、体积对比和后续验收标准。每次 Android release 后，都要用新的 `apk-size-report.json` 更新本文档。

## 基线

当前已确认的对外 APK 样本：

| 字段 | 值 |
| --- | --- |
| APK | `artifacts/apk-size-analysis/android-latest.apk` |
| 来源 | `https://mc.jerret.me/download/android-latest.apk` |
| SHA256 | `900b881a4db57ac56cfaf0577086bf20e5a13562ddda9460514dedcf42ef96e4` |
| 体积 | 97.764 MiB |
| ABI | `arm64-v8a`, `armeabi-v7a`, `x86`, `x86_64` |
| native lib | 77.373 MiB |
| x86 / x86_64 | 43.226 MiB |
| JS bundle | 3.164 MiB |
| fonts | 1.945 MiB |

判断：当前主要问题是用户侧 APK 仍是 universal APK，而不是业务 JS、i18n 或 theme token 过大。

## Stage 1 实测结果

本地 release smoke APK 已按 `ANDROID_RELEASE_ARCHITECTURES=armeabi-v7a,arm64-v8a` 重新构建并通过 size gate：

| 字段 | 值 |
| --- | --- |
| APK | `android/app/build/outputs/apk/release/app-release.apk` |
| SHA256 | `5d1789df71edb0cb5ef50e4c9dae91f93487ded707c12d4935f5ada71ed0025c` |
| 体积 | 47.291 MiB / 49,588,284 bytes |
| ABI | `arm64-v8a`, `armeabi-v7a` |
| native lib | 28.271 MiB |
| dex | 10.817 MiB |
| JS bundle | 2.207 MiB |
| fonts | 1.945 MiB |
| Stage 1 gate | pass，warning / failure 均无 |

对比 baseline：

| Stage | APK MiB | Delta vs baseline | Delta % | ABI | Native lib MiB | Dex MiB | JS bundle MiB | Fonts MiB |
| --- | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: |
| baseline | 97.764 | 0.000 | 0.0% | `arm64-v8a`, `armeabi-v7a`, `x86`, `x86_64` | 77.373 | 10.907 | 3.164 | 1.945 |
| stage-1-arm-only | 47.291 | -50.473 | -51.6% | `arm64-v8a`, `armeabi-v7a` | 28.271 | 10.817 | 2.207 | 1.945 |

结论：Stage 1 已经把用户侧 APK 从 97.764 MiB 降到 47.291 MiB，比原先“仅移除 x86 / x86_64”的静态估算 54.538 MiB 更好，主要因为新构建同时体现了当前依赖 cleanup、bundle 差异和 fresh release packaging。

## Main 合并后复核（当前 0.0.3）

合并 `main` 后，当前分支版本已对齐正式发布基线：`package.json` / `app.json` 为 `0.0.3`，Android `versionCode=3`。本地重新构建 `armeabi-v7a,arm64-v8a` release smoke 后，当前 APK 结果如下：

| 字段 | 值 |
| --- | --- |
| APK | `android/app/build/outputs/apk/release/app-release.apk` |
| SHA256 | `63a20e909fbe75df3dbbac7021e684971ba4d87c2fb74a7d1c897755eedde98a` |
| 体积 | 54.130 MiB / 56,759,910 bytes |
| ABI | `arm64-v8a`, `armeabi-v7a` |
| native lib | 34.140 MiB |
| dex | 10.905 MiB |
| JS bundle | 3.165 MiB |
| fonts | 1.945 MiB |
| Stage 1 gate | pass，warning / failure 均无 |
| 估算 arm64-only | 40.176 MiB |

对比 baseline：

| Stage | APK MiB | Delta vs baseline | Delta % | ABI | Native lib MiB | Dex MiB | JS bundle MiB | Fonts MiB |
| --- | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: |
| baseline | 97.764 | 0.000 | 0.0% | `arm64-v8a`, `armeabi-v7a`, `x86`, `x86_64` | 77.373 | 10.907 | 3.164 | 1.945 |
| stage-1-arm-only-main-merged | 54.130 | -43.634 | -44.6% | `arm64-v8a`, `armeabi-v7a` | 34.140 | 10.905 | 3.165 | 1.945 |

结论：合并 `main` 后，Stage 1 当前值从 merge 前的 47.291 MiB 上升到 54.130 MiB，主要来自主线新增的手势、Reanimated、Worklets、Screens、SVG 等 native 依赖和 v0.4 功能面。当前 APK 仍不包含 `x86` / `x86_64`，并低于 60 MiB warning / 70 MiB failure 预算；后续 Stage 4 / Stage 6 / Stage 7 需要基于 main-merged 版本重新实测，不再直接把 merge 前候选值当正式发布承诺。

## 0.0.4 Release Candidate 复核

本轮新增版本已提升到 `0.0.4` / `versionCode=4`，并移除未使用的 direct dependency `@expo/vector-icons`。UI 图标改为本地 `react-native-svg` 图标实现后，最终 release smoke 结果如下：

| 字段 | 值 |
| --- | --- |
| APK | `android/app/build/outputs/apk/release/app-release.apk` |
| SHA256 | `1bec40b1b48e650c004dfa8429e958cc979c03f7edd99fce327eb49ebc99f0fd` |
| 体积 | 51.829 MiB / 54,346,826 bytes |
| ABI | `arm64-v8a`, `armeabi-v7a` |
| native lib | 34.140 MiB |
| dex | 10.905 MiB |
| JS bundle | 2.817 MiB |
| fonts | 0.000 MiB |
| Stage 1 gate | pass，warning / failure 均无 |
| 估算 arm64-only | 37.875 MiB |

对比 main-merged 0.0.3：

| Stage | APK MiB | Delta vs baseline | Delta % | ABI | Native lib MiB | Dex MiB | JS bundle MiB | Fonts MiB |
| --- | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: |
| baseline | 97.764 | 0.000 | 0.0% | `arm64-v8a`, `armeabi-v7a`, `x86`, `x86_64` | 77.373 | 10.907 | 3.164 | 1.945 |
| main-merged-0.0.3 | 54.130 | -43.634 | -44.6% | `arm64-v8a`, `armeabi-v7a` | 34.140 | 10.905 | 3.165 | 1.945 |
| release-candidate-0.0.4 | 51.829 | -45.935 | -47.0% | `arm64-v8a`, `armeabi-v7a` | 34.140 | 10.905 | 2.817 | 0.000 |

结论：0.0.4 在不改变用户可用性的前提下，比 main-merged 0.0.3 再减少 2.301 MiB，主要来自移除 icon font 依赖和清理 JS bundle 入口；native lib 仍是主要体积项。

## Stage 1 真机安装验证

已连接真机：

```text
model: M2102J2SC
device: thyme
transport: usb
```

安装验证状态：

| 操作 | 结果 |
| --- | --- |
| `adb install -r android/app/build/outputs/apk/release/app-release.apk` | 失败：`INSTALL_FAILED_VERSION_DOWNGRADE` |
| `adb install -r -d android/app/build/outputs/apk/release/app-release.apk` | 失败：`INSTALL_FAILED_UPDATE_INCOMPATIBLE` |

原因：当时真机上已有 `com.jt.mistapmediacleaner` 版本 `0.0.3` / `versionCode=3`，而 merge main 前的本地 release smoke 使用 `0.0.1` / `versionCode=1` 和临时 keystore，既是降级包，又与已安装正式包签名不一致。

当前本地 release smoke 已是 `0.0.4` / `versionCode=4`，但仍使用临时 keystore。执行本地安装时，先因已有不同签名包触发 `INSTALL_FAILED_UPDATE_INCOMPATIBLE`；卸载用户 0 / 10 后，MIUI 仍以 `INSTALL_FAILED_USER_RESTRICTED` 拒绝 USB 安装。真机安装验收需要手机侧允许 USB 安装，或使用正式 release workflow 生成同一签名链的 APK 后再验证。

最终验收：2026-05-14，经手机侧继续处理安装限制后，用户确认本地手机安装和主要功能均正常。0.0.4 release candidate 的人工可用性验收通过。

## 0.0.4 后续候选项实测结果

在 `0.0.4` release candidate 51.829 MiB 基础上，继续实测 R8 / resource shrink、native `.so` legacy packaging 和 AAB / split delivery：

| 候选 | 产物 | MiB | Delta vs 0.0.4 | Delta vs baseline | ABI / 分发 | Native lib MiB | Dex MiB | JS bundle MiB | 状态 |
| --- | --- | ---: | ---: | ---: | --- | ---: | ---: | ---: | --- |
| 0.0.4 Stage 1 | APK | 51.829 | 0.000 | -45.935 | `arm64-v8a`, `armeabi-v7a` | 34.140 | 10.905 | 2.817 | 已通过人工可用性验收 |
| R8 / resource shrink | APK | 45.283 | -6.546 | -52.481 | `arm64-v8a`, `armeabi-v7a` | 34.140 | 4.616 | 2.811 | 已构建和过 size gate，待正式签名真机回归 |
| legacy packaging | APK | 30.229 | -21.600 | -67.535 | `arm64-v8a`, `armeabi-v7a` | 12.851 | 10.905 | 2.811 | 已构建和过 size gate，待安装 / 启动验收 |
| legacy packaging + shrink | APK | 23.690 | -28.139 | -74.074 | `arm64-v8a`, `armeabi-v7a` | 12.851 | 4.616 | 2.811 | 当前最小单 APK 候选，待完整回归 |
| AAB upload artifact | AAB | 35.677 | -16.152 | -62.087 | bundle 输入，不是用户安装包 | 12.851 | 4.616 | 2.813 | 可构建；含 debug symbols / Proguard map 等 metadata |
| AAB connected-device splits | `.apks` | 22.549 | -29.280 | -75.215 | 当前真机 `arm64_v8a` + `xxhdpi` + `zh` split | 只下发目标 ABI | 分 split | 分 split | 最小下载路径，但需要 Play / bundletool / split installer |
| AAB universal generated APK | APK | 23.824 | -28.005 | -73.940 | `arm64-v8a`, `armeabi-v7a` | 12.851 | 4.616 | 2.811 | 与直接 legacy + shrink 接近 |

AAB connected-device split 明细：

| Split | bytes |
| --- | ---: |
| `base-master.apk` | 16,012,942 |
| `base-arm64_v8a.apk` | 7,215,159 |
| `base-xxhdpi.apk` | 373,742 |
| `base-zh.apk` | 41,306 |

判断：

1. `expo.useLegacyPackaging=true` 是当前最高效的单开关：不改业务代码，native lib 压缩体积从 34.140 MiB 降到 12.851 MiB，双 ABI APK 从 51.829 MiB 降到 30.229 MiB。
2. R8 / resource shrink 收益稳定但低于 legacy packaging：双 ABI APK 从 51.829 MiB 降到 45.283 MiB，主要来自 dex 从 10.905 MiB 降到 4.616 MiB。
3. legacy packaging + R8 / resource shrink 叠加后为 23.690 MiB，是当前已实测的最小“单 APK / page 直下载”候选。
4. AAB / split delivery 对当前真机可到 22.549 MiB，但它不是 page 直下载 APK 的直接替代；要么走 Play Store，要么自建 split installer / bundletool 安装链路。
5. 本轮尝试安装 23.690 MiB 候选包时，MIUI 返回 `INSTALL_FAILED_USER_RESTRICTED: Install canceled by user`。因此 legacy packaging 和 shrink 还不能直接设为默认 release，必须先用正式签名候选包完成手机侧安装、启动和核心功能验收。

## 阶段优先级

| 阶段 | 优先级 | 手段 | 状态 | 体积结果 | 验收标准 |
| --- | --- | --- | --- | --- | --- |
| Stage 0 | P0 | 建立 baseline 与可重复 analyzer | 已完成 | 97.764 MiB actual | analyzer 输出 JSON / Markdown，能识别 ABI、native lib、JS bundle、fonts |
| Stage 1 | P0 | 用户侧 release 收敛到 `armeabi-v7a,arm64-v8a` | 0.0.4 本地 release smoke 已实测，待 CI 正式 release 复核 | 当前 51.829 MiB actual，较 baseline -45.935 MiB / -47.0%；main-merged 0.0.3 为 54.130 MiB | 新 `media-clean-android-latest.apk` 不含 `x86` / `x86_64`，`verify:android:apk-size` 通过 |
| Stage 2 | P0 | pre-commit 前置 gate | 已完成 | 防回退，不直接瘦身 | 依赖、Android native、release workflow、签名插件变更在提交前触发 size gate |
| Stage 3 | P1 | 移除未使用 direct dependency | 已完成且复扫通过 | 0.0.4 已移除 `@expo/vector-icons` direct dependency，APK 较 main-merged 0.0.3 再减少 2.301 MiB | `analyze:android:deps` 通过，未使用依赖不再进入安装面 |
| Stage 4 | P1 | 评估 `arm64-v8a` 单 ABI | merge 前本地 release smoke 已实测；main-merged 当前为静态估算，待重建 | merge 前 35.558 MiB actual；main-merged 估算 40.176 MiB | 确认不再支持 32-bit ARM，真机安装和启动通过 |
| Stage 5 | P1 | 验证 native `.so` packaging / legacy packaging | 0.0.4 已实测，CI workflow 已加手动开关，待正式签名真机验收 | 单独开启 30.229 MiB；与 shrink 叠加 23.690 MiB | 安装、启动时间、低端机、签名、page 下载全部通过 |
| Stage 6 | P2 | 验证 R8 / resource shrink | 0.0.4 已实测，待完整真机回归 | 单独开启 45.283 MiB；与 legacy packaging 叠加 23.690 MiB | media permission、notifications、foreground service、SQLite、image/video preview、native scan 全覆盖 |
| Stage 7 | P2 | `arm64-v8a` + shrink / legacy 组合候选 | 待产品确认 32-bit ARM 支持策略后重建 | 当前静态估算：arm64 + shrink 31.329 MiB；arm64 + legacy + shrink 17.707 MiB | 同时满足 Stage 4、Stage 5 和 Stage 6 的验收标准 |
| Stage 8 | P3 | AAB / split delivery | AAB 已构建，connected-device `.apks` 已实测 | AAB 35.677 MiB；当前真机 split set 22.549 MiB；universal generated APK 23.824 MiB | 需要 Play Store 或自建 split installer，不直接替代 page 单 APK |
| Stage 9 | P3 | JS lazy load / i18n / token bundle hygiene | 待性能证据触发 | 主要优化启动路径，不作为 APK 主瘦身手段 | JS bundle 保持 warning < 5 MiB，mobile entry 不误 import desktop/generated artifacts |

## 当前已落地产物

1. APK analyzer：`scripts/android/analyze-apk-size.mjs`。
2. APK report comparator：`scripts/android/compare-apk-size-reports.mjs`。
3. dependency footprint analyzer：`scripts/android/analyze-dependency-footprint.mjs`。
4. pre-commit gate：`.githooks/pre-commit` + `scripts/android/verify-apk-size-precommit.mjs`。
5. release workflow ABI 默认值：`ANDROID_RELEASE_ARCHITECTURES=armeabi-v7a,arm64-v8a`。
6. 依赖 cleanup：已移除 `@shopify/flash-list`、`form-data`、`gopd`、`react-native-polyfill-globals`；`expo-system-ui` 因 `userInterfaceStyle: automatic` 保留并进入 allowlist；`react-native-worklets` 作为 Reanimated 4 native runtime peer 保留并进入 allowlist。
7. 本地 smoke 变体脚本：`build:android:release:smoke:arm64`、`build:android:release:smoke:shrink`、`build:android:release:smoke:arm64-shrink`、`build:android:release:smoke:legacy`、`build:android:release:smoke:legacy-shrink`。
8. release workflow 输入：`release_architectures`、`enable_minify`、`enable_resource_shrink`、`enable_legacy_packaging`，用于正式构建前复现实验候选。

## 对比方法

每个阶段拿到新 APK 后，先生成报告：

```bash
npm run analyze:android:apk -- path/to/app.apk \
  --out-dir artifacts/apk-size-stages/stage-<n>-<name> \
  --profile user-arm-only \
  --fail-on-budget
```

再生成阶段对比表：

```bash
npm run compare:android:apk-size -- \
  baseline=artifacts/apk-size-analysis/report/apk-size-report.json \
  stage-1-arm-only=artifacts/apk-size-stages/stage-1-arm-only/apk-size-report.json \
  stage-4-arm64-only=artifacts/apk-size-stages/stage-4-arm64-only/apk-size-report.json \
  stage-6-r8-resource-shrink=artifacts/apk-size-stages/stage-6-r8-resource-shrink/apk-size-report.json \
  stage-7-arm64-r8-resource-shrink=artifacts/apk-size-stages/stage-7-arm64-r8-resource-shrink/apk-size-report.json \
  --markdown artifacts/apk-size-stages/comparison.md
```

对比时至少记录：

1. APK MiB。
2. ABI 列表。
3. native lib MiB。
4. dex MiB。
5. JS bundle MiB。
6. fonts MiB。
7. 与 baseline 的绝对差值和百分比。

## 下一步

1. 默认正式 release 仍先采用 Stage 1：`armeabi-v7a,arm64-v8a`，当前 0.0.4 本地结果为 51.829 MiB，且本地手机人工可用性验收已通过；CI 正式 release 后继续复核正式签名链。
2. 若产品确认可以放弃 32-bit ARM，下一版可切 Stage 4：`arm64-v8a` 单 ABI；0.0.4 当前估算约 37.875 MiB，需要重新构建确认。
3. 下一步最高收益路径是先用 `Android Release Candidate APK` workflow 打一个正式签名、但不发版的 `enable_legacy_packaging=true` 候选包；若手机安装、启动和核心功能正常，再把 legacy packaging 设为默认 release 策略。
4. R8 / resource shrink 作为第二阶段叠加；23.690 MiB 候选必须完成权限、通知、后台扫描、SQLite、图片 / 视频预览和 native scan 回归后才能发布。
5. AAB / split delivery 暂不替代当前 page 单 APK；只有决定接入 Play Store 或自建 split 安装链路时，才进入 Stage 8。
