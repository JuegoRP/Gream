# Gream — Store Listing podklady (Google Play + App Store)

Hotové texty a přesné odpovědi do formulářů. Vše odpovídá REÁLNému chování hry
(souboje/leaderboard posílají přezdívku+skóre; GPS a fotky NIKDY neopouští zařízení).
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
| In-app purchases | ANO — Premium (odemyká Extreme obtížnost + domácí souboje) |
| Reklamy | NE |

---

## 2. Krátký popis (Play: ≤ 80 znaků)

- **CS:** `Kvízová hra pro celou rodinu — venku, se sbíratelným mazlíčkem a souboji.`
- **EN:** `Family quiz game — explore outdoors, raise a pet, battle other players.`

## 3. Dlouhý popis (Play: ≤ 4000 znaků)

### CS
```
Gream je kvízová hra pro celou rodinu. Otázky od úplně snadných po expertní —
zábava pro děti i dospělé, každý si najde svou obtížnost.

🧠 KVÍZY, KTERÉ BAVÍ
Šest světů: příroda, jazyk, logika, pocity, umění a svět kolem nás. Pestré typy
otázek — výběr, počítání, doplňování, řazení i párování. Žádné nudné opakování.

🐣 SBÍREJ A VYCHOVEJ GREAMÍKY
Za plnění výzev líhneš vajíčka a vychováváš svoje greamíky. Vyvíjejí se, jak se
zlepšuješ — a v soubojích ti dávají bonusový čas ve svém oboru.

🗺️ OBJEVUJ SVĚT VENKU
Volitelné venkovní výzvy tě pošlou do parku, na hřiště nebo za roh. Poloha se
zpracovává jen v telefonu — souřadnice nikdy neopustí tvoje zařízení. Na mapě
uvidíš, kolik hráčů které místo splnilo.

⚔️ SOUBOJE A ŽEBŘÍČKY
Změř síly v časově omezených soubojích proti záznamům jiných hráčů. Každý den
navíc denní kolo — všichni mají stejných 10 otázek a společný žebříček.

🔒 BEZPEČNÉ I PRO DĚTI
Žádné reklamy. Žádné sledování. Bezpečný obsah a rodičovská obrazovka na úvod.
Kids-first, ale kvízy baví každého.

Zdarma s volitelným Premium (Extreme obtížnost a domácí souboje).
```

### EN
```
Gream is a quiz game for the whole family. Questions from very easy to expert —
fun for kids and adults alike, everyone finds their difficulty.

🧠 QUIZZES THAT ARE ACTUALLY FUN
Six worlds: nature, language, logic, feelings, arts and the world around us.
Varied question types — choice, counting, fill-in, sorting and matching.
No boring repetition.

🐣 COLLECT AND RAISE GREAMÍCI
Completing challenges hatches eggs and grows your greamíci (pets). They evolve as
you improve — and give you bonus time in their field during battles.

🗺️ EXPLORE THE WORLD OUTDOORS
Optional outdoor challenges send you to a park, playground or around the corner.
Location is processed on your phone only — coordinates never leave your device.
On the map you can see how many players completed each place.

⚔️ BATTLES AND LEADERBOARDS
Test yourself in timed battles against other players' recorded runs. Plus a daily
round — everyone gets the same 10 questions and a shared leaderboard.

🔒 SAFE FOR KIDS TOO
No ads. No tracking. Safe content and a parent screen at the start.
Kids-first, but the quizzes are fun for everyone.

Free with optional Premium (Extreme difficulty and home battles).
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

### NEsbírané / NEsdílené (explicitně)
- **Location** → NE. Poloha se zpracovává jen v zařízení pro venkovní výzvy;
  souřadnice se NEodesílají. (Oprávnění polohy ano, ale data neopouští zařízení.)
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
- **Digital purchases** → **ANO** (Premium předplatné).
- Sdílí polohu s ostatními? → **NE** (jen anonymní počty u míst, ne kdo/kde jsi).

Očekávaný rating: nízký (PEGI 3 / ESRB Everyone), případně s „Users Interact"
a „In-App Purchases" štítky.

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

**Dvě cesty na Play:**
- **A) Mixed audience hned** (dětská i 13+/dospělá pásma) — appka pro všechny;
  poctivě vyplnit Data Safety §4 + „users interact" §5. Máme safeguardy.
- **B) 13+ napřed, mixed v updatu** — nejhladší první schválení (leaderboard u dětí
  nezkoumají), cílovku lze rozšířit kdykoli později.

**Doporučení:** pokud chceš dosah na děti od začátku, jdi **A) mixed audience** —
jsme na to připravení. Kdo chce nulové riziko u prvního review, zvolí **B)**.

---

## 7. Screenshoty (co nafotit)

Telefon (povinné, min. 2, ideál 8) + 7" a 10" tablet. Návrh 8 záběrů:
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
- [ ] Nastavit Premium jako in-app produkt (Play Console → Products)
- [ ] Screenshoty §7 + popisy §2/§3
- [ ] Interní test track → poté produkce
