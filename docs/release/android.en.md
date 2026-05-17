# Android Release Contract

[中文版本](./android.md)

This document defines the repository-native Android debug / release APK pipeline for Media Clean, including CI/CD integration, signing verification, public download entry, and artifact transparency. The goal is not only to produce an APK, but to make both debug and release outputs, signing sources, verification results, public download URLs, metadata, and size reports reproducible and auditable.

For size governance, see [Android APK Size Governance](./android-apk-size.en.md).
Stage governance summary: [Android APK Size Governance Report](./android-apk-size-governance-report.en.md).
Pre-commit gate: when dependencies, Android native files, release workflow, or signing plugins change, run `npm run verify:precommit`; if needed, build a local release smoke APK and run `npm run verify:precommit:android-size` before committing.

## Release Entry

Formal release entry:

- GitHub Actions: `.github/workflows/android-release.yml`
- Trigger: `workflow_dispatch`
- Canonical public Android download URL: `https://mc.jerret.me/download/android-latest.apk`
- GitHub Release backup asset: `https://github.com/jiangtao/media-clean/releases/latest/download/media-clean-android-latest.apk`

Debug APK:

```bash
bash scripts/android/build-debug-apk.sh --skip-install
```

Temporary local smoke path:

```bash
bash scripts/android/build-release-apk.sh --temp-keystore --skip-install
```

Notes:

1. Generating a formally signed release APK is blocked on local machines.
2. Local release validation is limited to the temp-keystore smoke path.
3. Formal signing, formal release assets, and the page download entry are maintained only by the workflow so the APK provenance stays unique.
4. `mc.jerret.me/download/android-latest.apk` is the user-facing download entry; the GitHub Release latest asset is retained only for audit, rollback, and page-only deployment hydration.

## Pipeline

1. `expo prebuild --platform android --clean`
2. `scripts/android/prepare-keystore.mjs` restores the keystore and `android/keystore.properties` from secrets
3. `plugins/withAndroidReleaseSigning.js` injects release signing into `android/app/build.gradle`
4. `./gradlew assembleRelease`
5. `scripts/android/verify-release-artifact.mjs` runs `apksigner verify --print-certs`
6. `scripts/android/collect-release-metadata.mjs` generates checksum and metadata
7. `scripts/android/analyze-apk-size.mjs` generates the APK size report and enforces the user-facing ABI / size budget gate

## CI Setup

Official release workflow:

- `.github/workflows/android-release.yml`
- Triggered by `workflow_dispatch`
- Publish result:
  1. create or update the GitHub Release
  2. upload versioned asset `media-clean-android-v<version>.apk`
  3. upload GitHub backup latest asset `media-clean-android-latest.apk`
  4. upload `apk-size-report.md` / `apk-size-report.json` and versioned size reports
  5. copy the APK to `page/public/download/android-latest.apk`
  6. deploy Vercel production so page download buttons stay pinned to `https://mc.jerret.me/download/android-latest.apk`
  7. includes `verify:release:page-contract` so the release asset name, page hydration source, page download entry, and size governance contract cannot drift apart
  8. user-facing APKs include `armeabi-v7a,arm64-v8a` by default and exclude `x86` / `x86_64`
  9. after the APK size optimization project, formal releases enable R8 minify, Android resource shrinking, and legacy native `.so` packaging by default; workflow_dispatch still keeps manual off switches for rollback and native bridge, startup, or resource-shrink regression diagnosis.

Official debug workflow:

- `.github/workflows/android-debug.yml`
- Triggered by `workflow_dispatch` or `main/master` pushes

PR / branch smoke workflow:

- `.github/workflows/android-pr-check.yml`
- Generates a temp-signed release APK and a debug APK to verify both pipelines without production credentials

## Secrets And Variables

GitHub Secrets:

1. `ANDROID_KEYSTORE_BASE64`
2. `ANDROID_KEY_ALIAS`
3. `ANDROID_KEYSTORE_PASSWORD`
4. `ANDROID_KEY_PASSWORD`

GitHub Variables:

1. `ANDROID_KEYSTORE_FILENAME`
2. `release.jks` or `release.p12`

For `PKCS12`, `ANDROID_KEYSTORE_PASSWORD` and `ANDROID_KEY_PASSWORD` are usually the same.

## Artifact Contract

Release:

1. APK: `android/app/build/outputs/apk/release/app-release.apk`
2. CI-internal signing report: `artifacts/android-release/app-release.signing.txt`
3. SHA256: `artifacts/android-release/app-release.sha256`
4. Metadata: `artifacts/android-release/release-metadata.json`
5. Versioned GitHub Release asset: `artifacts/android-release/media-clean-android-v<version>.apk`
6. GitHub Release latest backup asset: `artifacts/android-release/media-clean-android-latest.apk`
7. Vercel page download copy: `page/public/download/android-latest.apk`, deployed as `https://mc.jerret.me/download/android-latest.apk`
8. Size report: `artifacts/android-release/apk-size-report.md`
9. Size report JSON: `artifacts/android-release/apk-size-report.json`
10. Versioned GitHub Release size report: `artifacts/android-release/media-clean-android-v<version>.size-report.md`
11. Versioned GitHub Release size report JSON: `artifacts/android-release/media-clean-android-v<version>.size-report.json`

The signing report is retained only as a CI artifact for signing-chain diagnostics; it is not uploaded as a public GitHub Release asset.

Debug:

1. APK: `android/app/build/outputs/apk/debug/app-debug.apk`
2. Signing report: `artifacts/android-debug/app-debug.signing.txt`
3. SHA256: `artifacts/android-debug/app-debug.sha256`
4. Metadata: `artifacts/android-debug/debug-metadata.json`

## Acceptance Rules

1. A release APK must not remain signed with the `Android Debug` certificate
2. The pipeline fails if `apksigner` does not report `Signer #1 certificate`
3. Metadata must include version, `versionCode`, package name, and checksum
4. The debug workflow must stably produce `app-debug.apk` and its signing report
5. The PR check must validate both release and debug pipelines even without production credentials
6. Every Android download entry on the page must resolve to `https://mc.jerret.me/download/android-latest.apk`
7. Page-only deploys must hydrate `page/public/download/android-latest.apk` from the GitHub latest backup asset before deployment so a new page deployment cannot drop the APK
8. A user-facing release APK must not contain `x86` / `x86_64` unless the workflow explicitly switches to an internal universal artifact
9. The release workflow must generate and upload an APK size report
10. A user-facing ARM APK fails above 70MiB and warns above 60MiB
11. Formal releases must keep the validated size-optimization bundle enabled by default: R8 minify, resource shrinking, and legacy native packaging. If it is temporarily disabled, the PR / release summary must explain why and how it will be restored.
