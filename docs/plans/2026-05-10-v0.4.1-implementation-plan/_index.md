# v0.4.1 交互优化实施计划

## 计划概述

**目标文档**: [docs/goal/v0.4.1.md](../../goal/v0.4.1.md)
**设计方案**: [docs/plans/2026-05-10-v0.4.1-interaction-optimization-design/_index.md](../2026-05-10-v0.4.1-interaction-optimization-design/_index.md)
**滑动选中聚焦方案**: [docs/plans/2026-05-12-v0-4-1-selection-swipe-design/_index.md](../2026-05-12-v0-4-1-selection-swipe-design/_index.md)
**BDD 规范**: [docs/plans/2026-05-10-v0.4.1-interaction-optimization-design/bdd-specs.md](../2026-05-10-v0.4.1-interaction-optimization-design/bdd-specs.md)

## 目标

实现两个核心交互优化功能：
1. **滑动批量选中** - 选中模式下滑动可选中多个网格项
2. **图片双指缩放** - 详情页图片支持双指缩放

当前执行状态已从“两个功能并行实现”收敛为“滑动选中体验修复优先”。`EXECUTION_SUMMARY.md` 显示基础实现已经存在，但选中模式下轻触、横向/斜向拖动和纵向滚动的意图区分仍未达到相册体验，因此 Task 012 是 v0.4.1 的当前主线。

## 约束与前提

- 使用 `react-native-gesture-handler` + `react-native-reanimated`
- 遵循 **开发中快反馈、功能完整后端到端** 的流程：开发阶段使用单测、组件测试、lint/typecheck、Expo dev runtime 日志定位问题；功能全部完成后再跑 Maestro/agent-device E2E 和真机矩阵验证。
- 保持与现有代码架构一致（分层架构）
- 不破坏现有交互（点击、长按）

## 新增依赖

```bash
npx expo install react-native-gesture-handler react-native-reanimated
```

## 架构变更

### 新增文件
- `src/ui/hooks/useSwipeSelection.ts` - 滑动选中逻辑
- `src/ui/components/ZoomableImage.tsx` - 可缩放图片组件

### 修改文件
- `src/ui/components/PhotoGrid.tsx` - 集成滑动选中
- `src/ui/screens/DetailScreen.tsx` - 集成图片缩放
- `src/application/MediaCleanerApp.tsx` - 添加 GestureHandlerRootView
- `package.json` - 新增依赖
- `babel.config.js` - 添加 Reanimated 插件

## Execution Plan

```yaml
tasks:
  - id: "001"
    subject: "Install gesture dependencies"
    slug: "install-gesture-dependencies"
    type: "config"
    depends-on: []
  - id: "002"
    subject: "Configure GestureHandlerRootView"
    slug: "configure-gesture-handler-root"
    type: "config"
    depends-on: ["001"]
  - id: "003"
    subject: "Create useSwipeSelection hook test"
    slug: "swipe-selection-hook-test"
    type: "test"
    depends-on: []
  - id: "004"
    subject: "Implement useSwipeSelection hook"
    slug: "swipe-selection-hook-impl"
    type: "impl"
    depends-on: ["003"]
  - id: "005"
    subject: "Create ZoomableImage component test"
    slug: "zoomable-image-test"
    type: "test"
    depends-on: []
  - id: "006"
    subject: "Implement ZoomableImage component"
    slug: "zoomable-image-impl"
    type: "impl"
    depends-on: ["005"]
  - id: "007"
    subject: "Integrate swipe selection into PhotoGrid test"
    slug: "photogrid-swipe-test"
    type: "test"
    depends-on: ["004"]
  - id: "008"
    subject: "Integrate swipe selection into PhotoGrid"
    slug: "photogrid-swipe-impl"
    type: "impl"
    depends-on: ["007", "004"]
  - id: "009"
    subject: "Integrate ZoomableImage into DetailScreen test"
    slug: "detailscreen-zoom-test"
    type: "test"
    depends-on: ["006"]
  - id: "010"
    subject: "Integrate ZoomableImage into DetailScreen"
    slug: "detailscreen-zoom-impl"
    type: "impl"
    depends-on: ["009", "006"]
  - id: "011"
    subject: "Add Babel config for Reanimated"
    slug: "babel-config-reanimated"
    type: "config"
    depends-on: ["001"]
  - id: "012"
    subject: "Align selection-mode swipe selection with gallery behavior"
    slug: "swipe-selection-optimization"
    type: "impl"
    depends-on: ["008"]
    status: "todo"
    plan: "../2026-05-12-v0-4-1-selection-swipe-design/_index.md"
```

