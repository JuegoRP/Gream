// Gream Plus: týden zdarma, pak zdarma 3 výzvy doma / 1 souboj / lehká+střední / 1 profil; venku vždy; předplatné vše.
const store = new Map();
globalThis.localStorage = { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k), clear: () => store.clear() };
const { Subscription, PAYWALL_ENABLED, FREE } = await import('../js/subscription.js');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('✗', m); } };

ok(PAYWALL_ENABLED === true, 'Gream Plus zapnuté (2026-10-16)');
let s = Subscription.get();
ok(s.inTrial && s.trialDaysLeft === 7 && s.isPremium, 'týden zdarma začíná prvním spuštěním: ' + JSON.stringify(s));
for (let i = 0; i < 5; i++) Subscription.recordIndoor();
ok(Subscription.canStartIndoor().allowed && Subscription.difficultyAllowed('extreme'), 'v týdnu zdarma bez limitů');

Subscription.endTrialNow();
s = Subscription.get();
ok(!s.inTrial && !s.isPremium && !s.paid, 'po týdnu zdarma osekaná verze');
store.delete('gream_sub_device'); Subscription.endTrialNow();
for (let i = 0; i < FREE.homeTasks; i++) { ok(Subscription.canStartIndoor().allowed, 'výzva doma ' + (i + 1)); Subscription.recordIndoor(); }
const home = Subscription.canStartIndoor();
ok(!home.allowed && home.paywall === 'home', '4. výzva doma zamčená');
ok(Subscription.canStartOutdoor().allowed, 'venku vždy');
ok(Subscription.canStartBattle().allowed, '1. souboj zdarma'); Subscription.recordBattle();
ok(!Subscription.canStartBattle().allowed, '2. souboj zamčený');
ok(Subscription.difficultyAllowed('easy') && Subscription.difficultyAllowed('medium') && !Subscription.difficultyAllowed('hard') && !Subscription.difficultyAllowed('extreme'), 'obtížnost zdarma lehká + střední');
ok(Subscription.canAddProfile(0) && !Subscription.canAddProfile(1), 'zdarma 1 profil');

// Předplatné
Subscription.activatePremium(null, { product: 'gream_plus_yearly' });
s = Subscription.get();
ok(s.paid && s.isPremium && s.product === 'gream_plus_yearly', 'předplatné aktivní');
ok(Subscription.canStartIndoor().allowed && Subscription.canStartBattle().allowed && Subscription.difficultyAllowed('extreme') && Subscription.canAddProfile(5), 'předplatné odemyká vše');
Subscription.activatePremium(null, { product: 'gream_plus_monthly', expires: Date.now() - 1000 });
ok(!Subscription.get().paid, 'propadlé předplatné neplatí');
Subscription.cancelPremium();
ok(!Subscription.get().isPremium, 'zrušené předplatné');
// Promo kód: Plus natrvalo, nezruší ho ani kontrola Google Play (cancelPremium)
Subscription.endTrialNow();
Subscription.activatePromo('ZNAMI-2026');
Subscription.cancelPremium();
s = Subscription.get();
ok(s.paid && s.isPremium && s.promo && s.product === 'promo', 'promo kód platí i po cancelPremium: ' + JSON.stringify(s));
Subscription.restartTrial();
ok(Subscription.get().inTrial && !Subscription.get().promo, 'restart týdne zdarma (dev) maže i promo');

console.log(`subscription: ${pass} ok, ${fail} chyb`);
process.exit(fail ? 1 : 0);
