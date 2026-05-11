# BDD Specifications

## Feature: 滑动批量选中

> **TODO**: 当前实现存在问题，需要修复以下内容：
> 1. **手势冲突**: 滑动选中与滚动需要正确区分，轻触选择单个，滑动选择多个，垂直滑动滚动列表
> 2. **矩形区域选择**: 从起点到终点形成矩形区域，区域内所有项都被选中（非仅对角线）
> 3. **全不选行为**: "全不选"只清空选中项，保持选中模式；点击 X 才退出选中模式
> 4. **点击与滑动区分**: 轻触选择单个项目，滑动选择多个项目

```gherkin
Feature: 滑动批量选中媒体项
  用户在选中模式下可以通过滑动快速选中多个媒体项

  Background:
    Given 用户已进入照片网格页面
    And 扫描已完成，显示媒体列表
    And 媒体网格显示 3 列布局

  Scenario: 长按进入选中模式
    When 用户长按任意媒体项
    Then 该媒体项被选中
    And 进入选中模式
    And 显示选中指示器

  Scenario: 轻触选择单个项
    Given 已进入选中模式
    When 用户轻触第 1 项
    Then 第 1 项被选中
    And 不影响其他项

  Scenario: 滑动选中多个项
    Given 已进入选中模式
    When 用户从第 1 项滑动到第 3 项
    Then 第 1、2、3 项全部被选中

  Scenario: 斜向滑动矩形区域选中
    Given 已进入选中模式
    And 网格为 3 列布局
    When 用户从第 0 项（第1行第1列）斜向滑动到第 8 项（第3行第3列）
    Then 矩形区域内的第 0、1、2、3、4、5、6、7、8 项全部被选中
    # 注：矩形区域包含起点和终点形成的完整矩形

  Scenario: 滑动后正常滚动列表
    Given 已进入选中模式
    And 已选中第 1、2 项
    When 用户在网格上垂直滑动（滚动列表）
    Then 列表正常滚动
    And 第 1、2 项保持选中状态
    And 不触发新的选中操作

  Scenario: 反向滑动取消选中
    Given 已进入选中模式
    And 第 1、2、3 项已被选中
    When 用户从第 3 项向左滑动回第 1 项
    Then 第 2、3 项被取消选中
    And 第 1 项保持选中

  Scenario: 全不选保持选中模式
    Given 已进入选中模式
    And 已选中第 1、2、3 项
    When 用户点击"全不选"
    Then 所有项被取消选中
    And 保持选中模式
    And 底部操作栏仍然显示

  Scenario: 点击 X 退出选中模式
    Given 已进入选中模式
    And 已选中第 1、2 项
    When 用户点击 X 按钮
    Then 退出选中模式
    And 选中指示器隐藏
    And 底部操作栏隐藏

  Scenario: 非选中模式下滑动正常滚动
    Given 未进入选中模式
    When 用户在网格上滑动
    Then 不触发任何选中操作
    And 保持正常滚动行为

  Scenario: 快速滑动不丢帧
    Given 已进入选中模式
    When 用户快速从顶部滑动到底部
    Then 所有经过的项都被正确选中
    And 无 UI 卡顿
```

## Feature: 图片双指缩放

```gherkin
Feature: 详情页图片双指缩放
  用户在媒体详情页可以通过双指手势缩放查看图片

  Background:
    Given 用户已进入照片网格页面
    And 扫描已完成
    And 存在可查看的媒体项

  Scenario: 双指展开放大图片
    When 用户点击一张图片进入详情页
    And 双指展开
    Then 图片开始放大
    And 放大比例随双指距离变化

  Scenario: 双指收缩缩小图片
    Given 图片已放大到 2 倍
    When 用户双指收缩
    Then 图片开始缩小
    And 最小只能缩小到原始大小（1 倍）

  Scenario: 缩放小于 1 时回弹
    When 用户双指收缩图片到小于原始大小
    And 松开手指
    Then 图片动画回弹到原始大小

  Scenario: 缩放时平移图片
    Given 图片已放大到 2 倍
    When 用户单指拖动
    Then 图片跟随手指移动
    And 可以查看图片的不同区域

  Scenario: 图片边缘限制平移
    Given 图片已放大到 2 倍
    And 用户拖动到图片边缘
    Then 图片不能继续向该方向移动
    And 产生弹性阻力效果

  Scenario: 视频不支持缩放
    When 用户点击一个视频进入详情页
    Then 视频正常播放
    And 不支持双指缩放操作
    And 双指手势被忽略

  Scenario: 双击重置缩放
    Given 图片已放大到 2 倍
    When 用户双击图片
    Then 图片动画恢复到原始大小

  Scenario: 缩放状态下切换图片
    Given 用户正在查看重复组中的图片
    And 当前图片已放大到 2 倍
    When 用户左右滑动切换到组内其他图片
    Then 新图片以原始大小显示
    And 缩放状态重置

  Scenario: 最大缩放限制
    When 用户双指展开放大图片
    Then 最大只能放大到 3 倍
    And 继续展开无效果

  Scenario: 缩放动画流畅
    When 用户快速双指展开和收缩
    Then 缩放动画流畅无卡顿
    And 帧率保持在 60 FPS 以上
```

## 单元测试清单

### useSwipeSelection Hook

- [ ] `getItemAtPosition`: 给定坐标正确计算行列索引
- [ ] `getItemAtPosition`: 考虑滚动偏移量
- [ ] `getItemAtPosition`: 边界外坐标返回 null
- [ ] `getItemsInRect`: 给定矩形区域返回所有覆盖项
- [ ] 滑动选中状态管理
- [ ] 与现有 `onSelect` 回调正确集成

### ZoomableImage Component

- [ ] `PinchGesture`: scale 计算正确
- [ ] `PinchGesture`: 边界限制 [1, 3]
- [ ] `PinchGesture`: onEnd 时 scale < 1 回弹到 1
- [ ] `PanGesture`: translateX/Y 更新正确
- [ ] `PanGesture`: 边缘限制计算
- [ ] 手势组合: Pinch 和 Pan 可同时工作
- [ ] 动画: 使用 withSpring 回弹

### PhotoGrid Integration

- [ ] `selectionMode=false` 时忽略滑动手势
- [ ] `selectionMode=true` 时响应滑动手势
- [ ] 滑动选中与点击选中共存
- [ ] 滑动选中与长按进入选中模式共存
- [ ] FlatList 滚动与滑动手势协调

### DetailScreen Integration

- [ ] 图片项渲染 ZoomableImage
- [ ] 视频项不渲染 ZoomableImage
- [ ] 缩放状态在组件卸载时重置

## 端到端测试清单（功能完成后）

### 滑动批量选中 E2E

- [ ] 完整流程：进入选中模式 → 滑动选中多个 → 批量清理
- [ ] 不同屏幕尺寸适配
- [ ] 不同网格列数适配
- [ ] 大量媒体项滑动性能
- [ ] 深色/浅色主题下选中指示器可见性

### 图片缩放 E2E

- [ ] 完整流程：进入详情 → 双指缩放 → 平移 → 关闭
- [ ] 不同尺寸图片的缩放体验
- [ ] 横竖屏切换后的缩放状态
- [ ] 重复组内切换图片的缩放重置
- [ ] 不同设备屏幕密度下的缩放效果
