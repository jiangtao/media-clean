# Android APK Size Governance

[中文版本](./android-apk-size.md)

This document defines APK size analysis, ABI policy, budgets, and release gates for Media Clean Android. The goal is to keep the user-facing download small while preserving internal universal APK support when needed.

Stage governance summary: [Android APK Size Governance Report](./android-apk-size-governance-report.en.md).

## Current Conclusion

The near-100MB APK was not mainly caused by business JavaScript. The historical release APK shipped four native ABIs:

```text
armeabi-v7a
arm64-v8a
x86
x86_64
```

For phone users, `x86` / `x86_64` primarily serve emulators and should not be included in the default page download APK. The user-facing release default is:

```text
armeabi-v7a,arm64-v8a
```

If the device matrix later confirms that 32-bit ARM support is no longer needed, the user-facing artifact can be narrowed further to:

```text
arm64-v8a
```

Current `0.0.4` local smoke measurements:

| Candidate | APK MiB | Notes |
| --- | ---: | --- |
| Default user-facing ARM APK | 51.829 | `armeabi-v7a,arm64-v8a`, current accepted release candidate |
| arm64 single ABI | 37.875 | Static estimate; rebuild after confirming 32-bit ARM can be dropped |
| ARM APK + R8/resource shrink | 45.283 | Requires full real-device regression |
| ARM APK + legacy packaging | 30.229 | Highest-impact single switch; requires install and launch acceptance |
| ARM APK + legacy packaging + shrink | 23.690 | Smallest current page single-APK candidate |
| AAB connected-device splits | 22.549 | Connected-device split set, not a page single-APK replacement |

## Build Policy

The official release workflow defaults to:

```text
ANDROID_RELEASE_ARCHITECTURES=armeabi-v7a,arm64-v8a
```

The local temporary release smoke path uses the same default:

```bash
bash scripts/android/build-release-apk.sh --temp-keystore --skip-install
```

Common candidate smoke commands:

```bash
npm run build:android:release:smoke:arm64
npm run build:android:release:smoke:shrink
npm run build:android:release:smoke:arm64-shrink
npm run build:android:release:smoke:legacy
npm run build:android:release:smoke:legacy-shrink
```

For an internal universal APK, pass the architecture explicitly:

```bash
bash scripts/android/build-release-apk.sh \
  --temp-keystore \
  --skip-install \
  --architectures universal
```

Do not use a universal APK as the default `media-clean-android-latest.apk` user-facing artifact.

The official workflow supports four manual inputs for reproducing candidate builds:

1. `release_architectures`: defaults to `armeabi-v7a,arm64-v8a`; may be set to `arm64-v8a`.
2. `enable_minify`: defaults to `false`.
3. `enable_resource_shrink`: defaults to `false`.
4. `enable_legacy_packaging`: defaults to `false`.

## Analysis Commands

Analyze any APK:

```bash
npm run analyze:android:apk -- path/to/app.apk --profile internal-universal
```

Verify that the release APK matches the user-facing size and ABI budget:

```bash
npm run verify:android:apk-size
```

The analyzer writes:

1. `artifacts/android-release/apk-size-report.md`
2. `artifacts/android-release/apk-size-report.json`

The analyzer does not require Android Studio build-tools. If `apkanalyzer` is unavailable, it falls back to parsing the APK ZIP Central Directory.

Scan Android-related direct dependencies for unexplained runtime import gaps:

```bash
npm run analyze:android:deps
```

Compare APK size reports across stages:

```bash
npm run compare:android:apk-size -- \
  baseline=artifacts/apk-size-analysis/report/apk-size-report.json \
  stage-1=artifacts/apk-size-stages/stage-1-arm-only/apk-size-report.json
```

## Pre-commit Gate

Do not wait for the release workflow to discover APK size regressions. Install the repository hook locally:

```bash
npm run hooks:install
```

After installation, `.githooks/pre-commit` runs:

```bash
npm run verify:precommit
```

The gate has two layers:

1. Every commit checks the APK size analyzer syntax and the release/page contract.
2. Every commit scans direct dependency usage so unused dependencies do not re-enter the install surface.
3. If staged files touch dependencies, `app.json`, Android native files, release workflow, release scripts, or signing plugins, a local release smoke APK must be built and analyzed first.

Build and analyze locally:

```bash
npm run build:android:release:smoke
npm run verify:precommit:android-size
```

If the machine cannot build an Android release smoke APK, do not silently skip the gate. Record the reason in the commit or PR and treat the CI `apk-size-report.md` as a required pre-merge review artifact. Only doc-only or emergency commits may use:

