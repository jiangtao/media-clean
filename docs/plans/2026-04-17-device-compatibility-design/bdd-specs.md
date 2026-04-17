# BDD 规格 - 机型适配验证

## Feature: 屏幕安全区适配

### Scenario 1.1: 刘海屏状态栏适配
```gherkin
Given 设备是刘海屏（如 iPhone 13）
When 应用启动并显示主界面
Then 状态栏内容应避开刘海区域
And 顶部导航栏高度应正确计算
```

### Scenario 1.2: 打孔屏状态栏适配
```gherkin
Given 设备是打孔屏（如 Samsung S23）
When 应用显示状态栏信息
Then 文字内容不应被前置摄像头遮挡
And 图标应合理排列在打孔两侧
```

### Scenario 1.3: 标准屏适配
```gherkin
Given 设备是标准屏（如 Pixel 5）
When 应用启动
Then 状态栏显示正常
And 无额外的安全区偏移
```

### Scenario 1.4: 瀑布屏/曲面屏适配
```gherkin
Given 设备是瀑布屏（如 Samsung S23 Ultra）
When 应用显示主界面
Then 边缘内容应可正常交互
And 重要信息不应完全位于曲面边缘
And 边缘手势应正确响应
```

### Scenario 1.5: 水滴屏适配
```gherkin
Given 设备是水滴屏（如 OnePlus 7）
When 应用显示状态栏
Then 状态栏内容应避开水滴区域
And 状态栏高度应正确计算
```

### Scenario 1.6: 药丸屏（灵动岛）适配
```gherkin
Given 设备是药丸屏（如 Honor 90）
When 应用显示状态栏
Then 状态栏内容应环绕药丸区域
And 药丸展开时不应遮挡应用内容
```

## Feature: 特殊设备适配

### Scenario 2.1: 平板横屏布局
```gherkin
Given 设备是平板（如 Galaxy Tab S9）
And 设备处于横屏模式
When 应用显示主界面
Then 应使用大屏布局（如双栏）
And 内容区域应充分利用屏幕宽度
And 左右边距应合理
```

### Scenario 2.2: 平板竖屏布局
```gherkin
Given 设备是平板
And 设备处于竖屏模式
When 应用显示主界面
Then 应使用移动端布局
And 内容不应过度拉伸
```

### Scenario 2.3: 折叠屏外屏适配
```gherkin
Given 设备是折叠屏（如 Galaxy Z Fold5）
And 使用外屏显示
When 应用启动
Then 应识别为窄屏设备
And 布局应适应窄屏尺寸
```

### Scenario 2.4: 折叠屏内屏适配
```gherkin
Given 设备是折叠屏
And 展开内屏
When 应用从外屏切换到内屏
Then 布局应自动调整为平板模式
And 内容应重新排版
And 不应出现布局错乱
```

### Scenario 2.5: 折叠屏折痕区域
```gherkin
Given 设备是折叠屏
And 展开内屏显示
When 显示跨折痕内容
Then 关键交互元素不应位于折痕区域
And 视频播放应支持跨折痕全屏
```

## Feature: 底部导航适配

### Scenario 3.1: 手势导航栏适配
```gherkin
Given 设备启用手势导航（Android 10+）
When 应用显示底部 TabBar
Then TabBar 应位于手势导航区域之上
And 底部内容可安全显示
```

### Scenario 2.2: 三键导航适配
```gherkin
Given 设备使用三键导航
When 应用显示底部操作栏
Then 操作栏应在导航栏之上
And 点击区域不被遮挡
```

## Feature: 横竖屏切换

### Scenario 3.1: 横屏刘海适配
```gherkin
Given 设备处于横屏模式
And 设备有刘海/打孔
When 用户切换横屏方向
Then 刘海应位于左侧或右侧
And 内容区域应正确调整
```

### Scenario 3.2: 横屏全屏模式
```gherkin
Given 应用进入全屏预览模式
When 切换到横屏
Then 应使用全屏显示
And 临时隐藏系统栏
```

## Feature: 截图对比验证

### Scenario 4.1: 多机型截图对比
```gherkin
Given 已配置多机型模拟器
When 运行截图测试
Then 每台设备应生成截图
And 截图应保存到指定目录
And 关键区域应无遮挡
```

### Scenario 4.2: 回归测试对比
```gherkin
Given 有基准截图
When 运行回归测试
Then 新截图应与基准对比
And 差异超过阈值应报错
```
