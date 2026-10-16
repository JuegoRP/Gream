# CLAUDE.md — Gream

Kvízová hra pro celou rodinu (kids-first), venku i doma (vanilla JS PWA + Capacitor → Google Play). Profil a postup jsou lokálně v zařízení; server `3rstudio.eu/api/gream` (kód v `server/gream-api.js`) obsluhuje souboje, žebříčky, místa na mapě a mapové dlaždice. Stav a zbývající práce: `TODO.md`, zadání vydání 1.0: GDrive `system/specs/spec-gream-1.0.md`, audit: GDrive `system/audit/gream-2026-10-15/AUDIT.md`.

## Konvence

- **Texty výhradně přes `js/i18n.js`** (EN + CZ kompletní) — nikdy hardcodované řetězce v kódu ani šablonách
- **Žádné nové frameworky/závislosti** — vanilla JS, moduly v `js/`, obrazovky jako šablony v `screens/*.html`. Výjimka: mapa MapLibre (`vendor/maplibre/`, lokálně), písmo Nunito (`fonts/`) a nákupy Google Play `cordova-plugin-purchase` (jen v Android aplikaci) – nic se nenačítá z CDN.
- Logika obrazovek v `js/app.js`, navigace přes `js/router.js` (úklid MapView při změně obrazovky)
- Geo funkce v `js/geo.js` — pozor na cache invalidation a iOS DeviceMotion permission flow
- **Soukromí je feature (Google Play Families policy):** přesné GPS souřadnice a fotky NIKDY neposílat nikam. Mapa i místa jdou jen přes náš server a jen s polohou zaokrouhlenou na ≈ 500 m (`Geo.roundPos`). Aplikace se nesmí spojit s žádnou cizí doménou (kontrola: audit `checks/poi_leak.mjs`, `ui_smoke.mjs`). Každá změna sběru dat = aktualizovat zásady (3rstudio.eu/gream-privacy.html), text v aplikaci (`showPrivacy` v app.js, `ob_v4_legal_*` v i18n) a STORE_LISTING §4.
- **Otázky musí být pravdivé:** nové otázky jen přes `content/` + kontrolu (n8n agent → `scripts/qa-questions.mjs`, `scripts/build-gen-questions.mjs`) a ruční posouzení. České a anglické sady jsou samostatné (ne překlady) – stejný počet a pořadí v každé sadě hlídá `npm test`. Možnosti `choice` se na obrazovce míchají (v datech je správná první); `keepOrder` jen u Pravda/mýtus. Zajímavosti „Víš, že…?“: `js/facts-data.js` (klíč = id z textu v jazyce hráče) nebo `fact` přímo u otázky.
- **Gream Plus (předplatné, zapnuto 2026-10-16):** `js/subscription.js` (týden zdarma, limity zdarma verze, `PAYWALL_ENABLED` = vypínač), `js/billing.js` (Google Play), `js/paywall.js` (nabídka, promo kód). Zdarma navždy: venku, výprava dne, vajíčka, greamíci – nic se nemaže ani nesmutní kvůli neplacení, žádné prodávání semínek ani výhoda v souboji. Promo kódy jsou JEN na serveru (`/opt/roman-storage/gream-data/promo.json`, `{"KOD":{"max":30,"used":0,"off":false}}`, nikdy do repa); server počítá jen použití, žádné ID zařízení.
- Store build (Android): server `/opt/roman-storage/android/build.sh gream JuegoRP/Gream <větev>` – postup v `CAPACITOR.md`; podpisový klíč nikdy do repa

## Testování

```bash
python3 -m http.server 8000
```
Geo funkce: Chrome DevTools → Sensors → Geolocation override, nebo reálný mobil.

## Na konci každé session

1. Zaškrtni hotové položky v `TODO.md` s datem: `[x] Hotovo (RRRR-MM-DD)`
2. Změnila-li se fáze projektu, aktualizuj README sekci „Stav projektu"
3. Aktualizuj kartu projektu Gream v 3R Control (admin.romanpavlorek.eu/app → Projekty) – z ní čerpají agenti i Claude
