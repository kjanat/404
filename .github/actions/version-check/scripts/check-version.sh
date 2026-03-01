#!/usr/bin/env bash
set -euo pipefail

# Compare a git tag to the version in package.json.
# Expects TAG_INPUT (optional explicit tag) and GITHUB_REF from the environment.

if [ -n "${TAG_INPUT:-}" ]; then
  TAG="$TAG_INPUT"
else
  TAG="${GITHUB_REF#refs/tags/}"
fi
TAG="${TAG#v}"

PKG=$(node -p "require('./package.json').version")

echo "Git tag:        v${TAG}"
echo "package.json:   ${PKG}"

if [ "$TAG" != "$PKG" ]; then
  echo "::error::Version mismatch! Tag v${TAG} does not match package.json version ${PKG}"
  exit 1
fi

echo "✅ Versions match"
