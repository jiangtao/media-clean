# Android Release Contract

[中文版本](./android.md)

This document defines the repository-native Android debug / release APK pipeline for Media Clean, including CI/CD integration, signing verification, public download entry, and artifact transparency. The goal is not only to produce an APK, but to make both debug and release outputs, signing sources, verification results, public download URLs, and metadata reproducible and auditable.

## Release Entry

Formal release entry:

- GitHub Actions: `.github/workflows/android-release.yml`
- Trigger: `workflow_dispatch`
- Canonical public Android download URL: `https://github.com/jiangtao/media-clean/releases/latest/download/media-clean-android-latest.apk`

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

## Pipeline

1. `expo prebuild --platform android --clean`
2. `scripts/android/prepare-keystore.mjs` restores the keystore and `android/keystore.properties` from secrets
3. `plugins/withAndroidReleaseSigning.js` injects release signing into `android/app/build.gradle`
4. `./gradlew assembleRelease`
5. `scripts/android/verify-release-artifact.mjs` runs `apksigner verify --print-certs`
6. `scripts/android/collect-release-metadata.mjs` generates checksum and metadata

## CI Setup

Official release workflow:

- `.github/workflows/android-release.yml`
- Triggered by `workflow_dispatch`
- Publish result:
  1. create or update the GitHub Release
  2. upload versioned asset `media-clean-android-v<version>.apk`
  3. upload stable page asset `media-clean-android-latest.apk`
  4. keep the page download buttons pinned to `releases/latest/download/media-clean-android-latest.apk`
  5. includes `verify:release:page-contract` so the release asset name and the page download entry cannot drift apart

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
2. Signing report: `artifacts/android-release/app-release.signing.txt`
3. SHA256: `artifacts/android-release/app-release.sha256`
4. Metadata: `artifacts/android-release/release-metadata.json`
5. Versioned GitHub Release asset: `artifacts/android-release/media-clean-android-v<version>.apk`
6. Stable page asset on GitHub Release: `artifacts/android-release/media-clean-android-latest.apk`

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
6. Every Android download entry on the page must resolve to `releases/latest/download/media-clean-android-latest.apk`
