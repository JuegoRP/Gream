# Gream — TODO & Stavový přehled

> Sdílená paměť napříč sezeními. Při dokončení úkolu zaškrtni `[x]` a přidej datum.
> Formát: `[x] Hotovo (2026-06-10)` / `[ ] Čeká`

---

## Před vydáním (cíl Q4 2026 — Google Play + App Store)

### Platformní opravy
- [ ] Safari CSS opravy (iOS rendering)
- [x] GPS fallback — funkční flow když uživatel odmítne polohu (2026-07-07) — mapa už netiše nepadne do Prahy: hláška „Poloha je vypnutá" + tlačítko na domácí výzvy
- [ ] Onboarding přepis

### Obsah
- [~] Vlastní artworky — greamíci + vejce + pozadí + ikony hotové (2026-07-01), zbývá: Kenney placeholdery na mapě, barevnější vlnka, stage-varianty gramíků

### Build a distribuce
- [ ] Capacitor build iOS + Android (postup: CAPACITOR.md)
- [ ] Google Play testing track (interní testování)
- [ ] Store assety: screenshoty, popisky (EN texty hotové v i18n.js — využít)
- [ ] **Privacy policy URL** — Google Play i App Store ji u dětských aplikací vyžadují povinně; obsah je vlastně hotový v onboarding v4 textech, stačí publikovat stránku (např. 3rstudio.eu/gream-privacy)
- [ ] Ověřit „Kenney placeholdery na mapě" — v kódu (js/mapview.js) žádná reference na Kenney není; buď už vyřešeno a položka je zastaralá, nebo se assety jmenují jinak

---

## Hotovo (2026-07-07) — pre-release polish

- [x] **Oprava výběru výzev** — hráč dřív viděl jen indexy 0–2 (badge progress se resetuje po 3 krocích), takže z ~568 výzev bylo reálně dostupných jen ~72 (18 na obtížnost). Teď se okno posouvá podle `worldTasks[world] % pool.length` → procyklují se VŠECHNY výzvy. (challenge.js) — příčina pocitu „málo výzev"
- [x] **Sladění EN/CZ poolů** — doplněny 2 chybějící CZ výzvy (nature medium „býložravci", nature extreme „genom"); všechny pooly EN=CZ, jinak by index-výběr v CZ tiše šlápl mimo pole
- [x] **Vypnutý paywall pro v1** — `PAYWALL_ENABLED=false` v subscription.js: všichni premium, žádný trial banner, skrytá subscribe UI, fake „Aktivovat Premium" nedosažitelný. Store by falešný IAP zamítl; reálné IAP (RevenueCat/Capacitor) až po vydání a za parent gate
- [x] **Perzistence dat** — `navigator.storage.persist()` při startu (app.js init), aby iOS/Android nevymazaly profily a mazlíčka pod tlakem na místo
- [x] Historie aktivit teď ukládá i text výzvy (dřív jen obecný „Krok 1")

## Hotovo (2026-07-05)

- [x] Oprava audio duplikace na mobilu (audio.js v7 — jeden recyklovaný element)
- [x] Bug „dva greamíci" na mapě + zasekávání — mapa se otvírala 2× (dvojí POI fetch), opraveno
- [x] Puzzle území v1 — splněné POI se slévají do jedné rozrůstající se plochy
- [x] Mapa: barevný Voyager basemap + SW cachuje CartoDB dlaždice (dřív network-first = trhané), víc POI (radius 2000, až 70), barevné/hezčí POI body
- [x] Odznaky: lesk/gloss + shine na nejvyšší úrovně
- [x] +96 výzev (celkem ~1134)

## Hotovo (2026-07-01)

- [x] Oprava přepínání hudby (audio.js v6 — single source of truth, idempotentní switchScene, konec překryvu 2 stop); model 3 songy (challenge/outdoor/menu)
- [x] Malovaná pozadí (zahrada + 6 světů, flat-vektor) přes image-gen workflow, optimalizováno na JPEG (944 KB celkem); živá vrstva zahrady (pyl/světlušky, denní/noční tint)
- [x] Gramíci + vejce + app ikony přegenerovány do flat-vektoru (chroma-key → průhledné sprity ve stávajícím 2×2 formátu)
- [x] +288 nových výzev (144 en + 144 cs) napříč obtížnostmi; víc match/sort
- [x] Dokončen difficulty-refactor: i18n klíče přejmenovány 4-6/7-9/10-15/15+ → easy/medium/hard/extreme; opravena rozbitá challenge.js z commitu 49745a2 (chyběly render metody)

## Hotovo (stav k 2026-06-10)

- [x] Kompletní gameplay loop: výzvy, pet systém, odznaky, streaky, šatník
- [x] Lokalizace EN + CZ kompletní — js/i18n.js, všechny texty včetně výzev
- [x] Reálná OSM mapa (Leaflet, lazy-loaded), POI z Overpass API (v2.2)
- [x] Geocaching warmth indikátor + odemknutí výzvy do 30 m (v2.2)
- [x] Historie aktivit — posledních 50 úkolů s metadaty (v2.2)
- [x] Geo: cache invalidation, motion detection, POI proximity, photo geotagging (v2.2)
- [x] Service worker — offline cache vč. Leaflet + map tiles (v2.1)
- [x] Parent gate, 30+ obrazovek, audio sada
- [x] capacitor.config.json připraven

---

## Roadmap po vydání (z README)

- AI validace proofů (Claude Vision), komunitní obsah, family sync, sezónní výzvy, týdenní expedice, group challenges, push notifikace
