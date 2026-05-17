#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
DEFAULT_ARTIFACT_ROOT="${REPO_ROOT}/artifacts/agent-device"
DEFAULT_SESSION="media-clean-observability"
DEFAULT_AGENT_DEVICE_VERSION="0.14.7"
DEFAULT_ANDROID_APP_ID="com.jt.mistapmediacleaner"
DEFAULT_ANDROID_APK_PATH="${REPO_ROOT}/android/app/build/outputs/apk/debug/app-debug.apk"
DEFAULT_AGENT_DEVICE_STATE_DIR="${REPO_ROOT}/.tmp/agent-device"
AGENT_DEVICE_WRAPPER="${SCRIPT_DIR}/run-agent-device.sh"
AGENT_DEVICE_DAEMON_ENTRY_PATH="${REPO_ROOT}/node_modules/agent-device/dist/src/internal/daemon.js"

COMMAND="${1:-capture}"
if [[ $# -gt 0 ]]; then
  shift
fi

SERIAL="${ANDROID_SERIAL:-}"
ARTIFACT_ROOT="${DEFAULT_ARTIFACT_ROOT}"
SESSION="${DEFAULT_SESSION}"
AGENT_DEVICE_VERSION="${AGENT_DEVICE_VERSION:-${DEFAULT_AGENT_DEVICE_VERSION}}"
APP_ID="${ANDROID_APP_ID:-${DEFAULT_ANDROID_APP_ID}}"
APP_DATA_DIR="/data/user/0/${APP_ID}"
APK_PATH="${ANDROID_APK_PATH:-${DEFAULT_ANDROID_APK_PATH}}"
METRO_PORT="${METRO_PORT:-8081}"
METRO_PUBLIC_BASE_URL="${METRO_PUBLIC_BASE_URL:-http://127.0.0.1:${METRO_PORT}}"
AGENT_DEVICE_STATE_DIR="${AGENT_DEVICE_STATE_DIR:-${DEFAULT_AGENT_DEVICE_STATE_DIR}}"
INSTALL_APK=0
ENABLE_REACT_DEVTOOLS=0

usage() {
  cat <<'EOF'
用法:
  bash scripts/android/run-agent-device-observability.sh [capture|smoke|acceptance|scan-probe|scan-complete|continue-scan|all-complete|permission-denied|scan-cleanup|settings-signoff|filtering-selection|recycle|recycle-selection|recycle-delete|doctor|react|help] [选项]

说明:
  为 Media Clean 提供基于 agent-device 的 Android 设备观测验证入口。

命令:
  capture   启动 Metro、打开应用，并采集 snapshot/screenshot/log/perf/react-devtools 证据
  smoke     执行 Landing -> Main -> Settings -> theme/language 的设备级 smoke 流转
  acceptance 执行首启落地页、媒体授权、提醒通知授权与回流的完整验收流转
  scan-probe 执行 seeded media scan 主流程探针，验证扫描中的真实分母/分子与结果态
  scan-complete 执行真实扫描直到完成态/结果态，不在 running 阶段自动取消
  continue-scan 执行“当前批次耗尽 -> 继续扫描 -> 更早窗口回填”验收
  all-complete 执行“继续扫描回填 -> full batch 结果清空 -> 全部媒体已扫描完成”验收
  permission-denied 执行首启授权拒绝后的回流与再引导验收
  scan-cleanup 执行 seeded scan -> detail viewer -> primary cleanup -> recycle 回流验收
  settings-signoff 执行 Settings 06 设计签收采集，不切换主题/语言
  filtering-selection 执行 seeded scan -> issue workspace -> selection mode 设计签收采集
  recycle   执行 Recycle Bin hydration -> detail viewer -> restore 回流验收
  recycle-selection 执行 Recycle Bin hydration -> selection mode 设计签收采集
  recycle-delete 执行 Recycle Bin hydration -> detail viewer -> hard delete 回流验收
  doctor    输出设备、应用与环境前置检查信息
  react     仅检查 react-devtools 连接与组件树
  help      打印本帮助

选项:
  --serial <serial>           指定 Android 设备 serial
  --artifact-root <path>      指定 artifacts 根目录，默认 artifacts/agent-device
  --session <name>            指定 agent-device session 名称
  --app-id <package>          指定 Android 包名，默认 com.jt.mistapmediacleaner
  --apk-path <path>           指定待安装 debug APK 路径
  --agent-device-version <v>  指定 agent-device 版本，默认 0.14.7
  --metro-port <port>         指定 Metro 端口，默认 8081
  --public-base-url <url>     指定 Metro public base URL
  --install-apk               在 capture / smoke / acceptance 前安装 APK
  --react-devtools            在 capture 中附带 react-devtools 证据
EOF
}

run_and_exit() {
  "$@"
  local status=$?
  exit "${status}"
}

require_command() {
  local command_name="$1"
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    echo "缺少命令: ${command_name}" >&2
    exit 1
  fi
}

agent_device() {
  if [[ -f "${AGENT_DEVICE_WRAPPER}" ]]; then
    AGENT_DEVICE_VERSION="${AGENT_DEVICE_VERSION}" bash "${AGENT_DEVICE_WRAPPER}" "$@"
    return
  fi

  npx -y "agent-device@${AGENT_DEVICE_VERSION}" "$@"
}

agent_device_target() {
  agent_device "$@" --platform android --serial "${SERIAL}"
}

adb_serial_state() {
  adb devices | awk -v serial="${SERIAL}" '$1 == serial { print $2 }'
}

wait_for_serial_online() {
  local timeout_seconds="${1:-20}"
  local elapsed=0
  local serial_state=""

  while [[ "${elapsed}" -lt "${timeout_seconds}" ]]; do
    serial_state="$(adb_serial_state)"
    if [[ "${serial_state}" == "device" ]]; then
      return 0
    fi
    sleep 1
    elapsed="$((elapsed + 1))"
  done

  return 1
}

parse_conflicting_session_from_error_log() {
  local error_log_path="$1"

  node -e '
    const fs = require("node:fs");
    const filePath = process.argv[1];
    try {
      const content = fs.readFileSync(filePath, "utf8");
      const match = content.match(/Device is already in use by session "([^"]+)"/);
      if (match?.[1]) {
        process.stdout.write(match[1]);
      }
    } catch {}
  ' "${error_log_path}"
}

open_app_with_session() {
  local relaunch_mode="${1:-relaunch}"
  local open_error_log=""
  local conflicting_session=""
  local open_args=(
    open
    "${APP_ID}"
    --platform android
    --serial "${SERIAL}"
    --session "${SESSION}"
  )

  if [[ "${relaunch_mode}" == "relaunch" ]]; then
    open_args+=(--relaunch)
  fi

  open_error_log="$(mktemp)"
  if agent_device "${open_args[@]}" > /dev/null 2>"${open_error_log}"; then
    rm -f "${open_error_log}"
    return 0
  fi

  conflicting_session="$(parse_conflicting_session_from_error_log "${open_error_log}")"
  if [[ -n "${conflicting_session}" && "${conflicting_session}" != "${SESSION}" ]]; then
    agent_device close --platform android --session "${conflicting_session}" >/dev/null 2>&1 || true
    if agent_device "${open_args[@]}" > /dev/null 2>"${open_error_log}"; then
      rm -f "${open_error_log}"
      return 0
    fi

    restart_repo_agent_device_daemon
    if agent_device "${open_args[@]}" > /dev/null 2>"${open_error_log}"; then
      rm -f "${open_error_log}"
      return 0
    fi
  fi

  cat "${open_error_log}" >&2
  rm -f "${open_error_log}"
  return 1
}

current_foreground_package_via_adb() {
  adb -s "${SERIAL}" shell dumpsys activity activities 2>/dev/null | node -e '
    let input = "";
    process.stdin.on("data", (chunk) => input += chunk);
    process.stdin.on("end", () => {
      const match = input.match(/topResumedActivity=ActivityRecord\{[^ ]+ [^ ]+ ([^/]+)\//)
        || input.match(/ResumedActivity: ActivityRecord\{[^ ]+ [^ ]+ ([^/]+)\//)
        || input.match(/mFocusedApp=ActivityRecord\{[^ ]+ [^ ]+ ([^/]+)\//);
      process.stdout.write(match?.[1] || "");
    });
  '
}

agent_device_session() {
  local error_log=""
  local conflicting_session=""
  local foreground_package=""
  local did_reattach=0

  error_log="$(mktemp)"
  if agent_device "$@" --platform android --session "${SESSION}" 2>"${error_log}"; then
    rm -f "${error_log}"
    return 0
  fi

  if grep -q "device '${SERIAL}' not found" "${error_log}"; then
    if wait_for_serial_online 20; then
      if open_app_with_session "attach" >/dev/null 2>&1; then
        wait_for_session_ready >/dev/null 2>&1 || true
      elif open_app_with_session "relaunch" >/dev/null 2>&1; then
        wait_for_session_ready >/dev/null 2>&1 || true
      fi

      if agent_device "$@" --platform android --session "${SESSION}" 2>"${error_log}"; then
        rm -f "${error_log}"
        return 0
      fi
    fi
  fi

  conflicting_session="$(parse_conflicting_session_from_error_log "${error_log}")"
  if grep -q 'SESSION_NOT_FOUND' "${error_log}" || [[ -n "${conflicting_session}" ]]; then
    if [[ -n "${conflicting_session}" && "${conflicting_session}" != "${SESSION}" ]]; then
      agent_device close --platform android --session "${conflicting_session}" >/dev/null 2>&1 || true
    fi

    if open_app_with_session "attach" >/dev/null 2>&1; then
      wait_for_session_ready >/dev/null 2>&1 || true
      did_reattach=1
    elif open_app_with_session "relaunch" >/dev/null 2>&1; then
      wait_for_session_ready >/dev/null 2>&1 || true
      did_reattach=1
    fi

    if [[ "${did_reattach}" -eq 1 ]]; then
      if agent_device "$@" --platform android --session "${SESSION}" 2>"${error_log}"; then
        rm -f "${error_log}"
        return 0
      fi
    fi

    foreground_package="$(current_foreground_package_via_adb)"
    if [[ "${foreground_package}" == "${APP_ID}" ]]; then
      if open_app_with_session "attach" >/dev/null 2>&1; then
        if agent_device "$@" --platform android --session "${SESSION}" 2>"${error_log}"; then
          rm -f "${error_log}"
          return 0
        fi
      fi
    fi
  fi

  cat "${error_log}" >&2
  rm -f "${error_log}"
  return 1
}

current_foreground_package() {
  agent_device_session appstate --json | node -e '
    let input = "";
    process.stdin.on("data", (chunk) => input += chunk);
    process.stdin.on("end", () => {
      const payload = JSON.parse(input || "{}");
      process.stdout.write(payload?.data?.package || "");
    });
  '
}

device_display_size() {
  adb -s "${SERIAL}" shell wm size 2>/dev/null | node -e '
    let input = "";
    process.stdin.on("data", (chunk) => input += chunk);
    process.stdin.on("end", () => {
      const overrideMatch = input.match(/Override size:\s*(\d+x\d+)/);
      const physicalMatch = input.match(/Physical size:\s*(\d+x\d+)/);
      process.stdout.write(overrideMatch?.[1] || physicalMatch?.[1] || "");
    });
  '
}

safe_vertical_scroll_down_via_adb() {
  local display_size=""
  local width=""
  local height=""
  local center_x=""
  local start_y=""
  local end_y=""

  display_size="$(device_display_size)"
  if [[ -z "${display_size}" || "${display_size}" != *x* ]]; then
    return 1
  fi

  width="${display_size%x*}"
  height="${display_size#*x}"
  center_x="$((width / 2))"
  start_y="$((height * 78 / 100))"
  end_y="$((height * 34 / 100))"

  adb -s "${SERIAL}" shell input swipe "${center_x}" "${start_y}" "${center_x}" "${end_y}" 280 >/dev/null 2>&1 || return 1
  sleep 1
}

safe_vertical_scroll_up_via_adb() {
  local display_size=""
  local width=""
  local height=""
  local center_x=""
  local start_y=""
  local end_y=""

  display_size="$(device_display_size)"
  if [[ -z "${display_size}" || "${display_size}" != *x* ]]; then
    return 1
  fi

  width="${display_size%x*}"
  height="${display_size#*x}"
  center_x="$((width / 2))"
  start_y="$((height * 34 / 100))"
  end_y="$((height * 78 / 100))"

  adb -s "${SERIAL}" shell input swipe "${center_x}" "${start_y}" "${center_x}" "${end_y}" 280 >/dev/null 2>&1 || return 1
  sleep 1
}

scroll_landing_to_primary_action() {
  local attempt=0

  for attempt in {1..3}; do
    ensure_app_foreground
    safe_vertical_scroll_down_via_adb >/dev/null 2>&1 || agent_device_session scroll down >/dev/null 2>&1 || true
    ensure_app_foreground
    if agent_device_session wait 'id="landing-primary-action"' 3000 >/dev/null 2>&1; then
      return 0
    fi
  done

  return 1
}

ensure_app_foreground() {
  local current_package=""
  local open_error_log=""
  current_package="$(current_foreground_package 2>/dev/null || true)"
  if [[ "${current_package}" != "${APP_ID}" ]]; then
    current_package="$(current_foreground_package_via_adb 2>/dev/null || true)"
  fi
  if [[ "${current_package}" == "${APP_ID}" ]]; then
    return 0
  fi

  if agent_device_session wait text "MediaClean" 3000 >/dev/null 2>&1; then
    if agent_device_session press 'label="MediaClean"' >/dev/null 2>&1; then
      agent_device_session wait 1500 >/dev/null
    else
      open_app_with_session
      agent_device_session wait 1500 >/dev/null
    fi
  else
    open_app_with_session
    agent_device_session wait 1500 >/dev/null
  fi

  current_package="$(current_foreground_package 2>/dev/null || true)"
  if [[ "${current_package}" != "${APP_ID}" ]]; then
    current_package="$(current_foreground_package_via_adb 2>/dev/null || true)"
  fi
  if [[ "${current_package}" != "${APP_ID}" ]]; then
    echo "应用未保持在前台，当前前台包名: ${current_package:-<unknown>}" >&2
    exit 1
  fi
}

wait_for_session_ready() {
  local attempt=0

  for attempt in {1..10}; do
    if agent_device_session appstate --json >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done

  echo "agent-device session 未在预期时间内就绪: ${SESSION}" >&2
  return 1
}

prepare_active_session() {
  wait_for_session_ready
  agent_device_session settings animations off >/dev/null 2>&1 || true

  local attempt=0
  for attempt in {1..5}; do
    if agent_device_session logs clear --restart >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done

  echo "agent-device session 日志重启失败，已降级为继续执行: ${SESSION}" >&2
  return 0
}

reattach_session_best_effort() {
  if open_app_with_session "attach" >/dev/null 2>&1; then
    wait_for_session_ready >/dev/null 2>&1 || true
    return 0
  fi

  if open_app_with_session "relaunch" >/dev/null 2>&1; then
    wait_for_session_ready >/dev/null 2>&1 || true
    return 0
  fi

  return 1
}

configure_adb_reverse() {
  adb -s "${SERIAL}" reverse "tcp:${METRO_PORT}" "tcp:${METRO_PORT}" >/dev/null 2>&1 || true
}

detect_android_serial() {
  if [[ -n "${SERIAL}" ]]; then
    local matched_status=""
    matched_status="$(adb devices | awk -v serial="${SERIAL}" '$1 == serial { print $2 }')"
    if [[ "${matched_status}" != "device" ]]; then
      echo "指定的 Android 设备不在线或不可用: ${SERIAL}" >&2
      echo "请先检查 adb devices 输出，确认设备已连接、已授权且状态为 device。" >&2
      exit 1
    fi
    return 0
  fi

  local -a devices=()
  while IFS=$'\t' read -r serial status _; do
    [[ -z "${serial}" ]] && continue
    [[ "${status}" != "device" ]] && continue
    devices+=("${serial}")
  done < <(adb devices | tail -n +2)

  if [[ "${#devices[@]}" -eq 0 ]]; then
    echo "未检测到可用 Android 设备。请先连接真机或启动 emulator。" >&2
    exit 1
  fi

  if [[ "${#devices[@]}" -gt 1 ]]; then
    echo "检测到多个 Android 设备，请通过 --serial 显式指定目标设备: ${devices[*]}" >&2
    exit 1
  fi

  SERIAL="${devices[0]}"
}

reset_agent_device_state_if_idle() {
  local daemon_lock_path="${AGENT_DEVICE_STATE_DIR}/daemon.lock"
  local daemon_pid=""
  local repo_daemon_pids=""

  mkdir -p "${AGENT_DEVICE_STATE_DIR}"

  [[ -f "${daemon_lock_path}" ]] || return 0

  daemon_pid="$(node -e '
    const fs = require("node:fs");
    const filePath = process.argv[1];
    try {
      const payload = JSON.parse(fs.readFileSync(filePath, "utf8"));
      process.stdout.write(payload?.pid ? String(payload.pid) : "");
    } catch {}
  ' "${daemon_lock_path}")"

  if [[ -n "${daemon_pid}" ]] && kill -0 "${daemon_pid}" >/dev/null 2>&1; then
    kill "${daemon_pid}" >/dev/null 2>&1 || true
    sleep 1
  fi

  repo_daemon_pids="$(pgrep -f "${AGENT_DEVICE_DAEMON_ENTRY_PATH}" || true)"
  if [[ -n "${repo_daemon_pids}" ]]; then
    while IFS= read -r repo_daemon_pid; do
      [[ -z "${repo_daemon_pid}" ]] && continue
      kill "${repo_daemon_pid}" >/dev/null 2>&1 || true
    done <<< "${repo_daemon_pids}"
    sleep 1
  fi

  rm -rf "${AGENT_DEVICE_STATE_DIR}"
  mkdir -p "${AGENT_DEVICE_STATE_DIR}"
  echo "已重置 repo-local agent-device state，并清理当前仓库残留 daemon，避免 session 抢占设备: ${AGENT_DEVICE_STATE_DIR}" >&2
}

restart_repo_agent_device_daemon() {
  local repo_daemon_pids=""

  repo_daemon_pids="$(pgrep -f "${AGENT_DEVICE_DAEMON_ENTRY_PATH}" || true)"
  if [[ -n "${repo_daemon_pids}" ]]; then
    while IFS= read -r repo_daemon_pid; do
      [[ -z "${repo_daemon_pid}" ]] && continue
      kill "${repo_daemon_pid}" >/dev/null 2>&1 || true
    done <<< "${repo_daemon_pids}"
    sleep 1
  fi

  rm -rf "${AGENT_DEVICE_STATE_DIR}"
  mkdir -p "${AGENT_DEVICE_STATE_DIR}"
}

close_conflicting_android_sessions() {
  local names=""

  names="$(agent_device session list --json | node -e '
    let input = "";
    process.stdin.on("data", (chunk) => input += chunk);
    process.stdin.on("end", () => {
      try {
        const payload = JSON.parse(input || "{}");
        const sessions = Array.isArray(payload?.data?.sessions) ? payload.data.sessions : [];
        const serial = process.argv[1];
        const currentSession = process.argv[2];
        const matches = sessions
          .filter((session) => session?.platform === "android" && session?.id === serial && session?.name && session.name !== currentSession)
          .map((session) => session.name);
        process.stdout.write(matches.join("\\n"));
      } catch {}
    });
  ' "${SERIAL}" "${SESSION}")"

  [[ -z "${names}" ]] && return 0

  while IFS= read -r session_name; do
    [[ -z "${session_name}" ]] && continue
    agent_device close --platform android --session "${session_name}" >/dev/null 2>&1 || true
  done <<< "${names}"
}

prepare_run_dir() {
  local timestamp
  timestamp="$(date +%Y%m%d-%H%M%S)"
  RUN_DIR="${ARTIFACT_ROOT}/${timestamp}"
  mkdir -p "${RUN_DIR}"
}

copy_log_if_available() {
  local log_path
  log_path="$(agent_device_session logs path 2>/dev/null | tail -n 1 | tr -d '\r' || true)"
  if [[ -n "${log_path}" ]]; then
    printf '%s\n' "${log_path}" > "${RUN_DIR}/log-path.txt"
    if [[ -f "${log_path}" ]]; then
      cp "${log_path}" "${RUN_DIR}/session.log"
    fi
  fi
}

capture_step_artifacts() {
  local step_name="$1"
  local step_dir="${RUN_DIR}/steps/${step_name}"
  mkdir -p "${step_dir}"

  agent_device_session snapshot --json > "${step_dir}/snapshot.json"
  agent_device_session snapshot -i -c --json > "${step_dir}/snapshot-interactive.json"
  if ! agent_device_session screenshot "${step_dir}/screen.png" --overlay-refs; then
    adb -s "${SERIAL}" exec-out screencap -p > "${step_dir}/screen.png" 2>/dev/null || true
  fi
}

interactive_ref_for_identifier() {
  local snapshot_path="$1"
  local identifier="$2"

  node -e '
    const fs = require("node:fs");
    const [filePath, identifier] = process.argv.slice(1);

    try {
      const payload = JSON.parse(fs.readFileSync(filePath, "utf8"));
      const nodes = payload?.data?.nodes;
      if (!Array.isArray(nodes)) {
        process.exit(0);
      }

      const match = nodes.find((node) => node?.identifier === identifier && node?.hittable !== false && node?.ref);
      if (match?.ref) {
        process.stdout.write(String(match.ref));
      }
    } catch {}
  ' "${snapshot_path}" "${identifier}"
}

snapshot_has_identifier() {
  local snapshot_path="$1"
  local identifier="$2"

  node -e '
    const fs = require("node:fs");
    const [filePath, identifier] = process.argv.slice(1);

    try {
      const payload = JSON.parse(fs.readFileSync(filePath, "utf8"));
      const nodes = payload?.data?.nodes;
      if (!Array.isArray(nodes)) {
        process.exit(0);
      }

      const found = nodes.some((node) => node?.identifier === identifier);
      process.stdout.write(found ? "true" : "false");
    } catch {}
  ' "${snapshot_path}" "${identifier}"
}

snapshot_has_result_summary_surface() {
  local snapshot_path="$1"

  node - "${snapshot_path}" <<'NODE'
const fs = require('node:fs');

const snapshotPath = process.argv[2];
const payload = JSON.parse(fs.readFileSync(snapshotPath, 'utf8') || '{}');
const nodes = Array.isArray(payload?.data?.nodes) ? payload.data.nodes : [];

const found = nodes.some((node) => {
  const identifier = typeof node?.identifier === 'string' ? node.identifier : '';
  return identifier === 'photo-grid-scan-summary'
    || /^photo-grid-result-breakdown-/.test(identifier);
});

process.stdout.write(found ? 'true' : 'false');
NODE
}

snapshot_has_visible_identifier_rect() {
  local snapshot_path="$1"
  local identifier="$2"

  node - "${snapshot_path}" "${identifier}" <<'NODE'
const fs = require('node:fs');

const snapshotPath = process.argv[2];
const identifier = process.argv[3];
const payload = JSON.parse(fs.readFileSync(snapshotPath, 'utf8') || '{}');
const nodes = Array.isArray(payload?.data?.nodes) ? payload.data.nodes : [];
const match = nodes.find((node) => node?.identifier === identifier);
const rect = match?.rect;
const isVisible = Boolean(
  rect
  && Number(rect.width ?? 0) >= 12
  && Number(rect.height ?? 0) >= 12
  && Number(rect.x ?? 0) >= 0
  && Number(rect.y ?? 0) >= 0,
);

process.stdout.write(isVisible ? 'true' : 'false');
NODE
}

live_snapshot_has_visible_identifier_rect() {
  local identifier="$1"
  local snapshot_path=""
  local matched="false"

  snapshot_path="$(mktemp "${RUN_DIR}/live-snapshot.XXXXXX.json")"
  if ! agent_device_session snapshot -i -c --json > "${snapshot_path}" 2>/dev/null; then
    rm -f "${snapshot_path}"
    return 1
  fi

  matched="$(snapshot_has_visible_identifier_rect "${snapshot_path}" "${identifier}")"
  rm -f "${snapshot_path}"
  [[ "${matched}" == "true" ]]
}

step_artifact_has_identifier() {
  local step_name="$1"
  local identifier="$2"
  local interactive_snapshot_path="${RUN_DIR}/steps/${step_name}/snapshot-interactive.json"
  local snapshot_path="${RUN_DIR}/steps/${step_name}/snapshot.json"

  if [[ -f "${interactive_snapshot_path}" ]] && [[ "$(snapshot_has_identifier "${interactive_snapshot_path}" "${identifier}")" == "true" ]]; then
    return 0
  fi

  if [[ -f "${snapshot_path}" ]] && [[ "$(snapshot_has_identifier "${snapshot_path}" "${identifier}")" == "true" ]]; then
    return 0
  fi

  return 1
}

assert_step_artifact_has_identifier() {
  local step_name="$1"
  local identifier="$2"

  if step_artifact_has_identifier "${step_name}" "${identifier}"; then
    return 0
  fi

  echo "${step_name} 未观察到 ${identifier}。" >&2
  return 1
}

snapshot_has_text_matching() {
  local snapshot_path="$1"
  local pattern="$2"

  node - "${snapshot_path}" "${pattern}" <<'NODE'
const fs = require('node:fs');

const snapshotPath = process.argv[2];
const pattern = process.argv[3];
const regex = new RegExp(pattern, 'i');
const payload = JSON.parse(fs.readFileSync(snapshotPath, 'utf8') || '{}');
const nodes = Array.isArray(payload?.data?.nodes) ? payload.data.nodes : [];

const found = nodes.some((node) => {
  const texts = [node?.value, node?.label]
    .filter((value) => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean);
  return texts.some((value) => regex.test(value));
});

process.stdout.write(found ? 'true' : 'false');
NODE
}

step_artifact_has_text_matching() {
  local step_name="$1"
  local pattern="$2"
  local interactive_snapshot_path="${RUN_DIR}/steps/${step_name}/snapshot-interactive.json"
  local snapshot_path="${RUN_DIR}/steps/${step_name}/snapshot.json"

  if [[ -f "${interactive_snapshot_path}" ]] \
    && [[ "$(snapshot_has_text_matching "${interactive_snapshot_path}" "${pattern}")" == "true" ]]; then
    return 0
  fi

  if [[ -f "${snapshot_path}" ]] \
    && [[ "$(snapshot_has_text_matching "${snapshot_path}" "${pattern}")" == "true" ]]; then
    return 0
  fi

  return 1
}

live_snapshot_has_text_matching() {
  local pattern="$1"
  local snapshot_path=""
  local matched="false"

  snapshot_path="$(mktemp "${RUN_DIR}/live-snapshot.XXXXXX.json")"
  if ! agent_device_session snapshot -i -c --json > "${snapshot_path}" 2>/dev/null; then
    rm -f "${snapshot_path}"
    return 1
  fi

  matched="$(snapshot_has_text_matching "${snapshot_path}" "${pattern}")"
  rm -f "${snapshot_path}"
  [[ "${matched}" == "true" ]]
}

press_identifier_via_interactive_ref() {
  local snapshot_path="$1"
  local identifier="$2"
  local ref=""

  ref="$(interactive_ref_for_identifier "${snapshot_path}" "${identifier}")"
  if [[ -z "${ref}" ]]; then
    return 1
  fi

  agent_device_session press "@${ref}"
}

press_identifier_from_step_artifact() {
  local step_name="$1"
  local identifier="$2"
  local interactive_snapshot_path="${RUN_DIR}/steps/${step_name}/snapshot-interactive.json"

  if [[ -f "${interactive_snapshot_path}" ]] \
    && press_identifier_via_interactive_ref "${interactive_snapshot_path}" "${identifier}" >/dev/null 2>&1; then
    return 0
  fi

  agent_device_session press "id=\"${identifier}\"" >/dev/null 2>&1
}

press_identifier_from_live_snapshot() {
  local identifier="$1"
  local snapshot_path=""

  snapshot_path="$(mktemp "${RUN_DIR}/live-snapshot.XXXXXX.json")"
  if ! agent_device_session snapshot -i -c --json > "${snapshot_path}" 2>/dev/null; then
    rm -f "${snapshot_path}"
    return 1
  fi

  if press_identifier_via_interactive_ref "${snapshot_path}" "${identifier}" >/dev/null 2>&1; then
    rm -f "${snapshot_path}"
    return 0
  fi

  rm -f "${snapshot_path}"
  return 1
}

press_identifier_with_fallbacks() {
  local identifier="$1"
  local step_name="${2:-}"

  if agent_device_session press "id=\"${identifier}\"" >/dev/null 2>&1; then
    return 0
  fi

  if [[ -n "${step_name}" ]]; then
    if tap_identifier_from_step_artifact "${step_name}" "${identifier}" >/dev/null 2>&1; then
      return 0
    fi
    if press_identifier_from_step_artifact "${step_name}" "${identifier}" >/dev/null 2>&1; then
      return 0
    fi
  fi

  if tap_identifier_from_live_snapshot "${identifier}" >/dev/null 2>&1; then
    return 0
  fi

  if press_identifier_from_live_snapshot "${identifier}" >/dev/null 2>&1; then
    return 0
  fi

  return 1
}

press_photo_grid_start_button_best_effort() {
  local step_name="${1:-}"
  local attempt=0

  for attempt in {1..3}; do
    ensure_app_foreground
    reattach_session_best_effort || true

    if press_identifier_with_fallbacks "photo-grid-start-scan-button" "${step_name}"; then
      return 0
    fi

    agent_device_session wait 700 >/dev/null 2>&1 || true
  done

  echo "多次尝试后仍无法触发 photo-grid-start-scan-button。" >&2
  return 1
}

close_detail_viewer_if_present() {
  if ! agent_device_session wait 'id="detail-close-button"' 1200 >/dev/null 2>&1; then
    return 1
  fi

  press_identifier_with_fallbacks "detail-close-button" >/dev/null 2>&1 \
    || agent_device_session press 'id="detail-close-button"' >/dev/null 2>&1 \
    || true
  agent_device_session wait 700 >/dev/null 2>&1 || true
  return 0
}

press_photos_tab_best_effort() {
  local step_name="${1:-}"
  local did_press=1

  agent_device_session wait 'id="tab-button-Photos"' 2000 >/dev/null 2>&1 || true

  if agent_device_session press 'id="tab-button-Photos"' >/dev/null 2>&1; then
    did_press=0
  fi

  agent_device_session wait 250 >/dev/null 2>&1 || true

  if [[ -n "${step_name}" ]] \
    && tap_identifier_from_step_artifact "${step_name}" "tab-button-Photos" >/dev/null 2>&1; then
    did_press=0
  fi

  if tap_identifier_from_live_snapshot "tab-button-Photos" >/dev/null 2>&1; then
    did_press=0
  fi

  if press_identifier_from_live_snapshot "tab-button-Photos" >/dev/null 2>&1; then
    did_press=0
  fi

  return "${did_press}"
}

interactive_center_for_identifier() {
  local snapshot_path="$1"
  local identifier="$2"

  node -e '
    const fs = require("node:fs");
    const [filePath, identifier] = process.argv.slice(1);

    try {
      const payload = JSON.parse(fs.readFileSync(filePath, "utf8"));
      const nodes = payload?.data?.nodes;
      if (!Array.isArray(nodes)) {
        process.exit(0);
      }

      const match = nodes.find((node) => node?.identifier === identifier && node?.rect);
      if (!match?.rect) {
        process.exit(0);
      }

      const centerX = Math.round(match.rect.x + (match.rect.width / 2));
      const centerY = Math.round(match.rect.y + (match.rect.height / 2));
      process.stdout.write(`${centerX} ${centerY}`);
    } catch {}
  ' "${snapshot_path}" "${identifier}"
}

tap_identifier_from_step_artifact() {
  local step_name="$1"
  local identifier="$2"
  local interactive_snapshot_path="${RUN_DIR}/steps/${step_name}/snapshot-interactive.json"
  local snapshot_path="${RUN_DIR}/steps/${step_name}/snapshot.json"
  local center=""
  local center_x=""
  local center_y=""

  if [[ -f "${interactive_snapshot_path}" ]]; then
    center="$(interactive_center_for_identifier "${interactive_snapshot_path}" "${identifier}")"
  fi

  if [[ -z "${center}" && -f "${snapshot_path}" ]]; then
    center="$(interactive_center_for_identifier "${snapshot_path}" "${identifier}")"
  fi

  if [[ -z "${center}" ]]; then
    return 1
  fi

  center_x="${center%% *}"
  center_y="${center##* }"
  adb -s "${SERIAL}" shell input tap "${center_x}" "${center_y}" >/dev/null
}

tap_identifier_from_live_snapshot() {
  local identifier="$1"
  local snapshot_path=""
  local center=""
  local center_x=""
  local center_y=""

  snapshot_path="$(mktemp "${RUN_DIR}/live-snapshot.XXXXXX.json")"
  if ! agent_device_session snapshot -i -c --json > "${snapshot_path}" 2>/dev/null; then
    rm -f "${snapshot_path}"
    return 1
  fi

  center="$(interactive_center_for_identifier "${snapshot_path}" "${identifier}")"
  rm -f "${snapshot_path}"

  if [[ -z "${center}" ]]; then
    return 1
  fi

  center_x="${center%% *}"
  center_y="${center##* }"
  adb -s "${SERIAL}" shell input tap "${center_x}" "${center_y}" >/dev/null
}

long_press_identifier_from_step_artifact() {
  local step_name="$1"
  local identifier="$2"
  local duration_ms="${3:-700}"
  local interactive_snapshot_path="${RUN_DIR}/steps/${step_name}/snapshot-interactive.json"
  local snapshot_path="${RUN_DIR}/steps/${step_name}/snapshot.json"
  local center=""
  local center_x=""
  local center_y=""

  if [[ -f "${interactive_snapshot_path}" ]]; then
    center="$(interactive_center_for_identifier "${interactive_snapshot_path}" "${identifier}")"
  fi

  if [[ -z "${center}" && -f "${snapshot_path}" ]]; then
    center="$(interactive_center_for_identifier "${snapshot_path}" "${identifier}")"
  fi

  if [[ -z "${center}" ]]; then
    return 1
  fi

  center_x="${center%% *}"
  center_y="${center##* }"
  adb -s "${SERIAL}" shell input swipe "${center_x}" "${center_y}" "${center_x}" "${center_y}" "${duration_ms}" >/dev/null
}

trigger_detail_action_from_step_artifact() {
  local step_name="$1"
  local identifier="$2"
  local allowed_external_package="${3:-}"
  local attempt=0
  local foreground_package=""

  for attempt in {1..3}; do
    agent_device_session wait 500 >/dev/null 2>&1 || true
    if ! tap_identifier_from_step_artifact "${step_name}" "${identifier}"; then
      if ! tap_identifier_from_live_snapshot "${identifier}"; then
        if ! press_identifier_from_live_snapshot "${identifier}"; then
          if ! press_identifier_from_step_artifact "${step_name}" "${identifier}"; then
            agent_device_session press "id=\"${identifier}\"" >/dev/null 2>&1 || true
          fi
        fi
      fi
    fi

    if step_artifact_has_identifier "${step_name}" "${identifier}" \
      && agent_device_session wait "id=\"${identifier}\"" 400 >/dev/null 2>&1; then
      if ! press_identifier_from_step_artifact "${step_name}" "${identifier}"; then
        agent_device_session press "id=\"${identifier}\"" >/dev/null 2>&1 || true
      fi
    fi

    foreground_package="$(current_foreground_package_via_adb)"
    if [[ -n "${allowed_external_package}" && "${foreground_package}" == "${allowed_external_package}" ]]; then
      return 0
    fi

    if [[ -n "${allowed_external_package}" ]]; then
      local external_attempt=0
      for external_attempt in {1..5}; do
        foreground_package="$(current_foreground_package_via_adb)"
        if [[ "${foreground_package}" == "${allowed_external_package}" ]]; then
          return 0
        fi
        if [[ "${foreground_package}" == "${APP_ID}" ]] \
          && ! agent_device_session wait "id=\"${identifier}\"" 400 >/dev/null 2>&1; then
          return 0
        fi
        sleep 1
      done
      return 1
    fi

    ensure_app_foreground
    agent_device_session wait 900 >/dev/null 2>&1 || true
    if ! agent_device_session wait "id=\"${identifier}\"" 900 >/dev/null 2>&1; then
      return 0
    fi
  done

  return 1
}

wait_for_recycle_detail_actions() {
  local source_step_name="$1"
  local detail_step_prefix="$2"
  local attempt_step_name=""
  local attempt=0

  for attempt in {1..3}; do
    ensure_app_foreground
    reattach_session_best_effort || true

    if agent_device_session wait 'id="detail-primary-action"' 3000 >/dev/null 2>&1 \
      && agent_device_session wait 'id="detail-hard-delete"' 3000 >/dev/null 2>&1; then
      return 0
    fi

    attempt_step_name="${detail_step_prefix}-attempt-${attempt}"
    capture_step_artifacts "${attempt_step_name}" || true

    if step_artifact_has_identifier "${attempt_step_name}" "detail-primary-action" \
      && step_artifact_has_identifier "${attempt_step_name}" "detail-hard-delete"; then
      return 0
    fi

    if step_artifact_has_identifier "${attempt_step_name}" "recycle-bin-item"; then
      trigger_detail_action_from_step_artifact "${attempt_step_name}" "recycle-bin-item" || true
      continue
    fi

    if [[ "${attempt}" -lt 3 ]]; then
      trigger_detail_action_from_step_artifact "${source_step_name}" "recycle-bin-item" || true
      agent_device_session wait 1000 >/dev/null 2>&1 || true
    fi
  done

  return 1
}

collect_runtime_artifacts() {
  agent_device_session snapshot --json > "${RUN_DIR}/snapshot.json"
  agent_device_session snapshot -i -c --json > "${RUN_DIR}/snapshot-interactive.json"
  if ! agent_device_session screenshot "${RUN_DIR}/current-screen.png" --overlay-refs; then
    adb -s "${SERIAL}" exec-out screencap -p > "${RUN_DIR}/current-screen.png" 2>/dev/null || true
  fi

  if ! agent_device_session perf --json > "${RUN_DIR}/perf.json"; then
    reattach_session_best_effort || true
    wait_for_session_ready >/dev/null 2>&1 || true
    if ! agent_device_session perf --json > "${RUN_DIR}/perf.json"; then
      cat <<'EOF' > "${RUN_DIR}/perf-warning.txt"
agent-device perf 采集失败；当前已保留 snapshot / screenshot / network 等基础证据。
若需排查 perf 丢失，请优先检查 session 生命周期和前后台切换。
EOF
    fi
  fi

  agent_device_session network dump 20 --include headers > "${RUN_DIR}/network.txt" || true
  copy_log_if_available
}

seed_recycle_bin_fixture() {
  local seed_log_path="${RUN_DIR}/recycle-seed.log"

  bash "${REPO_ROOT}/scripts/android/seed-emulator-recycle-bin.sh" --serial "${SERIAL}" "$@" > "${seed_log_path}" 2>&1
}

REACT_DEVTOOLS_CONNECTED=0

start_react_devtools_if_requested() {
  REACT_DEVTOOLS_CONNECTED=0
  if [[ "${ENABLE_REACT_DEVTOOLS}" -eq 1 ]]; then
    if agent_device_session react-devtools start \
      && agent_device_session react-devtools wait --connected; then
      REACT_DEVTOOLS_CONNECTED=1
      agent_device_session react-devtools status --json > "${RUN_DIR}/react-status.json"
      agent_device_session react-devtools get tree --depth 3 --json > "${RUN_DIR}/react-tree.json"
    else
      printf '%s\n' "react-devtools 未在采集窗口内连上，已降级为基础设备观测。" > "${RUN_DIR}/react-devtools-error.txt"
      agent_device_session react-devtools status --json > "${RUN_DIR}/react-status.json" 2>/dev/null || true
    fi
  fi
}

finish_react_devtools_if_connected() {
  if [[ "${ENABLE_REACT_DEVTOOLS}" -eq 1 && "${REACT_DEVTOOLS_CONNECTED}" -eq 1 ]]; then
    agent_device_session react-devtools errors --json > "${RUN_DIR}/react-errors.json" || true
  fi
}

cleanup_capture() {
  agent_device_session settings animations on >/dev/null 2>&1 || true
  agent_device_session react-devtools stop >/dev/null 2>&1 || true
  agent_device_session close >/dev/null 2>&1 || true
}

current_android_user_id() {
  adb -s "${SERIAL}" shell am get-current-user 2>/dev/null | tr -d '\r' | awk 'NF { print $1; exit }'
}

is_app_installed_for_user() {
  local user_id="$1"
  adb -s "${SERIAL}" shell pm list packages --user "${user_id}" "${APP_ID}" 2>/dev/null | grep -q "package:${APP_ID}"
}

is_app_installed() {
  local user_id=""
  user_id="$(current_android_user_id)"

  if [[ -z "${user_id}" ]]; then
    return 1
  fi

  is_app_installed_for_user "${user_id}"
}

ensure_app_installed_for_current_user() {
  local user_id=""
  user_id="$(current_android_user_id)"

  if [[ -z "${user_id}" ]]; then
    echo "无法识别当前 Android 用户，无法确认 ${APP_ID} 是否可见。" >&2
    return 1
  fi

  if is_app_installed_for_user "${user_id}"; then
    return 0
  fi

  if adb -s "${SERIAL}" shell pm install-existing --user "${user_id}" "${APP_ID}" >/dev/null 2>&1; then
    if is_app_installed_for_user "${user_id}"; then
      echo "已将 ${APP_ID} 补装到当前 Android 用户 ${user_id}。" >&2
      return 0
    fi
  fi

  echo "APK 安装完成后，当前 Android 用户 ${user_id} 仍不可见: ${APP_ID}" >&2
  return 1
}

install_debug_apk() {
  if [[ ! -f "${APK_PATH}" ]]; then
    echo "未找到 debug APK: ${APK_PATH}" >&2
    echo "请先执行 npm run build:android:debug，或通过 --apk-path 指定现有 APK。" >&2
    exit 1
  fi

  agent_device_target install "${APP_ID}" "${APK_PATH}"
  ensure_app_installed_for_current_user
}

reset_app_state() {
  local user_id=""

  user_id="$(current_android_user_id)"
  if ! is_app_installed; then
    return 0
  fi

  adb -s "${SERIAL}" shell am force-stop --user "${user_id}" "${APP_ID}" >/dev/null 2>&1 || true
  adb -s "${SERIAL}" shell pm clear --user "${user_id}" "${APP_ID}" >/dev/null
  adb -s "${SERIAL}" shell pm revoke --user "${user_id}" "${APP_ID}" android.permission.POST_NOTIFICATIONS >/dev/null 2>&1 || true
  adb -s "${SERIAL}" shell pm revoke --user "${user_id}" "${APP_ID}" android.permission.READ_MEDIA_IMAGES >/dev/null 2>&1 || true
  adb -s "${SERIAL}" shell pm revoke --user "${user_id}" "${APP_ID}" android.permission.READ_MEDIA_VIDEO >/dev/null 2>&1 || true
  adb -s "${SERIAL}" shell pm revoke --user "${user_id}" "${APP_ID}" android.permission.READ_EXTERNAL_STORAGE >/dev/null 2>&1 || true
  adb -s "${SERIAL}" shell pm revoke --user "${user_id}" "${APP_ID}" android.permission.WRITE_EXTERNAL_STORAGE >/dev/null 2>&1 || true
}

press_allowing_external_prompt() {
  local target="$1"
  local foreground_package=""

  if agent_device_session press "${target}" >/dev/null 2>&1; then
    return 0
  fi

  foreground_package="$(current_foreground_package_via_adb)"
  case "${foreground_package}" in
    com.google.android.permissioncontroller|com.lbe.security.miui)
      return 0
      ;;
  esac

  return 0
}

press_system_allow() {
  if press_identifier_with_fallbacks "com.lbe.security.miui:id/permission_allow_foreground_only_button" >/dev/null 2>&1; then
    return 0
  fi

  if agent_device_session press 'id="com.lbe.security.miui:id/permission_allow_foreground_only_button"' >/dev/null 2>&1; then
    return 0
  fi

  if press_identifier_with_fallbacks "com.lbe.security.miui:id/permission_allow_button" >/dev/null 2>&1; then
    return 0
  fi

  if agent_device_session press 'id="com.lbe.security.miui:id/permission_allow_button"' >/dev/null 2>&1; then
    return 0
  fi

  if agent_device_session press 'text="仅在使用中允许"' >/dev/null 2>&1; then
    return 0
  fi

  if agent_device_session press 'text="始终允许"' >/dev/null 2>&1; then
    return 0
  fi

  if press_identifier_with_fallbacks "com.android.permissioncontroller:id/permission_allow_foreground_only_button" >/dev/null 2>&1; then
    return 0
  fi

  if agent_device_session press 'id="com.android.permissioncontroller:id/permission_allow_foreground_only_button"' >/dev/null 2>&1; then
    return 0
  fi

  if press_identifier_with_fallbacks "com.android.permissioncontroller:id/permission_allow_button" >/dev/null 2>&1; then
    return 0
  fi

  if agent_device_session press 'id="com.android.permissioncontroller:id/permission_allow_button"' >/dev/null 2>&1; then
    return 0
  fi

  if press_identifier_with_fallbacks "android:id/button1" >/dev/null 2>&1; then
    return 0
  fi

  if agent_device_session press 'id="android:id/button1"' >/dev/null 2>&1; then
    return 0
  fi

  if agent_device_session press 'text="Allow"' >/dev/null 2>&1; then
    return 0
  fi

  if agent_device_session press 'label="Allow"' >/dev/null 2>&1; then
    return 0
  fi

  if tap_system_dialog_button_via_dump "allow"; then
    return 0
  fi

  if tap_permission_dialog_button_by_ratio "allow"; then
    return 0
  fi

  echo "未命中系统 Allow 按钮。" >&2
  return 1
}

wait_for_media_permission_dialog() {
  if agent_device_session wait text "Allow MediaClean to access photos and videos on this device?" 3000 >/dev/null 2>&1; then
    return 0
  fi

  if agent_device_session wait 'id="com.lbe.security.miui:id/permission_allow_foreground_only_button"' 3000 >/dev/null 2>&1; then
    return 0
  fi

  if agent_device_session wait 'id="com.lbe.security.miui:id/permission_allow_button"' 3000 >/dev/null 2>&1; then
    return 0
  fi

  if agent_device_session wait text "读写设备上的照片及文件" 3000 >/dev/null 2>&1; then
    return 0
  fi

  if agent_device_session wait 'id="com.android.permissioncontroller:id/permission_allow_button"' 3000 >/dev/null 2>&1; then
    return 0
  fi

  if [[ "$(current_foreground_package_via_adb)" =~ ^(com\.google\.android\.permissioncontroller|com\.lbe\.security\.miui)$ ]] \
    && agent_device_session wait 'id="android:id/button1"' 3000 >/dev/null 2>&1; then
    return 0
  fi

  return 1
}

wait_for_notification_permission_dialog() {
  if agent_device_session wait text "Allow MediaClean to send you notifications?" 3000 >/dev/null 2>&1; then
    return 0
  fi

  if agent_device_session wait 'id="com.lbe.security.miui:id/permission_allow_foreground_only_button"' 3000 >/dev/null 2>&1; then
    return 0
  fi

  if agent_device_session wait 'id="com.lbe.security.miui:id/permission_allow_button"' 3000 >/dev/null 2>&1; then
    return 0
  fi

  if agent_device_session wait 'id="com.android.permissioncontroller:id/permission_allow_button"' 3000 >/dev/null 2>&1; then
    return 0
  fi

  if [[ "$(current_foreground_package_via_adb)" =~ ^(com\.google\.android\.permissioncontroller|com\.lbe\.security\.miui)$ ]] \
    && agent_device_session wait 'id="android:id/button1"' 3000 >/dev/null 2>&1; then
    return 0
  fi

  return 1
}

press_system_deny() {
  if press_identifier_with_fallbacks "com.lbe.security.miui:id/permission_deny_button" >/dev/null 2>&1; then
    return 0
  fi

  if agent_device_session press 'id="com.lbe.security.miui:id/permission_deny_button"' >/dev/null 2>&1; then
    return 0
  fi

  if agent_device_session press 'text="拒绝"' >/dev/null 2>&1; then
    return 0
  fi

  if press_identifier_with_fallbacks "com.android.permissioncontroller:id/permission_deny_button" >/dev/null 2>&1; then
    return 0
  fi

  if agent_device_session press 'id="com.android.permissioncontroller:id/permission_deny_button"' >/dev/null 2>&1; then
    return 0
  fi

  if press_identifier_with_fallbacks "android:id/button2" >/dev/null 2>&1; then
    return 0
  fi

  if agent_device_session press 'id="android:id/button2"' >/dev/null 2>&1; then
    return 0
  fi

  if agent_device_session press 'text="Don’t allow"' >/dev/null 2>&1; then
    return 0
  fi

  if agent_device_session press "text=\"Don't allow\"" >/dev/null 2>&1; then
    return 0
  fi

  if agent_device_session press 'text="Deny"' >/dev/null 2>&1; then
    return 0
  fi

  if agent_device_session press 'label="Deny"' >/dev/null 2>&1; then
    return 0
  fi

  if tap_system_dialog_button_via_dump "deny"; then
    return 0
  fi

  if tap_permission_dialog_button_by_ratio "deny"; then
    return 0
  fi

  echo "未命中系统 Deny 按钮。" >&2
  return 1
}

capture_external_ui_artifacts() {
  local step_name="$1"
  local step_dir="${RUN_DIR}/steps/${step_name}"

  mkdir -p "${step_dir}"
  adb -s "${SERIAL}" exec-out screencap -p > "${step_dir}/screen.png" 2>/dev/null || true
  adb -s "${SERIAL}" exec-out uiautomator dump /dev/tty | tr -d '\r' > "${step_dir}/ui.xml" 2>/dev/null || true
}

tap_system_dialog_button_via_dump() {
  local mode="$1"
  local dump_path=""
  local center=""
  local center_x=""
  local center_y=""

  dump_path="$(mktemp)"
  adb -s "${SERIAL}" exec-out uiautomator dump /dev/tty | tr -d '\r' > "${dump_path}" 2>/dev/null || true

  center="$(python3 - "${dump_path}" "${mode}" <<'PY'
import sys
import re
import xml.etree.ElementTree as ET

dump_path = sys.argv[1]
mode = sys.argv[2]

try:
    raw = open(dump_path, 'r', encoding='utf-8', errors='ignore').read()
    end = raw.find('</hierarchy>')
    if end == -1:
        print("")
        raise SystemExit(0)
    raw = raw[: end + len('</hierarchy>')]
    root = ET.fromstring(raw)
except Exception:
    print("")
    raise SystemExit(0)

if mode == "allow":
    identifiers = {
        "com.lbe.security.miui:id/permission_allow_foreground_only_button",
        "com.lbe.security.miui:id/permission_allow_button",
        "com.android.permissioncontroller:id/permission_allow_foreground_only_button",
        "com.android.permissioncontroller:id/permission_allow_button",
        "android:id/button1",
    }
    texts = {
        "Allow",
        "允许",
        "始终允许",
        "仅在使用中允许",
    }
else:
    identifiers = {
        "com.lbe.security.miui:id/permission_deny_button",
        "com.android.permissioncontroller:id/permission_deny_button",
        "android:id/button2",
    }
    texts = {
        "Deny",
        "拒绝",
        "Don’t allow",
        "Don't allow",
    }

for node in root.iter("node"):
    resource_id = node.attrib.get("resource-id", "")
    text = node.attrib.get("text", "")
    content_desc = node.attrib.get("content-desc", "")
    if resource_id not in identifiers and text not in texts and content_desc not in texts:
        continue

    bounds = node.attrib.get("bounds", "")
    match = re.match(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]', bounds)
    if not match:
        continue

    x1, y1, x2, y2 = map(int, match.groups())
    center_x = (x1 + x2) // 2
    center_y = (y1 + y2) // 2
    print(f"{center_x} {center_y}")
    raise SystemExit(0)

print("")
PY
)"

  rm -f "${dump_path}"

  if [[ -z "${center}" ]]; then
    return 1
  fi

  center_x="${center%% *}"
  center_y="${center##* }"
  adb -s "${SERIAL}" shell input tap "${center_x}" "${center_y}" >/dev/null
}

tap_permission_dialog_button_by_ratio() {
  local mode="$1"
  local foreground_package=""
  local size=""
  local width=""
  local height=""
  local center_x=""
  local center_y=""

  foreground_package="$(current_foreground_package_via_adb)"
  case "${foreground_package}" in
    com.google.android.permissioncontroller|com.lbe.security.miui)
      ;;
    *)
      return 1
      ;;
  esac

  size="$(adb -s "${SERIAL}" shell wm size 2>/dev/null | tr -d '\r' | awk '/Physical size:/ {print $3; exit}')"
  if [[ -z "${size}" || "${size}" != *x* ]]; then
    return 1
  fi

  width="${size%x*}"
  height="${size#*x}"
  if [[ -z "${width}" || -z "${height}" ]]; then
    return 1
  fi

  center_x="$((width / 2))"
  case "${mode}" in
    allow)
      center_y="$((height * 68 / 100))"
      ;;
    deny)
      center_y="$((height * 76 / 100))"
      ;;
    *)
      return 1
      ;;
  esac

  adb -s "${SERIAL}" shell input tap "${center_x}" "${center_y}" >/dev/null 2>&1 || return 1
  return 0
}

