# Gream — Google Play closed testing (12 testerů / 14 dní)

Nové osobní Play Console účty (registrované po 13. 11. 2023) musí před produkcí
proběhnout **uzavřený test s ≥12 testery, kteří jsou opt-in, běžící souvisle ≥14 dní**.
Teprve pak jde požádat o „production access". Tenhle dokument = jak to spustit za 10 minut.

Balíček aplikace: `com.gream.app` · Opt-in URL testerů (po publikaci tracku):
**https://play.google.com/apps/testing/com.gream.app**

---

## A) Tvůj setup v Play Console (jednorázově)

1. **Create app** → jméno „Gream", jazyk CS, typ Game, Free.
2. Vyplň povinné sekce (jde i minimálně, doladit před produkcí):
   - App access, Ads = **No ads**, Content rating (dle `STORE_LISTING.md` §5),
     Target audience = **mixed** (dle §6), Data safety (dle §4),
     Privacy policy URL = **https://3rstudio.eu/gream-privacy.html**.
3. **Testing → Closed testing → Create track** (nebo použij výchozí „Alpha").
4. **Testers → Create email list** → vlož ≥12 e-mailů (Gmail účty testerů). Ulož.
   - Tip: nahraj rovnou **15–16 lidí**, ať máš rezervu, kdyby se dva nepřihlásili.
5. **Create new release** → nahraj **signed AAB** (`npx cap build android` / Android
   Studio → Generate Signed Bundle; **keystore ulož na 2 místa!**). versionCode = 1.
6. Release name + krátký changelog → **Review release → Start rollout to Closed testing**.
7. Po publikaci se aktivuje **opt-in URL** výše — tu pošli testerům.
8. **Den 0 = kdy jsou testeři opt-in a test běží.** Od té chvíle počítej 14 dní.

> ⏱️ Dřív spustíš = dřív produkce. Není důvod čekat; build je hotový.

---

## B) Pozvánka pro testery (zkopíruj a rozešli)

> **Předmět:** Vyzkoušíš mi novou hru Gream? (5 minut, do telefonu s Androidem)
>
> Ahoj, spouštím kvízovou hru **Gream** a než půjde veřejně na Google Play,
> potřebuju pár lidí, co ji nainstalují přes testovací program. Zabere to chvilku
> a hodně mi tím pomůžeš.
>
> **Co potřebuju:**
> 1. Napiš mi **e-mail, kterým se přihlašuješ do Google/Obchodu Play** (Gmail).
>    Bez něj tě nemůžu přidat.
> 2. Až ti pošlu odkaz, otevři ho **na Androidu** a klikni na **„Become a tester"
>    / „Stát se testerem"**.
> 3. Pak ti tamtéž naskočí odkaz **„Download it on Google Play"** → nainstaluj Gream.
> 4. **Zahraj si aspoň chvíli** (vylíhni greamíka, splň pár výzev) a nech to
>    nainstalované. Google se dívá, že se to fakt testuje.
>
> Díky moc! Kdyby něco nešlo, napiš mi. — Roman

Druhá zpráva (až budeš mít opt-in URL a jejich e-maily přidané v listu):

> Odkaz je tady 👉 **https://play.google.com/apps/testing/com.gream.app**
> Otevři na Androidu, dej „Stát se testerem", pak „Download on Google Play".
> (Když to píše, že hra není dostupná, dej to za pár minut znovu — chvíli se to propisuje.)

---

## C) Návod pro testery (krok za krokem, pošli s odkazem)

1. Ověř, že jsi mi poslal **správný Gmail** (ten, co máš v Obchodě Play).
2. Na **Androidu** otevři odkaz: https://play.google.com/apps/testing/com.gream.app
3. Klikni **„Stát se testerem" / „Become a tester"**.
4. Objeví se **„Stáhnout z Google Play"** → otevři a **nainstaluj Gream**.
5. Spusť hru, projdi úvod, splň pár výzev. Nech ji nainstalovanou aspoň 2 týdny.
6. Kdyby appka „nebyla dostupná", je to jen propisování — zkus za 15–60 min znovu.

Časté zádrhely:
- **Jiný Gmail** než ten v Play = „nejsi tester". Musí sedět účet.
- Na **iPhonu to nejde** (tohle je Android/Google Play).
- Přihlášení na webu je OK, ale instalace musí proběhnout na Android telefonu.

---

## D) Z testu do produkce (po 14 dnech)

1. Drž **≥12 opt-in testerů** a **14 dní souvislého běhu**. Ideálně ať pár z nich
   appku i reálně otevře (engagement Google sleduje).
2. V Play Console se pak objeví **„Apply for production access"** → vyplň krátký
   dotazník (jak jsi testoval, kolik testerů, feedback). Odešli.
3. Google to posoudí (obvykle pár dní). Po schválení → **Production → Create
   release** → stejný/nový AAB → doplnit finální listing (`STORE_LISTING.md`) →
   rollout.
4. Každý další update = nový AAB s **vyšším versionCode**.

---

## E) Časová osa (příklad)

| Den | Krok |
|---|---|
| 0 | Nahrát AAB do closed tracku, přidat 12+ e-mailů, publikovat, rozeslat opt-in odkaz |
| 0–2 | Testeři se přihlásí a nainstalují (long pole — hlídej, ať jich je fakt 12) |
| 0–14 | Test běží; sem tam pobídni testery, ať appku otevřou |
| 14+ | Apply for production access → Google review (pár dní) |
| ~18–21 | Produkce živě |

→ Spustíš-li closed test **v půlce července**, Gream je reálně venku **kolem
poloviny–konce srpna**.
