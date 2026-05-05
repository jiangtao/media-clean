#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
APK_PATH="${REPO_ROOT}/android/app/build/outputs/apk/debug/app-debug.apk"
SIGNING_REPORT_PATH="${REPO_ROOT}/artifacts/android-debug/app-debug.signing.txt"
METADATA_PATH="${REPO_ROOT}/artifacts/android-debug/debug-metadata.json"
SKIP_INSTALL=0

usage() {
  cat <<'EOF'
用法:
  bash scripts/android/build-debug-apk.sh [--skip-install]

说明:
  生成 debug APK，并自动产出签名报告、SHA256 与 metadata。
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

run_debug_pipeline() {
  require_command npm
  require_command npx
  require_command node

  cd "${REPO_ROOT}"

  if [[ "${SKIP_INSTALL}" -ne 1 ]]; then
    npm install
  fi

  npx expo prebuild --platform android --clean
  ensure_android_sdk

  local gradle_attempt=1
  local gradle_max_attempts=2
  local gradle_log=""

  gradle_log="$(mktemp)"

  (
    cd android
    chmod +x ./gradlew
    while true; do
      if ./gradlew assembleDebug 2>&1 | tee "${gradle_log}"; then
        break
      fi

      if [[ "${gradle_attempt}" -ge "${gradle_max_attempts}" ]]; then
        rm -f "${gradle_log}"
        exit 1
      fi

      if ! grep -q 'build_stdout_targets.txt (No such file or directory)' "${gradle_log}"; then
        rm -f "${gradle_log}"
        exit 1
      fi

      echo "检测到 Expo prebuild 后的 CMake 中间产物瞬时缺失，重试 assembleDebug（第 $((gradle_attempt + 1)) 次）..." >&2
      gradle_attempt=$((gradle_attempt + 1))
      sleep 2
    done
  )
  rm -f "${gradle_log}"

  node scripts/android/verify-debug-artifact.mjs "${APK_PATH}"
  node scripts/android/collect-debug-metadata.mjs "${APK_PATH}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
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

run_debug_pipeline

cat <<EOF
Android debug APK 已生成:
  APK: ${APK_PATH}
  验签报告: ${SIGNING_REPORT_PATH}
  Metadata: ${METADATA_PATH}
EOF
