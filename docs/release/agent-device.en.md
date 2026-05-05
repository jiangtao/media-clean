# Agent Device Observability Contract

[中文版本](./agent-device.md)

Reusable contract companion: [Device Validation Lane Contract](./device-validation-lanes.en.md)

This document defines the primary device-observability layer in Media Clean's current Android-first delivery flow. Here, `agent-device` means the `callstackincubator/agent-device` device automation and observability CLI, not Firebase and not the repository's business-truth layer. Its job is to turn "what the real device or emulator showed, whether the target page was reachable, and what runtime evidence was produced" into stable artifacts.

## Goal

Establish a sustainable, reusable, artifact-first Android device observability path for this repository, covering:

1. The real UI state after launching the app on a device or emulator.
2. Whether permissions, navigation, settings, and scan-entry flows are still alive.
3. Runtime evidence such as focused log windows, network summaries, performance snapshots, and React component trees.
4. A device-level regression signal in CI, instead of relying only on manual adb screenshots.

## Layering

1. Build and signing layer: see [Android Release Contract](./android.en.md). This layer owns APK generation, `apksigner` verification, SHA256, and metadata.
2. Business-truth layer: SQLite / checkpoints / scan batches / recycle bin. This layer owns scan denominators, resume progress, and user-decision truth.
3. Device observability layer: `agent-device`, owning snapshots, screenshots, logs, network, perf, and react-devtools.
4. Interactive smoke layer: see [Maestro Acceptance Contract](./maestro.en.md). This stays as a secondary fallback and answers whether the smallest flow is still clickable.
5. Remote monitoring layer: still `noop fallback` in the current Android-first release and not the primary validation source.

Within this stack, `agent-device` is the current primary device-observability layer, but not the only truth source.

## Why it is the primary layer

`callstackincubator/agent-device` is a better fit for the repository's primary device-observability surface because it produces structured runtime evidence, not just taps:

1. `snapshot` / `snapshot -i`: token-efficient accessibility trees instead of pixel-only screenshots.
2. `screenshot --overlay-refs`: screenshots annotated with current interactive refs.
3. `logs clear --restart` / `logs path`: tightly scoped repro logs.
4. `network dump --include headers`: recent HTTP(s) summaries.
5. `perf --json`: frame-health and runtime-performance evidence.
6. `react-devtools`: React component trees, slow renders, and rerenders.

That is materially more sustainable than the current "adb screenshot + human guesswork" loop.

## Repository entry points

The repository now exposes these stable entry points:

```bash
npm run agent-device:workflow
npm run seed:android:media -- --serial <android-serial>
npm run observability:device:doctor
npm run verify:android:observability -- --serial <android-serial>
npm run verify:android:acceptance -- --serial <android-serial>
npm run verify:android:scan-probe -- --serial <android-serial>
npm run verify:android:scan-complete -- --serial <android-serial>
npm run verify:android:continue-scan -- --serial <android-serial>
npm run verify:android:permission-denied -- --serial <android-serial>
npm run verify:android:scan-cleanup -- --serial <android-serial>
npm run verify:android:recycle -- --serial <android-serial>
npm run verify:android:recycle-delete -- --serial <android-serial>
npm run verify:device:lane -- android <lane> --serial <android-serial>
npm run verify:device:lane:android:emulator-core -- --serial <android-serial>
npm run verify:device:lane:android:emulator-seeded -- --serial <android-serial>
npm run verify:device:lane:android:real-device-core -- --serial <android-serial>
npm run test:agent-device:smoke -- --serial <android-serial>
npm run observability:device:react -- --serial <android-serial>
```

Backed by:

1. [scripts/android/run-agent-device.sh](../../scripts/android/run-agent-device.sh)
2. [scripts/android/run-agent-device-observability.sh](../../scripts/android/run-agent-device-observability.sh)
3. [scripts/device/run-validation-lane.sh](../../scripts/device/run-validation-lane.sh)
4. [package.json](../../package.json)

Default assumptions:

1. `agent-device@0.14.7`
2. Android package id: `com.jt.mistapmediacleaner`
3. Metro port: `8081`
4. Session name: `media-clean-observability`
5. Prefer the repo-local `node_modules/.bin/agent-device`, and fall back to `npx agent-device@0.14.7` only when local dependencies are missing

## Reusable lane contract

The validation chain has now been raised from “single Android commands” to a “platform-neutral lane contract plus Android adapter” model:

1. lane contract: [Device Validation Lane Contract](./device-validation-lanes.en.md)
2. Android adapter: [scripts/device/run-validation-lane.sh](../../scripts/device/run-validation-lane.sh)
3. flow adapter: [scripts/android/run-agent-device-observability.sh](../../scripts/android/run-agent-device-observability.sh)

Current lane set:

1. `android emulator-core`
2. `android emulator-seeded`
3. `android real-device-core`

Current local validation status:

1. `android emulator-core` is fully green on the local arm64 emulator
2. `android emulator-seeded` is fully green on the local arm64 emulator
3. `android real-device-core` already has real-device flow-level artifacts, but workflow-level remote green evidence is still not closed

Latest local full-lane evidence as of `2026-05-05`:

1. `artifacts/device-validation/android/emulator-seeded-final-v3/scan-probe/20260505-031436`
2. `artifacts/device-validation/android/emulator-seeded-final-v3/continue-scan/20260505-031525`
3. `artifacts/device-validation/android/emulator-seeded-final-v3/scan-cleanup/20260505-031653`
4. `artifacts/device-validation/android/emulator-seeded-final-v3/recycle/20260505-031840`
5. `artifacts/device-validation/android/emulator-seeded-final-v3/recycle-delete/20260505-031938`

External blockers that still remain:

1. `adb devices -l` currently shows only `emulator-5554`; the real device `d28739dc` is still absent from `adb`
2. the current working branch `android-pipeline-main-verify` still has no upstream, and the remote still does not expose the `android-agent-device-observability` workflow, so GitHub runner evidence is still missing

When iOS support is added later, these should remain stable:

1. lane names
2. artifact directory structure
3. the command shape `verify:device:lane -- <platform> <lane>`

## Standard run order

Recommended local order for device observability:

```bash
npm run build:android:debug
npm run verify:android:observability -- --serial <android-serial>
npm run test:agent-device:smoke -- --serial <android-serial>
npm run verify:android:acceptance -- --serial <android-serial>
npm run seed:android:media -- --serial <android-serial> --clean
npm run verify:android:scan-probe -- --serial <android-serial>
npm run verify:android:scan-complete -- --serial <android-serial>
npm run verify:android:continue-scan -- --serial <android-serial>
npm run verify:android:permission-denied -- --serial <android-serial>
npm run seed:android:media -- --serial <android-serial> --clean
npm run verify:android:scan-cleanup -- --serial <android-serial>
```

If you also want to include recycle-bin restore and permanent-delete flows in the same sustainable device-observability chain, continue with:

```bash
npm run seed:android:recycle-bin -- --serial <android-serial>
npm run verify:android:recycle -- --serial <android-serial>
npm run seed:android:recycle-bin -- --serial <android-serial>
npm run verify:android:recycle-delete -- --serial <android-serial>
```

At the current repository state, this local emulator observability chain can now cover, repeatably:

1. `acceptance`: first launch, Landing -> Main, media permission, notification permission, and Settings return flow
2. `permission-denied`: first media-permission denial and return guidance
3. `scan-probe`: scan-main-flow outcome detection and stable denominator capture
4. `scan-complete`: on a real device or non-seeded environment, drive one real scan to `result-ready / exhausted / all-complete` and verify baseline plus result-cache persistence
5. `continue-scan`: backfill return from an exhausted current window into an older historical window
6. `scan-cleanup`: scan result -> detail -> cleanup -> recycle-bin return
7. `recycle`: recycle bin -> detail -> restore -> recycle-bin root return
8. `recycle-delete`: recycle bin -> detail -> system delete confirmation -> hard delete -> empty-state return