```bash
SKIP_ANDROID_APK_SIZE_PRECOMMIT=1
```

## Budgets

| Artifact | Target | Gate |
| --- | ---: | --- |
| User-facing arm64 APK | <= 50MB | warning > 50MiB, fail > 60MiB |
| User-facing ARM APK | <= 60MB | warning > 60MiB, fail > 70MiB |
| Internal universal APK | <= 110MB | warning > 100MiB, fail > 120MiB |
| JS bundle | <= 5MB | warning > 5MiB, fail > 8MiB |
| Fonts | <= 3MB compressed | warning > 3MiB |

The release workflow runs with `--fail-on-budget`, so a user-facing APK that contains `x86` / `x86_64` or exceeds the budget fails the workflow.

The current `0.0.4` Stage 1 local release smoke APK measures 51.829 MiB with `armeabi-v7a,arm64-v8a`, below the user-facing ARM APK warning budget. The current `arm64-v8a` single-ABI static estimate is 37.875 MiB, below the user-facing arm64 warning budget, but 32-bit ARM support must be confirmed first.

## R8 And Resource Shrinking

R8 and resource shrinking are not enabled by default yet because this project depends on Expo modules, SQLite, media library, notifications, a foreground service, image / video preview, and custom Android native scan modules.

To validate them explicitly:

```bash
bash scripts/android/build-release-apk.sh \
  --temp-keystore \
  --skip-install \
  --enable-minify \
  --enable-resource-shrink
```

The current `0.0.4` dual-ABI smoke measurement is 45.283 MiB. Compared with Stage 1, it saves 6.546 MiB, mainly by reducing dex from 10.905 MiB to 4.616 MiB. Combined with legacy packaging, the measured APK is 23.690 MiB.

Before enabling them by default, verification must cover:

1. media library permissions.
2. notifications.
3. background scan foreground service.
4. SQLite operational store.
5. expo-image / expo-video preview.
6. Android native scan modules.
7. signing, installation, and real-device launch for the page download APK.

## Legacy Native Packaging

`expo.useLegacyPackaging=true` stores native `.so` files compressed inside the APK. It has the highest impact for the page-hosted direct APK, but it can change native library extraction and startup behavior, so it remains gated by real-device acceptance before becoming the default.

Local validation commands:

```bash
npm run build:android:release:smoke:legacy
npm run build:android:release:smoke:legacy-shrink
```

Current `0.0.4` measurements:

| Candidate | APK MiB | Native lib MiB | Notes |
| --- | ---: | ---: | --- |
| legacy packaging | 30.229 | 12.851 | 21.600 MiB smaller than Stage 1 |
| legacy packaging + shrink | 23.690 | 12.851 | Smallest current page single-APK candidate |

Installing the 23.690 MiB candidate on the local MIUI device currently returns `INSTALL_FAILED_USER_RESTRICTED`. The next step is to build a formally signed candidate through the release workflow, then make it the default only after device-side install and core-flow acceptance.

## AAB / Split Delivery

AAB is a distribution input, not a direct replacement for the current page-hosted APK. Current `0.0.4` measurements:

| Artifact | MiB | Notes |
| --- | ---: | --- |
| `app-release.aab` | 35.677 | Includes debug symbols / Proguard map upload metadata |
| Connected-device `.apks` split set | 22.549 | Delivers only the ABI / density / language splits needed by the connected device |
| AAB universal generated APK | 23.824 | Close to the direct legacy + shrink APK |

AAB / split delivery should become the default only if the product moves to Play Store distribution or implements a bundletool / split-installer flow.

## Release Artifacts

Every Android release must keep:

1. `app-release.apk`
2. `app-release.signing.txt`
3. `app-release.sha256`
4. `release-metadata.json`
5. `apk-size-report.md`
6. `apk-size-report.json`
7. `media-clean-android-v<version>.size-report.md`
8. `media-clean-android-v<version>.size-report.json`

The size report must be uploaded as a GitHub Actions artifact and included in the workflow summary.

## Dependency Intake

Any new or upgraded dependency in the following categories must include a size impact note:

1. Expo native modules.
2. React Native native modules.
3. image / video codecs.
4. ML / OCR / vision models.
5. SQLite / database engines.
6. icon fonts / full font families.

The note must include new native `.so` files, affected ABIs, APK delta, user value, alternatives, and rollback strategy.

Current dependency findings: [Android Dependency Footprint Review](../research/android-apk-size-analysis/dependency-footprint.md).
