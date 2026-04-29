# Media Clean Publishing Page Content

[中文版本](./page-home.md)

This document defines the official content structure for the `page/` publishing site. The page body uses `/Users/jt/places/personal/cleaner-app/index.html`, and the current public page is Chinese.

## Goals

1. Turn Media Clean from an engineering README description into a public product page.
2. Standardize the video, highlights, capability support, interface gallery, and download CTA.
3. Allow the page to deploy independently through Vercel to `mc.vercel.app`, then bind `mc.jerret.me`.

## Page Modules

1. Hero: smart photo-library management positioning, value proposition, and Google Play CTA.
2. Phone mock: scanning state, media count, progress, and photo/recycle/settings navigation.
3. Feature cards: smart scan, one-tap cleanup, privacy safety, and speed.
4. Video intro: embedded `promo-video-60fps.mp4`.
5. Interface gallery: three product display images.
6. Footer CTA: download and documentation entry.

## Copy Rules

1. Do not promise Firebase monitoring; the current version emphasizes local safety.
2. If the page says "AI", treat it as landing-page marketing copy; the current app implementation is still local-heuristic based.
3. Do not present iOS as the primary current acceptance path; this release is Android-first.
4. Do not depend on `docs/plans/**` as the formal publishing entry.

## Asset Sources

1. Page: `page/public/index.html`
2. Video: `page/public/promo-video-60fps.mp4`
3. Gallery images: `page/public/resources/photo-*`
4. Phone mock background: `page/public/resources/Screenshot_2026-04-20-22-28-31-006_com.jt.mistapmediacleaner.jpg`
5. Icons: `page/public/apps/icons`
