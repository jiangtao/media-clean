# Android 发包契约

[English Version](./android.en.md)

本文档定义 Media Clean Android debug / release APK 的仓库内发包、CI/CD 流水线、签名验签与产物约定。目标不是“能打一个包”，而是让 debug 与 release 的 APK 产出、签名来源、验签结果和元数据都可复现、可审计。

## 发布入口

仓库内统一入口：

```bash
bash scripts/android/build-release-apk.sh --skip-install
```

Debug APK：

```bash
bash scripts/android/build-debug-apk.sh --skip-install
```

本地临时验链路：

```bash
bash scripts/android/build-release-apk.sh --temp-keystore --skip-install
```

## 发布流程

1. `expo prebuild --platform android --clean`
2. `scripts/android/prepare-keystore.mjs` 把 secrets 还原成 `android/keystore.properties` 与 keystore 文件
3. `android/app/build.gradle` 通过 `plugins/withAndroidReleaseSigning.js` 注入 release signing
4. `./gradlew assembleRelease`
5. `scripts/android/verify-release-artifact.mjs` 使用 `apksigner verify --print-certs` 自动验签
6. `scripts/android/collect-release-metadata.mjs` 生成 checksum 与 metadata

## CI 配置

正式 release workflow:

- `.github/workflows/android-release.yml`
- 触发方式：`workflow_dispatch`、`main/master` push 或 `android-v*` tag

正式 debug workflow:

- `.github/workflows/android-debug.yml`
- 触发方式：`workflow_dispatch` 或 `main/master` push

PR / 主干 smoke workflow:

- `.github/workflows/android-pr-check.yml`
- 使用临时 JKS 自动出 release APK，再同时生成 debug APK，保证两条 pipeline 持续可运行

## Secrets 与变量

GitHub Secrets:

1. `ANDROID_KEYSTORE_BASE64`
2. `ANDROID_KEY_ALIAS`
3. `ANDROID_KEYSTORE_PASSWORD`
4. `ANDROID_KEY_PASSWORD`

GitHub Variables:

1. `ANDROID_KEYSTORE_FILENAME`
2. `release.jks` 或 `release.p12`

若使用 `PKCS12`，通常 `ANDROID_KEYSTORE_PASSWORD` 与 `ANDROID_KEY_PASSWORD` 应相同。

## 产物约定

Release:

1. APK：`android/app/build/outputs/apk/release/app-release.apk`
2. 验签报告：`artifacts/android-release/app-release.signing.txt`
3. SHA256：`artifacts/android-release/app-release.sha256`
4. 元数据：`artifacts/android-release/release-metadata.json`

Debug:

1. APK：`android/app/build/outputs/apk/debug/app-debug.apk`
2. 验签报告：`artifacts/android-debug/app-debug.signing.txt`
3. SHA256：`artifacts/android-debug/app-debug.sha256`
4. 元数据：`artifacts/android-debug/debug-metadata.json`

## 验收规则

1. release APK 不允许仍使用 `Android Debug` 证书
2. 若 `apksigner` 输出中未包含 `Signer #1 certificate`，直接失败
3. metadata 必须包含版本、`versionCode`、包名与 checksum
4. debug workflow 必须稳定产出 `app-debug.apk` 与对应签名报告
5. PR check 必须能在无正式证书前提下，同时跑通 release 与 debug 两条链路
