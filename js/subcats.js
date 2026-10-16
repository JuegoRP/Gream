// ═══════════════════════════════════
//  GREAM — subcats.js  (podkategorie otázek, 1.1: zatím jen klasifikace)
//  Každá otázka má hlavní podkategorii a případně vedlejší (i z jiného světa).
//  Základ pro další stavění: noví greamíci podle podkategorií, poloviční výhoda v souboji, statistiky.
// ═══════════════════════════════════
import { SUBCAT_TAXONOMY, SUBCAT_DATA } from './subcats-data.js';
import { challengeId } from './net.js';

export { SUBCAT_TAXONOMY };
const WORLD_OF = {};
for (const [w, subs] of Object.entries(SUBCAT_TAXONOMY)) for (const id of Object.keys(subs)) WORLD_OF[id] = w;
export const subWorld = (id) => WORLD_OF[id] || null;

// → { main, side, mainWorld, sideWorld } nebo null (otázka bez klasifikace)
// Otázky stažené ze serveru (content.js) nesou podkategorii přímo → registr za běhu
const RUNTIME = { cs: new Map(), en: new Map() };
export function registerSub(world, difficulty, text, lang, sub) { if (WORLD_OF[sub]) RUNTIME[lang]?.set(challengeId(world, difficulty, text), sub); }
export function subcatOf(world, difficulty, text, lang = 'cs') {
  const k = challengeId(world, difficulty, text), i = k.lastIndexOf(':#');
  const v = RUNTIME[lang]?.get(k) || SUBCAT_DATA[lang]?.[k.slice(0, i)]?.[k.slice(i + 2)];
  if (!v) return null;
  const [main, side = null] = v.split('|');
  return { main, side, mainWorld: WORLD_OF[main] || world, sideWorld: side ? WORLD_OF[side] : null };
}

export function subcatName(id, lang = 'cs') {
  const w = WORLD_OF[id]; const n = w && SUBCAT_TAXONOMY[w][id];
  return n ? n[lang === 'en' ? 1 : 0] : id;
}

// ─── Skupiny podkategorií = témata greamíků (24, 4 v každém světě) – odsouhlaseno 2026-10-16 ───
// Každý greamík patří k jedné skupině: v ní je v souboji „Super účinný“, ve zbytku svého světa „Účinný“.
// Vajíčko se vylíhne v greamíka skupiny, na kterou hráč odpovídal nejčastěji.
export const GROUPS = {
  animals:         { world: 'nature',   subs: ['animals'],                     arch: 'tlapka',  name: ['Zvířata', 'Animals'] },
  plants:          { world: 'nature',   subs: ['plants'],                      arch: 'lilek',   name: ['Rostliny a houby', 'Plants & fungi'] },
  earth_space:     { world: 'nature',   subs: ['earth', 'space'],              arch: 'hvezdik', name: ['Země a vesmír', 'Earth & space'] },
  body_food:       { world: 'nature',   subs: ['body', 'food'],                arch: 'mnamka',  name: ['Tělo a jídlo', 'Body & food'] },
  words:           { world: 'language', subs: ['words', 'sayings'],            arch: 'jiskra',  name: ['Slova a rčení', 'Words & sayings'] },
  grammar:         { world: 'language', subs: ['grammar'],                     arch: 'kanka',   name: ['Pravopis', 'Spelling & grammar'] },
  books_tales:     { world: 'language', subs: ['books', 'tales'],              arch: 'bajka',   name: ['Knihy a pohádky', 'Books & fairy tales'] },
  foreign:         { world: 'language', subs: ['foreign'],                     arch: 'ahojik',  name: ['Cizí jazyky', 'Languages of the world'] },
  math:            { world: 'logic',    subs: ['math'],                        arch: 'poctik',  name: ['Počítání', 'Numbers & maths'] },
  tech:            { world: 'logic',    subs: ['tech'],                        arch: 'kamen',   name: ['Technika a vynálezy', 'Tech & inventions'] },
  science:         { world: 'logic',    subs: ['science'],                     arch: 'banka',   name: ['Věda', 'Science'] },
  riddles:         { world: 'logic',    subs: ['riddles', 'patterns'],         arch: 'hadak',   name: ['Hádanky a řady', 'Riddles & patterns'] },
  emotions:        { world: 'feelings', subs: ['emotions'],                    arch: 'hrejik',  name: ['Emoce', 'Emotions'] },
  people:          { world: 'feelings', subs: ['people'],                      arch: 'srodik',  name: ['Vztahy a kamarádi', 'Friends & family'] },
  mind:            { world: 'feelings', subs: ['mind'],                        arch: 'mozik',   name: ['Mysl', 'Mind'] },
  health:          { world: 'feelings', subs: ['health', 'safety'],            arch: 'zdravik', name: ['Zdraví a bezpečí', 'Health & safety'] },
  music:           { world: 'arts',     subs: ['music'],                       arch: 'noticka', name: ['Hudba', 'Music'] },
  visual:          { world: 'arts',     subs: ['visual'],                      arch: 'vlnka',   name: ['Výtvarné umění', 'Visual arts'] },
  film:            { world: 'arts',     subs: ['film'],                        arch: 'klapka',  name: ['Film a hry', 'Film & games'] },
  stage_arch:      { world: 'arts',     subs: ['stage', 'architecture'],       arch: 'maska',   name: ['Divadlo a stavby', 'Stage & buildings'] },
  geography:       { world: 'world',    subs: ['geography'],                   arch: 'mapka',   name: ['Zeměpis', 'Geography'] },
  history_culture: { world: 'world',    subs: ['history', 'culture', 'society'], arch: 'atlas', name: ['Historie a kultury', 'History & cultures'] },
  sport:           { world: 'world',    subs: ['sport'],                       arch: 'micek',   name: ['Sport', 'Sport'] },
  czech:           { world: 'world',    subs: ['czech'],                       arch: 'lvicek',  name: ['Česko', 'Czechia'] },
};
const SUB_GROUP = {};
for (const [g, v] of Object.entries(GROUPS)) v.subs.forEach(s => { SUB_GROUP[s] = g; });
export const groupOfSub = (sub) => SUB_GROUP[sub] || null;
export const ARCH_GROUP = Object.fromEntries(Object.entries(GROUPS).map(([g, v]) => [v.arch, g]));
export const groupName = (g, lang = 'cs') => GROUPS[g]?.name[lang === 'en' ? 1 : 0] || g;
// Skupina otázky (podle hlavní podkategorie), nebo null
export function groupOf(world, difficulty, text, lang = 'cs') {
  const sc = subcatOf(world, difficulty, text, lang);
  return sc ? { group: groupOfSub(sc.main), side: groupOfSub(sc.side) } : null;
}
