#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
FLOW_DIR="${ROOT_DIR}/.maestro/smoke"

if ! command -v maestro >/dev/null 2>&1; then
  echo "maestro 未安装，无法执行 smoke flow。" >&2
  exit 1
fi

if ! command -v adb >/dev/null 2>&1; then
  echo "adb 不可用，无法连接 Android 设备。" >&2
  exit 1
fi

DEVICE_COUNT="$(adb devices | awk 'NR>1 && $2 == "device" { count += 1 } END { print count + 0 }')"

if [ "${DEVICE_COUNT}" -lt 1 ]; then
  echo "未检测到可用 Android 设备，请先连接真机或启动模拟器。" >&2
  exit 1
fi

DEVICE_MANUFACTURER="$(adb shell getprop ro.product.manufacturer 2>/dev/null | tr -d '\r')"
MIUI_VERSION="$(adb shell getprop ro.miui.ui.version.name 2>/dev/null | tr -d '\r')"
HAS_MAESTRO_DRIVER="$(adb shell pm list packages 2>/dev/null | grep -c 'maestro' || true)"

if [ "${DEVICE_MANUFACTURER}" = "Xiaomi" ] && [ "${HAS_MAESTRO_DRIVER}" -eq 0 ]; then
  echo "检测到 Xiaomi / MIUI 设备(${MIUI_VERSION:-unknown})，首次运行 Maestro 可能会被系统拦截驱动安装。" >&2
  echo "如出现 INSTALL_FAILED_USER_RESTRICTED，请先在开发者选项中允许 USB 安装 / 调试安装后再重试。" >&2
fi

echo "Running Maestro smoke flows from ${FLOW_DIR}"
maestro test "${FLOW_DIR}" "$@"
