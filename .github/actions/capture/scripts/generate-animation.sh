#!/usr/bin/env bash
set -euo pipefail

max_bytes="$(
  awk -v mb="$INPUT_MAX_MB" '
    BEGIN {
      if (mb ~ /^[0-9]+([.][0-9]+)?$/) {
        printf "%.0f", mb * 1024 * 1024;
        exit 0;
      }
      exit 1;
    }
  '
)" || {
  echo "Invalid INPUT_MAX_MB value: $INPUT_MAX_MB" >&2
  exit 1
}

# Start a local preview server from the freshly built dist/ so captures
# always reflect the current commit (immune to CDN/edge-cache staleness).
bunx vite preview --port 4174 &
LOCAL_PID=$!

# Wait for the server to be ready
for i in $(seq 1 30); do
  curl -sf http://localhost:4174 >/dev/null 2>&1 && break
  sleep 0.5
done

# Rewrite the capture URL to use the local server with the original hostname
CAPTURE_HOST="${INPUT_URL#*://}"
CAPTURE_HOST="${CAPTURE_HOST%%/*}"
CAPTURE_HOST="${CAPTURE_HOST%%\?*}"
LOCAL_URL="http://localhost:4174?host=${CAPTURE_HOST}"

node .capture-dist/capture.mjs \
  -w "$INPUT_WIDTH" -h "$INPUT_HEIGHT" \
  --url "$LOCAL_URL" -d "$INPUT_DURATION" --fps "$INPUT_FPS" \
  -q "$INPUT_QUALITY" --max-bytes "$max_bytes" \
  --video-crf "$INPUT_VIDEO_CRF" \
  --color-scheme "$INPUT_COLOR_SCHEME" \
  -o "preview-$INPUT_COLOR_SCHEME.$INPUT_EXT"

kill "$LOCAL_PID" 2>/dev/null || true
