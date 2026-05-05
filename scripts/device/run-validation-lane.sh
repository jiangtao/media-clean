#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
ANDROID_SCRIPT="${REPO_ROOT}/scripts/android/run-agent-device-observability.sh"
ANDROID_SEED_MEDIA_SCRIPT="${REPO_ROOT}/scripts/android/seed-emulator-media.sh"
ANDROID_SEED_RECYCLE_SCRIPT="${REPO_ROOT}/scripts/android/seed-emulator-recycle-bin.sh"

usage() {
  cat <<'EOF'
用法:
  bash scripts/device/run-validation-lane.sh <platform> <lane> --serial <device-serial> [--artifact-root <dir>] [--react-devtools]

当前已实现:
  android emulator-core
  android emulator-seeded
  android real-device-core

说明:
  1. 同一台设备上的写状态 flow 必须串行，本脚本按 lane 顺序执行。
  2. 并行应发生在“不同 job / 不同 serial / 不同设备 lane”层面，而不是同一 serial 内部。
  3. iOS lane 预留 contract，当前尚未实现 adapter。
EOF
}

if [[ $# -lt 2 ]]; then
  usage >&2
  exit 1
fi

PLATFORM="$1"
LANE="$2"
shift 2

SERIAL=""
ARTIFACT_ROOT=""
OBS_ARGS=()
SESSION_NAME=""
CURRENT_STEP=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --serial)
      SERIAL="${2:-}"
      OBS_ARGS+=("$1" "$2")
      shift 2
      ;;
    --session)
      SESSION_NAME="${2:-}"
      OBS_ARGS+=("$1" "$2")
      shift 2
      ;;
    --artifact-root)
      ARTIFACT_ROOT="${2:-}"
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      OBS_ARGS+=("$1")
      shift
      ;;
  esac
done

if [[ -z "${SERIAL}" ]]; then
  echo "必须显式传入 --serial，避免 lane 误用到错误设备。" >&2
  exit 1
fi

if [[ -z "${SESSION_NAME}" ]]; then
  SESSION_NAME="$(printf 'device-validation-%s-%s-%s' "${PLATFORM}" "${LANE}" "${SERIAL}" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9._-' '-')"
  OBS_ARGS+=(--session "${SESSION_NAME}")
fi

run_step() {
  local label="$1"
  shift
  CURRENT_STEP="${label}"
  echo "==> ${label}"
  "$@"
}

write_lane_summary() {
  local exit_code="$1"
  local status="failed"
  local completed_at=""
  local summary_path="${ARTIFACT_ROOT}/lane-summary.json"

  if [[ "${exit_code}" -eq 0 ]]; then
    status="passed"
  fi

  completed_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

  node - <<'EOF' "${summary_path}" "${PLATFORM}" "${LANE}" "${SERIAL}" "${status}" "${exit_code}" "${CURRENT_STEP}" "${ARTIFACT_ROOT}" "${completed_at}"
const fs = require('fs');
const [
  ,
  ,
  summaryPath,
  platform,
  lane,
  serial,
  status,
  exitCode,
  currentStep,
  artifactRoot,
  completedAt,
] = process.argv;

const payload = {
  platform,
  lane,
  serial,
  status,
  exitCode: Number(exitCode),
  lastStep: currentStep || null,
  artifacts: artifactRoot,
  completedAt,
};

fs.mkdirSync(require('path').dirname(summaryPath), { recursive: true });
fs.writeFileSync(summaryPath, JSON.stringify(payload, null, 2) + '\n');
EOF
}

android_probe() {
  local probe="$1"
  local probe_artifact_root="$2"
  shift 2

  run_step \
    "android ${LANE} :: ${probe}" \
    bash "${ANDROID_SCRIPT}" "${probe}" --install-apk --artifact-root "${probe_artifact_root}" "${OBS_ARGS[@]}" "$@"
}

android_seed_media() {
  local extra_args=("$@")
  if ((${#extra_args[@]} > 0)); then
    run_step \
      "android ${LANE} :: seed media" \
      bash "${ANDROID_SEED_MEDIA_SCRIPT}" --serial "${SERIAL}" "${extra_args[@]}"
  else
    run_step \
      "android ${LANE} :: seed media" \
      bash "${ANDROID_SEED_MEDIA_SCRIPT}" --serial "${SERIAL}"
  fi
}

android_seed_recycle_bin() {
  local extra_args=("$@")
  if ((${#extra_args[@]} > 0)); then
    run_step \
      "android ${LANE} :: seed recycle bin" \
      bash "${ANDROID_SEED_RECYCLE_SCRIPT}" --serial "${SERIAL}" "${extra_args[@]}"
  else
    run_step \
      "android ${LANE} :: seed recycle bin" \
      bash "${ANDROID_SEED_RECYCLE_SCRIPT}" --serial "${SERIAL}"
  fi
}

if [[ -z "${ARTIFACT_ROOT}" ]]; then
  ARTIFACT_ROOT="artifacts/device-validation/${PLATFORM}/${LANE}"
fi

mkdir -p "${ARTIFACT_ROOT}"
trap 'write_lane_summary "$?"' EXIT

case "${PLATFORM}:${LANE}" in
  android:emulator-core)
    android_probe capture "${ARTIFACT_ROOT}/capture"
    android_probe smoke "${ARTIFACT_ROOT}/smoke"
    android_probe acceptance "${ARTIFACT_ROOT}/acceptance"
    android_probe permission-denied "${ARTIFACT_ROOT}/permission-denied"
    ;;
  android:emulator-seeded)
    android_seed_media --clean
    android_probe scan-probe "${ARTIFACT_ROOT}/scan-probe"
    android_probe continue-scan "${ARTIFACT_ROOT}/continue-scan"
    android_seed_media --clean
    android_probe scan-cleanup "${ARTIFACT_ROOT}/scan-cleanup"
    android_seed_recycle_bin
    android_probe recycle "${ARTIFACT_ROOT}/recycle"
    android_seed_recycle_bin
    android_probe recycle-delete "${ARTIFACT_ROOT}/recycle-delete"
    ;;
  android:real-device-core)
    android_probe capture "${ARTIFACT_ROOT}/capture"
    android_probe acceptance "${ARTIFACT_ROOT}/acceptance"
    android_probe permission-denied "${ARTIFACT_ROOT}/permission-denied"
    android_probe scan-probe "${ARTIFACT_ROOT}/scan-probe"
    android_probe scan-complete "${ARTIFACT_ROOT}/scan-complete"
    ;;
  ios:*)
    echo "iOS lane contract 已预留，但当前尚未实现 adapter: ${LANE}" >&2
    exit 2
    ;;
  *)
    echo "不支持的 platform/lane: ${PLATFORM} ${LANE}" >&2
    usage >&2
    exit 1
    ;;
esac

cat <<EOF
device validation lane 已完成:
  platform: ${PLATFORM}
  lane: ${LANE}
  serial: ${SERIAL}
  artifacts: ${ARTIFACT_ROOT}
EOF
