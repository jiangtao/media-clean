# 架构设计 - Claude 遗留缺口收口

## 模块边界

```text
App.tsx
├── SafeAreaProvider
├── AppPreferencesProvider
│   ├── loadAppLanguage / saveAppLanguage
│   ├── loadThemePreference / saveThemePreference
│   └── resolveThemeScheme / getAppTheme / getAppCopy
├── NavigationContainer
│   └── RootNavigator
│       └── MainTabNavigator
│           ├── PhotoGridScreen
│           ├── RecycleBinScreen
│           └── SettingsScreen
└── StatusBar
```

## 关键决策

### 1. 偏好读取只在根层发生

- 过去：`MainTabNavigator`、`SettingsScreen`、页面组件分别读存储。
- 现在：只在 `AppPreferencesProvider` 里读一次，其余都消费上下文。

### 2. 主题与文案一并下发

- 上下文直接暴露 `theme` 和 `copy`，页面不再各自 `getAppTheme()`、`getAppCopy()`。
- 避免“主题变了，文案没变”或“设置页更新后其他页面要等重新 focus”这种漂移。

### 3. 特殊屏适配分两层

- 检测层：`notch-detector.ts` 负责把 `Samsung_S20` 正确识别为 `hole-punch-left`。
- 布局层：页面使用 `safe area insets` 给顶部 header / segmented control / action bar 提供明确偏移。

## 影响文件

### 新增

- `src/application/AppPreferencesContext.tsx`
- 相关测试文件

### 修改

- `App.tsx`
- `src/navigation/MainTabNavigator.tsx`
- `src/ui/screens/PhotoGridScreen.tsx`
- `src/ui/screens/RecycleBinScreen.tsx`
- `src/ui/screens/SettingsScreen.tsx`
- `src/ui/components/SegmentedControl.tsx`
- `src/ui/components/PhotoGrid.tsx`
- `src/i18n/app-copy.ts`
- `src/features/compatibility/notch-detector.ts`
- 相关测试文件

## 验收视角

八贤王验收时按三条链路核对：

1. 目标链：不偏离 `docs/goal/v0.1.md`
2. 行为链：BDD 场景逐条可验证
3. 技术链：入口约定、上下文收口、特殊屏检测和页面安全区都落在代码与测试中
