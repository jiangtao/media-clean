# Task 010: Detail View with Swipe Test

## 负责人
展昭

## 任务类型
Test (Red)

## 目标
为照片详情页编写测试，验证 iOS 风格布局、视频播放和重复项滑动对比。

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

## 测试文件

- `src/ui/screens/__tests__/DetailScreen.test.tsx`
- `src/ui/components/__tests__/DuplicateCarousel.test.tsx`
- `src/ui/components/__tests__/VideoPlayer.test.tsx`

## 测试要点

1. **详情页显示测试**
   - 照片全屏显示
   - 底部异常标签
   - 元信息显示

2. **视频播放测试**
   - 播放按钮
   - 视频控制条
   - 全屏播放

3. **滑动对比测试**
   - 左右滑动手势
   - 切换重复项
   - 对比信息显示

4. **选择删除测试**
   - 标记建议保留
   - 选择删除项
   - 默认保留最高质量

## 验证标准

- [ ] 所有测试用例通过
- [ ] 覆盖详情页显示
- [ ] 覆盖视频播放
- [ ] 覆盖重复项滑动对比

## 依赖
- Task 001: Setup React Navigation

## 预估工作量
4-5 小时
