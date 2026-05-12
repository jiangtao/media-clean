# Task 007: Integrate swipe selection into PhotoGrid test

## BDD Scenario

```gherkin
Feature: 滑动批量选中媒体项

  Scenario: 滑动选中与点击选中共存
    Given 已进入选中模式
    And 已通过滑动选中第 1、2、3 项
    When 用户点击第 4 项
    Then 第 4 项被添加到选中集合
    And 第 1、2、3 项保持选中

  Scenario: 选中为空时自动退出选中模式
    Given 已进入选中模式
    And 已选中第 1、2 项
    When 用户取消选中第 1、2 项
    Then 退出选中模式
    And 选中指示器隐藏

  Scenario: 非选中模式下滑动不触发批量选中
    Given 未进入选中模式
    When 用户在网格上滑动
    Then 不触发任何选中操作
    And 保持正常滚动行为
```

## Task

Create integration tests for swipe selection in PhotoGrid component.

## Files to Modify

- `src/ui/components/__tests__/PhotoGrid.test.tsx`

## Test Cases

1. **selectionMode=false**: Swipe gesture is ignored
2. **selectionMode=true**: Swipe gesture triggers selection
3. **Swipe and click coexist**: Click after swipe adds to selection
4. **Long press still works**: Long press enters selection mode
5. **FlatList scroll**: Scrolling still works in non-selection mode
6. **Gesture coordination**: Swipe and FlatList scroll don't conflict

## Implementation Notes

- Test with mocked useSwipeSelection hook
- Verify GestureDetector wrapping
- Test interaction between swipe and click

## Verification

- [ ] All integration tests pass (Red phase)
- [ ] Existing PhotoGrid tests still pass
- [ ] No regression in existing functionality

## depends-on

["004"]
