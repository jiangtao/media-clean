# v0.4.1 交互优化设计方案

## 背景与目标

参考目标文档：[docs/goal/v0.4.1.md](../../goal/v0.4.1.md)

本次迭代聚焦两个核心交互优化：

1. **媒体列表滑动批量选中** - 在选中模式下，支持滑动快速选中多个图片
2. **详情页图片双指缩放** - 支持双指展开放大、收缩缩小，松手后回弹到原始大小

## 需求分析

### 功能1：滑动批量选中

**用户场景**：用户进入选中模式后，想要快速选中多个连续或不连续的媒体项。

**交互细节**：
- 仅在选中模式 (`selectionMode=true`) 下触发
- 手指在网格上滑动，经过的项自动被选中
- 支持水平滑动、垂直滑动、斜向滑动
- 滑动经过的网格项全部加入选中集合

**当前状态**：
- `PhotoGrid` 已有 `selectionMode` 和 `selectedIds` 状态
- 通过 `onSelect(id: string)` 回调切换选中状态
- 使用 `FlatList` 渲染网格，每项尺寸由 `MediaGridLayout` 决定

### 功能2：图片双指缩放

**用户场景**：用户在详情页查看图片时，需要放大查看细节。

**交互细节**：
- 双指展开：图片放大（最大 3 倍）
- 双指收缩：图片缩小（最小 1 倍）
- 松手时若 `scale < 1`，动画回弹到 `scale = 1`
- 视频不支持缩放

**当前状态**：
- `DetailScreen` 使用 `expo-image` 展示图片
- 图片使用 `contentFit="contain"` 适配容器
- 无手势支持

## 技术方案

### 手势库选择：react-native-gesture-handler

基于技术调研，选择 `react-native-gesture-handler` (RGH) + `react-native-reanimated` 方案：

| 优势 | 说明 |
|------|------|
| 原生线程执行 | 手势处理在 UI 线程，不阻塞 JS，流畅度更好 |
| 精确多点触控 | 支持准确的双指缩放追踪 |
| 与 Expo SDK 54 兼容 | 官方支持，维护活跃 |
| 社区生态成熟 | 与 Reanimated 深度集成，动画性能优秀 |

**新增依赖**：
```json
{
  "react-native-gesture-handler": "^2.31.2",
  "react-native-reanimated": "~3.16.1"
}
```

### 架构设计

#### 滑动批量选中架构

```
PhotoGrid (GestureDetector 包裹)
├── PanGesture
│   ├── onBegin: 记录起始项，进入滑动选中状态
│   ├── onUpdate: 实时计算手指位置，映射到网格项，批量选中
│   └── onEnd: 结束滑动选中状态
└── FlatList (渲染网格)
    └── PhotoGridItem
```

**关键实现**：
1. 使用 `absoluteX/absoluteY` 获取手指绝对位置
2. 考虑 `FlatList` 滚动偏移量 (`scrollY`)
3. 根据 `MediaGridLayout` 计算行列索引
4. 通过 `runOnJS` 调用 JS 层的 `onSelect` 回调

#### 图片双指缩放架构

```
DetailScreen
└── ZoomableImage (GestureDetector 包裹)
    ├── PinchGesture (缩放)
    │   ├── onUpdate: 更新 scale
    │   └── onEnd: 边界检查，若 scale < 1 回弹到 1
    ├── PanGesture (平移，仅放大时启用)
    │   ├── onUpdate: 更新 translateX/Y
    │   └── onEnd: 保存位置
    └── Animated.View (包裹 Image)
```

**关键实现**：
1. 使用 `useSharedValue` 存储 scale/translate 值
2. Pinch 和 Pan 使用 `Gesture.Simultaneous` 组合
3. 边界限制：`scale` 范围 [1, 3]
4. 回弹动画使用 `withSpring`

## 文件变更规划

### 新增文件

| 文件路径 | 说明 |
|----------|------|
| `src/ui/components/ZoomableImage.tsx` | 可缩放图片组件 |
| `src/ui/components/__tests__/ZoomableImage.test.tsx` | 单元测试 |
| `src/ui/hooks/useSwipeSelection.ts` | 滑动选中逻辑 Hook |
| `src/ui/hooks/__tests__/useSwipeSelection.test.ts` | 单元测试 |

### 修改文件

| 文件路径 | 变更内容 |
|----------|----------|
| `src/ui/components/PhotoGrid.tsx` | 添加 GestureDetector 包裹，集成滑动选中 |
| `src/ui/screens/DetailScreen.tsx` | 替换 Image 为 ZoomableImage |
| `src/application/MediaCleanerApp.tsx` | 添加 GestureHandlerRootView 包裹 |
| `package.json` | 新增依赖 |
| `babel.config.js` | 添加 Reanimated 插件 |

## 测试策略

遵循用户要求：**先单测，功能完成后端到端测试**

### 单元测试阶段

1. **useSwipeSelection Hook 测试**
   - 计算手指位置到网格项索引的映射
   - 滑动选中状态管理
   - 与 FlatList 滚动偏移的整合

2. **ZoomableImage 组件测试**
   - Pinch 手势缩放计算
   - 边界限制和回弹逻辑
   - Pan 手势平移限制

3. **PhotoGrid 集成测试**
   - 滑动选中与现有点击/长按的共存
   - 选中模式下的手势识别

4. **DetailScreen 集成测试**
   - ZoomableImage 正确渲染
   - 视频项不启用缩放

### 端到端测试阶段（功能完成后）

- 完整用户流程测试
- 多机型适配验证
- 性能基准测试

## Design Documents

- [BDD Specifications](./bdd-specs.md) - 行为场景和测试策略
- [Architecture](./architecture.md) - 详细架构和组件设计
- [Best Practices](./best-practices.md) - 实现注意事项

## 团队成员分工

按照目标文档定义的 Agent Team 结构：

| 成员 | 职责 | 任务 |
|------|------|------|
| 包拯 (Lead) | 总控监督 | 方案评审、最终验收 |
| 公孙策 (架构) | 架构扩展 | 确认手势库集成不影响现有架构 |
| 展昭 (底层执行) | 核心实现 | useSwipeSelection、ZoomableImage 实现 |
| 张龙 (执行者) | PhotoGrid 集成 | 滑动选中与网格集成 |
| 赵虎 (执行者) | DetailScreen 集成 | 图片缩放与详情页集成 |
| 王朝 (执行者) | 单元测试 | Hook 和组件单元测试 |
| 马汉 (执行者) | 配置集成 | 依赖安装、Babel 配置、根组件修改 |
| 八贤王 (验收) | 高标准验收 | 代码审查、测试覆盖检查 |

## 验收标准

1. **功能完整性**
   - [ ] 选中模式下滑动可选中多个网格项
   - [ ] 斜向滑动覆盖区域内的项被选中
   - [ ] 非选中模式滑动不触发批量选中
   - [ ] 详情页图片支持双指缩放
   - [ ] 缩放范围限制 1-3 倍
   - [ ] 缩放 < 1 时松手回弹到原始大小
   - [ ] 视频不支持缩放

2. **代码质量**
   - [ ] 单元测试覆盖率 > 80%
   - [ ] 无运行时错误和构建错误
   - [ ] 符合现有代码风格

3. **用户体验**
   - [ ] 手势响应流畅，无明显延迟
   - [ ] 与现有交互模式（点击、长按）无冲突
