# Media Clean 发布页内容说明

[English Version](./page-home.en.md)

本文档定义 `page/` 发布页的正式内容结构。页面本体使用 `/Users/jt/places/personal/cleaner-app/index.html`，当前对外发布页面为中文。

## 目标

1. 把 Media Clean 从工程 README 里的功能说明，转成可公开访问的产品页。
2. 统一视频、亮点、功能支持、界面展示和下载 CTA。
3. 让页面能通过 Vercel 独立发布到 `mc.vercel.app`，后续绑定 `mc.jerret.me`。

## 页面模块

1. Hero：智能相册管理工具、价值主张、Google Play CTA。
2. 手机 mock：扫描中、媒体数量、进度、照片/回收站/设置导航。
3. 功能特性：智能扫描、一键清理、安全可靠、快速高效。
4. 视频介绍：内嵌 `promo-video-60fps.mp4`。
5. 界面展示：3 张产品展示图。
6. 底部 CTA：下载应用与文档入口。

## 文案口径

1. 不承诺 Firebase 监控；当前版本强调本地安全。
2. 页面若出现“AI”文案，应理解为现有 landing 的营销表达；App 当前实现仍以本地启发式识别为准。
3. 不把 iOS 写成当前主验收路径；当前发布口径是 Android 第一版。
4. 不依赖 `docs/plans/**` 作为正式发布入口。

## 资源来源

1. 页面：`page/public/index.html`
2. 视频：`page/public/promo-video-60fps.mp4`
3. 展示图：`page/public/resources/photo-*`
4. 手机 mock 背景：`page/public/resources/Screenshot_2026-04-20-22-28-31-006_com.jt.mistapmediacleaner.jpg`
5. 图标：`page/public/apps/icons`
