// ═══════════════════════════════════
//  GREAM — moods.js  (greamíci jako tamagoči BEZ povinností – Roman + manželka 2026-10-17)
//  Nálady jen z času a hraní, nikdy z „hladu“ nebo zanedbání: greamík nikdy nezesmutní ani neochabne.
//  Večer usíná, po výzvě je nadšený, po delší pauze má radost z návratu, občas je zvědavý na své téma.
//  Mění se jen texty (bubliny, pozdrav, popisek nálady po klepnutí) – vizuál zůstává.
// ═══════════════════════════════════
import { tr } from './i18n.js';
import { ARCH_GROUP, GROUPS, subcatName } from './subcats.js';

const KEY = 'gream_moods';              // { [pid]: { seen: ts, missedUntil: ts } }
const SLEEP_FROM = 21, SLEEP_TO = 7;    // spí 21:00–7:00 (místní čas), ospalý od 20:00
const MISSED_AFTER = 2 * 864e5;         // pauza 2+ dny → radost z návratu
const EXCITED_FOR = 15 * 60e3;          // 15 min po splněné výzvě

const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };
const save = (d) => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch {} };
const pick = (arr, rnd = Math.random) => (arr && arr.length ? arr[Math.floor(rnd() * arr.length)] : '');
function hash(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
const lang = () => { try { return localStorage.getItem('gream_lang') === 'en' ? 'en' : 'cs'; } catch { return 'cs'; } };

export const Moods = {
  // Návštěva zahrady: zapamatuje si poslední návštěvu; po pauze 2+ dny je greamík do konce sezení „rád, že jsi zpátky“
  visit(pid, now = Date.now()) {
    const all = load(), st = all[pid] || {};
    if (st.seen && now - st.seen >= MISSED_AFTER) st.missedUntil = now + 30 * 60e3;
    st.seen = now; all[pid] = st; save(all);
  },

  // Aktuální nálada greamíka (profil kvůli poslední výzvě)
  of(g, profile, now = Date.now()) {
    if (!g || g.stage < 2 || !g.archetype) return 'content';
    const h = new Date(now).getHours();
    if (h >= SLEEP_FROM || h < SLEEP_TO) return 'sleep';
    const st = load()[profile?.id] || {};
    if (st.missedUntil && now < st.missedUntil) return 'missed';
    const lastTask = profile?.history?.[0]?.t || 0;
    if (lastTask && now - lastTask < EXCITED_FOR) return 'excited';
    if (h >= SLEEP_FROM - 1) return 'sleepy';
    // zvědavost: některé dny (podle greamíka a data) se těší na své téma
    if (hash(g.id + new Date(now).toDateString()) % 3 === 0) return 'curious';
    return h < 11 ? 'playful' : 'content';
  },

  // Téma, na které je greamík zvědavý (jeho skupina; u více témat to den od dne střídá)
  topic(g, now = Date.now()) {
    const grp = GROUPS[ARCH_GROUP[g?.archetype]];
    if (!grp) return '';
    const sub = grp.subs[hash(g.id + new Date(now).toDateString() + 't') % grp.subs.length];
    const n = subcatName(sub, lang());
    return sub === 'czech' ? n : n.charAt(0).toLowerCase() + n.slice(1);   // Česko / Czechia s velkým
  },

  label(g, profile) { return tr().moods?.label?.[this.of(g, profile)] || ''; },

  // Pozdrav / bublina při otevření zahrady
  greeting(g, profile) {
    const M = tr().moods; if (!M || !g) return '';
    const mood = this.of(g, profile);
    // v klidné náladě občas promluví „za sebe“ (povaha podle tématu)
    if ((mood === 'content' || mood === 'playful') && Math.random() < 0.4) { const p = pick(M.persona?.[g.archetype]); if (p) return p; }
    return pick(M.greet[mood]).replace('{topic}', this.topic(g));
  },

  // Občasná bublina během pobytu v zahradě
  idle(g, profile) {
    const M = tr().moods; if (!M || !g) return '';
    const mood = this.of(g, profile);
    if (mood === 'sleep') return pick(M.greet.sleep);
    const pool = [...(M.persona?.[g.archetype] || []), ...(M.greet[mood] || [])];
    return pick(pool).replace('{topic}', this.topic(g));
  },

  // Reakce na klepnutí (+ popisek nálady se ukáže jen v tu chvíli)
  tap(g, profile) {
    const M = tr().moods; if (!M || !g) return '';
    return pick(M.tap[this.of(g, profile)] || M.tap.content).replace('{topic}', this.topic(g));
  },

  fed() { return pick(tr().moods?.fed); },

  // Greamíci spolu v noci nepovídají
  sleeping(now = Date.now()) { const h = new Date(now).getHours(); return h >= SLEEP_FROM || h < SLEEP_TO; },
};
