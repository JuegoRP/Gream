// ═══════════════════════════════════
//  GREAM — facts.js  („Víš, že…?“ ke každé otázce)
//  Data: js/facts-data.js (generuje scripts/qa-questions.mjs po ověření pravdivosti).
//  Klíč = challengeId(svět, obtížnost, český text otázky) z net.js.
// ═══════════════════════════════════
import { FACTS } from './facts-data.js';
import { challengeId } from './net.js';
import { getLang, tr, T } from './i18n.js';

// Najde zajímavost k otázce (podle české verze textu – id je stejné pro oba jazyky)
export function factFor(world, difficulty, ch) {
  if (!ch) return null;
  // id je podle ČESKÉHO textu → u angličtiny najdi českou otázku na stejném místě
  let csText = ch._csText || ch.text;
  const en = T.en?.challenges?.[world]?.[difficulty], cs = T.cs?.challenges?.[world]?.[difficulty];
  if (en && cs) { const i = en.findIndex(q => q.text === ch.text); if (i >= 0 && cs[i]) csText = cs[i].text; }
  const f = FACTS[challengeId(world, difficulty, csText)] || FACTS[challengeId(world, difficulty, ch.text)];
  if (!f) return null;
  return { text: getLang() === 'cs' ? f.cs : (f.en || f.cs), src: f.src || '' };
}

// Karta zajímavosti (HTML), prázdný řetězec když není
export function factCard(world, difficulty, ch) {
  const f = factFor(world, difficulty, ch);
  if (!f) return '';
  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  return `<div class="fact-card"><div class="fact-title">💡 ${tr().fact_title}</div><div class="fact-text">${esc(f.text)}</div>${f.src ? `<div class="fact-src">${esc(f.src)}</div>` : ''}</div>`;
}
