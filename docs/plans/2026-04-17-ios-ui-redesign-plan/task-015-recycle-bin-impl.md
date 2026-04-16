# Task 015: Recycle Bin Implementation

## 负责人
赵虎

## 任务类型
Implementation (Green)

## 目标
实现回收站页面，支持照片网格显示、恢复和永久删除功能。

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

## 技术规格

### 组件

- `src/ui/screens/RecycleBinScreen.tsx`
- `src/ui/components/EmptyState.tsx` (复用或新建)

### 功能

- 复用 PhotoGrid 组件
- 复用选择模式逻辑
- 恢复功能
- 永久删除功能

### iOS 风格规范

| 元素 | 规格 |
|------|------|
| 网格 | 同照片网格（3列） |
| 空状态 | iOS 风格插图 |
| 提示 | 顶部横幅，30天清理 |
| 操作 | 底部工具栏 |

## 实施步骤

1. **创建 RecycleBinScreen**
   - 复用 PhotoGrid 组件
   - 显示回收站项目
   - 30 天清理提示

2. **实现恢复功能**
   - 选择照片
   - 恢复按钮
   - 移回主相册
   - 成功提示

3. **实现永久删除**
   - 选择照片
   - 删除按钮
   - 二次确认
   - 系统删除

4. **创建空状态**
   - iOS 风格插图
   - "回收站为空" 提示
   - 友好说明

5. **更新 Tab 徽章**
   - 回收站数量显示在 Tab 上
   - 变化时更新

## 验证标准

- [ ] Task 014 的测试全部通过
- [ ] 回收站网格显示
- [ ] 恢复功能正常
- [ ] 永久删除功能正常
- [ ] 空状态显示
- [ ] Tab 徽章更新

## 依赖
- Task 014: Recycle Bin Screen Test

## 预估工作量
4-6 小时
