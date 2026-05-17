# Task 005: Create ZoomableImage component test

## BDD Scenario

```gherkin
Feature: 详情页图片双指缩放

  Scenario: 双指展开放大图片
    When 用户点击一张图片进入详情页
    And 双指展开
    Then 图片开始放大
    And 放大比例随双指距离变化

  Scenario: 双指收缩缩小图片
    Given 图片已放大到 2 倍
    When 用户双指收缩
    Then 图片开始缩小
    And 最小只能缩小到原始大小（1 倍）

  Scenario: 缩放小于 1 时回弹
    When 用户双指收缩图片到小于原始大小
    And 松开手指
    Then 图片动画回弹到原始大小

  Scenario: 缩放时平移图片
    Given 图片已放大到 2 倍
    When 用户单指拖动
    Then 图片跟随手指移动
    And 可以查看图片的不同区域
```

## Task

Create unit tests for ZoomableImage component.

## Files to Create

- `src/ui/components/__tests__/ZoomableImage.test.tsx`

## Test Cases

1. **Pinch scale calculation**: scale updates correctly based on pinch
2. **Pinch min boundary**: scale cannot go below 1
3. **Pinch max boundary**: scale cannot exceed 3
4. **Pinch onEnd bounce**: scale < 1 animates back to 1
5. **Pan translation**: translateX/Y updates during pan
6. **Pan boundary**: translation limited when at edges
7. **Gesture combination**: Pinch and Pan work simultaneously
8. **Spring animation**: uses withSpring for bounce-back

## Implementation Notes

- Mock react-native-gesture-handler/jestUtils for gesture testing
- Mock Reanimated animations
- Test component props interface

## Verification

- [ ] All test cases pass (Red phase)
- [ ] Tests follow existing component test patterns
- [ ] Tests cover edge cases

## depends-on

[]
