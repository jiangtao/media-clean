#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
APK_PATH="${REPO_ROOT}/android/app/build/outputs/apk/release/app-release.apk"
SIGNING_REPORT_PATH="${REPO_ROOT}/artifacts/android-release/app-release.signing.txt"
METADATA_PATH="${REPO_ROOT}/artifacts/android-release/release-metadata.json"

TEMP_KEYSTORE=0
SKIP_INSTALL=0
KEYSTORE_FILE="${ANDROID_KEYSTORE_FILE:-}"
KEYSTORE_BASE64="${ANDROID_KEYSTORE_BASE64:-}"
KEYSTORE_FILENAME="${ANDROID_KEYSTORE_FILENAME:-release.keystore}"
KEY_ALIAS="${ANDROID_KEY_ALIAS:-}"
STORE_PASSWORD="${ANDROID_KEYSTORE_PASSWORD:-}"
KEY_PASSWORD="${ANDROID_KEY_PASSWORD:-}"
DNAME="${ANDROID_SIGNING_DNAME:-CN=com.jt.mistapmediacleaner,OU=Mobile,O=JT,L=Shanghai,ST=Shanghai,C=CN}"
TEMP_KEYSTORE_DIR="${ANDROID_TEMP_KEYSTORE_DIR:-${HOME}/android-sign-demo}"
TEMP_KEYSTORE_PASSWORD="${ANDROID_TEMP_KEYSTORE_PASSWORD:-jerret@media.clean}"
RELEASE_ARCHITECTURES="${ANDROID_RELEASE_ARCHITECTURES:-armeabi-v7a,arm64-v8a}"
ENABLE_RELEASE_MINIFY="${ANDROID_ENABLE_MINIFY_IN_RELEASE_BUILDS:-0}"
ENABLE_RELEASE_RESOURCE_SHRINK="${ANDROID_ENABLE_SHRINK_RESOURCES_IN_RELEASE_BUILDS:-0}"
ENABLE_LEGACY_PACKAGING="${ANDROID_USE_LEGACY_PACKAGING:-0}"

usage() {
  cat <<'EOF'
用法:
  bash scripts/android/build-release-apk.sh --temp-keystore [--skip-install]
  bash scripts/android/build-release-apk.sh --keystore /abs/path/release.jks --alias release --store-pass xxx --key-pass yyy [--skip-install]

说明:
  1. --temp-keystore
     自动生成临时 JKS keystore，然后执行 prebuild、assembleRelease、验签和 metadata 生成。

  2. --keystore / --alias / --store-pass / --key-pass
     使用你自己的 keystore 打包。若 keystore 是 PKCS12 且未传 --key-pass，会默认复用 --store-pass。

  3. --skip-install
     跳过 npm install。依赖已经装好时建议加这个，能省时间。

  4. --architectures
     控制 release APK 打包 ABI。默认是 armeabi-v7a,arm64-v8a，
     面向 page 用户侧下载，不包含 x86 / x86_64 模拟器 ABI。
     如需内部 universal 包，可传 --architectures universal。

  5. --enable-minify / --enable-resource-shrink
     显式开启 R8 / resource shrink。默认关闭，避免未覆盖真机前破坏 native bridge。

  6. --enable-legacy-packaging
     显式开启 expo.useLegacyPackaging，验证 native .so 压缩打包收益。
     默认关闭，避免未覆盖安装和启动性能前改变 native lib 装载行为。

环境变量也可直接使用:
  ANDROID_KEYSTORE_FILE
  ANDROID_KEYSTORE_BASE64
  ANDROID_KEYSTORE_FILENAME
  ANDROID_KEY_ALIAS
  ANDROID_KEYSTORE_PASSWORD
  ANDROID_KEY_PASSWORD
  ANDROID_RELEASE_ARCHITECTURES
  ANDROID_ENABLE_MINIFY_IN_RELEASE_BUILDS
  ANDROID_ENABLE_SHRINK_RESOURCES_IN_RELEASE_BUILDS
  ANDROID_USE_LEGACY_PACKAGING
EOF
}

enforce_local_release_policy() {
  if [[ "${CI:-}" != "1" && "${TEMP_KEYSTORE}" -ne 1 ]]; then
    cat >&2 <<'EOF'
本地禁止生成正式 Android release APK。
正式 release 仅允许通过 GitHub Actions .github/workflows/android-release.yml 产出，
以保证签名来源与对外下载入口唯一。

本地如需验证 release 链路，请使用:
  bash scripts/android/build-release-apk.sh --temp-keystore --skip-install
EOF
    exit 1
  fi
}

require_command() {
  local command_name="$1"
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    echo "缺少命令: ${command_name}" >&2
    exit 1
  fi
}

ensure_temp_keystore() {
  require_command keytool

  mkdir -p "${TEMP_KEYSTORE_DIR}"
  KEYSTORE_FILE="${TEMP_KEYSTORE_DIR}/release.jks"
  KEYSTORE_FILENAME="release.jks"
  KEY_ALIAS="release"
  STORE_PASSWORD="${TEMP_KEYSTORE_PASSWORD}"
  KEY_PASSWORD="${TEMP_KEYSTORE_PASSWORD}"

  rm -f "${KEYSTORE_FILE}"

  keytool -genkeypair \
    -v \
    -storetype JKS \
    -keyalg RSA \
    -keysize 2048 \
    -validity 10000 \
    -alias "${KEY_ALIAS}" \
    -keystore "${KEYSTORE_FILE}" \
    -storepass "${STORE_PASSWORD}" \
    -keypass "${KEY_PASSWORD}" \
    -dname "${DNAME}"
}

