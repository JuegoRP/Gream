// ═══════════════════════════════════
//  GREAM — battle.js  (Souboje / Battles — Fáze 1: vs bot, client-side)
//  10 časově omezených výzev z různých světů. Kdo má víc správných, vyhrává.
//  Greamík z odpovídajícího světa → delší čas. Vstup stojí 1/4 výhry (venku 1/8).
//  Multiplayer / leaderboard / místa na mapě = Fáze 2 (server).
// ═══════════════════════════════════

import { tr, getLang } from './i18n.js';
import { Profiles } from './profiles.js';
import { Gream } from './gream.js';
import { Skins } from './skins.js';
import { Subscription } from './subscription.js';
import { Feedback } from './feedback.js';
import { Audio } from './audio.js';
import { Net, challengeId } from './net.js';

const WORLD_TO_ARCH = { nature:'lilek', language:'jiskra', logic:'kamen', feelings:'srodik', arts:'vlnka', world:'atlas' };
const WORLDS = ['nature','language','logic','feelings','arts','world'];
const WORLD_ICONS = { nature:'🌿', language:'📖', logic:'🧩', feelings:'💛', arts:'🎨', world:'🌍' };

const ROUNDS = 10;
const BASE_TIME_MS = 11000;                 // base time per question
const MATCH_BONUS_MS = 3000;                // matching-world Gream present
const MATCH_EVOLVED_BONUS_MS = 2000;        // + if that Gream is stage >= 3
const BOT_ACC = { easy:0.55, medium:0.65, hard:0.72, extreme:0.78 };
const WIN_REWARD = { easy:5, medium:8, hard:12, extreme:18 };  // seeds on win
const KEY_STATS = 'gream_battle_stats';
const KEY_BADGES = 'gream_battle_badges';

const DIFFS = [
  { id:'easy',    emoji:'🟢', cs:'Snadné',   en:'Easy' },
  { id:'medium',  emoji:'🟡', cs:'Střední',  en:'Medium' },
  { id:'hard',    emoji:'🔴', cs:'Těžké',    en:'Hard' },
  { id:'extreme', emoji:'⚡', cs:'Extrémní', en:'Extreme' },
];

function loadStats(pid) {
  try { return (JSON.parse(localStorage.getItem(KEY_STATS) || '{}'))[pid] || {}; } catch { return {}; }
}
function saveStats(pid, s) {
  try { const all = JSON.parse(localStorage.getItem(KEY_STATS) || '{}'); all[pid] = s; localStorage.setItem(KEY_STATS, JSON.stringify(all)); } catch {}
}
const today = () => new Date().toDateString();

// Time bonus from the player's hatched Greams for a given world.
function timeBonusForWorld(pid, world) {
  const arch = WORLD_TO_ARCH[world];
  const list = Gream.all(pid).filter(g => g.stage >= 2 && g.archetype === arch);
  if (!list.length) return 0;
  let b = MATCH_BONUS_MS;
  if (list.some(g => g.stage >= 3)) b += MATCH_EVOLVED_BONUS_MS;
  return b;
}

// A question is battle-usable if it can be answered fast & scored: choice, or a
// number with a defined answer (open observation numbers are excluded).
const battleUsable = c =>
  (c.check?.type === 'choice' && Array.isArray(c.choices) && c.choices.length >= 2) ||
  (c.check?.type === 'number' && c.check.answer != null);

