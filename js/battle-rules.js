// ═══════════════════════════════════
//  GREAM — battle-rules.js  (pravidla soubojů 1.1, bez DOM)
//  Jediný zdroj pravdy pro aréno (battle.js) i pro test balancu (test/battle-balance.mjs).
//  Životy 100, správná odpověď = útok, rychlost a „svůj svět“ přidají sílu,
//  energie za správné odpovědi → speciál greamíka (stojí ENERGY_COST).
//  Čísla speciálů ladí scripts/tune-battle.mjs – po změně spusť `npm test`.
// ═══════════════════════════════════

import { GROUPS } from './subcats.js';

export const RULES = {
  HP: 100,
  ROUNDS: 10,
  BASE_DMG: 10,       // správná odpověď
  DOMAIN_DMG: 4,      // otázka ze světa mého greamíka („Super účinné!“)
  SPEED_DMG: 3,       // max. bonus za rychlost (lineárně podle zbylého času)
  CRIT_SPEED: 0.8,    // ≥ 80 % rychlostního bonusu = kritický zásah (jen efekt)
  ENERGY_COST: 3,
};

// Speciály – témata podle světa. Čísla ověřená simulací (test/battle-balance.mjs, 2,16 mil. zápasů):
// 24 greamíků (4 v každém světě, každý své téma). Souboj losuje otázky rovnoměrně ze 24 skupin.
// Ověřeno simulací N=20000 na dvojici a úroveň: každý vyhrává 48,9–51,7 %, nejsilnější dvojice 57 : 43.
export const SPECIALS = {
  // Listová smršť a příbuzné (FAMILY = mechanika): poškození hned + příští zásah ×mult
  lilek:   { id: 'leafstorm', mult: 1.95, dmg: 3 },
  tlapka:  { id: 'pounce', mult: 1.95, dmg: 3 },
  micek:   { id: 'goal', mult: 1.95, dmg: 3 },
  klapka:  { id: 'action', mult: 1.95, dmg: 3 },
  // Blesk: poškození + soupeřův příští útok ×stun
  jiskra:  { id: 'bolt', dmg: 12, stun: 0.9 },
  kanka:   { id: 'inkblot', dmg: 12, stun: 0.9 },
  ahojik:  { id: 'babel', dmg: 12, stun: 0.9 },
  hvezdik: { id: 'meteor', dmg: 12, stun: 0.9 },
  // Zeď: poškození + další `hits` zásahy soupeře slabší o `block`
  kamen:   { id: 'wall', block: 0.22, hits: 2, dmg: 8.5 },
  poctik:  { id: 'numshield', block: 0.22, hits: 2, dmg: 8.5 },
  banka:   { id: 'experiment', block: 0.22, hits: 2, dmg: 8.5 },
  maska:   { id: 'curtain', block: 0.22, hits: 2, dmg: 8.5 },
  // Objetí: vyléčí `heal`
  srodik:  { id: 'hug', heal: 14, energy: 0 },
  hrejik:  { id: 'warmhug', heal: 14, energy: 0 },
  zdravik: { id: 'firstaid', heal: 14, energy: 0 },
  mnamka:  { id: 'snack', heal: 14, energy: 0 },
  // Vlna: poškození + příští otázka bez jedné špatné možnosti + příští zásah ×mult
  vlnka:   { id: 'wave', dmg: 2, mult: 2 },
  noticka: { id: 'solo', dmg: 2, mult: 2 },
  hadak:   { id: 'hint', dmg: 2, mult: 2 },
  bajka:   { id: 'oncebefore', dmg: 2, mult: 2 },
  // Kompas: poškození + příští otázka z mé skupiny (jisté „Super účinné!“)
  atlas:   { id: 'compass', dmg: 10.6 },
  mapka:   { id: 'expedition', dmg: 10.6 },
  lvicek:  { id: 'roar', dmg: 10.6 },
  mozik:   { id: 'focus', dmg: 10.6 },
};

