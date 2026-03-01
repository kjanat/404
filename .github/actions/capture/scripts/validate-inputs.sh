#!/usr/bin/env bash
set -euo pipefail

case "$INPUT_EXT" in
  webp|gif|mp4) ;;
  *)
    echo "Invalid INPUT_EXT value: $INPUT_EXT (allowed: webp, gif, mp4)" >&2
    exit 1
    ;;
esac

case "$INPUT_COLOR_SCHEME" in
  light|dark) ;;
  *)
    echo "Invalid INPUT_COLOR_SCHEME value: $INPUT_COLOR_SCHEME (allowed: light, dark)" >&2
    exit 1
    ;;
esac
