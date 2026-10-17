# Gream – Android build (Capacitor 8)

Stav 2026-10-15: Android projekt je v repu (`android/`), Capacitor 8.5, **cílové API 36** (Google Play požaduje od 31. 8. 2026), minSdk 24.
Aplikace se balí ze složky `www/` – tu skládá `scripts/build-www.mjs` (jen runtime soubory; zkontroluje, že žádný odkaz nechybí).

## Sestavení (server, bez Android Studia)
```bash
ssh root@89.167.123.58 /opt/roman-storage/android/build.sh gream JuegoRP/Gream <větev>
```
- Docker obraz `3r-android-builder:36` (JDK 21, Android SDK 36, Node 22) – Dockerfile v `scripts/android/`, použitelný i pro další hry.
- Výstup: `/opt/roman-storage/android/out/gream/<verze>-<code>-<commit>/` (`.aab` pro Play, `.apk` na zkoušku), odkaz `latest`. Trvá ~2 min.
- **Podpis:** upload klíč `/opt/roman-storage/android/keys/gream/` (mimo repo, v šifrované záloze serveru; Roman ho má ve správci hesel). `android/app/build.gradle` ho čte z `ANDROID_KEYSTORE_PROPS` – v repu žádná hesla.
- Nová verze: zvýšit `versionCode` (+1) a `versionName` v `android/app/build.gradle`.

## Lokálně (volitelně)
```bash
npm run build:android   # www/ + npx cap sync android
```
Gradle build potřebuje JDK 21 + Android SDK (na Macu není – proto server).

## Co je nativně jinak než na webu
- Service worker se v aplikaci neregistruje (soubory jsou přibalené).
- Systémové tlačítko Zpět: `App._initNativeBack()` (plugin `@capacitor/app`) – zavře okno, krok zpět, ze zahrady minimalizuje, při souboji nic.
- Poloha: oprávnění ACCESS_COARSE/FINE_LOCATION v manifestu, žádost se zobrazí až po klepnutí na „Poloha“ v úvodu. Žádná poloha na pozadí, žádná kamera.
- Okraje (stavová/navigační lišta): řeší Capacitor SystemBars; pruh pod lištami má barvu hry.
- Ikony/splash: generované z `img/greamici/seed_1.png` (adaptivní ikona, zelené pozadí #4A8A2E).

## Ověřeno (emulátor Android 16, Pixel 7)
Start bez chyb, úvod CZ/EN, rodičovský souhlas, žádost o polohu, mapa s místy z GPS, tlačítko Zpět na všech typech obrazovek.

## iOS
Zatím ne (priorita Google Play). Postup z dřívější verze tohoto souboru je v historii gitu.

## Vydání na Google Play
Viz `CLOSED_TESTING.md` a `STORE_LISTING.md`.


## iOS (App Store) – připraveno 17. 10. 2026
Projekt `ios/` (Capacitor 8, Swift Package Manager – CocoaPods není potřeba; nákupní plugin `cordova-plugin-purchase` se zabalí sám).
Hotové: bundle `com.gream.app`, název Gream, ikona 1024 (bez průhlednosti), úvodní obrazovka s logem, jen na výšku,
text pro polohu (EN v Info.plist, CZ v `ios/App/App/cs.lproj/InfoPlist.strings`), nákupy přes App Store (`js/billing.js` podle platformy),
okraje displeje řeší CSS (`contentInset: never`).

**Na Macu (Romanův nebo manželky) – jednou:**
1. App Store → nainstalovat **Xcode** (zdarma, ~15 GB), spustit a odsouhlasit licenci.
2. Node.js 20+ (https://nodejs.org), pak v repu: `npm ci && npm run build:ios && npx cap open ios`.
3. V Xcode: projekt App → Signing & Capabilities → Team = Apple Developer účet (99 USD/rok), přidat capability **In-App Purchase**.
   Poprvé přidat do projektu složky `cs.lproj` a `en.lproj` (pravým na App → Add Files…), ať se přeloží text k poloze.
4. Spustit v simulátoru (iPhone 15) → otestovat; pak Product → Archive → Distribute → App Store Connect → **TestFlight**.

**App Store Connect:** aplikace `com.gream.app`, předplatné ve skupině „Gream Plus“: `gream_plus_monthly` (89 Kč), `gream_plus_yearly` (749 Kč), bez free trial;
Agreements, Tax and Banking (bankovní účet, W-8BEN); App Privacy podle `STORE_LISTING.md` §4; věková kategorie 4+; Kids category NE (mixed audience).
Po každé změně webové části: `npm run build:ios` (zkopíruje `www/` do `ios/`).
