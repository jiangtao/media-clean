# Media Clean Page Publishing Best Practices

[中文版本](./best-practices.md)

## 1. Migrate Only Runtime Assets

The publishing directory keeps only the assets required for the current home page runtime, preview, and deployment.

## 2. Keep Page Deployment Decoupled From App Builds

`page/` uses static HTML and does not depend on Expo web. A Vercel page failure should not affect the Android app build chain.

## 3. Separate Page Source From Documentation Mirrors

The current official page uses only the approved Chinese source page. Do not add an unapproved English page. Official docs remain Chinese-first, with English documentation mirrors linking back to Chinese.

## 4. Do Not Overstate Current Capabilities

The page must not promise cloud AI, Firebase real-device reporting, or iOS as the primary current acceptance path. The current release is Android-first and local-heuristic based.

## 5. Keep Splash Asset Layers Separate

Android full-screen splash, brand lockup, and adaptive icon assets must not be mixed. Full-screen splash is for launch screen and publishing-page display, not launcher icons.
