# v0.4.1 交互优化实施计划

## 计划概述

**目标文档**: [docs/goal/v0.4.1.md](../../goal/v0.4.1.md)
**设计方案**: [docs/plans/2026-05-10-v0.4.1-interaction-optimization-design/_index.md](../2026-05-10-v0.4.1-interaction-optimization-design/_index.md)
**BDD 规范**: [docs/plans/2026-05-10-v0.4.1-interaction-optimization-design/bdd-specs.md](../2026-05-10-v0.4.1-interaction-optimization-design/bdd-specs.md)

## 目标

实现两个核心交互优化功能：
1. **滑动批量选中** - 选中模式下滑动可选中多个网格项
2. **图片双指缩放** - 详情页图片支持双指缩放

## 约束与前提

- 使用 `react-native-gesture-handler` + `react-native-reanimated`
- 遵循 **先单测，功能完成后端到端测试** 的流程
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
    subject: "Optimize swipe selection gestures"
    slug: "swipe-selection-optimization"
    type: "impl"
    depends-on: ["008"]
    status: "todo"
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
- **[TODO] Task 012: 滑动选手势优化**](./task-012-swipe-selection-optimization.md)

## BDD Coverage

### 滑动批量选中 (Swipe Selection)

| Scenario | Task Coverage | Status |
|----------|---------------|--------|
| 长按进入选中模式 | Task 008 (PhotoGrid 集成) | ✅ |
| 轻触选择单个项 | Task 004 (Hook), Task 008 (Grid) | 🟡 需优化 |
| 滑动选中多个项 | Task 004 (Hook), Task 008 (Grid) | ✅ |
| 矩形区域选中 | Task 004 (Hook) | ✅ |
| 滑动后正常滚动 | Task 008 (Grid) | 🟡 待优化 |
| 反向滑动取消选中 | Task 004 (Hook) | ✅ |
| 全不选保持选中模式 | Task 008 (Grid) | ✅ |
| 点击 X 退出选中模式 | Task 008 (Grid) | ✅ |
| 非选中模式下滑动不触发 | Task 004 (Hook), Task 008 (Grid) | ✅ |
| 快速滑动不丢帧 | Task 008 (性能测试) | ✅ |

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
  - [ ] **TODO**: 滑动与滚动手势区分优化
  - [ ] **TODO**: 轻触与滑动行为细化
  - [x] 全不选保持选中模式
  - [x] 点击 X 退出选中模式
- [x] 图片双指缩放功能正常
- [x] 视频不支持缩放
- [ ] 与现有交互模式无冲突

## 已知问题与 TODO

### 滑动选中 (Swipe Selection)

| 问题 | 状态 | 优先级 | 说明 |
|------|------|--------|------|
| 滑动与滚动手势冲突 | 🟡 待优化 | P1 | 当前使用 `activeOffsetX/Y` 区分，需要微调阈值 |
| 轻触 vs 滑动区分 | 🟡 待优化 | P1 | 轻触应选单个，滑动应选多个，需优化手势识别 |
| 矩形区域选择 | ✅ 已完成 | - | 斜向滑动正确选中矩形区域内所有项 |
| 全不选行为 | ✅ 已完成 | - | 全不选保持选中模式，X 退出 |
| 选中模式状态 | ✅ 已完成 | - | `isSelectionModeActive` 独立状态管理 |

### 待优化手势参数

```typescript
// useSwipeSelection.ts
const panGesture = Gesture.Pan()
  .enabled(isSelectionMode)
  .minDistance(8)           // TODO: 可能需要调整到 15-20
  .activeOffsetX([-10, 10]) // TODO: 可能需要调整到 15-20
  .activeOffsetY([-20, 20]) // TODO: 可能需要更大容忍度如 30-40
```

## 下一步工作

1. **手势优化**: 调整手势参数，测试不同阈值下的用户体验
2. **真机测试**: 在实际设备上验证手势响应
3. **边界测试**: 测试快速滑动、短距离滑动等边界情况
