// ═══════════════════════════════════
//  GREAM — challenges-extra.js  (otázky 1.1: Kde to je?, Pravda/mýtus, Odhadni, Časová osa, Co sem nepatří, tematické balíčky)
//  Každá otázka prošla kontrolou pravdivosti (scripts/qa-questions.mjs + ruční kontrola).
//  Data jsou kompaktní (cs + en v jednom řádku) a níže se převedou na formát z i18n.js;
//  připojí se k T.cs/T.en.challenges[svět][obtížnost] ve stejném pořadí v obou jazycích.
// ═══════════════════════════════════
import { GEN_QUESTIONS } from './challenges-gen.js';

// ─── „Kde to je?“ – [obtížnost, rozsah mapy, lat, lon, česky, anglicky] ───
// Souřadnice = střed města / vrchol / památka. Tolerance podle rozsahu a obtížnosti (MAP_KM).
const MAP_KM = { world: { easy: 1500, medium: 1000, hard: 600, extreme: 350 }, europe: { easy: 500, medium: 350, hard: 200, extreme: 120 }, cz: { easy: 60, medium: 40, hard: 25, extreme: 15 } };
const MAP = [
  ['easy', 'world', 29.9792, 31.1342, 'Kde stojí egyptské pyramidy v Gíze?', 'Where are the pyramids of Giza?'],
  ['easy', 'world', 48.8584, 2.2945, 'Kde stojí Eiffelova věž?', 'Where is the Eiffel Tower?'],
  ['easy', 'world', 40.6892, -74.0445, 'Kde stojí Socha svobody?', 'Where is the Statue of Liberty?'],
  ['easy', 'world', -33.8568, 151.2153, 'Kde stojí opera v Sydney?', 'Where is the Sydney Opera House?'],
  ['easy', 'world', 35.6762, 139.6503, 'Kde leží Tokio?', 'Where is Tokyo?'],
  ['easy', 'world', 50.0755, 14.4378, 'Kde leží Praha?', 'Where is Prague?'],
  ['medium', 'world', -22.9068, -43.1729, 'Kde leží Rio de Janeiro?', 'Where is Rio de Janeiro?'],
  ['medium', 'world', 27.9881, 86.9250, 'Kde je Mount Everest?', 'Where is Mount Everest?'],
  ['medium', 'world', 27.1751, 78.0421, 'Kde stojí Tádž Mahal?', 'Where is the Taj Mahal?'],
  ['medium', 'world', 64.1466, -21.9426, 'Kde leží Reykjavík, hlavní město Islandu?', 'Where is Reykjavík, the capital of Iceland?'],
  ['medium', 'europe', 41.8902, 12.4922, 'Kde stojí římské Koloseum?', 'Where is the Colosseum?'],
  ['medium', 'europe', 52.5200, 13.4050, 'Kde leží Berlín?', 'Where is Berlin?'],
  ['medium', 'europe', 40.4168, -3.7038, 'Kde leží Madrid?', 'Where is Madrid?'],
  ['medium', 'cz', 49.1951, 16.6068, 'Kde leží Brno?', 'Where is Brno?'],
  ['medium', 'cz', 49.8209, 18.2625, 'Kde leží Ostrava?', 'Where is Ostrava?'],
  ['hard', 'world', -13.1631, -72.5450, 'Kde leží Machu Picchu?', 'Where is Machu Picchu?'],
  ['hard', 'world', -3.0674, 37.3556, 'Kde je Kilimandžáro?', 'Where is Mount Kilimanjaro?'],
  ['hard', 'world', 36.1069, -112.1129, 'Kde je Grand Canyon?', 'Where is the Grand Canyon?'],
  ['hard', 'world', -18.7669, 46.8691, 'Kde leží Madagaskar?', 'Where is Madagascar?'],
  ['hard', 'europe', 37.9838, 23.7275, 'Kde leží Atény?', 'Where is Athens?'],
  ['hard', 'europe', 59.9139, 10.7522, 'Kde leží Oslo?', 'Where is Oslo?'],
  ['hard', 'europe', 45.8326, 6.8652, 'Kde je Mont Blanc, nejvyšší hora Alp?', 'Where is Mont Blanc, the highest peak of the Alps?'],
  ['hard', 'cz', 50.7360, 15.7399, 'Kde je Sněžka, nejvyšší hora Česka?', 'Where is Sněžka, the highest mountain in Czechia?'],
  ['hard', 'cz', 49.7384, 13.3736, 'Kde leží Plzeň?', 'Where is Plzeň (Pilsen)?'],
  ['hard', 'cz', 49.5938, 17.2509, 'Kde leží Olomouc?', 'Where is Olomouc?'],
  ['extreme', 'world', -27.1127, -109.3497, 'Kde leží Velikonoční ostrov se sochami moai?', 'Where is Easter Island with its moai statues?'],
  ['extreme', 'world', 30.3285, 35.4444, 'Kde leží skalní město Petra?', 'Where is the rock city of Petra?'],
  ['extreme', 'world', 21.3069, -157.8583, 'Kde leží Honolulu na Havaji?', 'Where is Honolulu, Hawaii?'],
  ['extreme', 'europe', 42.6507, 18.0944, 'Kde leží Dubrovník?', 'Where is Dubrovnik?'],
  ['extreme', 'europe', 37.7510, 14.9934, 'Kde je sopka Etna?', 'Where is Mount Etna?'],
  ['extreme', 'cz', 48.8127, 14.3175, 'Kde leží Český Krumlov?', 'Where is Český Krumlov?'],
  ['extreme', 'cz', 50.2310, 12.8710, 'Kde leží Karlovy Vary?', 'Where is Karlovy Vary?'],
  ['extreme', 'cz', 50.7663, 15.0543, 'Kde leží Liberec?', 'Where is Liberec?'],
];

