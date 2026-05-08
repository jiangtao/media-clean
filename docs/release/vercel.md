# Vercel 发布契约

[English Version](./vercel.en.md)

本文档定义 Media Clean 发布页的 Vercel 自动发布配置。发布页代码位于 `page/`，页面代码仍可独立部署；Android 正式 APK 下载文件由 Android release workflow 注入到 page 静态产物。

## 项目配置

1. Vercel Project Name：`mc`
2. Root Directory：`page`
3. Framework Preset：`Other`
4. Install Command：默认即可
5. Build Command：`npm run build`
6. Output Directory：`dist`
7. 当前 Vercel 生产别名：`mc-khaki.vercel.app`
8. 自定义生产域名：`mc.jerret.me`
9. GitHub Actions Workflow：`.github/workflows/page-vercel.yml`

## 仓库配置

1. `page/package.json` 提供 `build/dev/preview/deploy/deploy:prod` 命令。
2. `page/vercel.json` 负责静态资源缓存头。
3. 根 `package.json` 提供 `page:build/page:dev/page:preview/page:deploy/page:deploy:prod` 便于从仓库根目录验证和发布。
4. 不提交 `.vercel/`；当前已 link 的 `projectId/orgId` 已固定进 workflow，GitHub 只需提供 `VERCEL_TOKEN` secret。
5. `page` 的 Android 下载入口统一指向：
   `https://mc.jerret.me/download/android-latest.apk`
6. page-only deploy 会先从 GitHub latest 备份资产 hydrate `page/public/download/android-latest.apk`，再构建和部署，避免新页面部署清空下载文件。
7. 以下变更会自动触发 page 生产部署：
   - `page/**`
   - `.github/workflows/android-release.yml`
   - `scripts/release/verify-android-release-page-contract.mjs`
   - `scripts/release/prepare-page-android-download.mjs`

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

## GitHub Actions

```bash
gh secret set VERCEL_TOKEN --repo jiangtao/media-clean
```

配置完成后：

1. push 到 `main/master` 且命中 page/release-page contract 路径时，会自动触发 `.github/workflows/page-vercel.yml`
2. 也可以手动 `workflow_dispatch`
3. workflow 会先 hydrate Android APK、校验 release-page contract，再 build，再 deploy production，最后回查 `https://mc.jerret.me`

发布后检查：

1. 首页中文默认打开。
2. 视频能播放。
3. 手机 mock 背景图与 3 张界面展示图无 404。
4. `apps/icons/manifest.json` 可访问，且 `start_url` 指向 `/`。
5. `/landing.html` 能兼容回到首页。
6. Android 下载按钮指向 `https://mc.jerret.me/download/android-latest.apk`。
7. `https://mc.jerret.me/download/android-latest.apk` HEAD 请求成功，并返回 APK 下载响应。
