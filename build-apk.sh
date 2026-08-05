#!/usr/bin/env bash
# Galeyr — build a release APK for sideloading.
#
#   ./build-apk.sh
#
# Produces build/app/outputs/flutter-apk/app-release.apk
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -f env/dev.json ]; then
  echo "env/dev.json is missing. Copy env/example.json and fill it in." >&2
  exit 1
fi

# --dart-define-from-file is not optional here. Without it the binary has no
# Supabase URL, and Env.assertConfigured throws on launch by design — better a
# clear failure at startup than a mysterious one at sign-in.
echo "→ flutter pub get"
flutter pub get

echo "→ building release APK"
flutter build apk --release --dart-define-from-file=env/dev.json

APK="build/app/outputs/flutter-apk/app-release.apk"
echo
echo "Built: $APK"
ls -lh "$APK" | awk '{print "Size:  " $5}'
echo
echo "Install over USB:   flutter install --release"
echo "or:                 adb install -r $APK"