// Mechanika speciálu podle „vzoru“ (6 vzorů × 4 greamíci)
export const FAMILY = {
  tlapka: 'lilek', micek: 'lilek', klapka: 'lilek',
  kanka: 'jiskra', ahojik: 'jiskra', hvezdik: 'jiskra',
  poctik: 'kamen', banka: 'kamen', maska: 'kamen',
  hrejik: 'srodik', zdravik: 'srodik', mnamka: 'srodik',
  noticka: 'vlnka', hadak: 'vlnka', bajka: 'vlnka',
  mapka: 'atlas', lvicek: 'atlas', mozik: 'atlas',
};
export const fam = (a) => FAMILY[a] || a;

// Skupina a svět každého greamíka (z GROUPS v subcats.js)
export const ARCH_GROUP = {}, ARCH_WORLD = {}, GROUP_WORLD = {};
for (const [g, v] of Object.entries(GROUPS)) { ARCH_GROUP[v.arch] = g; ARCH_WORLD[v.arch] = v.world; GROUP_WORLD[g] = v.world; }
export const ARCHES = Object.keys(ARCH_GROUP);
export const GROUP_IDS = Object.keys(GROUPS);
export const BASE_ARCHES = ['lilek', 'jiskra', 'kamen', 'srodik', 'vlnka', 'atlas'];

export function newFighter(arch, extra = {}) {
  return { arch, hp: RULES.HP, energy: 0, mult: 1, stun: 1, wall: 0, fiftyNext: false, ownWorldNext: false, ...extra };
}

export const canSpecial = (f) => f.energy >= RULES.ENERGY_COST && f.hp > 0;

// Použije speciál na začátku kola. Vrací popis pro animaci.
export function useSpecial(me, op) {
  if (!canSpecial(me)) return null;
  const s = SPECIALS[me.arch]; if (!s) return null;
  me.energy -= RULES.ENERGY_COST;
  const ev = { arch: me.arch, id: s.id, dmg: 0, heal: 0 };
  switch (fam(me.arch)) {
    case 'lilek':  me.mult = s.mult; if (s.dmg) { op.hp -= s.dmg; ev.dmg = s.dmg; } break;
    case 'jiskra': op.hp -= s.dmg; ev.dmg = s.dmg; op.stun = s.stun; break;
    case 'kamen':  me.wall = s.hits; me.wallBlock = s.block; if (s.dmg) { op.hp -= s.dmg; ev.dmg = s.dmg; } break;
    case 'srodik':  { const h = Math.min(RULES.HP - me.hp, s.heal); me.hp += h; ev.heal = h; me.energy += s.energy; break; }
    case 'vlnka':  op.hp -= s.dmg; ev.dmg = s.dmg; me.fiftyNext = true; me.mult = s.mult; break;
    case 'atlas':  op.hp -= s.dmg; ev.dmg = s.dmg; me.ownWorldNext = true; break;
  }
  return ev;
}

// Jednoduchá AI soupeře/bota: použij speciál hned, Srdík až když léčení nepropadne.
export function aiWantsSpecial(me) {
  if (!canSpecial(me)) return false;
  if (fam(me.arch) === 'srodik') return me.hp <= RULES.HP - SPECIALS[me.arch].heal * 0.8;
  return true;
}

// Poškození jedné správné odpovědi (před štítem soupeře).
// speedFrac = 0..1 (podíl zbylého času), domain = 1 otázka ze světa útočníka („Super účinné!“),
// 0.5 = otázka se jeho světa týká zčásti přes podkategorii („Účinné!“), 0 = jinak (true/false se bere jako 1/0)
export const domainWeight = (d) => d === true ? 1 : Math.max(0, Math.min(1, +d || 0));
export function attackDamage(me, { speedFrac = 0, domain = 0 } = {}) {
  const raw = RULES.BASE_DMG + RULES.DOMAIN_DMG * domainWeight(domain) + RULES.SPEED_DMG * Math.max(0, Math.min(1, speedFrac));
  return raw * me.mult * me.stun;
}

