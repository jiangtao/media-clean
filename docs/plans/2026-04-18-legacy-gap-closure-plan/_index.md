# Claude 遗留缺口收口 - 执行计划

## 目标

围绕 `docs/goal/v0.1.md` 与 `docs/reports/claude-mem-screen-adaptation-debug.md`，完成 App 偏好统一收口、照片页/回收站页国际化与多主题补齐、目标机型 `Samsung_S20` 特殊屏适配修复，以及相关验证闭环。

## 设计参考

- 设计文档：`docs/plans/2026-04-18-legacy-gap-closure-design/`
- BDD 规格：`docs/plans/2026-04-18-legacy-gap-closure-design/bdd-specs.md`

## 团队分工

| 角色 | 成员 | 职责 |
|------|------|------|
| Lead | 包拯 | 主控执行顺序、合并结果、裁决取舍 |
| 架构 | 公孙策 | 审核入口约定、Provider 边界与跨模块一致性 |
| 核心执行 | 展昭 | 根集成与疑难收口 |
| 执行小队 | 张龙、赵虎、王朝、马汉 | 分模块测试与实现 |
| 验收 | 八贤王 | BDD 与目标对照验收 |

## 执行计划

```yaml
tasks:
  - id: "001"
    subject: "App preferences context tests"
    slug: "app-preferences-test"
    type: "test"
    depends-on: []
    assignee: "张龙"
  - id: "002"
    subject: "App preferences context implementation"
    slug: "app-preferences-impl"
    type: "impl"
    depends-on: ["001"]
    assignee: "展昭"
  - id: "003"
    subject: "Photo and recycle screen localization/theme tests"
    slug: "photo-recycle-coverage-test"
    type: "test"
    depends-on: ["001"]
    assignee: "赵虎"
  - id: "004"
    subject: "Photo and recycle screen localization/theme implementation"
    slug: "photo-recycle-coverage-impl"
    type: "impl"
    depends-on: ["002", "003"]
    assignee: "王朝"
  - id: "005"
    subject: "Target device special-screen adaptation tests"
    slug: "target-device-adaptation-test"
    type: "test"
    depends-on: []
    assignee: "马汉"
  - id: "006"
    subject: "Target device special-screen adaptation implementation"
    slug: "target-device-adaptation-impl"
    type: "impl"
    depends-on: ["005"]
    assignee: "展昭"
  - id: "007"
    subject: "Verification and acceptance"
    slug: "verification-and-acceptance"
    type: "test"
    depends-on: ["004", "006"]
    assignee: "八贤王"
```

## 任务文件

- [Task 001: App Preferences Context Tests](./task-001-app-preferences-test.md)
- [Task 002: App Preferences Context Implementation](./task-002-app-preferences-impl.md)
- [Task 003: Photo and Recycle Screen Localization/Theme Tests](./task-003-photo-recycle-coverage-test.md)
- [Task 004: Photo and Recycle Screen Localization/Theme Implementation](./task-004-photo-recycle-coverage-impl.md)
- [Task 005: Target Device Special-Screen Adaptation Tests](./task-005-target-device-adaptation-test.md)
- [Task 006: Target Device Special-Screen Adaptation Implementation](./task-006-target-device-adaptation-impl.md)
- [Task 007: Verification and Acceptance](./task-007-verification-and-acceptance.md)

## BDD 覆盖

| 场景 | 对应任务 |
|------|----------|
| Scenario 1 App 级偏好统一收口 | 001-002 |
| Scenario 2 照片页国际化与主题覆盖 | 003-004 |
| Scenario 3 回收站页国际化与主题覆盖 | 003-004 |
| Scenario 4 用户目标机型特殊屏适配 | 005-006 |
| Scenario 5 App 入口约定和验证 | 001-002, 007 |

## 依赖链

```text
001 -> 002
001 -> 003 -> 004
002 -> 004
005 -> 006
004 + 006 -> 007
```

## 成功标准

- [ ] App 偏好由单一根上下文管理
- [ ] 照片页与回收站页完成语言/主题覆盖
- [ ] `Samsung_S20` 左上打孔横屏识别通过
- [ ] 相关测试与类型检查通过
- [ ] 交付结果与 `docs/goal/v0.1.md` 保持一致
