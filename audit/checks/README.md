# Kontroly auditu 1.1 (2026-10-16)

Potřebují Playwright mimo repo: `npm i playwright@1.47.2 && npx playwright install webkit` (v libovolné složce, pak spouštět odtud) a lokální server `python3 -m http.server 8765` v kořeni repa.

- `ui_pages.mjs <url> <složka> [webkit|chromium] [user:heslo]` – všechny obrazovky na iPhonu 13 (WebKit = Safari), snímky + chyby konzole + přetékání do strany. Výsledek 2026-10-16: bez chyb (jen šum WebKitu „placard“).
- `gallery_safari.mjs <url tools/greamici.html> <složka>` – galerie v Safari: všechny části načtené, ukázková zahrada, vývoj, aréna. Výsledek: OK (dřív 3 části padaly).
- `shiny_rate.mjs` – kolik greamíků je zářivých po 2 vývojích (očekáváno ~2 % při 1 : 100 za vývoj). Výsledek: 35/2000.
