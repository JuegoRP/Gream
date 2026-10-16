// ═══════════════════════════════════
//  GREAM — skins.js  v1
//  Milestone-unlocked avatars + eggs currency
//  Badges are PERMANENT memorabilia, never spent.
//  Eggs are earned per task and spent on cosmetics.
// ═══════════════════════════════════

import { Profiles } from './profiles.js';
import { T } from './i18n.js';

const KEY_SEEDS         = 'gream_seeds';            // map { profileId: number }
const KEY_UNLOCKED      = 'gream_unlocked_skins';   // map { profileId: [skinId,...] }
const KEY_EQUIPPED      = 'gream_equipped';         // map { profileId: { avatar, frame, bg, accessory } }
const KEY_OWNED_COSMETIC= 'gream_owned_cosmetics';  // map { profileId: [id,...] }
const KEY_PENDING_BOOST = 'gream_pending_boost';    // map { profileId: boostId | null }
const KEY_HINT_CHARGES  = 'gream_hint_charges';     // map { profileId: number }
const KEY_DECOR         = 'gream_decor';            // map { profileId: { owned:[id], hidden:[id] } }

// ─── Skin catalog: unlocked by milestones ───
// Each skin specifies what it takes to unlock.
// type = 'avatar' (replaces emoji), 'frame' (border around avatar), 'bg' (background pattern)
// Ceny zrušených doplňků (jen pro vrácení semínek – refundAccessories)
const ACC_REFUND = {'acc_bow': 50, 'acc_cap': 60, 'acc_glasses': 70, 'acc_scarf': 70, 'acc_hat': 80, 'acc_flowers': 90, 'acc_wizard': 120, 'acc_star': 120, 'acc_crown': 160};