press_external_media_delete_allow_if_present() {
  local dump_path=""
  local center=""
  local center_x=""
  local center_y=""

  dump_path="$(mktemp)"
  adb -s "${SERIAL}" exec-out uiautomator dump /dev/tty | tr -d '\r' > "${dump_path}" 2>/dev/null || true

  center="$(python3 - "${dump_path}" <<'PY'
import re
import sys
import xml.etree.ElementTree as ET

dump_path = sys.argv[1]
try:
    raw = open(dump_path, 'r', encoding='utf-8', errors='ignore').read()
    end = raw.find('</hierarchy>')
    if end == -1:
        raise SystemExit(0)
    raw = raw[: end + len('</hierarchy>')]
    root = ET.fromstring(raw)
except Exception:
    sys.exit(0)

for node in root.iter('node'):
    package = node.attrib.get('package', '')
    resource_id = node.attrib.get('resource-id', '')
    text = node.attrib.get('text', '')
    if package != 'com.google.android.providers.media.module':
        continue
    if resource_id != 'android:id/button1' and text != 'Allow':
        continue
    bounds = node.attrib.get('bounds', '')
    match = re.match(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]', bounds)
    if not match:
        continue
    left, top, right, bottom = map(int, match.groups())
    print(f"{(left + right) // 2} {(top + bottom) // 2}")
    break
PY
)"

  rm -f "${dump_path}"

  if [[ -z "${center}" ]]; then
    return 1
  fi

  center_x="${center%% *}"
  center_y="${center##* }"
  adb -s "${SERIAL}" shell input tap "${center_x}" "${center_y}" >/dev/null 2>&1 || return 1
  return 0
}

