// ═══════════════════════════════════
//  GREAM — subscription.js   (Gream Plus – odsouhlaseno Romanem 2026-10-16)
//  Prvních 7 dní: vše odemčené (bez karty, ve hře – ne trial Google Play).
//  Potom zdarma (osekané): 3 výzvy doma denně, venku neomezeně, 1 souboj denně (i doma),
//    obtížnost lehká + střední, 1 profil, bez ligy, tematických balíčků a rodinného souboje.
//    Greamíci, zahrada, výprava dne a vajíčka na mapě zůstávají – nic se nemaže (Families policy).
//  Gream Plus: vše neomezeně, všechny obtížnosti, až 6 profilů, rodinný souboj, liga, balíčky.
//  Cena: 89 Kč / měsíc, 749 Kč / rok (≈ 30 % sleva). Platí pro celé zařízení (rodinu), ne pro profil.
//  Promo kód (známí, testeři): ověří server /promo → Gream Plus natrvalo pro toto zařízení (nezruší ho kontrola Google Play).
//  PAYWALL_ENABLED = false → vše odemčené (nouzový vypínač).
// ═══════════════════════════════════
const KEY_SUB = 'gream_sub_device';

export const PAYWALL_ENABLED = true;   // zapnuto 2026-10-16 (Roman); bez Google Play jde Plus odemknout promo kódem
export const TRIAL_DAYS = 7;
export const FREE = { homeTasks: 3, battles: 1, difficulties: ['easy', 'medium'], profiles: 1 };
export const PRICES = { monthly: '89 Kč', yearly: '749 Kč', yearlyPerMonth: '62 Kč', yearlySave: 30 };
export const PRODUCT_IDS = { monthly: 'gream_plus_monthly', yearly: 'gream_plus_yearly' };

function load() { try { return JSON.parse(localStorage.getItem(KEY_SUB) || '{}'); } catch { return {}; } }
function save(d) { try { localStorage.setItem(KEY_SUB, JSON.stringify(d)); } catch {} }
const today = () => new Date().toDateString();
const DAY = 86400000;
const testMode = () => { try { return localStorage.getItem('gream_paywall_test') === '1'; } catch { return false; } };

export const Subscription = {
  // Placení zapnuté (ostrá verze) nebo testovací režim limitů
  paywallEnabled() { return PAYWALL_ENABLED || testMode(); },
  testMode,

  // Stav pro celé zařízení. profileId se ignoruje (zůstává kvůli starým voláním).
  get(/* profileId */) {
    if (!this.paywallEnabled()) return { isPremium: true, paid: false, inTrial: false, trialDaysLeft: 0, premiumSince: null };
    const d = load(), now = Date.now();
    if (!d.trialStart) { d.trialStart = now; save(d); }
    const trialEnd = d.trialStart + TRIAL_DAYS * DAY;
    const paid = !!d.promo || (!!d.premium && (!d.premium.expires || d.premium.expires > now));
    const inTrial = !paid && now < trialEnd;
    return { isPremium: paid || inTrial, paid, inTrial, trialDaysLeft: inTrial ? Math.ceil((trialEnd - now) / DAY) : 0,
             premiumSince: paid ? (d.premium?.since || d.promo?.since) : null, product: paid ? (d.premium?.product || 'promo') : null, promo: !!d.promo };
  },
  isPremium() { return this.get().isPremium; },

  // Volá billing.js po ověřeném nákupu (nebo obnovení); expires = konec období předplatného (ms), pokud je známý
  activatePremium(_pid, info = {}) {
    const d = load(); d.premium = { since: d.premium?.since || Date.now(), product: info.product || null, expires: info.expires || null }; save(d);
  },
  cancelPremium() { const d = load(); d.premium = null; save(d); },
  // Promo kód (ověřený serverem): Plus natrvalo pro toto zařízení
  activatePromo(code) { const d = load(); d.promo = { since: Date.now(), code: String(code).slice(0, 40) }; save(d); },
  // Testovací režim: zkrátit zkušební dobu (ať testeři vidí osekanou verzi)
  endTrialNow() { const d = load(); d.trialStart = Date.now() - TRIAL_DAYS * DAY - 1000; save(d); },
  restartTrial() { const d = load(); d.trialStart = Date.now(); d.premium = null; d.promo = null; save(d); },

  // ─── Denní počítadla (pro celé zařízení) ───
  _count(key) { const d = load(); return d[key + 'Date'] === today() ? (d[key] || 0) : 0; },
  _inc(key) { const d = load(); if (d[key + 'Date'] !== today()) { d[key + 'Date'] = today(); d[key] = 0; } d[key] = (d[key] || 0) + 1; save(d); },

  getIndoorToday() { return this._count('home'); },
  recordIndoor() { this._inc('home'); },
  getOutdoorToday() { return this._count('out'); },
  recordOutdoor() { this._inc('out'); },
  getBattlesToday() { return this._count('battles'); },
  recordBattle() { this._inc('battles'); },

  // Výzva doma: zdarma 3 denně
  canStartIndoor() {
    if (this.isPremium()) return { allowed: true, seedCost: 0 };
    const cs = (localStorage.getItem('gream_lang') || 'cs') === 'cs';
    if (this.getIndoorToday() >= FREE.homeTasks) return { allowed: false, seedCost: 0, paywall: 'home', reason: cs
      ? `Dnešní ${FREE.homeTasks} výzvy doma jsou hotové. Venku můžeš hrát dál 🌳, nebo odemkni Gream Plus.`
      : `Today's ${FREE.homeTasks} home challenges are done. Keep playing outside 🌳, or unlock Gream Plus.` };
    return { allowed: true, seedCost: 0 };
  },
  // Venku vždy (hra má vytahovat ven)
  canStartOutdoor() { return { allowed: true }; },
  // Souboj: zdarma 1 denně (doma i venku)
  canStartBattle() {
    if (this.isPremium()) return { allowed: true };
    const cs = (localStorage.getItem('gream_lang') || 'cs') === 'cs';
    if (this.getBattlesToday() >= FREE.battles) return { allowed: false, paywall: 'battle', reason: cs
      ? 'Dnešní souboj zdarma už máš za sebou. Zítra zase, nebo odemkni Gream Plus.'
      : 'You have had today\'s free battle. Come back tomorrow, or unlock Gream Plus.' };
    return { allowed: true };
  },
  difficultyAllowed(diff) { return this.isPremium() || FREE.difficulties.includes(diff); },
  canAddProfile(count) { return this.isPremium() || count < FREE.profiles; },

  trialDaysLeft() { return this.get().trialDaysLeft; },
};
