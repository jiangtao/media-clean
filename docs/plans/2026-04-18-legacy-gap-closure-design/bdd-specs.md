# BDD 规格 - Claude 遗留缺口收口

## Scenario 1: App 级偏好统一收口

```gherkin
Given 应用已保存语言偏好和主题偏好
When App 启动并装配根 Provider
Then 导航、页面和组件应共享同一份语言与主题真值源
And Settings 页面修改偏好后，照片页和回收站页应立即反映变化
```

## Scenario 2: 照片页国际化与主题覆盖

```gherkin
Given 用户将语言切换为 en-US
And 用户将主题切换为 dark
When 用户进入照片页
Then 筛选项、空态、选择态操作文案应显示英文
And 页面与分段控件不应继续使用浅色硬编码颜色
```

## Scenario 3: 回收站页国际化与主题覆盖

```gherkin
Given 用户将语言切换为 zh-CN 或 en-US
And 用户使用 light、dark 或 system 主题
When 用户进入回收站页
Then 标题、过期提示、空态、选择态操作文案应随语言变化
And 页头、网格、操作栏应使用统一主题色板
```

## Scenario 4: 用户目标机型特殊屏适配

```gherkin
Given 用户目标机型默认采用 Samsung_S20 横屏左上打孔配置
When 兼容性模块识别屏幕类型
Then 应识别为 hole-punch-left
And 顶部内容与横屏危险区不应重叠
```

## Scenario 5: App 入口约定和验证

```gherkin
Given App 是全局入口
When 根节点初始化
Then StatusBar、NavigationContainer、SafeAreaProvider、AppPreferencesProvider 的装配顺序应明确
And 相关测试与类型检查应通过
```
