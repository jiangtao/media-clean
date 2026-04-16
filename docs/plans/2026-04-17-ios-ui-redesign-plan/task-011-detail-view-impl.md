# Task 011: Detail View Implementation

## 负责人
展昭

## 任务类型
Implementation (Green)

## 目标
实现 iOS 风格的照片详情页，支持全屏显示、视频播放和重复项左右滑动对比。

## BDD 场景

### 场景 5.1: 打开详情

```gherkin
Given 显示问题照片网格
When 用户点击任意照片
Then 打开详情页面
And 全屏显示照片
And 底部显示异常标签
And 显示照片元信息
```

### 场景 5.2: 视频播放

```gherkin
Given 详情页面显示视频
When 用户点击播放按钮
Then 开始播放视频
And 显示系统视频控制条
And 支持全屏播放
```

### 场景 5.3: 重复项对比

```gherkin
Given 详情页面显示重复照片
And 该重复组有 3 张照片
When 用户左右滑动
Then 切换到组内其他照片
And 显示对比信息
And 标记建议保留的照片（最高质量）

When 用户在对比视图
Then 可以点击选择要删除的照片
And 默认建议保留最高质量副本
```

## 技术规格

### 组件

- `src/ui/screens/DetailScreen.tsx`
- `src/ui/components/DuplicateCarousel.tsx`
- `src/ui/components/VideoPlayer.tsx`
- `src/ui/components/IssueTags.tsx`

### 库

- React Native Gesture Handler（滑动手势）
- Reanimated（滑动动画）
- expo-video（视频播放）

### iOS 风格规范

| 元素 | 规格 |
|------|------|
| 照片显示 | 全屏，contain 模式 |
| 底部面板 | 圆角，半透明背景 |
| 标签 | iOS 风格 pills |
| 滑动动画 | 0.3s 弹簧 |
| 视频控制 | 系统原生 |

## 实施步骤

1. **创建 DetailScreen**
   - 全屏照片显示
   - 底部信息面板
   - iOS 风格布局

2. **创建 IssueTags 组件**
   - 显示异常原因标签
   - iOS 风格 pill 样式
   - 颜色编码（误触/异常/重复）

3. **创建 VideoPlayer 组件**
   - 使用 expo-video
   - 播放控制
   - 全屏支持

4. **创建 DuplicateCarousel 组件**
   - 水平滑动
   - PanGestureHandler
   - 弹簧动画
   - 页面指示器

5. **实现重复项对比**
   - 显示组内所有照片
   - 标记最高质量
   - 选择删除项
   - 对比信息（分辨率、大小等）

6. **添加元信息显示**
   - 拍摄时间
   - 文件大小
   - 分辨率
   - 持续时间（视频）

## 验证标准

- [ ] Task 010 的测试全部通过
- [ ] 详情页 iOS 风格布局
- [ ] 照片全屏显示
- [ ] 底部异常标签显示
- [ ] 视频播放正常
- [ ] 重复项滑动对比正常
- [ ] 动画流畅

## 依赖
- Task 010: Detail View with Swipe Test

## 预估工作量
10-12 小时
