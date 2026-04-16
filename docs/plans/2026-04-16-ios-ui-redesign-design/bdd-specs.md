# BDD 规格 - iOS 风格 UI 重新设计

## 功能 1: 底部 Tab 导航

### 场景 1.1: 用户切换 Tab
```gherkin
Given 用户已授权并打开应用
When 用户点击底部 "回收站" Tab
Then 界面切换到回收站页面
And 底部 "回收站" Tab 变为激活状态

When 用户点击底部 "设置" Tab
Then 界面切换到设置页面
And 底部 "设置" Tab 变为激活状态

When 用户点击底部 "照片" Tab
Then 界面返回照片主屏
And 底部 "照片" Tab 变为激活状态
```

### 场景 1.2: Tab 徽章显示
```gherkin
Given 回收站有 5 个待恢复项目
When 用户在任何 Tab 页面
Then "回收站" Tab 显示红色徽章数字 "5"

Given 扫描完成后有 12 个问题照片
When 用户在照片 Tab
Then "照片" Tab 不显示徽章（仅回收站显示）
```

## 功能 2: 照片主屏

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

## 功能 3: 扫描进度

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

## 功能 4: 问题照片选择

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

## 功能 5: 照片详情

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

## 功能 6: 设置页面

### 场景 6.1: 扫描范围设置
```gherkin
Given 用户在设置页面
When 查看 "扫描范围" 选项
Then 显示滑块控件
And 显示当前值 "最近 2 个月"
And 可选值：1/2/3/6/12 个月

When 用户拖动滑块到 "3 个月"
Then 更新显示 "最近 3 个月"
And 下次扫描使用新范围
```

### 场景 6.2: 语言和主题设置
```gherkin
Given 用户在设置页面
When 点击 "语言" 选项
Then 进入语言选择页面
And 显示选项：简体中文、English

When 点击 "外观" 选项
Then 进入主题选择页面
And 显示选项：跟随系统、浅色、深色
```

### 场景 6.3: 定期清理提醒
```gherkin
Given 用户在设置页面
When 开关 "定期清理提醒"
Then 开启/关闭提醒功能

Given 提醒已开启
When 用户设置提醒频率
Then 可选：每日、每周

Given 选择每周频率
When 用户选择星期几
Then 显示选项：周一到周日

Given 用户设置时间
Then 显示时间选择器
And 默认 9:00
```

## 功能 7: 回收站

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

## 功能 8: 深色/浅色主题

### 场景 8.1: 系统主题跟随
```gherkin
Given 用户设置主题为 "跟随系统"
When 系统切换为深色模式
Then 应用自动切换深色主题
And 所有组件更新颜色

When 系统切换为浅色模式
Then 应用自动切换浅色主题
```

### 场景 8.2: 手动主题切换
```gherkin
Given 用户在设置页面
When 选择 "深色" 主题
Then 应用立即切换深色模式
And 保存用户偏好

When 选择 "浅色" 主题
Then 应用立即切换浅色模式
And 保存用户偏好
```

## 边缘场景

### 场景 E1: 无照片权限
```gherkin
Given 用户未授予照片权限
When 打开应用
Then 显示权限请求页面
And 解释为何需要权限
And 提供 "授权访问" 按钮
```

### 场景 E2: 扫描无结果
```gherkin
Given 扫描完成
When 未发现问题照片
Then 显示 "未发现异常照片" 提示
And 提供重新扫描按钮
```

### 场景 E3: 回收站为空
```gherkin
Given 用户在回收站 Tab
When 回收站为空
Then 显示空状态插图
And 显示 "回收站为空" 提示
```

### 场景 E4: 网络异常（如需下载模型）
```gherkin
Given 扫描需要下载模型
When 网络异常
Then 显示网络错误提示
And 提供重试按钮
```