handle_external_media_delete_confirmation_if_present() {
  local attempt=0
  local foreground_package=""

  for attempt in {1..5}; do
    foreground_package="$(current_foreground_package_via_adb)"
    if [[ "${foreground_package}" != "com.google.android.providers.media.module" ]]; then
      return 1
    fi

    capture_external_ui_artifacts "05-recycle-delete-confirmation"
    if press_external_media_delete_allow_if_present; then
      return 0
    fi
    sleep 1
  done

  return 1
}

handle_in_app_delete_confirmation_if_present() {
  local attempt=0
  local foreground_package=""

  for attempt in {1..5}; do
    foreground_package="$(current_foreground_package_via_adb)"
    if [[ "${foreground_package}" != "${APP_ID}" ]]; then
      return 1
    fi

    if ! agent_device_session wait 'id="android:id/button1"' 1500 >/dev/null 2>&1; then
      return 1
    fi

    capture_step_artifacts "05-recycle-delete-app-confirmation"
    if press_identifier_with_fallbacks "android:id/button1" >/dev/null 2>&1; then
      return 0
    fi
    if agent_device_session press 'id="android:id/button1"' >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done

  return 1
}

grant_media_permissions_best_effort() {
  agent_device_session settings permission grant photos >/dev/null 2>&1 || true
  adb -s "${SERIAL}" shell pm grant "${APP_ID}" android.permission.READ_MEDIA_IMAGES >/dev/null 2>&1 || true
  adb -s "${SERIAL}" shell pm grant "${APP_ID}" android.permission.READ_MEDIA_VIDEO >/dev/null 2>&1 || true
  adb -s "${SERIAL}" shell pm grant "${APP_ID}" android.permission.READ_EXTERNAL_STORAGE >/dev/null 2>&1 || true
  adb -s "${SERIAL}" shell pm grant "${APP_ID}" android.permission.WRITE_EXTERNAL_STORAGE >/dev/null 2>&1 || true
}

grant_notification_permissions_best_effort() {
  agent_device_session settings permission grant notifications >/dev/null 2>&1 || true
  adb -s "${SERIAL}" shell pm grant "${APP_ID}" android.permission.POST_NOTIFICATIONS >/dev/null 2>&1 || true
}

open_settings_screen() {
  local attempt=0

  agent_device_session wait 'id="tab-button-Settings"' 5000 >/dev/null

  for attempt in {1..3}; do
    press_identifier_with_fallbacks "tab-button-Settings" >/dev/null 2>&1 || true
    ensure_app_foreground

    if agent_device_session wait 'id="settings-scroll-view"' 2500 >/dev/null 2>&1; then
      return 0
    fi

    agent_device_session wait 700 >/dev/null 2>&1 || true
  done

  echo "多次尝试后仍未进入 Settings。" >&2
  return 1
}

scroll_settings_to_top() {
  local attempt=0

  for attempt in {1..4}; do
    ensure_app_foreground
    safe_vertical_scroll_up_via_adb >/dev/null 2>&1 || agent_device_session scroll up >/dev/null 2>&1 || true
  done

  agent_device_session wait 'id="settings-header"' 3000 >/dev/null 2>&1 || true
}

relaunch_app_to_photo_grid_after_permission_grant() {
  open_app_with_session "relaunch" >/dev/null 2>&1 || open_app_with_session "attach" >/dev/null 2>&1 || true
  wait_for_session_ready >/dev/null 2>&1 || true
  ensure_app_foreground
  reattach_session_best_effort || true
  agent_device_session wait 'id="tab-button-Settings"' 10000 >/dev/null 2>&1 || true
  open_photo_grid_screen_for_scan || true
}

ensure_settings_option_visible() {
  local option_id="$1"
  local attempt=0

  for attempt in {1..6}; do
    ensure_app_foreground
    if ! agent_device_session wait 'id="settings-scroll-view"' 2500 >/dev/null 2>&1; then
      open_settings_screen
    fi

    if agent_device_session wait "id=\"${option_id}\"" 1500 >/dev/null 2>&1 \
      && live_snapshot_has_visible_identifier_rect "${option_id}"; then
      return 0
    fi

    safe_vertical_scroll_down_via_adb >/dev/null 2>&1 || agent_device_session scroll down >/dev/null 2>&1 || true
    if agent_device_session wait "id=\"${option_id}\"" 2000 >/dev/null 2>&1 \
      && live_snapshot_has_visible_identifier_rect "${option_id}"; then
      return 0
    fi

    agent_device_session wait 700 >/dev/null 2>&1 || true
  done

  echo "多次尝试后仍未命中 Settings 选项: ${option_id}" >&2
  return 1
}

ensure_smoke_settings_controls_ready() {
  ensure_settings_option_visible "theme-option-dark"
  ensure_settings_option_visible "theme-option-light"
  ensure_settings_option_visible "language-option-zh-CN"
  ensure_settings_option_visible "language-option-en-US"
}

open_recycle_bin_screen() {
  local attempt=0

  agent_device_session wait 'id="tab-button-RecycleBin"' 5000 >/dev/null 2>&1 || true

  for attempt in {1..5}; do
    press_identifier_with_fallbacks "tab-button-RecycleBin" >/dev/null 2>&1 \
      || agent_device_session press 'label="tab-button-RecycleBin"' >/dev/null 2>&1 \
      || true
    ensure_app_foreground

    if agent_device_session wait 'id="recycle-bin-header-title"' 2500 >/dev/null 2>&1 \
      || agent_device_session wait 'id="recycle-bin-item"' 1200 >/dev/null 2>&1 \
      || agent_device_session wait 'id="recycle-bin-grid"' 1200 >/dev/null 2>&1 \
      || agent_device_session wait 'id="recycle-bin-loading-label"' 1200 >/dev/null 2>&1 \
      || agent_device_session wait 'id="recycle-bin-empty-title"' 1200 >/dev/null 2>&1; then
      return 0
    fi

    agent_device_session wait 700 >/dev/null 2>&1 || true
  done

  echo "多次尝试后仍未进入 Recycle Bin。" >&2
  return 1
}

wait_for_recycle_bin_population_after_cleanup() {
  local attempt=0

  for attempt in {1..6}; do
    open_recycle_bin_screen

    if agent_device_session wait 'id="recycle-bin-item"' 2500 >/dev/null 2>&1; then
      return 0
    fi

    if agent_device_session wait 'id="recycle-bin-empty-title"' 1000 >/dev/null 2>&1; then
      press_photos_tab_best_effort || true
      ensure_app_foreground
    fi

    agent_device_session wait 1200 >/dev/null 2>&1 || true
  done

  return 1
}

select_language_option() {
  local option_id="$1"
  local expected_text_pattern="$2"
  local expected_marker_pattern="${3:-$2}"
  local attempt=0
  local step_name=""

  for attempt in {1..3}; do
    ensure_app_foreground

    if ! agent_device_session wait 'id="settings-scroll-view"' 2500 >/dev/null 2>&1; then
      open_settings_screen
    fi

    ensure_settings_option_visible "${option_id}"
    step_name="$(printf 'language-switch-attempt-%02d' "${attempt}")"
    capture_step_artifacts "${step_name}"

    trigger_detail_action_from_step_artifact "${step_name}" "${option_id}" >/dev/null 2>&1 || true
    press_identifier_with_fallbacks "${option_id}" "${step_name}" >/dev/null 2>&1 || true
    agent_device_session wait 1200 >/dev/null 2>&1 || true

    if live_snapshot_has_text_matching "${expected_text_pattern}"; then
      return 0
    fi

    if live_snapshot_has_text_matching "${expected_marker_pattern}"; then
      return 0
    fi

    open_app_with_session "relaunch" >/dev/null 2>&1 || true
    wait_for_session_ready >/dev/null 2>&1 || true
    ensure_app_foreground
    reattach_session_best_effort || true
    open_settings_screen || true
    agent_device_session wait 700 >/dev/null 2>&1 || true
  done

  echo "多次尝试后仍未切换到语言，未观察到预期文本模式: ${expected_text_pattern} / ${expected_marker_pattern}" >&2
  return 1
}

