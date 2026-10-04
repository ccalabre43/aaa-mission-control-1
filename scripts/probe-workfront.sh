#!/usr/bin/env bash
# Read-only Workfront connection probe. Uses WF_HOST + WF_TOKEN from the environment.
# Never commit tokens. .env.workfront.local is gitignored via .env.*
#
# Usage (in the Terminal where you already exported WF_TOKEN):
#   export WF_HOST='https://aaalife.my.workfront.com'
#   export WF_TOKEN='...'   # from Developer Console — do not paste into chat
#   bash scripts/probe-workfront.sh

set -euo pipefail

WF_HOST="${WF_HOST:-https://aaalife.my.workfront.com}"
PROJECT_ID="${WF_PROJECT_ID:-6abae2b600041e3ecb6a8da4dbe7b4a1}"

if [[ -z "${WF_TOKEN:-}" ]]; then
  echo "ERROR: WF_TOKEN is not set in this shell."
  echo "Export it first (plain single quotes), then re-run this script."
  exit 1
fi

echo "WF_HOST=$WF_HOST"
echo "Token length: ${#WF_TOKEN}"
echo "Project ID: $PROJECT_ID"
echo

probe() {
  local label="$1"
  shift
  local code
  code=$(curl -sS --compressed -o /tmp/wf-probe-body.json -w "%{http_code}" "$@")
  echo "=== $label → HTTP $code ==="
  if command -v python3 >/dev/null 2>&1; then
    python3 - <<'PY'
import json
try:
    with open("/tmp/wf-probe-body.json") as f:
        data = json.load(f)
    print(json.dumps(data, indent=2)[:1500])
except Exception as exc:
    raw = open("/tmp/wf-probe-body.json", "rb").read()[:400]
    print(raw)
    print("parse_err:", exc)
PY
  else
    head -c 800 /tmp/wf-probe-body.json
    echo
  fi
  echo
}

URL="${WF_HOST}/attask/api/v19.0/project/${PROJECT_ID}?fields=ID,name,queueDefID"
TOPICS_URL="${WF_HOST}/attask/api/v19.0/QUEUETOPIC/search?projectID=${PROJECT_ID}&fields=ID,name"

probe "Bearer project" \
  -H "Authorization: Bearer ${WF_TOKEN}" \
  -H "Accept: application/json" \
  "$URL"

probe "SessionID project" \
  -H "SessionID: ${WF_TOKEN}" \
  -H "Accept: application/json" \
  "$URL"

# If either project call succeeded, list topics too
if grep -q '"name"' /tmp/wf-probe-body.json 2>/dev/null; then
  probe "Bearer queue topics" \
    -H "Authorization: Bearer ${WF_TOKEN}" \
    -H "Accept: application/json" \
    "$TOPICS_URL"
fi

echo "Done. Share only HTTP codes and name/ID fields — never the token."
