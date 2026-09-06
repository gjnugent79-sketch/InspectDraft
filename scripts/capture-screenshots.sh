#!/usr/bin/env bash
set -euo pipefail
OUT=/workspace/inspectdraft/assets/screenshots
BASE=http://127.0.0.1:8765
PROFILE=/tmp/id-chrome-profile-$$
mkdir -p "$OUT" "$PROFILE"
capture() {
  local name="$1" url="$2" w="${3:-390}" h="${4:-900}"
  local dest="$OUT/$name"
  echo "Capturing $name ($url)..."
  google-chrome-stable --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=2 --window-size="${w},${h}" --user-data-dir="$PROFILE" --no-first-run --no-default-browser-check --virtual-time-budget=8000 --screenshot="$dest" "$url" >/tmp/chrome-shot.log 2>&1 || true
  if [[ ! -f "$dest" ]]; then echo "FAILED: $name" >&2; cat /tmp/chrome-shot.log >&2; exit 1; fi
  ls -la "$dest"
}
capture 00-landing.png "$BASE/?view=landing" 390 920
capture 01-jobs.png "$BASE/?view=jobs" 390 844
capture 02-sections.png "$BASE/?view=sections" 390 980
capture 03-section-roof.png "$BASE/?view=section&section=roof" 390 1100
capture 03b-section-empty.png "$BASE/?view=section&section=structure" 390 900
capture 04-preview.png "$BASE/?view=preview" 390 1200
capture 05-export-report.png "$BASE/?view=export" 390 1200
rm -rf "$PROFILE"
echo All screenshots refreshed.
