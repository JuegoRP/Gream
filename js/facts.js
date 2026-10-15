// ═══════════════════════════════════
//  GREAM — facts.js  („Víš, že…?“ ke každé otázce)
//  Data: js/facts-data.js (generuje scripts/qa-questions.mjs po ověření pravdivosti).
//  Klíč = challengeId(svět, obtížnost, text otázky v jazyce hráče) z net.js.
// ═══════════════════════════════════
import { FACTS } from './facts-data.js';
import { challengeId } from './net.js';
import { getLang, tr } from './i18n.js';

// Najde zajímavost k otázce. České a anglické otázky jsou samostatné sady (ne překlady),
// proto má každý jazyk vlastní ověřené zajímavosti: klíč = id z textu otázky v jazyce hráče.
export function factFor(world, difficulty, ch) {
  if (!ch) return null;
  const lang = getLang() === 'cs' ? 'cs' : 'en';
  const f = FACTS[challengeId(world, difficulty, ch.text)];
  if (!f || !f[lang]) return null;
  return { text: f[lang], src: f.src || '' };
}

// Karta zajímavosti (HTML), prázdný řetězec když není
export function factCard(world, difficulty, ch) {
  const f = factFor(world, difficulty, ch);
  if (!f) return '';
  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  return `<div class="fact-card"><div class="fact-title">💡 ${tr().fact_title}</div><div class="fact-text">${esc(f.text)}</div>${f.src ? `<div class="fact-src">${esc(f.src)}</div>` : ''}</div>`;
}
