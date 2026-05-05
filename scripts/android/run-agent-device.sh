#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
STATE_DIR="${AGENT_DEVICE_STATE_DIR:-${REPO_ROOT}/.tmp/agent-device}"
PINNED_VERSION="${AGENT_DEVICE_VERSION:-0.14.7}"
LOCAL_BIN="${REPO_ROOT}/node_modules/.bin/agent-device"

mkdir -p "${STATE_DIR}"

HAS_STATE_DIR_FLAG=0
for argument in "$@"; do
  if [[ "${argument}" == "--state-dir" ]]; then
    HAS_STATE_DIR_FLAG=1
    break
  fi
done

EXTRA_ARGS=()
if [[ "${HAS_STATE_DIR_FLAG}" -eq 0 ]]; then
  EXTRA_ARGS+=(--state-dir "${STATE_DIR}")
fi

if [[ $# -eq 0 ]]; then
  set -- help workflow
fi

if [[ -x "${LOCAL_BIN}" ]]; then
  exec "${LOCAL_BIN}" "${EXTRA_ARGS[@]}" "$@"
fi

echo "未检测到本地 agent-device，回退到 npx agent-device@${PINNED_VERSION}。" >&2
exec npx -y "agent-device@${PINNED_VERSION}" "${EXTRA_ARGS[@]}" "$@"
