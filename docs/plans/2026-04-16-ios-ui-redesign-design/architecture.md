# 架构设计 - iOS 风格 UI 重新设计

## 1. 导航架构

### 1.1 决策：React Navigation 底部 Tab

**选择理由：**

| 标准 | Expo Router | React Navigation |
|------|-------------|------------------|
| 当前代码库适配 | 需要重构为基于文件的路由 | 可直接添加到现有架构 |
| 迁移复杂度 | 高 - 需要重新组织路由文件 | 低 - 可以包装现有 MediaCleanerApp |
| Tab 导航控制 | 基于文件，控制较少 | 程序化，完整 API 控制 |
| TypeScript 支持 | 自动静态类型 | 手动但显式类型 |

**推荐：React Navigation 底部 Tab**

### 1.2 导航结构

```
Root Stack Navigator
└── Main Tab Navigator (底部 Tabs)
    ├── PhotosTab (Stack Navigator)
    │   ├── PhotoGridScreen
    │   ├── DetailScreen (支持水平滑动)
    │   └── ScanProgressScreen (模态覆盖)
    ├── RecycleBinTab (Stack Navigator)
    │   ├── RecycleGridScreen
    │   └── DetailScreen
    └── SettingsTab
        └── SettingsScreen
```

### 1.3 依赖项

```json
{
  "@react-navigation/native": "^7.0.0",
  "@react-navigation/bottom-tabs": "^7.0.0",
  "@react-navigation/native-stack": "^7.0.0",
  "react-native-screens": "^4.0.0",
  "react-native-safe-area-context": "^5.0.0"
}
```

## 2. 组件层次结构

### 2.1 新目录结构

```
src/
├── application/
│   └── MediaCleanerApp.tsx          (重构为使用导航)
├── navigation/
│   ├── RootNavigator.tsx            (根栈)
│   ├── MainTabNavigator.tsx         (底部 tabs)
│   └── types.ts                     (导航类型定义)
├── ui/
│   ├── components/                  (新共享组件)
│   │   ├── TabBar.tsx              (自定义 iOS 风格 tab bar)
│   │   ├── PhotoGrid.tsx           (iOS 照片风格网格)
│   │   ├── PhotoGridItem.tsx       (单个网格单元)
│   │   ├── ScanProgress.tsx        (扫描动画覆盖层)
│   │   ├── ScanCounter.tsx         (动画计数器)
│   │   ├── SelectionBar.tsx        (底部选择工具栏)
│   │   ├── EmptyState.tsx          (空网格占位)
│   │   └── SegmentedControl.tsx    (iOS 风格分段控制器)
│   ├── screens/
│   │   ├── PhotoGridScreen.tsx     (主照片视图)
│   │   ├── RecycleBinScreen.tsx    (回收站网格)
│   │   ├── SettingsScreen.tsx      (专用设置页)
│   │   └── DetailScreen.tsx        (iOS 风格详情 + 滑动)
│   ├── modals/
│   │   ├── PreviewModal.tsx        (现有 - 保留)
│   │   └── ScanModal.tsx           (扫描进度模态)
│   ├── CandidateCard.tsx           (现有 - 重构)
│   └── PreviewModal.tsx            (现有 - 移到 modals/)
└── theme/
    └── navigation-theme.ts          (导航主题)
```

## 3. 动画策略

### 3.1 库选择

| 动画类型 | 库 | 原因 |
|----------|-----|------|
| 扫描进度计数器 | Reanimated 3 | 60fps+ 原生线程，流畅数字过渡 |
| 扫描圆形进度 | Reanimated 3 | SVG 路径动画，旋转 |
| 网格项选择 | Reanimated 3 | 布局动画，缩放效果 |
| Tab 切换 | React Navigation | 内置淡入/移动过渡 |
| 详情视图滑动 | React Native Gesture Handler + Reanimated | 原生手势处理 |
| 下拉刷新 | Native | 平台原生刷新控件 |
| 成功勾选 | Lottie | 复杂矢量动画 |

### 3.2 推荐依赖

```json
{
  "react-native-reanimated": "^3.16.0",
  "react-native-gesture-handler": "^2.21.0",
  "lottie-react-native": "^7.1.0",
  "@shopify/flash-list": "^1.7.0"
}
```

## 4. 状态管理变更

### 4.1 当前状态分析

当前 `MediaCleanerApp.tsx` 中的状态：
- `viewMode`: 'suggestions' | 'recycle'（将被导航替代）
- `recognitionFilter`: 过滤状态（移到 Photos 屏幕）
- `cleanupState`: 候选项和回收站（在 tabs 间分割）
- `selectedIds`: 选择状态（每个 tab）
- `isScanning`: 扫描状态（全局）
- `previewCandidate`: 模态状态（导航参数）

### 4.2 新状态架构

#### 全局状态（应用级）

