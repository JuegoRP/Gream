// ═══════════════════════════════════
//  GREAM — gream.js v1
//  Pet model: creature ownership, evolution, needs
// ═══════════════════════════════════

import { Profiles } from './profiles.js';
import { GROUPS, groupOfSub } from './subcats.js';

const KEY_GREAMS = 'gream_pets';

// Archetype definitions
// 24 greamíků – každý patří k jedné skupině podkategorií (js/subcats.js GROUPS), 4 v každém světě
const NAMES = { lilek: 'Lilek', jiskra: 'Jiskra', kamen: 'Kámen', srodik: 'Srdík', vlnka: 'Vlnka', atlas: 'Atlas',
  tlapka: 'Tlapka', kanka: 'Kaňka', poctik: 'Počtík', hrejik: 'Hřejík', noticka: 'Notička', mapka: 'Mapka',
  hvezdik: 'Hvězdík', mnamka: 'Mňamka', bajka: 'Bajka', ahojik: 'Ahojík', banka: 'Baňka', hadak: 'Hádák',
  mozik: 'Mozík', zdravik: 'Zdravík', klapka: 'Klapka', maska: 'Maska', micek: 'Míček', lvicek: 'Lvíček' };
export const ARCHETYPES = Object.fromEntries(Object.entries(GROUPS).map(([g, v]) => [v.arch,
  { id: v.arch, name: { cs: NAMES[v.arch], en: NAMES[v.arch] }, primaryWorld: v.world, sprite: v.arch, group: g }]));
// Původních šest (výběr druhého greamíka, výpůjčka do souboje)
export const BASE_ARCHETYPES = ['lilek', 'jiskra', 'kamen', 'srodik', 'vlnka', 'atlas'];

const isEggG = (g) => g.stage < 2 || !g.archetype;

// Počty odpovědí vajíčka podle skupin (ze subkategorií otázek)
function groupCounts(taskBySub = {}) {
  const c = {};
  for (const [sub, n] of Object.entries(taskBySub || {})) { const g = groupOfSub(sub); if (g) c[g] = (c[g] || 0) + n; }
  return c;
}
// Vylíhne se greamík skupiny, na kterou vajíčko slyšelo nejvíc otázek (remíza = náhoda).
// Bez údajů o podkategoriích (staré vajíčko) → náhodná skupina z nejčastějšího světa.
function resolveArchetype(taskByWorld, taskBySub = {}) {
  const gc = Object.entries(groupCounts(taskBySub)).sort((a, b) => b[1] - a[1]);
  if (gc.length) { const top = gc.filter(([, n]) => n === gc[0][1]); return GROUPS[top[Math.floor(Math.random() * top.length)][0]].arch; }
  const world = resolveWorld(taskByWorld);
  const inWorld = Object.values(GROUPS).filter(v => v.world === world);
  return inWorld[Math.floor(Math.random() * inWorld.length)].arch;
}

// Co vajíčko „cítí“ (nápověda hráči + výběr otázek): nejčastější skupina a kolik do ní odpovědí padlo
export function eggLeaning(g) {
  const gc = Object.entries(groupCounts(g?.taskBySub)).sort((a, b) => b[1] - a[1]);
  if (!gc.length) return null;
  const [group, groupCount] = gc[0];
  return { group, groupCount, world: GROUPS[group].world, second: gc[1] ? { group: gc[1][0], count: gc[1][1] } : null,
           willBe: GROUPS[group].arch };
}

const WORLDS6 = ['nature', 'language', 'logic', 'feelings', 'arts', 'world'];
function resolveWorld(taskByWorld) {
  const entries = Object.entries(taskByWorld || {});
  if (!entries.length) return WORLDS6[Math.floor(Math.random() * 6)];
  entries.sort((a, b) => b[1] - a[1]);
  const tied = entries.filter(([, v]) => v === entries[0][1]).map(([k]) => k);
  return tied[Math.floor(Math.random() * tied.length)];
}

export { resolveArchetype };

// Sprite path — null archetype shows seed/mystery state
export function spritePath(archetype, stage) {
  if (!archetype) return 'img/greamici/seed_1.png'; // mystery egg before hatching
  return `img/greamici/${archetype}_${stage}.png`;
}

