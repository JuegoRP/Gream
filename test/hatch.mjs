// Líhnutí greamíků podkategorií: vajíčko „slyší“ podkategorie otázek; specialista se vylíhne,
// když jeho podkategorie tvoří ≥ 40 % odpovědí v nejčastějším světě (a aspoň 4). Jinak greamík světa.
const store = new Map();
globalThis.localStorage = { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k), clear: () => store.clear() };
const { Gream, eggLeaning } = await import('../js/gream.js');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('✗', m); } };
function hatch(feed) {
  store.clear();
  const pid = 'p1';
  Gream.createStarter(pid);
  let r;
  for (const [world, sub] of feed) r = Gream.feedFromTask(pid, world, false, sub);
  return r;
}
// 12 úkolů: 8 příroda (6 zvířata) + 4 jiné → Tlapka
let r = hatch([...Array(6).fill(['nature', 'animals']), ['nature', 'plants'], ['nature', 'space'], ...Array(4).fill(['logic', 'math'])]);
ok(r.archetypeResolved && r.resolvedArchetype === 'tlapka', `čekal jsem tlapka, je ${r.resolvedArchetype}`);
// 12 úkolů: příroda smíšeně (zvířata jen 2 z 8) → Lilek
r = hatch([['nature', 'animals'], ['nature', 'animals'], ...Array(6).fill(['nature', 'plants']), ...Array(4).fill(['arts', 'music'])]);
ok(r.resolvedArchetype === 'lilek', `čekal jsem lilek, je ${r.resolvedArchetype}`);
// hudba v umění → Notička
r = hatch([...Array(9).fill(['arts', 'music']), ...Array(3).fill(['world', 'history'])]);
ok(r.resolvedArchetype === 'noticka', `čekal jsem noticka, je ${r.resolvedArchetype}`);
// nápověda vajíčka
store.clear(); Gream.createStarter('p2');
for (let i = 0; i < 5; i++) Gream.feedFromTask('p2', 'world', false, 'geography');
const lean = eggLeaning(Gream.active('p2'));
ok(lean.world === 'world' && lean.sub === 'geography' && lean.subCount === 5 && lean.willBe === 'mapka', 'eggLeaning: ' + JSON.stringify(lean));
// jen jedno vajíčko v košíčku; vajíčko se krmí přednostně
store.clear(); Gream.createStarter('p3');
ok(Gream.dropEgg('p3') === null, 'druhé vajíčko se nesmí přidat, dokud je jedno v košíčku');
for (let i = 0; i < 12; i++) Gream.feedFromTask('p3', 'nature', false, 'plants');
ok(Gream.dropEgg('p3') !== null, 'po vylíhnutí se vajíčko přidat smí');
ok(Gream.dropEgg('p3') === null, 'třetí ne');
const egg = Gream.all('p3').find(g => g.stage < 2);
Gream.feedFromTask('p3', 'logic', false, 'math');
ok(Gream.all('p3').find(g => g.id === egg.id).tasksFor === 1, 'nové vajíčko dostává úkoly přednostně');
console.log(fail ? `✗ ${fail} selhalo, ${pass} prošlo` : `✓ Líhnutí: ${pass} prošlo`);
process.exit(fail ? 1 : 0);
