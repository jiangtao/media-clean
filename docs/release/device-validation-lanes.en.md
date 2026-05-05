# Device Validation Lane Contract

[中文版](./device-validation-lanes.md)

This document defines the **reusable lane contract** for Media Clean device validation. The goal is not to stay Android-only forever. We are using Android-first implementation to establish a platform-neutral contract plus a platform adapter model, so iOS can reuse the same lane structure later.

## Goal

1. Turn device verification from ad-hoc commands into lanes.
2. Make the parallel boundaries explicit so stateful flows do not corrupt each other.
3. Let Android run now while keeping the contract reusable for future iOS support.

## Layers

1. **Lane contract layer**
   - Defines validation groups, input parameters, artifact directories, and parallel boundaries.
2. **Platform adapter layer**
   - Android currently uses [scripts/device/run-validation-lane.sh](../../scripts/device/run-validation-lane.sh) to dispatch into [scripts/android/run-agent-device-observability.sh](../../scripts/android/run-agent-device-observability.sh).
   - iOS currently reserves the contract only; no adapter exists yet.
3. **Flow probe layer**
   - `capture`, `acceptance`, `permission-denied`
   - `scan-probe`, `scan-complete`
   - `continue-scan`, `scan-cleanup`
   - `recycle`, `recycle-delete`

## Current entry points

```bash
npm run verify:device:lane -- android emulator-core --serial <serial>
npm run verify:device:lane -- android emulator-seeded --serial <serial>
npm run verify:device:lane -- android real-device-core --serial <serial>

npm run verify:device:lane:android:emulator-core -- --serial <serial>
npm run verify:device:lane:android:emulator-seeded -- --serial <serial>
npm run verify:device:lane:android:real-device-core -- --serial <serial>
```

## Lane definitions

### `android emulator-core`

Best for base UI and permission flows that do not depend on seeded data or real media.

Includes:

1. `capture`
2. `smoke`
3. `acceptance`
4. `permission-denied`

Default artifact root:

```text
artifacts/device-validation/android/emulator-core/
```

### `android emulator-seeded`

Best for deterministic seeded flows that depend on injected sample media or recycle-bin state.

Includes:

1. `seed:android:media --clean`
2. `scan-probe`
3. `continue-scan`
4. `seed:android:media --clean`
5. `scan-cleanup`
6. `seed:android:recycle-bin`
7. `recycle`
8. `seed:android:recycle-bin`
9. `recycle-delete`

Default artifact root:

```text
artifacts/device-validation/android/emulator-seeded/
```

### `android real-device-core`

Best for non-seeded core validation on a real Android phone.

Includes:

1. `capture`
2. `acceptance`
3. `permission-denied`
4. `scan-probe`
5. `scan-complete`

Default artifact root:

```text
artifacts/device-validation/android/real-device-core/
```

After each lane finishes, the artifact root also writes a `lane-summary.json`. It is the lane-level closure record and contains at least:

1. `platform`
2. `lane`
3. `serial`
4. `status`
5. `exitCode`
6. `lastStep`
7. `artifacts`
8. `completedAt`

For manual execution, treat both “command exits with `0`” and “`lane-summary.json.status == passed`” as the lane-level pass signal.

## Parallel rules

### Safe to run in parallel

1. `static` checks with any device lane
2. `android emulator-core` with `android emulator-seeded`
3. `android real-device-core` with emulator lanes
4. Future `ios *` lanes with Android lanes

Only if they use:

1. **different jobs**
2. **different serials / different devices**
3. **different artifact roots**
4. **different session names**

### Must remain serial

These flows must stay serial on the same device:

1. `scan-probe`
2. `scan-complete`
3. `continue-scan`
4. `scan-cleanup`
5. `recycle`
6. `recycle-delete`

Reason:

1. They mutate the same app-local state.
2. They can overwrite `scan_batch`, `scan_baseline`, and `candidate_view`.
3. They also share repo-local `agent-device` state, session naming, and the Metro port.

The lane runner now auto-generates a unique `--session` from `platform + lane + serial`, for example:

```text
device-validation-android-emulator-core-emulator-5554
```

If you override `--session` manually, you must keep lane session names unique yourself.

## Recommended workflow matrix

Current minimum viable matrix:

1. `static`
   - `npm ci`
   - `npm run typecheck -- --pretty false`
   - `npm run test:observability`
2. `android-emulator-core`
   - `npm run verify:device:lane:android:emulator-core -- --serial emulator-5554`
3. `android-emulator-seeded`
   - `npm run verify:device:lane:android:emulator-seeded -- --serial emulator-5554`
4. `android-real-device-core`
   - `workflow_dispatch` on a self-hosted runner, or direct local execution
   - `npm run verify:device:lane:android:real-device-core -- --serial <real-device-serial>`

At the current repo state, the matrix already has strong local evidence for:

1. the `android-emulator-core` lane running fully green locally
2. the `android-emulator-seeded` lane running fully green locally
3. `android-real-device-core` having real-device flow-level artifacts, while remote workflow-level green evidence is still missing

## Rules for future iOS support

When the iOS adapter is implemented, keep these stable:

1. lane names
2. artifact directory structure
3. the command shape `verify:device:lane -- <platform> <lane>`
4. core outcome names
   - `result-ready`
   - `exhausted`
   - `all-complete`
   - `running`

Changes should be limited to:

1. the platform adapter script
2. permission handling
3. platform-specific seed / reset / foreground handling

## Current boundary

At the current repo state:

1. the lane contract exists
2. the Android lane runner exists
3. GitHub Actions is split into `static / android-emulator-core / android-emulator-seeded`
4. `android real-device-core` now has a `workflow_dispatch + self-hosted` manual lane skeleton while still supporting direct local execution
5. remote GitHub Actions green evidence is still missing and workflow structure alone must not be treated as final closure
6. iOS has no adapter yet and must stay explicitly marked as “not implemented”
