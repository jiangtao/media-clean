# Android APK Size Governance Report

[中文版本](./android-apk-size-governance-report.md)

This document tracks Media Clean Android APK size governance by priority, including stage outputs, size comparisons, and acceptance standards. After every Android release, update this document with the latest `apk-size-report.json`.

## Baseline

Confirmed public APK sample:

| Field | Value |
| --- | --- |
| APK | `artifacts/apk-size-analysis/android-latest.apk` |
| Source | `https://mc.jerret.me/download/android-latest.apk` |
| SHA256 | `900b881a4db57ac56cfaf0577086bf20e5a13562ddda9460514dedcf42ef96e4` |
| Size | 97.764 MiB |
| ABI | `arm64-v8a`, `armeabi-v7a`, `x86`, `x86_64` |
| Native libs | 77.373 MiB |
| x86 / x86_64 | 43.226 MiB |
| JS bundle | 3.164 MiB |
| Fonts | 1.945 MiB |

Conclusion: the current issue is mainly that the user-facing APK is still universal, not that business JavaScript, i18n, or theme tokens are oversized.

## Stage 1 Measured Result

A local release smoke APK has been rebuilt with `ANDROID_RELEASE_ARCHITECTURES=armeabi-v7a,arm64-v8a` and passed the size gate:

| Field | Value |
| --- | --- |
| APK | `android/app/build/outputs/apk/release/app-release.apk` |
| SHA256 | `5d1789df71edb0cb5ef50e4c9dae91f93487ded707c12d4935f5ada71ed0025c` |
| Size | 47.291 MiB / 49,588,284 bytes |
| ABI | `arm64-v8a`, `armeabi-v7a` |
| Native libs | 28.271 MiB |
| Dex | 10.817 MiB |
| JS bundle | 2.207 MiB |
| Fonts | 1.945 MiB |
| Stage 1 gate | pass, with no warnings or failures |

Compared with baseline:

| Stage | APK MiB | Delta vs baseline | Delta % | ABI | Native lib MiB | Dex MiB | JS bundle MiB | Fonts MiB |
| --- | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: |
| baseline | 97.764 | 0.000 | 0.0% | `arm64-v8a`, `armeabi-v7a`, `x86`, `x86_64` | 77.373 | 10.907 | 3.164 | 1.945 |
| stage-1-arm-only | 47.291 | -50.473 | -51.6% | `arm64-v8a`, `armeabi-v7a` | 28.271 | 10.817 | 2.207 | 1.945 |

Conclusion: Stage 1 reduced the user-facing APK from 97.764 MiB to 47.291 MiB. This is better than the earlier static ABI-only estimate of 54.538 MiB because the fresh build also includes the current dependency cleanup, bundle differences, and release packaging.

## Post-Main-Merge Check (Current 0.0.3)

After merging `main`, the current branch is aligned with the formal release baseline: `package.json` / `app.json` are `0.0.3`, and Android `versionCode=3`. A fresh local `armeabi-v7a,arm64-v8a` release smoke build now reports:

| Field | Value |
| --- | --- |
| APK | `android/app/build/outputs/apk/release/app-release.apk` |
| SHA256 | `63a20e909fbe75df3dbbac7021e684971ba4d87c2fb74a7d1c897755eedde98a` |
| Size | 54.130 MiB / 56,759,910 bytes |
| ABI | `arm64-v8a`, `armeabi-v7a` |
| Native libs | 34.140 MiB |
| Dex | 10.905 MiB |
| JS bundle | 3.165 MiB |
| Fonts | 1.945 MiB |
| Stage 1 gate | pass, with no warnings or failures |
| Estimated arm64-only | 40.176 MiB |

Compared with baseline:

| Stage | APK MiB | Delta vs baseline | Delta % | ABI | Native lib MiB | Dex MiB | JS bundle MiB | Fonts MiB |
| --- | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: |
| baseline | 97.764 | 0.000 | 0.0% | `arm64-v8a`, `armeabi-v7a`, `x86`, `x86_64` | 77.373 | 10.907 | 3.164 | 1.945 |
| stage-1-arm-only-main-merged | 54.130 | -43.634 | -44.6% | `arm64-v8a`, `armeabi-v7a` | 34.140 | 10.905 | 3.165 | 1.945 |

Conclusion: after merging `main`, the current Stage 1 result increased from the pre-merge 47.291 MiB to 54.130 MiB, mainly because main brings gesture, Reanimated, Worklets, Screens, SVG, and the v0.4 feature surface back into the native build. The APK still excludes `x86` / `x86_64` and remains below the 60 MiB warning / 70 MiB failure budget. Stage 4 / Stage 6 / Stage 7 must be remeasured from the main-merged baseline before they are treated as release commitments.

