# Media Clean 页面发布架构

[English Version](./architecture.en.md)

## 模块

1. `page/public/index.html`：确认过的 `../cleaner-app/index.html` 发布副本，是页面内容唯一真值。
2. `page/public/promo-video-60fps.mp4`：发布页视频介绍资源。
3. `page/public/resources`：发布页运行时图片资源。
4. `page/public/apps/icons`：favicon、touch icon、PWA icon、manifest 与 logo 资源。
5. `page/scripts/build.mjs`：把 `public` 复制到 `dist` 的无依赖构建脚本。
6. `page/vercel.json`：Vercel 构建、缓存、rewrite 配置。
7. `assets/splash-android-phone.png`：Android 9:16 splash 源。
8. `android/app/src/main/res/drawable-nodpi/splashscreen_full.png`：原生 Android 当前启动屏实际使用资源。

## 数据流

```text
../cleaner-app/index.html + runtime assets
  -> page/public
  -> npm run page:build
  -> page/dist
  -> Vercel project mc
  -> mc.vercel.app / mc.jerret.me
```

## Android splash 同步

1. `app.json` 使用 `assets/splash-brand.png` 作为通用 splash lockup。
2. `app.json.android.splash` 使用 `assets/splash-android-phone.png`。
3. 已存在 `android/` 原生目录时，必须同步 `drawable-nodpi/splashscreen_full.png` 与 `ic_launcher_background.xml`，不能只改 `app.json`。
