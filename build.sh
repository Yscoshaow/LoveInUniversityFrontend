#!/bin/bash

# Auto-detect git commit SHA
GIT_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

echo "Building with Git SHA: $GIT_SHA"

docker build \
  --build-arg GIT_COMMIT_SHA="$GIT_SHA" \
  --build-arg VITE_API_BASE_URL="${VITE_API_BASE_URL:-}" \
  "$@" \
  -t lovein-university-web .
