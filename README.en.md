# Media Clean

[中文 README](./README.md)

Media Clean is a local photo-library recognition and cleanup tool. It is built for the accidental videos, blurry photos, similar photos, duplicate content, and low-information media that accumulate in family phone libraries. The product goal is to make "scan -> recognize -> review -> clean -> report" stable, recoverable, and explainable as a local cleanup flow.

Product website: [https://mc.jerret.me](https://mc.jerret.me)

<video controls width="100%" src="./page/public/promo-video-60fps.mp4">
  This reader does not support embedded video playback.
</video>

## Current Product Capabilities

![Media Clean expected next-version design](./design/assets/media-clean-light-simple-flow-boss-v5-tightened.png)

The image above is the expected light design direction for the next version. Future UI and product-page adjustments should use this visual direction as the reference.

Media Clean's current capabilities can be summarized into four product threads: local scan and recognition, explainable abnormal-media results, in-app recycle-bin cleanup, and recoverable Android scanning. The product goal is to "refresh your photo library"; with local safety as the baseline, it turns accidental videos, blurry photos, similar photos, duplicate content, and low-information media into candidates that users can review, restore, and finally clean.

<details>
<summary>Product Details</summary>

### Scan And Recognition

1. Requests photo and video read permissions, then reads media metadata locally.
2. Scans the latest 12 months by default; Settings supports `1 / 2 / 3 / 6 / 12` month windows.
3. Each active batch has an explicit time range and uses `createdAfter` and `createdBefore` to control the window boundaries.
4. After the current window is completed, continuing the scan backfills older months instead of repeatedly scanning completed batches.
5. After the full history is completed, the app enters the "full scan completed" state; if new media appears later, it enters incremental scanning.
6. Supports Android local scan recovery: when the user switches screens or the app is interrupted by the system, re-entering can reattach to the active scan batch.
7. UI progress and Android notification progress use the same batch numerator/denominator contract to avoid split display states.

### Local Recognition

The first version in this repository does not call external AI APIs. Recognition is based on local heuristics and lightweight features:

1. Blur and low quality: generates quality judgments from visual metrics such as brightness, contrast, and edge density.
2. Duplicates and near duplicates: preserves content hashes, difference hashes, image fingerprints, and video keyframe fingerprints.
3. Accidental and abnormal media: combines media type, duration, dimensions, file size, visual metrics, and rule thresholds to produce candidates.
4. Grouping and explanations: candidates show confidence, trigger reasons, media information, previews, and duplicate-group context.
5. Result persistence: recognition results, candidate views, user decisions, and recycle-bin state are written to local SQLite.

### Cleanup And Recycle Bin

1. Candidate media is never permanently deleted directly.
2. High-confidence candidates can be moved into the in-app recycle bin in bulk.
3. The Recycle Bin screen owns the "keep and clean" flow, including restore, continue keeping, and final deletion.
4. Permanent deletion requires a second user confirmation and calls the system media deletion capability.
5. User decisions are written to `user_decision`; later scans must not overwrite user-made keep, recycle, restore, or delete decisions.
6. The recycle-bin footer provides a cumulative cleanup report, including total cleaned count, total cleaned size, and latest cleanup time.

### Settings, Reminders, And Experience

1. Supports `zh-CN / en-US`, follows the system language by default, and can be manually switched in Settings.
2. Supports dark, light, and system-following themes.
3. Supports local cleanup reminders with configurable frequency, weekday, and time.
4. Supports scan-completion notifications, Android foreground scan notifications, and local reminder notifications.
5. Adapts layout strategies for notches, hole-punch screens, safe areas, and foldables.
6. Android splash screens, app icons, and publishing-page icons use the current brand assets.

### Publishing Page

1. The publishing page lives independently in `page/` and is decoupled from Expo Android/iOS builds.
2. Set Vercel Root Directory to `page` to deploy it independently.
3. Recommended Vercel project name: `mc`; preview domain: `mc.vercel.app`; production domain target: `mc.jerret.me`.
4. Detailed deployment contract: [docs/release/vercel.en.md](./docs/release/vercel.en.md); Chinese version: [docs/release/vercel.md](./docs/release/vercel.md).

</details>

## Technical Architecture

Media Clean is currently an Expo / React Native app, with Android as the primary acceptance path. The JS layer owns the control plane, UI, result aggregation, and persistence coordination. The Android native layer owns background scan execution, foreground notifications, and local media enumeration. SQLite is the local source of truth for scan runtime state and user decisions.

![Media Clean architecture diagram](./design/assets/media-clean-architecture.svg)

### Module Responsibilities

1. `src/application/`: app startup, preferences, error boundary, reminder bootstrap, and observability fallback.
2. `src/navigation/`: Photos, Recycle Bin, and Settings tab navigation.
3. `src/ui/`: UI components, photo grid, scan progress, candidate cards, detail preview, and page-layout adaptation.
4. `src/domain/recognition/`: recognition types, visual metrics, scoring, and candidate generation.
5. `src/features/scan/`: scan ranges, media loading, Android native scan facade, batch progress, runtime recovery, and staging importer.
6. `src/features/cleanup/`: candidate cleanup state machine and keep, recycle, restore, and delete actions.
7. `src/features/reminders/`: cleanup reminder copy, scheduling, background tasks, and runtime reconciliation.
8. `src/services/storage/`: AsyncStorage compatibility layer, SQLite operational store, scan job checkpoints, scan range storage, and preference storage.
9. `src/services/media/`: visual analysis and temporary analysis-file cache management. Durable truth should only store results and original media URIs; temporary files are not product data.
10. `plugins/withBackgroundScan.js`: Expo config plugin that injects Android background-scan native modules, foreground service, and permissions into the native project.
11. `android/`: current prebuilt Android native project for real-device builds, debugging, and verification.
12. `page/`: independent Vercel static publishing page.
13. `docs/` and `design/`: goals, standards, release contracts, Android-first scan design, and product page documentation.

## Data And State Contract

This project maintains one principle: scan state, recognition results, and user actions must not rely on the UI layer as the source of truth.

Current key tables and states include:

1. `scan_batch`: the mode, time range, phase, progress, and completion state of one scan batch.
2. `scan_batch_item`: each asset's analysis phase, failure reason, and heartbeat inside a batch.
3. `asset_manifest`: media metadata enumerated from Android, including URI, type, dimensions, duration, file size, capture time, bucket, video fields, and related fields.
4. `media_analysis`: per-asset analysis cache, including signatures, fingerprints, hashes, frame fingerprints, and visual metrics.
5. `candidate_view`: the candidate view directly consumed by the UI.
6. `recognition_group / recognition_member`: durable source of truth for duplicate and near-duplicate groups.
7. `user_decision`: user decisions such as keep, recycle, restore, delete, and failed.
8. `recycle_bin_state`: in-app recycle-bin state.
9. `cleanup_report`: cumulative cleaned count, cleaned size, and latest cleanup time.
10. `scan_job`: recovery checkpoint for the active scan job.

## Development Environment

Recommended environment:

1. Node.js and npm.
2. Expo SDK 54 / React Native 0.81.5.
3. Android Studio, Android SDK, JDK, and a connected Android real device.
4. Vercel CLI, only when publishing `page/`.

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

The current primary acceptance path remains Android. iOS keeps Expo-layer compatibility, but it is not the first-version release acceptance focus.

## Common Commands

### App Verification

```bash
npm run test -- --run
npm run typecheck -- --pretty false
```

### Android Builds

```bash
npm run build:android:debug
npm run build:android:release:smoke
```

`build:android:debug` produces the debug APK directly. For local release-pipeline smoke validation, use `build:android:release:smoke` to generate a temp-signed APK. The formal release APK is workflow-only so signing provenance and the page download entry stay unique. Use `npm run run:android:debug` when you specifically want to install and run on a device.

Android debug / release packaging, signing verification, and CI/CD pipeline details: [docs/release/android.en.md](./docs/release/android.en.md); Chinese version: [docs/release/android.md](./docs/release/android.md).

The primary Android device-observability contract: [docs/release/agent-device.en.md](./docs/release/agent-device.en.md); Chinese version: [docs/release/agent-device.md](./docs/release/agent-device.md).

If Gradle daemon or Kotlin daemon errors mention locks, caches, or compile-daemon failures, first clean or restart the Gradle daemon, then classify whether the issue is an environment lock, disk pressure, network repository access, or a code error.

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

Vercel configuration: [docs/release/vercel.en.md](./docs/release/vercel.en.md); Chinese version: [docs/release/vercel.md](./docs/release/vercel.md).

## Quality And Acceptance

Before committing, run at least:

```bash
npm run test -- --run
npm run typecheck -- --pretty false
npm run page:build
```

For Android native scan, notifications, splash, or permission changes, also verify on a real device:

```bash
npm run build:android:debug
npm run verify:android:observability
npm run verify:android:acceptance
npm run seed:android:media -- --clean
npm run verify:android:scan-probe
npm run test:maestro:smoke
adb shell am force-stop com.jt.mistapmediacleaner
adb shell monkey -p com.jt.mistapmediacleaner 1
```

Where:

1. `npm run verify:android:observability` is the primary device-observability entry point. The repository-level npm entry currently installs the current debug APK before capturing `snapshot`, `screenshot`, `logs`, `network`, `perf`, and optional `react-devtools` evidence.
2. `npm run verify:android:acceptance` is the first-run acceptance entry point. It covers the landing page, media permission, Settings, the reminder toggle, and notification-permission return flow.
3. `npm run verify:android:scan-probe` is the scan-main-flow probe. Paired with `npm run seed:android:media -- --clean`, it validates scan denominators, numerators, and scan result states against a fixed sample-media set.
4. `npm run test:maestro:smoke` is the secondary fallback smoke for quickly re-clicking the minimum flow. It no longer acts as the primary observability truth source.

For publishing-page changes, also run:

```bash
npm run page:preview
curl -sSI http://127.0.0.1:4173/
```

Acceptance should focus on:

1. Switching away during a scan and returning still shows the current scan state instead of falling back to the permission entry.
2. UI progress and Android notification progress use the same batch numerator/denominator.
3. Completed batches are not scanned repeatedly; recognition results are reused directly.
4. After full-history completion, scans do not continue in a loop; incremental scanning is only prompted when new media appears.
5. Recycle Bin can load, restore, and permanently delete normally.
6. Reminder toggles in Settings do not surface user-visible errors when a task does not exist.
7. The publishing page has no obvious overflow, excessive spacing, or CTA deformation on desktop or mobile.

## Documentation

1. Product publishing page docs: [docs/product/page-home.en.md](./docs/product/page-home.en.md); Chinese version: [docs/product/page-home.md](./docs/product/page-home.md).
2. Android release contract: [docs/release/android.en.md](./docs/release/android.en.md); Chinese version: [docs/release/android.md](./docs/release/android.md).
3. Agent Device device-observability contract: [docs/release/agent-device.en.md](./docs/release/agent-device.en.md); Chinese version: [docs/release/agent-device.md](./docs/release/agent-device.md).
4. Maestro acceptance contract: [docs/release/maestro.en.md](./docs/release/maestro.en.md); Chinese version: [docs/release/maestro.md](./docs/release/maestro.md).
5. Vercel release contract: [docs/release/vercel.en.md](./docs/release/vercel.en.md); Chinese version: [docs/release/vercel.md](./docs/release/vercel.md).
6. Android scan and recognition design: [design/recognition-scan-android-first/README.en.md](./design/recognition-scan-android-first/README.en.md); Chinese version: [design/recognition-scan-android-first/README.md](./design/recognition-scan-android-first/README.md).
7. Execution standard: [docs/standards/execution-standards.en.md](./docs/standards/execution-standards.en.md); Chinese version: [docs/standards/execution-standards.md](./docs/standards/execution-standards.md).
8. Team-mode standard: [docs/standards/agent-team-mode.en.md](./docs/standards/agent-team-mode.en.md); Chinese version: [docs/standards/agent-team-mode.md](./docs/standards/agent-team-mode.md).
9. Publishing page directory docs: [page/README.en.md](./page/README.en.md); Chinese version: [page/README.md](./page/README.md).

Android device observability workflows:

1. Primary device-observability workflow: [.github/workflows/android-agent-device-observability.yml](./.github/workflows/android-agent-device-observability.yml)
2. Secondary Maestro smoke workflow: [.github/workflows/android-maestro-smoke.yml](./.github/workflows/android-maestro-smoke.yml)

## Current Boundaries

1. The current version prioritizes Android validation; iOS is not the first release acceptance path.
2. If the public page uses "AI" wording, that is product-marketing positioning; the current repository implementation is still based on local heuristic recognition and does not integrate external AI APIs.
3. Firebase / Crashlytics / Analytics are not included in the current Android-first version. Observability can remain a noop fallback for now.
4. After recognition, durable storage should only keep results, metadata, and original media URIs. Thumbnails, frame images, and temporary analysis files should not become durable product data.
5. The Vercel custom domain requires adding `mc.jerret.me` in the Vercel Dashboard, then configuring DNS according to Vercel's instructions.
