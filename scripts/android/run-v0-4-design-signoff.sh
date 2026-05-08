#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
OBSERVABILITY_SCRIPT="${SCRIPT_DIR}/run-agent-device-observability.sh"
MAESTRO_SCRIPT="${SCRIPT_DIR}/run-maestro-smoke.sh"
APP_ID="${ANDROID_APP_ID:-com.jt.mistapmediacleaner}"
TARGET_DEVICE_SERIAL="${ANDROID_SERIAL:-}"
RUN_MAESTRO=1
RUN_SCAN_COMPLETE=1
RUN_EMULATOR_MATRIX=1
RUN_REAL_DEVICE_DARK=1
REQUIRE_PHYSICAL=0
DRY_RUN=0
DRY_RUN_QEMU="${V0_4_DRY_RUN_QEMU:-1}"
SE_WM_SIZE="${V0_4_SE_WM_SIZE:-750x1334}"
SE_WM_DENSITY="${V0_4_SE_WM_DENSITY:-326}"
CUTOUT_OVERLAY="com.android.internal.display.cutout.emulation.hole"

usage() {
  cat <<'EOF'
用法:
  bash scripts/android/run-v0-4-design-signoff.sh [选项]

说明:
  串起 v0.4 设计稿签收所需的 Android 原生运行态证据：
  1. 当前尺寸 light: filtering-selection / recycle-selection / settings-signoff
  2. scan-complete: 扫描中与结果态
  3. emulator SE light: wm size 750x1334 / density 326
  4. emulator SE dark: cmd uimode night yes
  5. emulator cutout overlay: display cutout hole overlay
  6. real device current-size dark: 真机/非 emulator 的深色主题签收
  7. Maestro smoke: Landing -> Settings -> 语言/主题切换

选项:
  --serial <serial>          指定 Android 设备 serial
  --device <serial>          同 --serial，兼容 Maestro 习惯
  --skip-maestro             跳过 Maestro smoke
  --skip-scan-complete       跳过 scan-complete
  --skip-emulator-matrix     跳过 SE / dark / cutout emulator override
  --skip-real-device-dark    跳过真机/非 emulator 的 current-size dark 签收
  --require-physical         要求目标必须是真机/非 emulator，否则直接失败
  --dry-run                  只打印将执行的命令
  -h, --help                 打印帮助

注意:
  SE / dark / cutout override 只会在 emulator(ro.kernel.qemu=1) 上执行。
  真机/非 emulator 会默认额外跑 current-size dark，并在退出时恢复原主题。
  dry-run 默认模拟 emulator；如需预览真机分支可设置 V0_4_DRY_RUN_QEMU=0。
  脚本会在退出时恢复 wm size、density、night mode 和 cutout overlay。
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --serial|--device)
      TARGET_DEVICE_SERIAL="${2:-}"
      shift 2
      ;;
    --skip-maestro)
      RUN_MAESTRO=0
      shift
      ;;
    --skip-scan-complete)
      RUN_SCAN_COMPLETE=0
      shift
      ;;
    --skip-emulator-matrix)
      RUN_EMULATOR_MATRIX=0
      shift
      ;;
    --skip-real-device-dark)
      RUN_REAL_DEVICE_DARK=0
      shift
      ;;
    --require-physical)
      REQUIRE_PHYSICAL=1
      shift
      ;;
    --dry-run)
      DRY_RUN=1
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

require_command() {
  local command_name="$1"
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    echo "缺少命令: ${command_name}" >&2
    exit 1
  fi
}

adb_target() {
  if [[ -n "${TARGET_DEVICE_SERIAL}" ]]; then
    adb -s "${TARGET_DEVICE_SERIAL}" "$@"
  else
    adb "$@"
  fi
}

run_cmd() {
  echo "+ $*"
  if [[ "${DRY_RUN}" -eq 1 ]]; then
    return 0
  fi
  "$@"
}

run_observability() {
  local command_name="$1"
  echo
  echo "== agent-device ${command_name} =="
  if [[ "${DRY_RUN}" -eq 1 ]]; then
    if [[ -n "${TARGET_DEVICE_SERIAL}" ]]; then
      echo "+ ANDROID_SERIAL=${TARGET_DEVICE_SERIAL} bash ${OBSERVABILITY_SCRIPT} ${command_name}"
    else
      echo "+ bash ${OBSERVABILITY_SCRIPT} ${command_name}"
    fi
    return 0
  fi
  ANDROID_SERIAL="${TARGET_DEVICE_SERIAL}" bash "${OBSERVABILITY_SCRIPT}" "${command_name}"
}

