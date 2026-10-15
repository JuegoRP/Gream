// ═══════════════════════════════════
//  GREAM — battle.js  (Souboje 1.1: aréna greamíků)
//  10 časově omezených otázek. Správná odpověď = útok tvého greamíka (životy 100),
//  energie za správné odpovědi → speciál. Pravidla: battle-rules.js, vzhled: arena.js.
//  Soupeř = nahraný souboj jiného hráče (server přehraje jeho odpovědi a časy) nebo bot.
//  Greamík z odpovídajícího světa → delší čas. Vstup stojí 1/4 výhry (venku 1/8).
// ═══════════════════════════════════

import { tr, getLang } from './i18n.js';
import { Profiles } from './profiles.js';
import { Gream, ARCHETYPES } from './gream.js';
import { Skins } from './skins.js';
import { Subscription } from './subscription.js';
import { Feedback } from './feedback.js';
import { Audio } from './audio.js';
import { Net, challengeId } from './net.js';
import { RULES, SPECIALS, ARCH_WORLD, ARCHES, newFighter, useSpecial, canSpecial, aiWantsSpecial, resolveRound, winner } from './battle-rules.js';
import { Arena, drawFighter } from './arena.js';
import { factFor } from './facts.js';
import { numTolerance } from './validator.js';
const ARCHETYPE_NAME = (a) => ARCHETYPES[a]?.name?.[getLang() === 'cs' ? 'cs' : 'en'] || a;

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
const escHtml = (x) => String(x ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

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
        <div style="text-align:center;font-size:12px;color:#888;margin-bottom:14px;line-height:1.4">${tr().battle_how}</div>

        <div style="background:#f6faf2;border-radius:14px;padding:12px;margin-bottom:12px;font-size:13px;font-weight:700;color:var(--green-deep)">
          🐣 ${cs?'Tvá výhoda':'Your edge'}: ${hatched.length} ${cs?(hatched.length===1?'greamík':hatched.length>=2&&hatched.length<=4?'greamíci':'greamíků'):(hatched.length===1?'Gream':'Greams')} ${advList!=='—'?`(${advList})`:''}
          <div style="font-size:11px;font-weight:600;color:#888;margin-top:3px">${cs?'Za greamíka z daného světa dostaneš víc času na jeho otázky.':'A Gream from a question\'s world gives you more time on it.'}</div>
        </div>

        <div style="font-size:12px;font-weight:800;color:#888;margin-bottom:6px">${tr().battle_pick}</div>
        ${hatched.length ? '' : `<div style="font-size:11px;color:#999;margin-bottom:6px">${tr().battle_loan_note}</div>`}
        <div class="bt-pick" id="battlePick"></div>
        <div class="bt-skill" id="battleSkill"></div>
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

    // Výběr greamíka: vylíhnutí (stádium ≥ 2), jinak všech šest „na zkoušku“
    const roster = hatched.length
      ? hatched.map(g => ({ arch: g.archetype, stage: g.stage, shiny: !!g.isShiny, id: g.id, name: g.name }))
      : ARCHES.map(a => ({ arch: a, stage: 2, loan: true }));
    const prev = localStorage.getItem('gream_battle_pick_' + p.id);
    let pick = roster.find(r => (r.id || r.arch) === prev) || roster[0];
    const pickEl = ov.querySelector('#battlePick'), skillEl = ov.querySelector('#battleSkill');
    const showSkill = () => {
      const sp = tr().battle_special[SPECIALS[pick.arch].id];
      skillEl.innerHTML = `<b>✨ ${sp.name}</b>${sp.desc}`;
    };
    roster.forEach(r => {
      const b = document.createElement('button');
      b.className = r === pick ? 'on' : '';
      b.innerHTML = `<canvas></canvas>${r.name || ARCHETYPE_NAME(r.arch)}${r.loan ? `<span class="loan">${tr().battle_loan}</span>` : ''}`;
      b.onclick = () => { pick = r; pickEl.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); showSkill(); try { localStorage.setItem('gream_battle_pick_' + p.id, r.id || r.arch); } catch {} };
      pickEl.appendChild(b);
      requestAnimationFrame(() => drawFighter(b.querySelector('canvas'), r.arch, r.stage, { shiny: r.shiny, acc: Skins.getAccessory(p.id) }));
    });
    showSkill();

    startBtn.onclick = () => {
      if (startBtn.disabled) return;
      this._start(startBtn._diff, outdoor, startBtn._entry, startBtn._reward, pick);
    };
    ov.querySelector('#battleDailyBtn').onclick = () => this.daily(pick);
  },

  _start(diff, outdoor, entry, reward, pick) {
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
    document.getElementById('battleOverlay')?.remove();
    // Hned lokální soupeř (hra nikdy nečeká na síť); skutečný nahraný hráč ze serveru ho nahradí, pokud dorazí do 1,5 s
    this._rival = this._localRival(diff);
    const myRating = loadStats(p.id).rating || 1000;
    const fromServer = Net.battleOpponent(diff, myRating, p.id).then(o => { if (o && !o.bot && Array.isArray(o.answers) && o.answers.length >= 5 && ARCHES.includes(o.arch)) this._rival = { ...o, stage: o.stage || 2 }; });   // bez nahrávky (starší souboj) zůstává bot – nepřebírat jméno skutečného hráče
    Promise.race([fromServer, new Promise(r => setTimeout(r, 1500))]).then(() => this._run(pick));
  },

  // Bot: přesnost podle obtížnosti, časy odpovědí náhodně (rychlejší, když ví)
  _localRival(diff, rng = Math.random) {
    const acc = BOT_ACC[diff] || 0.65;
    const answers = Array.from({ length: ROUNDS }, () => {
      const knows = rng() < acc;
      const ok = knows || rng() < 1 / 3;
      return { ok, ms: Math.round(ok && knows ? 1800 + rng() * 5500 : 5000 + rng() * 5500) };
    });
    const arch = ARCHES[Math.floor(rng() * ARCHES.length)];
    return { name: 'Gream Bot', arch, stage: 2 + Math.floor(rng() * 3), answers, rating: 1000, bot: true };
  },

  // ─── Daily round: same date-seeded questions for everyone, ranked per day, 1×/den, free ───
  daily(pick) {
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
    const rng = seededRng('gream-daily-' + date);
    this._q = pickQuestions('medium', rng);
    // Denní strážce: pro všechny stejný (stejný greamík i odpovědi)
    this._rival = { ...this._localRival('medium', seededRng('gream-daily-bot-' + date)), name: cs ? 'Denní strážce' : 'Daily guardian', bot: true };
    document.getElementById('battleOverlay')?.remove();
    this._run(pick);
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

  // ─── Souboj v aréně ───
  async _run(pick) {
    const p = Profiles.active(); if (!p) return;
    const t = tr(), cs = getLang() === 'cs';
    if (!pick) { const g = Gream.all(p.id).find(x => x.stage >= 2 && x.archetype); pick = g ? { arch: g.archetype, stage: g.stage, shiny: !!g.isShiny } : { arch: 'lilek', stage: 2, loan: true }; }
    this._me = pick;
    const rival = this._rival;
    this._f = [newFighter(pick.arch), newFighter(rival.arch)];
    this._correct = [0, 0]; this._missed = []; this._log = [];
    Audio.switchScene?.('challenge');

    document.getElementById('battleRound')?.remove();
    const scr = document.createElement('div');
    scr.id = 'battleRound'; scr.className = 'battle-screen';
    scr.innerHTML = `<div class="ar-wrap"></div>
      <div class="bt-top"><span id="btRound"></span><span class="bt-world" id="btWorld"></span></div>
      <div class="bt-time"><i id="btTime"></i></div>
      <button class="bt-special" id="btSpecial" hidden></button>
      <div class="bt-q" id="btQ"></div>
      <div class="bt-choices" id="btChoices"></div>
      <button class="bt-report" id="btReport">🚩 ${cs ? 'Nahlásit otázku' : 'Report question'}</button>`;
    document.body.appendChild(scr);
    this._arena = new Arena(scr.querySelector('.ar-wrap'), {
      me: { ...pick, acc: Skins.getAccessory(p.id), name: `${t.battle_you} · ${pick.name || ARCHETYPE_NAME(pick.arch)}` },
      op: { arch: rival.arch, stage: rival.stage, shiny: !!rival.shiny, acc: rival.acc || null, name: `${rival.name} · ${ARCHETYPE_NAME(rival.arch)}` },
      labels: { energy: t.battle_energy, superEffective: t.battle_super_eff, crit: t.battle_crit },
    });
    this._arena.update(this._f);
    await new Promise(r => setTimeout(r, 400));

    for (let round = 0; round < ROUNDS && round < this._q.length; round++) {
      const f = this._f;
      // Soupeř se rozhodne pro speciál na začátku kola
      if (aiWantsSpecial(f[1])) {
        const ev = useSpecial(f[1], f[0]);
        await this._arena.special(1, ev, t.battle_special[ev.id].name);
        this._arena.update(f);
        if (f[0].hp <= 0) break;
      }
      const mine = await this._askQuestion(round);
      const opp = this._oppAnswer(round);
      const hits = resolveRound(f, mine, opp);
      // Animace: zásahy po sobě, životy se odečítají postupně
      const disp = f.map(x => ({ ...x }));
      hits.forEach(h => { disp[1 - h.from].hp += h.dmg; });
      for (const h of hits) {
        await this._arena.attack(h);
        disp[1 - h.from].hp -= h.dmg;
        this._arena.update(disp.map((d, i) => ({ ...f[i], hp: d.hp })));
      }
      this._arena.update(f);
      if (!hits.length) await new Promise(r => setTimeout(r, 350));
      if (f[0].hp <= 0 || f[1].hp <= 0) break;
    }
    clearInterval(this._timer);
    let w = winner(this._f);
    if (w === -1) w = this._correct[0] >= this._correct[1] ? 0 : 1;   // remíza: rozhodnou správné odpovědi, pak hráč
    if (this._f[w === 0 ? 1 : 0].hp <= 0) this._arena.banner(t.battle_ko, 'sp');
    await this._arena.finish(w);
    this._arena.destroy();
    this._finish(w === 0);
  },

  // Odpověď soupeře v kole (nahraný hráč nebo bot); během otázky „živě“ ukáže, že už odpověděl
  _oppAnswer(round) {
    const a = this._rival.answers?.[round] || { ok: false, ms: BASE_TIME_MS };
    const f1 = this._f[1];
    const qWorld = this._curWorld;
    const domain = f1.ownWorldNext || qWorld === ARCH_WORLD[f1.arch];
    const ok = a.ok || (f1.fiftyNext && !a.ok && Math.random() < 0.25);   // 50:50 pomůže i soupeři
    f1.fiftyNext = false; f1.ownWorldNext = false;
    if (ok) this._correct[1]++;
    return { ok, domain, speedFrac: ok ? Math.max(0, 1 - a.ms / BASE_TIME_MS) : 0 };
  },

  // Otázka kola: vrací { ok, domain, speedFrac }. Hráč může před odpovědí použít speciál.
  _askQuestion(round) {
    const p = Profiles.active();
    const t = tr(), cs = getLang() === 'cs';
    const scr = document.getElementById('battleRound');
    let { world, ch } = this._q[round];
    const me = this._f[0];
    return new Promise((resolve) => {
      let answered = false, start = Date.now(), timeMs = BASE_TIME_MS + timeBonusForWorld(p.id, world), paused = 0;
      const elQ = scr.querySelector('#btQ'), elC = scr.querySelector('#btChoices'), bar = scr.querySelector('#btTime');
      const spBtn = scr.querySelector('#btSpecial');
      scr.querySelector('#btRound').textContent = `⚔️ ${t.battle_round} ${round + 1}/${ROUNDS}`;
      const opCard = scr.querySelector('.ar-op .ar-card'); opCard?.classList.remove('answered');
      const oppMs = this._rival.answers?.[round]?.ms;
      const oppTimer = oppMs ? setTimeout(() => opCard?.classList.add('answered'), oppMs) : null;

      const render = () => {
        this._curWorld = world;
        const bonus = timeMs - BASE_TIME_MS;
        const dom = world === ARCH_WORLD[me.arch] || me.ownWorldNext;
        scr.querySelector('#btWorld').textContent = `${WORLD_ICONS[world]} ${t.worlds?.[world] || world}${bonus > 0 ? ` · +${Math.round(bonus / 1000)} s` : ''}${dom ? ` · ${t.battle_super_eff}` : ''}`;
        elQ.textContent = ch.text;
        elC.innerHTML = '';
        if (ch.check?.type === 'number') {
          const wrap = document.createElement('div'); wrap.style.cssText = 'display:flex;gap:8px';
          const input = document.createElement('input');
          input.type = 'text'; input.inputMode = 'decimal'; input.placeholder = cs ? 'Číslo…' : 'Number…';
          input.className = 'bt-choice'; input.style.textAlign = 'center';
          const ok = document.createElement('button'); ok.className = 'bt-choice'; ok.style.cssText = 'width:auto;text-align:center;background:#7ec44a'; ok.textContent = '✓';
          const check = () => { const num = parseFloat(String(input.value).replace(',', '.')); done(!isNaN(num) && Math.abs(num - ch.check.answer) <= numTolerance(ch.check), String(ch.check.answer) + (ch.check.unit ? ' ' + ch.check.unit : '')); };
          ok.onclick = check; input.addEventListener('keypress', e => { if (e.key === 'Enter') check(); });
          wrap.append(input, ok); elC.appendChild(wrap); setTimeout(() => input.focus(), 150);
        } else {
          const correctVal = String(ch.check.correct).toLowerCase();
          const shuffled = [...ch.choices].sort(() => Math.random() - 0.5);
          let removed = 0;
          shuffled.forEach(c => {
            const b = document.createElement('button'); b.className = 'bt-choice'; b.textContent = c.text;
            const right = String(c.value ?? c.text).toLowerCase() === correctVal;
            if (me.fiftyNext && !right && !removed && shuffled.length >= 3) { b.classList.add('gone'); removed++; }
            b.dataset.right = right ? '1' : '';
            b.onclick = () => { if (answered) return; b.classList.add(right ? 'ok' : 'bad'); done(right, (shuffled.find(x => String(x.value ?? x.text).toLowerCase() === correctVal) || {}).text); };
            elC.appendChild(b);
          });
        }
        spBtn.hidden = !canSpecial(me);
        if (!spBtn.hidden) { const sp = t.battle_special[SPECIALS[me.arch].id]; spBtn.innerHTML = `✨ ${sp.name}<small>${sp.desc}</small>`; }
      };

      spBtn.onclick = async () => {
        if (answered || !canSpecial(me)) return;
        spBtn.hidden = true;
        const pauseStart = Date.now();
        const ev = useSpecial(me, this._f[1]);
        Audio.playCry?.(me.arch, this._me.stage);
        if (me.ownWorldNext && world !== ARCH_WORLD[me.arch]) {   // Kompas: otázka z mého světa
          const alt = pickQuestions(this._daily ? 'medium' : this._diff).find(x => x.world === ARCH_WORLD[me.arch]);
          const pool = (tr().challenges?.[ARCH_WORLD[me.arch]]?.[this._daily ? 'medium' : this._diff] || []).filter(battleUsable);
          const c = alt?.ch || pool[Math.floor(Math.random() * pool.length)];
          if (c) { world = ARCH_WORLD[me.arch]; ch = c; this._q[round] = { world, ch }; }
        }
        await this._arena.special(0, ev, t.battle_special[ev.id].name);
        this._arena.update(this._f);
        paused += Date.now() - pauseStart;
        if (!answered) render();
        if (this._f[1].hp <= 0) done(false, null, true);
      };

      const done = (ok, correctText, ko = false) => {
        if (answered) return; answered = true;
        clearInterval(this._timer); clearTimeout(oppTimer);
        spBtn.hidden = true;
        elC.querySelectorAll('button').forEach(b => { b.disabled = true; if (!ok && b.dataset.right) b.classList.add('ok'); });
        const left = Math.max(0, 1 - (Date.now() - start - paused) / timeMs);
        const domain = world === ARCH_WORLD[me.arch] || me.ownWorldNext;
        me.fiftyNext = false; me.ownWorldNext = false;
        if (ok) { this._correct[0]++; Feedback.success?.(); } else if (!ko) { Feedback.error?.(); this._missed.push({ q: ch.text, a: correctText, world, diff: this._daily ? 'medium' : this._diff, ch }); }
        this._log.push({ ok: !!ok, ms: Math.round(Date.now() - start - paused) });
        setTimeout(() => resolve({ ok: !!ok && !ko, domain, speedFrac: ok ? left : 0 }), ok ? 250 : 700);
      };

      scr.querySelector('#btReport').onclick = () => {
        const d = this._daily ? 'medium' : this._diff;
        try { window.App?.reportChallenge({ world, difficulty: d, text: ch.text, enText: ch.text, id: challengeId(world, d, ch.text) }); } catch {}
      };

      render();
      clearInterval(this._timer);
      this._timer = setInterval(() => {
        if (spBtn.dataset.busy) return;
        const frac = Math.max(0, 1 - (Date.now() - start - paused) / timeMs);
        bar.style.width = (frac * 100) + '%';
        if (frac <= 0) done(false, ch.check?.type === 'number' ? String(ch.check.answer) : (ch.choices || []).find(x => String(x.value ?? x.text).toLowerCase() === String(ch.check.correct).toLowerCase())?.text);
      }, 60);
    });
  },

  _finish(win) {
    const p = Profiles.active();
    const t = tr(), cs = getLang() === 'cs';
    clearInterval(this._timer);
    document.getElementById('battleRound')?.remove();
    const myCorrect = this._correct[0];
    const review = this._missed.length ? `<div style="font-size:12px;font-weight:900;color:#888;margin-top:6px">${t.battle_review}</div>
      <div class="bt-review">${this._missed.map(m => `<div>${escHtml(m.q)}${m.a ? `<br><b>${t.battle_correct_is}${escHtml(m.a)}</b>` : ''}${(() => { const f = factFor(m.world, m.diff, m.ch); return f ? `<br><span style="color:#b07800">💡 ${escHtml(f.text)}</span>` : ''; })()}</div>`).join('')}</div>` : '';

    // ─── Daily round: score-attack ranked on a shared daily leaderboard ───
    if (this._daily) {
      const date = todayISO();
      const reward = myCorrect;   // 1 🌱 per correct answer
      if (reward > 0) Skins.addSeeds(p.id, reward);
      Feedback.celebrate?.();
      Net.dailyResult({ pid: p.id, name: p.name || 'Hráč', date, score: myCorrect }).then(r => {
        this._showDailyBoard(date, cs
          ? `${win ? 'Výhra nad strážcem! ' : ''}Tvé skóre: ${myCorrect}/10 · +${reward} 🌱${r && r.rank ? ` · ${r.rank}. místo` : ''}`
          : `${win ? 'You beat the guardian! ' : ''}Your score: ${myCorrect}/10 · +${reward} 🌱${r && r.rank ? ` · rank ${r.rank}` : ''}`);
      });
      this._daily = false;
      return;
    }

    const rival = this._rival;
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

    // Server: rating + nahrávka souboje (odpovědi a časy), aby ji mohli hrát ostatní jako soupeře
    Net.battleResult({
      pid: p.id, name: p.name || 'Hráč', difficulty: this._diff,
      score: myCorrect, oppScore: this._correct[1], win, oppRating: rival.rating || 1000,
      arch: this._me.arch, stage: this._me.stage || 2, acc: Skins.getAccessory(p.id) || null, answers: this._log.slice(0, ROUNDS),
    }).then(r => { if (r && r.rating) { const st = loadStats(p.id); st.rating = r.rating; st.rank = r.rank; saveStats(p.id, st); } });

    const hpLeft = Math.max(0, Math.round(this._f[0].hp)), opLeft = Math.max(0, Math.round(this._f[1].hp));
    const ov = document.createElement('div');
    ov.id = 'battleResult';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(10,10,15,0.85);display:flex;align-items:center;justify-content:center;z-index:1002;padding:18px';
    ov.innerHTML = `
      <div style="background:#fff;border-radius:22px;max-width:360px;width:100%;padding:22px 20px;text-align:center;max-height:90vh;overflow-y:auto">
        <canvas id="brSprite" style="width:110px;height:110px;image-rendering:pixelated;display:block;margin:0 auto 4px"></canvas>
        <div style="font-size:22px;font-weight:900;color:${win?'#2d7a2d':'#b0402a'}">${win?(cs?'Výhra!':'You win!'):(cs?'Prohra':'You lost')}</div>
        <div style="font-size:14px;font-weight:800;color:#555;margin:6px 0 2px">❤️ ${hpLeft} — ${opLeft} ❤️ · ✓ ${myCorrect} — ${this._correct[1]}</div>
        <div style="font-size:11px;color:#bbb;margin-bottom:12px">${rival.name} · ${rival.bot?(cs?'bot':'bot'):(cs?'nahraný souboj skutečného hráče':'recorded battle of a real player')}</div>
        ${win?`<div style="background:#f0fbe8;border-radius:12px;padding:10px;font-weight:900;color:#2d7a2d;margin-bottom:12px">+${reward} 🌱</div>`
             :`<div style="font-size:13px;color:#999;margin-bottom:12px">${cs?'Vstupné propadlo. Zkus to znovu!':'Entry lost. Try again!'}</div>`}
        ${newBadges.length?`<div style="font-size:13px;font-weight:800;color:#c8860a;margin-bottom:12px">🏅 ${newBadges.join(' · ')}</div>`:''}
        ${review}
        <div style="font-size:12px;color:#999;margin-bottom:14px">🏆 ${s.wins} · ${cs?'série':'streak'} ${s.streak} (${cs?'nej':'best'} ${s.bestStreak})</div>
        <button id="battleAgain" style="width:100%;padding:13px;border:none;border-radius:14px;background:linear-gradient(135deg,#d2603a,#b0402a);color:#fff;font-family:inherit;font-weight:900;font-size:15px;cursor:pointer;margin-bottom:8px">${cs?'Znovu ⚔️':'Again ⚔️'}</button>
        <button id="battleBoard" style="width:100%;padding:11px;border:none;border-radius:14px;background:#f0f0f0;color:#555;font-family:inherit;font-weight:800;font-size:14px;cursor:pointer;margin-bottom:8px">🏆 ${cs?'Žebříček':'Leaderboard'}</button>
        <button id="battleClose" style="width:100%;padding:11px;border:none;background:none;color:#999;font-family:inherit;font-weight:700;font-size:13px;cursor:pointer">${cs?'Zpět do zahrady':'Back to garden'}</button>
      </div>`;
    document.body.appendChild(ov);
    drawFighter(ov.querySelector('#brSprite'), this._me.arch, this._me.stage, { mood: win ? 'happy' : 'sad', shiny: this._me.shiny, acc: Skins.getAccessory(p.id) });
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
