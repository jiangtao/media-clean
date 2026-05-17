# Architecture

## 总体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                      MediaCleanerApp                            │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              GestureHandlerRootView                       │  │
│  │                                                           │  │
│  │   ┌─────────────────┐     ┌─────────────────────────┐    │  │
│  │   │   PhotoGrid     │     │     DetailScreen        │    │  │
│  │   │                 │     │                         │    │  │
│  │   │  ┌───────────┐  │     │   ┌─────────────────┐   │    │  │
│  │   │  │ Gesture   │  │     │   │  ZoomableImage  │   │    │  │
│  │   │  │ Detector  │  │     │   │                 │   │    │  │
│  │   │  │           │  │     │   │ ┌─────────────┐ │   │    │  │
│  │   │  │ ┌───────┐ │  │     │   │ │   Pinch     │ │   │    │  │
│  │   │  │ │ Pan   │ │  │     │   │ │ Gesture     │ │   │    │  │
│  │   │  │ │Gesture│ │  │     │   │ └─────────────┘ │   │    │  │
│  │   │  │ └───────┘ │  │     │   │ ┌─────────────┐ │   │    │  │
│  │   │  │ ┌───────┐ │  │     │   │ │    Pan      │ │   │    │  │
│  │   │  │ │FlatList│ │  │     │   │ │  Gesture    │ │   │    │  │
│  │   │  │ │(Scroll)│ │  │     │   │ └─────────────┘ │   │    │  │
│  │   │  │ └───────┘ │  │     │   │ ┌─────────────┐ │   │    │  │
│  │   │  │ └───────────┘  │     │   │ │  Animated   │ │   │    │  │
│  │   │  └──────────────  │     │   │ │    View     │ │   │    │  │
│  │   │                   │     │   │ └─────────────┘ │   │    │  │
│  │   │                   │     │   └─────────────────┘   │    │  │
│  │   └───────────────────┘     └─────────────────────────┘    │  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## 组件详细设计

### 1. useSwipeSelection Hook

**位置**: `src/ui/hooks/useSwipeSelection.ts`

**职责**: 封装滑动批量选中的核心逻辑

**接口**:
```typescript
interface SwipeSelectionOptions {
  candidates: CleanupCandidate[];
  selectedIds: string[];
  onSelect: (id: string) => void;
  gridLayout: MediaGridLayout;
  scrollOffset: number;
  isSelectionMode: boolean;
}

interface SwipeSelectionResult {
  panGesture: PanGesture;
  isSwiping: boolean;
}

function useSwipeSelection(options: SwipeSelectionOptions): SwipeSelectionResult;
```

**核心算法**:
```typescript
// 坐标到网格项的映射
function getItemAtPosition(
  x: number,
  y: number,
  scrollOffset: number,
  layout: MediaGridLayout
): string | null {
  const relativeY = y + scrollOffset - headerHeight;
  const col = Math.floor((x - layout.sidePadding) / (layout.itemSize + layout.spacing));
  const row = Math.floor(relativeY / (layout.itemSize + layout.spacing));
  const index = row * layout.columns + col;
  return candidates[index]?.id ?? null;
}

// PanGesture 配置
const panGesture = Gesture.Pan()
  .enabled(isSelectionMode)
  .onBegin((event) => {
    const id = getItemAtPosition(event.absoluteX, event.absoluteY);
    if (id) runOnJS(onSelect)(id);
  })
  .onUpdate((event) => {
    const id = getItemAtPosition(event.absoluteX, event.absoluteY);
    if (id && !lastSelectedIdRef.current.includes(id)) {
      runOnJS(onSelect)(id);
      lastSelectedIdRef.current.push(id);
    }
  });
```

### 2. ZoomableImage Component

**位置**: `src/ui/components/ZoomableImage.tsx`

**职责**: 封装可缩放的图片组件

**接口**:
```typescript
interface ZoomableImageProps {
  uri: string;
  width: number;
  height: number;
  maxScale?: number;      // 默认 3
  minScale?: number;      // 默认 1
  doubleTapReset?: boolean; // 默认 true
  onScaleChange?: (scale: number) => void;
}
```

**实现结构**:
```typescript
export function ZoomableImage({
  uri,
  width,
  height,
  maxScale = 3,
  minScale = 1,
  doubleTapReset = true,
}: ZoomableImageProps) {
  // 共享值（Reanimated）
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // Pinch 手势
  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = savedScale.value * event.scale;
    })
    .onEnd(() => {
      // 边界检查和回弹
      if (scale.value < minScale) {
        scale.value = withSpring(minScale);
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      } else if (scale.value > maxScale) {
        scale.value = withSpring(maxScale);
      }
      savedScale.value = scale.value;
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  // Pan 手势（仅缩放时启用）
  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      if (scale.value > minScale) {
        translateX.value = savedTranslateX.value + event.translationX;
        translateY.value = savedTranslateY.value + event.translationY;
      }
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  // 组合手势
  const composedGesture = Gesture.Simultaneous(pinchGesture, panGesture);

  // 动画样式
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View style={[{ width, height }, animatedStyle]}>
        <Image
          source={{ uri }}
          style={{ width: '100%', height: '100%' }}
          contentFit="contain"
        />
      </Animated.View>
    </GestureDetector>
  );
}
```

