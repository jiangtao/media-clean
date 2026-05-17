# Android APK 包体积分析设计

## 背景

当前问题是：Media Clean 功能体量还不大，但 Android APK 接近 100MB，是否合理，以及后续应如何把包体积分析做成稳定最佳实践。

本次用当前对外下载产物作为实证样本：

```text
artifact: artifacts/apk-size-analysis/android-latest.apk
source: https://mc.jerret.me/download/android-latest.apk
size: 102,513,501 bytes
sha256: 900b881a4db57ac56cfaf0577086bf20e5a13562ddda9460514dedcf42ef96e4
```

当前 `feature/v0.5` / detached HEAD 相对 `origin/main` 的差异只新增 v0.5 文档与研究材料，没有 Android native 配置、依赖或 release workflow 改动。因此本次 APK 体积结论可视为当前 Android baseline 的问题，而不是该分支新增的 i18n / theme token 文档造成的体积变化。

## 关键结论

接近 100MB 不是由业务功能多导致的，主因是当前对外 APK 是 universal APK，同时包含四套 native ABI：

```text
armeabi-v7a
arm64-v8a
x86
x86_64
```

APK 内部压缩体积分布：

| 类别 | 文件数 | 压缩体积 |
| --- | ---: | ---: |
| native lib | 92 | 77.37 MiB |
| dex | 4 | 10.91 MiB |
| res | 1306 | 3.61 MiB |
| assets | 4 | 3.17 MiB |
| resources.arsc | 1 | 1.63 MiB |

`lib/` 占 APK entry 压缩体积约 79.9%。其中 x86 / x86_64 两套 native lib 就占 43.23 MiB，主要服务模拟器，不应默认进入面向手机用户的 page 直下载 APK。

## 决策

采用三层策略：

1. 短期先把体积分析做成可重复报告，不立即把“100MB”当作业务代码问题。
2. 面向 `mc.jerret.me` 直下载 APK，优先产出 arm64 或 arm-only APK，避免把 x86 / x86_64 发给手机用户。
3. 中期把 APK 体积预算、ABI 策略、native dependency intake 和 release 报告纳入 Android release gate。

## 当前分支 i18n / token 影响判断

当前分支的 i18n 和多 token 方案对 APK 体积减少没有直接帮助。

原因：

1. 当前分支新增的是文档，不是 runtime 代码。
2. 即使未来实现 P2，i18n resource 和 theme token 主要影响 JS bundle / generated assets，量级通常是 KB 到低 MB。
3. 当前 APK 的最大体积来源是 native `.so` 和 ABI 数量，i18n / token 不会移除 RN、Hermes、Expo SQLite、image/video codec 相关 native 库。

P2 能提供的间接价值是治理能力：防止 generated Electron CSS、重复 copy、重复 token、全量 icon/font 等资源误入 mobile bundle，并把资源扫描纳入包体积报告。

## Design Documents

1. [架构与诊断模型](./architecture.md)
2. [BDD 验收规格](./bdd-specs.md)
3. [包体积分析最佳实践](./best-practices.md)
4. [Android 依赖体积盘点](./dependency-footprint.md)
5. [Android APK 可用性优先优化计划](./usability-first-optimization-plan.md)
6. [Android APK 体积阶段治理总结](../../release/android-apk-size-governance-report.md)

## 后续 TODO

1. 已新增 `scripts/android/analyze-apk-size.mjs`，不依赖 Android Studio build-tools 即可输出 APK 体积报告。
2. 已在 release workflow 里上传 `apk-size-report.md` / `apk-size-report.json`。
3. 已明确 page 直下载 APK 的 ABI 策略：默认 `arm64-v8a + armeabi-v7a`，不要默认包含 x86 / x86_64。
4. 已增加 release 体积预算：universal APK 只作为内部调试产物；用户侧 APK 单包目标低于 60MB，arm64 目标低于 50MB。
5. 已在依赖引入 PR 规则中要求说明 native lib、ABI、资源、字体和 codec 影响。
6. 已把 APK size gate 前移到 pre-commit：依赖、Android native、release workflow 或签名插件变更时，必须先生成并分析本地 release smoke APK。
7. 已完成候选实测：Stage 1 为 47.291 MiB，Stage 4 arm64-only 为 35.558 MiB，Stage 6 R8/resource shrink 为 40.642 MiB，Stage 7 组合候选为 28.909 MiB。

## 下一步 TODO

1. 用正式 signing chain 和递增 versionCode 复核 Stage 1 真机安装。
2. 决策是否放弃 32-bit ARM；若确认，则把正式 release 候选切到 Stage 4。
3. 用正式签名 APK 做 R8/resource shrink 全链路真机回归，再决定是否默认开启。