open_issue_workspace_from_result_summary() {
  local step_name="$1"
  local identifier=""
  local interactive_snapshot_path="${RUN_DIR}/steps/${step_name}/snapshot-interactive.json"
  local snapshot_path="${RUN_DIR}/steps/${step_name}/snapshot.json"
  local source_snapshot_path=""
  local identifiers_raw=""
  local -a identifiers=()

  if [[ -f "${interactive_snapshot_path}" ]]; then
    source_snapshot_path="${interactive_snapshot_path}"
  elif [[ -f "${snapshot_path}" ]]; then
    source_snapshot_path="${snapshot_path}"
  fi

  if [[ -n "${source_snapshot_path}" ]]; then
    identifiers_raw="$(node - "${source_snapshot_path}" <<'NODE'
const fs = require('node:fs');

const snapshotPath = process.argv[2];
const payload = JSON.parse(fs.readFileSync(snapshotPath, 'utf8') || '{}');
const nodes = Array.isArray(payload?.data?.nodes) ? payload.data.nodes : [];

const identifiers = nodes
  .filter((node) => typeof node?.identifier === 'string' && /^photo-grid-result-breakdown-/.test(node.identifier))
  .map((node) => ({ identifier: node.identifier, y: Number(node?.rect?.y ?? 0) }))
  .sort((left, right) => left.y - right.y)
  .map((entry) => entry.identifier);

process.stdout.write(identifiers.join('\n'));
NODE
)"
  fi

  if [[ -n "${identifiers_raw}" ]]; then
    while IFS= read -r identifier; do
      [[ -n "${identifier}" ]] && identifiers+=("${identifier}")
    done <<< "${identifiers_raw}"
  fi

  if [[ "${#identifiers[@]}" -eq 0 ]]; then
    identifiers=(
      "photo-grid-result-breakdown-duplicate"
      "photo-grid-result-breakdown-blurry"
      "photo-grid-result-breakdown-similar"
    )
  fi

  for identifier in "${identifiers[@]}"; do
    if ! step_artifact_has_identifier "${step_name}" "${identifier}"; then
      continue
    fi

    if trigger_detail_action_from_step_artifact "${step_name}" "${identifier}" \
      && agent_device_session wait 'id="scan-result-grid-item"' 2500 >/dev/null 2>&1; then
      return 0
    fi

    if press_identifier_with_fallbacks "${identifier}" "${step_name}" >/dev/null 2>&1; then
      agent_device_session wait 1000 >/dev/null 2>&1 || true
      if agent_device_session wait 'id="scan-result-grid-item"' 2500 >/dev/null 2>&1; then
        return 0
      fi
    fi
  done

  return 1
}

wait_for_scan_entry_readiness() {
  local timeout_ms="${1:-10000}"

  if agent_device_session wait 'id="photo-grid-request-permission-button"' "${timeout_ms}" >/dev/null 2>&1; then
    printf '%s\n' "permission-required"
    return 0
  fi

  if agent_device_session wait 'id="photo-grid-start-scan-button"' "${timeout_ms}" >/dev/null 2>&1; then
    printf '%s\n' "scan-ready"
    return 0
  fi

  return 1
}

maybe_advance_past_landing_if_present() {
  local ready_step_name="$1"
  local cta_step_name="$2"

  if agent_device_session wait 'id="landing-primary-action"' 3000 >/dev/null 2>&1; then
    capture_step_artifacts "${ready_step_name}"
    if tap_identifier_from_step_artifact "${ready_step_name}" "landing-primary-action"; then
      if agent_device_session wait 'id="tab-button-Settings"' 5000 >/dev/null 2>&1; then
        return 0
      fi
    fi

    scroll_landing_to_primary_action || true
    capture_step_artifacts "${cta_step_name}"
    if ! tap_identifier_from_step_artifact "${cta_step_name}" "landing-primary-action"; then
      agent_device_session press 'id="landing-primary-action"' >/dev/null 2>&1 || true
    fi
    if ! agent_device_session wait 'id="tab-button-Settings"' 10000 >/dev/null 2>&1; then
      ensure_app_foreground
      reattach_session_best_effort || true
      if agent_device_session wait 'id="landing-primary-action"' 2000 >/dev/null 2>&1; then
        capture_step_artifacts "${cta_step_name}"
        if ! tap_identifier_from_step_artifact "${cta_step_name}" "landing-primary-action"; then
          agent_device_session press 'id="landing-primary-action"'
        fi
      fi
      agent_device_session wait 'id="tab-button-Settings"' 10000
    fi
    return 0
  fi

  return 1
}

ensure_media_permission_ready_for_scan() {
  local before_step_name="$1"
  local dialog_step_name="$2"
  local post_permission_scan_entry_state=""

  if agent_device_session wait 'id="photo-grid-request-permission-button"' 5000 >/dev/null 2>&1; then
    capture_step_artifacts "${before_step_name}"
    press_allowing_external_prompt 'id="photo-grid-request-permission-button"'
    if wait_for_media_permission_dialog; then
      capture_step_artifacts "${dialog_step_name}"
      if ! press_system_allow; then
        grant_media_permissions_best_effort
      fi
      ensure_app_foreground
      reattach_session_best_effort || true
      agent_device_session wait 'id="tab-button-Settings"' 10000 || true
    else
      grant_media_permissions_best_effort
      ensure_app_foreground
      reattach_session_best_effort || true
      agent_device_session wait 'id="tab-button-Settings"' 10000 || true
    fi

    post_permission_scan_entry_state="$(wait_for_scan_entry_readiness 5000 || true)"
    if [[ -z "${post_permission_scan_entry_state}" ]]; then
      if wait_for_media_permission_dialog; then
        press_system_allow || grant_media_permissions_best_effort
      fi
      ensure_app_foreground
      reattach_session_best_effort || true
      open_photo_grid_screen_for_scan || true
      post_permission_scan_entry_state="$(wait_for_scan_entry_readiness 10000 || true)"
    fi

    if [[ "${post_permission_scan_entry_state}" == "permission-required" ]]; then
      grant_media_permissions_best_effort
      relaunch_app_to_photo_grid_after_permission_grant
      post_permission_scan_entry_state="$(wait_for_scan_entry_readiness 10000 || true)"
    fi
  fi
}

scan_probe_summary_json() {
  local snapshot_path="$1"

  node - "${snapshot_path}" <<'NODE'
const fs = require('node:fs');

const snapshotPath = process.argv[2];
const payload = JSON.parse(fs.readFileSync(snapshotPath, 'utf8') || '{}');
const nodes = Array.isArray(payload?.data?.nodes) ? payload.data.nodes : [];
const byId = new Map();
const textValues = [];

for (const node of nodes) {
  if (node && typeof node.identifier === 'string' && node.identifier.length > 0) {
    byId.set(node.identifier, node);
  }

  const rawText = node?.value || node?.label || null;
  if (typeof rawText === 'string') {
    const normalizedText = rawText.trim();
    if (normalizedText.length > 0) {
      textValues.push(normalizedText);
    }
  }
}

const readDisplayValue = (identifier) => {
  const node = byId.get(identifier);
  if (!node) {
    return null;
  }
  return node.value || node.label || null;
};

const findTextValue = (pattern) =>
  textValues.find((value) => pattern.test(value)) ?? null;

const startButtonLabel =
  readDisplayValue('photo-grid-start-scan-button')
  || findTextValue(
    /^(开始扫描|继续扫描|重新扫描|Start scan|Continue scan|Rescan)$/i,
  );
const runningStatusText = findTextValue(/^(扫描中|扫描中\.\.\.|Scanning)$/i);
const runningProgressText = findTextValue(/^\d+\s*\/\s*\d+$/);
const rangeLabel = findTextValue(/^(当前扫描批次：|已扫描范围：|结果范围：|本批范围：|Current batch: |Scanned range: |Result range: |Batch range: )/);
const segmentedCountAll =
  readDisplayValue('segmented-count-all') || findTextValue(/^(全部|All)\s+\d+/);
const segmentedCountPhoto =
  readDisplayValue('segmented-count-photo') || findTextValue(/^(照片|Photos)\s+\d+/);
const segmentedCountVideo =
  readDisplayValue('segmented-count-video') || findTextValue(/^(视频|Videos)\s+\d+/);

let outcome = 'pending';
if (
  byId.has('photo-grid-scan-all-complete-title')
  || findTextValue(/^(全部媒体已扫描完成|Entire library scanned)$/)
) {
  outcome = 'all-complete';
} else if (
  byId.has('photo-grid-scan-exhausted-title')
  || findTextValue(/^(当前这一批已处理完成|Current batch processed)$/)
) {
  outcome = 'exhausted';
} else if (
  typeof startButtonLabel === 'string' &&
  /继续扫描|Continue scan/i.test(startButtonLabel)
) {
  outcome = 'exhausted';
} else if (byId.has('cancel-scan-button') || runningStatusText || runningProgressText) {
  outcome = 'running';
} else if (
  byId.has('scan-result-grid-item')
  || byId.has('photo-grid-scan-summary')
  || findTextValue(/^(扫描完成，发现异常结果|Scan complete, flagged results found)$/)
) {
  outcome = 'result-ready';
} else if (
  typeof startButtonLabel === 'string' &&
  /重新扫描|Rescan|Scan again/i.test(startButtonLabel)
) {
  outcome = 'result-ready';
}

process.stdout.write(JSON.stringify({
  outcome,
  hasStartButton: byId.has('photo-grid-start-scan-button'),
  startButtonLabel,
  hasResultItem: byId.has('scan-result-grid-item'),
  hasPermissionButton: byId.has('photo-grid-request-permission-button'),
  hasCancelButton: byId.has('cancel-scan-button'),
  hasRunningText: Boolean(runningStatusText || runningProgressText),
  rangeLabel,
  counts: {
    all: segmentedCountAll,
    photo: segmentedCountPhoto,
    video: segmentedCountVideo,
  },
}, null, 2));
NODE
}

scan_probe_outcome_value() {
  local summary_json="$1"

  printf '%s' "${summary_json}" | node -e '
    let input = "";
    process.stdin.on("data", (chunk) => input += chunk);
    process.stdin.on("end", () => {
      const payload = JSON.parse(input || "{}");
      process.stdout.write(payload?.outcome || "pending");
    });
  '
}

scan_probe_range_label_value() {
  local summary_json="$1"

  printf '%s' "${summary_json}" | node -e '
    let input = "";
    process.stdin.on("data", (chunk) => input += chunk);
    process.stdin.on("end", () => {
      const payload = JSON.parse(input || "{}");
      process.stdout.write(payload?.rangeLabel || "");
    });
  '
}

scan_probe_start_button_label_value() {
  local summary_json="$1"

  printf '%s' "${summary_json}" | node -e '
    let input = "";
    process.stdin.on("data", (chunk) => input += chunk);
    process.stdin.on("end", () => {
      const payload = JSON.parse(input || "{}");
      process.stdout.write(payload?.startButtonLabel || "");
    });
  '
}

scan_probe_total_count_value() {
  local summary_json="$1"

  printf '%s' "${summary_json}" | node -e '
    let input = "";
    process.stdin.on("data", (chunk) => input += chunk);
    process.stdin.on("end", () => {
      const payload = JSON.parse(input || "{}");
      const raw = payload?.counts?.all;
      process.stdout.write(raw == null ? "" : String(raw));
    });
  '
}

scan_probe_has_start_button_value() {
  local summary_json="$1"

  printf '%s' "${summary_json}" | node -e '
    let input = "";
    process.stdin.on("data", (chunk) => input += chunk);
    process.stdin.on("end", () => {
      const payload = JSON.parse(input || "{}");
      process.stdout.write(payload?.hasStartButton ? "true" : "false");
    });
  '
}

scan_probe_has_permission_button_value() {
  local summary_json="$1"

  printf '%s' "${summary_json}" | node -e '
    let input = "";
    process.stdin.on("data", (chunk) => input += chunk);
    process.stdin.on("end", () => {
      const payload = JSON.parse(input || "{}");
      process.stdout.write(payload?.hasPermissionButton ? "true" : "false");
    });
  '
}

scan_probe_has_result_item_value() {
  local summary_json="$1"

  printf '%s' "${summary_json}" | node -e '
    let input = "";
    process.stdin.on("data", (chunk) => input += chunk);
    process.stdin.on("end", () => {
      const payload = JSON.parse(input || "{}");
      process.stdout.write(payload?.hasResultItem ? "true" : "false");
    });
  '
}

count_identifier_occurrences_in_snapshot() {
  local snapshot_path="$1"
  local identifier="$2"

  node - "${snapshot_path}" "${identifier}" <<'NODE'
const fs = require('node:fs');

const snapshotPath = process.argv[2];
const identifier = process.argv[3];
const payload = JSON.parse(fs.readFileSync(snapshotPath, 'utf8') || '{}');
const nodes = Array.isArray(payload?.data?.nodes) ? payload.data.nodes : [];
const count = nodes.filter((node) => node?.identifier === identifier).length;
process.stdout.write(String(count));
NODE
}

count_identifier_occurrences_from_step_artifact() {
  local step_name="$1"
  local identifier="$2"
  local interactive_snapshot_path="${RUN_DIR}/steps/${step_name}/snapshot-interactive.json"

  if [[ ! -f "${interactive_snapshot_path}" ]]; then
    echo "0"
    return 0
  fi

  count_identifier_occurrences_in_snapshot "${interactive_snapshot_path}" "${identifier}"
}

display_value_for_identifier_in_snapshot() {
  local snapshot_path="$1"
  local identifier="$2"

  node - "${snapshot_path}" "${identifier}" <<'NODE'
const fs = require('node:fs');

const snapshotPath = process.argv[2];
const identifier = process.argv[3];
const payload = JSON.parse(fs.readFileSync(snapshotPath, 'utf8') || '{}');
const nodes = Array.isArray(payload?.data?.nodes) ? payload.data.nodes : [];
const match = nodes.find((node) => node?.identifier === identifier);
if (!match) {
  process.exit(0);
}
process.stdout.write(String(match.value || match.label || ''));
NODE
}

display_value_for_identifier_from_step_artifact() {
  local step_name="$1"
  local identifier="$2"
  local interactive_snapshot_path="${RUN_DIR}/steps/${step_name}/snapshot-interactive.json"

  if [[ ! -f "${interactive_snapshot_path}" ]]; then
    return 0
  fi

  display_value_for_identifier_in_snapshot "${interactive_snapshot_path}" "${identifier}"
}

parse_selected_count_from_label() {
  local label="$1"

  printf '%s' "${label}" | node -e '
    let input = "";
    process.stdin.on("data", (chunk) => input += chunk);
    process.stdin.on("end", () => {
      const match = input.match(/\((\d+)\)\s*$/);
      process.stdout.write(match?.[1] ?? "");
    });
  '
}

is_continue_scan_button_label() {
  local label="$1"

  [[ "${label}" == *"继续扫描"* || "${label}" == *"Scan again"* ]]
}

write_continue_scan_transition_artifact() {
  local initial_summary_json="$1"
  local next_summary_json="$2"

  node -e '
    const fs = require("node:fs");
    const filePath = process.argv[1];
    const initialSummary = JSON.parse(process.argv[2] || "{}");
    const nextSummary = JSON.parse(process.argv[3] || "{}");
    const payload = {
      initial: initialSummary,
      next: nextSummary,
    };
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
  ' "${RUN_DIR}/continue-scan-transition.json" "${initial_summary_json}" "${next_summary_json}"
}

write_scan_probe_summary_artifact() {
  local step_name="$1"
  local summary_json="$2"
  local step_dir="${RUN_DIR}/steps/${step_name}"

  mkdir -p "${step_dir}"
  printf '%s\n' "${summary_json}" > "${step_dir}/scan-probe-state.json"
}

write_scan_probe_summary_root() {
  local summary_json="$1"

  printf '%s\n' "${summary_json}" > "${RUN_DIR}/scan-probe-state.json"
}

wait_for_seeded_result_item() {
  local step_name_prefix="${1:-seeded-result}"
  local max_attempts="${2:-8}"
  local attempt=0
  local snapshot_path=""
  local summary_json=""
  local has_result_item=""
  local has_result_summary=""

  for attempt in $(seq 1 "${max_attempts}"); do
    ensure_app_foreground
    maybe_advance_past_landing_if_present \
      "${step_name_prefix}-${attempt}-landing-ready" \
      "${step_name_prefix}-${attempt}-landing-cta" || true

    snapshot_path="${RUN_DIR}/${step_name_prefix}-${attempt}.json"
    if ! agent_device_session snapshot -i -c --json > "${snapshot_path}" 2>/dev/null; then
      sleep 1
      continue
    fi

    summary_json="$(scan_probe_summary_json "${snapshot_path}")"
    has_result_item="$(scan_probe_has_result_item_value "${summary_json}")"
    has_result_summary="$(snapshot_has_result_summary_surface "${snapshot_path}")"
    printf '%s\n' "${summary_json}" > "${snapshot_path%.json}.summary.json"

    if [[ "${has_result_item}" == "true" || "${has_result_summary}" == "true" ]]; then
      printf '%s\n' "${summary_json}" > "${RUN_DIR}/scan-probe-state.json"
      cp "${snapshot_path}" "${RUN_DIR}/scan-probe-latest.json"
      return 0
    fi

    sleep 1
  done

  return 1
}

capture_scan_persistence_snapshot() {
  local label="$1"
  local snapshot_dir="${RUN_DIR}/persistence/${label}"
  local operational_db_path="${snapshot_dir}/app-cleaner-operational.db"
  local rk_storage_path="${snapshot_dir}/RKStorage"
  local summary_path="${snapshot_dir}/summary.json"
  local operational_pull_error_path="${snapshot_dir}/operational-db.pull.err"
  local rk_pull_error_path="${snapshot_dir}/rkstorage.pull.err"

  mkdir -p "${snapshot_dir}"

  adb -s "${SERIAL}" exec-out run-as "${APP_ID}" cat "${APP_DATA_DIR}/files/SQLite/app-cleaner-operational.db" \
    > "${operational_db_path}" 2>"${operational_pull_error_path}" || true
  adb -s "${SERIAL}" exec-out run-as "${APP_ID}" cat "${APP_DATA_DIR}/databases/RKStorage" \
    > "${rk_storage_path}" 2>"${rk_pull_error_path}" || true

  python3 - "${operational_db_path}" "${rk_storage_path}" "${summary_path}" "${operational_pull_error_path}" "${rk_pull_error_path}" <<'PY'
import json
import os
import sqlite3
import sys
import time

operational_db_path, rk_storage_path, summary_path, operational_err_path, rk_err_path = sys.argv[1:6]

TRACKED_KEYS = (
    'app-cleaner/last-scan',
    'app-cleaner/last-valid-scan-baseline',
    'app-cleaner/photo-scan-result-cache',
    'app-cleaner/media-analysis-cache',
    'app-cleaner/persisted-media-ledger',
    'app-cleaner/photo-scan-session',
    'app-cleaner/recycle-bin-candidate-cache',
)


def file_summary(path: str):
    exists = os.path.exists(path)
    size = os.path.getsize(path) if exists else 0
    return {
        'path': path,
        'exists': bool(exists and size > 0),
        'sizeBytes': size,
    }


def read_error(path: str):
    if not os.path.exists(path):
        return None
    content = open(path, 'r', encoding='utf-8', errors='replace').read().strip()
    return content or None


def sqlite_count(connection, table_name: str):
    return int(connection.execute(f'SELECT COUNT(*) FROM {table_name}').fetchone()[0])


def load_sqlite_summary(path: str):
    output = {
        'counts': {
            'scanBatch': 0,
            'scanBatchItem': 0,
            'scanBaseline': 0,
            'assetManifest': 0,
            'candidateViewMeta': 0,
            'candidateView': 0,
            'recognitionGroup': 0,
            'recycleBinState': 0,
        },
        'latestBatch': None,
        'baseline': None,
        'errors': [],
    }

    if not os.path.exists(path) or os.path.getsize(path) == 0:
        return output

    connection = None
    try:
        connection = sqlite3.connect(f'file:{path}?mode=ro', uri=True)
        connection.row_factory = sqlite3.Row
        output['counts'] = {
            'scanBatch': sqlite_count(connection, 'scan_batch'),
            'scanBatchItem': sqlite_count(connection, 'scan_batch_item'),
            'scanBaseline': sqlite_count(connection, 'scan_baseline'),
            'assetManifest': sqlite_count(connection, 'asset_manifest'),
            'candidateViewMeta': sqlite_count(connection, 'candidate_view_meta'),
            'candidateView': sqlite_count(connection, 'candidate_view'),
            'recognitionGroup': sqlite_count(connection, 'recognition_group'),
            'recycleBinState': sqlite_count(connection, 'recycle_bin_state'),
        }
        latest_batch = connection.execute(
            '''
            SELECT
              batch_id AS batchId,
              mode,
              phase,
              progress_current AS progressCurrent,
              progress_total AS progressTotal,
              enumerated_count AS enumeratedCount,
              dirty_count AS dirtyCount,
              analyzed_count AS analyzedCount,
              candidate_count AS candidateCount,
              range_start_at AS rangeStartAt,
              range_end_at AS rangeEndAt,
              completed_at AS completedAt,
              updated_at AS updatedAt
            FROM scan_batch
            ORDER BY updated_at DESC
            LIMIT 1
            '''
        ).fetchone()
        if latest_batch is not None:
            output['latestBatch'] = dict(latest_batch)
        baseline = connection.execute(
            '''
            SELECT
              scanned_at AS scannedAt,
              scanned_count AS scannedCount,
              candidate_count AS candidateCount,
              scan_range_months AS scanRangeMonths,
              latest_eligible_asset_at AS latestEligibleAssetAt,
              ledger_updated_at AS ledgerUpdatedAt
            FROM scan_baseline
            WHERE id = 1
            '''
        ).fetchone()
        if baseline is not None:
            output['baseline'] = dict(baseline)
    except Exception as exc:
        output['errors'].append(str(exc))
    finally:
        if connection is not None:
            connection.close()

    return output


def load_async_storage_summary(path: str):
    output = {
        'keys': {},
        'errors': [],
    }

    if not os.path.exists(path) or os.path.getsize(path) == 0:
        for key in TRACKED_KEYS:
            output['keys'][key] = {'present': False, 'sizeBytes': 0}
        return output

    connection = None
    try:
        connection = sqlite3.connect(f'file:{path}?mode=ro', uri=True)
        connection.row_factory = sqlite3.Row
        placeholders = ','.join('?' for _ in TRACKED_KEYS)
        rows = connection.execute(
            f'SELECT key, value FROM catalystLocalStorage WHERE key IN ({placeholders})',
            TRACKED_KEYS,
        ).fetchall()
        values_by_key = {row['key']: row['value'] for row in rows}

        for key in TRACKED_KEYS:
          raw_value = values_by_key.get(key)
          if raw_value is None:
            output['keys'][key] = {'present': False, 'sizeBytes': 0}
            continue

          entry = {
              'present': len(raw_value) > 0,
              'sizeBytes': len(raw_value.encode('utf-8')),
          }

          if key == 'app-cleaner/photo-scan-session':
            try:
              payload = json.loads(raw_value)
              entry['phase'] = payload.get('phase')
              entry['scanResultsCount'] = payload.get('scanResultsCount')
              entry['hasCompletedFullScan'] = payload.get('hasCompletedFullScan')
              entry['summaryScannedCount'] = payload.get('summary', {}).get('scannedCount')
            except Exception:
              entry['parseError'] = True

          output['keys'][key] = entry
    except Exception as exc:
        output['errors'].append(str(exc))
        for key in TRACKED_KEYS:
            output['keys'].setdefault(key, {'present': False, 'sizeBytes': 0})
    finally:
        if connection is not None:
            connection.close()

    return output


sqlite_summary = load_sqlite_summary(operational_db_path)
async_storage_summary = load_async_storage_summary(rk_storage_path)

latest_batch = sqlite_summary['latestBatch'] or {}
counts = sqlite_summary['counts']
async_keys = async_storage_summary['keys']

has_completed_batch = (
    latest_batch.get('phase') == 'completed'
    and latest_batch.get('completedAt') is not None
)
has_result_cache = (
    counts['candidateViewMeta'] > 0
    or counts['candidateView'] > 0
    or async_keys['app-cleaner/photo-scan-result-cache']['present']
)
has_baseline = (
    counts['scanBaseline'] > 0
    or async_keys['app-cleaner/last-scan']['present']
    or async_keys['app-cleaner/last-valid-scan-baseline']['present']
)
has_ledger = (
    counts['assetManifest'] > 0
    or async_keys['app-cleaner/media-analysis-cache']['present']
    or async_keys['app-cleaner/persisted-media-ledger']['present']
)
has_recycle_state = (
    counts['recycleBinState'] > 0
    or async_keys['app-cleaner/recycle-bin-candidate-cache']['present']
)

payload = {
    'generatedAt': int(time.time() * 1000),
    'files': {
        'operationalDb': {
            **file_summary(operational_db_path),
            'pullError': read_error(operational_err_path),
        },
        'rkStorage': {
            **file_summary(rk_storage_path),
            'pullError': read_error(rk_err_path),
        },
    },
    'sqlite': sqlite_summary,
    'asyncStorage': async_storage_summary,
    'derived': {
        'hasCompletedBatch': has_completed_batch,
        'hasResultCache': has_result_cache,
        'hasBaseline': has_baseline,
        'hasLedger': has_ledger,
        'hasRecycleState': has_recycle_state,
        'hasStrongScanPersistence': bool(
            has_completed_batch or has_result_cache or has_baseline or has_ledger
        ),
    },
}

with open(summary_path, 'w', encoding='utf-8') as handle:
    json.dump(payload, handle, ensure_ascii=False, indent=2)
PY

  printf '%s\n' "${summary_path}"
}

