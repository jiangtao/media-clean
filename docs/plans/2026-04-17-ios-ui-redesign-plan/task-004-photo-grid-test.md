# Task 004: Photo Grid Component Test

## 负责人
赵虎

## 任务类型
Test (Red)

## 目标
为照片网格组件编写测试，验证 3 列布局、分段控制器过滤和虚拟化渲染。

## BDD 场景

### 场景 2.1: 授权后显示照片网格

```gherkin
Given 用户首次打开应用
When 用户授予照片访问权限
Then 主屏显示照片网格
And 显示 "全部" "照片" "视频" 分段控制器
And 显示上次清理时间
And 显示悬浮扫描按钮

Given 用户已授权
When 应用冷启动
Then 直接显示照片网格
And 恢复上次扫描状态
```

### 场景 2.2: 分段控制器过滤

```gherkin
Given 照片网格显示全部内容
When 用户点击 "照片" 分段
Then 仅显示照片类型项目
And 视频被过滤隐藏

When 用户点击 "视频" 分段
Then 仅显示视频类型项目
And 照片被过滤隐藏

When 用户点击 "全部" 分段
Then 显示所有照片和视频
```

### 场景 2.3: 照片网格布局

```gherkin
Given 照片网格显示 300 个项目
Then 采用 3 列网格布局
And 每个单元格为正方形
And 单元格间距为 2pt
And 支持滚动浏览

When 用户快速滚动
Then 使用虚拟化渲染（FlashList）
And 保持流畅 60fps
```

## 测试文件

- `src/ui/components/__tests__/PhotoGrid.test.tsx`
- `src/ui/components/__tests__/SegmentedControl.test.tsx`
- `src/ui/screens/__tests__/PhotoGridScreen.test.tsx`

## 测试要点

1. **网格布局测试**
   - 验证 3 列布局
   - 验证正方形单元格
   - 验证 2pt 间距

2. **分段控制器测试**
   - 验证分段选项显示
   - 验证过滤逻辑
   - 验证激活状态

3. **虚拟化测试**
   - 验证 FlashList 使用
   - 验证性能在 300 项时仍流畅

4. **集成测试**
   - 验证从存储恢复状态
   - 验证扫描按钮显示

## 验证标准

- [ ] 所有测试用例通过
- [ ] 覆盖网格布局场景
- [ ] 覆盖分段控制器场景
- [ ] 覆盖虚拟化渲染场景

## 依赖
- Task 001: Setup React Navigation

## 预估工作量
3-4 小时
