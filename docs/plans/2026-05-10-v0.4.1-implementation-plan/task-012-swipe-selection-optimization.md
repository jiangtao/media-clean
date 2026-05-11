# Task 012: 滑动选中手势优化

## 背景

滑动选中功能已实现，但在真机测试中发现手势识别需要微调：
1. 滑动和滚动的手势冲突
2. 轻触和滑动的行为区分

## 当前实现

```typescript
// useSwipeSelection.ts
const panGesture = Gesture.Pan()
  .enabled(isSelectionMode)
  .minDistance(8)
  .activeOffsetX([-10, 10])
  .activeOffsetY([-20, 20])
```

## 待优化项

### 1. 手势阈值调整

| 参数 | 当前值 | 建议值 | 说明 |
|------|--------|--------|------|
| `minDistance` | 8 | 15-20 | 轻触不应触发滑动选择 |
| `activeOffsetX` | [-10, 10] | [15, 15] | 水平滑动更易触发选择 |
| `activeOffsetY` | [-20, 20] | [30, 30] | 垂直滚动容忍度更大 |

### 2. 预期行为

- **轻触 (<15px)**: 选择单个项目
- **水平滑动 (>15px)**: 矩形区域选择多个
- **垂直滑动 (>30px)**: 列表滚动
- **斜向滑动**: 矩形区域选择（起点到终点形成的矩形）

## BDD Scenario

```gherkin
Scenario: 轻触选择单个项，滑动选择多个
  Given 已进入选中模式
  When 用户轻触第 1 项（<15px 移动）
  Then 仅第 1 项被选中

  When 用户从第 2 项滑动到第 5 项（>15px 水平移动）
  Then 第 2、3、4、5 项被选中（矩形区域）

  When 用户在网格上垂直滑动（>30px 垂直移动）
  Then 列表正常滚动
  And 不改变选中状态
```

## 实现建议

1. 使用 Gesture.Race 或 Gesture.Simultaneous 组合手势
2. 或者调整 PanGesture 的激活阈值
3. 考虑添加手势方向判断逻辑

## 验收标准

- [ ] 轻触 (<15px) 只选择单个项
- [ ] 滑动 (>15px) 进入矩形选择模式
- [ ] 垂直滑动 (>30px) 正常滚动
- [ ] 快速滑动不丢帧
- [ ] 与长按进入选中模式兼容

## 优先级

P1 - 影响用户体验的核心交互
