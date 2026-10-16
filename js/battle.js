// ═══════════════════════════════════
//  GREAM — battle.js  (Souboje 1.1: aréna greamíků)
//  10 časově omezených otázek. Správná odpověď = útok tvého greamíka (životy 100),
//  energie za správné odpovědi → speciál. Pravidla: battle-rules.js, vzhled: arena.js.
//  Soupeř = nahraný souboj jiného hráče (server přehraje jeho odpovědi a časy) nebo bot.
//  Greamík z odpovídajícího světa → delší čas. Vstup stojí 1/4 výhry (venku 1/8).
// ═══════════════════════════════════

import { shuffle } from './shuffle.js';
import { tr, getLang } from './i18n.js';
import { Profiles } from './profiles.js';
import { Gream, ARCHETYPES, EVOLUTION_TASKS } from './gream.js';
import { Skins } from './skins.js';
import { Subscription, FREE } from './subscription.js';
import { Paywall } from './paywall.js';
import { Feedback } from './feedback.js';
import { Audio } from './audio.js';
import { Net, challengeId } from './net.js';
import { RULES, SPECIALS, ARCH_WORLD, ARCH_GROUP, GROUP_IDS, GROUP_WORLD, ARCHES, BASE_ARCHES, domainWeightFor, newFighter, useSpecial, canSpecial, aiWantsSpecial, resolveRound, winner } from './battle-rules.js';
import { Arena, drawFighter } from './arena.js';
import { factFor } from './facts.js';
import { numTolerance } from './validator.js';
import { subcatOf, groupOf } from './subcats.js';
import { Playtime } from './parents.js';
const ARCHETYPE_NAME = (a) => ARCHETYPES[a]?.name?.[getLang() === 'cs' ? 'cs' : 'en'] || a;

const WORLDS = ['nature','language','logic','feelings','arts','world'];
const WORLD_ICONS = { nature:'🌿', language:'📖', logic:'🧩', feelings:'💛', arts:'🎨', world:'🌍' };

const ROUNDS = 10;
const BASE_TIME_MS = 11000;                 // base time per question
const MATCH_BONUS_MS = 3000;                // matching-world Gream present
const MATCH_EVOLVED_BONUS_MS = 2000;        // + if that Gream is stage >= 3
const BOT_ACC = { easy:0.55, medium:0.65, hard:0.72, extreme:0.78 };
const WIN_REWARD = { easy:5, medium:8, hard:12, extreme:18 };  // seeds on win
// Denní strop: plnou odměnu dávají jen první výhry dne, pak čtvrtina (min. 1) – souboje se nedají „farmit“ na semínka
export const FULL_REWARD_WINS = 5;
// Bot podle hráče: přesnost bota sleduje hráčovu průměrnou úspěšnost v soubojích (klouzavý průměr),
// o trochu níž → hráč vyhrává zhruba 50–60 %. Meze kolem výchozí přesnosti obtížnosti.
const BOT_EDGE = 0.04, BOT_MIN = 0.4, BOT_MAX = 0.93, SKILL_ALPHA = 0.3;
const KEY_STATS = 'gream_battle_stats';
// 1 = otázka z mého světa (Super účinné), 0.5 = týká se mého světa zčásti přes podkategorii (Účinné), 0 = jinak
// Greamíci podkategorií: 1 = jejich podkategorie, 0.5 = zbytek jejich světa (pravidla v battle-rules.js domainWeightFor)
const CH_DIFF = new WeakMap();   // otázka → obtížnost, ze které pochází (souboj si může půjčit sousední)
function domainFor(arch, world, ch, diff) {
  const g = ch?.text ? groupOf(world, CH_DIFF.get(ch) || diff, ch.text, getLang()) : null;
  return domainWeightFor(arch, { world, group: g?.group || null, side: g?.side || null });
}
// Otázky jedné skupiny pro obtížnost (souboj losuje skupinu rovnoměrně → žádný greamík není zvýhodněn velikostí svého tématu)
function groupPool(group, difficulty) {
  const t = tr(), lang = getLang(), out = [];
  for (const world of WORLDS) for (const c of t.challenges?.[world]?.[difficulty] || [])
    if (battleUsable(c) && groupOf(world, difficulty, c.text, lang)?.group === group) { CH_DIFF.set(c, difficulty); out.push({ world, ch: c }); }
  return out;
}
// Má-li skupina na dané obtížnosti málo otázek (např. Věda nemá žádnou lehkou), přibere se nejbližší obtížnost –
// jinak by její greamík v lehkém souboji nikdy nedostal „Super účinné“
const NEAR_DIFF = { easy: ['medium', 'hard'], medium: ['easy', 'hard'], hard: ['medium', 'extreme'], extreme: ['hard', 'medium'] };
const _gpCache = new Map();
function groupPoolCached(group, difficulty) {
  const k = getLang() + group + difficulty;
  if (!_gpCache.has(k)) {
    let pool = groupPool(group, difficulty);
    for (const d of NEAR_DIFF[difficulty] || []) { if (pool.length >= 8) break; pool = pool.concat(groupPool(group, d)); }
    _gpCache.set(k, pool);
  }
  return _gpCache.get(k);
}
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
  const list = Gream.all(pid).filter(g => g.stage >= 2 && g.archetype && ARCH_WORLD[g.archetype] === world);   // i greamíci podkategorií ze stejného světa
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
// Tematický balíček (pole `pack` u otázky): všechny světy, nejdřív zvolená obtížnost, pak sousední
export const PACKS = ['film_hudba', 'sport', 'historie', 'cesko', 'veda', 'jidlo'];
const DIFF_NEAR = { easy: ['easy', 'medium', 'hard', 'extreme'], medium: ['medium', 'hard', 'easy', 'extreme'], hard: ['hard', 'medium', 'extreme', 'easy'], extreme: ['extreme', 'hard', 'medium', 'easy'] };
export function packPool(pack, difficulty) {
  const t = tr(), out = [];
  for (const d of DIFF_NEAR[difficulty] || DIFF_NEAR.medium)
    for (const [world, byD] of Object.entries(t.challenges || {}))
      for (const c of byD?.[d] || []) if (c.pack === pack && battleUsable(c)) out.push({ world, ch: c, d });
  return out;
}

