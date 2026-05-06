# Gream — v2.2 (Real Map + Geocaching + History)

## Co je v této verzi nové oproti v2.1

### 🗺️ Skutečná OSM mapa s Leafletem
- Leaflet 1.9.4 lazy-loaded z unpkg.com (jen když otevřeš mapu)
- OpenStreetMap dlaždice v reálném zobrazení (zoom, drag, pan)
- POI piny s vlastním DivIcon (kapkový tvar, ikona+barva podle typu)
- Pulsující user marker s živou polohou (`watchPosition`)
- Tlačítko 📍 recenter na user

### 🔥 Geocaching warmth indicator
Když ťukneš na pin, slide-up sheet zobrazí živou vzdálenost a "warmth" pill:
- 🥶 Zima (>800 m)
- 🌥️ Vlažno (300–800 m)
- ☀️ Teplo (100–300 m)
- 🌶️ Hodně teplo (30–100 m)
- 🔥 Jsi na místě (<30 m) → spustí se zvuk geo_arrive a tlačítko se odemkne

Při přiblížení k POI (<30 m) se automaticky aktivuje tlačítko start. Tedy podobný princip jako geocaching.

### 📜 Historie / Recent activity
Nový screen `history` — seznam posledních 50 splněných úkolů s metadaty:
- Den/čas (Dnes / Včera / datum)
- Ikona světa + label kroku
- 🌳 outdoor flag pokud bylo splněno venku
- 📍 jméno POI pokud bylo splněno u konkrétního místa
- GPS coords se ukládají k každému splnění (lokálně, nikdy backend)

### 🛰️ Geo logika — vylepšení
- **Cache invalidation**: když se uživatel pohne >500 m od posledního cache, POI cache se promaže (jinak by viděl staré POI z minulé lokace)
- **Motion detection**: `Geo.detectMotion()` přes `DeviceMotionEvent` (s iOS permission flow) — accelerometer rozlišuje jestli se telefon vážně hýbe vs. statické GPS spoofing
- **POI proximity check**: když výzva začala kliknutím na POI pin, při odeslání proof se ověří, že jsi do 50 m od pinu (jinak chyba "jdi blíž")
- **Photo geotagging**: každý proof se taguje aktuálními GPS souřadnicemi (`Geo.tagWithLocation`) — tag se ukládá do history, takže máš provenance

### 🔧 Service Worker v2.1
- Přidán cache pro Leaflet z unpkg (cache-first, vlastní bucket `gream-leaflet-v1`)
- Přidán cache pro OSM tiles (cache-first, `gream-tiles-v1`)
- Tile/Leaflet cache se nemažou při version upgrade (pouze hlavní cache)
- Bypass pro Overpass API (vlastní logika v Geo modulu)

### 🎨 UX
- Tlačítko 📜 Historie ve quick actions na mapě
- Pulsující user marker (CSS animace `greamPulse`)
- Leaflet styling overrides pro Nunito font

## Kompletní seznam co projekt obsahuje

```
gream/
├── index.html
├── manifest.json
├── sw.js                  ← v2.1 — Leaflet + tiles cache
├── css/
│   ├── base.css
│   ├── layout.css
│   ├── components.css     ← + pulse, leaflet overrides
│   └── themes.css
├── js/
│   ├── app.js             ← + Leaflet renderer, history, warmth
│   ├── badges.js
│   ├── camera.js
│   ├── challenge.js       ← + POI proximity check, geotag proof
│   ├── feedback.js        ← WAV audio + procedural fallback
│   ├── geo.js             ← + cache invalidation, motion, geotag
│   ├── i18n.js            ← 144 challenges + history + warmth strings
│   ├── mapview.js         ← NEW — Leaflet wrapper, lazy-loaded
│   ├── profiles.js        ← + history (last 50 tasks)
│   ├── router.js          ← + MapView cleanup on screen change
│   ├── skins.js
│   ├── speech.js
│   ├── stats.js
│   └── validator.js
├── screens/
│   ├── badge-earned.html
│   ├── badges.html
│   ├── challenge.html
│   ├── draw.html
│   ├── geo-gate.html
│   ├── history.html        ← NEW
│   ├── map-view.html       ← REWORKED — Leaflet + POI sheet
│   ├── map.html            ← + History button in quick actions
│   ├── onboarding.html
│   ├── parent-confirm.html
│   ├── profiles.html
│   ├── settings.html
│   ├── stats.html
│   ├── step-done.html
│   ├── voice-record.html
│   ├── wardrobe.html
│   └── write.html
└── sounds/
    ├── badge_earned.wav
    ├── click.wav
    ├── coin.wav
    ├── error.wav
    ├── geo_arrive.wav
    ├── pop.wav
    ├── step_done.wav
    ├── streak.wav
    ├── success.wav
    ├── tap.wav
    ├── whoosh.wav
    └── world_unlock.wav
```

## Spuštění

```bash
cd gream-final
python3 -m http.server 8000
```

Otevři `http://localhost:8000`. Pro testování geo funkcí ideálně přes mobilní telefon (Chrome/Safari pošle real GPS), nebo Chrome DevTools → Sensors → Geolocation override.

## Co dál (roadmap)

- **Verze 3 — AI validace**: Anthropic API pro skutečné rozpoznávání obrázků (Claude Vision) a textu. Pro foto výzvy skutečně ověří, že na obrázku je strom. Pro textové odpovědi posoudí kvalitu.
- **Komunitní obsah**: rodič/učitel přidá vlastní místo s vlastní výzvou — rozšiřuje to mapu o lokální pamětihodnosti.
- **Family sync**: Firebase pro sdílení historie mezi rodinnými profily — rodič vidí co dítě splnilo (s explicitním souhlasem dítěte u 10+).
- **Sezónní výzvy**: na podzim "najdi 5 barev listů", v zimě "najdi stopy ve sněhu"
- **Týdenní expedice**: 3 POI v jednom světě → bonus odznak
- **Group challenges**: dítě + rodič dělají výzvu společně
- **Push notifikace**: "tvoje výzva čeká!" při ranní rutině (vyžaduje backend)

## Známé limity

- **GPS spoofing** není 100% detekovatelný (motion check pomáhá, ale ne dokonale). Accepted — Gream je motivační, ne security app.
- **Offline mapa**: Leaflet tiles se cachují postupně jak je uživatel projde. Pro plnou offline mapu by bylo třeba pre-stahovat region (verze 3).
- **Overpass API**: občas pomalé (timeout 25 s, 3 fallback servery). Cache 24 h zmírňuje.
- **iOS DeviceMotion**: vyžaduje permission popup, který se zobrazí při prvním motion checku. Některé starší iOS verze API neimplementují.
