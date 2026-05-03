# Vercel Release Contract

[中文版本](./vercel.md)

This document defines the Vercel deployment contract for the Media Clean publishing page in the current repository.

## Deployment Target

1. Publish directory: `page/`
2. Page entry: `page/public/index.html`
3. Compatibility entry: `page/dist/landing.html`, generated during build
4. Runtime assets: `page/public/resources/*`, `page/public/apps/icons/*`, and `page/public/promo-video-60fps.mp4`

## Repository Commands

```bash
npm run page:build
npm run page:dev
npm run page:preview
npm run page:deploy
npm run page:deploy:prod
```

## Vercel Setup

1. Root Directory: `page`
2. Build Command: `npm run build`
3. Output Directory: `dist`
4. Recommended preview domain: `mc.vercel.app`
5. Planned production domain: `mc.jerret.me`

## Acceptance

1. `npm run page:build` successfully generates `page/dist`
2. `npm run page:preview` serves the page locally
3. Video, images, icons, and the manifest all load correctly
4. Both `landing.html` and `/` render the home page correctly