## 0.0.4 Release Candidate Check

This version has been bumped to `0.0.4` / `versionCode=4`, and the unused direct dependency `@expo/vector-icons` has been removed. After moving UI icons to local `react-native-svg` implementations, the final release smoke result is:

| Field | Value |
| --- | --- |
| APK | `android/app/build/outputs/apk/release/app-release.apk` |
| SHA256 | `1bec40b1b48e650c004dfa8429e958cc979c03f7edd99fce327eb49ebc99f0fd` |
| Size | 51.829 MiB / 54,346,826 bytes |
| ABI | `arm64-v8a`, `armeabi-v7a` |
| Native libs | 34.140 MiB |
| Dex | 10.905 MiB |
| JS bundle | 2.817 MiB |
| Fonts | 0.000 MiB |
| Stage 1 gate | pass, with no warnings or failures |
| Estimated arm64-only | 37.875 MiB |

Compared with main-merged 0.0.3:

| Stage | APK MiB | Delta vs baseline | Delta % | ABI | Native lib MiB | Dex MiB | JS bundle MiB | Fonts MiB |
| --- | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: |
| baseline | 97.764 | 0.000 | 0.0% | `arm64-v8a`, `armeabi-v7a`, `x86`, `x86_64` | 77.373 | 10.907 | 3.164 | 1.945 |
| main-merged-0.0.3 | 54.130 | -43.634 | -44.6% | `arm64-v8a`, `armeabi-v7a` | 34.140 | 10.905 | 3.165 | 1.945 |
| release-candidate-0.0.4 | 51.829 | -45.935 | -47.0% | `arm64-v8a`, `armeabi-v7a` | 34.140 | 10.905 | 2.817 | 0.000 |

Conclusion: 0.0.4 saves another 2.301 MiB compared with main-merged 0.0.3 without changing user-facing behavior. The gain mainly comes from removing the icon font dependency and reducing the JS bundle entry surface; native libraries remain the dominant size component.

## Stage 1 Real-device Install Check

Connected device:

```text
model: M2102J2SC
device: thyme
transport: usb
```

Install check status:

| Operation | Result |
| --- | --- |
| `adb install -r android/app/build/outputs/apk/release/app-release.apk` | Failed: `INSTALL_FAILED_VERSION_DOWNGRADE` |
| `adb install -r -d android/app/build/outputs/apk/release/app-release.apk` | Failed: `INSTALL_FAILED_UPDATE_INCOMPATIBLE` |

Reason: at that time the device already had `com.jt.mistapmediacleaner` version `0.0.3` / `versionCode=3`, while the pre-main-merge local release smoke APK used `0.0.1` / `versionCode=1` and a temporary keystore. It was both a downgrade and signed with a different certificate than the installed formal build.

The current local release smoke APK is now `0.0.4` / `versionCode=4`, but it is still signed with a temporary keystore. Local installation first hit `INSTALL_FAILED_UPDATE_INCOMPATIBLE` because a differently signed package was already installed. After uninstalling user 0 / 10, MIUI still rejected USB installation with `INSTALL_FAILED_USER_RESTRICTED`. Real-device install acceptance needs USB installation enabled on the device, or a formally signed APK from the release workflow that uses the same signing chain.

Final acceptance: on 2026-05-14, after the device-side install restriction was handled, the user confirmed that local phone installation and core functionality are normal. The 0.0.4 release candidate passes manual usability acceptance.

## 0.0.4 Follow-up Candidate Measurements

Starting from the `0.0.4` release candidate at 51.829 MiB, we remeasured R8 / resource shrinking, native `.so` legacy packaging, and AAB / split delivery:

