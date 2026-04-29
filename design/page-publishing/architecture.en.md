# Media Clean Page Publishing Architecture

[中文版本](./architecture.md)

## Modules

1. `page/public/index.html`: published copy of the approved `../cleaner-app/index.html`, the single source of truth for page content.
2. `page/public/promo-video-60fps.mp4`: promo video resource for the page.
3. `page/public/resources`: runtime image resources for the page.
4. `page/public/apps/icons`: favicon, touch icon, PWA icons, manifest, and logo resources.
5. `page/scripts/build.mjs`: dependency-free build script that copies `public` to `dist`.
6. `page/vercel.json`: Vercel build, cache, and rewrite config.
7. `assets/splash-android-phone.png`: Android 9:16 splash source.
8. `android/app/src/main/res/drawable-nodpi/splashscreen_full.png`: native Android launch-screen resource currently used.

## Data Flow

```text
../cleaner-app/index.html + runtime assets
  -> page/public
  -> npm run page:build
  -> page/dist
  -> Vercel project mc
  -> mc.vercel.app / mc.jerret.me
```

## Android Splash Sync

1. `app.json` uses `assets/splash-brand.png` as the generic splash lockup.
2. `app.json.android.splash` uses `assets/splash-android-phone.png`.
3. Because the repo already has an `android/` native directory, `drawable-nodpi/splashscreen_full.png` and `ic_launcher_background.xml` must be synced manually; editing only `app.json` is not enough.
