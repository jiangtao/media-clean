# Media Clean

[中文 README](./README.md)

Media Clean is an Android-first local photo-library recognition and cleanup tool. It targets accidental videos, blurry photos, similar photos, duplicates, and low-information media in family phone libraries. The product goal is to make “scan -> recognize -> review -> clean -> report” stable, recoverable, local, and explainable.

## Official Product Introduction

Public landing-page copy:

> Media Clean helps you quickly identify and clean duplicate, blurry, and similar photos, keeping your library tidy and freeing more storage space.

Product website: [https://mc.jerret.me](https://mc.jerret.me)

The public page positions Media Clean as a smart photo-library management tool with the headline “refresh your photo library”. It emphasizes local safety, one-tap cleanup, speed, and explainable abnormal-media results. The publishing page lives in [page](./page/README.en.md); the Chinese page documentation is [page/README.md](./page/README.md).

<video controls width="100%" src="./page/public/promo-video-60fps.mp4">
  This reader does not support embedded video playback.
</video>

Video file: [page/public/promo-video-60fps.mp4](./page/public/promo-video-60fps.mp4)

The current page includes:

1. Hero: smart photo-library management positioning, value proposition, and Google Play CTA.
2. Phone mock: scanning state, media counts, progress, and Photos / Recycle Bin / Settings navigation.
3. Feature cards: smart scan, one-tap cleanup, privacy safety, and speed.
4. Video intro: embedded `promo-video-60fps.mp4`.
5. Interface gallery: three product showcase images.
6. Bottom CTA: app download, product links, and support links.

## Current Product Capabilities

### Scan And Recognition

1. Requests photo and video permissions, then reads media metadata locally.
2. Scans the latest 12 months by default; Settings supports `1 / 2 / 3 / 6 / 12` month windows.
3. Each batch has an explicit time range and uses both `createdAfter` and `createdBefore` boundaries.
4. After the current window completes, continuing the scan backfills older months instead of repeatedly scanning completed batches.
5. After historical coverage is complete, the app enters a full-coverage state; newly added media can then trigger incremental scanning.
6. Supports Android local scan recovery: when the user switches screens or the app is interrupted, re-entering can reattach to the active batch.
7. UI progress and Android notification progress share the same batch numerator/denominator contract.

### Local Recognition

The first implementation does not call external AI APIs. Recognition is based on local heuristics and lightweight features:

1. Blur and low-quality detection use visual metrics such as brightness, contrast, and edge density.
2. Duplicate and near-duplicate detection preserve content hashes, difference hashes, image fingerprints, and video keyframe fingerprints.
3. Accidental and abnormal-media detection combines media type, duration, dimensions, file size, visual metrics, and rule thresholds.
4. Grouping and explanations show confidence, reasons, media metadata, previews, and duplicate-group context.
5. Durable results, candidate views, user decisions, and recycle-bin state are persisted in local SQLite.

### Cleanup And Recycle Bin

1. Candidates are never permanently deleted immediately.
2. High-confidence candidates can be moved into the in-app recycle bin in bulk.
3. The Recycle Bin screen owns the “keep and clean” workflow, including restore, keep, and final deletion.
4. Permanent deletion requires confirmation and calls the system media deletion API.
5. User decisions are written to `user_decision`; future scans should not overwrite keep, recycle, restore, delete, or failed decisions.
6. The recycle bin shows a cumulative cleanup report, including cleaned count, cleaned size, and last cleanup time.

### Settings, Reminders, And UX

1. Supports `zh-CN / en-US`, following the system language by default with manual override in Settings.
2. Supports light, dark, and system appearance modes.
3. Supports local cleanup reminders with configurable frequency, weekday, and time.
4. Supports scan-completion notifications, Android foreground scan notifications, and local reminder notifications.
5. Adapts to safe areas, notches, hole-punch screens, and foldable layout constraints.
6. Android splash, app icons, and publishing-page icons use the current brand assets.

### Publishing Page

1. The publishing page lives in `page/` and is decoupled from Expo Android/iOS builds.
2. Set the Vercel Root Directory to `page` to deploy it independently.
3. Recommended Vercel project name: `mc`; preview domain: `mc.vercel.app`; production domain target: `mc.jerret.me`.
4. Deployment contract: [docs/release/vercel.en.md](./docs/release/vercel.en.md); Chinese version: [docs/release/vercel.md](./docs/release/vercel.md).

## Technical Architecture

Media Clean is an Expo / React Native app with Android as the primary acceptance target. The JS layer owns the control plane, UI, result aggregation, and persistence coordination. The Android native layer owns background scan execution, foreground notifications, and local media enumeration. SQLite is the local source of truth for scan runtime state and user decisions.

![Media Clean architecture diagram](./design/assets/media-clean-architecture.svg)

Editable Draw.io source: [design/assets/media-clean-architecture.drawio](./design/assets/media-clean-architecture.drawio).

### Module Responsibilities

1. `src/application/`: app bootstrap, preferences, error boundary, reminder bootstrap, and observability fallback.
2. `src/navigation/`: Photos, Recycle Bin, and Settings tab navigation.
3. `src/ui/`: UI components, photo grid, scan progress, candidate cards, detail preview, and layout adaptation.
4. `src/domain/recognition/`: recognition types, visual metrics, scoring, and candidate generation.
5. `src/features/scan/`: scan range, media loading, Android native scan facade, batch progress, runtime recovery, and staging importer.
6. `src/features/cleanup/`: cleanup state machine for keep, recycle, restore, and delete actions.
7. `src/features/reminders/`: cleanup reminder copy, scheduling, background task, and runtime reconciliation.
8. `src/services/storage/`: AsyncStorage compatibility, SQLite operational store, scan job checkpoints, scan range, and preference storage.
9. `src/services/media/`: visual analysis and generated analysis-file cache management. Durable product truth should remain results plus original media URIs, not temporary files.
10. `plugins/withBackgroundScan.js`: Expo config plugin that injects Android background-scan native modules, foreground service, and permissions.
11. `android/`: current prebuilt Android native project for device builds, debugging, and verification.
12. `page/`: standalone Vercel static publishing page.
13. `docs/` and `design/`: goals, standards, release contracts, Android-first scan design, and product-page documentation.

## Data And State Contract

The project follows one principle: scan state, recognition results, and user actions must not rely on UI state as the source of truth.

Key tables and states:

1. `scan_batch`: batch mode, time range, phase, progress, and completion state.
2. `scan_batch_item`: per-asset stage, failure reason, and heartbeat inside a batch.
3. `asset_manifest`: MediaStore-derived metadata such as URI, type, dimensions, duration, size, capture time, bucket, and video fields.
4. `media_analysis`: per-asset analysis cache, including signature, fingerprint, hashes, frame fingerprints, and visual metrics.
5. `candidate_view`: direct candidate projection for UI consumption.
6. `recognition_group / recognition_member`: durable duplicate or near-duplicate grouping.
7. `user_decision`: keep, recycle, restore, delete, and failed decisions.
8. `recycle_bin_state`: in-app recycle-bin state.
9. `cleanup_report`: cumulative cleaned item count, cleaned size, and last cleanup time.
10. `scan_job`: active scan recovery checkpoint.

## Development Environment

Recommended environment:

1. Node.js and npm.
2. Expo SDK 54 / React Native 0.81.5.
3. Android Studio, Android SDK, JDK, and a connected Android device.
4. Vercel CLI, only when deploying `page/`.

Install dependencies:

```bash
npm install
```

Start Expo:

```bash
npm run start
```

Run Android:

```bash
npm run android
```

Run the iOS compatibility path:

```bash
npm run ios
```

Android remains the primary acceptance path for the current release. iOS remains Expo-compatible but is not the first release target.

## Common Commands

### App Verification

```bash
npm run test -- --run
npm run typecheck -- --pretty false
```

### Android Builds

```bash
npm run build:android:debug
npm run build:android:release
```

If Gradle daemon or Kotlin daemon errors mention locks, caches, or daemon compilation, first classify whether the root cause is environment locking, disk pressure, network repository access, or actual code failure.

### Publishing Page

```bash
npm run page:build
npm run page:dev
npm run page:preview
```

Production deployment:

```bash
npm run page:deploy:prod
```

Vercel configuration: [docs/release/vercel.en.md](./docs/release/vercel.en.md).

## Quality And Acceptance

Before delivery, run at least:

```bash
npm run test -- --run
npm run typecheck -- --pretty false
npm run page:build
```

For Android native scan, notifications, splash, or permission changes, also verify on a real device:

```bash
npm run build:android:debug
adb shell am force-stop com.jt.mistapmediacleaner
adb shell monkey -p com.jt.mistapmediacleaner 1
```

For publishing-page work, also run:

```bash
npm run page:preview
curl -sSI http://127.0.0.1:4173/
```

Acceptance checks:

1. Switching away during a scan and returning should still show the active scan state, not the permission entry state.
2. UI progress and Android notification progress should share the same batch numerator/denominator.
3. Completed batches should not be rescanned; recognition results should be reused.
4. Full-coverage completion should not loop into repeated scans; newly added media should trigger incremental scanning.
5. Recycle Bin should load, restore, and permanently delete correctly.
6. Reminder settings should not surface user-visible errors when a background task was not previously registered.
7. The publishing page should not overflow, over-space sections, or deform CTAs on desktop or mobile.

## Documentation

1. Product page content: [docs/product/page-home.en.md](./docs/product/page-home.en.md), Chinese version [docs/product/page-home.md](./docs/product/page-home.md).
2. Vercel release contract: [docs/release/vercel.en.md](./docs/release/vercel.en.md), Chinese version [docs/release/vercel.md](./docs/release/vercel.md).
3. Android scan and recognition design: [design/recognition-scan-android-first/README.en.md](./design/recognition-scan-android-first/README.en.md), Chinese version [design/recognition-scan-android-first/README.md](./design/recognition-scan-android-first/README.md).
4. Execution standard: [docs/standards/execution-standards.en.md](./docs/standards/execution-standards.en.md), Chinese version [docs/standards/execution-standards.md](./docs/standards/execution-standards.md).
5. Team-mode standard: [docs/standards/agent-team-mode.en.md](./docs/standards/agent-team-mode.en.md), Chinese version [docs/standards/agent-team-mode.md](./docs/standards/agent-team-mode.md).
6. Publishing page directory: [page/README.en.md](./page/README.en.md), Chinese version [page/README.md](./page/README.md).

## Current Boundaries

1. The current version validates Android first; iOS is not the first release acceptance path.
2. Public copy may use “AI” as product positioning, but the current repository implementation is local heuristic recognition and does not call external AI APIs.
3. Firebase / Crashlytics / Analytics are not part of the current Android-first release; observability can remain a noop fallback.
4. After recognition, durable storage should keep results, metadata, and original media URIs. Thumbnails, frame images, and temporary analysis files should not become durable product data.
5. The custom domain requires adding `mc.jerret.me` in Vercel Dashboard and configuring the DNS records Vercel provides.
