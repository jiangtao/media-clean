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

环境变量也可直接使用:
  ANDROID_KEYSTORE_FILE
  ANDROID_KEYSTORE_BASE64
  ANDROID_KEYSTORE_FILENAME
  ANDROID_KEY_ALIAS
  ANDROID_KEYSTORE_PASSWORD
  ANDROID_KEY_PASSWORD
EOF
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

  (
    cd android
    chmod +x ./gradlew
    ./gradlew assembleRelease
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
