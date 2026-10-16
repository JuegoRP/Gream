# Audit: Gream 1.1 (2026-10-16, větev release-1.1)

Rozsah: UI na mobilu (iPhone 13, WebKit/Safari + Chromium) všech obrazovek, galerie, doplňky, odznaky, service worker a mezipaměť, server, balanc. Podnět: Roman hlásil „odznaky se rozbily“, „doplňky nesedí“, „náhled galerie nefunguje“, „Kámen 4 má průhlednou hlavu“.

## Verdikt
Kód 1.1 je v dobrém stavu: všech 5 sad testů prochází (obsah 4 214 otázek, simulace, UI 31/31, líhnutí, balanc 12 greamíků) a v Safari se všechny obrazovky načtou bez chyby. Většina toho, co Roman viděl jako „rozbité“, měla **jednu kořenovou příčinu: telefon ukazoval staré soubory** – service worker bral CSS a obrázky z mezipaměti a náhled neposílal `Cache-Control`, takže nový JS běžel se starým CSS (rozsypané odznaky) a starým obrázkem Kámena 4 (díra v hlavě je opravená od commitu 6b51a38). Druhá samostatná chyba: galerie v Safari padala, protože dynamický `import()` v Safari ignoruje `<base href>`. Doplňky na 12 greamících × 3 stádiích věrohodně nesedí → podle Romanova rozhodnutí zrušeny. Vše níže je opraveno.

## Scorecard
| Oblast | Skóre 1–5 | Důvod |
|---|---|---|
| Kód a testy | 4 | 5 sad testů zelených, server s testy; app.js je přes 4 500 řádků (riziko) |
| UI mobil | 4 | bez přetékání a chyb; po opravách mezipaměti konzistentní |
| Nasazení / mezipaměť | 2 → 4 | hlavní příčina hlášených chyb, opraveno (SW + hlavička náhledu + číslo sestavení) |
| Herní balanc | 4 | 12 greamíků 47–52 % (N=20 000), Vlnka u expertů 47,0–47,3 % na hraně |
| Vizuál | 4 | jednotné karty, nová pozadí a avatary; doplňky byly slabé místo (zrušeny) |

## Nálezy
| # | Závažnost | Oblast | Nález | Důkaz | Ověřeno | Oprava | Práce |
|---|---|---|---|---|---|---|---|
| 1 | HIGH | Nasazení | Telefon ukazuje staré CSS a obrázky: SW `cacheFirst` pro `.css` a média + přednačtení z HTTP mezipaměti; náhled bez `Cache-Control` | sw.js:66 (css v cache-first), sw.js:27 (`addAll` bez `cache:'reload'`); `curl -I` náhledu: chyběl Cache-Control | ANO | CSS/HTML network-first s `cache:'no-cache'`, média s ověřením po nové verzi, náhled `Cache-Control: no-cache` (Caddy), číslo sestavení v Nastavení | S |
| 2 | HIGH | Galerie | V Safari se nenačetly části Zahrada, Velké chvíle, Aréna („Importing a module script failed“, 404) | tools/greamici.html: `await import('./js/…')` → Safari hledá tools/js/… | ANO (WebKit) | statické importy | S |
| 3 | HIGH | Herní obsah | Doplňky nesedí na všech greamících (12 druhů × 3 stádia × 8 doplňků = 288 kombinací, ručně kotvené) | snímky zahrady/arény, Roman | ANO | zrušeno (rozhodnutí Romana), koupené doplňky → semínka zpět | M |
| 4 | MED | Server | Server odmítal greamíky podkategorií v bitevních místech a nahrávkách (ARCHES jen 6) | server/gream-api.js:80 | ANO (test/server.mjs 13/13) | ARCHES rozšířen, nasazeno se zálohou | S |
| 5 | MED | UI | Hláška (toast) ujížděla o půl šířky doprava | app.js `_showToast`: `translateX(-50%)` přepsán animací slideUp; snímek 01-zahrada | ANO | centrování bez transform | S |
| 6 | LOW | Kompatibilita | `color-mix()` v odznacích – starší Android WebView / Safari < 16.2 ho neumí (medaile bez barvy) | css/components.css (bdg-medal, bdg-path) | ČÁSTEČNĚ (kód) | předpočítané průhledné barvy | S |
| 7 | LOW | Kód | js/app.js má ~4 500 řádků a míchá obrazovky | wc -l | ANO | rozdělit podle obrazovek (po vydání) | L |
| 8 | LOW | Balanc | Vlnka u expertů 46,7–47,3 % (hranice 47,5 při N=20 000) | test/battle-balance.mjs | ANO | při dalším ladění +1 poškození Barevné vlně a ověřit | S |

## Ponechat (silné stránky)
- Testy: obsah (4 214 otázek, pravdivost, podkategorie), UI 31/31, líhnutí, balanc 12 greamíků simulací, server.
- 2D zahrada s chováním greamíků (GardenLife) – plynulá, bez chyb v Safari.
- Jednotná karta obchůdku (_shopCard), nová pozadí a postavičky v jednom stylu.
- Soukromí: aplikace se nespojí s cizí doménou, poloha jen zaokrouhlená.

## Kontroly k opakování
viz `audit/checks/README.md` – ui_pages.mjs (všechny obrazovky v Safari), gallery_safari.mjs, shiny_rate.mjs.

## Neauditováno
- Skutečný telefon (iPhone/Android) – jen emulace WebKit/Chromium; zvuk (hlasy) nejde ověřit headless.
- Android build (AAB) 1.1 – staví se až po schválení.
- Výkon na slabém telefonu (zahrada animuje až 6 greamíků).
