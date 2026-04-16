# Task 014: Recycle Bin Screen Test

## 负责人
赵虎

## 任务类型
Test (Red)

## 目标
为回收站页面编写测试，验证照片网格显示、恢复和永久删除功能。

## BDD 场景

### 场景 7.1: 查看回收站

```gherkin
Given 用户在回收站 Tab
When 页面加载
Then 显示已删除照片网格
And 显示 30 天自动清理提示
```

### 场景 7.2: 恢复照片

```gherkin
Given 回收站有 3 张照片
When 用户长按选择照片
And 点击 "恢复" 按钮
Then 照片移回主相册
And 从回收站移除
And 显示恢复成功提示
```

### 场景 7.3: 永久删除

```gherkin
Given 回收站有照片
When 用户选择照片并点击 "彻底删除"
Then 弹出二次确认对话框
And 用户确认后从系统相册删除
And 显示删除成功提示
```

## 测试文件

- `src/ui/screens/__tests__/RecycleBinScreen.test.tsx`
- `src/features/cleanup/__tests__/recycle-restore.test.ts`

## 测试要点

1. **回收站显示测试**
   - 网格显示
   - 空状态
   - 30 天提示

2. **恢复功能测试**
   - 选择照片
   - 恢复操作
   - 状态更新

3. **永久删除测试**
   - 选择照片
   - 确认对话框
   - 系统删除

4. **空状态测试**
   - 无照片时显示
   - 空状态插图

## 验证标准

- [ ] 所有测试用例通过
- [ ] 覆盖回收站显示
- [ ] 覆盖恢复功能
- [ ] 覆盖永久删除

## 依赖
- Task 003: Bottom Tab Navigation Implementation

## 预估工作量
2-3 小时
