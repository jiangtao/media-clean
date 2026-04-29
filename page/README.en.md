# Media Clean Publishing Page

[中文版本](./README.md)

This directory is the standalone static publishing page for Media Clean. The page body directly uses `/Users/jt/places/personal/cleaner-app/index.html` and migrates the runtime assets it needs.

## Directory Contract

1. `public/index.html`: canonical publishing page migrated from `cleaner-app/index.html`.
2. `public/promo-video-60fps.mp4`: embedded promo video.
3. `public/resources/`: the three gallery images plus the phone mock background used by the page.
4. `public/apps/icons/`: favicon, PWA manifest, and brand icons.
5. `scripts/build.mjs`: dependency-free static build that copies `public` to `dist`.
6. `vercel.json`: Vercel static site config.

## Local Commands

```bash
npm run build
npm run dev
npm run preview
```

From the repository root:

```bash
npm run page:build
npm run page:dev
npm run page:preview
```

## Vercel Config

1. Project Root Directory: `page`
2. Framework Preset: `Other`
3. Build Command: `npm run build`
4. Output Directory: `dist`
5. Preview Domain: `mc.vercel.app`
6. Production Domain: `mc.jerret.me`

Full release contract: [docs/release/vercel.en.md](../docs/release/vercel.en.md).

## Content Modules

1. Hero: smart photo-library management positioning, main value proposition, and Google Play CTA.
2. Phone mock: scanning state, media count, progress, and bottom navigation.
3. Feature cards: smart scan, one-tap cleanup, privacy safety, and speed.
4. Video intro: embedded `promo-video-60fps.mp4`.
5. Interface gallery: three product display images.
6. Footer CTA: download and documentation links.
