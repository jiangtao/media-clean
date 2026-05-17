# Task 004: Implement useSwipeSelection hook

## BDD Scenario

```gherkin
Feature: 滑动批量选中媒体项

  Scenario: 水平滑动批量选中
    Given 已进入选中模式
    When 用户在第 1 项按下并开始向右滑动
    And 手指经过第 2、3、4 项
    Then 第 1、2、3、4 项全部被选中

  Scenario: 斜向滑动批量选中
    Given 已进入选中模式
    When 用户从第 1 项（第一行第一列）斜向滑动到第 8 项（第三行第二列）
    Then 手指覆盖区域内的所有项被选中

  Scenario: 非选中模式下滑动不触发批量选中
    Given 未进入选中模式
    When 用户在网格上滑动
    Then 不触发任何选中操作
```

## Task

Implement useSwipeSelection hook for swipe-based batch selection.

## Files to Create

- `src/ui/hooks/useSwipeSelection.ts`

## Implementation Steps

1. Import Gesture and PanGesture from react-native-gesture-handler
2. Import useSharedValue and runOnJS from react-native-reanimated
3. Define interface SwipeSelectionOptions and SwipeSelectionResult
4. Implement getItemAtPosition function (coordinate to item mapping)
5. Create PanGesture with onBegin, onUpdate, onEnd callbacks
6. In onUpdate, calculate touched items and call onSelect via runOnJS
7. Return panGesture and isSwiping state

## Key Logic

```typescript
function getItemAtPosition(x, y, scrollOffset, layout) {
  const relativeY = y + scrollOffset - headerHeight;
  const col = Math.floor((x - layout.sidePadding) / (layout.itemSize + layout.spacing));
  const row = Math.floor(relativeY / (layout.itemSize + layout.spacing));
  return candidates[row * layout.columns + col]?.id ?? null;
}
```

## Verification

- [ ] Tests from Task 003 pass (Green phase)
- [ ] Hook returns valid panGesture
- [ ] Hook respects selectionMode flag
- [ ] Boundary checks work correctly

## depends-on

["003"]
