#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
APK_PATH="${REPO_ROOT}/android/app/build/outputs/apk/validation/app-validation.apk"
SKIP_INSTALL=0
VALIDATION_ARCHITECTURES="${ANDROID_VALIDATION_ARCHITECTURES:-armeabi-v7a,arm64-v8a}"
VALIDATION_APPLICATION_ID_SUFFIX="${ANDROID_VALIDATION_APPLICATION_ID_SUFFIX:-.debug}"
ENABLE_VALIDATION_MINIFY="${ANDROID_ENABLE_MINIFY_IN_VALIDATION_BUILDS:-0}"
ENABLE_VALIDATION_RESOURCE_SHRINK="${ANDROID_ENABLE_SHRINK_RESOURCES_IN_VALIDATION_BUILDS:-0}"
ENABLE_LEGACY_PACKAGING="${ANDROID_USE_LEGACY_PACKAGING:-0}"

usage() {
  cat <<'EOF'
用法:
  bash scripts/android/build-validation-apk.sh [--skip-install]

说明:
  生成 validation APK：release-like 打包、debug 签名、包名后缀默认 .debug。
  用于在线上正式包旁边验证 ABI、legacy packaging、R8/resource shrink 等打包逻辑，
  不覆盖 com.jt.mistapmediacleaner 正式包。

选项:
  --architectures
     控制 validation APK 打包 ABI。默认 armeabi-v7a,arm64-v8a。

  --application-id-suffix
     控制 validation APK 包名后缀，默认 .debug。

  --enable-minify / --enable-resource-shrink
     显式开启 R8 / resource shrink。

  --enable-legacy-packaging
     显式开启 expo.useLegacyPackaging，验证 native .so 压缩打包收益。

环境变量:
  ANDROID_VALIDATION_ARCHITECTURES
  ANDROID_VALIDATION_APPLICATION_ID_SUFFIX
  ANDROID_ENABLE_MINIFY_IN_VALIDATION_BUILDS
  ANDROID_ENABLE_SHRINK_RESOURCES_IN_VALIDATION_BUILDS
  ANDROID_USE_LEGACY_PACKAGING
EOF
}

require_command() {
  local command_name="$1"
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    echo "缺少命令: ${command_name}" >&2
    exit 1
  fi
}

ensure_android_sdk() {
  local detected_sdk_root="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-}}"

  if [[ -z "${detected_sdk_root}" && -d "${HOME}/Library/Android/sdk" ]]; then
    detected_sdk_root="${HOME}/Library/Android/sdk"
  fi

  if [[ -z "${detected_sdk_root}" && -d "${HOME}/Android/Sdk" ]]; then
    detected_sdk_root="${HOME}/Android/Sdk"
  fi

  if [[ -z "${detected_sdk_root}" ]]; then
    echo "未找到 Android SDK。请设置 ANDROID_SDK_ROOT 或 ANDROID_HOME。" >&2
    exit 1
  fi

  export ANDROID_SDK_ROOT="${detected_sdk_root}"
  export ANDROID_HOME="${detected_sdk_root}"

  cat > "${REPO_ROOT}/android/local.properties" <<EOF
sdk.dir=${detected_sdk_root}
EOF
}

run_validation_pipeline() {
  require_command npm
  require_command npx
  require_command node

  cd "${REPO_ROOT}"

  if [[ "${SKIP_INSTALL}" -ne 1 ]]; then
    npm install
  fi

  npx expo prebuild --platform android --clean
  ensure_android_sdk

  local gradle_validation_architectures="${VALIDATION_ARCHITECTURES}"
  if [[ "${gradle_validation_architectures}" == "universal" ]]; then
    gradle_validation_architectures="armeabi-v7a,arm64-v8a,x86,x86_64"
  fi

  export ANDROID_DEBUG_ARCHITECTURES="${gradle_validation_architectures}"

  local gradle_args=(
    assembleValidation
    "-PreactNativeArchitectures=${gradle_validation_architectures}"
    "-Pandroid.validationApplicationIdSuffix=${VALIDATION_APPLICATION_ID_SUFFIX}"
    "-Pandroid.enableMinifyInValidationBuilds=${ENABLE_VALIDATION_MINIFY}"
    "-Pandroid.enableShrinkResourcesInValidationBuilds=${ENABLE_VALIDATION_RESOURCE_SHRINK}"
    "-Pexpo.useLegacyPackaging=${ENABLE_LEGACY_PACKAGING}"
  )

  echo "Android validation architectures: ${gradle_validation_architectures}"
  echo "Android validation applicationId suffix: ${VALIDATION_APPLICATION_ID_SUFFIX}"
  echo "Android validation minify: ${ENABLE_VALIDATION_MINIFY}"
  echo "Android validation resource shrink: ${ENABLE_VALIDATION_RESOURCE_SHRINK}"
  echo "Android legacy packaging: ${ENABLE_LEGACY_PACKAGING}"

  (
    cd android
    chmod +x ./gradlew
    ./gradlew "${gradle_args[@]}"
  )

  ANDROID_DEBUG_ARTIFACT_BASENAME="app-validation" \
    node scripts/android/verify-debug-artifact.mjs "${APK_PATH}"
  ANDROID_DEBUG_ARTIFACT_BASENAME="app-validation" \
    ANDROID_DEBUG_BUILD_CHANNEL="validation" \
    ANDROID_DEBUG_APPLICATION_ID_SUFFIX="${VALIDATION_APPLICATION_ID_SUFFIX}" \
    node scripts/android/collect-debug-metadata.mjs "${APK_PATH}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-install)
      SKIP_INSTALL=1
      shift
      ;;
    --architectures)
      VALIDATION_ARCHITECTURES="${2:-}"
      shift 2
      ;;
    --application-id-suffix)
      VALIDATION_APPLICATION_ID_SUFFIX="${2:-}"
      shift 2
      ;;
    --enable-minify)
      ENABLE_VALIDATION_MINIFY=1
      shift
      ;;
    --enable-resource-shrink)
      ENABLE_VALIDATION_RESOURCE_SHRINK=1
      shift
      ;;
    --enable-legacy-packaging)
      ENABLE_LEGACY_PACKAGING=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "未知参数: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

run_validation_pipeline

cat <<EOF
Android validation APK 已生成:
  APK: ${APK_PATH}
  验签报告: ${REPO_ROOT}/artifacts/android-debug/app-validation.signing.txt
  Metadata: ${REPO_ROOT}/artifacts/android-debug/app-validation.metadata.json
EOF
