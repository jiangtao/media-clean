# Maestro Validation

[中文 README](./README.md)

This directory contains Android device/emulator smoke flows for interactive acceptance checks:

1. Cold start can move past the splash screen into the product flow.
2. Core navigation and the settings screen still work on a real device.
3. High-frequency preference changes such as language and theme do not regress.

Current flow:

1. `smoke/landing-and-settings.yaml`

Run it with:

```bash
npm run test:maestro:smoke
```

Default assumptions:

1. A device is visible through `adb devices`.
2. `com.jt.mistapmediacleaner` is already installed.
3. If you are using a debug/dev-client build, start Metro first:

```bash
npx expo start --dev-client --clear --port 8081
```

Known device constraint:

1. Xiaomi / MIUI devices may block the first-time installation of the Maestro driver app.
2. If you see `INSTALL_FAILED_USER_RESTRICTED`, treat it as a device-policy blocker rather than a product crash.
3. Enable USB/debug installation in Developer Options first, then rerun the smoke flow.

In this project, Maestro is the interactive acceptance layer rather than the single source of truth:

1. Use Maestro to catch UI, navigation, and permission-flow regressions.
2. Use `logcat`, Metro, and crash evidence to diagnose JS/native runtime issues.
3. Use SQLite and persisted storage truth to verify scan progress, batch boundaries, and recycle-bin state.
