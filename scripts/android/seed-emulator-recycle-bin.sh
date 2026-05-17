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
MEDIASTORE_DUMP_PATH="${TMP_DIR}/mediastore-recycle-seed.txt"

SERIAL="${ANDROID_SERIAL:-}"
APP_ID="com.jt.mistapmediacleaner"
APP_DATA_DIR="/data/user/0/${APP_ID}"
TARGET_ASSET_ID="${TARGET_ASSET_ID:-}"
TARGET_BUCKET_NAME="${TARGET_BUCKET_NAME:-MediaCleanSeed}"
TARGET_MEDIA_TYPE="${TARGET_MEDIA_TYPE:-photo}"
TARGET_COUNT="${TARGET_COUNT:-1}"
CLEAR_FIRST=1

usage() {
  cat <<'EOF'
用法:
  bash scripts/android/seed-emulator-recycle-bin.sh --serial <android-serial> [--asset-id <id>] [--bucket <name>] [--media-type <photo|video>] [--count <n>] [--keep-existing]

说明:
  从 emulator 中已存在的 operational store 读取真实 asset_manifest，
  然后把目标 asset_id 写入 recycle_bin_state，便于后续验证 Recycle Bin / restore 流程。
  未指定 --asset-id 时，可用 --count 构造多图回收站 fixture，便于设计签收采集密集网格。

选项:
  --serial <serial>        指定目标 Android serial
  --asset-id <id>          指定要写入 recycle_bin_state 的 asset_id
  --bucket <name>          若未指定 asset_id，则优先从该 bucket 中选择最新 asset，默认 MediaCleanSeed
  --media-type <photo|video> 若未指定 asset_id，则优先选择该媒体类型，默认 photo
  --count <n>              若未指定 asset_id，最多写入 n 个回收站条目，默认 1
  --keep-existing          保留已有 recycle_bin_state，不先清空
  -h, --help               打印帮助
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
    --count)
      TARGET_COUNT="$2"
      shift 2
      ;;
    --keep-existing)
      CLEAR_FIRST=0
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
require_command sqlite3
require_command python3

if [[ -z "${SERIAL}" ]]; then
  echo "请通过 --serial 指定目标 Android emulator。" >&2
  exit 1
fi

if ! [[ "${TARGET_COUNT}" =~ ^[1-9][0-9]*$ ]]; then
  echo "--count 必须是正整数，当前: ${TARGET_COUNT}" >&2
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

RECYCLE_BIN_SEED_JSON="$(
  TARGET_ASSET_ID="${TARGET_ASSET_ID}" \
  TARGET_BUCKET_NAME="${TARGET_BUCKET_NAME}" \
  TARGET_MEDIA_TYPE="${TARGET_MEDIA_TYPE}" \
  TARGET_COUNT="${TARGET_COUNT}" \
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
target_count = max(1, int(os.environ.get("TARGET_COUNT", "1")))
updated_at = int(time.time() * 1000)

def open_sqlite_or_none(path):
    try:
        conn = sqlite3.connect(path)
        conn.row_factory = sqlite3.Row
        conn.execute("select name from sqlite_master limit 1")
        return conn
    except sqlite3.DatabaseError:
        return None

db = open_sqlite_or_none(db_path)
rk = open_sqlite_or_none(rk_path)
if rk is None:
    try:
        if os.path.exists(rk_path):
            os.remove(rk_path)
    except OSError:
        pass
    rk = sqlite3.connect(rk_path)
    rk.row_factory = sqlite3.Row
    rk.execute(
        """
        CREATE TABLE IF NOT EXISTS catalystLocalStorage (
          key TEXT PRIMARY KEY,
          value TEXT
        )
        """
    )
    rk.commit()

def normalize_media_store_row(row):
    if str(row.get("is_pending") or "").strip() == "1":
        return None
    if str(row.get("is_trashed") or "").strip() == "1":
        return None

    media_type_code = str(row.get("media_type") or "").strip()
    if media_type_code == "1":
        media_type = "photo"
        content_uri = f"content://media/external/images/media/{row['_id']}"
    elif media_type_code == "3":
        media_type = "video"
        content_uri = f"content://media/external/video/media/{row['_id']}"
    else:
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
        "bucket_name": row.get("bucket_display_name"),
        "updated_at": updated_at,
    }

asset_rows = []
if db is not None:
    try:
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
    except sqlite3.DatabaseError:
        asset_rows = []

