#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
TMP_DIR="${TMPDIR:-/tmp}/app-cleaner-emulator-db"
DB_LOCAL_PATH="${TMP_DIR}/app-cleaner-operational.db"
DB_VERIFY_PATH="${TMP_DIR}/app-cleaner-operational.verify.db"
DB_REMOTE_TMP_PATH="/data/local/tmp/app-cleaner-operational.db"
RK_LOCAL_PATH="${TMP_DIR}/RKStorage"
RK_VERIFY_PATH="${TMP_DIR}/RKStorage.verify"
RK_REMOTE_TMP_PATH="/data/local/tmp/RKStorage"
MEDIASTORE_DUMP_PATH="${TMP_DIR}/mediastore-media-clean-seed.txt"

SERIAL="${ANDROID_SERIAL:-}"
APP_ID="com.jt.mistapmediacleaner"
APP_DATA_DIR="/data/user/0/${APP_ID}"
TARGET_ASSET_ID="${TARGET_ASSET_ID:-}"
TARGET_BUCKET_NAME="${TARGET_BUCKET_NAME:-MediaCleanSeed}"
TARGET_MEDIA_TYPE="${TARGET_MEDIA_TYPE:-photo}"

usage() {
  cat <<'EOF'
用法:
  bash scripts/android/seed-emulator-scan-result.sh --serial <android-serial> [--asset-id <id>] [--bucket <name>] [--media-type <photo|video>]

说明:
  从 emulator 当前 operational store 的 asset_manifest 构造一条确定性的“已完成扫描结果”，
  直接写入 candidate_view / candidate_view_meta 与 legacy RKStorage，供 scan-cleanup / detail / recycle 回流链路稳定复用。

选项:
  --serial <serial>              指定目标 Android serial
  --asset-id <id>                显式指定要构造成扫描结果的 asset_id
  --bucket <name>                若未指定 asset_id，则优先从该 bucket 里选择媒体，默认 MediaCleanSeed
  --media-type <photo|video>     若未指定 asset_id，则优先选择该媒体类型，默认 photo
  -h, --help                     打印帮助
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
    --asset-id)
      TARGET_ASSET_ID="$2"
      shift 2
      ;;
    --bucket)
      TARGET_BUCKET_NAME="$2"
      shift 2
      ;;
    --media-type)
      TARGET_MEDIA_TYPE="$2"
      shift 2
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
require_command sqlite3
require_command python3

if [[ -z "${SERIAL}" ]]; then
  echo "请通过 --serial 指定目标 Android emulator。" >&2
  exit 1
fi

if [[ "$(adb devices | awk -v serial="${SERIAL}" '$1 == serial { print $2 }')" != "device" ]]; then
  echo "指定设备不可用: ${SERIAL}" >&2
  exit 1
fi

mkdir -p "${TMP_DIR}"

adb -s "${SERIAL}" shell am force-stop "${APP_ID}" >/dev/null 2>&1 || true
adb -s "${SERIAL}" exec-out run-as "${APP_ID}" cat "${APP_DATA_DIR}/files/SQLite/app-cleaner-operational.db" > "${DB_LOCAL_PATH}"
adb -s "${SERIAL}" exec-out run-as "${APP_ID}" cat "${APP_DATA_DIR}/databases/RKStorage" > "${RK_LOCAL_PATH}"
adb -s "${SERIAL}" shell content query --uri content://media/external/file > "${MEDIASTORE_DUMP_PATH}"

if [[ ! -s "${DB_LOCAL_PATH}" ]]; then
  echo "未能拉取 operational store: ${DB_LOCAL_PATH}" >&2
  exit 1
fi

if [[ ! -s "${RK_LOCAL_PATH}" ]]; then
  echo "未能拉取 RKStorage: ${RK_LOCAL_PATH}" >&2
  exit 1
fi

SEED_SUMMARY_JSON="$(
  TARGET_ASSET_ID="${TARGET_ASSET_ID}" \
  TARGET_BUCKET_NAME="${TARGET_BUCKET_NAME}" \
  TARGET_MEDIA_TYPE="${TARGET_MEDIA_TYPE}" \
  DB_LOCAL_PATH="${DB_LOCAL_PATH}" \
  RK_LOCAL_PATH="${RK_LOCAL_PATH}" \
  MEDIASTORE_DUMP_PATH="${MEDIASTORE_DUMP_PATH}" \
  python3 - <<'PY'
import json
import os
import re
import sqlite3
import sys
import time

db_path = os.environ["DB_LOCAL_PATH"]
rk_path = os.environ["RK_LOCAL_PATH"]
media_store_dump_path = os.environ["MEDIASTORE_DUMP_PATH"]
target_asset_id = os.environ.get("TARGET_ASSET_ID", "").strip()
target_bucket_name = os.environ.get("TARGET_BUCKET_NAME", "MediaCleanSeed").strip()
target_media_type = os.environ.get("TARGET_MEDIA_TYPE", "photo").strip()
updated_at = int(time.time() * 1000)

