# CLAUDE.md — Gream

Outdoorová PWA hra pro děti 7–15 let (vanilla JS + Capacitor). Bez backendu — všechna data včetně GPS zůstávají lokálně na zařízení. Stav a zbývající práce: `TODO.md` a README sekce „Stav projektu".

## Konvence

- **Texty výhradně přes `js/i18n.js`** (EN + CZ kompletní) — nikdy hardcodované řetězce v kódu ani šablonách
- **Žádné nové frameworky/závislosti** — vanilla JS, moduly v `js/`, obrazovky jako šablony v `screens/*.html`
- Logika obrazovek v `js/app.js`, navigace přes `js/router.js` (úklid MapView při změně obrazovky)
- Geo funkce v `js/geo.js` — pozor na cache invalidation a iOS DeviceMotion permission flow
- Soukromí je feature: GPS souřadnice a fotky NIKDY neposílat na server
- Store build: postup v `CAPACITOR.md`

## Testování

```bash
python3 -m http.server 8000
```
Geo funkce: Chrome DevTools → Sensors → Geolocation override, nebo reálný mobil.

## Na konci každé session

1. Zaškrtni hotové položky v `TODO.md` s datem: `[x] Hotovo (RRRR-MM-DD)`
2. Změnila-li se fáze projektu, aktualizuj README sekci „Stav projektu"
3. **Připomeň Romanovi aktualizovat `projects.json`** (admin.romanpavlorek.eu) — n8n agenti z něj čtou živý stav projektů; zastaralý kontext = špatné výstupy celého studia
