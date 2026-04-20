# Task 004: Photo and Recycle Screen Localization/Theme Implementation

## 负责人
王朝

## 类型
Implementation

## depends-on
["002", "003"]

## BDD 场景

```gherkin
Given 用户将语言切换为 en-US
And 用户将主题切换为 dark
When 用户进入照片页
Then 筛选项、空态、选择态操作文案应显示英文
And 页面与分段控件不应继续使用浅色硬编码颜色

Given 用户将语言切换为 zh-CN 或 en-US
And 用户使用 light、dark 或 system 主题
When 用户进入回收站页
Then 标题、过期提示、空态、选择态操作文案应随语言变化
And 页头、网格、操作栏应使用统一主题色板
```

## 验证命令

```bash
npm run test -- src/ui/screens/__tests__/PhotoGridScreen.test.tsx src/ui/screens/__tests__/RecycleBinScreen.test.tsx
npm run typecheck
```
