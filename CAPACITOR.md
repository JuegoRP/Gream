# Building Gream for iOS and Android with Capacitor

This guide assumes you've already:
- Apple Developer Account ($99/year) → developer.apple.com
- Google Play Developer Account ($25 one-time) → play.google.com/console
- Xcode installed (for iOS) → from Mac App Store
- Android Studio installed (for Android) → developer.android.com/studio

## One-time setup

```bash
# Install Capacitor
npm install -g @capacitor/cli @capacitor/core
npm init -y                  # creates package.json
npm install @capacitor/core @capacitor/ios @capacitor/android
npm install @capacitor/geolocation @capacitor/filesystem @capacitor/preferences
# POZN: @capacitor/camera NEinstalovat — foto/kresba/hlas výzvy jsou vypnuté,
# appka kameru nepoužívá. Deklarovat nepoužívané oprávnění = zamítnutí na Google Play.

# Initialize Capacitor in this folder (capacitor.config.json already exists)
npx cap init "Gream" "com.gream.app"

# Add iOS and Android platforms
npx cap add ios
npx cap add android
```

## Each time you change code

```bash
# Sync web changes to native projects
npx cap sync

# Open in Xcode (for iOS build/release)
npx cap open ios

# Open in Android Studio (for Android build/release)
npx cap open android
```

## iOS App Store release

In Xcode:
1. Set bundle identifier to `com.gream.app`
2. Select team (your Apple Developer Account)
3. Product → Archive
4. Distribute App → App Store Connect
5. Upload, then in App Store Connect:
   - Add screenshots (6.7", 6.5", 5.5", iPad)
   - Description (CS + EN)
   - Privacy questionnaire: NO ads, NO tracking, NO third-party analytics.
     ⚠️ NOT "no data collection" — hra posílá na vlastní server zvolenou
     přezdívku + skóre/rating (leaderboard) a anonymní ID splněných míst.
     Deklarovat jako: "Data linked to a pseudonymous in-app name, not to identity."
   - Age rating: 4+
   - Submit for review (usually 24-48 hours)

## Google Play release

In Android Studio:
1. Build → Generate Signed Bundle (AAB)
2. Create signing key (KEEP THE KEYSTORE FILE SAFE!)
3. Build release AAB
4. Upload to Google Play Console:
   - Add screenshots (phone, tablet)
   - Description (CS + EN)
   - Content rating questionnaire
   - Age 5+ rating
   - Data safety form — přesně (NE "no collection"):
     • Collected: "App activity" (game progress/scores) + user-provided nickname.
     • Shared: nickname + score jsou VIDITELNÉ ostatním na leaderboardu.
     • NOT collected: precise location (GPS zůstává v zařízení), photos, contacts,
       email, ad identifiers. NO tracking across apps. Data NOT sold.
     • Encrypted in transit: ANO (HTTPS). Deletion: přezdívka+skóre lze smazat na
       žádost (uveď kontakt v privacy policy).
   - Submit for review (usually 24-72 hours)

## Required Privacy Policy URL

Google + Apple vyžadují veřejnou URL. Hostuje se na 3rstudio.eu (VPS live FS +
GDrive + git repo JuegoRP/3Rstudio.eu), stejně jako marketingová stránka Greamu:

    https://3rstudio.eu/gream-privacy.html

Zdroj stránky: repo `3Rstudio.eu` (soubor `gream-privacy.html`). Musí odpovídat
skutečnému sběru dat (viz Data safety výše) — jméno+skóre na leaderboard, anonymní
POI, reporty otázek; GPS a fotky NIKDY neopouští zařízení.

## ⚠️ BEZPEČNOST: co NEbalit do appky (`webDir: "."`)

`webDir` je `"."` → `npx cap sync` zkopíruje **celou složku repa** do nativní appky
(`android/app/src/main/assets/public/`, `ios/App/App/public/`). APK/IPA je jen ZIP —
kdokoli ho rozbalí a přečte. Runtime kód (`js/`, `screens/`) je čistý (jediné volání
ven = veřejné `https://3rstudio.eu/api/gream`), ALE tyhle do buildu NEPATŘÍ:

- `server/` — kód serveru + deploy poznámky (infra)
- `.git/` — celá historie commitů
- `node_modules/`, `package*.json` — bloat
- `CAPACITOR.md`, `CLOSED_TESTING.md`, `STORE_LISTING.md`, `CLAUDE.md`, `TODO.md`, `README.md` — interní dokumenty
- `make_sprites.py`, `run-mac.sh`, `test/`

**Po každém `npx cap sync` vyčistit nativní assets** (spustit před buildem AAB/IPA):
```bash
for P in android/app/src/main/assets/public ios/App/App/public; do
  [ -d "$P" ] || continue
  rm -rf "$P/server" "$P/test" "$P/node_modules" "$P/.git" \
         "$P"/*.md "$P/make_sprites.py" "$P/run-mac.sh" \
         "$P/package.json" "$P/package-lock.json" "$P/CLAUDE.md"
done
```
(Nebo dlouhodobě: přesunout web do dedikované `www/` a nastavit `webDir: "www"`.)

**Pravidlo:** do repa ani do appky nedávat konkrétní VPS IP / SSH / klíče — jen `<VPS>`
placeholder; reálná adresa žije v privátních poznámkách.

## What WILL break in native that doesn't on web

- `localStorage` works but is ephemeral on iOS — use `@capacitor/preferences` plugin
- Camera: NEPOUŽÍVÁ SE (foto/kresba/hlas výzvy vypnuté) — nedeklarovat oprávnění
- Geolocation needs explicit `Info.plist` and `AndroidManifest.xml` keys
- Service Worker doesn't work in Capacitor — use native cache instead
- File:// URLs in native are different scheme

These are all addressed by adding Capacitor plugins later.

## TestFlight and Internal Testing

For beta testing with kids before launch:
- iOS: TestFlight (up to 100 testers, free)
- Android: Internal Testing track (up to 100 testers, immediate)
