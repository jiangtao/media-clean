# Task 007: Scan Progress Implementation

## 负责人
王朝

## 任务类型
Implementation (Green)

## 目标
实现扫描进度动画组件，支持圆形进度条、数字计数器动画和颜色过渡。

## BDD 场景

### 场景 3.1: 开始扫描

```gherkin
Given 用户在照片主屏
When 用户点击扫描按钮
Then 显示扫描进度覆盖层
And 显示圆形进度条
And 显示计数器 "识别中... 0/300"
And 显示当前分析文件名
And 进度条开始动画
```

### 场景 3.2: 扫描进行中

```gherkin
Given 扫描正在进行
When 已分析 150 个项目
Then 计数器显示 "识别中... 150/300"
And 进度条显示 50%
And 进度条颜色从蓝色过渡到绿色

When 分析每个新项目
Then 计数器数字滚动动画
And 当前文件名更新
```

### 场景 3.3: 扫描完成

```gherkin
Given 扫描完成 300/300
When 进度达到 100%
Then 进度条脉冲动画
And 显示 "识别完成"
And 1秒后自动关闭覆盖层
And 切换到结果页面显示问题照片

Given 扫描发现问题照片
Then 显示 "发现 12 个问题照片"
And 仅显示问题照片网格
```

### 场景 3.4: 取消扫描

```gherkin
Given 扫描正在进行
When 用户点击取消按钮
Then 立即停止扫描
And 关闭进度覆盖层
And 返回照片主屏
And 保留已分析结果
```

## 技术规格

### 组件

- `src/ui/components/ScanProgress.tsx`
- `src/ui/components/ScanCounter.tsx`
- `src/ui/modals/ScanModal.tsx`

### 动画库

- React Native Reanimated v3
- SVG (react-native-svg) 用于圆形进度

### 动画规范

| 动画 | 规格 |
|------|------|
| 进度条 | 圆形，SVG stroke-dashoffset |
| 计数器 | 滚动数字动画 |
| 颜色过渡 | 蓝色 → 绿色 |
| 完成脉冲 | 缩放脉冲 |
| 持续时间 | 0.3s 标准，0.1s 数字更新 |

## 实施步骤

1. **安装动画库**
   ```bash
   npm install react-native-reanimated react-native-svg
   ```
   - 配置 reanimated babel 插件

2. **创建 ScanCounter 组件**
   - 滚动数字动画
   - 使用 Reanimated 的 `useSharedValue`
   - 平滑数字过渡

3. **创建 ScanProgress 组件**
   - 圆形 SVG 进度条
   - 颜色过渡动画
   - 显示当前文件名
   - 取消按钮

4. **创建 ScanModal 组件**
   - 全屏覆盖层
   - 背景模糊（可选）
   - 整合 ScanProgress

5. **修改扫描逻辑**
   - 添加进度回调
   - 支持取消操作
   - 完成时切换到结果视图

6. **添加动画细节**
   - 完成脉冲动画
   - 自动关闭延迟
   - 过渡效果

## 验证标准

- [ ] Task 006 的测试全部通过
- [ ] 圆形进度条显示正确
- [ ] 计数器数字滚动动画
- [ ] 进度颜色蓝色→绿色过渡
- [ ] 完成时脉冲动画
- [ ] 1秒后自动关闭
- [ ] 取消按钮正常工作

## 依赖
- Task 006: Scan Progress Animation Test
- Task 005: Photo Grid Implementation

## 预估工作量
8-10 小时
