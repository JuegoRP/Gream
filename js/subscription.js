// ═══════════════════════════════════
//  GREAM — subscription.js
//  Free:    2 domácí zdarma, max 6 celkem (za semínka), venku max 6/den
//  Premium: 4 domácí zdarma, max 6 celkem (za semínka), venku neomezeno
//  Trial:   7 dní Premium zdarma
// ═══════════════════════════════════

const KEY_SUB = 'gream_sub';

export const FREE_DAILY_INDOOR    = 2;   // zdarma domácí
export const PREMIUM_DAILY_INDOOR = 4;   // zdarma domácí pro premium
export const INDOOR_MAX_TOTAL     = 6;   // absolutní strop (zdarma + koupené)
export const FREE_DAILY_OUTDOOR   = 6;   // venkovní limit pro volný účet
export const SEED_COST_EXTRA_TASK = 3;   // semínek za 1 extra domácí slot
export const TRIAL_DAYS           = 7;

function load() {
  try { return JSON.parse(localStorage.getItem(KEY_SUB) || '{}'); } catch { return {}; }
}
function save(d) { try { localStorage.setItem(KEY_SUB, JSON.stringify(d)); } catch {} }

const today = () => new Date().toDateString();

export const Subscription = {

  get(profileId) {
    const d = load();
    const s = d[profileId] || {};
    const now = Date.now();
    if (!s.trialStart) { s.trialStart = now; d[profileId] = s; save(d); }
    const trialEnd      = s.trialStart + TRIAL_DAYS * 86400000;
    const inTrial       = !s.premium && now < trialEnd;
    const isPremium     = !!s.premium || inTrial;
    const trialDaysLeft = inTrial ? Math.ceil((trialEnd - now) / 86400000) : 0;
    return { isPremium, inTrial, trialDaysLeft, premiumSince: s.premium || null };
  },

  activatePremium(profileId) {
    const d = load(); if (!d[profileId]) d[profileId] = {};
    d[profileId].premium = Date.now(); save(d);
  },

  cancelPremium(profileId) {
    const d = load(); if (d[profileId]) d[profileId].premium = null; save(d);
  },

  // ─── Indoor tracking ───
  getIndoorToday(profileId) {
    const s = (load()[profileId] || {});
    return s.indoorDate === today() ? (s.indoorCount || 0) : 0;
  },

  recordIndoor(profileId) {
    const d = load(); if (!d[profileId]) d[profileId] = {};
    const s = d[profileId];
    if (s.indoorDate !== today()) { s.indoorDate = today(); s.indoorCount = 0; }
    s.indoorCount = (s.indoorCount || 0) + 1;
    save(d);
  },

  canStartIndoor(profileId, seeds) {
    const sub  = this.get(profileId);
    const done = this.getIndoorToday(profileId);
    const free = sub.isPremium ? PREMIUM_DAILY_INDOOR : FREE_DAILY_INDOOR;
    const lang = localStorage.getItem('gream_lang') || 'en';
    const cs   = lang === 'cs';

    if (done < free) return { allowed: true, seedCost: 0 };

    if (done >= INDOOR_MAX_TOTAL) {
      return {
        allowed: false,
        reason: cs
          ? `Denní limit ${INDOOR_MAX_TOTAL} domácích výzev vyčerpán. Jdi ven! 🌳`
          : `Daily limit of ${INDOOR_MAX_TOTAL} home challenges reached. Go outside! 🌳`,
        seedCost: 0,
      };
    }

    // Extra slot available — costs seeds
    const canAfford = seeds >= SEED_COST_EXTRA_TASK;
    return {
      allowed: canAfford,
      seedCost: SEED_COST_EXTRA_TASK,
      isPurchase: true,
      reason: canAfford ? null : (cs
        ? `Potřebuješ ${SEED_COST_EXTRA_TASK} 🌱 pro další domácí výzvu (zbývá ${INDOOR_MAX_TOTAL - done} slotů).`
        : `You need ${SEED_COST_EXTRA_TASK} 🌱 for another home challenge (${INDOOR_MAX_TOTAL - done} slots left).`),
    };
  },

  // ─── Outdoor tracking ───
  getOutdoorToday(profileId) {
    const s = (load()[profileId] || {});
    return s.outdoorDate === today() ? (s.outdoorCount || 0) : 0;
  },

  recordOutdoor(profileId) {
    const d = load(); if (!d[profileId]) d[profileId] = {};
    const s = d[profileId];
    if (s.outdoorDate !== today()) { s.outdoorDate = today(); s.outdoorCount = 0; }
    s.outdoorCount = (s.outdoorCount || 0) + 1;
    save(d);
  },

  canStartOutdoor(profileId) {
    const sub  = this.get(profileId);
    if (sub.isPremium) return { allowed: true };
    const done = this.getOutdoorToday(profileId);
    const lang = localStorage.getItem('gream_lang') || 'en';
    const cs   = lang === 'cs';
    if (done >= FREE_DAILY_OUTDOOR) {
      return {
        allowed: false,
        reason: cs
          ? `Denní limit ${FREE_DAILY_OUTDOOR} venkovních výzev pro bezplatnou verzi. Vrať se zítra nebo přejdi na Premium! 🌟`
          : `Daily limit of ${FREE_DAILY_OUTDOOR} outdoor challenges for free users. Come back tomorrow or go Premium! 🌟`,
      };
    }
    return { allowed: true };
  },

  extraTaskCost() { return SEED_COST_EXTRA_TASK; },
  trialDaysLeft(profileId) { return this.get(profileId).trialDaysLeft; },
};
