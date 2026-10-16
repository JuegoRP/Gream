# Gream — Store Listing podklady (Google Play + App Store)

Hotové texty a přesné odpovědi do formulářů. Vše odpovídá REÁLNému chování hry
(souboje/leaderboard posílají přezdívku+skóre; kvůli mapě jde na náš server přibližná poloha ≈ 500 m,
přesná poloha a fotky NIKDY neopouští zařízení). Aktualizováno 2026-10-16 (verze 1.1: Gream Plus, promo kódy, nové otázky ze serveru).
Privacy policy URL do listingu: **https://3rstudio.eu/gream-privacy.html**

---

## 1. Základ

| Pole | Hodnota |
|---|---|
| Název | **Gream** |
| Package / Bundle ID | `com.gream.app` |
| Kategorie (Play) | Games → **Trivia** (alt: Educational) |
| Kategorie (App Store) | **Trivia** (Games) |
| Web | https://3rstudio.eu/gream.html |
| Privacy Policy | https://3rstudio.eu/gream-privacy.html |
| Kontakt | romanpavlorek@gmail.com |
| In-app purchases | **ANO – předplatné Gream Plus** přes Google Play Billing za rodičovskou bránou: `gream_plus_monthly` (89 Kč/měs), `gream_plus_yearly` (749 Kč/rok). Bez trialu v Play (7 dní zdarma řeší hra sama, bez karty). Pro celé zařízení. |
| Reklamy | NE |

---

## 2. Krátký popis (Play: ≤ 80 znaků)

- **CS:** `Vylušti. Vylíhni. Vyraž ven. Kvíz pro celou rodinu s 24 greamíky.` (68)
- **EN:** `Quiz. Hatch. Explore. A family quiz game with 24 Greams to collect.` (67)

## 3. Dlouhý popis (Play: ≤ 4000 znaků)

### CS
```
Vylušti. Vylíhni. Vyraž ven.
Gream je kvízová hra pro celou rodinu. Přes 2 500 ověřených otázek od úplně
snadných po expertní – a každý týden nové. Zábava pro děti i dospělé.

🧠 KVÍZY, KTERÉ BAVÍ
Šest světů a 33 témat: zvířata, vesmír, pravopis, hádanky, historie, film, Česko
a další. Pestré typy otázek — výběr, psaní, odhad, řazení, párování i „Kde to je?“.

🐣 SBÍREJ A VYCHOVEJ GREAMÍKY
Z vajíčka se vylíhne greamík podle témat, na která nejčastěji odpovídáš. Je jich 24
a každý roste ve třech stádiích – v souboji má výhodu ve svém tématu a vlastní schopnost.

🗺️ OBJEVUJ SVĚT VENKU
Kompas tě dovede k výzvám kolem tebe. Venku čeká výprava dne, nová vajíčka a vzácná
místa soubojů – a greamíci tam rostou dvakrát rychleji. Přesná poloha zůstává
v telefonu — kvůli mapě posíláme jen přibližnou polohu a neukládáme ji.

⚔️ SOUBOJE A ŽEBŘÍČKY
Souboje proti nahrávkám jiných hráčů, denní kolo se stejnými otázkami pro všechny,
týdenní liga od bronzu po diamant a rodinný souboj na jednom telefonu.

🔒 BEZPEČNÉ I PRO DĚTI
Žádné reklamy. Žádné sledování. Bezpečný obsah a rodičovská obrazovka na úvod.
Rodičovská brána u nákupů a denní limit hraní.

Hra je zdarma. Prvních 7 dní je odemčené vše; potom volitelné předplatné Gream Plus
pro celou rodinu. Venkovní výzvy, výpravy a vajíčka zůstávají zdarma navždy.
```

### EN
```
Quiz. Hatch. Explore.
Gream is a quiz game for the whole family. Over 2,500 fact-checked questions from
very easy to expert – and new ones every week. Fun for kids and adults alike.

🧠 QUIZZES THAT ARE ACTUALLY FUN
Six worlds and 33 topics: animals, space, spelling, riddles, history, film and more.
Varied question types — choice, typing, estimates, sorting, matching and “Where is it?”.

🐣 COLLECT AND RAISE GREAMÍCI
Your egg hatches into a Gream based on the topics you answer most. There are 24,
each grows through three stages – with an edge on its topic and its own special move.

🗺️ EXPLORE THE WORLD OUTDOORS
The compass guides you to challenges nearby. Outside await the daily trip, new eggs
and rare battle spots – and Greams grow twice as fast. Your precise location stays
on your phone — for the map we only send an approximate location and never store it.

⚔️ BATTLES AND LEADERBOARDS
Battles against other players' recordings, a daily round with the same questions
for everyone, a weekly league from bronze to diamond and a family battle on one phone.

🔒 SAFE FOR KIDS TOO
No ads. No tracking. Safe content and a parent screen at the start.
Parental gate for purchases and a daily play-time limit.

The game is free. Everything is unlocked for the first 7 days; after that an optional
Gream Plus subscription for the whole family. Outdoor challenges, trips and eggs stay free forever.
```

