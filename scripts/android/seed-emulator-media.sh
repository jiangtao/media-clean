#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

SERIAL="${ANDROID_SERIAL:-}"
CLEAN_FIRST=0
CONTINUE_SCAN_LAYOUT=0
PICTURES_DIR="/sdcard/Pictures/MediaCleanSeed"
MOVIES_DIR="/sdcard/Movies/MediaCleanSeed"

usage() {
  cat <<'EOF'
用法:
  bash scripts/android/seed-emulator-media.sh --serial <android-serial> [--clean] [--continue-scan-layout]

说明:
  向 Android emulator 注入一组可复用的 Media Clean 样例媒体，便于后续验证 scan / recycle / cleanup 主链。

  选项:
  --serial <serial>  指定目标 Android serial
  --clean            注入前先删除 MediaCleanSeed 目录
  --continue-scan-layout
                     额外调整样例媒体时间窗口，只保留 1 个当前窗口媒体，其余样例回拨到更早历史，
                     用于稳定复现 continue-scan / backfill 链路
  -h, --help         打印帮助
EOF
}

require_command() {
  local command_name="$1"
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    echo "缺少命令: ${command_name}" >&2
    exit 1
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --serial)
      SERIAL="$2"
      shift 2
      ;;
    --clean)
      CLEAN_FIRST=1
      shift
      ;;
    --continue-scan-layout)
      CONTINUE_SCAN_LAYOUT=1
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

require_command adb

if [[ -z "${SERIAL}" ]]; then
  echo "请通过 --serial 指定目标 Android emulator。" >&2
  exit 1
fi

if [[ "$(adb devices | awk -v serial="${SERIAL}" '$1 == serial { print $2 }')" != "device" ]]; then
  echo "指定设备不可用: ${SERIAL}" >&2
  exit 1
fi

declare -a SOURCES=(
  "${REPO_ROOT}/page/public/resources/photo-1579222789613-a174e7e0fdaf:${PICTURES_DIR}/media-clean-sample-1.jpg"
  "${REPO_ROOT}/page/public/resources/photo-1579222789613-a174e7e0fdaf:${PICTURES_DIR}/media-clean-sample-duplicate-1.jpg"
  "${REPO_ROOT}/page/public/resources/photo-1579222789613-a174e7e0fdaf:${PICTURES_DIR}/media-clean-sample-duplicate-2.jpg"
  "${REPO_ROOT}/page/public/resources/photo-1641862039942-5815d8f74938:${PICTURES_DIR}/media-clean-sample-unique-1.jpg"
  "${REPO_ROOT}/design/assets/media-clean-light-simple-flow-boss-v5-tightened.png:${PICTURES_DIR}/media-clean-design-reference.png"
  "${REPO_ROOT}/page/public/promo-video-60fps.mp4:${MOVIES_DIR}/media-clean-sample-video.mp4"
)

for entry in "${SOURCES[@]}"; do
  src="${entry%%:*}"
  if [[ ! -f "${src}" ]]; then
    echo "缺少样例文件: ${src}" >&2
    exit 1
  fi
done

if [[ "${CLEAN_FIRST}" -eq 1 ]]; then
  adb -s "${SERIAL}" shell rm -rf "${PICTURES_DIR}" "${MOVIES_DIR}"
fi

adb -s "${SERIAL}" shell mkdir -p "${PICTURES_DIR}" "${MOVIES_DIR}"

for entry in "${SOURCES[@]}"; do
  src="${entry%%:*}"
  dest="${entry#*:}"
  dest_dir="${dest%/*}"
  if ! adb -s "${SERIAL}" push "${src}" "${dest}" >/dev/null 2>&1; then
    adb -s "${SERIAL}" shell mkdir -p "${dest_dir}" >/dev/null 2>&1 || true
    adb -s "${SERIAL}" push "${src}" "${dest}" >/dev/null
  fi
  adb -s "${SERIAL}" shell am broadcast \
    -a android.intent.action.MEDIA_SCANNER_SCAN_FILE \
    -d "file://${dest}" >/dev/null 2>&1 || true
done

if [[ "${CONTINUE_SCAN_LAYOUT}" -eq 1 ]]; then
  declare -a OLD_WINDOW_TARGETS=(
    "${PICTURES_DIR}/media-clean-sample-1.jpg"
    "${PICTURES_DIR}/media-clean-sample-duplicate-1.jpg"
    "${PICTURES_DIR}/media-clean-sample-duplicate-2.jpg"
    "${PICTURES_DIR}/media-clean-design-reference.png"
    "${MOVIES_DIR}/media-clean-sample-video.mp4"
  )
  declare -a CURRENT_WINDOW_TARGETS=(
    "${PICTURES_DIR}/media-clean-sample-unique-1.jpg"
  )

  for target in "${OLD_WINDOW_TARGETS[@]}"; do
    adb -s "${SERIAL}" shell touch -t 202411011200 "${target}"
    adb -s "${SERIAL}" shell am broadcast \
      -a android.intent.action.MEDIA_SCANNER_SCAN_FILE \
      -d "file://${target}" >/dev/null 2>&1 || true
  done

  for target in "${CURRENT_WINDOW_TARGETS[@]}"; do
    adb -s "${SERIAL}" shell touch -t 202605011200 "${target}"
    adb -s "${SERIAL}" shell am broadcast \
      -a android.intent.action.MEDIA_SCANNER_SCAN_FILE \
      -d "file://${target}" >/dev/null 2>&1 || true
  done
fi

echo "已注入样例媒体到 ${SERIAL}:"
echo "  图片目录: ${PICTURES_DIR}"
echo "  视频目录: ${MOVIES_DIR}"
if [[ "${CONTINUE_SCAN_LAYOUT}" -eq 1 ]]; then
  echo "  布局: continue-scan backfill 样例布局（仅 unique-1 保留在当前窗口）"
fi
echo
echo "MediaStore 中已索引的 MediaCleanSeed 条目:"
adb -s "${SERIAL}" shell content query --uri content://media/external/file --user 0 \
  | grep 'MediaCleanSeed\|media-clean-sample\|media-clean-design-reference' || true