export const SKIN_CATALOG = {
  // ─── GREAM AVATARS — unlocked by having that greamík at stage ≥ 2 ───
  // ─── POSTAVIČKY: kreslené avatary ve stylu hry (Assety/avatary-1.1), 6 zdarma, ostatní za semínka ───
  char_avatars: [
    { id: 'chr_fox', img: 'img/avatars/fox.png', emoji: '🦊', name: { cs: 'Liška', en: 'Fox' }, cost: 0 },
    { id: 'chr_cat', img: 'img/avatars/cat.png', emoji: '🐱', name: { cs: 'Kočička', en: 'Kitten' }, cost: 0 },
    { id: 'chr_owl', img: 'img/avatars/owl.png', emoji: '🦉', name: { cs: 'Sovička', en: 'Owl' }, cost: 0 },
    { id: 'chr_frog', img: 'img/avatars/frog.png', emoji: '🐸', name: { cs: 'Žabka', en: 'Frog' }, cost: 0 },
    { id: 'chr_bear', img: 'img/avatars/bear.png', emoji: '🐻', name: { cs: 'Medvídek', en: 'Bear cub' }, cost: 0 },
    { id: 'chr_bunny', img: 'img/avatars/bunny.png', emoji: '🐰', name: { cs: 'Zajíček', en: 'Bunny' }, cost: 0 },
    { id: 'chr_panda', img: 'img/avatars/panda.png', emoji: '🐼', name: { cs: 'Panda', en: 'Panda' }, cost: 40 },
    { id: 'chr_penguin', img: 'img/avatars/penguin.png', emoji: '🐧', name: { cs: 'Tučňák', en: 'Penguin' }, cost: 40 },
    { id: 'chr_hedgehog', img: 'img/avatars/hedgehog.png', emoji: '🦔', name: { cs: 'Ježek', en: 'Hedgehog' }, cost: 50 },
    { id: 'chr_raccoon', img: 'img/avatars/raccoon.png', emoji: '🦝', name: { cs: 'Mýval', en: 'Raccoon' }, cost: 50 },
    { id: 'chr_dino', img: 'img/avatars/dino.png', emoji: '🦖', name: { cs: 'Dino', en: 'Dino' }, cost: 60 },
    { id: 'chr_unicorn', img: 'img/avatars/unicorn.png', emoji: '🦄', name: { cs: 'Jednorožec', en: 'Unicorn' }, cost: 80 },
    { id: 'chr_robot', img: 'img/avatars/robot.png', emoji: '🤖', name: { cs: 'Robot', en: 'Robot' }, cost: 80 },
    { id: 'chr_astronaut', img: 'img/avatars/astronaut.png', emoji: '🧑‍🚀', name: { cs: 'Kosmonaut', en: 'Astronaut' }, cost: 100 },
    { id: 'chr_wizard', img: 'img/avatars/wizard.png', emoji: '🧙', name: { cs: 'Čaroděj', en: 'Wizard' }, cost: 100 },
    { id: 'chr_knight', img: 'img/avatars/knight.png', emoji: '🛡️', name: { cs: 'Rytíř', en: 'Knight' }, cost: 120 },
    { id: 'chr_pirate', img: 'img/avatars/pirate.png', emoji: '🏴‍☠️', name: { cs: 'Pirát', en: 'Pirate' }, cost: 120 },
    { id: 'chr_dragon', img: 'img/avatars/dragon.png', emoji: '🐉', name: { cs: 'Dráček', en: 'Dragon' }, cost: 150 },
  ],
  gream_avatars: [
    { id: 'gream_lilek', archetype: 'lilek', name: { cs: 'Lilek', en: 'Lilek' } },
    { id: 'gream_jiskra', archetype: 'jiskra', name: { cs: 'Jiskra', en: 'Jiskra' } },
    { id: 'gream_kamen', archetype: 'kamen', name: { cs: 'Kámen', en: 'Kámen' } },
    { id: 'gream_srodik', archetype: 'srodik', name: { cs: 'Srdík', en: 'Srdík' } },
    { id: 'gream_vlnka', archetype: 'vlnka', name: { cs: 'Vlnka', en: 'Vlnka' } },
    { id: 'gream_atlas', archetype: 'atlas', name: { cs: 'Atlas', en: 'Atlas' } },
    { id: 'gream_tlapka', archetype: 'tlapka', name: { cs: 'Tlapka', en: 'Tlapka' } },
    { id: 'gream_kanka', archetype: 'kanka', name: { cs: 'Kaňka', en: 'Kaňka' } },
    { id: 'gream_poctik', archetype: 'poctik', name: { cs: 'Počtík', en: 'Počtík' } },
    { id: 'gream_hrejik', archetype: 'hrejik', name: { cs: 'Hřejík', en: 'Hřejík' } },
    { id: 'gream_noticka', archetype: 'noticka', name: { cs: 'Notička', en: 'Notička' } },
    { id: 'gream_mapka', archetype: 'mapka', name: { cs: 'Mapka', en: 'Mapka' } },
    { id: 'gream_hvezdik', archetype: 'hvezdik', name: { cs: 'Hvězdík', en: 'Hvězdík' } },
    { id: 'gream_mnamka', archetype: 'mnamka', name: { cs: 'Mňamka', en: 'Mňamka' } },
    { id: 'gream_bajka', archetype: 'bajka', name: { cs: 'Bajka', en: 'Bajka' } },
    { id: 'gream_ahojik', archetype: 'ahojik', name: { cs: 'Ahojík', en: 'Ahojík' } },
    { id: 'gream_banka', archetype: 'banka', name: { cs: 'Baňka', en: 'Baňka' } },
    { id: 'gream_hadak', archetype: 'hadak', name: { cs: 'Hádák', en: 'Hádák' } },
    { id: 'gream_mozik', archetype: 'mozik', name: { cs: 'Mozík', en: 'Mozík' } },
    { id: 'gream_zdravik', archetype: 'zdravik', name: { cs: 'Zdravík', en: 'Zdravík' } },
    { id: 'gream_klapka', archetype: 'klapka', name: { cs: 'Klapka', en: 'Klapka' } },
    { id: 'gream_maska', archetype: 'maska', name: { cs: 'Maska', en: 'Maska' } },
    { id: 'gream_micek', archetype: 'micek', name: { cs: 'Míček', en: 'Míček' } },
    { id: 'gream_lvicek', archetype: 'lvicek', name: { cs: 'Lvíček', en: 'Lvíček' } },
  ],

  // ─── AVATAR SKINS — milestone-unlocked + purchasable emoji ───
  avatars: [
    { id: 'av_default', emoji: '🧒',  name: { cs: 'Začátečník', en: 'Beginner' }, unlock: { type: 'free' } },
    { id: 'av_egg',    emoji: '🌱',  name: { cs: 'Vajíčko',    en: 'Sprout' },   unlock: { type: 'totalTasks', count: 3 } },
    { id: 'av_explorer',emoji: '🧭',  name: { cs: 'Průzkumník', en: 'Explorer' }, unlock: { type: 'world',  world: 'nature', count: 10 } },
    { id: 'av_scholar', emoji: '🦉',  name: { cs: 'Učenec',     en: 'Scholar' },  unlock: { type: 'world',  world: 'logic',  count: 10 } },
    { id: 'av_artist',  emoji: '🎨',  name: { cs: 'Umělec',     en: 'Artist' },   unlock: { type: 'world',  world: 'arts',   count: 10 } },
    { id: 'av_poet',    emoji: '📜',  name: { cs: 'Básník',     en: 'Poet' },     unlock: { type: 'world',  world: 'language', count: 10 } },
    { id: 'av_heart',   emoji: '💝',  name: { cs: 'Vnímavý',    en: 'Empath' },   unlock: { type: 'world',  world: 'feelings', count: 10 } },
    { id: 'av_globe',   emoji: '🌍',  name: { cs: 'Cestovatel', en: 'Traveler' }, unlock: { type: 'world',  world: 'world',  count: 10 } },
    { id: 'av_streak3', emoji: '🔥',  name: { cs: 'Vytrvalý',   en: 'Persistent' }, unlock: { type: 'streak', count: 3 } },
    { id: 'av_streak7', emoji: '⚡',  name: { cs: 'Týdenní hrdina', en: 'Week Hero' }, unlock: { type: 'streak', count: 7 } },
    { id: 'av_master',  emoji: '🌟',  name: { cs: 'Mistr',      en: 'Master' },   unlock: { type: 'totalTasks', count: 100 } },
    { id: 'av_legend',  emoji: '👑',  name: { cs: 'Legenda',    en: 'Legend' },   unlock: { type: 'totalTasks', count: 300 } },
    // Purchasable emoji
    { id: 'av_cat',    emoji: '😺', name: { cs: 'Kočička',       en: 'Cat'    }, cost: 20,  unlock: { type: 'buy' } },
    { id: 'av_fox',    emoji: '🦊', name: { cs: 'Liška',         en: 'Fox'    }, cost: 20,  unlock: { type: 'buy' } },
    { id: 'av_frog',   emoji: '🐸', name: { cs: 'Žabka',         en: 'Frog'   }, cost: 30,  unlock: { type: 'buy' } },
    { id: 'av_alien',  emoji: '👾', name: { cs: 'Mimozemšťan',   en: 'Alien'  }, cost: 40,  unlock: { type: 'buy' } },
    { id: 'av_robot',  emoji: '🤖', name: { cs: 'Robot',         en: 'Robot'  }, cost: 40,  unlock: { type: 'buy' } },
    { id: 'av_ninja',  emoji: '🥷', name: { cs: 'Ninja',         en: 'Ninja'  }, cost: 50,  unlock: { type: 'buy' } },
  ],

  // ─── FRAMES — bought with eggs ───
  frames: [
    { id: 'fr_none',    name: { cs: 'Bez rámečku', en: 'No frame' }, cssClass: '', cost: 0 },
    { id: 'fr_leaf',    name: { cs: 'Lístkový',    en: 'Leaf' },     cssClass: 'frame-leaf',    cost: 60 },
    { id: 'fr_gold',    name: { cs: 'Zlatý',       en: 'Gold' },     cssClass: 'frame-gold',    cost: 160 },
    { id: 'fr_rainbow', name: { cs: 'Duhový',      en: 'Rainbow' },  cssClass: 'frame-rainbow', cost: 300 },
    { id: 'fr_galaxy',  name: { cs: 'Galaxie',     en: 'Galaxy' },   cssClass: 'frame-galaxy',  cost: 500 },
  ],

  // ─── FRAMES — bought with eggs (cheaper) ───
  // (overrides the ones above)

  // ─── BACKGROUNDS — bought with seeds ───
  backgrounds: [   // 2026-10: všechna pozadí jsou široká panoramata ve stylu zahrady (posouvají se, greamíci po nich chodí)
    { id: 'bg_default',      name: { cs: 'Výchozí louka',      en: 'Meadow' },            file: null,                 cost: 0   },
    { id: 'bg_rain_jungle',  name: { cs: 'Deštný prales',      en: 'Rainy jungle' },      file: 'bg_rain_jungle.jpg', cost: 160 },
    { id: 'bg_winter',       name: { cs: 'Zimní zahrada',      en: 'Winter garden' },     file: 'bg_winter.jpg',      cost: 200 },
    { id: 'bg_cyberpunk',    name: { cs: 'Večerní město',      en: 'City evening' },      file: 'bg_cyberpunk.jpg',   cost: 240 },
    { id: 'bg_beach',        name: { cs: 'Zahrada u moře',     en: 'Seaside garden' },    file: 'bg_beach.jpg',       cost: 260 },
    { id: 'bg_cave',         name: { cs: 'Krystalová jeskyně', en: 'Crystal cave' },      file: 'bg_cave.jpg',        cost: 300 },
    { id: 'bg_ruins',        name: { cs: 'Hradní zřícenina',   en: 'Castle ruins' },      file: 'bg_ruins.jpg',       cost: 400 },
    { id: 'bg_town',         name: { cs: 'Středověké městečko', en: 'Medieval town' },    file: 'bg_town.jpg',        cost: 500 },
  ],

  // ─── BOOSTS — jednorázové efekty za vajíčka ───
  boosts: [
    { id: 'boost_2x',    name: { cs: '2× semínka',      en: '2× seeds' },       desc: { cs: 'Příští úkol dá 2× víc semínek',    en: 'Next task gives 2× seeds' },         cost: 15, emoji: '✨' },
    { id: 'boost_hint',  name: { cs: '3 nápovědy',      en: '3 hints' },          desc: { cs: '3 nápovědy zdarma',                  en: '3 free hints' },                     cost: 10, emoji: '💡' },
    { id: 'boost_skip',  name: { cs: 'Přeskočit krok',  en: 'Skip step' },        desc: { cs: 'Přeskoč jeden krok bez ztráty',       en: 'Skip one step without penalty' },    cost: 20, emoji: '⏭️' },
    { id: 'boost_lucky', name: { cs: 'Šťastný úkol',   en: 'Lucky task' },       desc: { cs: 'Výběr obtížnosti dalšího úkolu',      en: 'Choose difficulty of next task' },   cost: 12, emoji: '🍀' },
  ],

  // ─── GREAM ACCESSORIES — doplňky viditelné na greamíkovi (zahrada, aréna, výběr do souboje) ───
  // slot: head = na hlavě, face = přes oči, neck = na krku, aura = záře kolem (bez obrázku)

  // ─── VÝZDOBA ZAHRADY — vše koupené se ukáže v zahradě (jde vypnout); x/y = % scény, w = % šířky ───
  decor: [
    { id: 'deco_flowerbed', name: { cs: 'Záhonek',        en: 'Flower bed' },   cost: 40,  img: 'img/zahrada/deco_flowerbed.png', x: 14, y: 92, w: 22 },
    { id: 'deco_bench',     name: { cs: 'Lavička',        en: 'Bench' },        cost: 60,  img: 'img/zahrada/deco_bench.png',     x: 80, y: 90, w: 24 },
    { id: 'deco_birdhouse', name: { cs: 'Budka pro ptáčky', en: 'Birdhouse' },  cost: 70,  img: 'img/zahrada/deco_birdhouse.png', x: 90, y: 66, w: 10 },
    { id: 'deco_lantern',   name: { cs: 'Lucernička',     en: 'Lantern' },      cost: 80,  img: 'img/zahrada/deco_lantern.png',   x: 32, y: 84, w: 10 },
    { id: 'deco_pond',      name: { cs: 'Jezírko',        en: 'Pond' },         cost: 120,  img: 'img/zahrada/deco_pond.png',      x: 66, y: 97, w: 26 },
    { id: 'deco_mushroom',  name: { cs: 'Hříbkový domeček', en: 'Mushroom house' }, cost: 180, img: 'img/zahrada/deco_mushroom.png', x: 10, y: 70, w: 16 },
    { id: 'deco_rainbow',   name: { cs: 'Duha',           en: 'Rainbow' },      cost: 240, img: 'img/zahrada/deco_rainbow.png',   x: 70, y: 22, w: 30 },
  ],
};

