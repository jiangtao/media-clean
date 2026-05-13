# Task 008: Integrate swipe selection into PhotoGrid

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

  Scenario: 滑动选中与点击选中共存
    Given 已进入选中模式
    And 已通过滑动选中第 1、2、3 项
    When 用户点击第 4 项
    Then 第 4 项被添加到选中集合

  Scenario: 选中为空时自动退出选中模式
    Given 已进入选中模式
    And 已选中第 1、2 项
    When 用户取消选中第 1、2 项
    Then 退出选中模式
```

## Task

Integrate useSwipeSelection hook into PhotoGrid component.

## Files to Modify

- `src/ui/components/PhotoGrid.tsx`

## Implementation Steps

1. Import GestureDetector from react-native-gesture-handler
2. Import useSwipeSelection from '../hooks/useSwipeSelection'
3. Add scrollOffset state to track FlatList scroll position
4. Create scroll handler: onScroll={(e) => setScrollOffset(e.nativeEvent.contentOffset.y)}
5. Call useSwipeSelection with candidates, selectedIds, onSelect, gridLayout, scrollOffset, isSelectionMode
6. Wrap FlatList with GestureDetector and pass panGesture
7. Ensure selectionMode flag controls gesture enabled state

## Key Changes

```typescript
const [scrollOffset, setScrollOffset] = useState(0);
const { panGesture } = useSwipeSelection({
  candidates,
  selectedIds,
  onSelect,
  gridLayout,
  scrollOffset,
  isSelectionMode,
});

return (
  <GestureDetector gesture={panGesture}>
    <FlatList
      onScroll={(e) => setScrollOffset(e.nativeEvent.contentOffset.y)}
      scrollEventThrottle={16}
      // ... rest of props
    />
  </GestureDetector>
);
```

## Verification

- [ ] Tests from Task 007 pass (Green phase)
- [ ] Swipe selection works in selection mode
- [ ] Normal scroll works in non-selection mode
- [ ] Click and long press still work
- [ ] No performance degradation

## depends-on

["007", "004"]
