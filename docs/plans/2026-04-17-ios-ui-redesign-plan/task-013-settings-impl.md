# Task 013: Settings Screen Implementation

## 负责人
张龙

## 任务类型
Implementation (Green)

## 目标
实现 iOS 风格的设置页面，支持扫描范围滑块、语言、主题和提醒设置。

## BDD 场景

### 场景 6.1: 扫描范围设置

```gherkin
Given 用户在设置页面
When 查看 "扫描范围" 选项
Then 显示滑块控件
And 显示当前值 "最近 2 个月"
And 可选值：1/2/3/6/12 个月

When 用户拖动滑块到 "3 个月"
Then 更新显示 "最近 3 个月"
And 下次扫描使用新范围
```

### 场景 6.2: 语言和主题设置

```gherkin
Given 用户在设置页面
When 点击 "语言" 选项
Then 进入语言选择页面
And 显示选项：简体中文、English

When 点击 "外观" 选项
Then 进入主题选择页面
And 显示选项：跟随系统、浅色、深色
```

### 场景 6.3: 定期清理提醒

```gherkin
Given 用户在设置页面
When 开关 "定期清理提醒"
Then 开启/关闭提醒功能

Given 提醒已开启
When 用户设置提醒频率
Then 可选：每日、每周

Given 选择每周频率
When 用户选择星期几
Then 显示选项：周一到周日

Given 用户设置时间
Then 显示时间选择器
And 默认 9:00
```

## 技术规格

### 组件

- `src/ui/screens/SettingsScreen.tsx`
- `src/ui/components/SettingsSection.tsx`
- `src/ui/components/ScanRangeSlider.tsx`

### 存储

- `src/services/storage/scan-range-storage.ts`

### iOS 风格规范

| 元素 | 规格 |
|------|------|
| 表格样式 | Grouped（iOS 13+） |
| 滑块 | 离散值，吸附行为 |
| 开关 | iOS 风格 UISwitch |
| 导航 | 箭头指示，右对齐 |
| 间距 | 16pt 边距 |

## 实施步骤

1. **创建扫描范围存储**
   - `scan-range-storage.ts`
   - 保存月数（1/2/3/6/12）
   - 默认 2 个月

2. **创建 SettingsSection 组件**
   - iOS 风格分组标题
   - 圆角卡片样式
   - 内部分隔线

3. **创建 ScanRangeSlider 组件**
   - 离散滑块（1/2/3/6/12）
   - 吸附到最近值
   - 显示当前值标签

4. **创建 SettingsScreen**
   - 扫描范围（新功能）
   - 语言设置（迁移现有）
   - 主题设置（迁移现有）
   - 提醒设置（迁移现有）
   - 关于部分（新）

5. **迁移现有设置**
   - 从主屏幕移除内联设置
   - 移到 SettingsScreen
   - 保持功能完整

6. **添加 iOS 风格**
   - 分组表格样式
   - 箭头导航指示
   - 适当的间距和边距

## 验证标准

- [ ] Task 012 的测试全部通过
- [ ] iOS 风格设置页面
- [ ] 扫描范围滑块工作
- [ ] 语言/主题/提醒设置迁移完成
- [ ] 持久化正常

## 依赖
- Task 012: Settings Screen Test

## 预估工作量
6-8 小时