function pickQuestions(difficulty, rng, pack) {
  const t = tr();
  const rand = rng || Math.random;
  if (pack) {
    const pool = packPool(pack, difficulty);
    const exact = shuffle(pool.filter(x => x.d === difficulty), rand);
    const rest = pool.filter(x => x.d !== difficulty);   // už seřazené podle blízkosti obtížnosti
    return [...exact, ...rest].slice(0, ROUNDS).map(({ world, ch }) => ({ world, ch }));
  }
  // 10 různých skupin (z 24) náhodně, z každé jedna otázka; prázdná skupina na této obtížnosti → zkusí se další
  const out = [], usedText = new Set();
  const bag = [...GROUP_IDS];   // Fisher–Yates (sort s náhodou míchá zaujatě a zvýhodňuje první skupiny)
  for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; }
  for (const g of bag) {
    const pool = groupPoolCached(g, difficulty).filter(x => !usedText.has(x.ch.text));
    if (!pool.length) continue;
    const x = pool[Math.floor(rand() * pool.length)];
    usedText.add(x.ch.text); out.push({ ...x, group: g });
    if (out.length >= ROUNDS) break;
  }
  if (out.length < ROUNDS) for (const world of WORLDS) for (const c of t.challenges?.[world]?.[difficulty] || []) {   // pojistka
    if (out.length >= ROUNDS) break;
    if (battleUsable(c) && !usedText.has(c.text)) { usedText.add(c.text); out.push({ world, ch: c }); }
  }
  return out;   // pořadí je už náhodné (bag)
}