asset_index = {}
for row in asset_rows:
    asset_index[str(row["asset_id"])] = {
        "asset_id": str(row["asset_id"]),
        "content_uri": row["content_uri"],
        "media_type": row["media_type"],
        "mime_type": row["mime_type"],
        "width": int(row["width"] or 0),
        "height": int(row["height"] or 0),
        "duration_ms": int(row["duration_ms"] or 0),
        "file_size_bytes": int(row["file_size_bytes"] or 0),
        "creation_time": int(row["creation_time"] or updated_at),
        "bucket_name": row["bucket_name"],
        "updated_at": int(row["updated_at"] or updated_at),
    }

visible_asset_ids = set()
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
                visible_asset_ids.add(normalized["asset_id"])
                asset_index.setdefault(normalized["asset_id"], normalized)
except FileNotFoundError:
    pass

asset_records = list(asset_index.values())
selectable_asset_records = (
    [row for row in asset_records if row["asset_id"] in visible_asset_ids]
    if visible_asset_ids
    else asset_records
)

if not selectable_asset_records:
    print("asset_manifest 与 MediaStore 都未提供可用样例媒体，无法构造 recycle bin fixture。", file=sys.stderr)
    sys.exit(1)

if target_asset_id:
    target_row = next((row for row in selectable_asset_records if row["asset_id"] == target_asset_id), None)
    if target_row is None:
        print(f"未找到指定 asset_id={target_asset_id} 对应的媒体。", file=sys.stderr)
        sys.exit(1)
    selected_rows = [target_row]
else:
    scoped_rows = [row for row in selectable_asset_records if row.get("bucket_name") == target_bucket_name]
    typed_rows = [row for row in scoped_rows if row.get("media_type") == target_media_type]
    ordered_rows = []
    seen_asset_ids = set()
    for row in [*typed_rows, *scoped_rows, *selectable_asset_records]:
        asset_id = str(row["asset_id"])
        if asset_id in seen_asset_ids:
            continue
        seen_asset_ids.add(asset_id)
        ordered_rows.append(row)
    selected_rows = ordered_rows[:target_count]
    clone_index = 1
    while len(selected_rows) < target_count and ordered_rows:
        source_row = dict(ordered_rows[(len(selected_rows) - len(ordered_rows)) % len(ordered_rows)])
        source_row["asset_id"] = f"{source_row['asset_id']}-design-{clone_index}"
        selected_rows.append(source_row)
        clone_index += 1
    target_row = selected_rows[0]
    target_asset_id = str(target_row["asset_id"])

def build_asset(row):
    media_type = row.get("media_type") or "photo"
    return {
        "id": str(row["asset_id"]),
        "uri": row["content_uri"],
        "previewUri": row["content_uri"],
        "mediaType": media_type,
        "width": max(0, int(row.get("width") or 0)),
        "height": max(0, int(row.get("height") or 0)),
        "duration": max(0, int(row.get("duration_ms") or 0)),
        "fileSize": max(0, int(row.get("file_size_bytes") or 0)),
        "creationTime": int(row.get("creation_time") or updated_at),
    }

session_row = rk.execute(
    "select value from catalystLocalStorage where key = 'app-cleaner/photo-scan-session'"
).fetchone()
session_candidates_by_asset_id = {}
if session_row and session_row[0]:
    try:
        session = json.loads(session_row[0])
    except json.JSONDecodeError:
        session = None
    if isinstance(session, dict):
        candidates = session.get("authorizedCandidates") or []
        for candidate in candidates:
            if not isinstance(candidate, dict) or not isinstance(candidate.get("asset"), dict):
                continue
            candidate_asset_id = candidate["asset"].get("id")
            if isinstance(candidate_asset_id, str):
                session_candidates_by_asset_id[candidate_asset_id] = candidate

target_asset_ids = [str(row["asset_id"]) for row in selected_rows]
session_candidates = []
for selected_row in selected_rows:
    selected_asset_id = str(selected_row["asset_id"])
    session_candidate = session_candidates_by_asset_id.get(selected_asset_id)
    if session_candidate is None:
        target_asset = build_asset(selected_row)
        media_type = target_asset["mediaType"]
        session_candidate = {
            "id": selected_asset_id,
            "asset": target_asset,
            "score": 92 if media_type == "photo" else 90,
            "confidence": "high",
            "kind": "abnormal-video" if media_type == "video" else "abnormal-photo",
            "primaryIssueType": "abnormal",
            "issueTypes": ["abnormal"],
            "reasons": [
                "Seeded recycle-bin candidate",
                "Deterministic observability fixture",
            ],
        }
    session_candidates.append(session_candidate)

