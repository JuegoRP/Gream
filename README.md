# Gream

Outdoorová dobrodružná hra pro děti 7–15 let. Jedna výzva denně — venku, u skutečných míst. Virtuální mazlíček (Gream) roste podle toho, co dítě splní v reálném světě.

**Tech:** vanilla JS PWA + Capacitor wrapper pro App Store / Google Play (viz `CAPACITOR.md`). Žádný backend — všechna data včetně GPS zůstávají lokálně na zařízení.

## Co hra umí

- **Denní výzvy** — 144 výzev v kategoriích, EN + CZ
- **Skutečná mapa** — Leaflet + OpenStreetMap, POI ze skutečného okolí (Overpass API)
- **Geocaching mechanika** — „warmth" indikátor vzdálenosti (🥶 zima → 🔥 jsi na místě), výzva u POI se odemkne do 30 m od místa
- **Gream (mazlíček)** — líhne se z vejce, evoluce podle splněných výzev, šatník, odznaky, streaky
- **Geo logika** — cache invalidation při pohybu, motion detection proti GPS spoofingu, POI proximity check, geotagging proofů
- **Historie** — posledních 50 splněných úkolů s místem a časem
- **Parent gate** — potvrzení rodiče, žádná data neopouští zařízení

## Stav projektu (k 2026-06-10)

**Hotovo:**
- Kompletní gameplay loop: výzvy, pet systém, odznaky, streaky, šatník
- **Lokalizace EN + CZ kompletní** (`js/i18n.js` — všechny texty včetně výzev)
- Reálná OSM mapa, geocaching warmth, historie aktivit
- 30+ obrazovek, onboarding, parent-confirm, service worker (offline cache vč. map tiles a Leafletu)
- Audio sada, `capacitor.config.json` připraven

**Zbývá před vydáním:**
- Safari CSS opravy
- GPS fallback (odmítnutá poloha)
- Onboarding přepis
- Vlastní artworky (místo Kenney placeholderů)
- Capacitor build + Google Play testing track

Živý stav úkolů: `projects.json` v admin systému (admin.romanpavlorek.eu).

## Struktura

```
gream/
├── index.html
├── manifest.json
├── sw.js                  ← service worker (cache + Leaflet/tiles buckets)
├── capacitor.config.json
├── CAPACITOR.md           ← postup buildu pro store
├── css/                   ← base, layout, components, themes
├── js/
│   ├── app.js             ← hlavní logika, Leaflet renderer
│   ├── i18n.js            ← kompletní EN/CZ texty
│   ├── geo.js             ← GPS, motion detection, POI
│   ├── mapview.js         ← Leaflet wrapper (lazy-loaded)
│   ├── challenge.js       ← výzvy, proximity check, geotag
│   ├── profiles.js        ← profily + historie
│   ├── gream.js, skins.js ← mazlíček a šatník
│   └── …                  ← badges, camera, speech, stats, validator, router, audio
├── screens/               ← HTML šablony obrazovek (30+)
├── img/                   ← greamici sprity, backgroundy
├── audio/                 ← hudba + SFX
└── icons/                 ← PWA / store ikony
```

## Spuštění

```bash
python3 -m http.server 8000
```

Otevři `http://localhost:8000`. Pro testování geo funkcí ideálně přes mobilní telefon (Chrome/Safari pošle real GPS), nebo Chrome DevTools → Sensors → Geolocation override.

## Co dál (roadmap)

- **AI validace**: Anthropic API pro skutečné rozpoznávání obrázků (Claude Vision) a textu. Pro foto výzvy skutečně ověří, že na obrázku je strom. Pro textové odpovědi posoudí kvalitu.
- **Komunitní obsah**: rodič/učitel přidá vlastní místo s vlastní výzvou — rozšiřuje mapu o lokální pamětihodnosti.
- **Family sync**: Firebase pro sdílení historie mezi rodinnými profily — rodič vidí co dítě splnilo (s explicitním souhlasem dítěte u 10+).
- **Sezónní výzvy**: na podzim „najdi 5 barev listů", v zimě „najdi stopy ve sněhu"
- **Týdenní expedice**: 3 POI v jednom světě → bonus odznak
- **Group challenges**: dítě + rodič dělají výzvu společně
- **Push notifikace**: „tvoje výzva čeká!" při ranní rutině (vyžaduje backend)

## Známé limity

- **GPS spoofing** není 100% detekovatelný (motion check pomáhá, ale ne dokonale). Accepted — Gream je motivační, ne security app.
- **Offline mapa**: Leaflet tiles se cachují postupně jak je uživatel projde. Pro plnou offline mapu by bylo třeba pre-stahovat region.
- **Overpass API**: občas pomalé (timeout 25 s, 3 fallback servery). Cache 24 h zmírňuje.
- **iOS DeviceMotion**: vyžaduje permission popup při prvním motion checku. Některé starší iOS verze API neimplementují.