assert_scan_persistence_for_outcome() {
  local summary_path="$1"
  local outcome="$2"
  local context="$3"

  node - "${summary_path}" "${outcome}" "${context}" <<'NODE'
const fs = require('node:fs');

const [summaryPath, outcome, context] = process.argv.slice(2);
const payload = JSON.parse(fs.readFileSync(summaryPath, 'utf8') || '{}');
const derived = payload?.derived ?? {};
const latestBatch = payload?.sqlite?.latestBatch ?? null;

const failure = (message) => {
  console.error(
    `[${context}] 缺少可靠的扫描持久化证据: ${message}\n` +
    `  summary: ${summaryPath}\n` +
    `  latestBatch: ${JSON.stringify(latestBatch)}\n` +
    `  derived: ${JSON.stringify(derived)}`
  );
  process.exit(1);
};

switch (outcome) {
  case 'result-ready':
    if (!(derived.hasResultCache || (derived.hasCompletedBatch && Number(latestBatch?.candidateCount ?? 0) > 0))) {
      failure('result-ready 需要候选结果缓存或已完成批次(candidateCount>0)。');
    }
    break;
  case 'exhausted':
  case 'all-complete':
    if (!(derived.hasCompletedBatch && derived.hasBaseline)) {
      failure(`${outcome} 需要 completed batch 与 baseline 同时成立。`);
    }
    break;
  case 'running':
    if (!(payload?.sqlite?.counts?.scanBatch > 0 || payload?.sqlite?.counts?.scanBatchItem > 0)) {
      failure('running 至少应留下 scan_batch / scan_batch_item 运行时记录。');
    }
    break;
  default:
    if (!derived.hasStrongScanPersistence) {
      failure('缺少 completed batch / result cache / baseline / ledger 任一强信号。');
    }
    break;
}
NODE
}

capture_and_assert_scan_persistence() {
  local label="$1"
  local outcome="$2"
  local context="$3"
  local max_attempts="${4:-6}"
  local sleep_seconds="${5:-1}"
  local attempt=0
  local summary_path=""
  local error_log=""

  error_log="$(mktemp "${RUN_DIR}/scan-persistence-assert.XXXXXX.log")"

  for ((attempt = 1; attempt <= max_attempts; attempt += 1)); do
    summary_path="$(capture_scan_persistence_snapshot "${label}")"
    if assert_scan_persistence_for_outcome "${summary_path}" "${outcome}" "${context}" > /dev/null 2>"${error_log}"; then
      rm -f "${error_log}"
      printf '%s\n' "${summary_path}"
      return 0
    fi

    if [[ "${attempt}" -lt "${max_attempts}" ]]; then
      sleep "${sleep_seconds}"
    fi
  done

  cat "${error_log}" >&2
  rm -f "${error_log}"
  return 1
}

wait_for_photo_grid_probe_state() {
  local timeout_ms="${1:-10000}"
  local latest_snapshot_path="${RUN_DIR}/photo-grid-probe-latest.json"
  local summary_json=""
  local outcome=""
  local has_start_button="false"
  local has_permission_button="false"
  local max_attempts=1
  local attempt=0

  if [[ "${timeout_ms}" -gt 500 ]]; then
    max_attempts=$((timeout_ms / 500))
  fi

  for ((attempt = 1; attempt <= max_attempts; attempt += 1)); do
    ensure_app_foreground
    agent_device_session snapshot --json > "${latest_snapshot_path}" 2>/dev/null || true
    summary_json="$(scan_probe_summary_json "${latest_snapshot_path}" 2>/dev/null || printf '{}')"
    outcome="$(scan_probe_outcome_value "${summary_json}")"
    has_start_button="$(scan_probe_has_start_button_value "${summary_json}")"
    has_permission_button="$(scan_probe_has_permission_button_value "${summary_json}")"

    if [[ "${has_permission_button}" == "true" ]]; then
      printf '%s\n' "permission-required"
      return 0
    fi

    if [[ "${outcome}" != "pending" ]]; then
      printf '%s\n' "${outcome}"
      return 0
    fi

    if [[ "${has_start_button}" == "true" ]]; then
      printf '%s\n' "scan-ready"
      return 0
    fi

    agent_device_session wait 500 >/dev/null 2>&1 || true
  done

  return 1
}

wait_for_photo_grid_ready_total_count() {
  local expected_total="$1"
  local timeout_ms="${2:-10000}"
  local latest_snapshot_path="${RUN_DIR}/photo-grid-ready-total.json"
  local summary_json=""
  local has_start_button="false"
  local has_permission_button="false"
  local total_count=""
  local max_attempts=1
  local attempt=0

  if [[ "${timeout_ms}" -gt 500 ]]; then
    max_attempts=$((timeout_ms / 500))
  fi

  for ((attempt = 1; attempt <= max_attempts; attempt += 1)); do
    ensure_app_foreground
    agent_device_session snapshot --json > "${latest_snapshot_path}" 2>/dev/null || true
    summary_json="$(scan_probe_summary_json "${latest_snapshot_path}" 2>/dev/null || printf '{}')"
    has_start_button="$(scan_probe_has_start_button_value "${summary_json}")"
    has_permission_button="$(scan_probe_has_permission_button_value "${summary_json}")"
    total_count="$(scan_probe_total_count_value "${summary_json}")"

    if [[ "${has_permission_button}" == "true" ]]; then
      return 2
    fi

    if [[ "${has_start_button}" == "true" ]]; then
      if [[ -z "${expected_total}" || "${expected_total}" == "*" || "${total_count}" == "${expected_total}" ]]; then
        return 0
      fi
    fi

    agent_device_session wait 500 >/dev/null 2>&1 || true
  done

  return 1
}

open_photo_grid_screen_for_scan() {
  local attempt=0
  local state=""

  agent_device_session wait 'id="tab-button-Photos"' 5000 >/dev/null 2>&1 || true

  for attempt in {1..4}; do
    press_photos_tab_best_effort || true
    ensure_app_foreground
    reattach_session_best_effort || true
    state="$(wait_for_photo_grid_probe_state 2500 || true)"

    case "${state}" in
      permission-required|scan-ready|running|result-ready|exhausted|all-complete)
        return 0
        ;;
    esac

    agent_device_session wait 700 >/dev/null 2>&1 || true
  done

  echo "多次尝试后仍未回到照片主工作区。" >&2
  return 1
}

wait_for_scan_probe_outcome() {
  local allow_running="${1:-1}"
  local cancel_running="${2:-1}"
  local step_base="${3:-06}"
  local max_attempts="${4:-30}"
  local latest_snapshot_path="${RUN_DIR}/scan-probe-latest.json"
  local latest_summary_path="${RUN_DIR}/scan-probe-state.json"
  local attempt=0
  local outcome=""
  local summary_json=""
  local cancel_step=""
  local terminal_step_snapshot_path=""

  cancel_step="$(printf '%02d-scan-cancelled' "$((10#${step_base} + 1))")"

  for ((attempt = 1; attempt <= max_attempts; attempt += 1)); do
    ensure_app_foreground
    agent_device_session snapshot -i -c --json > "${latest_snapshot_path}"
    summary_json="$(scan_probe_summary_json "${latest_snapshot_path}")"
    printf '%s\n' "${summary_json}" > "${latest_summary_path}"
    outcome="$(scan_probe_outcome_value "${summary_json}")"

    case "${outcome}" in
      all-complete)
        capture_step_artifacts "${step_base}-scan-all-complete"
        terminal_step_snapshot_path="${RUN_DIR}/steps/${step_base}-scan-all-complete/snapshot.json"
        if [[ -f "${terminal_step_snapshot_path}" ]]; then
          summary_json="$(scan_probe_summary_json "${terminal_step_snapshot_path}")"
          printf '%s\n' "${summary_json}" > "${latest_summary_path}"
        fi
        write_scan_probe_summary_artifact "${step_base}-scan-all-complete" "${summary_json}"
        return 0
        ;;
      exhausted)
        capture_step_artifacts "${step_base}-scan-exhausted"
        terminal_step_snapshot_path="${RUN_DIR}/steps/${step_base}-scan-exhausted/snapshot.json"
        if [[ -f "${terminal_step_snapshot_path}" ]]; then
          summary_json="$(scan_probe_summary_json "${terminal_step_snapshot_path}")"
          printf '%s\n' "${summary_json}" > "${latest_summary_path}"
        fi
        write_scan_probe_summary_artifact "${step_base}-scan-exhausted" "${summary_json}"
        return 0
        ;;
      result-ready)
        capture_step_artifacts "${step_base}-scan-result-ready"
        terminal_step_snapshot_path="${RUN_DIR}/steps/${step_base}-scan-result-ready/snapshot.json"
        if [[ -f "${terminal_step_snapshot_path}" ]]; then
          summary_json="$(scan_probe_summary_json "${terminal_step_snapshot_path}")"
          printf '%s\n' "${summary_json}" > "${latest_summary_path}"
        fi
        write_scan_probe_summary_artifact "${step_base}-scan-result-ready" "${summary_json}"
        return 0
        ;;
      running)
        if [[ "${allow_running}" -eq 1 ]]; then
          capture_step_artifacts "${step_base}-scan-running"
          write_scan_probe_summary_artifact "${step_base}-scan-running" "${summary_json}"

          if [[ "${cancel_running}" -eq 1 ]]; then
            if agent_device_session press 'id="cancel-scan-button"' >/dev/null 2>&1; then
              agent_device_session wait 'id="photo-grid-start-scan-button"' 10000 >/dev/null 2>&1 || true
              agent_device_session snapshot -i -c --json > "${latest_snapshot_path}"
              summary_json="$(scan_probe_summary_json "${latest_snapshot_path}")"
              printf '%s\n' "${summary_json}" > "${latest_summary_path}"
              capture_step_artifacts "${cancel_step}"
              terminal_step_snapshot_path="${RUN_DIR}/steps/${cancel_step}/snapshot.json"
              if [[ -f "${terminal_step_snapshot_path}" ]]; then
                summary_json="$(scan_probe_summary_json "${terminal_step_snapshot_path}")"
                printf '%s\n' "${summary_json}" > "${latest_summary_path}"
              fi
              write_scan_probe_summary_artifact "${cancel_step}" "${summary_json}"
            fi
          fi

          return 0
        fi
        ;;
    esac

    agent_device_session wait 1000 >/dev/null 2>&1 || true
  done

  echo "未在预期时间内观察到扫描结果态。最新状态见 ${latest_summary_path}" >&2
  return 1
}

run_doctor() {
  require_command adb
  require_command npx
  mkdir -p "${ARTIFACT_ROOT}"
  detect_android_serial
  reset_agent_device_state_if_idle
  close_conflicting_android_sessions
  mkdir -p "${ARTIFACT_ROOT}"

  echo "agent-device version: ${AGENT_DEVICE_VERSION}"
  echo "android serial: ${SERIAL}"
  echo "android app id: ${APP_ID}"
  echo "metro public base url: ${METRO_PUBLIC_BASE_URL}"
  echo

  echo "== agent-device devices =="
  agent_device devices --platform android --json | tee "${ARTIFACT_ROOT}/devices.json"
  echo

  echo "== agent-device apps =="
  agent_device_target apps --json | tee "${ARTIFACT_ROOT}/apps.json"
  echo

  echo "== agent-device workflow help =="
  agent_device help workflow | tee "${ARTIFACT_ROOT}/workflow-help.txt"
}

run_capture() {
  require_command adb
  require_command npx
  require_command node
  detect_android_serial
  reset_agent_device_state_if_idle
  close_conflicting_android_sessions
  mkdir -p "${ARTIFACT_ROOT}"
  prepare_run_dir

  trap cleanup_capture EXIT

  agent_device devices --platform android --json > "${RUN_DIR}/devices.json"
  agent_device_target apps --json > "${RUN_DIR}/apps.json"

  if [[ "${INSTALL_APK}" -eq 1 ]]; then
    if [[ ! -f "${APK_PATH}" ]]; then
      echo "未找到 debug APK: ${APK_PATH}" >&2
      echo "请先执行 npm run build:android:debug，或通过 --apk-path 指定现有 APK。" >&2
      exit 1
    fi
    install_debug_apk
  fi

  configure_adb_reverse
  agent_device metro prepare \
    --public-base-url "${METRO_PUBLIC_BASE_URL}" \
    --project-root "${REPO_ROOT}" \
    --port "${METRO_PORT}" \
    --kind expo \
    --runtime-file "${RUN_DIR}/metro-runtime.json"

  open_app_with_session
  ensure_app_foreground
  prepare_active_session

  start_react_devtools_if_requested
  collect_runtime_artifacts
  finish_react_devtools_if_connected

  cat <<EOF
agent-device 观测证据已生成:
  目录: ${RUN_DIR}
  Snapshot: ${RUN_DIR}/snapshot.json
  Interactive Snapshot: ${RUN_DIR}/snapshot-interactive.json
  Screenshot: ${RUN_DIR}/current-screen.png
  Perf: ${RUN_DIR}/perf.json
EOF
}

run_smoke() {
  require_command adb
  require_command npx
  require_command node
  detect_android_serial
  reset_agent_device_state_if_idle
  close_conflicting_android_sessions
  mkdir -p "${ARTIFACT_ROOT}"
  prepare_run_dir

  trap cleanup_capture EXIT

  agent_device close --platform android --session "${SESSION}" >/dev/null 2>&1 || true
  agent_device devices --platform android --json > "${RUN_DIR}/devices.json"
  agent_device_target apps --json > "${RUN_DIR}/apps.json"

  if [[ "${INSTALL_APK}" -eq 1 ]]; then
    if [[ ! -f "${APK_PATH}" ]]; then
      echo "未找到 debug APK: ${APK_PATH}" >&2
      echo "请先执行 npm run build:android:debug，或通过 --apk-path 指定现有 APK。" >&2
      exit 1
    fi
    install_debug_apk
  fi

  configure_adb_reverse
  agent_device metro prepare \
    --public-base-url "${METRO_PUBLIC_BASE_URL}" \
    --project-root "${REPO_ROOT}" \
    --port "${METRO_PORT}" \
    --kind expo \
    --runtime-file "${RUN_DIR}/metro-runtime.json"

  seed_recycle_bin_fixture
  open_app_with_session
  ensure_app_foreground
  prepare_active_session
  grant_media_permissions_best_effort

  start_react_devtools_if_requested
  capture_step_artifacts "01-launch"

  maybe_advance_past_landing_if_present "02-landing-ready" "02-landing-cta" || true

  agent_device_session wait 'id="tab-button-Settings"' 5000
  capture_step_artifacts "03-main-tabs"
  open_settings_screen
  ensure_smoke_settings_controls_ready
  capture_step_artifacts "04-settings-ready"

  ensure_app_foreground
  reattach_session_best_effort || true
  open_settings_screen
  ensure_settings_option_visible "theme-option-dark"
  press_identifier_with_fallbacks "theme-option-dark"
  agent_device_session wait 1000
  capture_step_artifacts "05-theme-dark"

  ensure_app_foreground
  reattach_session_best_effort || true
  open_settings_screen
  ensure_settings_option_visible "theme-option-light"
  press_identifier_with_fallbacks "theme-option-light"
  agent_device_session wait 1000
  capture_step_artifacts "06-theme-light"

  ensure_app_foreground
  reattach_session_best_effort || true
  open_settings_screen
  select_language_option "language-option-zh-CN" "设置|语言" "简体中文\\s*,\\s*|语言\\s*[·.]\\s*简体中文|跟随系统（当前：简体中文）"
  capture_step_artifacts "07-language-zh"

  ensure_app_foreground
  reattach_session_best_effort || true
  open_settings_screen
  select_language_option "language-option-en-US" "Language|Appearance|Storage|Notifications" "English\\s*,\\s*|System \\(English\\)"
  capture_step_artifacts "08-language-en"

  collect_runtime_artifacts
  finish_react_devtools_if_connected

  cat <<EOF
agent-device smoke 证据已生成:
  目录: ${RUN_DIR}
  最终 Snapshot: ${RUN_DIR}/snapshot.json
  最终 Screenshot: ${RUN_DIR}/current-screen.png
  分步证据目录: ${RUN_DIR}/steps
EOF
}