run_maestro_smoke() {
  echo
  echo "== maestro smoke =="
  if [[ "${RUN_MAESTRO}" -ne 1 ]]; then
    echo "skip: --skip-maestro"
    return 0
  fi
  if [[ "${DRY_RUN}" -eq 1 ]]; then
    if [[ -n "${TARGET_DEVICE_SERIAL}" ]]; then
      echo "+ MAESTRO_DEVICE_SERIAL=${TARGET_DEVICE_SERIAL} bash ${MAESTRO_SCRIPT}"
    else
      echo "+ bash ${MAESTRO_SCRIPT}"
    fi
    return 0
  fi
  MAESTRO_DEVICE_SERIAL="${TARGET_DEVICE_SERIAL}" bash "${MAESTRO_SCRIPT}"
}

run_target_page_signoff() {
  local label="$1"
  echo
  echo "## ${label}"
  run_observability filtering-selection
  run_observability recycle-selection
  run_observability settings-signoff
}

set_night_mode() {
  local mode="$1"
  run_cmd adb_target shell cmd uimode night "${mode}"
  sleep 1
}

set_wm_override() {
  run_cmd adb_target shell wm size "${SE_WM_SIZE}"
  run_cmd adb_target shell wm density "${SE_WM_DENSITY}"
  sleep 1
}

restore_wm_size() {
  local original_size_file="$1"
  local override_size=""
  override_size="$(awk -F': ' '/Override size:/ { print $2 }' "${original_size_file}" | tail -n 1)"
  if [[ -n "${override_size}" ]]; then
    run_cmd adb_target shell wm size "${override_size}"
  else
    run_cmd adb_target shell wm size reset
  fi
}

restore_wm_density() {
  local original_density_file="$1"
  local override_density=""
  override_density="$(awk -F': ' '/Override density:/ { print $2 }' "${original_density_file}" | tail -n 1)"
  if [[ -n "${override_density}" ]]; then
    run_cmd adb_target shell wm density "${override_density}"
  else
    run_cmd adb_target shell wm density reset
  fi
}

restore_night_mode() {
  local original_night_file="$1"
  local original_night=""
  original_night="$(awk -F': ' '/Night mode:/ { print $2 }' "${original_night_file}" | tail -n 1)"
  case "${original_night}" in
    yes|no|auto|custom)
      run_cmd adb_target shell cmd uimode night "${original_night}" || true
      ;;
    *)
      run_cmd adb_target shell cmd uimode night no || true
      ;;
  esac
}

save_cutout_overlays() {
  local output_file="$1"
  # Disabled overlays are printed as "[ ] package"; enabled overlays as "[x] package".
  # Use the last field and strip adb's CR so package names are safe shell args.
  adb_target shell cmd overlay list \
    | awk '/com\.android\.internal\.display\.cutout\.emulation/ && $1 == "[x]" { overlay = $NF; sub(/\r$/, "", overlay); print overlay }' \
    > "${output_file}" || true
}

restore_cutout_overlays() {
  local original_cutout_file="$1"
  local overlay=""

  # Only disable currently enabled overlays; disabling inactive category members can
  # produce noisy shell errors and may leave the active overlay unchanged.
  adb_target shell cmd overlay list \
    | awk '/com\.android\.internal\.display\.cutout\.emulation/ && $1 == "[x]" { overlay = $NF; sub(/\r$/, "", overlay); print overlay }' \
    | while IFS= read -r overlay; do
      [[ -n "${overlay}" ]] && run_cmd adb_target shell cmd overlay disable "${overlay}" || true
    done

  while IFS= read -r overlay; do
    [[ -n "${overlay}" ]] && run_cmd adb_target shell cmd overlay enable "${overlay}" || true
  done < "${original_cutout_file}"
}

