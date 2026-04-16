# Task 009: Photo Selection Mode Implementation

## 负责人
马汉

## 任务类型
Implementation (Green)

## 目标
实现照片选择模式，支持长按进入选择、多选和底部工具栏操作。

## BDD 场景

### 场景 4.1: 长按进入选择模式

```gherkin
Given 显示问题照片网格
When 用户长按任意照片
Then 进入选择模式
And 该照片被选中（显示勾选标记）
And 底部出现选择工具栏

Given 已在选择模式
When 用户点击其他照片
Then 该照片被选中/取消选中
And 工具栏更新选中数量
```

### 场景 4.2: 选择工具栏操作

```gherkin
Given 已选择 5 张照片
When 用户点击 "全选"
Then 所有问题照片被选中
And 工具栏显示选中数量

When 用户点击 "取消全选"
Then 所有照片取消选中
And 退出选择模式

When 用户点击 "清理"
Then 弹出确认对话框
And 用户确认后移动到回收站
```

## 技术规格

### 组件

- `src/ui/components/SelectionBar.tsx`
- `src/ui/components/PhotoGridItem.tsx` (更新支持选择)
- `src/features/photos/selection-state.ts`

### iOS 风格规范

| 元素 | 规格 |
|------|------|
| 长按触发 | 500ms |
| 勾选标记 | 圆形，白色背景，蓝色勾选 |
| 选中遮罩 | 半透明蓝色 |
| 工具栏 | 底部固定，iOS 风格 |
| 动画 | 0.15s 缩放 + 透明度 |

## 实施步骤

1. **创建选择状态管理**
   - `selection-state.ts`
   - 管理选择模式开关
   - 管理选中 ID 列表

2. **更新 PhotoGridItem**
   - 添加长按手势
   - 显示勾选标记（选中时）
   - 选中状态视觉反馈

3. **创建 SelectionBar 组件**
   - 底部固定工具栏
   - 显示选中数量
   - 全选/取消全选按钮
   - 清理按钮

4. **实现长按触发**
   - 500ms 长按阈值
   - 进入选择模式
   - 选中当前照片

5. **实现工具栏操作**
   - 全选：选中所有可见照片
   - 取消全选：清空选中
   - 清理：弹出确认对话框

6. **添加动画**
   - 勾选标记出现动画
   - 工具栏滑入动画
   - 选中状态过渡

## 验证标准

- [ ] Task 008 的测试全部通过
- [ ] 长按进入选择模式
- [ ] 勾选标记正确显示
- [ ] 多选功能正常
- [ ] 工具栏显示和操作正常
- [ ] 动画流畅

## 依赖
- Task 008: Photo Selection Mode Test

## 预估工作量
6-8 小时
