# iOS 风格 UI 重新设计 - 执行计划

## 目标

将现有媒体清理应用从卡片式圆角设计重构为 iOS 风格界面，包括底部 Tab 导航、照片网格、扫描进度动画和重复项对比功能。

## 设计参考

- 设计文档：`docs/plans/2026-04-16-ios-ui-redesign-design/`
- BDD 规格：`docs/plans/2026-04-16-ios-ui-redesign-design/bdd-specs.md`

## 团队分工

依据 `docs/goal/v0.1.md` 团队定义执行：

| 角色 | 成员 | 职责 |
|------|------|------|
| Lead | 包拯 | 总控方向，监督进展，协调决策 |
| 架构 | 公孙策 | 架构设计，确保扩展性，技术评审 |
| 执行 | 展昭 | 核心功能实现，代码质量把控 |
| 执行小队 | 张龙、赵虎、王朝、马汉 | 模块执行和拆解 |
| 验收 | 八贤王 | 高标准验收，反馈问题给 Lead |

## 执行计划

```yaml
tasks:
  - id: "001"
    subject: "Setup React Navigation"
    slug: "setup-navigation"
    type: "setup"
    depends-on: []
    assignee: "公孙策"
  - id: "002"
    subject: "Bottom Tab Navigation Test"
    slug: "tab-navigation-test"
    type: "test"
    depends-on: ["001"]
    assignee: "张龙"
  - id: "003"
    subject: "Bottom Tab Navigation Implementation"
    slug: "tab-navigation-impl"
    type: "impl"
    depends-on: ["002"]
    assignee: "张龙"
  - id: "004"
    subject: "Photo Grid Component Test"
    slug: "photo-grid-test"
    type: "test"
    depends-on: ["001"]
    assignee: "赵虎"
  - id: "005"
    subject: "Photo Grid Implementation"
    slug: "photo-grid-impl"
    type: "impl"
    depends-on: ["004", "003"]
    assignee: "赵虎"
  - id: "006"
    subject: "Scan Progress Animation Test"
    slug: "scan-progress-test"
    type: "test"
    depends-on: ["001"]
    assignee: "王朝"
  - id: "007"
    subject: "Scan Progress Implementation"
    slug: "scan-progress-impl"
    type: "impl"
    depends-on: ["006", "005"]
    assignee: "王朝"
  - id: "008"
    subject: "Photo Selection Mode Test"
    slug: "selection-mode-test"
    type: "test"
    depends-on: ["005"]
    assignee: "马汉"
  - id: "009"
    subject: "Photo Selection Mode Implementation"
    slug: "selection-mode-impl"
    type: "impl"
    depends-on: ["008"]
    assignee: "马汉"
  - id: "010"
    subject: "Detail View with Swipe Test"
    slug: "detail-view-test"
    type: "test"
    depends-on: ["001"]
    assignee: "展昭"
  - id: "011"
    subject: "Detail View Implementation"
    slug: "detail-view-impl"
    type: "impl"
    depends-on: ["010"]
    assignee: "展昭"
  - id: "012"
    subject: "Settings Screen Test"
    slug: "settings-test"
    type: "test"
    depends-on: ["001"]
    assignee: "张龙"
  - id: "013"
    subject: "Settings Screen Implementation"
    slug: "settings-impl"
    type: "impl"
    depends-on: ["012"]
    assignee: "张龙"
  - id: "014"
    subject: "Recycle Bin Screen Test"
    slug: "recycle-bin-test"
    type: "test"
    depends-on: ["003"]
    assignee: "赵虎"
  - id: "015"
    subject: "Recycle Bin Implementation"
    slug: "recycle-bin-impl"
    type: "impl"
    depends-on: ["014"]
    assignee: "赵虎"
  - id: "016"
    subject: "Theme Integration"
    slug: "theme-integration"
    type: "impl"
    depends-on: ["003"]
    assignee: "王朝"
  - id: "017"
    subject: "Integration and E2E Test"
    slug: "integration-test"
    type: "test"
    depends-on: ["007", "009", "011", "013", "015", "016"]
    assignee: "八贤王"
```

