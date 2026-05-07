// ═══════════════════════════════════
//  GREAM — gream.js v1
//  Pet model: creature ownership, evolution, needs
// ═══════════════════════════════════

import { Profiles } from './profiles.js';

const KEY_GREAMS = 'gream_pets';

// Archetype definitions
export const ARCHETYPES = {
  lilek:  { id: 'lilek',  name: { cs: 'Lilek',  en: 'Lilek'  }, primaryWorld: 'nature',   sprite: 'lilek'  },
  jiskra: { id: 'jiskra', name: { cs: 'Jiskra', en: 'Jiskra' }, primaryWorld: 'language', sprite: 'jiskra' },
  kamen:  { id: 'kamen',  name: { cs: 'Kámen',  en: 'Kámen'  }, primaryWorld: 'logic',    sprite: 'kamen'  },
  srodik: { id: 'srodik', name: { cs: 'Srdík',  en: 'Srdík'  }, primaryWorld: 'feelings', sprite: 'srodik' },
  vlnka:  { id: 'vlnka',  name: { cs: 'Vlnka',  en: 'Vlnka'  }, primaryWorld: 'arts',     sprite: 'vlnka'  },
  atlas:  { id: 'atlas',  name: { cs: 'Atlas',  en: 'Atlas'  }, primaryWorld: 'world',    sprite: 'atlas'  }
};

// World → archetype mapping
const WORLD_TO_ARCHETYPE = {
  nature:   'lilek',
  language: 'jiskra',
  logic:    'kamen',
  feelings: 'srodik',
  arts:     'vlnka',
  world:    'atlas'
};

// Resolve archetype from taskByWorld (used at hatching)
function resolveArchetype(taskByWorld) {
  const entries = Object.entries(taskByWorld || {});
  if (!entries.length) {
    // No data yet → random
    const keys = Object.keys(WORLD_TO_ARCHETYPE);
    return WORLD_TO_ARCHETYPE[keys[Math.floor(Math.random() * keys.length)]];
  }
  // Sort by count descending, pick top world
  entries.sort((a, b) => b[1] - a[1]);
  const topCount = entries[0][1];
  const tied = entries.filter(([, v]) => v === topCount).map(([k]) => k);
  const winner = tied[Math.floor(Math.random() * tied.length)];
  return WORLD_TO_ARCHETYPE[winner] || 'lilek';
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
const EVOLUTION_TASKS = { 1: 0, 2: 12, 3: 60, 4: 250 };
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
    if (active.length >= 4) return null;
    const egg = {
      id: 'gream_' + Date.now(),
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
      id:           'gream_' + Date.now(),
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
  feedFromTask(profileId, world, isOutdoor = false) {
    const data = load();
    const list = data[profileId] || [];
    const activeId = data[`${profileId}_activeId`];
    const g = (activeId ? list.find(x => x.id === activeId && !x.archived) : null)
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
    g.taskByWorld[world] = (g.taskByWorld[world] || 0) + 1;
    g.tasksFor = (g.tasksFor || 0) + 1;
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
          g.archetype = resolveArchetype(g.taskByWorld);
          g._archetypeJustResolved = true; // flag for UI reveal animation
        }

        // Shiny chance
        if (!g.isShiny && Math.random() < SHINY_CHANCE) {
          g.isShiny = true;
          evolvedShiny = true;
        }
      }
    }

    save(data);

    // Check if next Gream slot unlocks (fully grown + extra tasks)
    const totalTasks = g.tasksFor;
    const nextGreamUnlocked = (
      g.stage === 4 &&
      totalTasks >= UNLOCK_NEXT_GREAM_TASKS &&
      list.filter(x => !x.archived).length === 1
    );

    const archetypeResolved = !!g._archetypeJustResolved;
    if (g._archetypeJustResolved) delete g._archetypeJustResolved;

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

  // ─── Decay HP over time, set mood ───
  // Should be called on app open
  tickMood(profileId) {
    const data = load();
    const list = data[profileId] || [];
    let changed = false;
    for (const g of list) {
      if (g.archived) continue;
      if (!g.hp) g.hp = { water:50, sun:50, food:50, love:50, color:50, space:50 };
      const elapsed = Date.now() - (g.lastFedAt || g.createdAt);
      // Decay each need by 1 per 6 hours
      const decayPoints = Math.floor(elapsed / (6 * 60 * 60 * 1000));
      if (decayPoints > 0) {
        for (const k of Object.keys(g.hp)) {
          g.hp[k] = Math.max(0, g.hp[k] - decayPoints);
        }
        g.lastDecayAt = Date.now();
        changed = true;
      }
      // Update mood
      const totalHp = Object.values(g.hp).reduce((a,b) => a+b, 0);
      const avgHp   = totalHp / Object.keys(g.hp).length;
      const oldMood = g.mood;
      if (avgHp < 40) g.mood = 'sad';
      else            g.mood = 'happy';
      if (oldMood !== g.mood) changed = true;
    }
    if (changed) save(data);
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
      id:           'gream_' + Date.now(),
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
    return primary?.stage === 4 && primary?.tasksFor >= UNLOCK_NEXT_GREAM_TASKS && active.length < 6;
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