// Seeded RNG (mulberry32) so the daily round is identical for everyone.
function seededRng(seedStr) {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) { h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// Pick ROUNDS questions from random worlds at the given difficulty. `rng` optional
// (deterministic for daily round).
function pickQuestions(difficulty, rng) {
  const t = tr();
  const rand = rng || Math.random;
  const out = [];
  const worldBag = [...WORLDS, ...WORLDS.slice(0, ROUNDS - WORLDS.length)].slice(0, ROUNDS);
  worldBag.sort(() => rand() - 0.5);
  const usedText = new Set();
  for (const world of worldBag) {
    const pool = (t.challenges?.[world]?.[difficulty] || []).filter(c => battleUsable(c) && !usedText.has(c.text));
    if (!pool.length) continue;
    const c = pool[Math.floor(rand() * pool.length)];
    usedText.add(c.text);
    out.push({ world, ch: c });
    if (out.length >= ROUNDS) break;
  }
  return out;
}

const todayISO = () => new Date().toISOString().slice(0, 10);

export const Battle = {
  _q: [], _i: 0, _pScore: 0, _bScore: 0, _diff: 'medium', _outdoor: false, _timer: null, _entry: 0, _reward: 0,

  // ─── Intro overlay: advantages, difficulty, entry/reward, start ───
  intro(opts = {}) {
    const p = Profiles.active(); if (!p) return;
    const cs = getLang() === 'cs';
    const outdoor = !!opts.outdoor;
    const stats = loadStats(p.id);
    const premium = Subscription.get(p.id).isPremium;
    // Home battles: 6/day and premium-only. Outdoor (battle spots): unlimited.
    const doneToday = stats.date === today() ? (stats.count || 0) : 0;

    const hatched = Gream.all(p.id).filter(g => g.stage >= 2 && g.archetype);
    const worldsCovered = [...new Set(hatched.map(g => Object.keys(WORLD_TO_ARCH).find(w => WORLD_TO_ARCH[w] === g.archetype)))].filter(Boolean);

    document.getElementById('battleOverlay')?.remove();
    const ov = document.createElement('div');
    ov.id = 'battleOverlay';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(10,10,15,0.75);display:flex;align-items:center;justify-content:center;z-index:1000;padding:18px';
    ov.onclick = e => { if (e.target === ov) ov.remove(); };

    const advList = worldsCovered.length
      ? worldsCovered.map(w => `${WORLD_ICONS[w]}`).join(' ')
      : (cs ? '—' : '—');

    ov.innerHTML = `
      <div style="background:#fff;border-radius:22px;max-width:360px;width:100%;padding:22px 20px;max-height:86vh;overflow-y:auto">
        <div style="text-align:center;margin-bottom:6px"><span style="font-size:34px">⚔️</span></div>
        <div style="text-align:center;font-size:20px;font-weight:900;color:var(--green-deep)">${cs?'Souboj':'Battle'}</div>
        <div style="text-align:center;font-size:12px;color:#888;margin-bottom:14px">${cs?`10 výzev na čas · kdo má víc správných, vyhrává`:`10 timed challenges · most correct wins`}</div>

        <div style="background:#f6faf2;border-radius:14px;padding:12px;margin-bottom:12px;font-size:13px;font-weight:700;color:var(--green-deep)">
          🐣 ${cs?'Tvá výhoda':'Your edge'}: ${hatched.length} ${cs?'greamíků':'Greams'} ${advList!=='—'?`(${advList})`:''}
          <div style="font-size:11px;font-weight:600;color:#888;margin-top:3px">${cs?'Za greamíka z daného světa dostaneš víc času na jeho otázky.':'A Gream from a question\'s world gives you more time on it.'}</div>
        </div>

        <div style="font-size:12px;font-weight:800;color:#888;margin-bottom:6px">${cs?'Obtížnost':'Difficulty'}</div>
        <div id="battleDiffRow" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px"></div>

        <div id="battleEconInfo" style="font-size:12px;color:#777;text-align:center;margin-bottom:6px"></div>
        <div id="battleDailyInfo" style="font-size:11px;color:#aaa;text-align:center;margin-bottom:12px"></div>

        <button id="battleStartBtn" style="width:100%;padding:15px;border:none;border-radius:15px;background:linear-gradient(135deg,#d2603a,#b0402a);color:#fff;font-family:inherit;font-weight:900;font-size:16px;cursor:pointer;margin-bottom:8px">${cs?'Zahájit souboj ⚔️':'Start battle ⚔️'}</button>
        <button id="battleDailyBtn" style="width:100%;padding:12px;border:2px solid var(--green-mid);border-radius:14px;background:#fff;color:var(--green-deep);font-family:inherit;font-weight:800;font-size:14px;cursor:pointer;margin-bottom:8px">📅 ${cs?'Denní kolo (stejné pro všechny)':'Daily round (same for all)'}</button>
        <button onclick="document.getElementById('battleOverlay').remove()" style="width:100%;padding:10px;border:none;background:none;color:#999;font-family:inherit;font-weight:700;font-size:13px;cursor:pointer">${cs?'Zavřít':'Close'}</button>
        <div style="text-align:center;font-size:11px;color:#bbb;margin-top:8px">🏆 ${cs?'Výhry':'Wins'}: ${stats.wins||0} · ${cs?'série':'streak'}: ${stats.streak||0}</div>
      </div>`;
    document.body.appendChild(ov);

    let sel = ['medium'];
    const row = ov.querySelector('#battleDiffRow');
    const econ = ov.querySelector('#battleEconInfo');
    const daily = ov.querySelector('#battleDailyInfo');
    const startBtn = ov.querySelector('#battleStartBtn');

    const refresh = () => {
      const diff = sel[0];
      const { reward, entry } = this.economy(diff, outdoor);
      const seeds = Skins.getSeeds(p.id);
      econ.textContent = cs
        ? `Vstup ${entry} 🌱 · výhra +${reward} 🌱 (máš ${seeds})`
        : `Entry ${entry} 🌱 · win +${reward} 🌱 (you have ${seeds})`;
      const extremeLocked = diff === 'extreme' && !premium;
      let blocked = false, reason = '';
      if (extremeLocked) { blocked = true; reason = cs?'⚡ Extrémní jen v Premium':'⚡ Extreme is Premium'; }
      else if (!outdoor && !premium) { blocked = true; reason = cs?'🏠 Domácí souboje jen v Premium (venku pro všechny)':'🏠 Home battles are Premium (outdoor for all)'; }
      else if (!outdoor && doneToday >= 6) { blocked = true; reason = cs?'Denní limit 6 domácích soubojů':'Daily limit of 6 home battles'; }
      else if (seeds < entry) { blocked = true; reason = cs?`Potřebuješ ${entry} 🌱`:`You need ${entry} 🌱`; }
      daily.textContent = outdoor ? (cs?'Venkovní souboj — neomezeně':'Outdoor battle — unlimited')
                                  : (cs?`Domácí souboje dnes: ${doneToday}/6`:`Home battles today: ${doneToday}/6`);
      startBtn.disabled = blocked;
      startBtn.style.opacity = blocked ? '0.5' : '1';
      startBtn.style.cursor = blocked ? 'default' : 'pointer';
      startBtn.textContent = blocked ? reason : (cs?`Zahájit (−${entry} 🌱) ⚔️`:`Start (−${entry} 🌱) ⚔️`);
      startBtn._entry = entry; startBtn._reward = reward; startBtn._diff = diff;
    };
    DIFFS.forEach(d => {
      const active = sel[0] === d.id;
      const b = document.createElement('button');
      b.style.cssText = `padding:11px;border-radius:12px;border:2px solid ${active?'var(--green-mid)':'rgba(0,0,0,0.1)'};background:${active?'var(--green-pale)':'#fff'};font-family:inherit;font-weight:800;font-size:13px;cursor:pointer;color:var(--green-deep)`;
      b.textContent = `${d.emoji} ${cs?d.cs:d.en}`;
      b.onclick = () => { sel[0] = d.id; row.querySelectorAll('button').forEach((x,i)=>{ const on=DIFFS[i].id===d.id; x.style.borderColor=on?'var(--green-mid)':'rgba(0,0,0,0.1)'; x.style.background=on?'var(--green-pale)':'#fff'; }); refresh(); };
      row.appendChild(b);
    });
    refresh();
    startBtn.onclick = () => {
      if (startBtn.disabled) return;
      this._start(startBtn._diff, outdoor, startBtn._entry, startBtn._reward);
    };
    ov.querySelector('#battleDailyBtn').onclick = () => this.daily();
  },

  _start(diff, outdoor, entry, reward) {
    const p = Profiles.active(); if (!p) return;
    if (!Skins.spendSeeds(p.id, entry)) return;
    // count a home battle
    if (!outdoor) {
      const s = loadStats(p.id);
      if (s.date !== today()) { s.date = today(); s.count = 0; }
      s.count = (s.count || 0) + 1;
      saveStats(p.id, s);
    }
    this._daily = false;
    this._diff = diff; this._outdoor = outdoor; this._entry = entry; this._reward = reward;
    this._q = pickQuestions(diff);
    this._i = 0; this._pScore = 0;
    document.getElementById('battleOverlay')?.remove();
    Audio.switchScene?.('challenge');
    // Instant local rival so the game never waits on the network; the real server
    // opponent swaps in when it arrives (well before the ~30s of 10 rounds finish).
    this._rival = this._localRival(diff);
    const myRating = loadStats(p.id).rating || 1000;
    Net.battleOpponent(diff, myRating).then(o => { if (o) this._rival = o; });
    this._renderRound();
  },

  _localRival(diff) {
    const acc = BOT_ACC[diff] || 0.65;
    let score = 0; for (let i = 0; i < ROUNDS; i++) if (Math.random() < acc) score++;
    return { name: 'Gream Bot', score, rating: 1000, bot: true };
  },

  // ─── Daily round: same date-seeded questions for everyone, ranked per day, 1×/den, free ───
  daily() {
    const p = Profiles.active(); if (!p) return;
    const cs = getLang() === 'cs';
    const date = todayISO();
    const key = 'gream_daily_done_' + p.id;
    if (localStorage.getItem(key) === date) {
      document.getElementById('battleOverlay')?.remove();
      this._showDailyBoard(date, cs ? 'Denní kolo už máš dnes hotové 👍' : 'You already played today\'s round 👍');
      return;
    }
    localStorage.setItem(key, date);
    this._daily = true; this._diff = 'medium'; this._outdoor = false; this._reward = 0;
    this._q = pickQuestions('medium', seededRng('gream-daily-' + date));
    this._i = 0; this._pScore = 0; this._rival = null;
    document.getElementById('battleOverlay')?.remove();
    Audio.switchScene?.('challenge');
    this._renderRound();
  },

  async _showDailyBoard(date, note) {
    const cs = getLang() === 'cs';
    document.getElementById('battleBoardOverlay')?.remove();
    const ov = document.createElement('div');
    ov.id = 'battleBoardOverlay';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(10,10,15,0.8);display:flex;align-items:center;justify-content:center;z-index:1004;padding:18px';
    ov.onclick = e => { if (e.target === ov) ov.remove(); };
    ov.innerHTML = `<div style="background:#fff;border-radius:20px;max-width:340px;width:100%;padding:20px;max-height:80vh;overflow-y:auto">
      <div style="text-align:center;font-size:18px;font-weight:900;color:var(--green-deep);margin-bottom:4px">📅 ${cs?'Denní kolo':'Daily round'}</div>
      ${note ? `<div style="text-align:center;font-size:12px;color:#888;margin-bottom:12px">${note}</div>` : ''}
      <div id="dlbList" style="font-size:14px;color:#555">${cs?'Načítám…':'Loading…'}</div>
      <button onclick="document.getElementById('battleBoardOverlay').remove()" style="width:100%;margin-top:14px;padding:11px;border:none;border-radius:12px;background:var(--green-mid);color:#fff;font-family:inherit;font-weight:800;cursor:pointer">${cs?'Zavřít':'Close'}</button>
    </div>`;
    document.body.appendChild(ov);
    const board = await Net.dailyLeaderboard(date);
    const list = ov.querySelector('#dlbList'); if (!list) return;
    if (!board || !board.length) list.innerHTML = `<div style="color:#999;text-align:center;padding:10px">${cs?'Zatím nikdo. Buď první!':'No one yet. Be first!'}</div>`;
    else list.innerHTML = board.map((x, i) => `<div style="display:flex;align-items:center;gap:10px;padding:8px 6px;border-bottom:1px solid #f0f0f0"><span style="width:26px;font-weight:900;color:${i<3?'#c8860a':'#bbb'}">${i+1}.</span><span style="flex:1;font-weight:800;color:var(--green-deep);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${x.name}</span><span style="font-weight:900;color:#2d7a2d">${x.score}/10</span></div>`).join('');
  },

  _renderRound() {
    const p = Profiles.active();
    const cs = getLang() === 'cs';
    if (this._i >= this._q.length) return this._finish();
    const { world, ch } = this._q[this._i];
    const timeMs = BASE_TIME_MS + timeBonusForWorld(p.id, world);
    const bonus = timeMs - BASE_TIME_MS;

    document.getElementById('battleRound')?.remove();
    const ov = document.createElement('div');
    ov.id = 'battleRound';
    ov.style.cssText = 'position:fixed;inset:0;background:linear-gradient(180deg,#2a1512,#1a0f14);display:flex;flex-direction:column;align-items:center;justify-content:flex-start;z-index:1001;padding:calc(var(--sat,0px) + 20px) 18px 24px;color:#fff';
    const rivalLabel = this._daily ? `📅 ${cs?'Denní kolo':'Daily round'}` : `🆚 ${this._rival?.name || (cs?'Sok':'Rival')}`;
    ov.innerHTML = `
      <div style="width:100%;max-width:420px;display:flex;justify-content:space-between;align-items:center;font-weight:900;font-size:14px;margin-bottom:8px">
        <span>⚔️ ${this._i+1}/${ROUNDS}</span>
        <span>${cs?'Ty':'You'} <span style="color:#7ec44a">${this._pScore}</span> · ${rivalLabel}</span>
      </div>
      <div style="width:100%;max-width:420px;height:10px;background:rgba(255,255,255,0.15);border-radius:6px;overflow:hidden;margin-bottom:14px">
        <div id="battleTimeBar" style="height:100%;width:100%;background:linear-gradient(90deg,#7ec44a,#f5c842)"></div>
      </div>
      <div style="font-size:13px;font-weight:800;color:${bonus>0?'#7ec44a':'#bbb'};margin-bottom:10px">${WORLD_ICONS[world]} ${cs?'Svět':'World'}: ${tr().worlds?.[world]||world}${bonus>0?` · +${Math.round(bonus/1000)}s 🐣`:''}</div>
      <div style="font-size:18px;font-weight:900;text-align:center;line-height:1.35;max-width:420px;margin-bottom:16px">${ch.text}</div>
      <div id="battleChoices" style="width:100%;max-width:420px;display:flex;flex-direction:column;gap:9px"></div>
      <button id="battleReport" style="margin-top:14px;background:none;border:none;color:rgba(255,255,255,0.4);font-family:inherit;font-size:12px;font-weight:700;cursor:pointer">🚩 ${cs?'Nahlásit otázku':'Report question'}</button>`;
    document.body.appendChild(ov);

    // Report the current battle question
    ov.querySelector('#battleReport').onclick = () => {
      const d = this._daily ? 'medium' : this._diff;
      try { window.App?.reportChallenge({ world, difficulty: d, text: ch.text, enText: ch.text, id: challengeId(world, d, ch.text) }); } catch {}
    };

    const choicesEl = ov.querySelector('#battleChoices');
    let answered = false;
    const done = (correct) => {
      if (answered) return; answered = true;
      clearInterval(this._timer);
      if (correct) { this._pScore++; Feedback.success?.(); } else { Feedback.error?.(); }
      setTimeout(() => { this._i++; this._renderRound(); }, 550);
    };

    if (ch.check?.type === 'number') {
      // Quick number input
      const wrap = document.createElement('div');
      wrap.style.cssText = 'width:100%;display:flex;gap:8px';
      const input = document.createElement('input');
      input.type = 'text'; input.inputMode = 'decimal';
      input.placeholder = cs ? 'Číslo…' : 'Number…';
      input.style.cssText = 'flex:1;padding:14px;border-radius:14px;border:2px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.1);color:#fff;font-family:inherit;font-weight:900;font-size:18px;text-align:center;outline:none';
      const submit = document.createElement('button');
      submit.textContent = '✓';
      submit.style.cssText = 'padding:14px 20px;border-radius:14px;border:none;background:#7ec44a;color:#fff;font-family:inherit;font-weight:900;font-size:18px;cursor:pointer';
      const check = () => {
        if (answered) return;
        const num = parseFloat(String(input.value).replace(',', '.'));
        const tol = ch.check.tolerance ?? 0;
        const correct = !isNaN(num) && Math.abs(num - ch.check.answer) <= tol;
        input.style.borderColor = correct ? '#7ec44a' : '#e0705a';
        done(correct);
      };
      submit.onclick = check;
      input.addEventListener('keypress', e => { if (e.key === 'Enter') check(); });
      wrap.appendChild(input); wrap.appendChild(submit);
      choicesEl.appendChild(wrap);
      setTimeout(() => input.focus(), 200);
    } else {
      const shuffled = [...ch.choices].sort(() => Math.random() - 0.5);
      shuffled.forEach(c => {
        const b = document.createElement('button');
        b.style.cssText = 'width:100%;padding:14px 16px;border-radius:14px;border:2px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.08);color:#fff;font-family:inherit;font-weight:800;font-size:15px;cursor:pointer;text-align:left';
        b.textContent = c.text;
        b.onclick = () => {
          if (answered) return;
          const correct = String(c.value ?? c.text).toLowerCase() === String(ch.check.correct).toLowerCase();
          b.style.background = correct ? 'rgba(126,196,74,0.4)' : 'rgba(224,112,90,0.4)';
          b.style.borderColor = correct ? '#7ec44a' : '#e0705a';
          done(correct);
        };
        choicesEl.appendChild(b);
      });
    }

    // Timer
    const bar = ov.querySelector('#battleTimeBar');
    const start = Date.now();
    clearInterval(this._timer);
    this._timer = setInterval(() => {
      const frac = Math.max(0, 1 - (Date.now() - start) / timeMs);
      bar.style.width = (frac * 100) + '%';
      if (frac <= 0) { choicesEl.querySelectorAll('button').forEach(b => b.disabled = true); done(false); }
    }, 60);
  },

  _finish() {
    const p = Profiles.active();
    const cs = getLang() === 'cs';
    clearInterval(this._timer);
    document.getElementById('battleRound')?.remove();

    // ─── Daily round: score-attack ranked on a shared daily leaderboard ───
    if (this._daily) {
      const date = todayISO();
      const reward = this._pScore;   // modest: 1 🌱 per correct answer
      if (reward > 0) Skins.addSeeds(p.id, reward);
      Feedback.celebrate?.();
      Net.dailyResult({ pid: p.id, name: p.name || 'Hráč', date, score: this._pScore }).then(r => {
        this._showDailyBoard(date, cs
          ? `Tvé skóre: ${this._pScore}/10 · +${reward} 🌱${r && r.rank ? ` · ${r.rank}. místo` : ''}`
          : `Your score: ${this._pScore}/10 · +${reward} 🌱${r && r.rank ? ` · rank ${r.rank}` : ''}`);
      });
      this._daily = false;
      return;
    }

    const rival = this._rival || this._localRival(this._diff);
    const win = this._pScore >= rival.score;   // ties favour the player
    const s = loadStats(p.id);
    s.wins = (s.wins || 0) + (win ? 1 : 0);
    s.losses = (s.losses || 0) + (win ? 0 : 1);
    s.streak = win ? (s.streak || 0) + 1 : 0;
    s.bestStreak = Math.max(s.bestStreak || 0, s.streak);
    s.total = (s.total || 0) + 1;
    saveStats(p.id, s);
    let reward = 0;
    if (win) { reward = this._reward; Skins.addSeeds(p.id, reward); Feedback.celebrate?.(); }
    else Feedback.error?.();
    const newBadges = this._checkBadges(p.id, s, win, this._diff);

    // Submit to server (async PvP rating + leaderboard) — offline-safe.
    Net.battleResult({
      pid: p.id, name: p.name || 'Hráč', difficulty: this._diff,
      score: this._pScore, oppScore: rival.score, win, oppRating: rival.rating || 1000,
    }).then(r => { if (r && r.rating) { const st = loadStats(p.id); st.rating = r.rating; st.rank = r.rank; saveStats(p.id, st); } });

    const ov = document.createElement('div');
    ov.id = 'battleResult';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(10,10,15,0.85);display:flex;align-items:center;justify-content:center;z-index:1002;padding:18px';
    ov.innerHTML = `
      <div style="background:#fff;border-radius:22px;max-width:340px;width:100%;padding:26px 20px;text-align:center">
        <div style="font-size:44px;margin-bottom:6px">${win?'🏆':'💪'}</div>
        <div style="font-size:22px;font-weight:900;color:${win?'#2d7a2d':'#b0402a'}">${win?(cs?'Výhra!':'You win!'):(cs?'Prohra':'You lost')}</div>
        <div style="font-size:15px;font-weight:800;color:#555;margin:6px 0 4px">${cs?'Ty':'You'} ${this._pScore} — ${rival.score} ${rival.name}</div>
        <div style="font-size:11px;color:#bbb;margin-bottom:12px">${rival.bot?(cs?'(bot — zatím nikdo online)':'(bot — no one online yet)'):(cs?'skutečný hráč':'real player')}</div>
        ${win?`<div style="background:#f0fbe8;border-radius:12px;padding:10px;font-weight:900;color:#2d7a2d;margin-bottom:12px">+${reward} 🌱</div>`
             :`<div style="font-size:13px;color:#999;margin-bottom:12px">${cs?'Vstupné propadlo. Zkus to znovu!':'Entry lost. Try again!'}</div>`}
        ${newBadges.length?`<div style="font-size:13px;font-weight:800;color:#c8860a;margin-bottom:12px">🏅 ${newBadges.join(' · ')}</div>`:''}
        <div style="font-size:12px;color:#999;margin-bottom:14px">🏆 ${s.wins} · ${cs?'série':'streak'} ${s.streak} (${cs?'nej':'best'} ${s.bestStreak})</div>
        <button id="battleAgain" style="width:100%;padding:13px;border:none;border-radius:14px;background:linear-gradient(135deg,#d2603a,#b0402a);color:#fff;font-family:inherit;font-weight:900;font-size:15px;cursor:pointer;margin-bottom:8px">${cs?'Znovu ⚔️':'Again ⚔️'}</button>
        <button id="battleBoard" style="width:100%;padding:11px;border:none;border-radius:14px;background:#f0f0f0;color:#555;font-family:inherit;font-weight:800;font-size:14px;cursor:pointer;margin-bottom:8px">🏆 ${cs?'Žebříček':'Leaderboard'}</button>
        <button id="battleClose" style="width:100%;padding:11px;border:none;background:none;color:#999;font-family:inherit;font-weight:700;font-size:13px;cursor:pointer">${cs?'Zpět do zahrady':'Back to garden'}</button>
      </div>`;
    document.body.appendChild(ov);
    ov.querySelector('#battleAgain').onclick = () => { ov.remove(); this.intro({ outdoor: this._outdoor }); };
    ov.querySelector('#battleBoard').onclick = () => this.showLeaderboard();
    ov.querySelector('#battleClose').onclick = () => { ov.remove(); Audio.switchScene?.('menu'); try { window.App?.renderMap?.(); } catch {} };
  },

  // ─── Battle leaderboard overlay (server) ───
  async showLeaderboard() {
    const cs = getLang() === 'cs';
    const p = Profiles.active();
    document.getElementById('battleBoardOverlay')?.remove();
    const ov = document.createElement('div');
    ov.id = 'battleBoardOverlay';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(10,10,15,0.8);display:flex;align-items:center;justify-content:center;z-index:1004;padding:18px';
    ov.onclick = e => { if (e.target === ov) ov.remove(); };
    ov.innerHTML = `<div style="background:#fff;border-radius:20px;max-width:340px;width:100%;padding:20px;max-height:80vh;overflow-y:auto">
      <div style="text-align:center;font-size:18px;font-weight:900;color:var(--green-deep);margin-bottom:12px">🏆 ${cs?'Žebříček soubojů':'Battle leaderboard'}</div>
      <div id="lbList" style="font-size:14px;color:#555">${cs?'Načítám…':'Loading…'}</div>
      <button onclick="document.getElementById('battleBoardOverlay').remove()" style="width:100%;margin-top:14px;padding:11px;border:none;border-radius:12px;background:var(--green-mid);color:#fff;font-family:inherit;font-weight:800;cursor:pointer">${cs?'Zavřít':'Close'}</button>
    </div>`;
    document.body.appendChild(ov);
    const board = await Net.leaderboard();
    const list = ov.querySelector('#lbList');
    if (!list) return;
    const myRating = loadStats(p?.id).rating;
    if (!board || !board.length) {
      list.innerHTML = `<div style="color:#999;text-align:center;padding:10px">${cs?'Zatím žádní hráči. Buď první!':'No players yet. Be the first!'}</div>`;
    } else {
      list.innerHTML = board.map((x, i) => `
        <div style="display:flex;align-items:center;gap:10px;padding:8px 6px;border-bottom:1px solid #f0f0f0">
          <span style="width:26px;font-weight:900;color:${i<3?'#c8860a':'#bbb'}">${i+1}.</span>
          <span style="flex:1;font-weight:800;color:var(--green-deep);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${x.name}</span>
          <span style="font-weight:900;color:#2d7a2d">${x.rating}</span>
          <span style="font-size:11px;color:#aaa">🏆${x.wins}</span>
        </div>`).join('') + (myRating ? `<div style="text-align:center;font-size:12px;color:#888;margin-top:10px">${cs?'Tvůj rating':'Your rating'}: <b>${myRating}</b></div>` : '');
    }
  },

  _checkBadges(pid, s, win, diff) {
    let owned = {};
    try { owned = JSON.parse(localStorage.getItem(KEY_BADGES) || '{}')[pid] || {}; } catch {}
    const cs = getLang() === 'cs';
    const defs = [
      { id:'first_win',   ok: s.wins >= 1,  cs:'První výhra',  en:'First win' },
      { id:'wins_10',     ok: s.wins >= 10, cs:'10 výher',     en:'10 wins' },
      { id:'streak_5',    ok: s.bestStreak >= 5, cs:'Série 5',  en:'5 streak' },
      { id:'extreme_win', ok: win && diff === 'extreme', cs:'Extrémní vítěz', en:'Extreme winner' },
    ];
    const newly = [];
    for (const d of defs) if (d.ok && !owned[d.id]) { owned[d.id] = Date.now(); newly.push(cs?d.cs:d.en); }
    try { const all = JSON.parse(localStorage.getItem(KEY_BADGES) || '{}'); all[pid] = owned; localStorage.setItem(KEY_BADGES, JSON.stringify(all)); } catch {}
    return newly;
  },

  // For a future server leaderboard — expose local record.
  getStats(pid) { return loadStats(pid); },

  // Shared economy: win reward and entry stake (entry = 1/4 of win at home, 1/8 outdoors).
  economy(diff, outdoor) {
    const reward = WIN_REWARD[diff] || WIN_REWARD.medium;
    return { reward, entry: Math.max(1, Math.round(reward / (outdoor ? 8 : 4))) };
  },

  // Headless battle (no DOM) — used by the test simulator and future practice modes.
  // Reuses the same question pool, time-bonus, bot accuracy and economy as the UI path.
  simulate(pid, diff = 'medium', playerAcc = 0.8, outdoor = false) {
    const { reward, entry } = this.economy(diff, outdoor);
    if (Skins.getSeeds(pid) < entry) return { error: 'no-seeds' };
    Skins.spendSeeds(pid, entry);
    const q = pickQuestions(diff);
    let pScore = 0, bScore = 0;
    for (const { world } of q) {
      const bonus = timeBonusForWorld(pid, world);         // more time → better odds
      const eff = Math.min(0.98, playerAcc + bonus / 40000);
      if (Math.random() < eff) pScore++;
      if (Math.random() < (BOT_ACC[diff] || 0.65)) bScore++;
    }
    const win = pScore >= bScore;
    const s = loadStats(pid);
    s.wins = (s.wins || 0) + (win ? 1 : 0);
    s.losses = (s.losses || 0) + (win ? 0 : 1);
    s.streak = win ? (s.streak || 0) + 1 : 0;
    s.bestStreak = Math.max(s.bestStreak || 0, s.streak);
    s.total = (s.total || 0) + 1;
    saveStats(pid, s);
    if (win) Skins.addSeeds(pid, reward);
    this._checkBadges(pid, s, win, diff);
    return { win, pScore, bScore, entry, reward: win ? reward : 0, questions: q.length };
  },
};