## 任务文件参考

### Phase 1: 导航基础
- [Task 001: Setup React Navigation](./task-001-setup-navigation.md)
- [Task 002: Bottom Tab Navigation Test](./task-002-tab-navigation-test.md)
- [Task 003: Bottom Tab Navigation Implementation](./task-003-tab-navigation-impl.md)

### Phase 2: 照片网格
- [Task 004: Photo Grid Component Test](./task-004-photo-grid-test.md)
- [Task 005: Photo Grid Implementation](./task-005-photo-grid-impl.md)

### Phase 3: 扫描功能
- [Task 006: Scan Progress Animation Test](./task-006-scan-progress-test.md)
- [Task 007: Scan Progress Implementation](./task-007-scan-progress-impl.md)

### Phase 4: 选择功能
- [Task 008: Photo Selection Mode Test](./task-008-selection-mode-test.md)
- [Task 009: Photo Selection Mode Implementation](./task-009-selection-mode-impl.md)

### Phase 5: 详情视图
- [Task 010: Detail View with Swipe Test](./task-010-detail-view-test.md)
- [Task 011: Detail View Implementation](./task-011-detail-view-impl.md)

### Phase 6: 设置和回收站
- [Task 012: Settings Screen Test](./task-012-settings-test.md)
- [Task 013: Settings Screen Implementation](./task-013-settings-impl.md)
- [Task 014: Recycle Bin Screen Test](./task-014-recycle-bin-test.md)
- [Task 015: Recycle Bin Implementation](./task-015-recycle-bin-impl.md)

### Phase 7: 主题和集成
- [Task 016: Theme Integration](./task-016-theme-integration.md)
- [Task 017: Integration and E2E Test](./task-017-integration-test.md)

## BDD 覆盖

| 功能 | 场景数 | 对应任务 |
|------|--------|----------|
| 底部 Tab 导航 | 2 | 002-003 |
| 照片主屏 | 3 | 004-005 |
| 扫描进度 | 4 | 006-007 |
| 问题照片选择 | 2 | 008-009 |
| 照片详情 | 3 | 010-011 |
| 设置页面 | 3 | 012-013 |
| 回收站 | 3 | 014-015 |
| 深色/浅色主题 | 2 | 016 |
| 边缘场景 | 4 | 覆盖所有任务 |

## 依赖链

```
001 (Setup Navigation)
├── 002 (Tab Test) → 003 (Tab Impl)
│   ├── 004 (Grid Test) → 005 (Grid Impl)
│   │   ├── 006 (Progress Test) → 007 (Progress Impl)
│   │   ├── 008 (Selection Test) → 009 (Selection Impl)
│   │   └── 010 (Detail Test) → 011 (Detail Impl)
│   ├── 012 (Settings Test) → 013 (Settings Impl)
│   └── 014 (Recycle Test) → 015 (Recycle Impl)
└── 016 (Theme Integration)

017 (Integration Test) depends on: 007, 009, 011, 013, 015, 016
```

## 技术栈

- React Navigation v7
- React Native Reanimated v3
- React Native Gesture Handler
- Shopify FlashList
- Lottie (可选)

## 成功标准

- [ ] 所有 17 个任务完成并通过测试
- [ ] 底部 Tab 导航正常工作（3 个 tabs）
- [ ] 照片网格以 3 列布局显示
- [ ] 扫描进度显示动画计数器
- [ ] 长按进入选择模式
- [ ] 详情视图支持水平滑动查看重复项
- [ ] 设置页面有扫描范围滑块
- [ ] iOS 风格视觉设计匹配系统应用
- [ ] 所有现有测试通过
- [ ] 新的 UI 测试覆盖所有 BDD 场景
