# Task 006: Implement ZoomableImage component

## BDD Scenario

```gherkin
Feature: 详情页图片双指缩放

  Scenario: 双指展开放大图片
    When 用户点击一张图片进入详情页
    And 双指展开
    Then 图片开始放大

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

  Scenario: 图片边缘限制平移
    Given 图片已放大到 2 倍
    And 用户拖动到图片边缘
    Then 图片不能继续向该方向移动

  Scenario: 最大缩放限制
    When 用户双指展开放大图片
    Then 最大只能放大到 3 倍
```

## Task

Implement ZoomableImage component with pinch-to-zoom and pan support.

## Files to Create

- `src/ui/components/ZoomableImage.tsx`

## Implementation Steps

1. Import Gesture, PinchGesture, PanGesture from react-native-gesture-handler
2. Import useSharedValue, useAnimatedStyle, withSpring from react-native-reanimated
3. Define ZoomableImageProps interface with uri, width, height, maxScale, minScale
4. Create shared values for scale, translateX, translateY
5. Implement PinchGesture:
   - onUpdate: scale.value = savedScale.value * event.scale
   - onEnd: boundary checks and spring animation if scale < 1
6. Implement PanGesture:
   - onUpdate: translate values (only if scale > 1)
   - onEnd: save translate values
7. Combine with Gesture.Simultaneous
8. Wrap Image with Animated.View and apply animated style

## Key Logic

```typescript
const pinchGesture = Gesture.Pinch()
  .onUpdate((event) => {
    scale.value = savedScale.value * event.scale;
  })
  .onEnd(() => {
    if (scale.value < 1) {
      scale.value = withSpring(1);
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
    }
    savedScale.value = scale.value;
  });

const composedGesture = Gesture.Simultaneous(pinchGesture, panGesture);
```

## Verification

- [ ] Tests from Task 005 pass (Green phase)
- [ ] Component renders without error
- [ ] Pinch zoom works correctly
- [ ] Pan works when zoomed
- [ ] Bounce-back animation works

## depends-on

["005"]
