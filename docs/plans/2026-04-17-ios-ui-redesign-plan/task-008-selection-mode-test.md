# Task 008: Photo Selection Mode Test

## 负责人
马汉

## 任务类型
Test (Red)

## 目标
为照片选择模式编写测试，验证长按进入选择、多选和工具栏操作。

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

## 测试文件

- `src/ui/components/__tests__/SelectionBar.test.tsx`
- `src/ui/components/__tests__/PhotoGridItem-selection.test.tsx`
- `src/features/cleanup/__tests__/selection-mode.test.ts`

## 测试要点

1. **长按进入选择模式**
   - 模拟长按事件
   - 验证选择模式状态
   - 验证勾选标记显示

2. **多选功能**
   - 点击选择/取消选择
   - 验证选中状态更新
   - 验证工具栏数量更新

3. **工具栏操作**
   - 全选/取消全选
   - 清理按钮
   - 确认对话框

4. **退出选择模式**
   - 清理完成后退出
   - 取消全选后退出

## 验证标准

- [ ] 所有测试用例通过
- [ ] 覆盖长按进入选择模式
- [ ] 覆盖多选功能
- [ ] 覆盖工具栏操作

## 依赖
- Task 005: Photo Grid Implementation

## 预估工作量
3-4 小时
