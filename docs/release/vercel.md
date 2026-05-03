# Vercel 发布契约

[English Version](./vercel.en.md)

本文档定义 Media Clean 发布页在当前仓库内的 Vercel 发布约定。

## 发布对象

1. 发布目录：`page/`
2. 页面入口：`page/public/index.html`
3. 兼容入口：`page/dist/landing.html`，由构建阶段自动生成
4. 运行资源：`page/public/resources/*`、`page/public/apps/icons/*`、`page/public/promo-video-60fps.mp4`

## 仓库命令

```bash
npm run page:build
npm run page:dev
npm run page:preview
npm run page:deploy
npm run page:deploy:prod
```

## Vercel 配置

1. Root Directory：`page`
2. Build Command：`npm run build`
3. Output Directory：`dist`
4. Preview 域名建议：`mc.vercel.app`
5. 正式域名目标：`mc.jerret.me`

## 验收

1. `npm run page:build` 成功生成 `page/dist`
2. `npm run page:preview` 能在本机打开页面
3. 页面视频、图片、icons、manifest 都能正常加载
4. `landing.html` 和 `/` 都能正常展示首页