payload = {
    "assetId": target_asset_id,
    "assetIds": target_asset_ids,
    "assetCount": len(target_asset_ids),
    "bucketName": target_row.get("bucket_name") or target_bucket_name,
    "snapshot": {
        "ids": target_asset_ids,
        "candidates": session_candidates,
        "updatedAt": updated_at,
        "source": "manual",
    },
}
print(json.dumps(payload, ensure_ascii=False, separators=(",", ":")))
PY
)"

TARGET_ASSET_ID="$(
  RECYCLE_BIN_SEED_JSON="${RECYCLE_BIN_SEED_JSON}" python3 - <<'PY'
import json
import os
payload = json.loads(os.environ["RECYCLE_BIN_SEED_JSON"])
print(payload["assetId"])
PY
)"

TARGET_BUCKET_NAME="$(
  RECYCLE_BIN_SEED_JSON="${RECYCLE_BIN_SEED_JSON}" python3 - <<'PY'
import json
import os
payload = json.loads(os.environ["RECYCLE_BIN_SEED_JSON"])
print(payload.get("bucketName") or "")
PY
)"

TARGET_ASSET_COUNT="$(
  RECYCLE_BIN_SEED_JSON="${RECYCLE_BIN_SEED_JSON}" python3 - <<'PY'
import json
import os
payload = json.loads(os.environ["RECYCLE_BIN_SEED_JSON"])
print(payload.get("assetCount") or len(payload.get("assetIds") or [payload["assetId"]]))
PY
)"

TARGET_ASSET_IDS_JSON="$(
  RECYCLE_BIN_SEED_JSON="${RECYCLE_BIN_SEED_JSON}" python3 - <<'PY'
import json
import os
payload = json.loads(os.environ["RECYCLE_BIN_SEED_JSON"])
print(json.dumps(payload.get("assetIds") or [payload["assetId"]], ensure_ascii=False, separators=(",", ":")))
PY
)"

RECYCLE_BIN_CANDIDATE_CACHE_JSON="$(
  RECYCLE_BIN_SEED_JSON="${RECYCLE_BIN_SEED_JSON}" python3 - <<'PY'
import json
import os
payload = json.loads(os.environ["RECYCLE_BIN_SEED_JSON"])
print(json.dumps(payload["snapshot"], ensure_ascii=False, separators=(",", ":")))
PY
)"

RECYCLE_BIN_STATE_INSERT_SQL="$(
  RECYCLE_BIN_SEED_JSON="${RECYCLE_BIN_SEED_JSON}" python3 - <<'PY'
import json
import os

payload = json.loads(os.environ["RECYCLE_BIN_SEED_JSON"])
updated_at = int(payload["snapshot"]["updatedAt"])

def quote(value):
    return "'" + str(value).replace("'", "''") + "'"

for asset_id in payload.get("assetIds") or [payload["assetId"]]:
    print(
        "insert into recycle_bin_state(asset_id,recycled_at,expires_at,source,updated_at) "
        f"values({quote(asset_id)}, {updated_at}, null, 'manual', {updated_at}) "
        "on conflict(asset_id) do update set "
        "recycled_at=excluded.recycled_at, "
        "expires_at=excluded.expires_at, "
        "source=excluded.source, "
        "updated_at=excluded.updated_at;"
    )
PY
)"

UPDATED_AT="$(python3 - <<'PY'
import time
print(int(time.time() * 1000))
PY
)"

if ! sqlite3 "${DB_LOCAL_PATH}" "pragma user_version;" >/dev/null 2>&1; then
  rm -f "${DB_LOCAL_PATH}"
fi

if ! sqlite3 "${RK_LOCAL_PATH}" "pragma user_version;" >/dev/null 2>&1; then
  rm -f "${RK_LOCAL_PATH}"
  sqlite3 "${RK_LOCAL_PATH}" \
    "create table if not exists catalystLocalStorage(key text primary key, value text);"
fi