---

## 4. Data Safety formulář (Google Play) — PŘESNĚ

> ⚠️ NEsmí se deklarovat „no data collected". Hra data sbírá a sdílí.

**Does your app collect or share user data?** → **YES**

**Encrypted in transit?** → **YES** (HTTPS)
**Can users request data deletion?** → **YES** (e-mailem + in-app „Smazat všechna data" pro lokální data)

### Collected + Shared data types
| Data type | Collected | Shared | Účel | Nepovinné? |
|---|---|---|---|---|
| **Personal info → Name** (zvolená přezdívka) | ANO | ANO (veřejný leaderboard) | App functionality | Vyžadováno pro hru |
| **App activity → Other actions** (skóre, rating, splněné výzvy/POI) | ANO | ANO (leaderboard, počty u míst) | App functionality | — |

**Verze 1.1 – beze změny kategorií** (vše spadá pod App activity / Name výše):
- Týdenní liga: body ze soubojů pod náhodným ID hráče + přezdívka v tabulce ligy.
- Bitevní místa: u místa (id POI) server drží jen greamíka, skóre a náhodný žeton držitele, 14 dní – bez přezdívky a ID hráče.
- Jen v zařízení: prozkoumané okolí (buňky 200 m), výprava dne, denní čas hraní (rodič), otázka „Kde to je?“ (polohu nepoužívá).

**Verze 1.1+ (16. 10.) – beze změny kategorií:**
- Nahrávka souboje (odpovědi správně/špatně + čas + greamík) – App activity, zobrazí se soupeři s přezdívkou.
- Nové otázky: aplikace posílá jen číslo verze obsahu (žádná data o uživateli).
- Promo kód: posílá se jen kód; server ukládá jen počet použití (žádné ID).
- **Gream Plus přes Google Play Billing:** platbu a historii nákupů zpracovává Google, na náš server nic nejde → *Financial info* NEdeklarujeme jako sbírané naší aplikací. **Ověřit v Play Console** nápovědu k Data safety pro Play Billing při vyplňování.

### NEsbírané / NEsdílené (explicitně)
- **Location → Precise location** → NE. Přesné souřadnice zůstávají v zařízení (vzdálenost k místům se počítá v telefonu).
- **Location → Approximate location** → **ANO, collected, NOT shared**, *processed ephemerally* (zaškrtnout „Data is processed ephemerally“), účel **App functionality**, povinné pro mapu.
  Aplikace posílá na náš server (3rstudio.eu) polohu zaokrouhlenou na ≈ 500 m; server podle ní najde místa v okolí (Overpass/OpenStreetMap, dotaz už jen se zaokrouhlenou buňkou, bez IP a bez vazby na hráče) a posílá mapové dlaždice (OpenFreeMap přes naši cache). Nic se neukládá.
- **Photos/Media** → NE (fotky zůstávají lokálně).
- **Device or other IDs** → NE. Náhodné hráčské ID je generované appkou, není to
  Android/reklamní ID a neslouží k trackingu.
- **Email, phone, contacts, financial info** → NE.
- **App info & performance (crash logy)** → NE (neposíláme).
- **NO ads, NO third-party analytics, NO cross-app tracking, data se NEprodávají.**

---

## 5. Content rating (IARC dotazník) — odpovědi

- Násilí / krev → **žádné**
- Sexuální obsah / nahota → **žádné**
- Vulgarita → **žádná** (přezdívky navíc filtrovány profanity filtrem)
- Drogy / alkohol / tabák → **žádné**
- Hazard (i simulovaný) → **žádný** (semínka se získávají hrou, ne sázkou s náhodou)
- Strach / horor → **žádný**
- **Users interact / Shares user-provided content** → **ANO, částečně:** hráči si
  volí přezdívku, která je viditelná ostatním na leaderboardu. **NENÍ** volný chat
  ani přímé zprávy mezi hráči. → odpovědět pravdivě „users can interact / user-
  generated content: display names on leaderboard", což může přidat štítek
  „Users Interact". Neskrývat — recenze to odhalí.
- **Digital purchases** → **NE** ve verzi 1.0 (Premium až v aktualizaci → pak změnit na ANO).
- Sdílí polohu s ostatními? → **NE** (jen anonymní počty u míst, ne kdo/kde jsi).

Očekávaný rating: nízký (PEGI 3 / ESRB Everyone), případně se štítkem „Users Interact".

---

## 6. Cílová skupina & Families — „mixed audience" (OBOJÍ jde)

V Google Play „Target audience and content" jde zaškrtnout **víc věkových pásem
najednou** (pod 5 / 5–8 / 9–12 / 13–15 / 16–17 / 18+). Dětská + dospělá pásma
zároveň = **mixed audience** = appka pro všechny, ale spadá pod **Families policy**.

**Splňujeme** (většina hotová): žádné reklamy, žádný tracking/3rd-party analytics,
privacy policy, rodičovská brána, přezdívka ≠ skutečné jméno (varování) + profanity
filtr, mazání dat na žádost.

**Jediný bod ke zkoumání u dětí:** veřejný **leaderboard s přezdívkami** = sociální/
sdílecí prvek (COPPA/GDPR-K). Obhajitelné: pseudonymní, filtrované, žádný chat,
smazatelné. Ve formuláři přiznat „users interact: display names on leaderboard".

**App Store:** žádné buď/anebo — publikovat jako normální appku **4+** (dostupná
všem); NEopvírat přísnou „Kids Category".

**ROZHODNUTÍ: mixed audience** (zaškrtnout dětská i 13+/dospělá pásma).
Odpovídá identitě hry (kids-first + all-ages) a dosahu v rodinné/kids kategorii.

Leaderboard-riziko je **technicky ošetřené v appce:** u zadání přezdívky
(onboarding krok 5) je explicitní výzva „přezdívku uvidí ostatní v žebříčcích,
nepoužívej svoje pravé jméno" + profanity filtr → doložitelné opatření proti
zveřejnění identifikačních údajů dítěte. Ve formuláři přiznat „users interact:
pseudonymní přezdívky na leaderboardu, žádný chat".

Vyplnit: Target audience = dětská + dospělá pásma; Data Safety §4; content rating §5.
(Nechceš-li u úplně prvního review řešit leaderboard, lze dočasně cílit 13+ a rozšířit
na mixed v updatu — ale default je mixed.)

---

## 7. Screenshoty (co nafotit)

**Hotové snímky (16. 10.):** GDrive `Gream/store/` – CZ i EN, 1080×2160 (poměr 1:2 = limit Google Play), zahrada, výzva, souboj, mapa s kompasem, sbírka greamíků. Ikona 512 px: `Assety/brand/play-store-icon-512.png`, feature graphic 1024×500: GDrive `Gream/store/feature-graphic-cs.png` / `-en.png`, ikona tamtéž `icon-512.png`.

Telefon (povinné, min. 2, ideál 8) + 7" a 10" tablet. Původní návrh 8 záběrů:
1. Onboarding — vajíčko/„Tvůj greamík" (wow moment)
2. Domů — zahrada s greamíky + 3 tlačítka (Domácí výzva / Pojď ven / Souboj)
3. Výzva typu choice (otázka + odpovědi)
4. Mapa — POI body, ⚔️ battle spot, „👥 N"
5. Souboj — kolo s časovým odpočtem
6. Výsledek souboje + 🏆 leaderboard
7. Detail greamíka / evoluce
8. Denní kolo 📅 + denní žebříček

Feature graphic 1024×500, ikona 512×512 (z `icons/`).

---

## 8. Před nahráním — checklist

- [ ] Google Play účet ($25) / Apple Developer ($99/rok)
- [ ] `npx cap add android` → signed AAB; **keystore bezpečně uschovat** (ztráta = konec updatů)
- [ ] versionCode/versionName nastavit (a bumpovat při každém updatu)
- [ ] Vložit privacy URL: https://3rstudio.eu/gream-privacy.html
- [ ] Data Safety dle §4 (NE „no collection")
- [ ] Content rating dle §5
- [ ] Předplatné: v Play Console založit `gream_plus_monthly` (89 Kč) a `gream_plus_yearly` (749 Kč), bez Play trialu; otestovat nákup na interním testu
- [ ] Screenshoty §7 + popisy §2/§3
- [ ] Interní test track → poté produkce