| Candidate | Artifact | MiB | Delta vs 0.0.4 | Delta vs baseline | ABI / delivery | Native lib MiB | Dex MiB | JS bundle MiB | Status |
| --- | --- | ---: | ---: | ---: | --- | ---: | ---: | ---: | --- |
| 0.0.4 Stage 1 | APK | 51.829 | 0.000 | -45.935 | `arm64-v8a`, `armeabi-v7a` | 34.140 | 10.905 | 2.817 | Manual usability accepted |
| R8 / resource shrink | APK | 45.283 | -6.546 | -52.481 | `arm64-v8a`, `armeabi-v7a` | 34.140 | 4.616 | 2.811 | Built and passed the size gate; needs formally signed real-device regression |
| legacy packaging | APK | 30.229 | -21.600 | -67.535 | `arm64-v8a`, `armeabi-v7a` | 12.851 | 10.905 | 2.811 | Built and passed the size gate; needs install / launch acceptance |
| legacy packaging + shrink | APK | 23.690 | -28.139 | -74.074 | `arm64-v8a`, `armeabi-v7a` | 12.851 | 4.616 | 2.811 | Smallest current single-APK candidate; needs full regression |
| AAB upload artifact | AAB | 35.677 | -16.152 | -62.087 | bundle input, not a user install artifact | 12.851 | 4.616 | 2.813 | Builds successfully; includes debug symbols / Proguard map metadata |
| AAB connected-device splits | `.apks` | 22.549 | -29.280 | -75.215 | Current device `arm64_v8a` + `xxhdpi` + `zh` splits | target ABI only | split scoped | split scoped | Smallest download path, but requires Play / bundletool / a split installer |
| AAB universal generated APK | APK | 23.824 | -28.005 | -73.940 | `arm64-v8a`, `armeabi-v7a` | 12.851 | 4.616 | 2.811 | Close to direct legacy + shrink |

AAB connected-device split details:

| Split | bytes |
| --- | ---: |
| `base-master.apk` | 16,012,942 |
| `base-arm64_v8a.apk` | 7,215,159 |
| `base-xxhdpi.apk` | 373,742 |
| `base-zh.apk` | 41,306 |

Findings:

1. `expo.useLegacyPackaging=true` is the highest-impact single switch right now: without changing product code, native lib compressed size drops from 34.140 MiB to 12.851 MiB, and the dual-ABI APK drops from 51.829 MiB to 30.229 MiB.
2. R8 / resource shrinking is useful but less impactful than legacy packaging: the dual-ABI APK drops from 51.829 MiB to 45.283 MiB, mainly because dex drops from 10.905 MiB to 4.616 MiB.
3. legacy packaging + R8 / resource shrinking reaches 23.690 MiB, the smallest measured single-APK / page-download candidate.
4. AAB / split delivery can reach 22.549 MiB for the connected device, but it is not a direct replacement for the current page-hosted APK. It requires Play Store distribution or a custom bundletool / split-installer flow.
5. Installing the 23.690 MiB candidate on the local MIUI device currently fails with `INSTALL_FAILED_USER_RESTRICTED: Install canceled by user`. Therefore legacy packaging and shrinking must not become defaults until a formally signed candidate passes install, launch, and core-flow acceptance.

## Stage Priorities

| Stage | Priority | Action | Status | Size Result | Acceptance |
| --- | --- | --- | --- | --- | --- |
| Stage 0 | P0 | Establish baseline and repeatable analyzer | Done | 97.764 MiB actual | Analyzer writes JSON / Markdown and detects ABI, native libs, JS bundle, and fonts |
| Stage 1 | P0 | Narrow user-facing release to `armeabi-v7a,arm64-v8a` | 0.0.4 local release smoke measured, pending official CI release confirmation | Current 51.829 MiB actual, -45.935 MiB / -47.0% vs baseline; main-merged 0.0.3 was 54.130 MiB | New `media-clean-android-latest.apk` excludes `x86` / `x86_64`; `verify:android:apk-size` passes |
| Stage 2 | P0 | Add pre-commit size gate | Done | Guardrail, not direct size reduction | Dependency, Android native, release workflow, and signing plugin changes trigger size gate before commit |
| Stage 3 | P1 | Remove unused direct dependencies | Done and re-scanned | 0.0.4 removes direct `@expo/vector-icons`; APK is 2.301 MiB smaller than main-merged 0.0.3 | `analyze:android:deps` passes and unused dependencies stay out of the install surface |
| Stage 4 | P1 | Evaluate `arm64-v8a` single ABI | Pre-main-merge local release smoke measured; main-merged result is currently a static estimate and needs a rebuild | Pre-merge 35.558 MiB actual; main-merged estimate 40.176 MiB | 32-bit ARM support is no longer required; real-device install and launch pass |
| Stage 5 | P1 | Validate native `.so` packaging / legacy packaging | 0.0.4 measured; CI workflow now has a manual switch; formally signed device acceptance pending | 30.229 MiB alone; 23.690 MiB combined with shrink | Install, startup time, low-end devices, signing, and page download all pass |
| Stage 6 | P2 | Validate R8 / resource shrink | 0.0.4 measured; full real-device regression pending | 45.283 MiB alone; 23.690 MiB combined with legacy packaging | Media permissions, notifications, foreground service, SQLite, image/video preview, and native scan are covered |
| Stage 7 | P2 | `arm64-v8a` + shrink / legacy combined candidate | Rebuild after product confirms the 32-bit ARM support policy | Current static estimates: arm64 + shrink 31.329 MiB; arm64 + legacy + shrink 17.707 MiB | Must satisfy Stage 4, Stage 5, and Stage 6 acceptance |
| Stage 8 | P3 | AAB / split delivery | AAB built; connected-device `.apks` measured | AAB 35.677 MiB; connected-device split set 22.549 MiB; universal generated APK 23.824 MiB | Requires Play Store or a custom split installer; not a direct replacement for the page single APK |
| Stage 9 | P3 | JS lazy loading / i18n / token bundle hygiene | Pending performance evidence | Mainly improves startup path, not primary APK size | JS bundle warning stays under 5 MiB and mobile entry does not import desktop/generated artifacts |

