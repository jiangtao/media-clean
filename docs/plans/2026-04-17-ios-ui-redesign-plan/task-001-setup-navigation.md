# Task 001: Setup React Navigation

## 负责人
公孙策 (架构)

## 任务类型
Setup / Config

## 目标
安装和配置 React Navigation 基础环境，为 iOS 风格 UI 重新设计建立导航基础。

## BDD 场景

此任务为基础设施设置，无特定 BDD 场景。依赖后续任务验证导航功能。

## 技术规格

### 依赖安装

```json
{
  "@react-navigation/native": "^7.0.0",
  "@react-navigation/bottom-tabs": "^7.0.0",
  "@react-navigation/native-stack": "^7.0.0",
  "react-native-screens": "^4.0.0",
  "react-native-safe-area-context": "^5.0.0"
}
```

### 文件结构创建

```
src/
├── navigation/
│   ├── RootNavigator.tsx
│   ├── MainTabNavigator.tsx
│   └── types.ts
```

## 实施步骤

1. **安装依赖**
   ```bash
   npm install @react-navigation/native @react-navigation/bottom-tabs @react-navigation/native-stack react-native-screens react-native-safe-area-context
   ```

2. **配置 Babel**（如需要）
   - 检查是否需要 `react-native-reanimated` 的 babel 插件配置

3. **创建导航类型定义** (`src/navigation/types.ts`)
   - 定义 RootStackParamList
   - 定义 MainTabParamList
   - 定义 Navigation 类型

4. **创建根导航器** (`src/navigation/RootNavigator.tsx`)
   - 使用 NativeStackNavigator
   - 包裹 MainTabNavigator

5. **创建 Tab 导航器** (`src/navigation/MainTabNavigator.tsx`)
   - 使用 BottomTabNavigator
   - 定义 3 个 tabs：Photos、RecycleBin、Settings
   - 配置基本选项（占位屏幕）

6. **更新应用入口** (`App.tsx`)
   - 替换为 NavigationContainer
   - 注入 RootNavigator

## 验证标准

- [ ] 所有依赖成功安装，无冲突
- [ ] 应用能正常编译启动
- [ ] 底部 Tab 导航显示（3 个 tabs）
- [ ] 能在 tabs 间切换
- [ ] 无 TypeScript 类型错误

## 依赖
无

## 预估工作量
1-2 小时
