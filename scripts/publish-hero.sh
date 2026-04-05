#!/bin/bash
# Usage: bun run publish-hero
# Copies the latest recorded video to static/hero.webm

latest=$(ls -t videos/*.webm 2>/dev/null | head -1)

if [ -z "$latest" ]; then
  echo "No videos found in videos/"
  exit 1
fi

cp "$latest" static/hero.webm
echo "Published: $latest → static/hero.webm"