// ─── Seeds earned per event ───
const SEEDS_PER_TASK   = 2;   // base × difficulty multiplier below
const SEEDS_PER_BADGE  = 6;   // bonus for completing full 3-step badge (2026-10: 10 → 6, obchod se nemá dát vykoupit za týden)
const SEEDS_PER_STREAK = 5;
const SEEDS_OUTDOOR_BONUS = 3; // added on top of base when outdoor
const SEEDS_DAILY_BONUS = 4;   // daily login bonus

// easy=2, medium=3, hard=5, extreme=8 (base 2 × multiplier)
const DIFF_MULT = { easy: 1.0, medium: 1.5, hard: 2.5, extreme: 4.0 };
const DAILY_KEY = 'gream_daily_bonus';

function loadMap(key) {
  try { return JSON.parse(localStorage.getItem(key) || '{}'); }
  catch { return {}; }
}
function saveMap(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

export const Skins = {

  // ─── Seeds (currency) ───
  getSeeds(profileId) {
    const m = loadMap(KEY_SEEDS);
    return m[profileId] || 0;
  },

  addSeeds(profileId, amount) {
    if (!profileId || amount <= 0) return 0;
    const m = loadMap(KEY_SEEDS);
    m[profileId] = (m[profileId] || 0) + amount;
    saveMap(KEY_SEEDS, m);
    return m[profileId];
  },

  spendSeeds(profileId, amount) {
    const m = loadMap(KEY_SEEDS);
    const have = m[profileId] || 0;
    if (have < amount) return false;
    m[profileId] = have - amount;
    saveMap(KEY_SEEDS, m);
    return true;
  },

  // ─── Daily login bonus (+4 seeds, once per day) ───
  claimDailyBonus(profileId) {
    const today = new Date().toDateString();
    const m = loadMap(DAILY_KEY);
    if (m[profileId] === today) return { claimed: false, amount: 0 };
    m[profileId] = today;
    saveMap(DAILY_KEY, m);
    this.addSeeds(profileId, SEEDS_DAILY_BONUS);
    return { claimed: true, amount: SEEDS_DAILY_BONUS };
  },

  // ─── Award seeds for task completion ───
  // multiplier = (score/100) × diffMultiplier — caller passes combined value
  awardForTask(profileId, isOutdoor = false, multiplier = 1) {
    const base = SEEDS_PER_TASK + (isOutdoor ? SEEDS_OUTDOOR_BONUS : 0);
    return this.addSeeds(profileId, Math.max(1, Math.round(base * multiplier)));
  },
  awardForBadge(profileId) {
    return this.addSeeds(profileId, SEEDS_PER_BADGE);
  },
  awardForStreak(profileId) {
    return this.addSeeds(profileId, SEEDS_PER_STREAK);
  },

  // ─── Unlocked skins (read) ───
  getUnlocked(profileId) {
    const m = loadMap(KEY_UNLOCKED);
    return new Set(m[profileId] || []);
  },

  // ─── Check & unlock skins based on profile state ───
  // Returns array of newly unlocked skin objects
  checkUnlocks(profileId) {
    const profile = Profiles.all().find(p => p.id === profileId);
    if (!profile) return [];

    const m = loadMap(KEY_UNLOCKED);
    const owned = new Set(m[profileId] || []);
    const newlyUnlocked = [];

    for (const skin of SKIN_CATALOG.avatars) {
      if (owned.has(skin.id)) continue;
      if (skin.unlock.type === 'free') {
        owned.add(skin.id);
        // free isn't "newly unlocked" by event
        continue;
      }
      let qualifies = false;
      if (skin.unlock.type === 'totalTasks') {
        qualifies = (profile.totalTasks || 0) >= skin.unlock.count;
      } else if (skin.unlock.type === 'world') {
        qualifies = (profile.worldTasks?.[skin.unlock.world] || 0) >= skin.unlock.count;
      } else if (skin.unlock.type === 'streak') {
        qualifies = (profile.streak || 0) >= skin.unlock.count;
      }
      if (qualifies) {
        owned.add(skin.id);
        newlyUnlocked.push(skin);
      }
    }
    m[profileId] = [...owned];
    saveMap(KEY_UNLOCKED, m);
    return newlyUnlocked;
  },

  // ─── Equipped skin/frame/bg ───
  getEquipped(profileId) {
    const m = loadMap(KEY_EQUIPPED);
    return m[profileId] || { avatar: 'av_default', frame: 'fr_none', bg: 'bg_default', accessory: null };
  },

  setEquipped(profileId, slot, id) {
    const m = loadMap(KEY_EQUIPPED);
    if (!m[profileId]) m[profileId] = { avatar: 'av_default', frame: 'fr_none', bg: 'bg_default', accessory: null };
    m[profileId][slot] = id;
    saveMap(KEY_EQUIPPED, m);
  },

  // ─── Owned cosmetics (frames + backgrounds, paid) ───
  getOwned(profileId) {
    const m = loadMap(KEY_OWNED_COSMETIC);
    // Default: free items always owned
    const owned = new Set(m[profileId] || []);
    SKIN_CATALOG.frames.forEach(f => { if (f.cost === 0) owned.add(f.id); });
    SKIN_CATALOG.backgrounds.forEach(b => { if (b.cost === 0) owned.add(b.id); });
    SKIN_CATALOG.char_avatars.forEach(c => { if (c.cost === 0) owned.add(c.id); });
    return owned;
  },

  // ─── Buy avatar emoji / postavička ───
  buyAvatar(profileId, id) {
    const item = SKIN_CATALOG.avatars.find(a => a.id === id && a.unlock?.type === 'buy') || SKIN_CATALOG.char_avatars.find(a => a.id === id && a.cost > 0);
    if (!item) return { ok: false, reason: 'not-found' };
    const owned = this.getOwned(profileId);
    if (owned.has(id)) return { ok: true, reason: 'already-owned' };
    if (!this.spendSeeds(profileId, item.cost)) return { ok: false, reason: 'no-seeds' };
    const m = loadMap(KEY_OWNED_COSMETIC);
    if (!m[profileId]) m[profileId] = [];
    m[profileId].push(id);
    saveMap(KEY_OWNED_COSMETIC, m);
    return { ok: true };
  },

  // ─── Buy cosmetic ───
  buyCosmetic(profileId, id) {
    const all = [...SKIN_CATALOG.frames, ...SKIN_CATALOG.backgrounds];
    const item = all.find(x => x.id === id);
    if (!item) return { ok: false, reason: 'not-found' };
    const owned = this.getOwned(profileId);
    if (owned.has(id)) return { ok: false, reason: 'already-owned' };
    const eggs = this.getSeeds(profileId);
    if (eggs < item.cost) return { ok: false, reason: 'not-enough-eggs', need: item.cost - eggs };
    if (!this.spendSeeds(profileId, item.cost)) return { ok: false, reason: 'not-enough-seeds' };
    const m = loadMap(KEY_OWNED_COSMETIC);
    if (!m[profileId]) m[profileId] = [];
    m[profileId].push(id);
    saveMap(KEY_OWNED_COSMETIC, m);
    return { ok: true, item };
  },

  // ─── Find skin by id ───
  findAvatar(id) {
    return SKIN_CATALOG.avatars.find(a => a.id === id) || SKIN_CATALOG.avatars[0];
  },
  findFrame(id) {
    return SKIN_CATALOG.frames.find(f => f.id === id) || SKIN_CATALOG.frames[0];
  },
  findBackground(id) {
    return SKIN_CATALOG.backgrounds.find(b => b.id === id) || SKIN_CATALOG.backgrounds[0];
  },

  // ─── BOOSTS: buy, check, consume ───
  getPendingBoost(profileId) {
    const m = loadMap(KEY_PENDING_BOOST);
    return m[profileId] || null;
  },

  setPendingBoost(profileId, boostId) {
    const m = loadMap(KEY_PENDING_BOOST);
    m[profileId] = boostId;
    saveMap(KEY_PENDING_BOOST, m);
  },

  consumePendingBoost(profileId) {
    const m = loadMap(KEY_PENDING_BOOST);
    const active = m[profileId] || null;
    if (active) { m[profileId] = null; saveMap(KEY_PENDING_BOOST, m); }
    return active;
  },

  buyBoost(profileId, boostId) {
    const boost = SKIN_CATALOG.boosts.find(b => b.id === boostId);
    if (!boost) return { ok: false, reason: 'not-found' };
    // boost_hint is additive (charges), others are exclusive
    if (boostId !== 'boost_hint') {
      const existing = this.getPendingBoost(profileId);
      if (existing && existing !== boostId) return { ok: false, reason: 'boost-active', existing };
    }
    if (!this.spendSeeds(profileId, boost.cost)) return { ok: false, reason: 'not-enough-seeds' };
    if (boostId === 'boost_hint') {
      const hm = loadMap(KEY_HINT_CHARGES);
      hm[profileId] = (hm[profileId] || 0) + 3;
      saveMap(KEY_HINT_CHARGES, hm);
    } else {
      this.setPendingBoost(profileId, boostId);
    }
    return { ok: true, boost };
  },

  getHintCharges(profileId) {
    const m = loadMap(KEY_HINT_CHARGES);
    return m[profileId] || 0;
  },

  consumeHintCharge(profileId) {
    const m = loadMap(KEY_HINT_CHARGES);
    if ((m[profileId] || 0) <= 0) return false;
    m[profileId]--;
    saveMap(KEY_HINT_CHARGES, m);
    return true;
  },

  // ─── DOPLŇKY: zrušeny 2026-10-16 (nešly napasovat na 12 greamíků × 3 stádia) ───
  // Kdo si nějaký koupil, dostane semínka zpět. Vrací počet vrácených semínek (0 = nic).
  refundAccessories(profileId) {
    const m = loadMap(KEY_OWNED_COSMETIC);
    const owned = (m[profileId] || []).filter(id => id.startsWith('acc_'));
    if (!owned.length) return 0;
    const back = owned.reduce((s, id) => s + (ACC_REFUND[id] || 0), 0);
    m[profileId] = m[profileId].filter(id => !id.startsWith('acc_')); saveMap(KEY_OWNED_COSMETIC, m);
    const e = loadMap(KEY_EQUIPPED); if (e[profileId]) { delete e[profileId].accessory; saveMap(KEY_EQUIPPED, e); }
    this.addSeeds(profileId, back);
    return back;
  },

  // ─── VÝZDOBA ZAHRADY ───
  getDecor(profileId) {
    const m = loadMap(KEY_DECOR);
    const d = m[profileId] || { owned: [], hidden: [] };
    return { owned: d.owned || [], hidden: d.hidden || [] };
  },
  buyDecor(profileId, id) {
    const it = SKIN_CATALOG.decor.find(x => x.id === id);
    if (!it) return { ok: false, reason: 'not-found' };
    const d = this.getDecor(profileId);
    if (d.owned.includes(id)) return { ok: true, it };
    if (!this.spendSeeds(profileId, it.cost)) return { ok: false, reason: 'not-enough-seeds' };
    d.owned.push(id);
    const m = loadMap(KEY_DECOR); m[profileId] = d; saveMap(KEY_DECOR, m);
    return { ok: true, it };
  },
  toggleDecor(profileId, id) {
    const d = this.getDecor(profileId);
    if (!d.owned.includes(id)) return;
    d.hidden = d.hidden.includes(id) ? d.hidden.filter(x => x !== id) : [...d.hidden, id];
    const m = loadMap(KEY_DECOR); m[profileId] = d; saveMap(KEY_DECOR, m);
  },
  shownDecor(profileId) {
    const d = this.getDecor(profileId);
    return SKIN_CATALOG.decor.filter(x => d.owned.includes(x.id) && !d.hidden.includes(x.id));
  },

  // ─── Aliases for backward compatibility ───
  getBoosts(profileId) {
    // Returns { boostId: count } — pending boost counts (1 if active, 0 otherwise)
    const result = {};
    const pending = this.getPendingBoost(profileId);
    if (pending) result[pending] = 1;
    // hint charges
    const hints = this.getHintCharges(profileId);
    if (hints > 0) result['boost_hint'] = hints;
    return result;
  },

  // ─── Utility: human-readable unlock text ───
  unlockText(skin, lang = 'cs') {
    const u = skin.unlock;
    if (!u || u.type === 'free') return lang === 'cs' ? 'Dostupné' : 'Free';
    if (u.type === 'totalTasks')
      return lang === 'cs' ? `Splň ${u.count} výzev`        : `Complete ${u.count} tasks`;
    if (u.type === 'world')
    { const w = T[lang]?.worlds?.[u.world] || u.world;
      return lang === 'cs' ? `${u.count} výzev ve světě ${w}` : `${u.count} tasks in ${w}`; }
    if (u.type === 'streak')
      return lang === 'cs' ? `Série ${u.count} dnů`         : `${u.count}-day streak`;
    return '';
  },

  // ─── Owned cosmetics (array-based, for backgrounds etc.) ───
  getOwnedCosmetics(profileId) {
    const m = loadMap(KEY_OWNED_COSMETIC);
    return m[profileId] || [];
  },
  addOwnedCosmetic(profileId, id) {
    const m = loadMap(KEY_OWNED_COSMETIC);
    if (!m[profileId]) m[profileId] = [];
    if (!m[profileId].includes(id)) m[profileId].push(id);
    saveMap(KEY_OWNED_COSMETIC, m);
  },

  // ─── Background shop helpers ───
  getEquippedBg(profileId) {
    const eq = this.getEquipped(profileId);
    return SKIN_CATALOG.backgrounds.find(b => b.id === eq.bg) || SKIN_CATALOG.backgrounds[0];
  },
  purchaseBg(profileId, bgId) {
    const bg = SKIN_CATALOG.backgrounds.find(b => b.id === bgId);
    if (!bg || bg.cost === 0) { this.setEquipped(profileId, 'bg', bgId); return { ok: true }; }
    const owned = this.getOwnedCosmetics(profileId);
    if (owned.includes(bgId)) { this.setEquipped(profileId, 'bg', bgId); return { ok: true }; }
    if (!this.spendSeeds(profileId, bg.cost)) return { ok: false, reason: 'not-enough-seeds' };
    this.addOwnedCosmetic(profileId, bgId);
    this.setEquipped(profileId, 'bg', bgId);
    return { ok: true };
  },
};
