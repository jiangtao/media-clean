# Vercel Release Contract

[中文版本](./vercel.md)

This document defines the Vercel auto-deployment contract for the Media Clean publishing page. The page code lives under `page/` and is decoupled from the Expo Android/iOS app build.

## Project Config

1. Vercel Project Name: `mc`
2. Root Directory: `page`
3. Framework Preset: `Other`
4. Install Command: default
5. Build Command: `npm run build`
6. Output Directory: `dist`
7. Preview Domain: `mc.vercel.app`
8. Production Domain: `mc.jerret.me`

## Repository Config

1. `page/package.json` provides `build/dev/preview/deploy/deploy:prod` scripts.
2. `page/vercel.json` configures `cleanUrls`, output directory, static-asset caching, and `/landing.html` compatibility rewrite.
3. Root `package.json` provides `page:build/page:dev/page:preview/page:deploy/page:deploy:prod` for repository-root validation and deployment.
4. Do not commit `.vercel/`; project ID, org ID, and token should live in Vercel Dashboard or CI secrets.

## DNS Setup

1. Add `mc.jerret.me` to Vercel project Domains.
2. Configure the CNAME or required DNS record provided by Vercel.
3. Wait for Vercel domain verification.
4. Verify `https://mc.jerret.me`.

## Verification

```bash
npm run page:build
cd page && npm run preview
```

## Deploy Command

```bash
npm run page:deploy:prod
```

If the local Vercel token is invalid, run `vercel login` first or configure `VERCEL_TOKEN` in CI, then rerun the production deploy command.

Post-deploy checks:

1. Chinese page opens by default.
2. Video playback works.
3. The phone mock background and three interface gallery images have no 404s.
4. `apps/icons/manifest.json` is reachable and `start_url` points to `/`.
5. `/landing.html` rewrites back to the homepage.
