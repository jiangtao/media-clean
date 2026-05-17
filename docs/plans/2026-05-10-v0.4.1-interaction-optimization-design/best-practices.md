# Best Practices

## 实现注意事项

### 1. 手势库集成

#### 安装依赖

```bash
npx expo install react-native-gesture-handler react-native-reanimated
```

#### Babel 配置

在 `babel.config.js` 中添加 Reanimated 插件：

```javascript
module.exports = {
  presets: ['babel-preset-expo'],
  plugins: ['react-native-reanimated/plugin'],
};
```

**注意**: 修改 Babel 配置后需要清除缓存：

```bash
npx expo start --clear
```

#### Root View 包裹

必须在应用根组件包裹 `GestureHandlerRootView`：

```typescript
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* 应用内容 */}
    </GestureHandlerRootView>
  );
}
```

**重要**: Android 的 Modal 也需要独立包裹 `GestureHandlerRootView`。

### 2. 滑动选中实现要点

#### 坐标计算精度

确保手指位置到网格项的映射准确：

```typescript
function getItemAtPosition(
  x: number,
  y: number,
  scrollOffset: number,
  layout: MediaGridLayout
): string | null {
  // 考虑安全区域边距
  const relativeX = x - layout.sidePadding;
  // 考虑滚动偏移和头部高度
  const relativeY = y + scrollOffset - headerHeight;

  // 边界检查
  if (relativeX < 0 || relativeY < 0) return null;

  const col = Math.floor(relativeX / (layout.itemSize + layout.spacing));
  const row = Math.floor(relativeY / (layout.itemSize + layout.spacing));

  // 列数检查
  if (col < 0 || col >= layout.columns) return null;

  const index = row * layout.columns + col;
  return candidates[index]?.id ?? null;
}
```

#### 与 FlatList 滚动协调

滑动选中手势与 FlatList 滚动可能冲突，需要正确处理：

```typescript
// 方案1: 通过 selectionMode 控制
const panGesture = Gesture.Pan()
  .enabled(isSelectionMode) // 非选中模式下禁用
  .onBegin(...)
  .onUpdate(...);

// 方案2: 使用 waitFor/activeOffset
const panGesture = Gesture.Pan()
  .activeOffsetX([-10, 10])  // X轴移动10px才激活
  .activeOffsetY([-10, 10])  // Y轴移动10px才激活
  .onBegin(...);
```

#### 批量选中优化

避免频繁调用 `onSelect`：

```typescript
const lastSelectedRef = useRef<Set<string>>(new Set());

const panGesture = Gesture.Pan()
  .onUpdate((event) => {
    const id = getItemAtPosition(event.absoluteX, event.absoluteY);
    if (id && !lastSelectedRef.current.has(id)) {
      lastSelectedRef.current.add(id);
      runOnJS(onSelect)(id); // 只在新增时调用
    }
  })
  .onEnd(() => {
    lastSelectedRef.current.clear();
  });
```

### 3. 缩放实现要点

#### 边界回弹动画

```typescript
.onEnd(() => {
  if (scale.value < minScale) {
    // 使用弹簧动画回弹
    scale.value = withSpring(minScale, {
      damping: 15,
      stiffness: 150,
    });
    // 同时重置平移
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
  } else if (scale.value > maxScale) {
    scale.value = withSpring(maxScale);
  }
  savedScale.value = scale.value;
});
```

#### 平移边界限制

防止平移时图片移出可视区域：

```typescript
.onUpdate((event) => {
  if (scale.value > minScale) {
    const maxTranslateX = (width * scale.value - width) / 2;
    const maxTranslateY = (height * scale.value - height) / 2;

    let newX = savedTranslateX.value + event.translationX;
    let newY = savedTranslateY.value + event.translationY;

    // 边界限制
    newX = Math.max(-maxTranslateX, Math.min(maxTranslateX, newX));
    newY = Math.max(-maxTranslateY, Math.min(maxTranslateY, newY));

    translateX.value = newX;
    translateY.value = newY;
  }
})
```

