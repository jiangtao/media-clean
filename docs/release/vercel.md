# Vercel 发布契约

[English Version](./vercel.en.md)

本文档定义 Media Clean 发布页的 Vercel 自动发布配置。发布页代码位于 `page/`，不与 Expo App 的 Android/iOS 构建耦合。

## 项目配置

1. Vercel Project Name：`mc`
2. Root Directory：`page`
3. Framework Preset：`Other`
4. Install Command：默认即可
5. Build Command：`npm run build`
6. Output Directory：`dist`
7. Preview Domain：`mc.vercel.app`
8. Production Domain：`mc.jerret.me`

## 仓库配置

1. `page/package.json` 提供 `build/dev/preview/deploy/deploy:prod` 命令。
2. `page/vercel.json` 配置 `cleanUrls`、输出目录、静态资源缓存和 `/landing.html` 兼容 rewrite。
3. 根 `package.json` 提供 `page:build/page:dev/page:preview/page:deploy/page:deploy:prod` 便于从仓库根目录验证和发布。
4. 不提交 `.vercel/`，项目 ID、组织 ID 与 token 由 Vercel Dashboard 或 CI secrets 管理。

## DNS 接入

1. 在 Vercel 项目 Domains 中添加 `mc.jerret.me`。
2. 按 Vercel 提示在 DNS 服务商配置 CNAME 或对应记录。
3. 等待 Vercel 域名校验通过。
4. 校验 `https://mc.jerret.me` 可访问。

## 验证

```bash
npm run page:build
cd page && npm run preview
```

## 发布命令

```bash
npm run page:deploy:prod
```

如果本机 Vercel token 失效，先执行 `vercel login` 或在 CI 中配置 `VERCEL_TOKEN`，再重新执行生产发布命令。

发布后检查：

1. 首页中文默认打开。
2. 视频能播放。
3. 手机 mock 背景图与 3 张界面展示图无 404。
4. `apps/icons/manifest.json` 可访问，且 `start_url` 指向 `/`。
5. `/landing.html` 能兼容回到首页。
