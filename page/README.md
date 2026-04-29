# Media Clean 发布页

[English Version](./README.en.md)

本目录是 Media Clean 的独立静态发布页。页面本体直接使用 `/Users/jt/places/personal/cleaner-app/index.html`，并从该素材源迁移页面运行必需的资源。

## 目录职责

1. `public/index.html`：从 `cleaner-app/index.html` 迁入的 canonical 发布页。
2. `public/promo-video-60fps.mp4`：页面内嵌宣传视频。
3. `public/resources/`：页面实际引用的 3 张展示图与手机 mock 背景图。
4. `public/apps/icons/`：页面 favicon、PWA manifest 与品牌图标。
5. `scripts/build.mjs`：无依赖静态构建，把 `public` 复制到 `dist`。
6. `vercel.json`：Vercel 静态站点配置。

## 本地命令

```bash
npm run build
npm run dev
npm run preview
```

从仓库根目录也可以运行：

```bash
npm run page:build
npm run page:dev
npm run page:preview
```

## Vercel 配置

1. Project Root Directory: `page`
2. Framework Preset: `Other`
3. Build Command: `npm run build`
4. Output Directory: `dist`
5. Preview Domain: `mc.vercel.app`
6. Production Domain: `mc.jerret.me`

完整发布契约见 [docs/release/vercel.md](../docs/release/vercel.md)。

## 内容模块

1. Hero：智能相册管理工具、主价值主张与 Google Play CTA。
2. 手机 mock：展示扫描中、媒体数量、进度与底部导航。
3. 功能特性：智能扫描、一键清理、安全可靠、快速高效。
4. 视频介绍：内嵌 `promo-video-60fps.mp4`。
5. 界面展示：3 张产品展示图。
6. 底部 CTA：下载应用与文档链接。
