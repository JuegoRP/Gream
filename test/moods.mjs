// Nálady greamíků (tamagoči bez povinností): spánek, nadšení po výzvě, radost z návratu, texty v obou jazycích
const store = {}; globalThis.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
const { Moods } = await import('../js/moods.js');
const { ARCHETYPES } = await import('../js/gream.js');
let ok = 0, bad = 0; const t = (c, m) => { if (c) ok++; else { bad++; console.error('✗', m); } };
const at = h => new Date(2026, 9, 17, h, 30).getTime();
const g = { id: 'g1', stage: 2, archetype: 'tlapka' }, p = { id: 'p1', history: [] };
t(Moods.of(g, p, at(22)) === 'sleep' && Moods.of(g, p, at(3)) === 'sleep', 'v noci spí');
t(Moods.sleeping(at(23)) && !Moods.sleeping(at(12)), 'sleeping()');
t(Moods.of(g, { ...p, history: [{ t: at(14) - 60e3 }] }, at(14)) === 'excited', 'po výzvě nadšený');
t(Moods.of(g, p, at(20)) === 'sleepy' || Moods.of(g, p, at(20)) === 'curious', 've 20 ospalý');
Moods.visit('p1', at(10) - 3 * 864e5); Moods.visit('p1', at(10));
t(Moods.of(g, p, at(10) + 60e3) === 'missed', 'po pauze radost z návratu');
t(Moods.of({ stage: 1 }, p) === 'content', 'vajíčko bez nálady');
for (const lang of ['cs', 'en']) {
  store.gream_lang = lang;
  for (const a of Object.keys(ARCHETYPES)) {
    const gg = { id: 'x' + a, stage: 2, archetype: a };
    for (let i = 0; i < 20; i++) { const s = Moods.greeting(gg, { id: 'q' }) + Moods.idle(gg, { id: 'q' }) + Moods.tap(gg, { id: 'q' });
      t(s && !s.includes('{topic}') && !s.includes('undefined'), `${lang} ${a}: text ${s}`); }
    t(Moods.label(gg, { id: 'q' }), `${lang} ${a}: popisek`);
  }
  t(Moods.fed(), `${lang}: pamlsek`);
}
console.log(`moods: ${ok} ok, ${bad} chyb`); if (bad) process.exit(1);