db = sqlite3.connect(db_path)
db.row_factory = sqlite3.Row
rk = sqlite3.connect(rk_path)
rk.row_factory = sqlite3.Row

asset_rows = db.execute(
    """
    select
      asset_id,
      content_uri,
      media_type,
      mime_type,
      width,
      height,
      duration_ms,
      file_size_bytes,
      coalesce(date_taken, date_modified, updated_at, ?) as creation_time,
      bucket_name,
      updated_at
    from asset_manifest
    where is_deleted = 0
    order by updated_at desc, asset_id desc
    """,
    (updated_at,),
).fetchall()

def normalize_media_store_row(row):
    media_type_code = str(row.get("media_type") or "").strip()
    if media_type_code == "1":
        media_type = "photo"
        content_uri = f"content://media/external/images/media/{row['_id']}"
    elif media_type_code == "3":
        media_type = "video"
        content_uri = f"content://media/external/video/media/{row['_id']}"
    else:
        return None

    bucket_name = row.get("bucket_display_name")
    if bucket_name != target_bucket_name:
        return None

    return {
        "asset_id": str(row["_id"]),
        "content_uri": content_uri,
        "media_type": media_type,
        "mime_type": row.get("mime_type"),
        "width": int(row.get("width") or 0),
        "height": int(row.get("height") or 0),
        "duration_ms": int(row.get("duration") or 0),
        "file_size_bytes": int(row.get("_size") or 0),
        "creation_time": int((row.get("date_modified") or row.get("date_added") or 0)) * 1000 or updated_at,
        "bucket_name": bucket_name,
        "updated_at": updated_at,
    }

if not asset_rows:
    fallback_rows = []
    try:
        with open(media_store_dump_path, "r", encoding="utf-8") as fh:
            for raw_line in fh:
                line = raw_line.strip()
                if not line.startswith("Row: "):
                    continue
                pairs = {}
                for part in re.split(r", (?=[A-Za-z_]+=)", line):
                    if " " in part and part.startswith("Row: "):
                        part = part.split(" ", 2)[-1]
                    if "=" not in part:
                        continue
                    key, value = part.split("=", 1)
                    pairs[key.strip()] = None if value == "NULL" else value
                normalized = normalize_media_store_row(pairs)
                if normalized:
                    fallback_rows.append(normalized)
    except FileNotFoundError:
        fallback_rows = []

    asset_rows = fallback_rows

if not asset_rows:
    print("asset_manifest 与 MediaStore 都未提供可用样例媒体，无法构造 deterministic scan result。", file=sys.stderr)
    sys.exit(1)

authorized_candidates = []
scope_total = 0
scope_photo = 0
scope_video = 0

def build_asset(row):
    media_type = row["media_type"]
    return {
        "id": row["asset_id"],
        "uri": row["content_uri"],
        "previewUri": row["content_uri"],
        "mediaType": media_type,
        "width": max(0, int(row["width"] or 0)),
        "height": max(0, int(row["height"] or 0)),
        "duration": max(0, int(row["duration_ms"] or 0)),
        "fileSize": max(0, int(row["file_size_bytes"] or 0)),
        "creationTime": int(row["creation_time"] or updated_at),
    }

for row in asset_rows:
    asset = build_asset(row)
    authorized_candidates.append(
        {
            "id": row["asset_id"],
            "asset": asset,
            "score": 0,
            "confidence": "medium",
            "kind": "abnormal-video" if asset["mediaType"] == "video" else "abnormal-photo",
            "primaryIssueType": "abnormal",
            "issueTypes": ["abnormal"],
            "reasons": [],
        }
    )
    scope_total += 1
    if asset["mediaType"] == "photo":
      scope_photo += 1
    if asset["mediaType"] == "video":
      scope_video += 1

target_row = None
if target_asset_id:
    target_row = next((row for row in asset_rows if row["asset_id"] == target_asset_id), None)
    if target_row is None:
        print(f"未找到指定 asset_id={target_asset_id} 对应的 asset_manifest 记录。", file=sys.stderr)
        sys.exit(1)
else:
    scoped_rows = [row for row in asset_rows if row["bucket_name"] == target_bucket_name]
    typed_rows = [row for row in scoped_rows if row["media_type"] == target_media_type]
    target_row = (typed_rows or scoped_rows or asset_rows)[0]