At the same time, the real-device baseline is now in place too:

1. real-device `capture`: a baseline observability artifact now exists from Xiaomi `M2102J2SC` (Android 11)
2. real-device `acceptance`: now covers Landing -> Main, the MIUI media-permission dialog, Settings, the reminder toggle, and the return flow
3. real-device `permission-denied`: now covers the first media-permission denial and return guidance back to the main workspace
4. real-device `scan-probe`: confirms that real-media enumeration no longer collapses immediately into `0 assets`
5. real-device `scan-complete`: confirms that a real scan can now reach `result-ready` and overwrite the old `0 assets` baseline
6. real-device `recycle`: now passes `RecycleBin -> detail -> restore -> recycle empty` after deterministic recycle seeding
7. real-device `recycle-delete`: now passes `RecycleBin -> detail -> hard delete -> recycle empty` after deterministic recycle seeding and the Android 11 delete-permission fix

The GitHub Actions matrix now follows the same lane structure:

1. `static`
2. `android-emulator-core`
3. `android-emulator-seeded`
4. `android-real-device-core`

Where:

1. the first three lanes now have workflow structure that can run directly on GitHub-hosted runner + emulator jobs
2. `android-real-device-core` currently runs as a manual `workflow_dispatch + self-hosted` lane
3. real remote green evidence is still missing, so workflow structure alone must not be treated as final closure

The flows that still remain emulator-only are mainly the deeper seeded probes that intentionally write sample media or deeper recycle-bin state: `continue-scan / scan-cleanup`. `scan-probe / scan-complete / recycle / recycle-delete` now also support real-device runs against real media.

If you only want environment and device discovery first:

```bash
npm run observability:device:doctor -- --serial <android-serial>
```

If you only want React component-tree evidence:

```bash
npm run observability:device:react -- --serial <android-serial>
```

If you want to bring the actual scan flow into device observability, seed a fixed sample-media set first:

```bash
npm run seed:android:media -- --serial <android-serial> --clean
```

If you also want to validate recycle-bin restore and permanent-delete afterwards, continue with:

```bash
npm run seed:android:recycle-bin -- --serial <android-serial>
```

This warms two layers at the same time:

1. `recycle_bin_state` inside `files/SQLite/app-cleaner-operational.db`
2. `app-cleaner/recycle-bin-candidate-cache` inside `databases/RKStorage`

That lets `RecycleBinScreen` render one restorable candidate immediately before the heavy refresh finishes, instead of exposing only the empty state to the observability harness.

This seed path no longer depends on a stale `photo-scan-session` as a single source. When the legacy session cache is missing, it falls back to:

1. `asset_manifest` in the operational store
2. device-side `MediaStore`

to rebuild a restorable candidate fixture, so `seed:android:recycle-bin` remains reusable even after restore / hard-delete flows.

The `capture` path automatically:

1. Binds to exactly one Android target, or requires an explicit `--serial`.
2. Optionally installs the debug APK.
3. Runs `adb reverse tcp:8081 tcp:8081`.
4. Runs `agent-device metro prepare --kind expo`.
5. Opens `com.jt.mistapmediacleaner --relaunch`.
6. Runs `logs clear --restart`.
7. Collects `snapshot.json`, `snapshot-interactive.json`, `current-screen.png`, `perf.json`, and `network.txt`.
8. If `--react-devtools` is enabled, also collects `react-status.json`, `react-tree.json`, and `react-errors.json`.

The `smoke` path continues from the same observability bootstrap and runs a minimal stable user flow:

1. Scroll the landing page and continue into the main app.
2. Verify the main tabs are present.
3. Open Settings.
4. Verify `theme-option-dark`, `theme-option-light`, `language-option-zh-CN`, and `language-option-en-US`.
5. Toggle dark -> light theme.
6. Toggle Chinese -> English.
7. Save step-level `snapshot`, `snapshot -i`, and `screenshot` artifacts into `steps/`.

