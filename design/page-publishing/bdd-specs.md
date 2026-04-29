# Media Clean 页面发布 BDD 规格

[English Version](./bdd-specs.en.md)

## 场景 1：发布页默认展示中文页面

```gherkin
Scenario: 中文页面作为默认发布入口
  Given 用户打开 Media Clean 发布页根路径
  When 页面完成加载
  Then 用户看到中文 Hero、手机预览、视频介绍、亮点介绍、功能支持、图库和 CTA 区块
  And 页面加载确认页所需的视频、图片和图标资源
```

## 场景 2：旧入口兼容到确认页

```gherkin
Scenario: landing.html 兼容入口指向中文主页面
  Given 用户打开 /landing.html
  When 页面完成加载
  Then 用户看到与根路径一致的中文确认页
```

## 场景 3：Vercel 可以独立构建页面

```gherkin
Scenario: page 目录独立构建
  Given Vercel Root Directory 设置为 page
  When 执行 npm run build
  Then dist 目录包含 index.html、promo-video-60fps.mp4、resources、apps/icons、robots.txt 和 sitemap.xml
```

## 场景 4：Android splash 使用新版资源

```gherkin
Scenario: Android 原生启动屏使用 preview-frames splash
  Given 已复制 Android 9:16 splash 到 assets 和 native drawable
  When Android 应用冷启动
  Then 启动屏展示 Media Clean 品牌 splash
```
