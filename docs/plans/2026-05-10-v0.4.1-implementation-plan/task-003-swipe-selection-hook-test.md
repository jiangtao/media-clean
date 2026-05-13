# Task 003: Create useSwipeSelection hook test

## BDD Scenario

```gherkin
Feature: 滑动批量选中媒体项
  用户在选中模式下可以通过滑动快速选中多个媒体项

  Scenario: 长按进入选中模式
    When 用户长按任意媒体项
    Then 该媒体项被选中
    And 进入选中模式
    And 显示选中指示器

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
    And 保持正常滚动行为
```

## Task

Create unit tests for useSwipeSelection hook.

## Files to Create

- `src/ui/hooks/__tests__/useSwipeSelection.test.ts`

## Test Cases

1. **getItemAtPosition**: Given coordinates, correctly calculates row/col index
2. **getItemAtPosition**: Considers scroll offset in calculation
3. **getItemAtPosition**: Returns null for out-of-bounds coordinates
4. **getItemsInRect**: Given rectangle, returns all covered items
5. **Swipe selection state**: Manages selection state correctly
6. **Integration with onSelect**: Calls onSelect callback correctly

## Implementation Notes

- Mock Gesture Handler and Reanimated for tests
- Test coordinate-to-item mapping logic
- Test scroll offset integration
- Test boundary conditions

## Verification

- [ ] All test cases pass (Red phase)
- [ ] Tests use Vitest framework
- [ ] Tests follow existing patterns in codebase

## depends-on

[]
