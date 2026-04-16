# Task 012: Settings Screen Test

## 负责人
张龙

## 任务类型
Test (Red)

## 目标
为设置页面编写测试，验证扫描范围滑块、语言和主题设置。

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

## 测试文件

- `src/ui/screens/__tests__/SettingsScreen.test.tsx`
- `src/services/storage/__tests__/scan-range-storage.test.ts`

## 测试要点

1. **扫描范围测试**
   - 滑块显示
   - 离散值（1/2/3/6/12）
   - 保存和读取

2. **语言设置测试**
   - 选项显示
   - 切换语言
   - 持久化

3. **主题设置测试**
   - 选项显示
   - 切换主题
   - 应用更新

4. **提醒设置测试**
   - 开关功能
   - 频率选择
   - 时间选择

## 验证标准

- [ ] 所有测试用例通过
- [ ] 覆盖扫描范围设置
- [ ] 覆盖语言和主题
- [ ] 覆盖提醒设置

## 依赖
- Task 001: Setup React Navigation

## 预估工作量
3-4 小时