The `acceptance` path runs a fuller, replayable first-run acceptance journey:

1. Clears app data and best-effort revokes media and notification permissions so the run starts from a reproducible first-launch state.
2. Enters the Landing screen and continues into the main workspace.
3. Triggers and handles the media-permission system dialog.
4. Verifies that the app returns to the main workspace after permission is granted instead of falling back to Landing.
5. Enters Settings and toggles reminders.
6. Triggers and handles the notification-permission system dialog.
7. Verifies that the app still returns to Settings after notification permission instead of resetting back to Landing.
8. Saves each step's `snapshot`, `snapshot -i`, and `screenshot` artifacts into `steps/`.

The `scan-probe` path owns the scan-main-flow evidence and is no longer mixed into `acceptance`:

1. Opens the app and passes Landing when needed.
2. If media permission is still missing, it first tries to bring the app into a scan-ready permission state; if the UI does not refresh, it falls back to the real system permission dialog.
3. Runs a full-snapshot preflight first; if the current scan window is already in `scan-all-complete`, `scan-exhausted`, or an existing result state, it records that outcome directly instead of forcing a new tap on `photo-grid-start-scan-button`.
4. Only when the preflight still reports a pending start state does it wait for `photo-grid-start-scan-button` and trigger a new scan.
5. Polls accessibility snapshots rather than relying only on `wait`, matching one of:
   `scan-all-complete`, `scan-exhausted`, or `scan-running`.
6. When `scan-running` is observed, records the current segmented counts and then cancels the scan so the probe stays bounded and reproducible.
7. Writes the scan outcome plus the `segmented-count-{all,photo,video}` summary into the root `scan-probe-state.json`, and stores the step artifacts under `steps/`.

The `scan-complete` path reuses the same preflight and persistence assertions as `scan-probe`, but is meant for real devices or any environment that already contains real media:

1. Opens the app and passes Landing when needed.
2. If media permission is still missing, brings the app into a scannable state first.
3. Presses `photo-grid-start-scan-button` only when the main page is still waiting to start.
4. Does not cancel at `scan-running`; instead it waits until one terminal state appears:
   `scan-result-ready`, `scan-exhausted`, or `scan-all-complete`.
5. After the terminal state, pulls `app-cleaner-operational.db` and `RKStorage`, then verifies:
   - the latest batch is `completed`
   - `enumerated_count / analyzed_count / candidate_count` match the terminal state
   - `scan_baseline`, `candidate_view_meta`, and `photo-scan-result-cache` are persisted when expected
6. Stores the terminal summary plus persistence snapshots under `persistence/post-scan/*` and `steps/`.

The `continue-scan` path automatically switches the seeded media into a deterministic layout where only one recent image remains in the current window and everything else is pushed into the next historical window, then covers `current window exhausted -> continue scan -> historical window result`:

1. Automatically runs `seed:android:media --clean --continue-scan-layout`, keeping only one recent image in the current window and moving the remaining JPG / PNG / MP4 samples into the next backfill window.
2. Clears app data and re-enters the main workspace from a reproducible first-run state.
3. Opens and grants the media-permission system dialog.
4. Presses `photo-grid-start-scan-button` and waits for the first outcome.
5. Records the first `scan-exhausted` summary and requires the CTA label to become `继续扫描` / `Scan again`.
6. Presses the continue-scan CTA and waits for the second outcome.
7. If the second pass lands directly in a result state, records `scan-result-ready`; otherwise it still requires the scan range label or the segmented counts to advance.
8. Writes both summaries into `continue-scan-transition.json` and stores the `scan-exhausted -> continue-scan -> next-window` evidence under `steps/`.

The `permission-denied` path covers the first-run media-permission denial and return guidance:

1. Clears app data and best-effort revokes media and notification permissions so the run starts from a reproducible first-launch state.
2. Enters Landing and continues into the main workspace.
3. Opens the media-permission system dialog.
4. Presses the system `Don’t allow` / `Deny` action.
5. Verifies that the app returns to the main workspace and shows `photo-grid-request-permission-button` again.
6. Saves `main -> media-permission-dialog -> denied-return` evidence into `steps/`.