target_asset = build_asset(target_row)
target_candidate = {
    "id": target_row["asset_id"],
    "asset": target_asset,
    "score": 92,
    "confidence": "high",
    "kind": "abnormal-video" if target_asset["mediaType"] == "video" else "abnormal-photo",
    "primaryIssueType": "abnormal",
    "issueTypes": ["abnormal"],
    "reasons": [
        "Seeded cleanup probe candidate",
        "Deterministic observability fixture",
    ],
}

summary = {
    "scannedAt": updated_at,
    "scannedCount": scope_total,
    "candidateCount": 1,
    "highConfidenceCount": 1,
    "mediumConfidenceCount": 0,
    "recycleBinCount": 0,
}

db.execute("delete from candidate_view")
db.execute("delete from candidate_view_meta")
db.execute("delete from recognition_group")
db.execute("delete from recognition_member")
db.execute(
    """
    insert into candidate_view_meta(id, summary_json, updated_at)
    values(1, ?, ?)
    """,
    (json.dumps(summary, ensure_ascii=False, separators=(",", ":")), updated_at),
)
db.execute(
    """
    insert into candidate_view(
      asset_id,
      batch_id,
      rank,
      score,
      confidence,
      primary_issue_type,
      candidate_json,
      updated_at
    ) values(?, null, 0, ?, ?, ?, ?, ?)
    """,
    (
        target_candidate["asset"]["id"],
        target_candidate["score"],
        target_candidate["confidence"],
        target_candidate["primaryIssueType"],
        json.dumps(target_candidate, ensure_ascii=False, separators=(",", ":")),
        updated_at,
    ),
)
db.commit()

result_cache = {
    "activeCandidates": [target_candidate],
    "summary": summary,
}
session_snapshot = {
    "permissionState": "granted",
    "phase": "completed",
    "authorizedCandidates": authorized_candidates,
    "visibleCandidates": [target_candidate],
    "scanResultsCount": 1,
    "scanProgress": {
        "current": scope_total,
        "total": scope_total,
        "currentFileName": None,
    },
    "scanScopeSelection": {
        "total": scope_total,
        "photo": scope_photo,
        "video": scope_video,
    },
    "scanBatchRange": None,
    "summary": {
        "scannedAt": updated_at,
        "scannedCount": scope_total,
        "recycleBinCount": 0,
    },
    "hasCompletedFullScan": False,
    "errorMessage": None,
    "updatedAt": updated_at,
}

for key, value in (
    ("app-cleaner/photo-scan-result-cache", result_cache),
    ("app-cleaner/photo-scan-session", session_snapshot),
):
    rk.execute(
        """
        insert into catalystLocalStorage(key, value)
        values(?, ?)
        on conflict(key) do update set value = excluded.value
        """,
        (key, json.dumps(value, ensure_ascii=False, separators=(",", ":"))),
    )
rk.commit()

print(
    json.dumps(
        {
            "targetAssetId": target_candidate["asset"]["id"],
            "targetMediaType": target_candidate["asset"]["mediaType"],
            "bucketName": target_row["bucket_name"],
            "authorizedCount": scope_total,
            "summary": summary,
        },
        ensure_ascii=False,
        separators=(",", ":"),
    )
)
PY
)"

adb -s "${SERIAL}" push "${DB_LOCAL_PATH}" "${DB_REMOTE_TMP_PATH}" >/dev/null
adb -s "${SERIAL}" shell "run-as ${APP_ID} sh -c 'cat ${DB_REMOTE_TMP_PATH} > files/SQLite/app-cleaner-operational.db'" >/dev/null
adb -s "${SERIAL}" exec-out run-as "${APP_ID}" cat "${APP_DATA_DIR}/files/SQLite/app-cleaner-operational.db" > "${DB_VERIFY_PATH}"
adb -s "${SERIAL}" push "${RK_LOCAL_PATH}" "${RK_REMOTE_TMP_PATH}" >/dev/null
adb -s "${SERIAL}" shell "run-as ${APP_ID} sh -c 'cat ${RK_REMOTE_TMP_PATH} > databases/RKStorage'" >/dev/null
adb -s "${SERIAL}" exec-out run-as "${APP_ID}" cat "${APP_DATA_DIR}/databases/RKStorage" > "${RK_VERIFY_PATH}"

echo "已写入 deterministic scan result 到 ${SERIAL}:"
echo "  概要: ${SEED_SUMMARY_JSON}"
echo
echo "当前 candidate_view_meta:"
sqlite3 "${DB_VERIFY_PATH}" "select summary_json from candidate_view_meta;"
echo
echo "当前 candidate_view:"
sqlite3 "${DB_VERIFY_PATH}" "select asset_id, score, confidence, primary_issue_type from candidate_view;"
echo
echo "当前 legacy result cache key:"
sqlite3 "${RK_VERIFY_PATH}" "select substr(value,1,240) from catalystLocalStorage where key='app-cleaner/photo-scan-result-cache';"
