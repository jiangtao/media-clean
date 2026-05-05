# Media Clean 页面发布最佳实践

[English Version](./best-practices.en.md)

## 1. 只迁移页面运行必需资产

页面发布目录只保留当前首页运行、预览和部署必需的资源。

## 2. 发布页不耦合 App 构建

`page/` 使用静态 HTML，不依赖 Expo web。这样 Vercel 发布失败不会影响 Android App 构建链路。

## 3. 页面真值与文档镜像分开

当前正式页面只采用已确认的中文原始页，不新增未经确认的英文页面。正式文档保持中文优先，并提供英文文档镜像反链中文。

## 4. 不夸大当前能力

页面不承诺云端 AI、Firebase 真机上报或 iOS 当前主验收。当前版本明确是 Android 第一版、本地启发式识别。

## 5. Splash 资源分层

Android full-screen splash、品牌 lockup、adaptive icon 三类资源不能混用。全屏 splash 只用于启动屏和发布页展示，不用于 launcher icon。
