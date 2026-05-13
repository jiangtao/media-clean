# BDD 验收规格

## Feature: Android APK 体积报告

### Scenario: 生成 release APK 体积报告

Given 已经存在一个 Android release APK
When 执行 APK 体积分析脚本
Then 报告必须包含 APK 文件大小、SHA256、顶层目录体积分布、ABI 体积分布、最大 native 库列表、JS bundle 体积和 dex 体积

### Scenario: 无 Android build-tools 也能分析 APK

Given 本机没有可用的 Android build-tools / `aapt`
When 执行 APK 体积分析脚本
Then 脚本仍可通过 ZIP 结构输出基础体积报告
And 报告中必须标记 `apkanalyzer` 不可用

### Scenario: 识别 universal APK

Given APK 同时包含 `armeabi-v7a`、`arm64-v8a`、`x86` 和 `x86_64`
When 生成体积报告
Then 报告必须标记该产物为 universal APK
And 报告必须计算删除 x86 / x86_64 后的理论节省体积

### Scenario: 检测用户侧 APK 包含模拟器 ABI

Given release 目标是 `mc.jerret.me` 用户侧直下载 APK
And APK 包含 `x86` 或 `x86_64` native lib
When 执行 release 体积 gate
Then gate 至少给出 warning
And 报告必须建议使用 arm-only APK 或 split artifact

### Scenario: 包体积超过预算

Given 用户侧 release APK 预算为 60MB
When APK 文件大小超过预算
Then release 体积 gate 必须失败或要求显式 override
And override 必须记录原因、体积差异、最大新增来源和回滚方案

### Scenario: Pre-commit 前置 APK size gate

Given staged files 触及依赖、`app.json`、Android native、release workflow、release 脚本或签名插件
When 执行 `npm run verify:precommit`
Then gate 必须要求已有本地 release smoke APK 并执行 size budget
And 若本地无法构建 APK，提交说明或 PR 必须记录跳过原因和 CI size report 审核责任

### Scenario: 引入新的 native dependency

Given PR 新增或升级 Expo / React Native native dependency
When 执行依赖变更检查
Then PR 必须包含 native 体积影响说明
And 必须列出新增 `.so`、ABI 影响和用户价值

## Feature: i18n 与 theme token 不误入 mobile bundle

### Scenario: generated Electron CSS 不进入 Android APK

Given theme token 生成 Electron CSS variables
When 执行 Android release bundle
Then Electron-only CSS 不应被 mobile entry import
And APK assets 中不应出现 Electron-only generated CSS

### Scenario: i18n resource 扩展不显著增加 JS bundle

Given 新增或迁移 i18n namespace
When 生成 release APK 体积报告
Then `assets/index.android.bundle` 增量应低于预算阈值
And 若超出阈值，报告必须列出新增 resource 文件和 key 数量

### Scenario: icon/font 资源纳入治理

Given UI 继续使用 icon font 或 vector icon 包
When 生成 APK 体积报告
Then 报告必须汇总 `.ttf` 体积
And 若字体体积增长，必须指向具体新增字体或 icon 包

## Feature: Release 工作流支撑

### Scenario: Release workflow 上传体积报告

Given GitHub Actions 完成 Android release APK 构建
When workflow 上传 release artifact
Then workflow 必须同时上传 `apk-size-report.md` 和 `apk-size-report.json`

### Scenario: Page 下载 APK 与报告一致

Given `https://mc.jerret.me/download/android-latest.apk` 已部署
When 执行 page contract 验证
Then 下载 APK 的 SHA256 必须与 release metadata 一致
And size report 中的 artifact SHA256 必须一致

### Scenario: 保留内部 universal APK

Given 开发者需要模拟器或内部设备验证
When release workflow 生成 APK
Then 可以保留 universal APK 作为内部 artifact
And 用户侧 page 入口不得默认指向 universal APK

### Scenario: 候选优化必须有阶段对比

Given 开发者要评估 `arm64-v8a`、R8 或 resource shrink
When 候选 release smoke APK 构建完成
Then 必须生成 `apk-size-report.md` 和 `apk-size-report.json`
And 必须与 baseline、Stage 1 和其他候选项生成对比表
And 未通过真机回归的候选项不得直接替代默认 release 策略