// ─── Smart sprite: returns the best sprite path for current gream state ───
// The sprite file IS the sprite sheet (2×2 grid, 256×256px, each cell 128×128):
//   top-left  (0,0)     = neutral
//   top-right (128,0)   = sad
//   bot-left  (0,128)   = serious
//   bot-right (128,128) = happy
// _applyGreamSprite() in app.js picks the right quadrant based on mood.
export function smartSpritePath(gream) {
  if (!gream) return 'img/greamici/seed_1.png';
  if (!gream.archetype || gream.stage < 2) return 'img/greamici/seed_1.png';
  const s = Math.min(gream.stage, 4);
  // Stage 3 and 4 assets may not exist yet — fall back to stage 2
  if (s >= 3) return `img/greamici/${gream.archetype}_${s}.png`;
  return `img/greamici/${gream.archetype}_2.png`;
}

// Evolution thresholds (total tasks completed for this Gream)
// Stage 1→2: vylíhnutí z vajíčka po 6 úkolech
// Stage 2→3: dospívání po 20 úkolech
// Stage 3→4: dospělý po 50 úkolech
// Stage 1 = vajíčko (vajíčko)
// Stage 2 = mládě        → po 12 úkolech
// Stage 3 = dospívající  → po 60 úkolech
// Stage 4 = dospělý      → po 250 úkolech
// Po dosažení dospělého + 50 úkolů → lze přidat dalšího Greamíka
export const EVOLUTION_TASKS = { 1: 0, 2: 12, 3: 60, 4: 250 };
const UNLOCK_NEXT_GREAM_TASKS = 300; // total tasks before 2nd gream unlocks

// How long until pet gets sad (ms)
const SAD_AFTER_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

// Shiny chance on evolution
const SHINY_CHANCE = 0.01; // 1/100

function load() {
  try { return JSON.parse(localStorage.getItem(KEY_GREAMS) || '{}'); }
  catch { return {}; }
}
function save(data) {
  try { localStorage.setItem(KEY_GREAMS, JSON.stringify(data)); } catch {}
}

