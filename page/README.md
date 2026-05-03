# Media Clean 发布页

[English Version](./README.en.md)

本目录承载 Media Clean 的独立静态发布页与 Vercel 发布配置，当前仓库内只保留发布运行时真正需要的资源。

## 目录结构

1. `public/index.html`：正式 landing page。
2. `dist/landing.html`：构建阶段从 `index.html` 复制出的兼容入口。
3. `public/promo-video-60fps.mp4`：页面内嵌宣传视频。
4. `public/resources/*`：页面展示图与手机 mock 背景。
5. `public/apps/icons/*`：favicon、PWA manifest 与应用图标资源。
6. `scripts/build.mjs`：把 `public/` 复制到 `dist/`。
7. `scripts/dev-server.mjs`：本地 dev / preview 静态服务。
8. `vercel.json`：Vercel 部署配置。

## 常用命令

```bash
npm run page:build
npm run page:dev
npm run page:preview
npm run page:deploy
npm run page:deploy:prod
```

## 发布约定

1. Vercel Root Directory 设为 `page`。
2. 构建命令使用 `npm run build`。
3. 输出目录是 `dist`。
4. 预览域名建议为 `mc.vercel.app`。
5. 正式域名规划为 `mc.jerret.me`。
