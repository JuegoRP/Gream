#!/bin/bash
# Sestaví podepsaný Android balíček (AAB pro Google Play + APK na zkoušku do telefonu) z větve repa.
# Běží na serveru: /opt/roman-storage/android/build.sh <app> <repo> <větev>
#   např. build.sh gream JuegoRP/Gream release-1.0-f3
# Klíč: /opt/roman-storage/android/keys/<app>/keystore.properties (+ .jks) – nikdy v repu.
# Výstup: /opt/roman-storage/android/out/<app>/<verze>-<commit>/ (+ odkaz latest)
set -euo pipefail
APP="${1:?app}"; REPO="${2:?repo}"; BRANCH="${3:-main}"
[[ "$APP" =~ ^[a-z0-9-]{1,40}$ ]] || { echo "Neplatný název aplikace."; exit 2; }
[[ "$REPO" =~ ^JuegoRP/[A-Za-z0-9._-]{1,100}$ ]] || { echo "Neplatné repo."; exit 2; }
[[ "$BRANCH" =~ ^[A-Za-z0-9._/-]{1,100}$ && "$BRANCH" != *..* ]] || { echo "Neplatná větev."; exit 2; }
RS=/opt/roman-storage; A=$RS/android; IMG=3r-android-builder:36
KEYS=$A/keys/$APP
[ -f "$KEYS/keystore.properties" ] || { echo "Chybí podpisový klíč $KEYS/keystore.properties"; exit 3; }
exec 9>"/tmp/android-build-$APP.lock"; flock -n 9 || { echo "Sestavení $APP už běží."; exit 6; }
TOKEN=$(grep '^GITHUB_TOKEN=' $RS/control-data/.env | cut -d= -f2-)
TMP=$(mktemp -d /tmp/android-$APP-XXXX); trap 'rm -rf "$TMP"' EXIT
git clone -q --depth 1 -b "$BRANCH" "https://x-access-token:$TOKEN@github.com/$REPO.git" "$TMP/src"
SHA=$(git -C "$TMP/src" rev-parse --short HEAD)
mkdir -p $A/gradle-cache $A/npm-cache
docker run --rm --memory=2600m --cpus=2 \
  -v "$TMP/src:/src" -v $A/gradle-cache:/root/.gradle -v $A/npm-cache:/root/.npm \
  -v "$KEYS:/keys:ro" -e ANDROID_KEYSTORE_PROPS=/keys/keystore.properties \
  $IMG bash -c 'set -e; npm ci --no-audit --no-fund >/dev/null; npm run -s build:www; npx cap sync android >/dev/null;
    cd android && chmod +x gradlew && ./gradlew -q bundleRelease assembleRelease;
    apksigner verify --print-certs app/build/outputs/apk/release/app-release.apk | grep -m1 "SHA-256"' > "$TMP/log.txt" 2>&1 \
  || { tail -40 "$TMP/log.txt"; exit 1; }
VER=$(grep -oP 'versionName "\K[^"]+' "$TMP/src/android/app/build.gradle"); CODE=$(grep -oP 'versionCode \K[0-9]+' "$TMP/src/android/app/build.gradle")
OUT=$A/out/$APP/$VER-$CODE-$SHA; mkdir -p "$OUT"
cp "$TMP/src/android/app/build/outputs/bundle/release/app-release.aab" "$OUT/$APP-$VER.aab"
cp "$TMP/src/android/app/build/outputs/apk/release/app-release.apk" "$OUT/$APP-$VER.apk"
ln -sfn "$OUT" $A/out/$APP/latest
cat "$TMP/log.txt" | tail -5
echo "{\"app\":\"$APP\",\"version\":\"$VER\",\"code\":$CODE,\"commit\":\"$SHA\",\"aab\":\"$OUT/$APP-$VER.aab\",\"aab_mb\":$(du -m "$OUT/$APP-$VER.aab" | cut -f1)}"
