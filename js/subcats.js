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
export function subcatOf(world, difficulty, text, lang = 'cs') {
  const k = challengeId(world, difficulty, text), i = k.lastIndexOf(':#');
  const v = SUBCAT_DATA[lang]?.[k.slice(0, i)]?.[k.slice(i + 2)];
  if (!v) return null;
  const [main, side = null] = v.split('|');
  return { main, side, mainWorld: WORLD_OF[main] || world, sideWorld: side ? WORLD_OF[side] : null };
}

export function subcatName(id, lang = 'cs') {
  const w = WORLD_OF[id]; const n = w && SUBCAT_TAXONOMY[w][id];
  return n ? n[lang === 'en' ? 1 : 0] : id;
}
