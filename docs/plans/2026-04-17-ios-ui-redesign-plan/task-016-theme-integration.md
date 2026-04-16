# Task 016: Theme Integration

## 负责人
王朝

## 任务类型
Implementation

## 目标
将主题系统集成到导航和全局组件，支持系统主题跟随和手动切换。

## BDD 场景

### 场景 8.1: 系统主题跟随

```gherkin
Given 用户设置主题为 "跟随系统"
When 系统切换为深色模式
Then 应用自动切换深色主题
And 所有组件更新颜色

When 系统切换为浅色模式
Then 应用自动切换浅色主题
```

### 场景 8.2: 手动主题切换

```gherkin
Given 用户在设置页面
When 选择 "深色" 主题
Then 应用立即切换深色模式
And 保存用户偏好

When 选择 "浅色" 主题
Then 应用立即切换浅色模式
And 保存用户偏好
```

## 技术规格

### 文件

- `src/theme/navigation-theme.ts`
- `src/navigation/RootNavigator.tsx` (更新)

### 主题集成点

1. **导航主题**
   - NavigationContainer theme
   - Tab bar 颜色
   - Header 颜色

2. **全局组件**
   - SafeAreaView
   - StatusBar
   - 背景色

## 实施步骤

1. **创建 Navigation Theme**
   - 适配 React Navigation
   - 使用 AppThemePalette
   - 支持深色/浅色

2. **更新 RootNavigator**
   - 注入导航主题
   - 监听主题变化
   - 动态更新

3. **更新 Tab Bar**
   - 激活/未激活颜色
   - 背景色
   - 徽章颜色

4. **测试主题切换**
   - 系统跟随
   - 手动切换
   - 持久化

## 验证标准

- [ ] 导航主题正确应用
- [ ] Tab bar 颜色正确
- [ ] 系统主题跟随正常
- [ ] 手动切换正常
- [ ] 所有组件响应主题

## 依赖
- Task 003: Bottom Tab Navigation Implementation

## 预估工作量
3-4 小时
