# BDD 规格

## 背景

三个 goal 需要拆成可验证行为。BDD 目标不是写口号，而是让后续 `writing-plans` 可以直接转换为执行任务和验收命令。

## P0 Rust Core 和 CLI

### Scenario: Rust Core 输出 schema-compatible session

Given 已存在 `schemas/media-clean-result.schema.json` 和 golden fixture
When Rust Core 分析一组标准化媒体输入
Then 输出必须包含 `algorithmVersion`、assets、metrics、clusters、cleanup candidates
And 输出必须通过 `npm run verify:schema:media-clean-result`

### Scenario: CLI 提供 machine-readable 输出

Given 用户通过 CLI 扫描本地目录
When 运行 `media-clean scan <path> --format json --out session.json`
Then CLI 必须输出 schema-compatible session
And stdout / stderr 必须可被 automation 区分
And exit code 必须能表达 success、partial、user error、system error

### Scenario: CLI 默认安全清理

Given CLI 已生成 cleanup plan
When 用户运行 `media-clean quarantine cleanup-plan.json --dry-run --format json`
Then CLI 只能输出计划和模拟结果
And 不得移动、删除或覆盖源文件
And destructive action 必须需要显式非 dry-run 参数和二次确认

### Scenario: Android baseline 与 Rust output 可比较

Given Android native executor 和 Rust CLI 分别输出同一批 fixture 的结果
When parity script 对比关键字段
Then metrics、hash、candidate reason、cluster id strategy 必须可比较
And 差异必须进入 parity report，不得静默忽略

## P1 Electron Desktop

### Scenario: Electron main process 调用同一 engine

Given Rust Core / CLI contract 已稳定
When Electron main process 启动 scan job
Then 它必须优先调用 `@mistap/media-clean-engine` 或 N-API binding
And N-API 不可用时可降级到 CLI fallback
And renderer 不得直接访问文件系统或 native addon

### Scenario: Renderer 只通过 typed IPC 工作

Given 用户选择扫描目录
When renderer 发起 scan 请求
Then 请求必须通过 preload 暴露的 typed IPC API
And main process 必须校验参数和路径权限
And renderer 只接收 session、progress、plan、error 这类结构化事件

### Scenario: 桌面清理默认 dry-run

Given 用户在 Electron UI 中查看 cleanup plan
When 用户点击清理预览
Then UI 只能展示 dry-run 结果
And 真正移动到 quarantine 前必须展示路径、数量、大小和撤销策略
And main process 必须记录操作结果 artifact

## P2 多语言、多主题重构

### Scenario: i18n namespace 完整

Given supported languages 包含 `zh-CN` 和 `en-US`
When 校验 i18n resources
Then 每个语言必须包含同一组 namespace
And 每个 namespace 必须满足同一 TypeScript schema
And `getAppCopy(language)` facade 输出不得回归

### Scenario: 主题 token 是唯一来源

Given 主题 token 已定义 primitives、semantic、component aliases
When 生成 React Native theme、Tailwind theme 和 Electron CSS variables
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
Then P2 不得改动 `engines/recognition-rust`、`schemas/media-clean-result.schema.json` 或 CLI contract
And P0 不得因为 P2 未完成而阻塞 machine CLI 输出

### Scenario: P1 等 P0 contract 稳定

Given Electron Desktop 依赖 Rust Core / CLI
When P0 schema 或 CLI command 仍在变动
Then P1 只能做 architecture spike、typed IPC 草图和 package boundary
And 不得开始完整 renderer workbench 产品化

## 明确 TODO

后续每个执行计划必须把上述场景转成：

1. feature 文件或测试文件。
2. 具体验证命令。
3. 完成定义。
4. owner 和文件范围。
