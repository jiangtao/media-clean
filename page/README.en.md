# Media Clean Publishing Page

[中文版本](./README.md)

This directory contains the standalone static publishing page for Media Clean and the Vercel deployment configuration, and this repository keeps only the runtime assets that are actually required for publication.

## Structure

1. `public/index.html`: the main landing page.
2. `dist/landing.html`: compatibility entry copied from `index.html` during build.
3. `public/promo-video-60fps.mp4`: embedded promo video.
4. `public/resources/*`: gallery images and the phone mock background.
5. `public/apps/icons/*`: favicon, PWA manifest, and app icon assets.
6. `scripts/build.mjs`: copies `public/` into `dist/`.
7. `scripts/dev-server.mjs`: local static server for dev / preview.
8. `vercel.json`: Vercel deployment config.

## Common Commands

```bash
npm run page:build
npm run page:dev
npm run page:preview
npm run page:deploy
npm run page:deploy:prod
```

## Deployment Contract

1. Set the Vercel Root Directory to `page`.
2. Use `npm run build` as the build command.
3. The output directory is `dist`.
4. Recommended preview domain: `mc.vercel.app`.
5. Planned production domain: `mc.jerret.me`.
6. Every Android download button points to `https://github.com/jiangtao/media-clean/releases/latest/download/media-clean-android-latest.apk`; the formal APK is maintained by `.github/workflows/android-release.yml` and is not duplicated inside `page/`.