```typescript
// src/application/AppState.tsx
interface AppState {
  // 扫描中
  isScanning: boolean;
  scanProgress: ScanProgress | null;

  // 共享数据
  candidates: CleanupCandidate[];
  recycleBin: CleanupCandidate[];

  // 设置
  language: AppLanguage;
  themePreference: AppThemePreference;
  reminderSettings: ReminderSettings;

  // 权限
  mediaPermission: PermissionState;
  notificationPermission: boolean;
}
```

#### Photos Tab 状态

```typescript
// src/features/photos/photos-state.ts
interface PhotosState {
  filter: RecognitionFilter;
  selectedIds: string[];
  sortOrder: 'score' | 'date';
  viewMode: 'grid' | 'list';
}
```

#### Recycle Bin 状态

```typescript
// src/features/recycle-bin/recycle-bin-state.ts
interface RecycleBinState {
  selectedIds: string[];
  sortOrder: 'date' | 'size';
}
```

## 5. 迁移计划

### 阶段 1：设置导航（第1周）

1. 安装 React Navigation 依赖
2. 创建导航类型定义
3. 设置基本 tab navigator 和占位屏幕
4. 验证应用构建和 tabs 工作

**创建文件：**
- `src/navigation/types.ts`
- `src/navigation/RootNavigator.tsx`
- `src/navigation/MainTabNavigator.tsx`

### 阶段 2：提取屏幕（第2周）

1. 将当前 `MediaCleanerApp` 内容移到 `PhotoGridScreen`
2. 从 recycle tab 内容创建 `RecycleBinScreen`
3. 从 settings 部分创建 `SettingsScreen`
4. 移除内联 tab 切换器

**关键变更：**
- 移除 `viewMode` 状态
- 从全局状态移除 `recognitionFilter`
- 将设置 UI 提取到专用屏幕

### 阶段 3：构建照片网格（第3周）

1. 创建 `PhotoGrid` 组件，3列布局
2. 实现按日期分段标题
3. 添加选择模式和勾选标记
4. 从 `CandidateCard` 列表迁移到网格项
5. 添加下拉刷新

### 阶段 4：添加动画（第4周）

1. 安装 Reanimated 并配置 babel 插件
2. 创建 `ScanProgress` 组件，带计数器动画
3. 添加网格选择动画
4. 实现详情视图滑动手势

### 阶段 5：打磨和测试（第5周）

1. 添加 iOS 风格空状态
2. 在 tab bar 实现徽章计数
3. 导航的主题集成
4. 在 iOS 和 Android 上测试
5. 性能优化

## 6. 主题集成

### 6.1 导航主题

创建 `src/theme/navigation-theme.ts`：

```typescript
import { Theme } from '@react-navigation/native';

export function createNavigationTheme(appTheme: AppThemePalette): Theme {
  return {
    dark: appTheme.scheme === 'dark',
    colors: {
      primary: appTheme.buttonPrimaryBackground,
      background: appTheme.safeArea,
      card: appTheme.cardBackground,
      text: appTheme.pageTextPrimary,
      border: appTheme.cardBorder,
      notification: appTheme.buttonDangerBackground,
    },
  };
}
```

### 6.2 Tab Bar 主题

- 激活 tab: `tabActiveBackground` / `tabActiveText`
- 未激活 tab: `tabBackground` / `tabText`
- 徽章: `buttonDangerBackground`

## 7. 关键实现说明

### 7.1 照片网格性能

- 使用 Shopify 的 `FlashList` 进行虚拟化网格
- 使用 `expo-image` 实现图像缓存
- 延迟加载缩略图
- 对网格项使用 `React.memo`

### 7.2 扫描进度 UX

- 在初始权限授予时显示
- 允许后台扫描（保持模态）
- 在关闭前动画到完成
- 扫描后显示摘要

### 7.3 选择模式

- 长按进入选择模式
- 点击选择/取消选择
- 底部出现选择栏（类似 iOS 照片）
- "全选" 和 "取消全选" 选项

### 7.4 设置屏幕

从内联卡片移到专用屏幕：
- 扫描范围滑块（新功能）
- 语言选择（保留）
- 主题选择（保留）
- 提醒设置（保留）
- 关于部分（新）

## 8. 风险缓解

| 风险 | 缓解措施 |
|------|----------|
| 破坏现有功能 | 分阶段迁移，保持测试通过 |
| 性能回归 | 使用 FlashList，在低端设备上测试 |
| 导航复杂度 | 从简单开始，稍后添加深度链接 |
| 动画卡顿 | 在 UI 线程使用 Reanimated，使用 Flipper 分析 |

## 9. 成功标准

- [ ] 底部 tab 导航，3 个 tabs 正常工作
- [ ] 照片网格以 3 列布局显示候选项
- [ ] 扫描进度显示动画计数器
- [ ] 详情视图支持水平滑动查看重复项
- [ ] 设置页面有扫描范围滑块
- [ ] iOS 风格视觉设计匹配系统应用
- [ ] 所有现有测试通过
- [ ] 为导航流程添加新的 UI 测试
