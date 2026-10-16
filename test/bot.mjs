// Bot v souboji: pevný standard podle obtížnosti (nepřizpůsobuje se hráči, nenechává vyhrávat), ale dělá chyby.
const store = new Map();
globalThis.localStorage = { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k), clear: () => store.clear() };
const { Battle } = await import('../js/battle.js');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('✗', m); } };
const rate = (diff, setup) => { store.clear(); setup?.(); let right = 0, n = 0; for (let i = 0; i < 4000; i++) for (const a of Battle._localRival(diff, Math.random, Battle.botAccFor('x', diff)).answers) { n++; if (a.ok) right++; } return right / n; };
const want = { easy: 0.70, medium: 0.75, hard: 0.80, extreme: 0.84 }, got = {};
for (const d of Object.keys(want)) { got[d] = rate(d); ok(Math.abs(got[d] - want[d]) < 0.02, `${d}: bot ${(got[d] * 100).toFixed(1)} % (standard ${want[d] * 100} %)`); }
// nezávisle na hráči: silný i slabý hráč má stejného bota
const strong = rate('medium', () => store.set('gream_battle_stats', JSON.stringify({ x: { skill: { medium: 0.98 } } })));
const weak = rate('medium', () => store.set('gream_battle_stats', JSON.stringify({ x: { skill: { medium: 0.30 } } })));
ok(Math.abs(strong - weak) < 0.02, `bot nezávisí na hráči (silný ${(strong * 100).toFixed(1)} %, slabý ${(weak * 100).toFixed(1)} %)`);
ok(got.extreme < 0.86, 'i na extrémní obtížnosti bot chybuje (≥ 1,4 chyby z 10)');
// boti se liší (povaha ± 4 %)
const accs = Array.from({ length: 200 }, () => Battle.botAccFor('x', 'medium'));
ok(Math.max(...accs) - Math.min(...accs) > 0.08, 'boti nejsou všichni stejní');
console.log(`bot: ${pass} ok, ${fail} chyb · ${Object.entries(got).map(([d, v]) => `${d} ${(v * 100).toFixed(0)} %`).join(', ')}`);
process.exit(fail ? 1 : 0);