export const Gream = {

  // ─── Get all Greams for a profile ───
  all(profileId) {
    const data = load();
    return data[profileId] || [];
  },

  // ─── Get the active (first non-archived, or pinned by activeId) Gream ───
  active(profileId) {
    const list = this.all(profileId).filter(g => !g.archived);
    if (!list.length) return null;
    const data = load();
    const activeId = data[`${profileId}_activeId`];
    if (activeId) {
      const found = list.find(g => g.id === activeId);
      if (found) return found;
    }
    return list[0];
  },

  // ─── Set which Gream is active for a profile ───
  setActive(profileId, greamId) {
    const data = load();
    data[`${profileId}_activeId`] = greamId;
    save(data);
  },

  // ─── Manual feed (garden 🍃 button) — mood boost, no task credit ───
  manualFeed(profileId) {
    const data = load();
    const list = data[profileId] || [];
    const activeId = data[`${profileId}_activeId`];
    const g = (activeId ? list.find(x => x.id === activeId && !x.archived) : null)
              || list.find(x => !x.archived);
    if (!g) return;
    g.mood = 'happy';
    g.lastFedAt = Date.now();
    Object.keys(g.hp).forEach(k => { g.hp[k] = Math.min(100, (g.hp[k] || 50) + 5); });
    save(data);
  },

  // Drop a new mystery egg — only if fewer than 4 greams exist
  dropEgg(profileId) {
    const data = load();
    const list = data[profileId] || [];
    const active = list.filter(x => !x.archived);
    if (active.length >= 6) return null;
    if (active.some(isEggG)) return null;   // v košíčku je místo jen pro jedno vajíčko – další až po vylíhnutí
    const egg = {
      id: 'gream_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      archetype: null,
      stage: 1,
      tasksFor: 0,
      taskByWorld: {},
      hp: { water:50, sun:50, food:50, love:50, color:50, space:50 },
      mood: 'happy',
      isShiny: false,
      isStarter: false,
      archived: false,
      name: null,
      createdAt: Date.now(),
      lastFedAt: Date.now(),
      bornAt: Date.now(),
      evolutionsAt: []
    };
    data[profileId] = list;
    data[profileId].push(egg);
    save(data);
    return egg;
  },

  // ─── Create starter Gream for a new profile ───
  // Archetype starts null — resolved at hatching (stage 2) from play behaviour
  createStarter(profileId) {
    const data = load();
    if (!data[profileId]) data[profileId] = [];

    const existing = data[profileId].find(g => g.isStarter);
    if (existing) return existing;

    const newGream = {
      id:           'gream_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      archetype:    null,          // mystery until hatching
      stage:        1,
      tasksFor:     0,
      taskByWorld:  {},
      hp:           { water: 50, sun: 50, food: 50, love: 50, color: 50, space: 50 },
      mood:         'happy',
      isShiny:      false,
      isStarter:    true,
      archived:     false,
      name:         null,
      createdAt:    Date.now(),
      lastFedAt:    Date.now(),
      bornAt:       Date.now(),
      evolutionsAt: []
    };
    data[profileId].push(newGream);
    save(data);
    return newGream;
  },

  // ─── Feed Gream when a task is completed ───
  // world: 'nature'/'language'/etc. → maps to a specific need
  // Returns { evolved: bool, fromStage, toStage, isShiny, gream }
  feedFromTask(profileId, world, isOutdoor = false, sub = null) {
    const data = load();
    const list = data[profileId] || [];
    const activeId = data[`${profileId}_activeId`];
    // Vajíčko v košíčku má přednost: poslouchá všechny otázky a vylíhne se po 12 (jinak by čekalo, až ho hráč vybere)
    const g = list.find(x => !x.archived && isEggG(x))
              || (activeId ? list.find(x => x.id === activeId && !x.archived) : null)
              || list.find(x => !x.archived);
    if (!g) return null;

    // Migrate old data that may be missing these fields
    if (!g.hp) g.hp = { water:50, sun:50, food:50, love:50, color:50, space:50 };
    if (!g.taskByWorld) g.taskByWorld = {};

    // Map world to need
    const needMap = {
      nature: 'water', logic: 'sun', language: 'food',
      feelings: 'love', arts: 'color', world: 'space'
    };
    const need = needMap[world] || 'water';
    g.hp[need] = Math.min(100, (g.hp[need] || 50) + 25);
    if (isOutdoor) g.hp[need] = Math.min(100, g.hp[need] + 5);

    // Increment per-world counter
    // Venku greamík roste dvakrát rychleji (výzva venku = 2 kroky růstu); téma vajíčka se počítá stejně
    const growth = isOutdoor ? 2 : 1;
    g.taskByWorld[world] = (g.taskByWorld[world] || 0) + 1;
    if (sub) { g.taskBySub = g.taskBySub || {}; g.taskBySub[sub] = (g.taskBySub[sub] || 0) + 1; }   // téma otázky → kdo se vylíhne
    g.tasksFor = (g.tasksFor || 0) + growth;
    g.lastFedAt = Date.now();
    g.mood = 'happy';

    // Check evolution
    const fromStage = g.stage;
    let toStage = fromStage;
    let evolvedShiny = false;

    if (fromStage < 4) {
      const nextStage = fromStage + 1;
      const required = EVOLUTION_TASKS[nextStage] || 999;
      if (g.tasksFor >= required) {
        g.stage = nextStage;
        g.evolutionsAt.push(Date.now());
        toStage = nextStage;

        // ─── Archetype reveal at hatching (stage 2) ───
        // The archetype is determined by which world the user played most.
        // Ties are broken randomly — every play pattern is valid.
        if (toStage === 2 && !g.archetype) {
          g.archetype = resolveArchetype(g.taskByWorld, g.taskBySub);
          g._archetypeJustResolved = true; // flag for UI reveal animation
        }

        // Shiny chance
        if (!g.isShiny && isOutdoor && Math.random() < SHINY_CHANCE) {   // zářivý jen při vývoji venku
          g.isShiny = true;
          evolvedShiny = true;
        }
      }
    }

    // Capture and clear transient flags BEFORE save — otherwise they persist
    // in localStorage and re-trigger on every subsequent feedFromTask call
    const archetypeResolved = !!g._archetypeJustResolved;
    delete g._archetypeJustResolved;

    save(data);

    // Check if next Gream slot unlocks (fully grown + extra tasks)
    const totalTasks = g.tasksFor;
    const nextGreamUnlocked = (
      g.stage === 4 &&
      totalTasks >= UNLOCK_NEXT_GREAM_TASKS &&
      list.filter(x => !x.archived).length === 1
    );

    return {
      evolved:            toStage > fromStage,
      fromStage,
      toStage,
      isShiny:            evolvedShiny || g.isShiny,
      gream:              g,
      nextGreamUnlocked,
      archetypeResolved,  // true when archetype was just determined at hatching
      resolvedArchetype:  archetypeResolved ? g.archetype : null
    };
  },

  // ─── DEV ONLY: jump active Gream to its next evolution stage instantly ───
  // Feeds `world` so the archetype (resolved at hatching) reflects the chosen world.
  devAdvanceStage(profileId, world = 'nature') {
    const data = load();
    const list = data[profileId] || [];
    const activeId = data[`${profileId}_activeId`];
    const g = (activeId ? list.find(x => x.id === activeId && !x.archived) : null)
              || list.find(x => !x.archived);
    if (!g) return null;
    if (g.stage >= 4) return { maxed: true };
    const next = g.stage + 1;
    // set one below the next threshold, then run the real feed → clean evolve
    g.tasksFor = (EVOLUTION_TASKS[next] || 999) - 1;
    if (!g.taskByWorld) g.taskByWorld = {};
    g.taskByWorld[world] = (g.taskByWorld[world] || 0) + 1;
    save(data);
    return this.feedFromTask(profileId, world);
  },

  // ─── Nálada (2026-10-17): greamíci NIKDY nesmutní ani neochabnou zanedbáním – bez „hladu“ a poklesu potřeb.
  // Nálady řeší js/moods.js jen texty; tady jen srovnat staré uložené „sad“ na happy (vizuál vždy spokojený).
  tickMood(profileId) {
    const data = load();
    const list = data[profileId] || [];
    let changed = false;
    for (const g of list) {
      if (g.archived) continue;
      if (!g.hp) { g.hp = { water:50, sun:50, food:50, love:50, color:50, space:50 }; changed = true; }
      if (g.mood !== 'happy') { g.mood = 'happy'; changed = true; }
    }
    if (changed) save(data);
  },

  // ─── Rodný list: kde a kdy se greamík vylíhl (jen v zařízení; místo = název místa, žádné souřadnice) ───
  setBirth(profileId, greamId, info) {
    const data = load();
    const g = (data[profileId] || []).find(x => x.id === greamId);
    if (!g || g.birth) return;
    g.birth = { place: info.place ? String(info.place).slice(0, 60) : null, outdoor: !!info.outdoor, world: info.world || null, at: Date.now() };
    save(data);
  },

  // ─── Set name (only after stage 2) ───
  setName(profileId, greamId, name) {
    const data = load();
    const list = data[profileId] || [];
    const g = list.find(x => x.id === greamId);
    if (!g) return false;
    g.name = (name || '').trim().slice(0, 24);
    save(data);
    return true;
  },
  rename(profileId, greamId, name) { return this.setName(profileId, greamId, name); },

  // ─── Sleep (archive) a Gream — frees a garden slot without deleting it ───
  // Reassigns the active pet if the sleeping one was active. Refuses to sleep the
  // last awake Gream (garden can't be empty).
  archive(profileId, greamId) {
    const data = load();
    const list = data[profileId] || [];
    const g = list.find(x => x.id === greamId);
    if (!g) return { ok: false, reason: 'not-found' };
    const awake = list.filter(x => !x.archived);
    if (awake.length <= 1) return { ok: false, reason: 'last-one' };
    g.archived = true;
    if (data[`${profileId}_activeId`] === greamId) {
      const next = list.find(x => !x.archived && x.id !== greamId);
      data[`${profileId}_activeId`] = next ? next.id : null;
    }
    save(data);
    return { ok: true };
  },

  // ─── Wake (unarchive) a sleeping Gream — needs a free slot (max 4 awake) ───
  unarchive(profileId, greamId) {
    const data = load();
    const list = data[profileId] || [];
    const awake = list.filter(x => !x.archived);
    if (awake.length >= 4) return { ok: false, reason: 'full' };
    const g = list.find(x => x.id === greamId);
    if (!g) return { ok: false, reason: 'not-found' };
    g.archived = false;
    save(data);
    return { ok: true };
  },

  // ─── All Greams including sleeping ones ───
  allWithArchived(profileId) { return load()[profileId] || []; },

  // ─── Add a new companion Gream (unlocked after 300 tasks) ───
  addNewGream(profileId, archetype) {
    const data = load();
    if (!data[profileId]) data[profileId] = [];
    const active = data[profileId].filter(g => !g.archived);
    // Max 6 Greams (one per world)
    if (active.length >= 6) return null;
    // Don't duplicate archetype
    if (active.some(g => g.archetype === archetype)) return null;

    const newGream = {
      id:           'gream_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      archetype,
      stage:        1,
      tasksFor:     0,
      taskByWorld:  {},
      hp:           { water: 50, sun: 50, food: 50, love: 50, color: 50, space: 50 },
      mood:         'happy',
      isShiny:      false,
      isStarter:    false,
      archived:     false,
      name:         null,
      createdAt:    Date.now(),
      lastFedAt:    Date.now(),
      bornAt:       Date.now(),
      evolutionsAt: []
    };
    data[profileId].push(newGream);
    save(data);
    return newGream;
  },

  // ─── How many Greams can still be added? ───
  canAddMore(profileId) {
    const active = this.all(profileId).filter(g => !g.archived);
    const primary = active.find(g => !g.archived);
    return primary?.stage === 4 && primary?.tasksFor >= UNLOCK_NEXT_GREAM_TASKS && active.length < 6 && !active.some(isEggG);   // košíček musí být volný
  },

  // ─── Which archetypes are already owned? ───
  ownedArchetypes(profileId) {
    return this.all(profileId).filter(g => !g.archived).map(g => g.archetype);
  },

  // ─── Get sprite path ───
  getSpritePath(gream) {
    if (!gream) return null;
    return spritePath(gream.archetype, gream.stage);
  },

  // ─── Get display name (custom name or archetype) ───
  getDisplayName(gream, lang = 'cs') {
    if (gream.name) return gream.name;
    if (!gream.archetype) return lang === 'cs' ? '🌱 Záhadné vajíčko' : '🌱 Mystery egg';
    const arch = ARCHETYPES[gream.archetype];
    return arch ? arch.name[lang] || arch.name.cs : 'Greamík';
  },

  // ─── Lowest needs (for prompt UI: "I need water!") ───
  lowestNeed(gream) {
    if (!gream) return null;
    let lowest = null, min = 101;
    for (const [k, v] of Object.entries(gream.hp)) {
      if (v < min) { min = v; lowest = k; }
    }
    return { need: lowest, value: min };
  },

  // ─── Suggested world to play next based on lowest need ───
  suggestWorld(gream) {
    const need = this.lowestNeed(gream);
    if (!need) return 'nature';
    const inverseMap = {
      water: 'nature', sun: 'logic', food: 'language',
      love: 'feelings', color: 'arts', space: 'world'
    };
    return inverseMap[need.need] || 'nature';
  },

  // ─── Greeting / contextual line based on state ───
  getGreeting(gream, lang = 'cs') {
    if (!gream) return '';
    const hour = new Date().getHours();
    const isMorning = hour >= 5 && hour < 12;
    const isEvening = hour >= 18;

    const lines = {
      cs: {
        morning_happy: ['Dobré ráno!', 'Ahoj! Pojďme něco zažít.', 'Jsi vzhůru! Já taky.', 'Dobré ráno. Pojďme dnes ven?'],
        morning_sad:   ['Dlouho jsi nepřišel...', 'Chyběl jsi mi.'],
        evening_happy: ['Dnes byl super den!', 'Skvělý den! Děkuju.', 'Dobrý večer!'],
        evening_sad:   ['Jsem trochu smutný...', 'Můžeme něco udělat?'],
        day_happy:     ['Ahoj!', 'Co kdybychom šli ven?', 'Jsem připravený!', 'Co budeme dělat?'],
        day_sad:       ['Připadám si osamělý...', 'Pojď si se mnou hrát.']
      },
      en: {
        morning_happy: ["Good morning!", "Hi! Let's do something.", "You're up!", "Morning. Wanna go outside?"],
        morning_sad:   ["You haven't been around...", "I missed you."],
        evening_happy: ["What a great day!", "Today was amazing. Thanks!", "Good evening!"],
        evening_sad:   ["I'm a bit sad...", "Can we do something?"],
        day_happy:     ["Hi!", "Should we go outside?", "I'm ready!", "What shall we do?"],
        day_sad:       ["Feeling lonely...", "Come play with me."]
      }
    };
    const time = isMorning ? 'morning' : isEvening ? 'evening' : 'day';
    const key = `${time}_${gream.mood}`;
    const arr = lines[lang]?.[key] || lines.cs[key] || ['...'];
    return arr[Math.floor(Math.random() * arr.length)];
  }
};
