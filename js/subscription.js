// ═══════════════════════════════════
//  GREAM — subscription.js   (freemium model, agreed 2026-08)
//  Free:    max 2 úkoly DOMA/den + max 6 CELKEM/den (doma i venku dohromady)
//  Premium: NEOMEZENĚ úkolů + extrémní obtížnost + souboje
//  Cena:    69 Kč/měs · 599 Kč/rok   Trial: 7 dní Premium zdarma
// ═══════════════════════════════════

const KEY_SUB = 'gream_sub';

// ─── Paywall master switch ───
// While false: everyone is treated as Premium (unlimited, no limits, no "Subscribe"
// UI). The freemium model below (limits + Premium upsell) ONLY makes sense once a
// real IAP is wired up — otherwise free users hit the limit with no way to upgrade.
// FLIP TO TRUE only after: (1) Google Play Billing wired (RevenueCat / Capacitor
// plugin), (2) subscription products created in Play Console at the prices below,
// (3) purchase flow behind the parent gate.
export const PAYWALL_ENABLED = false;

export const FREE_DAILY_INDOOR = 2;   // zdarma úkoly doma/den (tvrdý strop pro free)
export const FREE_DAILY_TOTAL  = 6;   // zdarma úkoly CELKEM/den (doma + venku)
export const TRIAL_DAYS        = 7;

// Premium ceny + Play Console product ID (pro subscribe UI + billing integraci).
export const PREMIUM_PRICE = { monthly: '69 Kč', yearly: '599 Kč' };
export const PRODUCT_IDS   = { monthly: 'gream_premium_monthly', yearly: 'gream_premium_yearly' };

// Zpětná kompatibilita (staré importy) — už se nepoužívají v logice.
export const PREMIUM_DAILY_INDOOR = Infinity;
export const INDOOR_MAX_TOTAL     = FREE_DAILY_TOTAL;
export const FREE_DAILY_OUTDOOR   = FREE_DAILY_TOTAL;
export const SEED_COST_EXTRA_TASK = 3;

function load() {
  try { return JSON.parse(localStorage.getItem(KEY_SUB) || '{}'); } catch { return {}; }
}
function save(d) { try { localStorage.setItem(KEY_SUB, JSON.stringify(d)); } catch {} }

const today = () => new Date().toDateString();

export const Subscription = {

  paywallEnabled() { return PAYWALL_ENABLED; },

  get(profileId) {
    // Paywall off → everyone premium, no trial countdown.
    if (!PAYWALL_ENABLED) {
      return { isPremium: true, inTrial: false, trialDaysLeft: 0, premiumSince: null };
    }
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

  canStartIndoor(profileId /* , seeds (kept for signature compat) */) {
    const sub = this.get(profileId);
    if (sub.isPremium) return { allowed: true, seedCost: 0 };   // Premium = neomezeně

    const cs      = (localStorage.getItem('gream_lang') || 'en') === 'cs';
    const indoor  = this.getIndoorToday(profileId);
    const total   = indoor + this.getOutdoorToday(profileId);

    if (total >= FREE_DAILY_TOTAL) {
      return { allowed: false, seedCost: 0, reason: cs
        ? `Denní limit ${FREE_DAILY_TOTAL} úkolů (zdarma) vyčerpán. Vrať se zítra, nebo přejdi na Premium! 🌟`
        : `Daily limit of ${FREE_DAILY_TOTAL} tasks (free) reached. Come back tomorrow, or go Premium! 🌟` };
    }
    if (indoor >= FREE_DAILY_INDOOR) {
      return { allowed: false, seedCost: 0, reason: cs
        ? `Doma zdarma max ${FREE_DAILY_INDOOR} úkoly/den. Jdi ven 🌳, nebo přejdi na Premium! 🌟`
        : `Free: max ${FREE_DAILY_INDOOR} home tasks/day. Go outside 🌳, or go Premium! 🌟` };
    }
    return { allowed: true, seedCost: 0 };
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
    const sub = this.get(profileId);
    if (sub.isPremium) return { allowed: true };   // Premium = neomezeně
    const cs    = (localStorage.getItem('gream_lang') || 'en') === 'cs';
    const total = this.getIndoorToday(profileId) + this.getOutdoorToday(profileId);
    if (total >= FREE_DAILY_TOTAL) {
      return { allowed: false, reason: cs
        ? `Denní limit ${FREE_DAILY_TOTAL} úkolů (zdarma) vyčerpán. Vrať se zítra, nebo přejdi na Premium! 🌟`
        : `Daily limit of ${FREE_DAILY_TOTAL} tasks (free) reached. Come back tomorrow, or go Premium! 🌟` };
    }
    return { allowed: true };
  },

  extraTaskCost() { return SEED_COST_EXTRA_TASK; },
  trialDaysLeft(profileId) { return this.get(profileId).trialDaysLeft; },
};
