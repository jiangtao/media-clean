# Task 002: Bottom Tab Navigation Test

## 负责人
张龙

## 任务类型
Test (Red)

## 目标
为底部 Tab 导航编写测试，验证 tab 切换和徽章显示功能。

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

## 测试文件

- `src/navigation/__tests__/MainTabNavigator.test.tsx`
- `src/navigation/__tests__/TabBar.test.tsx`

## 测试要点

1. **Tab 切换测试**
   - 模拟用户点击每个 tab
   - 验证对应屏幕渲染
   - 验证激活状态更新

2. **徽章显示测试**
   - 设置回收站项目数量
   - 验证徽章数字显示正确
   - 验证徽章颜色（红色）

3. **无障碍测试**
   - 验证 tab 有正确的 accessibilityLabel
   - 验证屏幕阅读器能正确读取

## 验证标准

- [ ] 所有测试用例通过
- [ ] 覆盖 tab 切换场景
- [ ] 覆盖徽章显示场景
- [ ] 测试文件包含完整 BDD 场景注释

## 依赖
- Task 001: Setup React Navigation

## 预估工作量
2-3 小时
