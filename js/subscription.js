// ═══════════════════════════════════
//  GREAM — subscription.js
//  Free vs Premium model
//  Free:    2 domácí/den, venku neomezeno, max 6/den celkem za semínka
//  Premium: 6 domácí/den, venku neomezeno, kupovat extra za semínka (neomezeno)
//  Trial:   14 dní Premium zdarma
// ═══════════════════════════════════

const KEY_SUB   = 'gream_sub';
const SEED_COST_EXTRA_TASK = 8; // semínek za 1 extra domácí úkol

export const FREE_DAILY_INDOOR   = 2;
export const PREMIUM_DAILY_INDOOR = 6;
export const FREE_MAX_WITH_SEEDS  = 6;  // free uživatel může koupit až 6/den celkem
export const TRIAL_DAYS          = 14;

function load() {
  try { return JSON.parse(localStorage.getItem(KEY_SUB) || '{}'); } catch { return {}; }
}
function save(d) { try { localStorage.setItem(KEY_SUB, JSON.stringify(d)); } catch {} }

export const Subscription = {

  // ─── Get subscription state for profile ───
  get(profileId) {
    const d = load();
    const s = d[profileId] || {};

    const now = Date.now();

    // Trial setup
    if (!s.trialStart) {
      s.trialStart = now;
      d[profileId] = s;
      save(d);
    }

    const trialEnd     = s.trialStart + TRIAL_DAYS * 86400000;
    const inTrial      = !s.premium && now < trialEnd;
    const isPremium    = !!s.premium || inTrial;
    const trialDaysLeft = inTrial ? Math.ceil((trialEnd - now) / 86400000) : 0;

    return {
      isPremium,
      inTrial,
      trialDaysLeft,
      premiumSince: s.premium || null,
    };
  },

  // ─── Activate premium (called after payment) ───
  activatePremium(profileId) {
    const d = load();
    if (!d[profileId]) d[profileId] = {};
    d[profileId].premium = Date.now();
    save(d);
  },

  // ─── Cancel (for testing) ───
  cancelPremium(profileId) {
    const d = load();
    if (d[profileId]) d[profileId].premium = null;
    save(d);
  },

  // ─── How many indoor tasks done today ───
  getIndoorToday(profileId) {
    const d = load();
    const s = d[profileId] || {};
    const today = new Date().toDateString();
    if (s.indoorDate !== today) return 0;
    return s.indoorCount || 0;
  },

  // ─── Record an indoor task ───
  recordIndoor(profileId) {
    const d = load();
    if (!d[profileId]) d[profileId] = {};
    const s = d[profileId];
    const today = new Date().toDateString();
    if (s.indoorDate !== today) { s.indoorDate = today; s.indoorCount = 0; }
    s.indoorCount = (s.indoorCount || 0) + 1;
    save(d);
  },

  // ─── Can start another indoor task? ───
  // Returns { allowed, reason, seedCost }
  canStartIndoor(profileId, seeds) {
    const sub   = this.get(profileId);
    const done  = this.getIndoorToday(profileId);
    const limit = sub.isPremium ? PREMIUM_DAILY_INDOOR : FREE_DAILY_INDOOR;
    const lang  = localStorage.getItem('gream_lang') || 'en';
    const cs = lang === 'cs';

    if (done < limit) {
      return { allowed: true, seedCost: 0 };
    }

    // Over base limit — can buy extra with seeds
    const maxTotal = sub.isPremium ? Infinity : FREE_MAX_WITH_SEEDS;
    if (done >= maxTotal) {
      return {
        allowed: false,
        reason: cs
          ? (sub.isPremium
              ? `Splnil/a jsi ${PREMIUM_DAILY_INDOOR} domácích úkolů dnes. Jdi ven! 🌳`
              : `Denní limit pro bezplatnou verzi. Upgraduj na Premium nebo jdi ven!`)
          : (sub.isPremium
              ? `You've done ${PREMIUM_DAILY_INDOOR} indoor tasks today. Go outside! 🌳`
              : `Daily limit reached for free version. Upgrade to Premium or go outside!`),
        seedCost: 0,
      };
    }

    // Can buy an extra task
    const canAfford = seeds >= SEED_COST_EXTRA_TASK;
    return {
      allowed: canAfford,
      seedCost: SEED_COST_EXTRA_TASK,
      reason: canAfford ? null : (cs
        ? `Potřebuješ ${SEED_COST_EXTRA_TASK} semínek pro další domácí úkol.`
        : `You need ${SEED_COST_EXTRA_TASK} seeds for another indoor task.`),
      isPurchase: true,
    };
  },

  // ─── Cost to buy extra task ───
  extraTaskCost() { return SEED_COST_EXTRA_TASK; },

  // ─── Days left in trial ───
  trialDaysLeft(profileId) {
    return this.get(profileId).trialDaysLeft;
  },
};