export const EXTRA_CHALLENGES = { cs: {}, en: {} };
const push = (lang, w, d, ch) => (((EXTRA_CHALLENGES[lang][w] ||= {})[d] ||= [])).push(ch);

for (const [d, scope, lat, lon, cs, en] of MAP) {
  const check = { type: 'map_pin', lat, lon, km: MAP_KM[scope][d] };
  push('cs', 'world', d, { text: cs, action: 'map_pin', scope, check, mode: 'indoor_ok' });
  push('en', 'world', d, { text: en, action: 'map_pin', scope, check, mode: 'indoor_ok' });
}

// ─── Vygenerované a ověřené otázky (challenges-gen.js) → formát hry ───
// kind: tf (Pravda, nebo mýtus?), odd (Co sem nepatří?), estimate (Odhadni), timeline (Časová osa), choice (balíčky)
const VAL = (i) => ['correct', 'wrong1', 'wrong2', 'wrong3'][i] || 'wrong' + i;
function toChallenge(q, lang) {
  const L = q[lang];
  const base = { text: L.text, mode: 'indoor_ok', ...(q.pack ? { pack: q.pack } : {}) };
  if (q.kind === 'tf') {
    const yes = lang === 'cs' ? '✅ Pravda' : '✅ True', no = lang === 'cs' ? '❌ Mýtus' : '❌ Myth';
    return { ...base, action: 'choice', keepOrder: true, choices: [{ text: yes, value: 'pravda' }, { text: no, value: 'mytus' }], check: { type: 'choice', correct: q.correct } };
  }
  if (q.kind === 'estimate') return { ...base, action: 'number', unit: L.unit || '', check: { type: 'number', answer: q.answer, tolerancePct: q.tol } };
  if (q.kind === 'timeline') return { ...base, action: 'sort', items: [...L.items], check: { type: 'sort', correct: L.items } };
  // odd + choice: správná je choices[correct_index]
  return { ...base, action: 'choice', choices: L.choices.map((t, i) => ({ text: t, value: i === q.correct_index ? 'correct' : VAL(i + 1) })), check: { type: 'choice', correct: 'correct' } };
}
for (const q of GEN_QUESTIONS) for (const lang of ['cs', 'en']) push(lang, q.w, q.d, toChallenge(q, lang));