resolve_keystore_config() {
  if [[ "${TEMP_KEYSTORE}" -eq 1 ]]; then
    ensure_temp_keystore
  fi

  if [[ -z "${KEYSTORE_FILE}" && -z "${KEYSTORE_BASE64}" ]]; then
    echo "缺少 keystore 输入。请传 --temp-keystore、--keystore /abs/path/file，或设置 ANDROID_KEYSTORE_BASE64。" >&2
    exit 1
  fi

  if [[ -n "${KEYSTORE_FILE}" && ! -f "${KEYSTORE_FILE}" ]]; then
    echo "keystore 文件不存在: ${KEYSTORE_FILE}" >&2
    exit 1
  fi

  if [[ -z "${KEY_ALIAS}" ]]; then
    echo "缺少 alias。请传 --alias，或设置 ANDROID_KEY_ALIAS。" >&2
    exit 1
  fi

  if [[ -z "${STORE_PASSWORD}" ]]; then
    echo "缺少 keystore 密码。请传 --store-pass，或设置 ANDROID_KEYSTORE_PASSWORD。" >&2
    exit 1
  fi

  if [[ -z "${KEY_PASSWORD}" ]]; then
    case "${KEYSTORE_FILENAME,,}" in
      *.p12|*.pfx)
        KEY_PASSWORD="${STORE_PASSWORD}"
        ;;
      *)
        echo "缺少 key 密码。请传 --key-pass，或设置 ANDROID_KEY_PASSWORD。" >&2
        exit 1
        ;;
    esac
  fi

  if [[ -n "${KEYSTORE_FILE}" ]]; then
    export ANDROID_KEYSTORE_BASE64
    ANDROID_KEYSTORE_BASE64="$(base64 < "${KEYSTORE_FILE}" | tr -d '\n')"
  else
    export ANDROID_KEYSTORE_BASE64="${KEYSTORE_BASE64}"
  fi
  export ANDROID_KEYSTORE_FILENAME="${KEYSTORE_FILENAME}"
  export ANDROID_KEYSTORE_PASSWORD="${STORE_PASSWORD}"
  export ANDROID_KEY_ALIAS="${KEY_ALIAS}"
  export ANDROID_KEY_PASSWORD="${KEY_PASSWORD}"
}

run_release_pipeline() {
  require_command npm
  require_command npx
  require_command node

  cd "${REPO_ROOT}"

  if [[ "${SKIP_INSTALL}" -ne 1 ]]; then
    npm install
  fi

  npx expo prebuild --platform android --clean
  ensure_android_sdk
  node scripts/android/prepare-keystore.mjs

  local gradle_release_architectures="${RELEASE_ARCHITECTURES}"
  if [[ "${gradle_release_architectures}" == "universal" ]]; then
    gradle_release_architectures="armeabi-v7a,arm64-v8a,x86,x86_64"
  fi

  export ANDROID_RELEASE_ARCHITECTURES="${gradle_release_architectures}"

  local gradle_args=(
    assembleRelease
    "-PreactNativeArchitectures=${gradle_release_architectures}"
    "-Pandroid.enableMinifyInReleaseBuilds=${ENABLE_RELEASE_MINIFY}"
    "-Pandroid.enableShrinkResourcesInReleaseBuilds=${ENABLE_RELEASE_RESOURCE_SHRINK}"
    "-Pexpo.useLegacyPackaging=${ENABLE_LEGACY_PACKAGING}"
  )

  echo "Android release architectures: ${gradle_release_architectures}"
  echo "Android release minify: ${ENABLE_RELEASE_MINIFY}"
  echo "Android release resource shrink: ${ENABLE_RELEASE_RESOURCE_SHRINK}"
  echo "Android legacy packaging: ${ENABLE_LEGACY_PACKAGING}"

  (
    cd android
    chmod +x ./gradlew
    ./gradlew "${gradle_args[@]}"
  )

  node scripts/android/verify-release-artifact.mjs "${APK_PATH}"
  node scripts/android/collect-release-metadata.mjs "${APK_PATH}"
}

cleanup() {
  :
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

trap cleanup EXIT

while [[ $# -gt 0 ]]; do
  case "$1" in
    --temp-keystore)
      TEMP_KEYSTORE=1
      shift
      ;;
    --keystore)
      KEYSTORE_FILE="${2:-}"
      KEYSTORE_FILENAME="$(basename "${KEYSTORE_FILE}")"
      shift 2
      ;;
    --alias)
      KEY_ALIAS="${2:-}"
      shift 2
      ;;
    --store-pass)
      STORE_PASSWORD="${2:-}"
      shift 2
      ;;
    --key-pass)
      KEY_PASSWORD="${2:-}"
      shift 2
      ;;
    --dname)
      DNAME="${2:-}"
      shift 2
      ;;
    --skip-install)
      SKIP_INSTALL=1
      shift
      ;;
    --architectures)
      RELEASE_ARCHITECTURES="${2:-}"
      shift 2
      ;;
    --enable-minify)
      ENABLE_RELEASE_MINIFY=1
      shift
      ;;
    --enable-resource-shrink)
      ENABLE_RELEASE_RESOURCE_SHRINK=1
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

enforce_local_release_policy
resolve_keystore_config
run_release_pipeline

cat <<EOF
Android release APK 已生成:
  APK: ${APK_PATH}
  验签报告: ${SIGNING_REPORT_PATH}
  Metadata: ${METADATA_PATH}

快速检查:
  sed -n '1,40p' "${SIGNING_REPORT_PATH}"
EOF
