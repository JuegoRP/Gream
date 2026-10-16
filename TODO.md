# Gream — TODO & Stavový přehled

> Sdílená paměť napříč sezeními. Při dokončení úkolu zaškrtni `[x]` a přidej datum.
> Formát: `[x] Hotovo (2026-06-10)` / `[ ] Čeká`

---

## Verze 1.1 (větev `release-1.1`, čeká na schválení Romana)
- [x] Greamíci: nové stádium 4 všech šesti ve stylu stádií 2–3, původní v `img/greamici/puvodni/` (2026-10-15)
- [x] Aréna soubojů: životy, energie, speciály, animace útoků; balanc simulací v `npm test` (2026-10-15)
- [x] Rodinný souboj na jednom telefonu, týdenní ligy, bitevní místa (anonymní držitel) (2026-10-15)
- [x] Obchůdek: doplňky viditelné na greamíkovi, výzdoba zahrady (2026-10-15)
- [x] Mapa: výprava dne, vzácné místo, prozkoumané okolí (jen v telefonu) (2026-10-15)
- [x] Pro rodiče: brána před odkazy ven, denní čas hraní, přehled pokroku (2026-10-15)
- [x] Kontrola pravdivosti všech 2 124 otázek (CZ i EN) + ruční posouzení nálezů, opravy (2026-10-15)
- [x] Nové druhy: Pravda/mýtus, Odhadni, Časová osa, Co sem nepatří, Kde to je? (mapa), tematické balíčky – 198 + 33 otázek (2026-10-15)
- [x] „Víš, že…?“ zajímavosti (ověřené) po odpovědi i po chybě (2026-10-15)
- [x] OPRAVA: správná odpověď byla na obrazovce výzvy vždy první (2026-10-15)
- [x] Nastavení: obtížnost zpět v nastavení, přeskupení (2026-10-15)
- [x] Zásady na webu: ligy a bitevní místa – PR 3Rstudio.eu#3 (čeká na schválení) (2026-10-15)
- [x] Balíčky: výběr tématu v souboji (i rodinném); film a hudba 160, věda 163, sport 151, historie 151, jídlo 162, Česko 132 otázek (2026-10-15)
- [ ] Balíček Česko doplnit na 150+
- [x] Mapa: body drží na místě při zoomu (oprava i ve větvích 1.0) (2026-10-15)
- [x] Zářivé greamíky přepracovány: jiné barvy (shiny.js) + stříbrné jiskření, odlišné od Hvězdné záře; viditelné i v aréně (2026-10-16)
- [x] Obchůdek: lišta záložek se nesmršťuje a drží nahoře (2026-10-16)
- [x] Animace vývoje 2→3 a 3→4; galerie `tools/greamici.html` (stádia, doplňky, zahrada, velké chvíle, aréna) (2026-10-16)
- [x] Doplňky ZRUŠENY (nešly napasovat na 12 greamíků × 3 stádia), koupené → semínka zpět (2026-10-16)
- [x] Audit 1.1 (audit/AUDIT.md): mezipaměť SW/náhledu, galerie v Safari, server ARCHES, toast, color-mix – opraveno (2026-10-16)
- [x] Opraveny průhledné díry v obrázcích (Kámen 4 tvář, Atlas 4 zorničky, odlesky očí) – scripts/fix-sprite-holes.py (2026-10-16)
- [x] Zahrada: 5. a 6. greamík už se nekreslí přes sebe; košíček na vejce (stálé místo líhnutí); rodný list (místo a datum vylíhnutí) (2026-10-16)
- [x] Ekonomika: ceny obchodu ×2, bonus za odznak 10→6, plná odměna jen za 5 výher soubojů denně (2026-10-16)
- [x] Boti v souboji: síla podle hráče (klouzavý průměr úspěšnosti), přezdívky „🤖 Zvídavý Brouk“ (2026-10-16)
- [x] Podkategorie otázek (32, jen klasifikace): content/subcats-*, js/subcats.js, kontrola v npm test (2026-10-16)
- [x] Souboj „Účinné!“: poloviční bonus světa přes podkategorii, balanc ověřen (N=20000), Objetí 14 (2026-10-16)
- [x] Noví greamíci podle podkategorií: Tlapka (zvířata), Kaňka (pravopis), Počtík (počítání), Hřejík (emoce), Notička (hudba), Mapka (zeměpis) – líhnou se podle odpovědí vajíčka (≥ 40 % odpovědí ve světě z jejich podkategorie), vajíčko přitahuje otázky svého tématu, vlastní speciály, balanc 12 greamíků ověřen (2026-10-16)
- [x] Hlasy greamíků výš, nové odznaky, menu hudba, kreslené postavičky (avatary) (2026-10-16)
- [x] Záložka Já přeskládaná: Greamíci (vlastní obrazovka s detailem) a Obchůdek zvlášť, Statistiky viditelně vedle Odznaků (2026-10-16)
- [x] Obchůdek: jednotná karta ve všech záložkách; pozadí předělána na panoramata ve stylu zahrady (+ Zimní zahrada, Zahrada u moře) (2026-10-16)
- [x] Vajíčko sedí v košíčku viditelně (2026-10-16)
- [x] Odpočet před soubojem (soupeři najedou, 3 · 2 · 1 · Souboj!) (2026-10-16)
- [x] Načítání: úvodní obrazovka do načtení obrázků zahrady, soubory z mezipaměti verze (sw.js) (2026-10-16)
- [x] Opravy obrázků: Hvězdík 4, Lilek 2, Ahojík 3, Maska 2, Míček 4, Lvíček 2; duha z výzdoby zrušena (semínka zpět) (2026-10-16)
- [x] Zahrada: výběr greamíka bez problikání, předměty blokují celou výšku (greamíci je obcházejí) (2026-10-16)
- [ ] Otázky ze serveru (balíčky obsahu bez nové verze aplikace) – navrženo, čeká na Romana
- [ ] Sloučit release-1.1 do main (PR Gream#4, 3Rstudio.eu#3, 3r-control#2) – Roman schválil, sloučení musí klepnout sám (pojistka Claude Code)
- [x] 24 greamíků podle témat (4 v každém světě, každý své téma) – líhnutí podle nejčastějšího tématu odpovědí, souboj losuje rovnoměrně ze 24 skupin, balanc N=20000 48,9–51,7 % (2026-10-16)
- [x] +419 otázek (cs+en) pro slabé skupiny: knihy a pohádky, cizí jazyky, hádanky a řady, mysl, zdraví a bezpečí, vztahy, divadlo a stavby – ručně posouzeno, 70 vyřazeno (2026-10-16)
- [x] OPRAVA: míchání možností bylo zaujaté – správná odpověď na 1. místě ve 44 % místo 33 % (js/shuffle.js) (2026-10-16)
- [x] Zahrada: předměty mimo cestičku, obcházení, lavička zepředu, pozice drží; jedno vajíčko v košíčku (2026-10-16)
- [x] Zahrada 2D: posuvné panorama, greamíci chodí a používají předměty (lavička, jezírko, hříbek, budka, záhonek, lucerna, košíček), potkávají se; js/garden-life.js (2026-10-16)
- [ ] Rodiště na mapě (špendlík), přihlášení Google Play Games (úspěchy) – po vydání 1.0

## Před vydáním (cíl Q4 2026 — Google Play + App Store)

### Platformní opravy
- [ ] Safari CSS opravy (iOS rendering)
- [x] GPS fallback — funkční flow když uživatel odmítne polohu (2026-07-07) — mapa už netiše nepadne do Prahy: hláška „Poloha je vypnutá" + tlačítko na domácí výzvy
- [ ] Onboarding přepis

### Obsah
- [~] Vlastní artworky — greamíci + vejce + pozadí + ikony hotové (2026-07-01), zbývá: Kenney placeholdery na mapě, barevnější vlnka, stage-varianty gramíků

### Build a distribuce
- [x] Capacitor build Android (2026-10-15) – Capacitor 8, API 36, AAB na GDrive Gream/vydani/1.0.0; iOS čeká
- [ ] Google Play testing track (interní testování)
- [x] Store assety (2026-10-15): ikona 512, úvodní grafika, snímky CZ/EN v store/ a na GDrive; popisky v STORE_LISTING.md
- [x] Hotovo (2026-10-15, PR 3Rstudio.eu#2) **Privacy policy URL** — Google Play i App Store ji u dětských aplikací vyžadují povinně; obsah je vlastně hotový v onboarding v4 textech, stačí publikovat stránku (např. 3rstudio.eu/gream-privacy)
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