if [[ "${CLEAR_FIRST}" -eq 1 ]]; then
  sqlite3 "${DB_LOCAL_PATH}" \
    "create table if not exists recycle_bin_state(asset_id text primary key, recycled_at integer not null, expires_at integer, source text not null default 'manual', updated_at integer not null);"
  sqlite3 "${DB_LOCAL_PATH}" "delete from recycle_bin_state;"
fi

sqlite3 "${DB_LOCAL_PATH}" \
  "create table if not exists recycle_bin_state(asset_id text primary key, recycled_at integer not null, expires_at integer, source text not null default 'manual', updated_at integer not null);"

sqlite3 "${DB_LOCAL_PATH}" \
  "${RECYCLE_BIN_STATE_INSERT_SQL}"

sqlite3 "${RK_LOCAL_PATH}" \
  "insert into catalystLocalStorage(key,value) values('app-cleaner/recycle-bin-candidate-cache','${RECYCLE_BIN_CANDIDATE_CACHE_JSON//\'/''}') on conflict(key) do update set value=excluded.value;"

sqlite3 "${RK_LOCAL_PATH}" \
  "insert into catalystLocalStorage(key,value) values('app-cleaner/recycle-bin-ids','${TARGET_ASSET_IDS_JSON//\'/''}') on conflict(key) do update set value=excluded.value;"

sqlite3 "${RK_LOCAL_PATH}" \
  "insert into catalystLocalStorage(key,value) values('app-cleaner/has-entered-workspace','true') on conflict(key) do update set value=excluded.value;"

sqlite3 "${RK_LOCAL_PATH}" \
  "insert into catalystLocalStorage(key,value) values('app-cleaner/app-language','zh-CN') on conflict(key) do update set value=excluded.value;"

sqlite3 "${RK_LOCAL_PATH}" \
  "insert into catalystLocalStorage(key,value) values('app-cleaner/theme-preference','system') on conflict(key) do update set value=excluded.value;"

adb -s "${SERIAL}" push "${DB_LOCAL_PATH}" "${DB_REMOTE_TMP_PATH}" >/dev/null
adb -s "${SERIAL}" shell "run-as ${APP_ID} sh -c 'mkdir -p files/SQLite && cat ${DB_REMOTE_TMP_PATH} > files/SQLite/app-cleaner-operational.db'" >/dev/null
adb -s "${SERIAL}" exec-out run-as "${APP_ID}" cat "${APP_DATA_DIR}/files/SQLite/app-cleaner-operational.db" > "${DB_VERIFY_PATH}"
adb -s "${SERIAL}" push "${RK_LOCAL_PATH}" "${RK_REMOTE_TMP_PATH}" >/dev/null
adb -s "${SERIAL}" shell "run-as com.jt.mistapmediacleaner sh -c 'mkdir -p databases'" >/dev/null
adb -s "${SERIAL}" shell "run-as ${APP_ID} sh -c 'cat ${RK_REMOTE_TMP_PATH} > databases/RKStorage'" >/dev/null
adb -s "${SERIAL}" exec-out run-as "${APP_ID}" cat "${APP_DATA_DIR}/databases/RKStorage" > "${RK_VERIFY_PATH}"

echo "已写入 recycle_bin_state 到 ${SERIAL}:"
echo "  asset_id: ${TARGET_ASSET_ID}"
echo "  asset_count: ${TARGET_ASSET_COUNT}"
echo "  bucket: ${TARGET_BUCKET_NAME}"
echo
echo "当前 recycle_bin_state:"
sqlite3 "${DB_VERIFY_PATH}" "select asset_id,recycled_at,expires_at,source,updated_at from recycle_bin_state;"
echo
echo "当前 recycle-bin-candidate-cache:"
sqlite3 "${RK_VERIFY_PATH}" "select substr(value,1,240) from catalystLocalStorage where key='app-cleaner/recycle-bin-candidate-cache';"
echo
echo "当前 recycle-bin-ids:"
sqlite3 "${RK_VERIFY_PATH}" "select value from catalystLocalStorage where key='app-cleaner/recycle-bin-ids';"
echo
echo "当前 has-entered-workspace:"
sqlite3 "${RK_VERIFY_PATH}" "select value from catalystLocalStorage where key='app-cleaner/has-entered-workspace';"
echo
echo "当前设计签收偏好:"
sqlite3 "${RK_VERIFY_PATH}" "select key,value from catalystLocalStorage where key in ('app-cleaner/app-language','app-cleaner/theme-preference') order by key;"