const todayISO = () => new Date().toISOString().slice(0, 10);
const LEAGUE_ICON = { bronze: '🥉', silver: '🥈', gold: '🥇', diamond: '💎' };
const TIERS_ORDER = ['bronze', 'silver', 'gold', 'diamond'];
const escHtml = (x) => String(x ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const Battle = {
  _q: [], _i: 0, _pScore: 0, _bScore: 0, _diff: 'medium', _outdoor: false, _timer: null, _entry: 0, _reward: 0,

  // ─── Intro overlay: advantages, difficulty, entry/reward, start ───
  intro(opts = {}) {
    const p = Profiles.active(); if (!p) return;
    if (!Playtime.allow(p.id, () => this.intro(opts))) return;   // denní limit od rodiče
    if (!Gream.all(p.id).some(g => g.stage >= 2 && g.archetype)) return this._lockedNoGream(p);   // souboj až s vylíhnutým greamíkem
    const cs = getLang() === 'cs';
    const outdoor = !!opts.outdoor;
    const stats = loadStats(p.id);
    // Gream Plus: zdarma 1 souboj denně (doma i venku), lehká + střední, bez balíčků, ligy a rodinného souboje
    const plus = Subscription.isPremium(), limited = Subscription.paywallEnabled() && !plus;

    const hatched = Gream.all(p.id).filter(g => g.stage >= 2 && g.archetype);
    const worldsCovered = [...new Set(hatched.map(g => ARCH_WORLD[g.archetype]))].filter(Boolean);

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

        <button id="battleLeague" class="league-chip" hidden></button>
        <div style="font-size:12px;font-weight:800;color:#888;margin-bottom:6px">${tr().battle_pick}</div>
        ${hatched.length ? '' : `<div style="font-size:11px;color:#999;margin-bottom:6px">${tr().battle_loan_note}</div>`}
        <div class="bt-pick" id="battlePick"></div>
        <div class="bt-skill" id="battleSkill"></div>
        <div style="font-size:12px;font-weight:800;color:#888;margin-bottom:6px">${tr().pack_title}</div>
        <div id="battlePackRow" class="bt-packs"></div>
        <div style="font-size:12px;font-weight:800;color:#888;margin-bottom:6px">${cs?'Obtížnost':'Difficulty'}</div>
        <div id="battleDiffRow" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px"></div>

        <div id="battleEconInfo" style="font-size:12px;color:#777;text-align:center;margin-bottom:6px"></div>
        <div id="battleDailyInfo" style="font-size:11px;color:#aaa;text-align:center;margin-bottom:12px"></div>

        <button id="battleStartBtn" style="width:100%;padding:15px;border:none;border-radius:15px;background:linear-gradient(135deg,#d2603a,#b0402a);color:#fff;font-family:inherit;font-weight:900;font-size:16px;cursor:pointer;margin-bottom:8px">${cs?'Zahájit souboj ⚔️':'Start battle ⚔️'}</button>
        <button id="battleFamilyBtn" style="width:100%;padding:12px;border:2px solid #f5a623;border-radius:14px;background:#fff9e6;color:#8a5a00;font-family:inherit;font-weight:800;font-size:14px;cursor:pointer;margin-bottom:8px">👨‍👩‍👧 ${tr().family_btn}</button>
        <button id="battleDailyBtn" style="width:100%;padding:12px;border:2px solid var(--green-mid);border-radius:14px;background:#fff;color:var(--green-deep);font-family:inherit;font-weight:800;font-size:14px;cursor:pointer;margin-bottom:8px">📅 ${cs?'Denní kolo (stejné pro všechny)':'Daily round (same for all)'}</button>
        <button onclick="document.getElementById('battleOverlay').remove()" style="width:100%;padding:10px;border:none;background:none;color:#999;font-family:inherit;font-weight:700;font-size:13px;cursor:pointer">${cs?'Zavřít':'Close'}</button>
        <div style="text-align:center;font-size:11px;color:#bbb;margin-top:8px">🏆 ${cs?'Výhry':'Wins'}: ${stats.wins||0} · ${cs?'série':'streak'}: ${stats.streak||0}</div>
      </div>`;
    document.body.appendChild(ov);

    let sel = ['medium'];
    // Téma (balíček) – pamatuje se pro profil
    const packKey = 'gream_battle_pack_' + p.id;
    let pack = ''; try { pack = localStorage.getItem(packKey) || ''; } catch {}
    if ((pack && !PACKS.includes(pack)) || !plus) pack = '';
    const packRow = ov.querySelector('#battlePackRow');
    const paintPacks = () => {
      packRow.innerHTML = '';
      ['', ...PACKS].forEach(k => {
        const b = document.createElement('button');
        b.className = 'bt-pack' + (k === pack ? ' on' : '');
        b.textContent = tr().pack_names[k || 'all'];
        if (k && !plus) b.textContent = '🔒 ' + b.textContent;
        b.onclick = () => { if (k && !plus) { Paywall.open('pack'); return; } pack = k; try { localStorage.setItem(packKey, k); } catch {} paintPacks(); };
        packRow.appendChild(b);
      });
    };
    paintPacks();
    this._packSel = () => pack;
    const row = ov.querySelector('#battleDiffRow');
    const econ = ov.querySelector('#battleEconInfo');
    const daily = ov.querySelector('#battleDailyInfo');
    const startBtn = ov.querySelector('#battleStartBtn');

    const refresh = () => {
      const diff = sel[0];
      const { reward, entry } = this.economy(diff, outdoor);
      const seeds = Skins.getSeeds(p.id);
      const fullLeft = Math.max(0, FULL_REWARD_WINS - this.winsToday(p.id));
      const winR = fullLeft ? reward : Math.max(1, Math.round(reward / 4));
      econ.textContent = (cs
        ? `Vstup ${entry} 🌱 · výhra +${winR} 🌱 (máš ${seeds})`
        : `Entry ${entry} 🌱 · win +${winR} 🌱 (you have ${seeds})`) + ' · ' + (fullLeft ? tr().battle_full_left(fullLeft) : tr().battle_full_none);
      let blocked = false, reason = '';
      startBtn._paywall = '';
      if (!Subscription.difficultyAllowed(diff)) { blocked = true; reason = '🔒 ' + tr().plus_reason.difficulty; startBtn._paywall = 'difficulty'; }
      else if (!Subscription.canStartBattle().allowed) { blocked = true; reason = '🔒 ' + tr().plus_reason.battle; startBtn._paywall = 'battle'; }
      else if (seeds < entry) { blocked = true; reason = cs?`Potřebuješ ${entry} 🌱`:`You need ${entry} 🌱`; }
      daily.textContent = limited ? tr().plus_battles_left(Math.min(Subscription.getBattlesToday(), FREE.battles), FREE.battles) : '';
      startBtn.disabled = blocked && !startBtn._paywall;   // zamčené Gream Plus → klepnutí ukáže nabídku
      startBtn.style.opacity = blocked ? '0.5' : '1';
      startBtn.style.cursor = startBtn.disabled ? 'default' : 'pointer';
      startBtn.textContent = blocked ? reason : (cs?`Zahájit (−${entry} 🌱) ⚔️`:`Start (−${entry} 🌱) ⚔️`);
      startBtn._entry = entry; startBtn._reward = reward; startBtn._diff = diff;
    };
    DIFFS.forEach(d => {
      const active = sel[0] === d.id;
      const b = document.createElement('button');
      b.style.cssText = `padding:11px;border-radius:12px;border:2px solid ${active?'var(--green-mid)':'rgba(0,0,0,0.1)'};background:${active?'var(--green-pale)':'#fff'};font-family:inherit;font-weight:800;font-size:13px;cursor:pointer;color:var(--green-deep)`;
      b.textContent = `${Subscription.difficultyAllowed(d.id) ? d.emoji : '🔒'} ${cs?d.cs:d.en}`;
      b.onclick = () => { sel[0] = d.id; row.querySelectorAll('button').forEach((x,i)=>{ const on=DIFFS[i].id===d.id; x.style.borderColor=on?'var(--green-mid)':'rgba(0,0,0,0.1)'; x.style.background=on?'var(--green-pale)':'#fff'; }); refresh(); };
      row.appendChild(b);
    });
    refresh();

    // Výběr greamíka: vylíhnutí (stádium ≥ 2), jinak všech šest „na zkoušku“
    const roster = hatched.length
      ? hatched.map(g => ({ arch: g.archetype, stage: g.stage, shiny: !!g.isShiny, id: g.id, name: g.name }))
      : BASE_ARCHES.map(a => ({ arch: a, stage: 2, loan: true }));
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
      requestAnimationFrame(() => drawFighter(b.querySelector('canvas'), r.arch, r.stage, { shiny: r.shiny }));
    });
    showSkill();

    startBtn.onclick = () => {
      if (startBtn._paywall) { Paywall.open(startBtn._paywall); return; }
      if (startBtn.disabled) return;
      this._spot = opts.spot || null;
      this._start(startBtn._diff, outdoor, startBtn._entry, startBtn._reward, pick);
    };
    ov.querySelector('#battleDailyBtn').onclick = () => this.daily(pick);
    const famBtn = ov.querySelector('#battleFamilyBtn');
    if (!plus) famBtn.textContent = '🔒 ' + famBtn.textContent;
    famBtn.onclick = () => plus ? this.familySetup(pick, sel[0]) : Paywall.open('family');
    // Liga: štítek + po novém týdnu oznámení o postupu/sestupu (jednou)
    Net.league(p.id).then(L => {
      if (!L || !document.getElementById('battleLeague')) return;
      const chip = ov.querySelector('#battleLeague'), t = tr();
      chip.hidden = false;
      chip.innerHTML = `${LEAGUE_ICON[L.tier]} <b>${t.league_name[L.tier]}</b> · ${L.me ? `${L.me.pts} ${t.league_pts} · ${L.me.rank}.` : t.league_none}`;
      chip.onclick = () => plus ? this.showLeague(L) : Paywall.open('league');
      this._leagueNews(L);
    });
  },

  // Bez vylíhnutého greamíka se nebojuje: ukázat, kolik výzev vajíčku chybí
  _lockedNoGream(p) {
    const t = tr(), egg = Gream.all(p.id).find(g => g.stage < 2 || !g.archetype);
    const left = Math.max(1, EVOLUTION_TASKS[2] - (egg?.tasksFor || 0));
    document.getElementById('battleOverlay')?.remove();
    const ov = document.createElement('div'); ov.id = 'battleOverlay'; ov.className = 'pg-overlay';
    ov.innerHTML = `<div class="pg-card anim-pop"><div style="font-size:44px">🥚⚔️</div>
      <div class="pg-title">${escHtml(t.battle_need_gream_title)}</div>
      <div class="pg-reason">${escHtml(t.battle_need_gream(left))}</div>
      <button class="btn-primary">${escHtml(t.battle_need_gream_ok)}</button></div>`;
    ov.onclick = e => { if (e.target === ov) ov.remove(); };
    ov.querySelector('button').onclick = () => ov.remove();
    document.body.appendChild(ov);
  },

  _start(diff, outdoor, entry, reward, pick) {
    const p = Profiles.active(); if (!p) return;
    if (!Subscription.canStartBattle().allowed) { Paywall.open('battle'); return; }
    if (!Skins.spendSeeds(p.id, entry)) return;
    Subscription.recordBattle();   // denní počítadlo (zdarma 1 souboj denně)
    this._daily = false;
    this._diff = diff; this._outdoor = outdoor; this._entry = entry; this._reward = reward;
    this._pack = this._packSel?.() || '';
    this._q = pickQuestions(diff, null, this._pack);
    document.getElementById('battleOverlay')?.remove();
    // Hned lokální soupeř (hra nikdy nečeká na síť); skutečný nahraný hráč ze serveru ho nahradí, pokud dorazí do 1,5 s
    this._rival = this._localRival(diff, Math.random, this.botAccFor(p.id, diff));
    const myRating = loadStats(p.id).rating || 1000;
    const fromServer = Net.battleOpponent(diff, myRating, p.id).then(o => { if (o && !o.bot && Array.isArray(o.answers) && o.answers.length >= 5 && ARCHES.includes(o.arch)) this._rival = { ...o, stage: o.stage || 2 }; });   // bez nahrávky (starší souboj) zůstává bot – nepřebírat jméno skutečného hráče
    // Hledání soupeře: nahrávka hráče ze stejné ligy a obtížnosti; server čekáme nejdéle 10 s (slabý signál venku), pak bot
    const look = document.createElement('div'); look.className = 'pg-overlay bt-search';
    look.innerHTML = `<div class="pg-card"><div class="bt-search-dots"><span></span><span></span><span></span></div><div class="pg-title">${escHtml(tr().battle_searching)}</div></div>`;
    document.body.appendChild(look);
    const shown = Date.now();
    Promise.race([fromServer, new Promise(r => setTimeout(r, 10000))])
      .then(() => new Promise(r => setTimeout(r, Math.max(0, 700 - (Date.now() - shown)))))   // ať hledání neprobliká
      .then(() => { look.remove(); this._run(pick); });
  },

  // Bot: přesnost podle obtížnosti, časy odpovědí náhodně (rychlejší, když ví)
  // Přesnost bota pro hráče: klouzavý průměr jeho správných odpovědí v soubojích na dané obtížnosti
  botAccFor(pid, diff) {
    const base = BOT_ACC[diff] || 0.65;
    const sk = loadStats(pid).skill?.[diff];
    if (sk == null) return base;
    return Math.min(BOT_MAX, Math.max(BOT_MIN, Math.max(base - 0.15, sk - BOT_EDGE)));
  },
  _recordSkill(pid, diff, correct) {
    const s = loadStats(pid); s.skill = s.skill || {};
    const prev = s.skill[diff] ?? (BOT_ACC[diff] || 0.65);
    s.skill[diff] = Math.round((prev * (1 - SKILL_ALPHA) + (correct / ROUNDS) * SKILL_ALPHA) * 1000) / 1000;
    saveStats(pid, s);
  },
  // Kolikátá výhra dne (pro denní strop odměny)
  winsToday(pid) { const s = loadStats(pid); return s.winDay === today() ? (s.winsToday || 0) : 0; },
  _botName(rng = Math.random) {
    const t = tr(), a = t.bot_adj || ['Gream'], n = t.bot_noun || ['Bot'];
    return `${a[Math.floor(rng() * a.length)]} ${n[Math.floor(rng() * n.length)]}`;
  },

  _localRival(diff, rng = Math.random, acc = BOT_ACC[diff] || 0.65) {
    const answers = Array.from({ length: ROUNDS }, () => {
      const knows = rng() < acc;
      const ok = knows || rng() < 1 / 3;
      return { ok, ms: Math.round(ok && knows ? 1800 + rng() * 5500 : 5000 + rng() * 5500) };
    });
    const arch = ARCHES[Math.floor(rng() * ARCHES.length)];
    return { name: `🤖 ${this._botName(rng)}`, arch, stage: 2 + Math.floor(rng() * 3), answers, rating: 1000, bot: true };
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
    this._daily = true; this._diff = 'medium'; this._outdoor = false; this._reward = 0; this._pack = '';
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

  // ─── Rodinný souboj: dva hráči na jednom telefonu (bez vstupného a bez serveru) ───
  familySetup(pick1, diff = 'medium') {
    const p = Profiles.active(); if (!p) return;
    const t = tr();
    const fighterOf = (pid) => {
      const g = pid ? Gream.all(pid).find(x => x.stage >= 2 && x.archetype) : null;
      return g ? { arch: g.archetype, stage: g.stage, shiny: !!g.isShiny } : { arch: ARCHES[Math.floor(Math.random() * ARCHES.length)], stage: 2, loan: true };
    };
    const others = Profiles.all().filter(x => x.id !== p.id);
    document.getElementById('battleOverlay')?.remove();
    const ov = document.createElement('div');
    ov.id = 'battleOverlay';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(10,10,15,0.75);display:flex;align-items:center;justify-content:center;z-index:1000;padding:18px';
    ov.innerHTML = `<div style="background:#fff;border-radius:22px;max-width:360px;width:100%;padding:22px 20px;max-height:86vh;overflow-y:auto">
      <div style="text-align:center;font-size:20px;font-weight:900;color:var(--green-deep)">👨‍👩‍👧 ${t.family_title}</div>
      <div style="text-align:center;font-size:12px;color:#888;margin:4px 0 14px;line-height:1.4">${t.family_how}</div>
      <div style="font-size:12px;font-weight:800;color:#888;margin-bottom:6px">${t.family_second}</div>
      <div id="famList" style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px"></div>
      <input id="famGuest" maxlength="16" placeholder="${t.family_guest_ph}" style="width:100%;padding:12px;border-radius:12px;border:2px solid var(--line);font-family:inherit;font-weight:800;font-size:15px;margin-bottom:14px;box-sizing:border-box">
      <button id="famStart" class="btn-primary" style="width:100%;margin-bottom:8px">${t.family_start}</button>
      <button onclick="document.getElementById('battleOverlay').remove()" style="width:100%;padding:10px;border:none;background:none;color:#999;font-family:inherit;font-weight:700;font-size:13px;cursor:pointer">${getLang() === 'cs' ? 'Zavřít' : 'Close'}</button>
    </div>`;
    document.body.appendChild(ov);
    let second = others[0] ? others[0].id : null;
    const list = ov.querySelector('#famList'), guest = ov.querySelector('#famGuest');
    const paint = () => list.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.id === String(second)));
    [...others, { id: '', name: t.family_guest }].forEach(o => {
      const b = document.createElement('button');
      b.className = 'shop-item'; b.style.cssText = 'flex-direction:row;justify-content:flex-start;gap:10px;padding:10px 12px';
      b.dataset.id = o.id; b.innerHTML = `<span style="font-size:22px">${o.avatar || '🙂'}</span><span class="shop-name" style="font-size:14px">${escHtml(o.name)}</span>`;
      b.onclick = () => { second = o.id || ''; guest.style.display = o.id ? 'none' : ''; paint(); };
      list.appendChild(b);
    });
    guest.style.display = second ? 'none' : '';
    if (second === null) second = '';
    paint();
    ov.querySelector('#famStart').onclick = () => {
      const p2 = second ? Profiles.all().find(x => x.id === second) : null;
      const name2 = p2 ? p2.name : (guest.value.trim() || t.family_guest);
      const f2 = fighterOf(p2?.id);
      this._family = { names: [p.name || t.battle_you, name2], pids: [p.id, p2?.id || null] };
      this._daily = false; this._diff = Subscription.difficultyAllowed(diff) ? diff : 'medium'; this._outdoor = false; this._reward = 0; this._entry = 0;
      this._pack = this._packSel?.() || '';
      this._q = pickQuestions(this._diff, null, this._pack);
      this._rival = { ...f2, name: name2, bot: false, family: true };
      ov.remove();
      this._run(pick1 || fighterOf(p.id));
    };
  },

  // Předání telefonu: schová otázku, dokud se nepřihlásí hráč na řadě
  _handOver(side, round) {
    const scr = document.getElementById('battleRound'); if (!scr) return Promise.resolve();
    const t = tr();
    return new Promise(res => {
      const ov = document.createElement('div');
      ov.className = 'family-hand';
      ov.innerHTML = `<div><div style="font-size:42px">📱</div><div class="fh-title">${t.family_turn}</div><div class="fh-name">${escHtml(this._family.names[side])}</div>
        <div style="font-size:12px;opacity:.8;margin-bottom:14px">${t.battle_round} ${round + 1}/${ROUNDS}</div><button class="btn-primary">${t.family_ready}</button></div>`;
      ov.querySelector('button').onclick = () => { ov.remove(); res(); };
      scr.appendChild(ov);
    });
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
      me: { ...pick, name: `${this._family ? this._family.names[0] : t.battle_you} · ${pick.name || ARCHETYPE_NAME(pick.arch)}` },
      op: { arch: rival.arch, stage: rival.stage, shiny: !!rival.shiny, name: `${rival.name} · ${ARCHETYPE_NAME(rival.arch)}` },
      labels: { energy: t.battle_energy, superEffective: t.battle_super_eff, effective: t.battle_half_eff, crit: t.battle_crit },
    });
    this._arena.update(this._f);
    // Odpočet: otázka a časomíra se ukážou až po „Souboj!“
    const panel = [...scr.querySelectorAll('.bt-top, .bt-time, .bt-q, .bt-choices, .bt-report')];
    panel.forEach(el => { el.style.visibility = 'hidden'; });
    await this._arena.countdown(t.battle_go, (txt) => { try { txt === t.battle_go ? Feedback.success?.() : Feedback.tap?.(); } catch {} });
    panel.forEach(el => { el.style.visibility = ''; });

    for (let round = 0; round < ROUNDS && round < this._q.length; round++) {
      const f = this._f;
      // Soupeř (bot/nahrávka) se rozhodne pro speciál na začátku kola; v rodinném souboji rozhoduje člověk
      if (!this._family && aiWantsSpecial(f[1])) {
        const ev = useSpecial(f[1], f[0]);
        await this._arena.special(1, ev, t.battle_special[ev.id].name);
        this._arena.update(f);
        if (f[0].hp <= 0) break;
      }
      let mine, opp;
      if (this._family) {
        await this._handOver(0, round);
        mine = await this._askQuestion(round, 0);
        if (f[1].hp <= 0) { opp = { ok: false }; }
        else { await this._handOver(1, round); opp = await this._askQuestion(round, 1); }
      } else {
        mine = await this._askQuestion(round, 0);
        opp = this._oppAnswer(round);
      }
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
    const domain = f1.ownWorldNext ? 1 : domainFor(f1.arch, qWorld, this._curCh, this._daily ? 'medium' : this._diff);
    const ok = a.ok || (f1.fiftyNext && !a.ok && Math.random() < 0.25);   // 50:50 pomůže i soupeři
    f1.fiftyNext = false; f1.ownWorldNext = false;
    if (ok) this._correct[1]++;
    return { ok, domain, speedFrac: ok ? Math.max(0, 1 - a.ms / BASE_TIME_MS) : 0 };
  },

  // Otázka kola: vrací { ok, domain, speedFrac }. Hráč může před odpovědí použít speciál.
  _askQuestion(round, side = 0) {
    const p = Profiles.active();
    const t = tr(), cs = getLang() === 'cs';
    const scr = document.getElementById('battleRound');
    let { world, ch } = this._q[round];
    const me = this._f[side], foe = this._f[1 - side];
    return new Promise((resolve) => {
      const pid = this._family ? this._family.pids[side] : p.id;
      let answered = false, start = Date.now(), timeMs = BASE_TIME_MS + (pid ? timeBonusForWorld(pid, world) : 0), paused = 0;
      const elQ = scr.querySelector('#btQ'), elC = scr.querySelector('#btChoices'), bar = scr.querySelector('#btTime');
      const spBtn = scr.querySelector('#btSpecial');
      scr.querySelector('#btRound').textContent = `⚔️ ${t.battle_round} ${round + 1}/${ROUNDS}${this._family ? ` · ${this._family.names[side]}` : ''}`;
      const opCard = scr.querySelector('.ar-op .ar-card'); opCard?.classList.remove('answered');
      const oppMs = side === 0 && !this._family ? this._rival.answers?.[round]?.ms : null;
      const oppTimer = oppMs ? setTimeout(() => opCard?.classList.add('answered'), oppMs) : null;

      const render = () => {
        this._curWorld = world; this._curCh = ch;
        const bonus = timeMs - BASE_TIME_MS;
        const dom = me.ownWorldNext ? 1 : domainFor(me.arch, world, ch, this._daily ? 'medium' : this._diff);
        scr.querySelector('#btWorld').textContent = `${WORLD_ICONS[world]} ${t.worlds?.[world] || world}${bonus > 0 ? ` · +${Math.round(bonus / 1000)} s` : ''}${dom >= 1 ? ` · ${t.battle_super_eff}` : dom > 0 ? ` · ${t.battle_half_eff}` : ''}`;
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
          const shuffled = shuffle(ch.choices);
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
        const ev = useSpecial(me, foe);
        Audio.playCry?.(me.arch, side === 0 ? this._me.stage : this._rival.stage);
        // Kompas a spol.: příští otázka z mé skupiny (v tematickém balíčku otázka zůstává, bonus platí)
        if (me.ownWorldNext && !this._pack) {
          const pool = groupPoolCached(ARCH_GROUP[me.arch], this._daily ? 'medium' : this._diff);
          const x = pool[Math.floor(Math.random() * pool.length)];
          if (x) { world = x.world; ch = x.ch; }   // jen pro tohoto hráče
        }
        await this._arena.special(side, ev, t.battle_special[ev.id].name);
        this._arena.update(this._f);
        paused += Date.now() - pauseStart;
        if (!answered) render();
        if (foe.hp <= 0) done(false, null, true);
      };

      const done = (ok, correctText, ko = false) => {
        if (answered) return; answered = true;
        clearInterval(this._timer); clearTimeout(oppTimer);
        spBtn.hidden = true;
        elC.querySelectorAll('button').forEach(b => { b.disabled = true; if (!ok && b.dataset.right) b.classList.add('ok'); });
        const left = Math.max(0, 1 - (Date.now() - start - paused) / timeMs);
        const domain = me.ownWorldNext ? 1 : domainFor(me.arch, world, ch, this._daily ? 'medium' : this._diff);
        me.fiftyNext = false; me.ownWorldNext = false;
        if (ok) { this._correct[side]++; Feedback.success?.(); } else if (!ko) { Feedback.error?.(); if (side === 0 || this._family) this._missed.push({ q: ch.text, a: correctText, world, diff: this._daily ? 'medium' : this._diff, ch, who: this._family?.names[side] }); }
        if (side === 0) this._log.push({ ok: !!ok, ms: Math.round(Date.now() - start - paused) });
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
      <div class="bt-review">${this._missed.map(m => `<div>${m.who ? `<b>${escHtml(m.who)}:</b> ` : ''}${escHtml(m.q)}${m.a ? `<br><b>${t.battle_correct_is}${escHtml(m.a)}</b>` : ''}${(() => { const f = factFor(m.world, m.diff, m.ch); return f ? `<br><span style="color:#b07800">💡 ${escHtml(f.text)}</span>` : ''; })()}</div>`).join('')}</div>` : '';

    if (this._family) {
      const fam = this._family; this._family = null;
      const winName = fam.names[win ? 0 : 1];
      // Malá odměna: vítěz 3 🌱, druhý 1 🌱 (jen skutečné profily)
      fam.pids.forEach((pid, i) => { if (pid) Skins.addSeeds(pid, (win ? i === 0 : i === 1) ? 3 : 1); });
      Feedback.celebrate?.();
      const ov = document.createElement('div');
      ov.id = 'battleResult';
      ov.style.cssText = 'position:fixed;inset:0;background:rgba(10,10,15,0.85);display:flex;align-items:center;justify-content:center;z-index:1002;padding:18px';
      ov.innerHTML = `<div style="background:#fff;border-radius:22px;max-width:360px;width:100%;padding:22px 20px;text-align:center;max-height:90vh;overflow-y:auto">
        <div style="font-size:40px">🏆</div>
        <div style="font-size:22px;font-weight:900;color:#2d7a2d">${escHtml(t.family_winner(winName))}</div>
        <div style="font-size:14px;font-weight:800;color:#555;margin:6px 0 12px">✓ ${escHtml(fam.names[0])} ${this._correct[0]} — ${this._correct[1]} ${escHtml(fam.names[1])}</div>
        ${review}
        <button id="battleAgain" class="btn-primary" style="width:100%;margin-bottom:8px">${t.family_again}</button>
        <button id="battleClose" style="width:100%;padding:11px;border:none;background:none;color:#999;font-family:inherit;font-weight:700;font-size:13px;cursor:pointer">${cs?'Zpět do zahrady':'Back to garden'}</button></div>`;
      document.body.appendChild(ov);
      ov.querySelector('#battleAgain').onclick = () => { ov.remove(); this.familySetup(this._me, this._diff); };
      ov.querySelector('#battleClose').onclick = () => { ov.remove(); Audio.switchScene?.('menu'); try { window.App?.renderMap?.(); } catch {} };
      return;
    }

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
    this._recordSkill(p.id, this._diff, myCorrect);
    let reward = 0;
    if (win) {
      const n = this.winsToday(p.id);
      reward = n < FULL_REWARD_WINS ? this._reward : Math.max(1, Math.round(this._reward / 4));
      const st = loadStats(p.id); st.winDay = today(); st.winsToday = n + 1; saveStats(p.id, st);
      Skins.addSeeds(p.id, reward); Feedback.celebrate?.();
    }
    else Feedback.error?.();
    const newBadges = this._checkBadges(p.id, s, win, this._diff);

    // Bitevní místo: výhra s lepším skóre (životy + 5 za správnou odpověď) místo převezme
    let spotMsg = '';
    if (win && this._spot && this._outdoor) {
      const score = Math.max(0, Math.round(this._f[0].hp)) + myCorrect * 5;
      let toks = []; try { toks = JSON.parse(localStorage.getItem('gream_spot_tokens') || '[]'); } catch {}
      const tok = Math.random().toString(36).slice(2, 12);
      const spotId = this._spot.id;
      Net.spotClaim({ id: spotId, arch: this._me.arch, stage: this._me.stage || 2, score, tok }).then(r => {
        if (r?.held) { toks.push(tok); try { localStorage.setItem('gream_spot_tokens', JSON.stringify(toks.slice(-200))); } catch {} window.App?._showToast?.(`👑 ${t.spot_won(score)}`); }
        else if (r) window.App?._showToast?.(t.spot_not_enough(score, r.best));
      });
    }
    this._spot = null;

    // Server: rating + nahrávka souboje (odpovědi a časy), aby ji mohli hrát ostatní jako soupeře
    Net.battleResult({
      pid: p.id, name: p.name || 'Hráč', difficulty: this._diff,
      score: myCorrect, oppScore: this._correct[1], win, oppRating: rival.rating || 1000,
      arch: this._me.arch, stage: this._me.stage || 2, answers: this._log.slice(0, ROUNDS), ko: win && this._f[1].hp <= 0,
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
        <div style="font-size:12px;font-weight:800;color:#8a5a00;margin-bottom:8px">${tr().league_gain((win ? 3 : 1) + (win && this._f[1].hp <= 0 ? 1 : 0))}</div>
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
    drawFighter(ov.querySelector('#brSprite'), this._me.arch, this._me.stage, { mood: win ? 'happy' : 'sad', shiny: this._me.shiny });
    ov.querySelector('#battleAgain').onclick = () => { ov.remove(); this.intro({ outdoor: this._outdoor }); };
    ov.querySelector('#battleBoard').onclick = () => this.showLeaderboard();
    ov.querySelector('#battleClose').onclick = () => { ov.remove(); Audio.switchScene?.('menu'); try { window.App?.renderMap?.(); } catch {} };
  },

  // ─── Týdenní liga ───
  showLeague(L) {
    const t = tr();
    document.getElementById('battleBoardOverlay')?.remove();
    const ov = document.createElement('div');
    ov.id = 'battleBoardOverlay';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(10,10,15,0.8);display:flex;align-items:center;justify-content:center;z-index:1004;padding:18px';
    ov.onclick = e => { if (e.target === ov) ov.remove(); };
    const days = Math.max(0, Math.ceil((L.endsAt - Date.now()) / 864e5));
    const rows = (L.top || []).map(r => {
      const zone = r.rank <= L.promote ? 'up' : (L.demote && r.rank > L.players - L.demote ? 'down' : '');
      return `<div class="lg-row ${zone}${r.me ? ' me' : ''}"><span>${r.rank}.</span><b>${escHtml(r.name)}</b><span>${r.pts} ${t.league_pts}</span></div>`;
    }).join('') || `<div style="color:#999;text-align:center;padding:10px">${t.league_empty}</div>`;
    ov.innerHTML = `<div style="background:#fff;border-radius:20px;max-width:340px;width:100%;padding:20px;max-height:82vh;overflow-y:auto">
      <div style="text-align:center;font-size:30px">${LEAGUE_ICON[L.tier]}</div>
      <div style="text-align:center;font-size:18px;font-weight:900;color:var(--green-deep)">${t.league_name[L.tier]}</div>
      <div style="text-align:center;font-size:12px;color:#888;margin:4px 0 12px;line-height:1.4">${t.league_how(days)}</div>
      ${rows}
      <div style="font-size:11px;color:#999;margin-top:10px;line-height:1.5"><span class="lg-dot up"></span> ${t.league_zone_up} &nbsp; <span class="lg-dot down"></span> ${t.league_zone_down}</div>
      <button onclick="document.getElementById('battleBoardOverlay').remove()" class="btn-primary" style="width:100%;margin-top:14px">${getLang() === 'cs' ? 'Zavřít' : 'Close'}</button></div>`;
    document.body.appendChild(ov);
  },

  // Jednou za týden: výsledek minulé ligy + odměna za postup
  _leagueNews(L) {
    const p = Profiles.active(); if (!p || !L?.last) return;
    const key = 'gream_league_seen_' + p.id;
    if (localStorage.getItem(key) === L.last.week) return;
    try { localStorage.setItem(key, L.last.week); } catch {}
    const t = tr(), up = TIERS_ORDER.indexOf(L.last.to) > TIERS_ORDER.indexOf(L.last.from), down = TIERS_ORDER.indexOf(L.last.to) < TIERS_ORDER.indexOf(L.last.from);
    const reward = up ? 20 : 5;
    Skins.addSeeds(p.id, reward);
    window.App?._showToast?.(`${LEAGUE_ICON[L.last.to]} ${up ? t.league_up(t.league_name[L.last.to]) : down ? t.league_down(t.league_name[L.last.to]) : t.league_stay(t.league_name[L.last.to])} +${reward} 🌱`);
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
export { pickQuestions };   // test rovnoměrného losování skupin (test/ui.mjs)