run_settings_signoff_probe() {
  require_command adb
  require_command npx
  require_command node
  detect_android_serial
  reset_agent_device_state_if_idle
  close_conflicting_android_sessions
  mkdir -p "${ARTIFACT_ROOT}"
  prepare_run_dir

  trap cleanup_capture EXIT

  agent_device close --platform android --session "${SESSION}" >/dev/null 2>&1 || true
  agent_device devices --platform android --json > "${RUN_DIR}/devices.json"
  agent_device_target apps --json > "${RUN_DIR}/apps.json"

  if [[ "${INSTALL_APK}" -eq 1 ]]; then
    if [[ ! -f "${APK_PATH}" ]]; then
      echo "未找到 debug APK: ${APK_PATH}" >&2
      echo "请先执行 npm run build:android:debug，或通过 --apk-path 指定现有 APK。" >&2
      exit 1
    fi
    install_debug_apk
  fi

  configure_adb_reverse
  agent_device metro prepare \
    --public-base-url "${METRO_PUBLIC_BASE_URL}" \
    --project-root "${REPO_ROOT}" \
    --port "${METRO_PORT}" \
    --kind expo \
    --runtime-file "${RUN_DIR}/metro-runtime.json"

  open_app_with_session
  ensure_app_foreground
  prepare_active_session

  start_react_devtools_if_requested

  maybe_advance_past_landing_if_present "01-landing-ready" "02-landing-cta" || true

  agent_device_session wait 'id="tab-button-Settings"' 10000
  capture_step_artifacts "03-main-tabs"
  open_settings_screen
  scroll_settings_to_top
  agent_device_session wait 'id="settings-scroll-view"' 5000
  capture_step_artifacts "04-settings-entry"
  assert_step_artifact_has_identifier "04-settings-entry" "settings-scroll-view"
  assert_step_artifact_has_identifier "04-settings-entry" "settings-header"

  capture_step_artifacts "05-settings-scan-range"
  assert_step_artifact_has_identifier "05-settings-scan-range" "settings-scan-range-card"
  assert_step_artifact_has_identifier "05-settings-scan-range" "scan-range-option-1"
  assert_step_artifact_has_identifier "05-settings-scan-range" "scan-range-option-3"
  assert_step_artifact_has_identifier "05-settings-scan-range" "scan-range-option-6"
  assert_step_artifact_has_identifier "05-settings-scan-range" "scan-range-option-12"
  assert_step_artifact_has_identifier "05-settings-scan-range" "scan-range-option-all-disabled"

  ensure_settings_option_visible "reminder-settings-toggle"
  capture_step_artifacts "06-settings-reminder"
  assert_step_artifact_has_identifier "06-settings-reminder" "settings-reminder-card"
  assert_step_artifact_has_identifier "06-settings-reminder" "reminder-settings-toggle"
  assert_step_artifact_has_identifier "06-settings-reminder" "reminder-frequency-daily"
  assert_step_artifact_has_identifier "06-settings-reminder" "reminder-frequency-weekly"
  assert_step_artifact_has_identifier "06-settings-reminder" "reminder-time-0830"
  assert_step_artifact_has_identifier "06-settings-reminder" "reminder-time-2030"

  ensure_settings_option_visible "theme-option-dark"
  capture_step_artifacts "07-settings-language-theme"
  assert_step_artifact_has_identifier "07-settings-language-theme" "settings-language-theme-card"
  assert_step_artifact_has_identifier "07-settings-language-theme" "language-option-system"
  assert_step_artifact_has_identifier "07-settings-language-theme" "language-option-zh-CN"
  assert_step_artifact_has_identifier "07-settings-language-theme" "language-option-en-US"
  assert_step_artifact_has_identifier "07-settings-language-theme" "theme-option-system"
  assert_step_artifact_has_identifier "07-settings-language-theme" "theme-option-light"
  assert_step_artifact_has_identifier "07-settings-language-theme" "theme-option-dark"

  ensure_settings_option_visible "clear-persistent-scan-cache-button"
  capture_step_artifacts "08-settings-cache"
  assert_step_artifact_has_identifier "08-settings-cache" "settings-cache-card"
  assert_step_artifact_has_identifier "08-settings-cache" "clear-persistent-scan-cache-button"
  assert_step_artifact_has_identifier "08-settings-cache" "settings-local-only-note"

  collect_runtime_artifacts
  finish_react_devtools_if_connected

  cat <<EOF
agent-device settings signoff 证据已生成:
  目录: ${RUN_DIR}
  最终 Snapshot: ${RUN_DIR}/snapshot.json
  最终 Screenshot: ${RUN_DIR}/current-screen.png
  分步证据目录: ${RUN_DIR}/steps
EOF
}

run_acceptance() {
  require_command adb
  require_command npx
  require_command node
  detect_android_serial
  reset_agent_device_state_if_idle
  close_conflicting_android_sessions
  mkdir -p "${ARTIFACT_ROOT}"
  prepare_run_dir

  trap cleanup_capture EXIT

  agent_device close --platform android --session "${SESSION}" >/dev/null 2>&1 || true
  reset_app_state
  agent_device devices --platform android --json > "${RUN_DIR}/devices.json"
  agent_device_target apps --json > "${RUN_DIR}/apps.json"

  if [[ "${INSTALL_APK}" -eq 1 ]]; then
    if [[ ! -f "${APK_PATH}" ]]; then
      echo "未找到 debug APK: ${APK_PATH}" >&2
      echo "请先执行 npm run build:android:debug，或通过 --apk-path 指定现有 APK。" >&2
      exit 1
    fi
    install_debug_apk
  fi

  configure_adb_reverse
  agent_device metro prepare \
    --public-base-url "${METRO_PUBLIC_BASE_URL}" \
    --project-root "${REPO_ROOT}" \
    --port "${METRO_PORT}" \
    --kind expo \
    --runtime-file "${RUN_DIR}/metro-runtime.json"

  open_app_with_session
  ensure_app_foreground
  prepare_active_session

  start_react_devtools_if_requested

  agent_device_session wait 'id="landing-primary-action"' 10000
  capture_step_artifacts "01-landing-ready"
  scroll_landing_to_primary_action
  capture_step_artifacts "02-landing-cta"
  tap_identifier_from_step_artifact "02-landing-cta" "landing-primary-action"
  agent_device_session wait 'id="tab-button-Settings"' 10000

  local scan_entry_state=""
  scan_entry_state="$(wait_for_scan_entry_readiness 15000)"
  if [[ "${scan_entry_state}" == "permission-required" ]]; then
    local post_permission_scan_entry_state=""
    capture_step_artifacts "03-main-before-media-permission"
    press_allowing_external_prompt 'id="photo-grid-request-permission-button"'
    if wait_for_media_permission_dialog; then
      capture_external_ui_artifacts "04-media-permission-dialog"
      if ! press_system_allow; then
        grant_media_permissions_best_effort
      fi
    else
      grant_media_permissions_best_effort
    fi
    ensure_app_foreground
    reattach_session_best_effort || true
    agent_device_session wait 'id="tab-button-Settings"' 10000 || true

    post_permission_scan_entry_state="$(wait_for_scan_entry_readiness 5000 || true)"
    if [[ -z "${post_permission_scan_entry_state}" || "${post_permission_scan_entry_state}" == "permission-required" ]]; then
      if wait_for_media_permission_dialog; then
        press_system_allow || grant_media_permissions_best_effort
      fi
      relaunch_app_to_photo_grid_after_permission_grant
      post_permission_scan_entry_state="$(wait_for_scan_entry_readiness 10000 || true)"
    fi

    if [[ "${post_permission_scan_entry_state}" != "scan-ready" ]]; then
      echo "acceptance 中媒体授权后未进入 scan-ready，当前状态: ${post_permission_scan_entry_state:-<unknown>}" >&2
      exit 1
    fi
  fi
  capture_step_artifacts "05-main-after-media-allow"
  open_settings_screen

  agent_device_session wait 'id="reminder-settings-toggle"' 5000
  capture_step_artifacts "06-settings-before-reminder-toggle"
  ensure_app_foreground
  agent_device_session wait 'id="reminder-settings-toggle"' 5000
  press_allowing_external_prompt 'id="reminder-settings-toggle"'

  if wait_for_notification_permission_dialog; then
    capture_external_ui_artifacts "07-notification-permission-dialog"
    if ! press_system_allow; then
      grant_notification_permissions_best_effort
    fi
  fi
  ensure_app_foreground

  agent_device_session wait 'id="settings-scroll-view"' 5000
  agent_device_session wait 'id="reminder-settings-toggle"' 5000
  capture_step_artifacts "08-settings-after-notification-allow"

  collect_runtime_artifacts
  finish_react_devtools_if_connected

  cat <<EOF
agent-device acceptance 证据已生成:
  目录: ${RUN_DIR}
  最终 Snapshot: ${RUN_DIR}/snapshot.json
  最终 Screenshot: ${RUN_DIR}/current-screen.png
  分步证据目录: ${RUN_DIR}/steps
EOF
}

run_scan_probe() {
  require_command adb
  require_command npx
  require_command node
  require_command python3
  detect_android_serial
  reset_agent_device_state_if_idle
  close_conflicting_android_sessions
  mkdir -p "${ARTIFACT_ROOT}"
  prepare_run_dir

  trap cleanup_capture EXIT

  agent_device close --platform android --session "${SESSION}" >/dev/null 2>&1 || true
  agent_device devices --platform android --json > "${RUN_DIR}/devices.json"
  agent_device_target apps --json > "${RUN_DIR}/apps.json"

  if [[ "${INSTALL_APK}" -eq 1 ]]; then
    if [[ ! -f "${APK_PATH}" ]]; then
      echo "未找到 debug APK: ${APK_PATH}" >&2
      echo "请先执行 npm run build:android:debug，或通过 --apk-path 指定现有 APK。" >&2
      exit 1
    fi
    install_debug_apk
  fi

  configure_adb_reverse
  agent_device metro prepare \
    --public-base-url "${METRO_PUBLIC_BASE_URL}" \
    --project-root "${REPO_ROOT}" \
    --port "${METRO_PORT}" \
    --kind expo \
    --runtime-file "${RUN_DIR}/metro-runtime.json"

  open_app_with_session
  ensure_app_foreground
  prepare_active_session

  start_react_devtools_if_requested

  maybe_advance_past_landing_if_present "01-landing-ready" "02-landing-cta" || true
  open_photo_grid_screen_for_scan || true
  ensure_media_permission_ready_for_scan "03-main-before-media-permission" "04-media-permission-dialog"
  open_photo_grid_screen_for_scan

  capture_step_artifacts "05-main-ready"
  reattach_session_best_effort || true
  prepare_active_session

  local scan_probe_preflight_snapshot_path="${RUN_DIR}/scan-probe-preflight.json"
  local scan_probe_preflight_summary=""
  local scan_probe_preflight_outcome=""
  local scan_probe_preflight_has_start_button="false"
  agent_device_session snapshot --json > "${scan_probe_preflight_snapshot_path}"
  scan_probe_preflight_summary="$(scan_probe_summary_json "${scan_probe_preflight_snapshot_path}")"
  scan_probe_preflight_outcome="$(scan_probe_outcome_value "${scan_probe_preflight_summary}")"
  scan_probe_preflight_has_start_button="$(scan_probe_has_start_button_value "${scan_probe_preflight_summary}")"

  if [[ "${scan_probe_preflight_has_start_button}" == "true" ]]; then
    agent_device_session wait 'id="photo-grid-start-scan-button"' 10000
    agent_device_session press 'id="photo-grid-start-scan-button"'
    capture_step_artifacts "06-scan-started"
    local scan_started_snapshot_path="${RUN_DIR}/steps/06-scan-started/snapshot.json"
    local scan_started_summary_json=""
    local scan_started_outcome=""
    local post_scan_summary_json=""
    local post_scan_outcome=""
    local post_scan_persistence_summary_path=""

    if [[ -f "${scan_started_snapshot_path}" ]]; then
      scan_started_summary_json="$(scan_probe_summary_json "${scan_started_snapshot_path}")"
      scan_started_outcome="$(scan_probe_outcome_value "${scan_started_summary_json}")"
    fi

    if [[ "${scan_started_outcome}" == "running" ]]; then
      write_scan_probe_summary_artifact "06-scan-started" "${scan_started_summary_json}"
      write_scan_probe_summary_root "${scan_started_summary_json}"
    else
      wait_for_scan_probe_outcome 1 1 "07" 60
    fi

    post_scan_summary_json="$(cat "${RUN_DIR}/scan-probe-state.json")"
    post_scan_outcome="$(scan_probe_outcome_value "${post_scan_summary_json}")"
    post_scan_persistence_summary_path="$(capture_and_assert_scan_persistence "post-scan" "${post_scan_outcome}" "scan-probe")"
  elif [[ "${scan_probe_preflight_outcome}" == "all-complete" ]]; then
    capture_step_artifacts "07-scan-all-complete"
    write_scan_probe_summary_artifact "07-scan-all-complete" "${scan_probe_preflight_summary}"
    write_scan_probe_summary_root "${scan_probe_preflight_summary}"
    local preflight_all_complete_persistence_summary_path=""
    preflight_all_complete_persistence_summary_path="$(capture_and_assert_scan_persistence "preflight-all-complete" "${scan_probe_preflight_outcome}" "scan-probe-preflight")"
  elif [[ "${scan_probe_preflight_outcome}" == "exhausted" ]]; then
    capture_step_artifacts "07-scan-exhausted"
    write_scan_probe_summary_artifact "07-scan-exhausted" "${scan_probe_preflight_summary}"
    write_scan_probe_summary_root "${scan_probe_preflight_summary}"
    local preflight_exhausted_persistence_summary_path=""
    preflight_exhausted_persistence_summary_path="$(capture_and_assert_scan_persistence "preflight-exhausted" "${scan_probe_preflight_outcome}" "scan-probe-preflight")"
  elif [[ "${scan_probe_preflight_outcome}" == "running" ]]; then
    capture_step_artifacts "07-scan-running"
    write_scan_probe_summary_artifact "07-scan-running" "${scan_probe_preflight_summary}"
    write_scan_probe_summary_root "${scan_probe_preflight_summary}"
    local preflight_running_persistence_summary_path=""
    preflight_running_persistence_summary_path="$(capture_and_assert_scan_persistence "preflight-running" "${scan_probe_preflight_outcome}" "scan-probe-preflight")"
    agent_device_session press 'id="cancel-scan-button"' >/dev/null 2>&1 || true
    agent_device_session wait 'id="photo-grid-start-scan-button"' 10000 >/dev/null 2>&1 || true
    agent_device_session snapshot -i -c --json > "${scan_probe_preflight_snapshot_path}"
    scan_probe_preflight_summary="$(scan_probe_summary_json "${scan_probe_preflight_snapshot_path}")"
    capture_step_artifacts "08-scan-cancelled"
    write_scan_probe_summary_artifact "08-scan-cancelled" "${scan_probe_preflight_summary}"
    write_scan_probe_summary_root "${scan_probe_preflight_summary}"
  elif [[ "${scan_probe_preflight_outcome}" == "result-ready" ]]; then
    capture_step_artifacts "07-scan-result-ready"
    write_scan_probe_summary_artifact "07-scan-result-ready" "${scan_probe_preflight_summary}"
    write_scan_probe_summary_root "${scan_probe_preflight_summary}"
    local preflight_result_persistence_summary_path=""
    preflight_result_persistence_summary_path="$(capture_and_assert_scan_persistence "preflight-result-ready" "${scan_probe_preflight_outcome}" "scan-probe-preflight")"
  fi

  collect_runtime_artifacts
  finish_react_devtools_if_connected

  cat <<EOF
agent-device scan probe 证据已生成:
  目录: ${RUN_DIR}
  Scan Summary: ${RUN_DIR}/scan-probe-state.json
  最终 Snapshot: ${RUN_DIR}/snapshot.json
  最终 Screenshot: ${RUN_DIR}/current-screen.png
  分步证据目录: ${RUN_DIR}/steps
EOF
}

run_scan_complete_probe() {
  require_command adb
  require_command npx
  require_command node
  require_command python3
  detect_android_serial
  reset_agent_device_state_if_idle
  close_conflicting_android_sessions
  mkdir -p "${ARTIFACT_ROOT}"
  prepare_run_dir

  trap cleanup_capture EXIT

  agent_device close --platform android --session "${SESSION}" >/dev/null 2>&1 || true
  agent_device devices --platform android --json > "${RUN_DIR}/devices.json"
  agent_device_target apps --json > "${RUN_DIR}/apps.json"

  if [[ "${INSTALL_APK}" -eq 1 ]]; then
    if [[ ! -f "${APK_PATH}" ]]; then
      echo "未找到 debug APK: ${APK_PATH}" >&2
      echo "请先执行 npm run build:android:debug，或通过 --apk-path 指定现有 APK。" >&2
      exit 1
    fi
    install_debug_apk
  fi

  configure_adb_reverse
  agent_device metro prepare \
    --public-base-url "${METRO_PUBLIC_BASE_URL}" \
    --project-root "${REPO_ROOT}" \
    --port "${METRO_PORT}" \
    --kind expo \
    --runtime-file "${RUN_DIR}/metro-runtime.json"

  open_app_with_session
  ensure_app_foreground
  prepare_active_session

  start_react_devtools_if_requested

  maybe_advance_past_landing_if_present "01-landing-ready" "02-landing-cta" || true
  open_photo_grid_screen_for_scan || true
  ensure_media_permission_ready_for_scan "03-main-before-media-permission" "04-media-permission-dialog"
  open_photo_grid_screen_for_scan

  capture_step_artifacts "05-main-ready"
  reattach_session_best_effort || true
  prepare_active_session

  local preflight_snapshot_path="${RUN_DIR}/scan-complete-preflight.json"
  local preflight_summary=""
  local preflight_outcome=""
  local preflight_has_start_button="false"
  agent_device_session snapshot --json > "${preflight_snapshot_path}"
  preflight_summary="$(scan_probe_summary_json "${preflight_snapshot_path}")"
  preflight_outcome="$(scan_probe_outcome_value "${preflight_summary}")"
  preflight_has_start_button="$(scan_probe_has_start_button_value "${preflight_summary}")"

  if [[ "${preflight_has_start_button}" == "true" ]]; then
    agent_device_session wait 'id="photo-grid-start-scan-button"' 10000
    agent_device_session press 'id="photo-grid-start-scan-button"'
    capture_step_artifacts "06-scan-started"
    wait_for_scan_probe_outcome 0 0 "07" 300
    local post_scan_summary_json=""
    local post_scan_outcome=""
    local post_scan_persistence_summary_path=""
    post_scan_summary_json="$(cat "${RUN_DIR}/scan-probe-state.json")"
    post_scan_outcome="$(scan_probe_outcome_value "${post_scan_summary_json}")"
    post_scan_persistence_summary_path="$(capture_and_assert_scan_persistence "post-scan" "${post_scan_outcome}" "scan-complete")"
  else
    local preflight_persistence_summary_path=""
    case "${preflight_outcome}" in
      all-complete)
        capture_step_artifacts "07-scan-all-complete"
        write_scan_probe_summary_artifact "07-scan-all-complete" "${preflight_summary}"
        ;;
      exhausted)
        capture_step_artifacts "07-scan-exhausted"
        write_scan_probe_summary_artifact "07-scan-exhausted" "${preflight_summary}"
        ;;
      result-ready)
        capture_step_artifacts "07-scan-result-ready"
        write_scan_probe_summary_artifact "07-scan-result-ready" "${preflight_summary}"
        ;;
      running)
        wait_for_scan_probe_outcome 0 0 "07" 300
        preflight_summary="$(cat "${RUN_DIR}/scan-probe-state.json")"
        preflight_outcome="$(scan_probe_outcome_value "${preflight_summary}")"
        ;;
      *)
        echo "scan-complete 未命中可识别的预检状态。" >&2
        exit 1
        ;;
    esac
    write_scan_probe_summary_root "${preflight_summary}"
    preflight_persistence_summary_path="$(capture_and_assert_scan_persistence "preflight-${preflight_outcome}" "${preflight_outcome}" "scan-complete-preflight")"
  fi

  collect_runtime_artifacts
  finish_react_devtools_if_connected

  cat <<EOF
agent-device scan complete 证据已生成:
  目录: ${RUN_DIR}
  Scan Summary: ${RUN_DIR}/scan-probe-state.json
  最终 Snapshot: ${RUN_DIR}/snapshot.json
  最终 Screenshot: ${RUN_DIR}/current-screen.png
  分步证据目录: ${RUN_DIR}/steps
EOF
}

run_permission_denied_probe() {
  require_command adb
  require_command npx
  require_command node
  detect_android_serial
  reset_agent_device_state_if_idle
  close_conflicting_android_sessions
  mkdir -p "${ARTIFACT_ROOT}"
  prepare_run_dir

  trap cleanup_capture EXIT

  agent_device close --platform android --session "${SESSION}" >/dev/null 2>&1 || true
  reset_app_state
  agent_device devices --platform android --json > "${RUN_DIR}/devices.json"
  agent_device_target apps --json > "${RUN_DIR}/apps.json"

  if [[ "${INSTALL_APK}" -eq 1 ]]; then
    if [[ ! -f "${APK_PATH}" ]]; then
      echo "未找到 debug APK: ${APK_PATH}" >&2
      echo "请先执行 npm run build:android:debug，或通过 --apk-path 指定现有 APK。" >&2
      exit 1
    fi
    install_debug_apk
  fi

  configure_adb_reverse
  agent_device metro prepare \
    --public-base-url "${METRO_PUBLIC_BASE_URL}" \
    --project-root "${REPO_ROOT}" \
    --port "${METRO_PORT}" \
    --kind expo \
    --runtime-file "${RUN_DIR}/metro-runtime.json"

  open_app_with_session
  ensure_app_foreground
  prepare_active_session

  start_react_devtools_if_requested

  maybe_advance_past_landing_if_present "01-landing-ready" "02-landing-cta" || true
  open_photo_grid_screen_for_scan || true

  local permission_entry_state=""
  permission_entry_state="$(wait_for_scan_entry_readiness 10000 || true)"
  if [[ "${permission_entry_state}" != "permission-required" ]]; then
    open_photo_grid_screen_for_scan
    permission_entry_state="$(wait_for_scan_entry_readiness 10000 || true)"
  fi

  if [[ "${permission_entry_state}" != "permission-required" ]]; then
    echo "permission-denied 预检未进入权限申请入口。" >&2
    exit 1
  fi

  agent_device_session wait 'id="photo-grid-request-permission-button"' 5000
  capture_step_artifacts "03-main-before-media-permission"
  press_allowing_external_prompt 'id="photo-grid-request-permission-button"'

  if wait_for_media_permission_dialog; then
    capture_external_ui_artifacts "04-media-permission-dialog"
    press_system_deny || true
  fi
  ensure_app_foreground

  local post_deny_state=""
  post_deny_state="$(wait_for_scan_entry_readiness 10000 || true)"
  if [[ "${post_deny_state}" != "permission-required" ]]; then
    open_photo_grid_screen_for_scan || true
    post_deny_state="$(wait_for_scan_entry_readiness 10000 || true)"
  fi

  if [[ "${post_deny_state}" != "permission-required" ]]; then
    echo "permission-denied 后未回到权限申请入口，当前状态: ${post_deny_state:-<unknown>}" >&2
    exit 1
  fi

  capture_step_artifacts "05-main-after-media-deny"

  collect_runtime_artifacts
  finish_react_devtools_if_connected

  cat <<EOF
agent-device permission denied probe 证据已生成:
  目录: ${RUN_DIR}
  最终 Snapshot: ${RUN_DIR}/snapshot.json
  最终 Screenshot: ${RUN_DIR}/current-screen.png
  分步证据目录: ${RUN_DIR}/steps
EOF
}