The `scan-cleanup` path assumes that the fixed sample-media set has already been seeded and covers `scan result -> detail -> cleanup -> recycle return`:

1. Clears app data and enters the main workspace from a reproducible first-launch state.
2. Triggers and grants the media-permission system dialog.
3. Presses `photo-grid-start-scan-button` and waits for `scan-all-complete` or `scan-exhausted`.
4. If the top completion title does not appear reliably but `photo-grid-item` is already visible, treats that as `scan-result-ready` instead of waiting forever on the old anchor.
5. If scan result items exist, opens the first `photo-grid-item`, preferring the interactive snapshot `@ref`.
6. Verifies the `detail-primary-action` in the detail viewer.
7. Performs the primary cleanup action and returns to the app foreground.
8. Opens `RecycleBin` and confirms that an item is now visible there.
9. Saves `main -> scan -> detail -> cleaned -> recycle` evidence into `steps/`.

The `recycle` path goes deeper, assuming the sample media and recycle-bin candidate cache have already been seeded:

1. Open the app and confirm it has already passed Landing.
2. Enter the `RecycleBin` tab and wait for the stable anchor `recycle-bin-header-title`.
3. If a recycle-bin item exists, open the first `photo-grid-item`.
4. Verify `detail-primary-action` and `detail-hard-delete` in the detail viewer.
5. Perform restore and verify that the app returns to the recycle-bin root instead of falling back elsewhere.
6. Save `main -> recycle -> detail -> restored` evidence under `steps/`.

The `recycle-delete` path reuses the same seeded state and covers permanent delete:

1. Open the app and confirm it has already passed Landing.
2. Enter the `RecycleBin` tab and wait for the stable anchor `recycle-bin-header-title`.
3. If a recycle-bin item exists, open the first `photo-grid-item`.
4. Verify `detail-hard-delete` in the detail viewer.
5. If Android shows the `Media PermissionActivity` delete confirmation, press `Allow`.
6. Verify that the app returns to the recycle-bin root after deletion, ideally matching `recycle-bin-empty-title`.
7. Save `main -> recycle -> detail -> confirmation -> deleted-empty` evidence under `steps/`.

The `seed:android:media` path injects a fixed sample-media set into the emulator and triggers MediaStore indexing:

1. 3 duplicate sample images
2. 1 high-resolution PNG reference image
3. 1 MP4 sample video

In the default layout, all of these assets stay inside the current 12-month scan window and feed `scan-probe` plus `scan-cleanup`.

When `--continue-scan-layout` is supplied, the script will:

1. Keep `media-clean-sample-unique-1.jpg` inside the current window
2. Push the remaining JPG / PNG / MP4 samples into the next historical window

That makes the continue-scan/backfill semantics reproducible, so the first pass exhausts the current window and the second pass lands in historical results.

## Artifact contract

Every `capture` run writes evidence into `artifacts/agent-device/<timestamp>/`. The minimum artifact set is:

1. `devices.json`
2. `apps.json`
3. `metro-runtime.json`
4. `snapshot.json`
5. `snapshot-interactive.json`
6. `current-screen.png`
7. `perf.json`
8. `network.txt`
9. `log-path.txt`
10. `session.log` if the session log path can be copied

When React DevTools is enabled:

1. `react-status.json`
2. `react-tree.json`
3. `react-errors.json`

When `smoke` runs:

1. `steps/01-launch/*`
2. `steps/02-landing-ready/*` when the run actually passes through Landing
3. `steps/03-main-tabs/*`
4. `steps/04-settings-ready/*`
5. `steps/05-theme-dark/*`
6. `steps/06-theme-light/*`
7. `steps/07-language-zh/*`
8. `steps/08-language-en/*`

When `acceptance` runs:

