// ═══════════════════════════════════
//  GREAM — skins.js  v1
//  Milestone-unlocked avatars + eggs currency
//  Badges are PERMANENT memorabilia, never spent.
//  Eggs are earned per task and spent on cosmetics.
// ═══════════════════════════════════

import { Profiles } from './profiles.js';

const KEY_SEEDS         = 'gream_seeds';            // map { profileId: number }
const KEY_UNLOCKED      = 'gream_unlocked_skins';   // map { profileId: [skinId,...] }
const KEY_EQUIPPED      = 'gream_equipped';         // map { profileId: { avatar, frame, bg, accessory } }
const KEY_OWNED_COSMETIC= 'gream_owned_cosmetics';  // map { profileId: [id,...] }
const KEY_PENDING_BOOST = 'gream_pending_boost';    // map { profileId: boostId | null }
const KEY_HINT_CHARGES  = 'gream_hint_charges';     // map { profileId: number }

// ─── Skin catalog: unlocked by milestones ───
// Each skin specifies what it takes to unlock.
// type = 'avatar' (replaces emoji), 'frame' (border around avatar), 'bg' (background pattern)
export const SKIN_CATALOG = {
  // ─── AVATAR SKINS — milestone-only, free ───
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
  ],

  // ─── FRAMES — bought with eggs ───
  frames: [
    { id: 'fr_none',    name: { cs: 'Bez rámečku', en: 'No frame' }, cssClass: '', cost: 0 },
    { id: 'fr_leaf',    name: { cs: 'Lístkový',    en: 'Leaf' },     cssClass: 'frame-leaf',    cost: 30 },
    { id: 'fr_gold',    name: { cs: 'Zlatý',       en: 'Gold' },     cssClass: 'frame-gold',    cost: 80 },
    { id: 'fr_rainbow', name: { cs: 'Duhový',      en: 'Rainbow' },  cssClass: 'frame-rainbow', cost: 150 },
    { id: 'fr_galaxy',  name: { cs: 'Galaxie',     en: 'Galaxy' },   cssClass: 'frame-galaxy',  cost: 250 },
  ],

  // ─── FRAMES — bought with eggs (cheaper) ───
  // (overrides the ones above)

  // ─── BACKGROUNDS (vestigial — dynamic SVG now handles this) ───
  backgrounds: [
    { id: 'bg_default', name: { cs: 'Výchozí', en: 'Default' }, cssClass: '', cost: 0 },
  ],

  // ─── BOOSTS — jednorázové efekty za vajíčka ───
  boosts: [
    { id: 'boost_2x',    name: { cs: '2× vajíčka',      en: '2× eggs' },        desc: { cs: 'Příští úkol dá 2× vajec',          en: 'Next task gives 2× eggs' },         cost: 15, emoji: '✨' },
    { id: 'boost_hint',  name: { cs: '3 nápovědy',      en: '3 hints' },          desc: { cs: '3 nápovědy zdarma',                  en: '3 free hints' },                     cost: 10, emoji: '💡' },
    { id: 'boost_skip',  name: { cs: 'Přeskočit krok',  en: 'Skip step' },        desc: { cs: 'Přeskoč jeden krok bez ztráty',       en: 'Skip one step without penalty' },    cost: 20, emoji: '⏭️' },
    { id: 'boost_lucky', name: { cs: 'Šťastný úkol',   en: 'Lucky task' },       desc: { cs: 'Výběr obtížnosti dalšího úkolu',      en: 'Choose difficulty of next task' },   cost: 12, emoji: '🍀' },
  ],

  // ─── GREAM ACCESSORIES — kosmetika pro Greamíka ───
  accessories: [
    { id: 'acc_hat',    name: { cs: 'Čepička',     en: 'Hat' },         emoji: '🎩', cost: 40 },
    { id: 'acc_bow',    name: { cs: 'Mašlička',    en: 'Bow' },         emoji: '🎀', cost: 25 },
    { id: 'acc_crown',  name: { cs: 'Korunka',     en: 'Crown' },       emoji: '👑', cost: 80 },
    { id: 'acc_glasses',name: { cs: 'Brýle',       en: 'Glasses' },     emoji: '🕶️', cost: 35 },
    { id: 'acc_star',   name: { cs: 'Hvězdička',   en: 'Star aura' },   emoji: '⭐', cost: 60 },
  ],
};

// ─── Seeds earned per event ───
const SEEDS_PER_TASK   = 2;   // base × difficulty multiplier below
const SEEDS_PER_BADGE  = 10;  // bonus for completing full 3-step badge
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
    return owned;
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

  // ─── ACCESSORIES: equip/get ───
  getEquippedAccessory(profileId) {
    const m = loadMap(KEY_EQUIPPED);
    return (m[profileId] && m[profileId].accessory) || null;
  },

  setEquippedAccessory(profileId, accId) {
    const m = loadMap(KEY_EQUIPPED);
    if (!m[profileId]) m[profileId] = { avatar: 'av_default', frame: 'fr_none', bg: 'bg_default', accessory: null };
    m[profileId].accessory = accId;
    saveMap(KEY_EQUIPPED, m);
  },

  buyAccessory(profileId, accId) {
    const acc = SKIN_CATALOG.accessories.find(a => a.id === accId);
    if (!acc) return { ok: false, reason: 'not-found' };
    if (!this.spendSeeds(profileId, acc.cost)) return { ok: false, reason: 'not-enough-seeds' };
    const m = loadMap(KEY_OWNED_COSMETIC);
    if (!m[profileId]) m[profileId] = [];
    if (!m[profileId].includes(accId)) m[profileId].push(accId);
    saveMap(KEY_OWNED_COSMETIC, m);
    this.setEquippedAccessory(profileId, accId);
    return { ok: true, acc };
  },

  getOwnedAccessories(profileId) {
    const m = loadMap(KEY_OWNED_COSMETIC);
    return new Set((m[profileId] || []).filter(id => SKIN_CATALOG.accessories.some(a => a.id === id)));
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

  getAccessory(profileId) {
    return this.getEquippedAccessory(profileId);
  },

  isAccessoryOwned(profileId, accId) {
    return this.getOwnedAccessories(profileId).has(accId);
  },

  equipAccessory(profileId, accId) {
    // If already owned, just equip. Otherwise try to buy first.
    if (this.isAccessoryOwned(profileId, accId)) {
      this.setEquippedAccessory(profileId, accId);
      return true;
    }
    return this.buyAccessory(profileId, accId);
  },

  // ─── Utility: human-readable unlock text ───
  unlockText(skin, lang = 'cs') {
    const u = skin.unlock;
    if (!u || u.type === 'free') return lang === 'cs' ? 'Dostupné' : 'Free';
    if (u.type === 'totalTasks')
      return lang === 'cs' ? `Splň ${u.count} výzev`        : `Complete ${u.count} tasks`;
    if (u.type === 'world')
      return lang === 'cs' ? `${u.count} výzev v ${u.world}` : `${u.count} tasks in ${u.world}`;
    if (u.type === 'streak')
      return lang === 'cs' ? `Série ${u.count} dnů`         : `${u.count}-day streak`;
    return '';
  }
};
