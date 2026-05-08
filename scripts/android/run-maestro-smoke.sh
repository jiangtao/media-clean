#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
FLOW_DIR="${ROOT_DIR}/.maestro/smoke"
APP_ID="com.jt.mistapmediacleaner"
TARGET_DEVICE_SERIAL="${MAESTRO_DEVICE_SERIAL:-}"

for ((index = 1; index <= $#; index += 1)); do
  argument="${!index}"
  if [ "${argument}" = "--device" ]; then
    next_index=$((index + 1))
    TARGET_DEVICE_SERIAL="${!next_index:-}"
    break
  fi
  case "${argument}" in
    --device=*)
      TARGET_DEVICE_SERIAL="${argument#--device=}"
      break
      ;;
  esac
done

if ! command -v maestro >/dev/null 2>&1; then
  echo "maestro 未安装，无法执行 smoke flow。" >&2
  exit 1
fi

if ! command -v adb >/dev/null 2>&1; then
  echo "adb 不可用，无法连接 Android 设备。" >&2
  exit 1
fi

ADB_ARGS=()
if [ -n "${TARGET_DEVICE_SERIAL}" ]; then
  ADB_ARGS=(-s "${TARGET_DEVICE_SERIAL}")
fi

adb_target() {
  if [ "${#ADB_ARGS[@]}" -gt 0 ]; then
    adb "${ADB_ARGS[@]}" "$@"
  else
    adb "$@"
  fi
}

if [ -n "${TARGET_DEVICE_SERIAL}" ] && ! adb devices | awk 'NR>1 && $1 == serial && $2 == "device" { found = 1 } END { exit(found ? 0 : 1) }' serial="${TARGET_DEVICE_SERIAL}"; then
  echo "指定的 Android 设备不可用: ${TARGET_DEVICE_SERIAL}" >&2
  exit 1
fi

DEVICE_COUNT="$(adb devices | awk 'NR>1 && $2 == "device" { count += 1 } END { print count + 0 }')"

if [ "${DEVICE_COUNT}" -lt 1 ]; then
  echo "未检测到可用 Android 设备，请先连接真机或启动模拟器。" >&2
  exit 1
fi

if [ "${DEVICE_COUNT}" -gt 1 ] && [ -z "${TARGET_DEVICE_SERIAL}" ]; then
  echo "检测到多个 Android 设备，请先只保留一个设备或显式传入 --device。" >&2
  exit 1
fi

DEVICE_MANUFACTURER="$(adb_target shell getprop ro.product.manufacturer 2>/dev/null | tr -d '\r')"
MIUI_VERSION="$(adb_target shell getprop ro.miui.ui.version.name 2>/dev/null | tr -d '\r')"
HAS_MAESTRO_DRIVER="$(adb_target shell pm list packages 2>/dev/null | grep -c 'dev.mobile.maestro' || true)"
HAS_MAESTRO_SERVER="$(adb_target shell pm list packages 2>/dev/null | grep -c 'dev.mobile.maestro.test' || true)"
REINSTALL_DRIVER_FLAG="${MAESTRO_REINSTALL_DRIVER:-auto}"

if [ "${DEVICE_MANUFACTURER}" = "Xiaomi" ] && [ "${HAS_MAESTRO_DRIVER}" -eq 0 ]; then
  echo "检测到 Xiaomi / MIUI 设备(${MIUI_VERSION:-unknown})，首次运行 Maestro 可能会被系统拦截驱动安装。" >&2
  echo "如出现 INSTALL_FAILED_USER_RESTRICTED，请先在开发者选项中允许 USB 安装 / 调试安装后再重试。" >&2
fi

if [ "${REINSTALL_DRIVER_FLAG}" = "auto" ] && [ "${HAS_MAESTRO_DRIVER}" -gt 0 ]; then
  REINSTALL_DRIVER_FLAG="false"
fi

if [ "${REINSTALL_DRIVER_FLAG}" = "false" ] && [ "${HAS_MAESTRO_SERVER}" -eq 0 ]; then
  echo "当前设备未安装 Maestro server app (dev.mobile.maestro.test)。" >&2
  echo "本地 maestro 2.3.0 即便带 --no-reinstall-driver，仍会尝试安装 server APK；在当前设备上这一步会被系统拒绝。" >&2
  if [ "${DEVICE_MANUFACTURER}" = "Xiaomi" ] || [ -n "${MIUI_VERSION}" ]; then
    echo "检测到 Xiaomi / MIUI 环境，建议改走 emulator / CI fallback：" >&2
    echo "1. GitHub Actions: .github/workflows/android-maestro-smoke.yml" >&2
    echo "2. 本地 Android Emulator: 先安装 app-debug.apk，再运行 maestro --device emulator-5554 test .maestro/smoke" >&2
  fi
  exit 1
fi

echo "Running Maestro smoke flows from ${FLOW_DIR}"
adb_target shell pm clear "${APP_ID}" >/dev/null 2>&1 || true
if [ "${REINSTALL_DRIVER_FLAG}" = "false" ]; then
  echo "检测到已安装 Maestro driver，当前运行将复用已有 driver（--no-reinstall-driver）。"
  maestro test --no-reinstall-driver "${FLOW_DIR}" "$@"
else
  maestro test "${FLOW_DIR}" "$@"
fi