## Task File References

- [Task 001: Install gesture dependencies](./task-001-install-gesture-dependencies.md)
- [Task 002: Configure GestureHandlerRootView](./task-002-configure-gesture-handler-root.md)
- [Task 003: Create useSwipeSelection hook test](./task-003-swipe-selection-hook-test.md)
- [Task 004: Implement useSwipeSelection hook](./task-004-swipe-selection-hook-impl.md)
- [Task 005: Create ZoomableImage component test](./task-005-zoomable-image-test.md)
- [Task 006: Implement ZoomableImage component](./task-006-zoomable-image-impl.md)
- [Task 007: Integrate swipe selection into PhotoGrid test](./task-007-photogrid-swipe-test.md)
- [Task 008: Integrate swipe selection into PhotoGrid](./task-008-photogrid-swipe-impl.md)
- [Task 009: Integrate ZoomableImage into DetailScreen test](./task-009-detailscreen-zoom-test.md)
- [Task 010: Integrate ZoomableImage into DetailScreen](./task-010-detailscreen-zoom-impl.md)
- [Task 011: Add Babel config for Reanimated](./task-011-babel-config-reanimated.md)
- **[TODO]** [Task 012: 相册式滑动选中体验修复](./task-012-swipe-selection-optimization.md)

## BDD Coverage

### 滑动批量选中 (Swipe Selection)

| Scenario | Task Coverage | Status |
|----------|---------------|--------|
| 长按进入选中模式 | Task 008 (PhotoGrid 集成) | ✅ |
| 轻触选择单个项 | Task 004 (Hook), Task 008 (Grid) | 🟡 需优化 |
| 滑动选中多个项 | Task 004 (Hook), Task 008 (Grid) | ✅ |
| 矩形区域选中 | Task 004 (Hook) | ✅ |
| 滑动后正常滚动 | Task 012 (相册式手势仲裁) | 🔴 当前主线 |
| 反向滑动取消选中 | Task 012 (批量 selection 模型) | 🟡 需重验 |
| 全不选保持选中模式 | Task 008 (Grid) | ✅ |
| 点击 X 退出选中模式 | Task 008 (Grid) | ✅ |
| 非选中模式下滑动不触发 | Task 004 (Hook), Task 008 (Grid) | ✅ |
| 快速滑动不丢帧 | Task 012 (真机验证) | 🟡 需重验 |

### 图片双指缩放 (Pinch Zoom)

| Scenario | Task Coverage | Status |
|----------|---------------|--------|
| 双指展开放大图片 | Task 006 (ZoomableImage) | ✅ |
| 双指收缩缩小图片 | Task 006 (ZoomableImage) | ✅ |
| 缩放小于1时回弹 | Task 006 (ZoomableImage) | ✅ |
| 缩放时平移图片 | Task 006 (ZoomableImage) | ✅ |
| 图片边缘限制平移 | Task 006 (ZoomableImage) | ✅ |
| 视频不支持缩放 | Task 010 (DetailScreen 条件渲染) | ✅ |
| 双击重置缩放 | Task 006 (可选) | ✅ |
| 缩放状态下切换图片 | Task 010 (DetailScreen 状态重置) | ✅ |
| 最大缩放限制 | Task 006 (ZoomableImage) | ✅ |
| 缩放动画流畅 | Task 006 (性能) | ✅ |