## Delivered Artifacts

1. APK analyzer: `scripts/android/analyze-apk-size.mjs`.
2. APK report comparator: `scripts/android/compare-apk-size-reports.mjs`.
3. Dependency footprint analyzer: `scripts/android/analyze-dependency-footprint.mjs`.
4. Pre-commit gate: `.githooks/pre-commit` and `scripts/android/verify-apk-size-precommit.mjs`.
5. Release workflow ABI default: `ANDROID_RELEASE_ARCHITECTURES=armeabi-v7a,arm64-v8a`.
6. Dependency cleanup: removed `@shopify/flash-list`, `form-data`, `gopd`, and `react-native-polyfill-globals`; kept and allowlisted `expo-system-ui` because `userInterfaceStyle: automatic` requires it; kept and allowlisted `react-native-worklets` as the Reanimated 4 native runtime peer.
7. Local smoke variants: `build:android:release:smoke:arm64`, `build:android:release:smoke:shrink`, `build:android:release:smoke:arm64-shrink`, `build:android:release:smoke:legacy`, and `build:android:release:smoke:legacy-shrink`.
8. Release workflow inputs: `release_architectures`, `enable_minify`, `enable_resource_shrink`, and `enable_legacy_packaging`, used to reproduce candidate builds before making them defaults.

## Comparison Method

After each stage produces a new APK, generate a report:

```bash
npm run analyze:android:apk -- path/to/app.apk \
  --out-dir artifacts/apk-size-stages/stage-<n>-<name> \
  --profile user-arm-only \
  --fail-on-budget
```

Then generate the stage comparison table:

```bash
npm run compare:android:apk-size -- \
  baseline=artifacts/apk-size-analysis/report/apk-size-report.json \
  stage-1-arm-only=artifacts/apk-size-stages/stage-1-arm-only/apk-size-report.json \
  stage-4-arm64-only=artifacts/apk-size-stages/stage-4-arm64-only/apk-size-report.json \
  stage-6-r8-resource-shrink=artifacts/apk-size-stages/stage-6-r8-resource-shrink/apk-size-report.json \
  stage-7-arm64-r8-resource-shrink=artifacts/apk-size-stages/stage-7-arm64-r8-resource-shrink/apk-size-report.json \
  --markdown artifacts/apk-size-stages/comparison.md
```

Track at least:

1. APK MiB.
2. ABI list.
3. Native lib MiB.
4. Dex MiB.
5. JS bundle MiB.
6. Fonts MiB.
7. Absolute and percentage delta against baseline.

## Next Steps

1. Keep the default official release on Stage 1 first: `armeabi-v7a,arm64-v8a`; the current 0.0.4 local result is 51.829 MiB and manual local-phone usability acceptance has passed. After the CI release, re-check the formal signing chain.
2. If product/device support confirms 32-bit ARM can be dropped, move the next release candidate to Stage 4: `arm64-v8a`; the current 0.0.4 estimate is about 37.875 MiB and needs a rebuild to confirm.
3. The highest-impact next path is to use the `Android Release Candidate APK` workflow to build a formally signed, non-published `enable_legacy_packaging=true` candidate. If phone install, launch, and core flows pass, make legacy packaging the default release policy.
4. R8 / resource shrinking should be layered in as the second phase. The 23.690 MiB candidate must pass permissions, notifications, background scan, SQLite, image/video preview, and native-scan regression before release.
5. AAB / split delivery should not replace the current page-hosted single APK unless the product chooses Play Store distribution or a custom split installation flow.
