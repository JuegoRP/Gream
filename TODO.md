# Gream — TODO & Stavový přehled

> Sdílená paměť napříč sezeními. Při dokončení úkolu zaškrtni `[x]` a přidej datum.
> Formát: `[x] Hotovo (2026-06-10)` / `[ ] Čeká`

---

## Před vydáním (cíl Q4 2026 — Google Play + App Store)

### Platformní opravy
- [ ] Safari CSS opravy (iOS rendering)
- [ ] GPS fallback — funkční flow když uživatel odmítne polohu
- [ ] Onboarding přepis

### Obsah
- [ ] Vlastní artworky — náhrada Kenney placeholderů (greamici sprity jsou vlastní, zbytek ne)

### Build a distribuce
- [ ] Capacitor build iOS + Android (postup: CAPACITOR.md)
- [ ] Google Play testing track (interní testování)
- [ ] Store assety: screenshoty, popisky (EN texty hotové v i18n.js — využít)

---

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
