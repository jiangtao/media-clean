# Maestro Acceptance Contract

[中文版本](./maestro.md)

## Goal

Keep an executable Android interactive smoke layer for `v0.0.1`, covering cold start, primary navigation, and key settings toggles as a secondary fallback after the primary `agent-device` device-observability layer.

## Layering

1. Build layer: `npm run build:android:debug` / `npm run build:android:release:smoke`
2. Runtime layer: `adb logcat`, Metro, native crash evidence
3. Business truth layer: SQLite, scan batches, recycle-bin state, user decisions
4. Primary device-observability layer: see [Agent Device Observability Contract](./agent-device.en.md)
5. Secondary interactive smoke layer: Maestro

Maestro answers whether the user-facing flow is still alive. It does not explain the underlying root cause by itself, and it no longer acts as the primary device-observability layer.

## Current smoke coverage

The repository currently provides:

1. [`.maestro/smoke/landing-and-settings.yaml`](../../.maestro/smoke/landing-and-settings.yaml)

It covers:

1. Launching the app and moving past Landing.
2. Entering the main tab flow.
3. Opening Settings.
4. Switching language to `en-US` and asserting English settings copy.
5. Switching theme to `dark` and back to `light`.
6. Switching language back to `zh-CN`.

## How to run

```bash
npm run test:maestro:smoke
```

Script entry:

1. [scripts/android/run-maestro-smoke.sh](../../scripts/android/run-maestro-smoke.sh)
2. CI workflow: [.github/workflows/android-maestro-smoke.yml](../../.github/workflows/android-maestro-smoke.yml)

## Preconditions

1. `adb devices` shows at least one usable Android device.
2. `com.jt.mistapmediacleaner` is installed on that device.
3. For debug/dev-client validation, start Metro first:

```bash
npx expo start --dev-client --clear --port 8081
```

## Known device blocker

1. On Xiaomi / MIUI devices, the first Maestro run can be blocked by the OEM policy when the driver app is installed for the first time.
2. We reproduced this on the connected device `M2102J2SC / Xiaomi / MIUI V125` with:

```text
INSTALL_FAILED_USER_RESTRICTED: Install canceled by user
```

3. This indicates the interactive-acceptance chain is blocked by the device policy; it does not mean the `Media Clean` product itself failed to boot.
4. Additional confirmation: local `maestro 2.3.0` still attempts to install `maestro-server.apk` even when `--no-reinstall-driver` is passed. Its package name is `dev.mobile.maestro.test`, so an already-installed `dev.mobile.maestro` driver does not bypass this step.
5. On the current Xiaomi / MIUI phone, if `dev.mobile.maestro.test` is not already installed, there is no repo-local scripted bypass. The practical fix is still to enable USB/debug installation in Developer Options and rerun `npm run test:maestro:smoke`.
6. If the device policy cannot be relaxed, the repo-supported fallback is the emulator / CI lane rather than repeated retries on this handset.

## CI automation

The repository now includes an emulator-based Maestro smoke workflow:

1. `.github/workflows/android-maestro-smoke.yml`
2. Uses `reactivecircus/android-emulator-runner@v2`
3. Builds the debug APK first, then boots the emulator
4. Starts `expo start --dev-client --clear --port 8081`
5. Uses `adb reverse` so the emulator can reach Metro
6. Runs `.maestro/smoke/landing-and-settings.yaml`

Why this matters:

1. If a local Xiaomi / MIUI device blocks the Maestro driver installation, CI can still provide a secondary interactive-acceptance signal.
2. The smoke flow remains part of PR / branch automation, but the primary device-observability signal should come from `agent-device` artifacts.
3. When the handset also blocks `dev.mobile.maestro` / `dev.mobile.maestro.test` installation, the CI emulator is the only stable Maestro execution path already supported by this repo.

## Recommended next additions

1. First-run permission grant into the scan screen.
2. Switching tabs during scanning and returning with state preserved.
3. Recycle-bin keep / restore / hard-delete flows.
4. Reminder toggle resilience when the scheduled task is missing.
