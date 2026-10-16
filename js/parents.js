// ═══════════════════════════════════
//  GREAM — parents.js  (pro rodiče: brána, denní limit hraní, přehled)
//  Rodičovská brána = příklad na násobilku zadaný slovy (Google Play Families: odkazy ven a nákupy za bránou).
//  Čas hraní se počítá jen v zařízení (localStorage), nikam se neposílá.
// ═══════════════════════════════════
import { tr, getLang } from './i18n.js';

const KEY_TIME = 'gream_playtime';   // { [pid]: { date, sec, grant } }
const KEY_LIMIT = 'gream_limits';    // { [pid]: minuty (0 = bez limitu) }
const TICK = 30;                     // s
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const today = () => new Date().toISOString().slice(0, 10);
const NUM = {
  cs: ['nula', 'jedna', 'dva', 'tři', 'čtyři', 'pět', 'šest', 'sedm', 'osm', 'devět'],
  en: ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'],
};
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const ParentGate = {
  // Zeptá se dospělého; vrací Promise<boolean>
  ask(reason = '') {
    return new Promise(resolve => {
      const t = tr(), L = getLang() === 'cs' ? 'cs' : 'en';
      const a = 6 + Math.floor(Math.random() * 4), b = 6 + Math.floor(Math.random() * 4);
      document.getElementById('parentGate')?.remove();
      const ov = document.createElement('div'); ov.id = 'parentGate'; ov.className = 'pg-overlay';
      ov.innerHTML = `<div class="pg-card anim-pop">
        <div class="pg-title">🔒 ${t.pg_title}</div>
        ${reason ? `<div class="pg-reason">${esc(reason)}</div>` : ''}
        <div class="pg-q">${t.pg_question(NUM[L][a], NUM[L][b])}</div>
        <input class="pg-in" inputmode="numeric" maxlength="3" autocomplete="off" aria-label="${esc(t.pg_question(NUM[L][a], NUM[L][b]))}">
        <div class="pg-err" hidden>${t.pg_wrong}</div>
        <button class="btn-primary pg-ok">${t.pg_ok}</button>
        <button class="pg-cancel">${t.pg_cancel}</button></div>`;
      document.body.appendChild(ov);
      const inp = ov.querySelector('.pg-in');
      const close = (v) => { ov.remove(); resolve(v); };
      const check = () => { if (Number(inp.value) === a * b) close(true); else { ov.querySelector('.pg-err').hidden = false; inp.value = ''; inp.focus(); } };
      ov.querySelector('.pg-ok').onclick = check;
      inp.addEventListener('keypress', e => { if (e.key === 'Enter') check(); });
      ov.querySelector('.pg-cancel').onclick = () => close(false);
      setTimeout(() => inp.focus(), 150);
    });
  },
};

export const Playtime = {
  _timer: null, _pid: null,
  // Počítá čas, kdy je aplikace vidět (po 30 s)
  start(getPid) {
    clearInterval(this._timer);
    this._timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      const pid = getPid(); if (!pid) return;
      const all = load(KEY_TIME, {}); const r = all[pid]?.date === today() ? all[pid] : { date: today(), sec: 0, grant: 0 };
      r.sec += TICK; all[pid] = r; save(KEY_TIME, all);
    }, TICK * 1000);
  },
  todaySec(pid) { const r = load(KEY_TIME, {})[pid]; return r?.date === today() ? r.sec : 0; },
  limitMin(pid) { return Number(load(KEY_LIMIT, {})[pid] || 0); },
  setLimit(pid, min) { const all = load(KEY_LIMIT, {}); all[pid] = Math.max(0, Math.min(600, Number(min) || 0)); save(KEY_LIMIT, all); },
  grant(pid, min) { const all = load(KEY_TIME, {}); const r = all[pid]?.date === today() ? all[pid] : { date: today(), sec: 0, grant: 0 }; r.grant = (r.grant || 0) + min; all[pid] = r; save(KEY_TIME, all); },
  remainingMin(pid) {
    const lim = this.limitMin(pid); if (!lim) return Infinity;
    const r = load(KEY_TIME, {})[pid]; const grant = r?.date === today() ? (r.grant || 0) : 0;
    return Math.max(0, lim + grant - this.todaySec(pid) / 60);
  },
  // Vrací true, když se smí hrát; jinak ukáže přátelské okno (rodič může přidat 15 min)
  allow(pid, onGranted) {
    if (this.remainingMin(pid) > 0) return true;
    const t = tr();
    document.getElementById('limitOverlay')?.remove();
    const ov = document.createElement('div'); ov.id = 'limitOverlay'; ov.className = 'pg-overlay';
    ov.innerHTML = `<div class="pg-card anim-pop"><div style="font-size:44px">🌙</div><div class="pg-title">${t.limit_title}</div>
      <div class="pg-reason">${t.limit_text}</div>
      <button class="btn-primary pg-ok">${t.limit_add}</button><button class="pg-cancel">${t.nav_close}</button></div>`;
    document.body.appendChild(ov);
    ov.querySelector('.pg-cancel').onclick = () => ov.remove();
    ov.querySelector('.pg-ok').onclick = async () => { ov.remove(); if (await ParentGate.ask(t.limit_add)) { this.grant(pid, 15); onGranted && onGranted(); } };
    return false;
  },
};