// Vyhodnotí kolo: oba útočí současně. a/b = { ok, speedFrac, domain }
// Vrací zásahy pro animaci: [{ from:0|1, dmg, crit, domain, blocked }]
export function resolveRound(f, a, b) {
  const hits = [];
  [[0, a], [1, b]].forEach(([i, r]) => {
    const me = f[i], op = f[1 - i];
    const usedMult = me.mult !== 1;
    if (r.ok) {
      me.energy++;
      let d = attackDamage(me, r);
      let blocked = false;
      if (op.wall > 0) { d *= 1 - (op.wallBlock ?? SPECIALS.kamen.block); op.wall--; blocked = true; }
      op.hp -= d;
      const dw = domainWeight(r.domain);
      hits.push({ from: i, dmg: Math.round(d), crit: (r.speedFrac || 0) >= RULES.CRIT_SPEED, domain: dw >= 1, half: dw > 0 && dw < 1, blocked, boosted: usedMult });
      me.mult = 1;   // Listová smršť platí na jeden zásah
    }
  });
  f.forEach(x => { x.stun = 1; });   // omráčení platí jedno kolo
  return hits;
}

export const isOver = (f, round) => f[0].hp <= 0 || f[1].hp <= 0 || round >= RULES.ROUNDS;

// Výsledek: 0 = vyhrál hráč 0, 1 = hráč 1, -1 = remíza (rozhodne náhlá smrt v UI)
export function winner(f) {
  if (f[0].hp === f[1].hp) return -1;
  return f[0].hp > f[1].hp ? 0 : 1;
}

// ─── Simulace (test balancu a ladění) ───
// K = pravděpodobnost, že hráč odpověď zná; jinak tipuje mezi `choices` možnostmi.
// Bonus greamíka za otázku: 1 = otázka z jeho skupiny („Super účinné!“), 0.5 = jiná skupina jeho světa nebo
// vedlejší podkategorie z jeho skupiny („Účinné!“), jinak 0. q = { world, group, side }
export function domainWeightFor(arch, q) {
  const g = ARCH_GROUP[arch];
  if (!g) return 0;
  if (q.group === g) return 1;
  return (q.world === ARCH_WORLD[arch] || q.side === g) ? 0.5 : 0;
}
// Podíl otázek s vedlejší podkategorií (změřeno na datech 1.1)
export const SIDE_SHARE = 0.26;
// Souboj vybírá otázky tak, že každá skupina přijde na řadu stejně často → simulace táhne skupinu rovnoměrně
export function simulate(archA, archB, K, rnd = Math.random, choices = 3) {
  const f = [newFighter(archA), newFighter(archB)];
  for (let r = 0; r < RULES.ROUNDS; r++) {
    for (let i = 0; i < 2; i++) if (aiWantsSpecial(f[i])) useSpecial(f[i], f[1 - i]);
    if (f[0].hp <= 0 || f[1].hp <= 0) break;
    const group = GROUP_IDS[Math.floor(rnd() * GROUP_IDS.length)];
    const q = { group, world: GROUP_WORLD[group], side: rnd() < SIDE_SHARE ? GROUP_IDS[Math.floor(rnd() * GROUP_IDS.length)] : null };
    const ans = f.map(me => {
      const knows = rnd() < K;
      const ok = knows || rnd() < (me.fiftyNext ? 1 / (choices - 1) : 1 / choices);
      const domain = me.ownWorldNext ? 1 : domainWeightFor(me.arch, q);
      me.fiftyNext = false; me.ownWorldNext = false;
      return { ok, domain, speedFrac: ok ? (knows ? 0.4 + rnd() * 0.6 : rnd() * 0.35) : 0 };
    });
    resolveRound(f, ans[0], ans[1]);
    if (f[0].hp <= 0 || f[1].hp <= 0) break;
  }
  const w = winner(f);
  return w === -1 ? (rnd() < 0.5 ? 0 : 1) : w;
}

// Matice výher: out[a][b] = % výher a proti b (střídá se pořadí kvůli férovosti)
export function winMatrix(K, N = 4000, rnd = Math.random) {
  const out = {};
  for (const a of ARCHES) { out[a] = {};
    for (const b of ARCHES) {
      let w = 0;
      for (let i = 0; i < N; i++) { if (i % 2) { if (simulate(b, a, K, rnd) === 1) w++; } else if (simulate(a, b, K, rnd) === 0) w++; }
      out[a][b] = w / N * 100;
    }
  }
  return out;
}
