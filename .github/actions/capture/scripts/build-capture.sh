#!/usr/bin/env bash
set -euo pipefail

mkdir -p .capture-dist

# Keep third-party packages external to avoid bundler/runtime mismatches
# in Node 20 for playwright-extra + stealth plugin internals.
bun build scripts/capture.ts --target node --packages external --outfile .capture-dist/capture.mjs
