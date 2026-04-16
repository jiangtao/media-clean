# Task 005: Photo Grid Implementation

## 负责人
赵虎

## 任务类型
Implementation (Green)

## 目标
实现 iOS 照片风格的照片网格组件，支持 3 列布局、分段控制器过滤和虚拟化渲染。

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

## 技术规格

### 组件

- `src/ui/components/PhotoGrid.tsx`
- `src/ui/components/PhotoGridItem.tsx`
- `src/ui/components/SegmentedControl.tsx`
- `src/ui/screens/PhotoGridScreen.tsx`

### iOS 风格规范

| 元素 | 规格 |
|------|------|
| 列数 | 3 |
| 单元格宽高比 | 1:1 (正方形) |
| 单元格间距 | 2pt |
| 分段控制器 | iOS 风格，3 个选项 |

## 实施步骤

1. **安装 FlashList**
   ```bash
   npm install @shopify/flash-list
   ```

2. **创建 SegmentedControl 组件**
   - iOS 风格分段控制器
   - 3 个选项：全部、照片、视频
   - 支持激活状态切换

3. **创建 PhotoGridItem 组件**
   - 正方形缩略图
   - 使用 expo-image 加载
   - 支持快速滚动

4. **创建 PhotoGrid 组件**
   - 使用 FlashList 虚拟化
   - 3 列布局配置
   - 2pt 间距
   - 支持下拉刷新

5. **创建 PhotoGridScreen**
   - 整合 SegmentedControl + PhotoGrid
   - 显示上次清理时间
   - 悬浮扫描按钮
   - 从存储恢复状态

6. **实现过滤逻辑**
   - 根据分段控制器过滤媒体类型
   - 全部：显示所有
   - 照片：仅 photo 类型
   - 视频：仅 video 类型

## 验证标准

- [ ] Task 004 的测试全部通过
- [ ] 3 列网格布局正确
- [ ] 正方形单元格
- [ ] 2pt 间距
- [ ] 分段控制器过滤工作
- [ ] FlashList 虚拟化渲染
- [ ] 流畅滚动（60fps）

## 依赖
- Task 004: Photo Grid Component Test
- Task 003: Bottom Tab Navigation Implementation

## 预估工作量
6-8 小时