main() {
  require_command awk
  require_command bash

  cd "${REPO_ROOT}"

  local device_count=""
  local qemu=""
  tmp_dir=""
  original_size_file=""
  original_density_file=""
  original_night_file=""
  original_cutout_file=""

  if [[ "${DRY_RUN}" -ne 1 ]]; then
    require_command adb

    if [[ -n "${TARGET_DEVICE_SERIAL}" ]]; then
      if ! adb devices | awk 'NR > 1 && $1 == serial && $2 == "device" { found = 1 } END { exit(found ? 0 : 1) }' serial="${TARGET_DEVICE_SERIAL}"; then
        echo "指定的 Android 设备不可用: ${TARGET_DEVICE_SERIAL}" >&2
        exit 1
      fi
    else
      device_count="$(adb devices | awk 'NR > 1 && $2 == "device" { count += 1 } END { print count + 0 }')"
      if [[ "${device_count}" -lt 1 ]]; then
        echo "未检测到可用 Android 设备。请先启动 emulator 或连接真机。" >&2
        exit 1
      fi
      if [[ "${device_count}" -gt 1 ]]; then
        echo "检测到多个 Android 设备，请通过 --serial 指定目标设备。" >&2
        exit 1
      fi
    fi
  else
    echo "dry-run: skip Android device availability check"
  fi

  tmp_dir="$(mktemp -d "${TMPDIR:-/tmp}/v0-4-design-signoff.XXXXXX")"
  original_size_file="${tmp_dir}/wm-size.txt"
  original_density_file="${tmp_dir}/wm-density.txt"
  original_night_file="${tmp_dir}/night-mode.txt"
  original_cutout_file="${tmp_dir}/cutout-overlays.txt"

  if [[ "${DRY_RUN}" -ne 1 ]]; then
    adb_target shell wm size > "${original_size_file}"
    adb_target shell wm density > "${original_density_file}"
    adb_target shell cmd uimode night > "${original_night_file}" 2>&1 || true
    save_cutout_overlays "${original_cutout_file}"
  else
    printf 'Physical size: dry-run\n' > "${original_size_file}"
    printf 'Physical density: dry-run\n' > "${original_density_file}"
    printf 'Night mode: no\n' > "${original_night_file}"
    : > "${original_cutout_file}"
  fi

  cleanup() {
    if [[ -n "${original_cutout_file:-}" && -f "${original_cutout_file}" && "${DRY_RUN}" -ne 1 ]]; then
      restore_cutout_overlays "${original_cutout_file}" || true
    fi
    if [[ -n "${original_size_file:-}" && -f "${original_size_file}" && "${DRY_RUN}" -ne 1 ]]; then
      restore_wm_size "${original_size_file}" || true
    fi
    if [[ -n "${original_density_file:-}" && -f "${original_density_file}" && "${DRY_RUN}" -ne 1 ]]; then
      restore_wm_density "${original_density_file}" || true
    fi
    if [[ -n "${original_night_file:-}" && -f "${original_night_file}" && "${DRY_RUN}" -ne 1 ]]; then
      restore_night_mode "${original_night_file}" || true
    fi
    [[ -n "${tmp_dir:-}" && -d "${tmp_dir}" ]] && rm -rf "${tmp_dir}"
  }
  trap cleanup EXIT

  if [[ "${DRY_RUN}" -eq 1 ]]; then
    qemu="${DRY_RUN_QEMU}"
  else
    qemu="$(adb_target shell getprop ro.kernel.qemu 2>/dev/null | tr -d '\r' || true)"
  fi

  echo "v0.4 design signoff target:"
  echo "  app id: ${APP_ID}"
  echo "  serial: ${TARGET_DEVICE_SERIAL:-auto-single-device}"
  echo "  emulator: ${qemu:-0}"

  if [[ "${REQUIRE_PHYSICAL}" -eq 1 && "${qemu}" == "1" ]]; then
    echo "当前目标是 emulator，但此入口要求物理 Android 真机。请连接真机，或改用 verify:android:v0-4-design-signoff。" >&2
    exit 1
  fi

  set_night_mode no
  run_target_page_signoff "current-size light"

  if [[ "${RUN_SCAN_COMPLETE}" -eq 1 ]]; then
    run_observability scan-complete
  else
    echo "skip scan-complete: --skip-scan-complete"
  fi

  if [[ "${RUN_EMULATOR_MATRIX}" -eq 1 && "${qemu}" == "1" ]]; then
    set_wm_override
    set_night_mode no
    run_target_page_signoff "SE light (${SE_WM_SIZE} @ ${SE_WM_DENSITY})"

    set_night_mode yes
    run_target_page_signoff "SE dark (${SE_WM_SIZE} @ ${SE_WM_DENSITY})"

    restore_wm_size "${original_size_file}"
    restore_wm_density "${original_density_file}"
    set_night_mode no
    run_cmd adb_target shell cmd overlay enable "${CUTOUT_OVERLAY}"
    sleep 1

    echo
    echo "## display cutout overlay"
    run_observability filtering-selection
  elif [[ "${RUN_REAL_DEVICE_DARK}" -eq 1 && "${qemu}" != "1" ]]; then
    echo
    echo "non-emulator target: run current-size dark signoff"
    set_night_mode yes
    run_target_page_signoff "current-size dark"
  elif [[ "${RUN_EMULATOR_MATRIX}" -eq 1 ]]; then
    echo
    echo "skip emulator matrix: target device is not an emulator"
  else
    echo
    echo "skip emulator matrix: --skip-emulator-matrix"
  fi

  if [[ "${DRY_RUN}" -ne 1 ]]; then
    restore_cutout_overlays "${original_cutout_file}"
    restore_wm_size "${original_size_file}"
    restore_wm_density "${original_density_file}"
    restore_night_mode "${original_night_file}"
  else
    echo
    echo "dry-run: skip device state restore"
  fi

  run_maestro_smoke

  echo
  echo "v0.4 design signoff finished."
}

main
