# Task 003: Bottom Tab Navigation Implementation

## 负责人
张龙

## 任务类型
Implementation (Green)

## 目标
实现底部 Tab 导航组件，支持 iOS 风格标签、激活状态切换和徽章显示。

## BDD 场景

### 场景 1.1: 用户切换 Tab

```gherkin
Given 用户已授权并打开应用
When 用户点击底部 "回收站" Tab
Then 界面切换到回收站页面
And 底部 "回收站" Tab 变为激活状态

When 用户点击底部 "设置" Tab
Then 界面切换到设置页面
And 底部 "设置" Tab 变为激活状态

When 用户点击底部 "照片" Tab
Then 界面返回照片主屏
And 底部 "照片" Tab 变为激活状态
```

### 场景 1.2: Tab 徽章显示

```gherkin
Given 回收站有 5 个待恢复项目
When 用户在任何 Tab 页面
Then "回收站" Tab 显示红色徽章数字 "5"

Given 扫描完成后有 12 个问题照片
When 用户在照片 Tab
Then "照片" Tab 不显示徽章（仅回收站显示）
```

## 技术规格

### 组件

- `src/navigation/MainTabNavigator.tsx`
- `src/ui/components/TabBar.tsx` (自定义 iOS 风格 tab bar)

### iOS 风格规范

| 元素 | 规格 |
|------|------|
| Tab 位置 | 底部 |
| Tab 数量 | 3 |
| 图标大小 | 25×25 pt |
| 激活颜色 | systemBlue |
| 未激活颜色 | systemGray |
| 徽章颜色 | systemRed |
| 触摸目标 | 44×44 pt |

## 实施步骤

1. **创建 TabBar 组件**
   - 自定义 iOS 风格 tab bar
   - 支持激活/未激活状态
   - 支持徽章显示
   - 模糊背景效果（可选）

2. **配置 MainTabNavigator**
   - 3 个 tabs：照片、回收站、设置
   - 配置 SF Symbols 图标（或类似图标）
   - 中文标签：照片、回收站、设置

3. **实现徽章逻辑**
   - 从 context/store 读取回收站数量
   - 动态更新徽章数字
   - 数量为零时隐藏徽章

4. **添加动画**
   - Tab 切换动画（0.3s 淡入淡出）
   - 徽章出现/消失动画

## 验证标准

- [ ] Task 002 的测试全部通过
- [ ] 底部 Tab 导航显示正确
- [ ] 能在 3 个 tabs 间切换
- [ ] 激活状态正确显示
- [ ] 徽章显示正确（仅回收站）
- [ ] 图标和标签使用 iOS 风格

## 依赖
- Task 002: Bottom Tab Navigation Test

## 预估工作量
3-4 小时
