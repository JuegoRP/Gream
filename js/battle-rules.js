// ═══════════════════════════════════
//  GREAM — battle-rules.js  (pravidla soubojů 1.1, bez DOM)
//  Jediný zdroj pravdy pro aréno (battle.js) i pro test balancu (test/battle-balance.mjs).
//  Životy 100, správná odpověď = útok, rychlost a „svůj svět“ přidají sílu,
//  energie za správné odpovědi → speciál greamíka (stojí ENERGY_COST).
//  Čísla speciálů ladí scripts/tune-battle.mjs – po změně spusť `npm test`.
// ═══════════════════════════════════

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
// každý greamík vyhrává 47,6–51,9 % na úrovni začátečník / průměr / expert, nejsilnější dvojice 57 : 43
// (od 2026-10-16 včetně „Účinné!“ – poloviční bonus světa přes podkategorii, HALF_SHARE).
export const SPECIALS = {
  lilek:  { id: 'leafstorm', mult: 2, dmg: 2 },            // Listová smršť: 2 poškození hned + příští zásah 2×
  jiskra: { id: 'bolt', dmg: 10, stun: 0.8 },              // Blesk: 10 poškození + soupeřův příští útok −20 %
  kamen:  { id: 'wall', block: 0.25, hits: 2, dmg: 7 },    // Kamenná zeď: 7 poškození + další 2 zásahy soupeře −25 %
  srodik:  { id: 'hug', heal: 14, energy: 0 },              // Objetí: vyléčí 14 (2026-10-16: 13 → 14 po zavedení „Účinné!“ z podkategorií)
  vlnka:  { id: 'wave', dmg: 1, mult: 2 },                 // Barevná vlna: 1 poškození + příští otázka bez jedné špatné možnosti + příští zásah 2×
  atlas:  { id: 'compass', dmg: 10 },                      // Kompas: 10 poškození + příští otázka z mého světa (jistý „Super účinné!“)
};

export const ARCH_WORLD = { lilek: 'nature', jiskra: 'language', kamen: 'logic', srodik: 'feelings', vlnka: 'arts', atlas: 'world' };
export const ARCHES = Object.keys(ARCH_WORLD);

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
  switch (me.arch) {
    case 'lilek':  me.mult = s.mult; if (s.dmg) { op.hp -= s.dmg; ev.dmg = s.dmg; } break;
    case 'jiskra': op.hp -= s.dmg; ev.dmg = s.dmg; op.stun = s.stun; break;
    case 'kamen':  me.wall = s.hits; if (s.dmg) { op.hp -= s.dmg; ev.dmg = s.dmg; } break;
    case 'srodik':  { const h = Math.min(RULES.HP - me.hp, s.heal); me.hp += h; ev.heal = h; me.energy += s.energy; break; }
    case 'vlnka':  op.hp -= s.dmg; ev.dmg = s.dmg; me.fiftyNext = true; me.mult = s.mult; break;
    case 'atlas':  op.hp -= s.dmg; ev.dmg = s.dmg; me.ownWorldNext = true; break;
  }
  return ev;
}

// Jednoduchá AI soupeře/bota: použij speciál hned, Srdík až když léčení nepropadne.
export function aiWantsSpecial(me) {
  if (!canSpecial(me)) return false;
  if (me.arch === 'srodik') return me.hp <= RULES.HP - SPECIALS.srodik.heal * 0.8;
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
      if (op.wall > 0) { d *= 1 - SPECIALS.kamen.block; op.wall--; blocked = true; }
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
// HALF_SHARE = podíl otázek, které se přes podkategorii týkají i jiného světa (změřeno na datech 1.1: 26 %)
export const HALF_SHARE = 0.26;
export function simulate(archA, archB, K, rnd = Math.random, choices = 3) {
  const f = [newFighter(archA), newFighter(archB)];
  for (let r = 0; r < RULES.ROUNDS; r++) {
    for (let i = 0; i < 2; i++) if (aiWantsSpecial(f[i])) useSpecial(f[i], f[1 - i]);
    if (f[0].hp <= 0 || f[1].hp <= 0) break;
    const qWorld = ARCHES[Math.floor(rnd() * 6)];
    const halfWorld = rnd() < HALF_SHARE ? ARCHES.filter(a => a !== qWorld)[Math.floor(rnd() * 5)] : null;
    const ans = f.map(me => {
      const knows = rnd() < K;
      const ok = knows || rnd() < (me.fiftyNext ? 1 / (choices - 1) : 1 / choices);
      const domain = me.ownWorldNext || qWorld === me.arch ? 1 : halfWorld === me.arch ? 0.5 : 0;
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
