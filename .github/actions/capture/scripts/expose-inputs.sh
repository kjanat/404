#!/usr/bin/env bash
set -euo pipefail

# Safely append environment variables using heredoc delimiters.
# Called by the composite action to pass inputs to subsequent steps.

append_env() {
  local key="$1"
  local value="$2"
  local delimiter="EOF_$(date +%s%N)_$RANDOM"
  {
    printf '%s<<%s\n' "$key" "$delimiter"
    printf '%s\n' "$value"
    printf '%s\n' "$delimiter"
  } >> "$GITHUB_ENV"
}

append_env "INPUT_WIDTH" "$_WIDTH"
append_env "INPUT_HEIGHT" "$_HEIGHT"
append_env "INPUT_URL" "$_URL"
append_env "INPUT_DURATION" "$_DURATION"
append_env "INPUT_FPS" "$_FPS"
append_env "INPUT_QUALITY" "$_QUALITY"
append_env "INPUT_MAX_MB" "$_MAX_MB"
append_env "INPUT_VIDEO_CRF" "$_VIDEO_CRF"
append_env "INPUT_EXT" "$_EXT"
append_env "INPUT_COLOR_SCHEME" "$_COLOR_SCHEME"
