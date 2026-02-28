#!/usr/bin/env bash
#
URL="http://localhost:5173" # URL to capture

function imagen() {
  local theme=${1:-light} ext=${2:-mp4} duration=${3:-8} fps=${4:-30} host="unavailable.kajkowalski.nl"

  printf "[%s] Capturing %s theme preview video...\n" "$(date)" "$theme"

  bun capture \
    --url "$URL" \
    --out "preview-${theme}.${ext}" \
    --color-scheme "${theme}" \
    --duration "${duration}" \
    --hostname "${host}" \
    --fps "${fps}" \
    --max-bytes "$((3 * 1024 * 1024))"
}

# Check if http://localhost:5173 is available before starting the capture
if ! curl -s "$URL" >/dev/null; then
  printf "[%s] Error: %s is not available. Please start the development server before running this script.\n" "$(date)" "${URL}"
  exit 1
fi

printf "[%s] Starting capture of imagen preview videos\n" "$(date)"
imagen light webp
imagen dark webp