run_scan_cleanup_probe() {
  require_command adb
  require_command npx
  require_command node
  require_command python3
  detect_android_serial
  reset_agent_device_state_if_idle
  close_conflicting_android_sessions
  mkdir -p "${ARTIFACT_ROOT}"
  prepare_run_dir

  trap cleanup_capture EXIT

  agent_device close --platform android --session "${SESSION}" >/dev/null 2>&1 || true
  reset_app_state
  agent_device devices --platform android --json > "${RUN_DIR}/devices.json"
  agent_device_target apps --json > "${RUN_DIR}/apps.json"

  if [[ "${INSTALL_APK}" -eq 1 ]]; then
    if [[ ! -f "${APK_PATH}" ]]; then
      echo "未找到 debug APK: ${APK_PATH}" >&2
      echo "请先执行 npm run build:android:debug，或通过 --apk-path 指定现有 APK。" >&2
      exit 1
    fi
    install_debug_apk
  fi

  configure_adb_reverse
  agent_device metro prepare \
    --public-base-url "${METRO_PUBLIC_BASE_URL}" \
    --project-root "${REPO_ROOT}" \
    --port "${METRO_PORT}" \
    --kind expo \
    --runtime-file "${RUN_DIR}/metro-runtime.json"

  open_app_with_session
  ensure_app_foreground
  prepare_active_session

  start_react_devtools_if_requested

  maybe_advance_past_landing_if_present "01-landing-ready" "02-landing-cta" || true
  ensure_media_permission_ready_for_scan "03-main-before-media-permission" "04-media-permission-dialog"
  open_photo_grid_screen_for_scan
  ensure_app_foreground
  reattach_session_best_effort || true
  agent_device_session wait 'id="tab-button-Settings"' 10000 || true

  capture_step_artifacts "05-main-after-media-allow"

  if agent_device_session wait 'id="photo-grid-start-scan-button"' 3000 >/dev/null 2>&1; then
    local deterministic_seed_ready=0
    if bash "${REPO_ROOT}/scripts/android/seed-emulator-scan-result.sh" --serial "${SERIAL}"; then
      agent_device close --platform android --session "${SESSION}" >/dev/null 2>&1 || true
      open_app_with_session "relaunch"
      ensure_app_foreground
      prepare_active_session
      if wait_for_seeded_result_item "05-seeded-result-poll" 10; then
        deterministic_seed_ready=1
        capture_step_artifacts "06-seeded-result-ready"
      else
        echo "deterministic scan result 已写入，但重启后未稳定进入 result-ready 界面，回退到真实 seeded media scan。" >&2
      fi
    else
      echo "deterministic scan result fixture 未就绪，回退到真实 seeded media scan。" >&2
    fi

    if [[ "${deterministic_seed_ready}" -ne 1 ]]; then
      bash "${REPO_ROOT}/scripts/android/seed-emulator-media.sh" \
        --serial "${SERIAL}" \
        --clean >/dev/null
      open_app_with_session "relaunch"
      ensure_app_foreground
      prepare_active_session
      maybe_advance_past_landing_if_present \
        "05a-landing-ready-after-fallback-seed" \
        "05b-landing-cta-after-fallback-seed" || true
      ensure_media_permission_ready_for_scan "05c-main-before-media-permission" "05d-media-permission-dialog"
      agent_device_session wait 'id="photo-grid-start-scan-button"' 10000
      agent_device_session press 'id="photo-grid-start-scan-button"'
      wait_for_scan_probe_outcome 0 0 "06" 90
      if ! wait_for_seeded_result_item "06-seeded-result-poll" 10; then
        echo "真实 seeded media scan 已完成，但未稳定观察到结果摘要或 issue workspace。" >&2
        exit 1
      fi
      capture_step_artifacts "06-seeded-result-ready"
    fi
  elif ! wait_for_seeded_result_item "05-existing-result-poll" 6 >/dev/null 2>&1; then
    echo "scan-cleanup 前既无 start-scan 按钮，也未观察到结果摘要或 scan-result-grid-item。" >&2
    exit 1
  fi

  local scan_cleanup_summary_json=""
  local scan_cleanup_outcome=""
  local scan_cleanup_persistence_outcome=""
  local scan_cleanup_persistence_summary_path=""
  local scan_cleanup_snapshot_path="${RUN_DIR}/scan-cleanup-pre-detail.json"
  local has_scan_cleanup_result_summary="false"
  scan_cleanup_summary_json="$(cat "${RUN_DIR}/scan-probe-state.json" 2>/dev/null || true)"
  agent_device_session snapshot -i -c --json > "${scan_cleanup_snapshot_path}"
  if [[ -z "${scan_cleanup_summary_json}" ]]; then
    scan_cleanup_summary_json="$(scan_probe_summary_json "${scan_cleanup_snapshot_path}")"
  fi
  scan_cleanup_outcome="$(scan_probe_outcome_value "${scan_cleanup_summary_json}")"
  has_scan_cleanup_result_summary="$(snapshot_has_result_summary_surface "${scan_cleanup_snapshot_path}")"
  scan_cleanup_persistence_outcome="${scan_cleanup_outcome}"
  if [[ "${scan_cleanup_persistence_outcome}" == "exhausted" && "${has_scan_cleanup_result_summary}" == "true" ]]; then
    scan_cleanup_persistence_outcome="result-ready"
  fi
  scan_cleanup_persistence_summary_path="$(capture_and_assert_scan_persistence "post-scan-before-cleanup" "${scan_cleanup_persistence_outcome}" "scan-cleanup")"

  local result_step_name="07-scan-result-item-visible"
  if ! agent_device_session wait 'id="scan-result-grid-item"' 2000 >/dev/null 2>&1; then
    if agent_device_session wait 'id="tab-button-Photos"' 2000 >/dev/null 2>&1; then
      press_photos_tab_best_effort || true
      ensure_app_foreground
      reattach_session_best_effort || true
      wait_for_seeded_result_item "07-photos-result-poll" 10 || true
    fi
  fi

  capture_step_artifacts "${result_step_name}"
  if ! step_artifact_has_identifier "${result_step_name}" "scan-result-grid-item"; then
    if ! open_issue_workspace_from_result_summary "${result_step_name}"; then
      echo "scan-cleanup 结果页未直接暴露 scan-result-grid-item，且无法通过 breakdown 卡片进入 issue workspace。" >&2
      exit 1
    fi

    result_step_name="07b-scan-issue-workspace"
    agent_device_session wait 'id="scan-result-grid-item"' 5000
    capture_step_artifacts "${result_step_name}"
  fi

  if ! tap_identifier_from_step_artifact "${result_step_name}" "scan-result-grid-item"; then
    if ! press_identifier_from_step_artifact "${result_step_name}" "scan-result-grid-item"; then
      agent_device_session press 'id="scan-result-grid-item"'
    fi
  fi
  agent_device_session wait 'id="detail-primary-action"' 5000
  capture_step_artifacts "08-scan-detail"
  if ! trigger_detail_action_from_step_artifact "08-scan-detail" "detail-primary-action"; then
    echo "多次尝试后仍未成功触发 detail-primary-action。" >&2
    exit 1
  fi
  ensure_app_foreground

  agent_device_session wait 1200 >/dev/null 2>&1 || true
  if wait_for_recycle_bin_population_after_cleanup; then
    capture_step_artifacts "09-recycle-bin"
    capture_step_artifacts "10-recycle-item-visible"
  else
    open_recycle_bin_screen || true
    capture_step_artifacts "09-recycle-bin"
    echo "扫描详情清理后未在回收站观察到条目。" >&2
    exit 1
  fi

  collect_runtime_artifacts
  finish_react_devtools_if_connected

  cat <<EOF
agent-device scan cleanup probe 证据已生成:
  目录: ${RUN_DIR}
  最终 Snapshot: ${RUN_DIR}/snapshot.json
  最终 Screenshot: ${RUN_DIR}/current-screen.png
  分步证据目录: ${RUN_DIR}/steps
EOF
}

run_filtering_selection_probe() {
  require_command adb
  require_command npx
  require_command node
  require_command python3
  detect_android_serial
  reset_agent_device_state_if_idle
  close_conflicting_android_sessions
  mkdir -p "${ARTIFACT_ROOT}"
  prepare_run_dir

  trap cleanup_capture EXIT

  agent_device close --platform android --session "${SESSION}" >/dev/null 2>&1 || true
  reset_app_state
  agent_device devices --platform android --json > "${RUN_DIR}/devices.json"
  agent_device_target apps --json > "${RUN_DIR}/apps.json"

  if [[ "${INSTALL_APK}" -eq 1 ]]; then
    if [[ ! -f "${APK_PATH}" ]]; then
      echo "未找到 debug APK: ${APK_PATH}" >&2
      echo "请先执行 npm run build:android:debug，或通过 --apk-path 指定现有 APK。" >&2
      exit 1
    fi
    install_debug_apk
  fi

  configure_adb_reverse
  agent_device metro prepare \
    --public-base-url "${METRO_PUBLIC_BASE_URL}" \
    --project-root "${REPO_ROOT}" \
    --port "${METRO_PORT}" \
    --kind expo \
    --runtime-file "${RUN_DIR}/metro-runtime.json"

  open_app_with_session
  ensure_app_foreground
  prepare_active_session

  start_react_devtools_if_requested

  maybe_advance_past_landing_if_present "01-landing-ready" "02-landing-cta" || true
  ensure_media_permission_ready_for_scan "03-main-before-media-permission" "04-media-permission-dialog"
  open_photo_grid_screen_for_scan
  ensure_app_foreground
  reattach_session_best_effort || true
  agent_device_session wait 'id="tab-button-Settings"' 10000 || true

  capture_step_artifacts "05-main-after-media-allow"

  if agent_device_session wait 'id="photo-grid-start-scan-button"' 3000 >/dev/null 2>&1; then
    local deterministic_seed_ready=0
    if bash "${REPO_ROOT}/scripts/android/seed-emulator-scan-result.sh" --serial "${SERIAL}"; then
      agent_device close --platform android --session "${SESSION}" >/dev/null 2>&1 || true
      open_app_with_session "relaunch"
      ensure_app_foreground
      prepare_active_session
      if wait_for_seeded_result_item "05-seeded-result-poll" 10; then
        deterministic_seed_ready=1
        capture_step_artifacts "06-seeded-result-ready"
      else
        echo "deterministic scan result 已写入，但重启后未稳定进入 result-ready 界面。" >&2
      fi
    else
      echo "deterministic scan result fixture 未就绪。" >&2
    fi

    if [[ "${deterministic_seed_ready}" -ne 1 ]]; then
      echo "filtering-selection 需要 deterministic scan result fixture 才能稳定采集选择态。" >&2
      exit 1
    fi
  elif ! wait_for_seeded_result_item "05-existing-result-poll" 6 >/dev/null 2>&1; then
    echo "filtering-selection 前既无 start-scan 按钮，也未观察到结果摘要或 scan-result-grid-item。" >&2
    exit 1
  fi

  local result_step_name="07-scan-result-item-visible"
  if ! agent_device_session wait 'id="scan-result-grid-item"' 2000 >/dev/null 2>&1; then
    if agent_device_session wait 'id="tab-button-Photos"' 2000 >/dev/null 2>&1; then
      press_photos_tab_best_effort || true
      ensure_app_foreground
      reattach_session_best_effort || true
      wait_for_seeded_result_item "07-photos-result-poll" 10 || true
    fi
  fi

  capture_step_artifacts "${result_step_name}"
  if ! step_artifact_has_identifier "${result_step_name}" "scan-result-grid-item"; then
    if ! open_issue_workspace_from_result_summary "${result_step_name}"; then
      echo "filtering-selection 结果页未直接暴露 scan-result-grid-item，且无法通过 breakdown 卡片进入 issue workspace。" >&2
      exit 1
    fi

    result_step_name="07b-scan-issue-workspace"
    agent_device_session wait 'id="scan-result-grid-item"' 5000
    capture_step_artifacts "${result_step_name}"
  fi

  if ! long_press_identifier_from_step_artifact "${result_step_name}" "scan-result-grid-item"; then
    echo "未能对 scan-result-grid-item 执行 long press，无法进入 filtering selection mode。" >&2
    exit 1
  fi

  agent_device_session wait 'id="photo-selection-toggle-button"' 5000
  agent_device_session wait 'id="cleanup-selected-button"' 5000
  capture_step_artifacts "08-filtering-selection-mode"

  if ! step_artifact_has_identifier "08-filtering-selection-mode" "keep-selected-button" \
    || ! step_artifact_has_identifier "08-filtering-selection-mode" "cleanup-selected-button"; then
    echo "filtering selection mode 未观察到底部保留/清理动作区。" >&2
    exit 1
  fi

  collect_runtime_artifacts
  finish_react_devtools_if_connected

  cat <<EOF
agent-device filtering selection 证据已生成:
  目录: ${RUN_DIR}
  最终 Snapshot: ${RUN_DIR}/snapshot.json
  最终 Screenshot: ${RUN_DIR}/current-screen.png
  分步证据目录: ${RUN_DIR}/steps
EOF
}

run_continue_scan_probe() {
  require_command adb
  require_command npx
  require_command node
  require_command python3
  detect_android_serial
  reset_agent_device_state_if_idle
  close_conflicting_android_sessions
  mkdir -p "${ARTIFACT_ROOT}"
  prepare_run_dir

  trap cleanup_capture EXIT

  agent_device close --platform android --session "${SESSION}" >/dev/null 2>&1 || true
  reset_app_state
  agent_device devices --platform android --json > "${RUN_DIR}/devices.json"
  agent_device_target apps --json > "${RUN_DIR}/apps.json"

  if [[ "${INSTALL_APK}" -eq 1 ]]; then
    if [[ ! -f "${APK_PATH}" ]]; then
      echo "未找到 debug APK: ${APK_PATH}" >&2
      echo "请先执行 npm run build:android:debug，或通过 --apk-path 指定现有 APK。" >&2
      exit 1
    fi
    install_debug_apk
  fi

  bash "${SCRIPT_DIR}/seed-emulator-media.sh" \
    --serial "${SERIAL}" \
    --clean \
    --continue-scan-layout >/dev/null

  configure_adb_reverse
  agent_device metro prepare \
    --public-base-url "${METRO_PUBLIC_BASE_URL}" \
    --project-root "${REPO_ROOT}" \
    --port "${METRO_PORT}" \
    --kind expo \
    --runtime-file "${RUN_DIR}/metro-runtime.json"

  open_app_with_session
  ensure_app_foreground
  prepare_active_session

  start_react_devtools_if_requested

  maybe_advance_past_landing_if_present "01-landing-ready" "02-landing-cta" || true
  ensure_media_permission_ready_for_scan "03-main-before-media-permission" "04-media-permission-dialog"
  open_photo_grid_screen_for_scan
  wait_for_photo_grid_ready_total_count "*" 15000

  agent_device_session wait 'id="photo-grid-start-scan-button"' 5000
  capture_step_artifacts "05-main-after-media-allow"
  press_photo_grid_start_button_best_effort "05-main-after-media-allow"
  capture_step_artifacts "06-first-scan-started"

  wait_for_scan_probe_outcome 0 0 "07" 90

  local initial_summary_json=""
  local initial_outcome=""
  local initial_range_label=""
  local initial_button_label=""
  local initial_total_count=""
  initial_summary_json="$(cat "${RUN_DIR}/scan-probe-state.json")"
  initial_outcome="$(scan_probe_outcome_value "${initial_summary_json}")"
  initial_range_label="$(scan_probe_range_label_value "${initial_summary_json}")"
  initial_button_label="$(scan_probe_start_button_label_value "${initial_summary_json}")"
  initial_total_count="$(scan_probe_total_count_value "${initial_summary_json}")"
  local initial_persistence_summary_path=""
  initial_persistence_summary_path="$(capture_and_assert_scan_persistence "initial-scan" "${initial_outcome}" "continue-scan-initial")"

  if [[ "${initial_outcome}" != "exhausted" ]]; then
    echo "continue-scan 前置期望是 exhausted，当前却是: ${initial_outcome}" >&2
    exit 1
  fi

  if ! is_continue_scan_button_label "${initial_button_label}"; then
    echo "当前耗尽态 CTA 不是 continue-scan: ${initial_button_label:-<empty>}" >&2
    exit 1
  fi

  press_photo_grid_start_button_best_effort "07-scan-exhausted"
  capture_step_artifacts "08-continue-scan-started"

  wait_for_scan_probe_outcome 0 0 "09" 90

  local next_summary_json=""
  local next_outcome=""
  local next_range_label=""
  local next_total_count=""
  next_summary_json="$(cat "${RUN_DIR}/scan-probe-state.json")"
  next_outcome="$(scan_probe_outcome_value "${next_summary_json}")"
  next_range_label="$(scan_probe_range_label_value "${next_summary_json}")"
  next_total_count="$(scan_probe_total_count_value "${next_summary_json}")"
  local next_persistence_summary_path=""
  next_persistence_summary_path="$(capture_and_assert_scan_persistence "continue-scan-next" "${next_outcome}" "continue-scan-next")"

  write_continue_scan_transition_artifact "${initial_summary_json}" "${next_summary_json}"

  if [[ "${next_outcome}" == "pending" ]]; then
    echo "continue-scan 后仍停留在 pending 状态。" >&2
    exit 1
  fi

  local didAdvanceWindow=0
  if [[ -n "${initial_range_label}" && -n "${next_range_label}" && "${initial_range_label}" != "${next_range_label}" ]]; then
    didAdvanceWindow=1
  elif [[ -n "${initial_total_count}" && -n "${next_total_count}" && "${initial_total_count}" != "${next_total_count}" ]]; then
    didAdvanceWindow=1
  elif [[ "${next_outcome}" == "result-ready" ]]; then
    didAdvanceWindow=1
  fi

  if [[ "${didAdvanceWindow}" -ne 1 ]]; then
    echo "continue-scan 后未观察到更早窗口推进证据。初始范围=${initial_range_label:-<empty>} 初始总量=${initial_total_count:-<empty>} 下一范围=${next_range_label:-<empty>} 下一总量=${next_total_count:-<empty>} 下一结果=${next_outcome}" >&2
    exit 1
  fi

  collect_runtime_artifacts
  finish_react_devtools_if_connected

  cat <<EOF
agent-device continue scan probe 证据已生成:
  目录: ${RUN_DIR}
  Transition: ${RUN_DIR}/continue-scan-transition.json
  最终 Snapshot: ${RUN_DIR}/snapshot.json
  最终 Screenshot: ${RUN_DIR}/current-screen.png
  分步证据目录: ${RUN_DIR}/steps
EOF
}