#### 双击重置

```typescript
const doubleTapGesture = Gesture.Tap()
  .numberOfTaps(2)
  .onEnd(() => {
    if (scale.value > minScale) {
      // 重置到原始大小
      scale.value = withSpring(minScale);
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
      savedScale.value = minScale;
      savedTranslateX.value = 0;
      savedTranslateY.value = 0;
    }
  });

// 组合单击和双击
const composedGesture = Gesture.Exclusive(doubleTapGesture, singleTapGesture);
```

### 4. 测试最佳实践

#### 单元测试手势 Hook

```typescript
import { renderHook, act } from '@testing-library/react-native';

describe('useSwipeSelection', () => {
  it('should calculate correct item index from position', () => {
    const { result } = renderHook(() => useSwipeSelection({
      candidates: mockCandidates,
      gridLayout: mockLayout,
      // ...
    }));

    const itemId = result.current.getItemAtPosition(100, 200, 0);
    expect(itemId).toBe('expected-id');
  });
});
```

#### 测试手势事件

```typescript
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jestUtils';

describe('ZoomableImage', () => {
  it('should handle pinch gesture', () => {
    const { getByTestId } = render(<ZoomableImage {...props} />);

    const image = getByTestId('zoomable-image');
    fireGestureHandler(image, [
      { state: State.BEGAN, scale: 1 },
      { state: State.ACTIVE, scale: 1.5 },
      { state: State.END, scale: 2 },
    ]);

    // 验证 scale 值
  });
});
```

### 5. 常见陷阱与规避

| 陷阱 | 问题 | 解决方案 |
|------|------|----------|
| 忘记包裹 GestureHandlerRootView | 手势完全失效 | 在 App 根组件添加 |
| 未启用 Reanimated 插件 | 动画不生效 | 配置 babel.config.js |
| FlatList 与手势冲突 | 滑动时列表不滚动 | 通过 enabled/activeOffset 控制 |
| 坐标计算忽略滚动偏移 | 选中项不准确 | 实时同步 scrollOffset |
| scale < 1 不回弹 | 图片过小 | onEnd 时检查并回弹 |
| 未保存手势状态 | 连续手势异常 | 使用 savedScale/savedTranslate |
| 视频也启用缩放 | 不符合需求 | 条件渲染 ZoomableImage |
| 边界计算错误 | 平移超出图片 | 正确计算 maxTranslate |

### 6. 与现有代码整合要点

#### 保持 TouchSurface 的现有行为

`TouchSurface` 的点击和长按逻辑保持不变：

```typescript
// PhotoGridItem 内部仍使用 TouchSurface
<TouchSurface
  onPress={handlePress}
  onLongPress={handleLongPress}
  // ...
/>

// PhotoGrid 外层包裹 GestureDetector 处理滑动
<GestureDetector gesture={panGesture}>
  <FlatList ... />
</GestureDetector>
```

#### 复用现有选中状态管理

滑动选中复用现有的 `onSelect` 回调：

```typescript
// 现有逻辑
const handleSelect = useCallback((id: string) => {
  dispatch({ type: 'toggle-select', id });
}, [dispatch]);

// 滑动选中直接调用
runOnJS(onSelect)(id);
```

#### 复用现有主题系统

`ZoomableImage` 复用 `contentFit="contain"` 和主题配置：

```typescript
<Image
  source={{ uri }}
  style={animatedStyle}
  contentFit="contain"  // 保持与现有一致
  cachePolicy="memory-disk"  // 保持缓存策略
/>
```

### 7. 无障碍考虑

- 确保手势操作有替代方案（如通过按钮批量选择）
- 缩放后的图片仍支持屏幕阅读器
- 测试 TalkBack/VoiceOver 与手势的兼容性

### 8. 机型适配

- 测试不同屏幕密度下的缩放效果
- 测试打孔屏/刘海屏下的手势识别区域
- 测试折叠屏展开/收起状态
