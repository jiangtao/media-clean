# Task 012: 相册式滑动选中体验修复

## 背景

滑动选中功能已有基础实现，但 `EXECUTION_SUMMARY.md` 中记录的真机反馈显示：选中模式下“滑动后不能 scroll”，轻触、横向/斜向拖动、纵向滚动之间的意图区分还没有达到系统相册体验。

本任务的完整设计入口是：

- [v0.4.1 选中模式滑动选中体验](../2026-05-12-v0-4-1-selection-swipe-design/_index.md)
- [BDD Specifications](../2026-05-12-v0-4-1-selection-swipe-design/bdd-specs.md)
- [Architecture](../2026-05-12-v0-4-1-selection-swipe-design/architecture.md)
- [Best Practices](../2026-05-12-v0-4-1-selection-swipe-design/best-practices.md)

## 当前实现

```typescript
// useSwipeSelection.ts
const panGesture = Gesture.Pan()
  .enabled(isSelectionMode)
  .minDistance(8)
  .activeOffsetX([-10, 10])
  .activeOffsetY([-20, 20])
```

核心问题：

1. `onBegin` 过早修改选中状态，轻触和滚动意图还没确认就可能触发选择。
2. `activeOffsetY` 会让纵向移动也参与 selection pan，导致 `FlatList` 滚动被拦截。
3. 当前拖动选择使用逐项 `onSelect(id)` toggle，无法稳定表达拖动回退、反向取消和基于当前矩形的预览状态。

## 目标体验

以系统相册/附件选择器为参照：

1. **轻触**：只切换当前媒体项。
2. **横向/斜向拖动**：按起点和当前点构成的矩形批量选择。
3. **纵向拖动**：列表继续滚动，不改变选中集合。
4. **从已选中项开始拖动**：矩形区域批量取消。
5. **同一手势拖动回退**：离开当前矩形的项恢复到手势开始前状态。
6. **全不选**：清空选中项但保持选中模式；X 退出选中模式。

## 执行拆解

### 012.1 模型测试

补齐以下纯函数测试：

1. 坐标到 item 的映射，覆盖 padding、spacing、scrollOffset 和越界。
2. 起点和当前点构成的矩形 index 集合。
3. 轻触、纵向滚动、横向/斜向选择的意图识别。
4. 从基线 `selectedIds` 应用 add/remove 后生成下一组选中 id。
5. 同一手势矩形缩小时恢复基线。

### 012.2 批量 selection API

从 `usePhotoGridSessionController` 到 `PhotoGrid` 增加批量 selection 更新能力：

```typescript
onSelectionChange(nextIds, {
  source: 'swipe-selection',
  action: 'add' | 'remove',
  anchorId,
  rangeIds,
})
```

保留 `onSelect(id)` 给轻触和长按。

### 012.3 手势仲裁

修复 `useSwipeSelection`：

1. 不在 `onBegin` 中选择 item。
2. 不用 `activeOffsetY` 激活选择。
3. 优先使用 `activeOffsetX` + `failOffsetY`，让明显纵向拖动在 selection pan 激活前失败，从而交给 `FlatList` 滚动。
4. 如果真机仍无法兼顾斜向选择和纵向滚动，再评估 `manualActivation(true)`。

### 012.4 集成和验证

1. 更新 `PhotoGrid`、`PhotoGridWorkspace`、`PhotoGridScreen` 的 props 透传。
2. 审计局部 `GestureHandlerRootView` 是否需要保留。
3. 开发进行阶段只跑快反馈验证：相关单测、组件测试、lint/typecheck、Expo dev runtime 日志。
4. 功能全部完成后，再扩展 `.maestro/gesture/swipe-selection.yaml` 和 `docs/testing/gesture-e2e.md`。
5. 功能全部完成后，再真机验证轻触、横滑、斜滑、纵向滚动、反向取消、全不选、X 退出。

## BDD Scenario

完整场景见 [BDD Specifications](../2026-05-12-v0-4-1-selection-swipe-design/bdd-specs.md)。本任务最低必须覆盖：

```gherkin
Scenario: 选中模式下纵向拖动优先滚动列表
  Given 页面已进入选中模式
  And 第 1、2 项已被选中
  When 用户在网格上执行明显纵向拖动
  Then 列表正常滚动
  And 第 1、2 项仍保持选中
  And 不新增或取消任何选中项
```

## 验收标准

开发进行阶段：

- [ ] 相关单测 / 组件测试通过
- [ ] lint/typecheck 无新增错误
- [ ] Expo dev 无红屏
- [ ] Metro/adb 日志无新增 runtime error

功能全部完成后的端到端验收：

- [ ] 轻触只选择单个项
- [ ] 横向拖动进入矩形选择模式
- [ ] 斜向拖动选择完整矩形
- [ ] 纵向拖动正常滚动，选中集合不变
- [ ] 从已选中项开始拖动会批量取消
- [ ] 同一手势拖动回退会恢复基线
- [ ] 快速滑动不明显丢帧
- [ ] 与长按进入选中模式兼容
- [ ] 全不选保持选中模式，X 退出选中模式
- [ ] 无 runtime error、无 build error

## 优先级

P0 - v0.4.1 当前交付主线，直接影响用户能否按相册习惯快速选中图片。
