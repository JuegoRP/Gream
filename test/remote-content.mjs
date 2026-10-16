// Otázky ze serveru (content.js): přísná kontrola tvaru, přidání do obou jazyků, podkategorie pro greamíky/souboje.
const store = new Map();
globalThis.localStorage = { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k), clear: () => store.clear() };
globalThis.navigator ??= { language: 'cs' };
const { T } = await import('../js/i18n.js');
const { apply, validItem, applyBlocked, notBlocked } = await import('../js/content.js');
const { pickQuestions } = await import('../js/battle.js');
const { challengeId } = await import('../js/net.js');
const { subcatOf, groupOf } = await import('../js/subcats.js');
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('✗', m); } };
const q = (id, over = {}) => ({ id, sub: 'animals', w: 'nature', d: 'medium',
  cs: { text: `Kolik nohou má pavouk? (${id})`, choices: ['8', '6', '10'] }, en: { text: `How many legs does a spider have? (${id})`, choices: ['8', '6', '10'] },
  fact: { cs: 'Pavouci nejsou hmyz.', en: 'Spiders are not insects.', src: 'Wikipedie' }, ...over });
ok(validItem(q('a')), 'platná otázka');
ok(!validItem(q('b', { sub: 'grammar' })), 'podkategorie z jiného světa → zahodit');
ok(!validItem(q('c', { d: 'super' })), 'neznámá obtížnost → zahodit');
ok(!validItem(q('d', { en: { text: 'x', choices: ['a', 'b'] } })), 'málo možností → zahodit');
ok(!validItem(q('e', { cs: { text: 'x', choices: ['a', 'a', 'b'] } })), 'stejné možnosti → zahodit');
ok(!validItem(q('f', { cs: { text: '<script>'.repeat(60), choices: ['a', 'b', 'c'] } })), 'příliš dlouhý text → zahodit');
const before = { cs: T.cs.challenges.nature.medium.length, en: T.en.challenges.nature.medium.length };
const n = apply([q('a'), q('a'), q('b', { sub: 'grammar' }), q('g'), null, 'x']);
ok(n === 2, `přidány 2 nové (duplicita a vadné ne) → ${n}`);
ok(T.cs.challenges.nature.medium.length === before.cs + 2 && T.en.challenges.nature.medium.length === before.en + 2, 'obě jazykové sady +2 (stejné pořadí)');
const ch = T.cs.challenges.nature.medium.at(-1);
ok(ch.choices[0].value === 'correct' && ch.check.correct === 'correct' && ch.fact?.cs, 'formát hry: správná první, zajímavost');
ok(subcatOf('nature', 'medium', ch.text, 'cs')?.main === 'animals' && subcatOf('nature', 'medium', T.en.challenges.nature.medium.at(-1).text, 'en')?.main === 'animals', 'podkategorie zaregistrovaná (cs i en)');
ok(!!groupOf('nature', 'medium', ch.text, 'cs'), 'otázka patří do skupiny greamíka (souboje, líhnutí)');
// Vyřazené po nahlášení: označí se v obou jazycích na stejném indexu, výzvy i souboje je přeskočí, odblokování funguje
const EN = T.en.challenges.nature.easy, CS = T.cs.challenges.nature.easy;
const bid = challengeId('nature', 'easy', EN[0].text);
ok(applyBlocked([bid]) === 1 && EN[0].blocked && CS[0].blocked && !EN[1].blocked, 'vyřazená otázka označena v cs i en');
ok(!notBlocked(CS).includes(CS[0]) && notBlocked(CS).length === CS.length - 1, 'výzva vyřazenou přeskočí');
let hits = 0; for (let i = 0; i < 400; i++) for (const x of pickQuestions('easy')) if (x.ch.blocked) hits++;
ok(hits === 0, `souboj vyřazenou nikdy (${hits})`);
applyBlocked([]); ok(!EN[0].blocked && !CS[0].blocked, 'odblokování');
console.log(`remote-content: ${pass} ok, ${fail} chyb`);
process.exit(fail ? 1 : 0);