run_all_complete_probe() {
  require_command adb
  require_command npx
  require_command node
  require_command python3
  detect_android_serial
  reset_agent_device_state_if_idle
  close_conflicting_android_sessions
  mkdir -p "${ARTIFACT_ROOT}"
  prepare_run_dir

  trap cleanup_capture EXIT

  agent_device close --platform android --session "${SESSION}" >/dev/null 2>&1 || true
  reset_app_state
  agent_device devices --platform android --json > "${RUN_DIR}/devices.json"
  agent_device_target apps --json > "${RUN_DIR}/apps.json"

  if [[ "${INSTALL_APK}" -eq 1 ]]; then
    if [[ ! -f "${APK_PATH}" ]]; then
      echo "未找到 debug APK: ${APK_PATH}" >&2
      echo "请先执行 npm run build:android:debug，或通过 --apk-path 指定现有 APK。" >&2
      exit 1
    fi
    install_debug_apk
  fi

  bash "${SCRIPT_DIR}/seed-emulator-media.sh" \
    --serial "${SERIAL}" \
    --clean \
    --continue-scan-layout >/dev/null

  configure_adb_reverse
  agent_device metro prepare \
    --public-base-url "${METRO_PUBLIC_BASE_URL}" \
    --project-root "${REPO_ROOT}" \
    --port "${METRO_PORT}" \
    --kind expo \
    --runtime-file "${RUN_DIR}/metro-runtime.json"

  open_app_with_session
  ensure_app_foreground
  prepare_active_session

  start_react_devtools_if_requested

  maybe_advance_past_landing_if_present "01-landing-ready" "02-landing-cta" || true
  ensure_media_permission_ready_for_scan "03-main-before-media-permission" "04-media-permission-dialog"
  open_photo_grid_screen_for_scan
  wait_for_photo_grid_ready_total_count "*" 15000

  agent_device_session wait 'id="photo-grid-start-scan-button"' 5000
  capture_step_artifacts "05-main-after-media-allow"
  press_photo_grid_start_button_best_effort "05-main-after-media-allow"
  capture_step_artifacts "06-first-scan-started"

  wait_for_scan_probe_outcome 0 0 "07" 90

  local initial_summary_json=""
  local initial_outcome=""
  initial_summary_json="$(cat "${RUN_DIR}/scan-probe-state.json")"
  initial_outcome="$(scan_probe_outcome_value "${initial_summary_json}")"
  local initial_persistence_summary_path=""
  initial_persistence_summary_path="$(capture_and_assert_scan_persistence "all-complete-initial-scan" "${initial_outcome}" "all-complete-initial")"

  if [[ "${initial_outcome}" != "exhausted" ]]; then
    echo "all-complete 前置期望首轮是 exhausted，当前却是: ${initial_outcome}" >&2
    exit 1
  fi

  press_photo_grid_start_button_best_effort "07-scan-exhausted"
  capture_step_artifacts "08-continue-scan-started"

  wait_for_scan_probe_outcome 0 0 "09" 90

  local next_summary_json=""
  local next_outcome=""
  next_summary_json="$(cat "${RUN_DIR}/scan-probe-state.json")"
  next_outcome="$(scan_probe_outcome_value "${next_summary_json}")"
  local next_persistence_summary_path=""
  next_persistence_summary_path="$(capture_and_assert_scan_persistence "all-complete-next-scan" "${next_outcome}" "all-complete-next")"

  if [[ "${next_outcome}" != "result-ready" ]]; then
    echo "all-complete 前置期望第二轮是 result-ready，当前却是: ${next_outcome}" >&2
    exit 1
  fi

  local all_complete_result_step="10-result-ready-before-clear"
  if ! agent_device_session wait 'id="scan-result-grid-item"' 2000 >/dev/null 2>&1; then
    if agent_device_session wait 'id="tab-button-Photos"' 2000 >/dev/null 2>&1; then
      press_photos_tab_best_effort || true
      ensure_app_foreground
      reattach_session_best_effort || true
    fi
  fi

  capture_step_artifacts "${all_complete_result_step}"
  if ! step_artifact_has_identifier "${all_complete_result_step}" "scan-result-grid-item"; then
    if ! open_issue_workspace_from_result_summary "${all_complete_result_step}"; then
      echo "all-complete 结果页未直接暴露 scan-result-grid-item，且无法通过 breakdown 卡片进入 issue workspace。" >&2
      exit 1
    fi
    all_complete_result_step="10b-result-issue-workspace-before-clear"
    agent_device_session wait 'id="scan-result-grid-item"' 5000
    capture_step_artifacts "${all_complete_result_step}"
  fi

  local expected_selection_count="0"
  expected_selection_count="$(count_identifier_occurrences_from_step_artifact "${all_complete_result_step}" "scan-result-grid-item")"
  if [[ ! "${expected_selection_count}" =~ ^[0-9]+$ || "${expected_selection_count}" -le 0 ]]; then
    echo "未能从扫描结果页识别到可选结果项，无法进入 all-complete 终态验证。" >&2
    exit 1
  fi

  if ! long_press_identifier_from_step_artifact "${all_complete_result_step}" "scan-result-grid-item"; then
    echo "未能对 scan-result-grid-item 执行 long press，无法进入 selection mode。" >&2
    exit 1
  fi
  agent_device_session wait 'id="photo-selection-toggle-button"' 5000
  capture_step_artifacts "11-selection-mode"

  local selection_attempt=0
  local cleanup_selected_count="0"
  while [[ "${selection_attempt}" -lt 3 ]]; do
    if ! press_identifier_from_step_artifact "11-selection-mode" "photo-selection-toggle-button"; then
      if ! tap_identifier_from_step_artifact "11-selection-mode" "photo-selection-toggle-button"; then
        agent_device_session press 'id="photo-selection-toggle-button"'
      fi
    fi
    agent_device_session wait 'id="cleanup-selected-button"' 5000
    capture_step_artifacts "12-selection-all"
    local cleanup_label=""
    cleanup_label="$(display_value_for_identifier_from_step_artifact "12-selection-all" "cleanup-selected-button")"
    cleanup_selected_count="$(parse_selected_count_from_label "${cleanup_label}")"
    if [[ "${cleanup_selected_count}" =~ ^[0-9]+$ && "${cleanup_selected_count}" -ge "${expected_selection_count}" ]]; then
      break
    fi
    if ! tap_identifier_from_step_artifact "12-selection-all" "photo-selection-toggle-button"; then
      agent_device_session press 'id="photo-selection-toggle-button"' >/dev/null 2>&1 || true
    fi
    selection_attempt="$((selection_attempt + 1))"
  done

  if [[ ! "${cleanup_selected_count}" =~ ^[0-9]+$ || "${cleanup_selected_count}" -lt "${expected_selection_count}" ]]; then
    echo "全选后未覆盖全部扫描结果项。期望至少 ${expected_selection_count}，实际 ${cleanup_selected_count:-<empty>}。" >&2
    exit 1
  fi

  if ! press_identifier_from_step_artifact "12-selection-all" "cleanup-selected-button"; then
    if ! tap_identifier_from_step_artifact "12-selection-all" "cleanup-selected-button"; then
      agent_device_session press 'id="cleanup-selected-button"'
    fi
  fi
  ensure_app_foreground

  agent_device_session wait 'id="photo-grid-scan-all-complete-title"' 10000
  capture_step_artifacts "13-all-complete"

  local all_complete_snapshot_path="${RUN_DIR}/all-complete-summary.json"
  local all_complete_summary_json=""
  agent_device_session snapshot -i -c --json > "${all_complete_snapshot_path}"
  all_complete_summary_json="$(scan_probe_summary_json "${all_complete_snapshot_path}")"
  local all_complete_outcome=""
  all_complete_outcome="$(scan_probe_outcome_value "${all_complete_summary_json}")"
  if [[ "${all_complete_outcome}" != "all-complete" ]]; then
    echo "清空 full batch 结果后未进入 all-complete，当前状态: ${all_complete_outcome}" >&2
    exit 1
  fi

  local final_persistence_summary_path=""
  final_persistence_summary_path="$(capture_and_assert_scan_persistence "all-complete-final" "${all_complete_outcome}" "all-complete-final")"

  collect_runtime_artifacts
  finish_react_devtools_if_connected

  cat <<EOF
agent-device all-complete probe 证据已生成:
  目录: ${RUN_DIR}
  最终 Snapshot: ${RUN_DIR}/snapshot.json
  最终 Screenshot: ${RUN_DIR}/current-screen.png
  分步证据目录: ${RUN_DIR}/steps
EOF
}

run_recycle_probe() {
  require_command adb
  require_command npx
  require_command node
  detect_android_serial
  reset_agent_device_state_if_idle
  close_conflicting_android_sessions
  mkdir -p "${ARTIFACT_ROOT}"
  prepare_run_dir

  trap cleanup_capture EXIT

  agent_device close --platform android --session "${SESSION}" >/dev/null 2>&1 || true
  agent_device devices --platform android --json > "${RUN_DIR}/devices.json"
  agent_device_target apps --json > "${RUN_DIR}/apps.json"

  if [[ "${INSTALL_APK}" -eq 1 ]]; then
    if [[ ! -f "${APK_PATH}" ]]; then
      echo "未找到 debug APK: ${APK_PATH}" >&2
      echo "请先执行 npm run build:android:debug，或通过 --apk-path 指定现有 APK。" >&2
      exit 1
    fi
    install_debug_apk
  fi

  configure_adb_reverse
  agent_device metro prepare \
    --public-base-url "${METRO_PUBLIC_BASE_URL}" \
    --project-root "${REPO_ROOT}" \
    --port "${METRO_PORT}" \
    --kind expo \
    --runtime-file "${RUN_DIR}/metro-runtime.json"

  seed_recycle_bin_fixture
  open_app_with_session
  ensure_app_foreground
  prepare_active_session
  grant_media_permissions_best_effort

  start_react_devtools_if_requested

  maybe_advance_past_landing_if_present "01-landing-ready" "02-landing-cta" || true

  capture_step_artifacts "02-main-tabs"
  open_recycle_bin_screen
  agent_device_session wait 1500 >/dev/null 2>&1 || true
  capture_step_artifacts "03-recycle-bin"

  if agent_device_session wait 'id="recycle-bin-item"' 5000 >/dev/null 2>&1 || step_artifact_has_identifier "03-recycle-bin" "recycle-bin-item"; then
    capture_step_artifacts "04-recycle-item-visible"
    if ! trigger_detail_action_from_step_artifact "04-recycle-item-visible" "recycle-bin-item"; then
      echo "多次尝试后仍未成功打开 recycle-bin-item 详情。" >&2
      exit 1
    fi
    if ! wait_for_recycle_detail_actions "04-recycle-item-visible" "05-recycle-detail"; then
      echo "多次尝试后仍未成功进入 recycle detail 动作区。" >&2
      exit 1
    fi
    capture_step_artifacts "05-recycle-detail"

    if ! trigger_detail_action_from_step_artifact "05-recycle-detail" "detail-primary-action"; then
      echo "多次尝试后仍未成功触发 recycle detail-primary-action。" >&2
      exit 1
    fi
    ensure_app_foreground
    agent_device_session wait 1000 >/dev/null 2>&1 || true
    capture_step_artifacts "06-recycle-return"
    if step_artifact_has_identifier "06-recycle-return" "recycle-bin-header-title"; then
      mv "${RUN_DIR}/steps/06-recycle-return" "${RUN_DIR}/steps/06-recycle-restored"
    else
      echo "restore 后未回到 recycle bin 页。" >&2
      exit 1
    fi
  else
    capture_step_artifacts "04-recycle-empty"
  fi

  collect_runtime_artifacts
  finish_react_devtools_if_connected

  cat <<EOF
agent-device recycle probe 证据已生成:
  目录: ${RUN_DIR}
  最终 Snapshot: ${RUN_DIR}/snapshot.json
  最终 Screenshot: ${RUN_DIR}/current-screen.png
  分步证据目录: ${RUN_DIR}/steps
EOF
}

run_recycle_selection_probe() {
  require_command adb
  require_command npx
  require_command node
  detect_android_serial
  reset_agent_device_state_if_idle
  close_conflicting_android_sessions
  mkdir -p "${ARTIFACT_ROOT}"
  prepare_run_dir

  trap cleanup_capture EXIT

  agent_device close --platform android --session "${SESSION}" >/dev/null 2>&1 || true
  agent_device devices --platform android --json > "${RUN_DIR}/devices.json"
  agent_device_target apps --json > "${RUN_DIR}/apps.json"

  if [[ "${INSTALL_APK}" -eq 1 ]]; then
    if [[ ! -f "${APK_PATH}" ]]; then
      echo "未找到 debug APK: ${APK_PATH}" >&2
      echo "请先执行 npm run build:android:debug，或通过 --apk-path 指定现有 APK。" >&2
      exit 1
    fi
    install_debug_apk
  fi

  configure_adb_reverse
  agent_device metro prepare \
    --public-base-url "${METRO_PUBLIC_BASE_URL}" \
    --project-root "${REPO_ROOT}" \
    --port "${METRO_PORT}" \
    --kind expo \
    --runtime-file "${RUN_DIR}/metro-runtime.json"

  bash "${SCRIPT_DIR}/seed-emulator-media.sh" \
    --serial "${SERIAL}" \
    --clean >/dev/null
  seed_recycle_bin_fixture --count 9
  open_app_with_session
  ensure_app_foreground
  prepare_active_session
  grant_media_permissions_best_effort

  start_react_devtools_if_requested

  maybe_advance_past_landing_if_present "01-landing-ready" "02-landing-cta" || true

  capture_step_artifacts "02-main-tabs"
  open_recycle_bin_screen
  agent_device_session wait 1500 >/dev/null 2>&1 || true
  if close_detail_viewer_if_present; then
    open_recycle_bin_screen
    agent_device_session wait 1000 >/dev/null 2>&1 || true
  fi
  capture_step_artifacts "03-recycle-bin"

  if ! agent_device_session wait 'id="recycle-bin-item"' 5000 >/dev/null 2>&1 \
    && ! step_artifact_has_identifier "03-recycle-bin" "recycle-bin-item"; then
    echo "recycle-selection 未观察到 recycle-bin-item。" >&2
    exit 1
  fi

  capture_step_artifacts "04-recycle-item-visible"
  if step_artifact_has_identifier "04-recycle-item-visible" "detail-close-button"; then
    close_detail_viewer_if_present || true
    open_recycle_bin_screen
    agent_device_session wait 1000 >/dev/null 2>&1 || true
    capture_step_artifacts "04-recycle-item-visible"
  fi

  local already_in_selection_mode=0
  if step_artifact_has_identifier "04-recycle-item-visible" "recycle-selection-toggle-button" \
    && step_artifact_has_identifier "04-recycle-item-visible" "recycle-delete-selected-button"; then
    echo "recycle-selection: 回收站已默认处于设计稿选择态，跳过旧版 long press 入口。"
    already_in_selection_mode=1
  else
    if ! long_press_identifier_from_step_artifact "04-recycle-item-visible" "recycle-bin-item"; then
      echo "未能对 recycle-bin-item 执行 long press，无法进入 recycle selection mode。" >&2
      exit 1
    fi
  fi

  if [[ "${already_in_selection_mode}" -eq 0 ]]; then
    agent_device_session wait 'id="recycle-selection-toggle-button"' 5000
    agent_device_session wait 'id="recycle-delete-selected-button"' 5000
  fi
  capture_step_artifacts "05-recycle-selection-mode"

  if ! step_artifact_has_identifier "05-recycle-selection-mode" "recycle-restore-selected-button" \
    && ! step_artifact_has_identifier "04-recycle-item-visible" "recycle-restore-selected-button"; then
    echo "recycle selection mode 未观察到底部保留动作区。" >&2
    exit 1
  fi

  if ! step_artifact_has_identifier "05-recycle-selection-mode" "recycle-delete-selected-button" \
    && ! step_artifact_has_identifier "04-recycle-item-visible" "recycle-delete-selected-button"; then
    echo "recycle selection mode 未观察到底部保留/清理动作区。" >&2
    exit 1
  fi

  collect_runtime_artifacts
  finish_react_devtools_if_connected

  cat <<EOF
agent-device recycle selection 证据已生成:
  目录: ${RUN_DIR}
  最终 Snapshot: ${RUN_DIR}/snapshot.json
  最终 Screenshot: ${RUN_DIR}/current-screen.png
  分步证据目录: ${RUN_DIR}/steps
EOF
}

run_recycle_delete_probe() {
  require_command adb
  require_command npx
  require_command node
  detect_android_serial
  reset_agent_device_state_if_idle
  close_conflicting_android_sessions
  mkdir -p "${ARTIFACT_ROOT}"
  prepare_run_dir

  trap cleanup_capture EXIT

  agent_device close --platform android --session "${SESSION}" >/dev/null 2>&1 || true
  agent_device devices --platform android --json > "${RUN_DIR}/devices.json"
  agent_device_target apps --json > "${RUN_DIR}/apps.json"

  if [[ "${INSTALL_APK}" -eq 1 ]]; then
    if [[ ! -f "${APK_PATH}" ]]; then
      echo "未找到 debug APK: ${APK_PATH}" >&2
      echo "请先执行 npm run build:android:debug，或通过 --apk-path 指定现有 APK。" >&2
      exit 1
    fi
    install_debug_apk
  fi

  configure_adb_reverse
  agent_device metro prepare \
    --public-base-url "${METRO_PUBLIC_BASE_URL}" \
    --project-root "${REPO_ROOT}" \
    --port "${METRO_PORT}" \
    --kind expo \
    --runtime-file "${RUN_DIR}/metro-runtime.json"

  seed_recycle_bin_fixture
  open_app_with_session
  ensure_app_foreground
  prepare_active_session
  agent_device_session settings permission grant photos >/dev/null 2>&1 || true

  start_react_devtools_if_requested

  maybe_advance_past_landing_if_present "01-landing-ready" "02-landing-cta" || true

  capture_step_artifacts "02-main-tabs"
  open_recycle_bin_screen
  agent_device_session wait 1500 >/dev/null 2>&1 || true
  capture_step_artifacts "03-recycle-bin"

  if agent_device_session wait 'id="recycle-bin-item"' 5000 >/dev/null 2>&1 || step_artifact_has_identifier "03-recycle-bin" "recycle-bin-item"; then
    capture_step_artifacts "04-recycle-item-visible"
    if ! trigger_detail_action_from_step_artifact "04-recycle-item-visible" "recycle-bin-item"; then
      echo "多次尝试后仍未成功打开 recycle-bin-item 详情。" >&2
      exit 1
    fi
    if ! wait_for_recycle_detail_actions "04-recycle-item-visible" "05-recycle-detail"; then
      echo "多次尝试后仍未成功进入 recycle detail 动作区。" >&2
      exit 1
    fi
    capture_step_artifacts "05-recycle-detail"

    if ! trigger_detail_action_from_step_artifact \
      "05-recycle-detail" \
      "detail-hard-delete" \
      "com.google.android.providers.media.module"; then
      echo "多次尝试后仍未成功触发 detail-hard-delete。" >&2
      exit 1
    fi

    if handle_in_app_delete_confirmation_if_present; then
      agent_device_session wait 700 >/dev/null 2>&1 || true
    fi

    if wait_for_media_permission_dialog; then
      capture_step_artifacts "05-recycle-delete-media-permission"
      press_system_allow
    fi

    if handle_external_media_delete_confirmation_if_present; then
      :
    elif agent_device_session wait 'id="android:id/button1"' 3000 >/dev/null 2>&1; then
      capture_step_artifacts "05-recycle-delete-confirmation"
      press_system_allow
    elif agent_device_session wait 'text="Allow"' 3000 >/dev/null 2>&1; then
      capture_step_artifacts "05-recycle-delete-confirmation"
      press_system_allow
    fi
    ensure_app_foreground
    open_recycle_bin_screen
    agent_device_session wait 1000 >/dev/null 2>&1 || true
    capture_step_artifacts "06-recycle-delete-return"
    if step_artifact_has_identifier "06-recycle-delete-return" "recycle-bin-empty-title"; then
      mv "${RUN_DIR}/steps/06-recycle-delete-return" "${RUN_DIR}/steps/06-recycle-deleted-empty"
    elif step_artifact_has_identifier "06-recycle-delete-return" "recycle-bin-header-title" \
      && ! step_artifact_has_identifier "06-recycle-delete-return" "recycle-bin-item"; then
      mv "${RUN_DIR}/steps/06-recycle-delete-return" "${RUN_DIR}/steps/06-recycle-deleted"
    else
      echo "hard delete 后未回到 recycle bin 页。" >&2
      exit 1
    fi
  else
    capture_step_artifacts "04-recycle-empty"
  fi

  collect_runtime_artifacts
  finish_react_devtools_if_connected

  cat <<EOF
agent-device recycle delete probe 证据已生成:
  目录: ${RUN_DIR}
  最终 Snapshot: ${RUN_DIR}/snapshot.json
  最终 Screenshot: ${RUN_DIR}/current-screen.png
  分步证据目录: ${RUN_DIR}/steps
EOF
}

run_react_probe() {
  require_command adb
  require_command npx
  detect_android_serial
  reset_agent_device_state_if_idle
  close_conflicting_android_sessions
  mkdir -p "${ARTIFACT_ROOT}"
  prepare_run_dir

  configure_adb_reverse
  agent_device metro prepare \
    --public-base-url "${METRO_PUBLIC_BASE_URL}" \
    --project-root "${REPO_ROOT}" \
    --port "${METRO_PORT}" \
    --kind expo \
    --runtime-file "${RUN_DIR}/metro-runtime.json"
  open_app_with_session
  agent_device_session react-devtools start
  trap 'agent_device_session react-devtools stop >/dev/null 2>&1 || true; agent_device_session close >/dev/null 2>&1 || true' EXIT
  agent_device_session react-devtools wait --connected
  agent_device_session react-devtools status --json > "${RUN_DIR}/react-status.json"
  agent_device_session react-devtools get tree --depth 3 --json > "${RUN_DIR}/react-tree.json"

  cat <<EOF
react-devtools 证据已生成:
  目录: ${RUN_DIR}
  Status: ${RUN_DIR}/react-status.json
  Tree: ${RUN_DIR}/react-tree.json
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --serial)
      SERIAL="$2"
      shift 2
      ;;
    --artifact-root)
      ARTIFACT_ROOT="$2"
      shift 2
      ;;
    --session)
      SESSION="$2"
      shift 2
      ;;
    --app-id)
      APP_ID="$2"
      shift 2
      ;;
    --apk-path)
      APK_PATH="$2"
      shift 2
      ;;
    --agent-device-version)
      AGENT_DEVICE_VERSION="$2"
      shift 2
      ;;
    --metro-port)
      METRO_PORT="$2"
      METRO_PUBLIC_BASE_URL="http://127.0.0.1:${METRO_PORT}"
      shift 2
      ;;
    --public-base-url)
      METRO_PUBLIC_BASE_URL="$2"
      shift 2
      ;;
    --install-apk)
      INSTALL_APK=1
      shift
      ;;
    --react-devtools)
      ENABLE_REACT_DEVTOOLS=1
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

case "${COMMAND}" in
  capture)
    run_and_exit run_capture
    ;;
  smoke)
    run_and_exit run_smoke
    ;;
  doctor)
    run_and_exit run_doctor
    ;;
  react)
    run_and_exit run_react_probe
    ;;
  acceptance)
    run_and_exit run_acceptance
    ;;
  scan-probe)
    run_and_exit run_scan_probe
    ;;
  scan-complete)
    run_and_exit run_scan_complete_probe
    ;;
  continue-scan)
    run_and_exit run_continue_scan_probe
    ;;
  all-complete)
    run_and_exit run_all_complete_probe
    ;;
  permission-denied)
    run_and_exit run_permission_denied_probe
    ;;
  scan-cleanup)
    run_and_exit run_scan_cleanup_probe
    ;;
  settings-signoff)
    run_and_exit run_settings_signoff_probe
    ;;
  filtering-selection)
    run_and_exit run_filtering_selection_probe
    ;;
  recycle)
    run_and_exit run_recycle_probe
    ;;
  recycle-selection)
    run_and_exit run_recycle_selection_probe
    ;;
  recycle-delete)
    run_and_exit run_recycle_delete_probe
    ;;
  help)
    usage
    exit 0
    ;;
  *)
    echo "未知命令: ${COMMAND}" >&2
    usage >&2
    exit 1
    ;;
esac