## Dependency Chain

```
001 ──→ 002
  │
  └──→ 011

003 ──→ 004 ──→ 007 ──→ 008 ──→ 012

005 ──→ 006 ──→ 009 ──→ 010
```

### 关键依赖说明

- **004 → 007**: useSwipeSelection Hook 必须完成才能在 PhotoGrid 中集成
- **006 → 009**: ZoomableImage 组件必须完成才能在 DetailScreen 中集成
- **001 → 002/011**: 依赖安装后才能配置 GestureHandlerRootView 和 Babel
- **008 → 012**: PhotoGrid 集成完成后才能进行手势优化

## 验收检查清单

- [x] 所有单元测试通过
- [ ] 代码覆盖率 > 80%
- [ ] 无运行时错误和构建错误
- [ ] 滑动批量选中功能正常
  - [x] 基础滑动选中
  - [x] 矩形区域选择
  - [ ] **TODO / Task 012**: 选中模式下纵向拖动可以继续滚动
  - [ ] **TODO / Task 012**: 轻触、横向拖动、斜向拖动意图区分稳定
  - [ ] **TODO / Task 012**: 从已选项开始拖动时批量取消，拖动回退时恢复基线
  - [x] 全不选保持选中模式
  - [x] 点击 X 退出选中模式
- [x] 图片双指缩放功能正常
- [x] 视频不支持缩放
- [ ] 与现有交互模式无冲突

## 已知问题与 TODO

### 滑动选中 (Swipe Selection)

| 问题 | 状态 | 优先级 | 说明 |
|------|------|--------|------|
| 滑动与滚动手势冲突 | 🔴 当前主线 | P0 | 当前使用 `activeOffsetX/Y`，纵向滚动可能被 selection pan 抢占 |
| 轻触 vs 滑动区分 | 🔴 当前主线 | P0 | 轻触应走单项 toggle，拖动选择不应在 `onBegin` 中生效 |
| 拖动回退与反向取消 | 🟡 待实现 | P0 | 需要基于手势开始时的 `selectedIds` 快照做批量 selection |
| 矩形区域选择 | ✅ 已完成 | - | 斜向滑动正确选中矩形区域内所有项 |
| 全不选行为 | ✅ 已完成 | - | 全不选保持选中模式，X 退出 |
| 选中模式状态 | ✅ 已完成 | - | `isSelectionModeActive` 独立状态管理 |

### Task 012 设计入口

Task 012 不再按“调阈值”处理。新的执行入口是 [v0.4.1 选中模式滑动选中体验](../2026-05-12-v0-4-1-selection-swipe-design/_index.md)，核心变更为：

1. 不在 `onBegin` 中修改选中状态。
2. 不使用 `activeOffsetY` 激活滑动选择；改用横向激活和纵向失败边界，让 `FlatList` 继续接管明显纵向滚动。
3. 给拖动选择增加批量 selection API，避免逐项 toggle 破坏拖动回退和反向取消。
4. 用手势开始时的 `selectedIds` 快照作为基线，按当前矩形区域计算下一组选中 id。

## 下一步工作

1. **模型测试**: 补齐轻触、滚动、横向/斜向选择、反向取消、拖动回退的纯函数测试。
2. **API 改造**: 从 controller 到 `PhotoGrid` 增加批量 `onSelectionChange`，保留 `onSelect` 给轻触。
3. **手势仲裁**: 修复 selection pan 与 `FlatList` scroll 的优先级，让纵向滚动恢复。
4. **开发中验证**: 用单测、组件测试、lint/typecheck、Expo dev runtime 日志快速确认无新增错误。
5. **最终端到端验证**: 功能全部完成后，在 Android 真机验证相册式手势体验，并补 Maestro/agent-device 场景。
