# BDD 规格

## 背景

三个 goal 需要拆成可验证行为。BDD 目标不是写口号，而是让后续 `writing-plans` 可以直接转换为执行任务和验收命令。

## P0 Rust Core + mc CLI Algorithm Workbench

### Scenario: Rust Core 接收标准化输入结构

Given CLI 或平台 adapter 已枚举媒体来源
When 它构造 `CoreScanRequest`
Then request 必须包含 source、engine、options 和 assets
And 每个 `AssetInput` 必须包含 identity、media、sourceRef 和 samples
And `core` 不得依赖 Android MediaStore、Node filesystem、Electron 文件授权或 RN bridge

### Scenario: Rust Core 以 bounded representative frames 处理视频

Given `AssetInput.media.mediaType` 是 `video`
When CLI 可以抽取代表帧
Then 它必须按 `videoFramePolicy` 准备有限数量的 `samples.videoFrames`
And `core` 必须基于这些 frame 生成 frame hashes 和聚合 metrics
And P0 不得做完整逐帧识别或场景理解

### Scenario: 视频无法抽帧时降级为 metadata-only

Given `AssetInput.media.mediaType` 是 `video`
When 当前平台无法抽帧或解码失败
Then CLI 仍必须输出包含 duration、dimension、fileSize 和 contentHash 的 asset
And `core` 不得基于缺失 frame 生成 blur / low-value 自动清理候选
And 输出必须包含可审计的 `video-frame-unavailable` diagnostic

### Scenario: Rust Core 输出 schema-compatible session

Given 已存在 `schemas/media-clean-result.schema.json` 和 golden fixture
When Rust Core 分析一组标准化媒体输入
Then 输出必须包含 `algorithmVersion`、assets、metrics、clusters、cleanup candidates
And 输出必须通过 `npm run verify:schema:media-clean-result`

### Scenario: CLI 提供 machine-readable 输出

Given 用户通过 CLI 扫描本地目录
When 运行 `mc scan <path> --format json --out session.json`
Then CLI 必须输出 schema-compatible session
And stdout / stderr 必须可被 automation 区分
And exit code 必须能表达 success、partial、user error、system error

### Scenario: CLI 默认安全清理

Given CLI 已生成 cleanup plan
When 用户运行 `mc quarantine cleanup-plan.json --dry-run --format json`
Then CLI 只能输出计划和模拟结果
And 不得移动、删除或覆盖源文件
And destructive action 必须需要显式非 dry-run 参数和二次确认

### Scenario: CLI 生成本地审阅报告

Given CLI 已生成 schema-compatible session
When 用户运行 `mc report session.json --out .mc/<session-id>/report --open`
Then CLI 必须生成可本地打开的 static HTML report
And report 必须包含候选摘要、cleanup reason 和 cluster summary
And report 必须通过单个 `index.html` 内嵌 JSON 数据渲染，不生成独立 `assets/` 或 `contact-sheet/` 目录
And report 不能改变原始媒体文件

### Scenario: Android baseline 与 Rust output 可比较

Given Android native executor 和 Rust CLI 分别输出同一批 fixture 的结果
When parity script 对比关键字段
Then metrics、hash、candidate reason、cluster id strategy 必须可比较
And 差异必须进入 parity report，不得静默忽略

## P1 Electron Desktop

### Scenario: Electron 不进入当前执行阶段

Given 下一阶段目标是优化扫描和识别算法
When 创建 P0 执行计划
Then 计划不得包含 Electron architecture spike、N-API handoff、renderer workbench 或 OS 交互任务
And Electron 只能作为后续产品化方向保留

## P2 多语言、多主题重构

### Scenario: i18n namespace 完整

Given supported languages 包含 `zh-CN` 和 `en-US`
When 校验 i18n resources
Then 每个语言必须包含同一组 namespace
And 每个 namespace 必须满足同一 TypeScript schema
And `getAppCopy(language)` facade 输出不得回归

### Scenario: 主题 token 是唯一来源

Given 主题 token 已定义 primitives、semantic、component aliases
When 生成 React Native theme 和可选 Web CSS variables
Then 所有输出必须来自同一份 token source
And `AppThemePalette` 只能作为 compatibility facade
And 不得新增 raw hex / rgba 业务颜色

### Scenario: 功能与 main 分支保持一致

Given P2 只做治理不扩功能
When 用户切换语言、light、dark、system
Then Settings、Landing、PhotoGrid、RecycleBin 的可见行为必须与 main 分支一致
And 测试只能因资源结构变化更新，不得修改产品语义

## 跨 Goal 场景

### Scenario: P2 不阻塞 P0

Given P0 正在实现 Rust Core / CLI
When P2 同时迁移 i18n/theme
Then P2 不得改动 `engines/recognition`、`schemas/media-clean-result.schema.json` 或 CLI contract
And P0 不得因为 P2 未完成而阻塞 machine CLI 输出

### Scenario: P1 等单独产品决策

Given Electron Desktop 涉及独立桌面设计风格和 OS 交互
When P0 schema 或 CLI command 仍在变动
Then P1 不得进入执行
And 必须等 P0 artifact contract 稳定后再单独做产品和技术方案

## 明确 TODO

后续每个执行计划必须把上述场景转成：

1. feature 文件或测试文件。
2. 具体验证命令。
3. 完成定义。
4. owner 和文件范围。
