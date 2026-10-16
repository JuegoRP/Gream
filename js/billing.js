// ═══════════════════════════════════
//  GREAM — billing.js  (Gream Plus přes Google Play Billing – plugin cordova-plugin-purchase 13)
//  Jen v aplikaci z Google Play (window.CdvPurchase). Na webu / v náhledu je nákup nedostupný.
//  Produkty v Play Console: předplatné gream_plus_monthly (89 Kč) a gream_plus_yearly (749 Kč).
//  Ověření nákupu zatím lokálně (bez serverového validátoru); Google Play sám hlídá platnost.
// ═══════════════════════════════════
import { Subscription, PRODUCT_IDS, PAYWALL_ENABLED } from './subscription.js';

let _ready = null, _onChange = null;
const store = () => window.CdvPurchase?.store;

export const Billing = {
  available() { return !!store(); },

  // Inicializace při startu aplikace (jen v Android aplikaci a jen se zapnutým placením)
  init(onChange) {
    _onChange = onChange;
    if (!PAYWALL_ENABLED || !store() || _ready) return _ready;
    const { ProductType, Platform } = window.CdvPurchase;
    const s = store();
    s.register(Object.values(PRODUCT_IDS).map(id => ({ id, type: ProductType.PAID_SUBSCRIPTION, platform: Platform.GOOGLE_PLAY })));
    s.when()
      .approved(t => t.verify())
      .verified(r => r.finish())
      .productUpdated(() => this._sync())
      .receiptUpdated(() => this._sync());
    s.error(e => console.warn('[Billing]', e?.code, e?.message));
    _ready = s.initialize([Platform.GOOGLE_PLAY]).then(() => this._sync()).catch(e => console.warn('[Billing] init', e));
    return _ready;
  },

  // Vlastněné předplatné → Gream Plus; nevlastněné (zrušené / propadlé) → zrušit
  _sync() {
    const s = store(); if (!s) return;
    const owned = Object.values(PRODUCT_IDS).find(id => s.owned(id));
    const st = Subscription.get(), was = st.paid && !st.promo;   // promo kód s Google Play nesouvisí
    if (owned) Subscription.activatePremium(null, { product: owned });
    else if (was) Subscription.cancelPremium();
    if (!!owned !== was) _onChange?.(!!owned);
  },

  // Ceny z Google Play (v měně uživatele); bez obchodu null → UI ukáže výchozí ceny
  price(plan) {
    const p = store()?.get(PRODUCT_IDS[plan]);
    return p?.pricing?.price || p?.offers?.[0]?.pricingPhases?.slice(-1)[0]?.price || null;
  },

  // Nákup: vrací 'ok' | 'cancel' | 'unavailable' | 'error'
  async buy(plan) {
    const s = store();
    if (!s) return 'unavailable';
    await _ready;
    const offer = s.get(PRODUCT_IDS[plan])?.getOffer();
    if (!offer) return 'unavailable';
    const err = await offer.order();
    if (!err) return 'ok';
    return err.code === window.CdvPurchase.ErrorCode.PAYMENT_CANCELLED ? 'cancel' : 'error';
  },

  async restore() {
    const s = store(); if (!s) return false;
    await _ready; await s.restorePurchases(); this._sync();
    return Subscription.get().paid;
  },

  // Správa / zrušení předplatného v Google Play
  manage() { store()?.manageSubscriptions?.(); },
};
