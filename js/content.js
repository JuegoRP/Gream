// ═══════════════════════════════════
//  GREAM — content.js  (nové otázky ze serveru, týdně; jen DATA, žádný kód)
//  Otázky vznikají v 3R Control (generování + kontrola pravdivosti + Romanovo schválení) a server je vydává
//  na GET /api/gream/content/questions. Aplikace si je stáhne při spuštění, přísně ověří tvar a uloží;
//  offline používá uloženou kopii. Každá otázka má obě jazykové verze → sady cs/en zůstanou stejně velké.
// ═══════════════════════════════════
import { T } from './i18n.js';
import { registerSub, subWorld } from './subcats.js';
import { Net, challengeId } from './net.js';

const KEY = 'gream_content_q';
const DIFFS = ['easy', 'medium', 'hard', 'extreme'];
const applied = new Set();
let blockedSet = new Set();

// Vyřazené otázky (po nahlášení, rozhodnutí v 3R Control): označit v obou jazycích na stejném indexu (id podle anglického znění).
// Neodstraňují se – pořadí sad cs/en zůstává stejné, výzvy a souboje je jen přeskočí (c.blocked).
export function applyBlocked(ids) {
  blockedSet = new Set((ids || []).map(String));
  let n = 0;
  for (const [w, byD] of Object.entries(T.en.challenges || {})) for (const [d, list] of Object.entries(byD || {})) (list || []).forEach((c, i) => {
    const b = blockedSet.has(challengeId(w, d, c.text));
    c.blocked = b; const cs = T.cs.challenges?.[w]?.[d]?.[i]; if (cs) cs.blocked = b; if (b) n++;
  });
  return n;
}
export const notBlocked = (steps) => steps.filter(c => !c.blocked);
const str = (x, max) => typeof x === 'string' && x.trim().length > 0 && x.length <= max;

// Přísná kontrola jedné otázky (cokoli podezřelého se zahodí – nikdy nespadnout kvůli datům)
export function validItem(q) {
  if (!q || typeof q !== 'object' || !str(q.id, 60) || !DIFFS.includes(q.d) || !subWorld(q.sub) || subWorld(q.sub) !== q.w) return false;
  for (const L of ['cs', 'en']) {
    const x = q[L];
    if (!x || !str(x.text, 300) || !Array.isArray(x.choices) || x.choices.length < 3 || x.choices.length > 4 || !x.choices.every(c => str(c, 120))) return false;
    if (new Set(x.choices.map(c => c.trim().toLowerCase())).size !== x.choices.length) return false;
  }
  return q.cs.choices.length === q.en.choices.length;
}

const VAL = (i) => i === 0 ? 'correct' : 'wrong' + i;
function toChallenge(q, L) {
  const x = q[L], fact = q.fact?.[L] && str(q.fact[L], 300) ? { fact: { [L]: q.fact[L], src: String(q.fact.src || '').slice(0, 80) } } : {};
  return { text: x.text, action: 'choice', mode: 'indoor_ok', remote: q.id, ...fact,
    choices: x.choices.map((t, i) => ({ text: t, value: VAL(i) })), check: { type: 'choice', correct: 'correct' } };
}

// Přidá otázky do sad hry (obě jazyky najednou, každou jen jednou); vrací počet nových
export function apply(items) {
  let n = 0;
  for (const q of Array.isArray(items) ? items : []) {
    if (applied.has(q?.id) || !validItem(q)) continue;
    for (const L of ['cs', 'en']) {
      const byW = (T[L].challenges[q.w] ||= {}); (byW[q.d] ||= []).push(toChallenge(q, L));
      registerSub(q.w, q.d, q[L].text, L, q.sub);
    }
    applied.add(q.id); n++;
  }
  return n;
}

export const Content = {
  // Uložená kopie (offline) – volá se hned při startu
  loadCached() {
    try { const c = JSON.parse(localStorage.getItem(KEY) || 'null'); if (!c) return 0; const n = apply(c.items); applyBlocked(c.blocked); return n; } catch { return 0; }
  },
  // Stáhnout přírůstek ze serveru (na pozadí): jen otázky novější než uložená verze; vrací počet nově přidaných
  async refresh() {
    let cur = null; try { cur = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch {}
    const r = await Net.contentQuestions(cur?.version || 0);
    if (!r || !Array.isArray(r.items) || !(r.version > (cur?.version || 0))) return 0;
    const blocked = Array.isArray(r.blocked) ? r.blocked.map(String).slice(0, 5000) : (cur?.blocked || []);
    const have = new Set((cur?.items || []).map(q => q.id));
    const items = [...(cur?.items || []), ...r.items.filter(q => validItem(q) && !have.has(q.id))].slice(-20000);
    try { localStorage.setItem(KEY, JSON.stringify({ version: r.version, items, blocked })); } catch { /* plné úložiště – použijí se aspoň v tomto běhu */ }
    const n = apply(items); applyBlocked(blocked);
    return n || 1;   // i samotná změna vyřazených otázek = nová verze (vyčistit mezipaměť soubojů)
  },
  count: () => applied.size,
};