1. `steps/01-landing-ready/*`
2. `steps/02-landing-cta/*`
3. `steps/03-main-before-media-permission/*`
4. `steps/04-media-permission-dialog/*`
5. `steps/05-main-after-media-allow/*`
6. `steps/06-settings-before-reminder-toggle/*`
7. `steps/07-notification-permission-dialog/*`
8. `steps/08-settings-after-notification-allow/*`

When `scan-probe` runs:

1. `steps/01-landing-ready/*` when the run actually passes through Landing
2. `steps/02-landing-cta/*` when the run actually passes through Landing
3. `steps/03-main-before-media-permission/*` when the run still needs media-permission recovery
4. `steps/04-media-permission-dialog/*` when the permission-recovery grant does not refresh the UI and the flow falls back to the real system prompt
5. `steps/05-main-ready/*`
6. `steps/06-scan-started/*` only when the page is still in a clickable start-scan state
7. `steps/07-scan-all-complete/*`, `steps/07-scan-exhausted/*`, or `steps/07-scan-running/*`
8. `steps/08-scan-cancelled/*` when the scan is still running
9. `steps/*/scan-probe-state.json` with the outcome plus the `segmented-count-{all,photo,video}` summary

When `continue-scan` runs:

1. `steps/01-landing-ready/*`
2. `steps/02-landing-cta/*`
3. `steps/03-main-before-media-permission/*`
4. `steps/04-media-permission-dialog/*`
5. `steps/05-main-after-media-allow/*`
6. `steps/06-first-scan-started/*`
7. `steps/07-scan-exhausted/*`
8. `steps/08-continue-scan-started/*`
9. `steps/09-scan-result-ready/*` or `steps/09-scan-exhausted/*`
10. `continue-scan-transition.json` with both outcomes, range labels, CTA labels, and segmented counts

When `permission-denied` runs:

1. `steps/01-landing-ready/*`
2. `steps/02-landing-cta/*`
3. `steps/03-main-before-media-permission/*`
4. `steps/04-media-permission-dialog/*`
5. `steps/05-main-after-media-deny/*`

When `scan-cleanup` runs:

1. `steps/01-landing-ready/*`
2. `steps/02-landing-cta/*`
3. `steps/03-main-before-media-permission/*`
4. `steps/04-media-permission-dialog/*`
5. `steps/05-main-after-media-allow/*`
6. `steps/06-scan-all-complete/*`, `steps/06-scan-exhausted/*`, or `steps/06-scan-result-ready/*`
7. `steps/07-scan-result-item-visible/*`
8. `steps/08-scan-detail/*`
9. `steps/09-recycle-bin/*`
10. `steps/10-recycle-item-visible/*`

When `recycle` runs:

1. `steps/02-main-tabs/*`
2. `steps/03-recycle-bin/*`
3. `steps/04-recycle-item-visible/*` or `steps/04-recycle-empty/*`
4. `steps/05-recycle-detail/*` when an item exists
5. `steps/06-recycle-restored/*` after restore succeeds

When `recycle-delete` runs:

1. `steps/02-main-tabs/*`
2. `steps/03-recycle-bin/*`
3. `steps/04-recycle-item-visible/*` or `steps/04-recycle-empty/*`
4. `steps/05-recycle-detail/*` when an item exists
5. `steps/05-recycle-delete-confirmation/*` when the system confirmation dialog appears
6. `steps/06-recycle-deleted-empty/*` or `steps/06-recycle-deleted/*`

## Relationship to SQLite and signing verification

`agent-device` only owns device-scene evidence. It does not replace:

1. Release trust, which still belongs to [Android Release Contract](./android.en.md) and `artifacts/android-release/*`.
2. Scan numerator/denominator truth, batch completion, recycle-bin state, and resume checkpoints, which still belong to SQLite-backed state and its tests.

When evidence conflicts, keep this order:

1. Signing or metadata failure: fail the packaging path first and stop calling it release acceptance.
2. UI and SQLite disagree: record a product-consistency bug; do not treat the screenshot as truth.
3. Screenshot evidence without artifact or checkpoint comparison: insufficient evidence; do not claim completion.

