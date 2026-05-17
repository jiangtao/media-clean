# Task 009: Integrate ZoomableImage into DetailScreen test

## BDD Scenario

```gherkin
Feature: 详情页图片双指缩放

  Scenario: 视频不支持缩放
    When 用户点击一个视频进入详情页
    Then 视频正常播放
    And 不支持双指缩放操作
    And 双指手势被忽略

  Scenario: 缩放状态下切换图片
    Given 用户正在查看重复组中的图片
    And 当前图片已放大到 2 倍
    When 用户左右滑动切换到组内其他图片
    Then 新图片以原始大小显示
    And 缩放状态重置
```

## Task

Create integration tests for ZoomableImage in DetailScreen.

## Files to Modify

- `src/ui/screens/__tests__/DetailScreen.test.tsx`

## Test Cases

1. **Photo item**: Renders ZoomableImage
2. **Video item**: Does not render ZoomableImage, uses VideoPlayer
3. **Zoom state reset**: When switching images, zoom resets
4. **Duplicate carousel**: Zoom works with carousel
5. **Theme support**: ZoomableImage respects theme

## Implementation Notes

- Mock ZoomableImage component
- Test conditional rendering based on mediaType
- Test carousel integration

## Verification

- [ ] All integration tests pass (Red phase)
- [ ] Existing DetailScreen tests still pass
- [ ] No regression

## depends-on

["006"]