### 3. PhotoGrid 集成手势

**位置**: `src/ui/components/PhotoGrid.tsx`

**变更点**:

1. 添加 `scrollOffset` 状态追踪
2. 使用 `useSwipeSelection` Hook
3. 用 `GestureDetector` 包裹 `FlatList`

```typescript
export function PhotoGrid({
  candidates,
  selectedIds,
  selectionMode,
  onSelect,
  onItemPress,
  onItemLongPress,
  theme,
  gridLayout,
}: PhotoGridProps) {
  const [scrollOffset, setScrollOffset] = useState(0);
  const isSelectionMode = selectionMode ?? selectedIds.length > 0;

  // 使用滑动选中 Hook
  const { panGesture } = useSwipeSelection({
    candidates,
    selectedIds,
    onSelect,
    gridLayout,
    scrollOffset,
    isSelectionMode,
  });

  // FlatList 滚动处理
  const handleScroll = useCallback((event: NativeScrollEvent) => {
    setScrollOffset(event.contentOffset.y);
  }, []);

  return (
    <GestureDetector gesture={panGesture}>
      <FlatList
        // ... 其他 props
        onScroll={handleScroll}
        scrollEventThrottle={16}
      />
    </GestureDetector>
  );
}
```

### 4. DetailScreen 集成 ZoomableImage

**位置**: `src/ui/screens/DetailScreen.tsx`

**变更点**:

替换现有的 `Image` 组件为 `ZoomableImage`（仅图片类型）:

```typescript
// 在 DetailScreen 的 render 中
{activeDetailCandidate.asset.mediaType === 'photo' ? (
  <ZoomableImage
    uri={activeDetailCandidate.asset.uri}
    width={stageSize.width}
    height={stageSize.height}
    maxScale={3}
    minScale={1}
  />
) : (
  <VideoPlayer
    uri={activeDetailCandidate.asset.uri}
    // 视频不支持缩放
  />
)}
```

### 5. Root 组件配置

**位置**: `src/application/MediaCleanerApp.tsx`

**变更点**:

添加 `GestureHandlerRootView` 包裹:

```typescript
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export function MediaCleanerApp() {
  return (
    <GestureHandlerRootView style={styles.root}>
      {/* 现有内容 */}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
```

## 数据流设计

### 滑动选中数据流

```
User Action                    UI Layer                     State Layer
─────────────────────────────────────────────────────────────────────────
手指按下              →    Gesture.onBegin           →   onSelect(id)
                                                           ↓
手指移动              →    Gesture.onUpdate          →   onSelect(id)
                                                           ↓
FlatList 滚动         →    onScroll                  →   scrollOffset
                                                           ↓
选中状态变化          ←    FlatList re-render        ←   selectedIds[]
```

### 缩放数据流

```
User Action                    Gesture Layer               Animated Layer
─────────────────────────────────────────────────────────────────────────
双指展开              →    Pinch.onUpdate            →   scale.value
                                                           ↓
双指收缩              →    Pinch.onUpdate            →   scale.value
                                                           ↓
松开手指              →    Pinch.onEnd               →   边界检查/回弹
                                                           ↓
视图更新              ←    useAnimatedStyle          ←   transform
```

## 手势识别优先级

### PhotoGrid 手势优先级

```
1. selectionMode=false
   └── FlatList 滚动优先
       └── 正常滚动浏览

2. selectionMode=true
   └── PanGesture 优先
       ├── onBegin: 记录起始项
       ├── onUpdate: 批量选中经过项
       └── onEnd: 结束批量选中
```

### DetailScreen 手势优先级

```
ZoomableImage 内部:
├── PinchGesture (缩放)
│   └── onUpdate/onEnd 处理缩放
├── PanGesture (平移)
│   └── 仅在 scale > 1 时启用
└── Simultaneous 组合
    └── 可同时缩放和平移

DetailScreen 整体:
├── 左右滑动：DuplicateCarousel 切换图片
└── ZoomableImage 内部手势
    └── 不与 Carousel 冲突（通过 activeOffsetX 控制）
```

## 性能考量

### 1. 滑动选中性能

| 优化点 | 策略 |
|--------|------|
| 避免频繁 setState | 使用 `runOnJS` 批量处理 |
| 坐标计算缓存 | 预计算网格布局常量 |
| 滚动事件节流 | `scrollEventThrottle={16}` |
| 列表优化 | 保持现有 `FlatList` 优化（`removeClippedSubviews` 等） |

### 2. 缩放性能

| 优化点 | 策略 |
|--------|------|
| 动画线程 | Reanimated 在 UI 线程执行 |
| 避免重渲染 | 使用 `useSharedValue` 而非 `useState` |
| 图片加载 | 复用 expo-image 的缓存策略 |

### 3. 内存管理

- 手势识别器在组件卸载时自动清理
- `useSharedValue` 在组件卸载时自动释放
- FlatList 的 `recyclingKey` 保持图片复用