## Expo and Android adaptation points

This repository is Expo managed and Android-first. `agent-device` integration must respect these boundaries:

1. `android/` is a prebuild artifact, not a long-lived manual editing surface.
2. Packaging stays consolidated on `build-debug-apk.sh` and `build-release-apk.sh`; the observability script attaches after that.
3. Debug / dev-client builds are for fast device observation; release builds are for final shipping acceptance.
4. The device-observability script defaults to a single device to avoid cross-target contamination.
5. There is no Firebase-backed remote monitoring today, so every key conclusion must carry local artifact paths.

## Xiaomi and test-only helper limits

On Android, `agent-device` relies on its snapshot helper. According to the official Android helper README, that helper is a `test-only instrumentation APK` installed via `adb install -r -t`. That implies:

1. Some OEM devices or providers can block test-only package installation.
2. On Xiaomi / MIUI, this is the same class of blocker we already saw with the Maestro driver.
3. The first classification should therefore be a harness or OEM-install-policy blocker, not proof that `Media Clean` itself failed to boot.

Recommended fallback order:

1. Reuse an already installed helper or driver.
2. Switch to an Android emulator for the primary `agent-device` observability path.
3. Prefer repo-native real-device follow-up such as `capture` and `scan-complete`, which do not depend on seeded media.
4. Keep Maestro only as a secondary smoke fallback, not as the main observability truth.

## CI entry point

The repository now includes the primary workflow:

1. [.github/workflows/android-agent-device-observability.yml](../../.github/workflows/android-agent-device-observability.yml)

It will:

1. `npm ci`
2. `npm run typecheck -- --pretty false`
3. `npm run test:observability`
4. `bash scripts/android/build-debug-apk.sh --skip-install`
5. Run `npm run verify:android:observability` on an emulator
6. Run `npm run test:agent-device:smoke` on the same emulator
7. Run `npm run verify:android:acceptance` on the same emulator
8. Seed the fixed sample-media set, then run `npm run verify:android:scan-probe` on the same emulator
9. Run `npm run verify:android:continue-scan` on the same emulator
10. Run `npm run verify:android:permission-denied` on the same emulator
11. Re-seed the standard sample-media set, then run `npm run verify:android:scan-cleanup`
12. Seed the recycle-bin candidate cache
13. Run `npm run verify:android:recycle` on the same emulator
14. Seed the recycle-bin candidate cache again and run `npm run verify:android:recycle-delete`
15. If a real-device follow-up is available, run `npm run verify:android:scan-complete -- --serial <real-device-serial>`
16. Upload `artifacts/agent-device/**` plus the debug APK, metadata, and signing report

The retained [device-compatibility.yml](../../.github/workflows/device-compatibility.yml) is now repositioned as `Legacy Device Compatibility Exploratory`, used only for manual or nightly exploratory runs instead of the primary branch gate.

## Relationship to Maestro

Maestro stays in the repository, but its role changes:

1. `agent-device`: the primary device-observability layer with structured evidence.
2. Maestro: the secondary interactive smoke or fallback layer.

The recommended triage order is now:

1. inspect `agent-device` artifacts first,
2. then inspect SQLite / checkpoints / metadata,
3. and only then use Maestro if you need a very fast minimum-flow click-through.

## Official references

1. GitHub README: <https://github.com/callstackincubator/agent-device>
2. Introduction: <https://incubator.callstack.com/agent-device/docs/introduction>
3. Installation: <https://incubator.callstack.com/agent-device/docs/installation>
4. Debugging & Profiling: <https://incubator.callstack.com/agent-device/docs/debugging-profiling>
5. Replay & E2E: <https://incubator.callstack.com/agent-device/docs/replay-e2e>
6. Known Limitations: <https://incubator.callstack.com/agent-device/docs/known-limitations>
7. Android helper README: <https://github.com/callstackincubator/agent-device/tree/main/android-snapshot-helper>
