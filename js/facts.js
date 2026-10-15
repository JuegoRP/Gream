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
  const f = ch.fact || FACTS[challengeId(world, difficulty, ch.text)];   // nové otázky 1.1 nesou zajímavost s sebou
  if (!f || !f[lang]) return null;
  // „Víš, že…?“ je v nadpisu karty – úvodní frázi z textu vynechat
  let text = String(f[lang]).replace(/^\s*(did you know\??\s*[,:…-]*\s*(that\s+)?|víš,?\s*že\s*[…?.]*\s*)/i, '').trim();
  text = text.charAt(0).toUpperCase() + text.slice(1);
  return { text, src: f.src || '' };
}

// Karta zajímavosti (HTML), prázdný řetězec když není
export function factCard(world, difficulty, ch) {
  const f = factFor(world, difficulty, ch);
  if (!f) return '';
  const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  return `<div class="fact-card"><div class="fact-title">💡 ${tr().fact_title}</div><div class="fact-text">${esc(f.text)}</div>${f.src ? `<div class="fact-src">${esc(f.src)}</div>` : ''}</div>`;
}
