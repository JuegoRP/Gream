// Gream — API server (Fáze 2). Bez závislostí (Node stdlib). Za Caddy /api/gream/* → strip_prefix.
// CORS povolené (Gream běží na GitHub Pages = jiný origin). Data: JSON soubory, atomický zápis.
//
// Endpoints (po strip_prefix /api/gream):
//   GET  /health
//   POST /report          {challengeId, world, difficulty, text, lang, reason, note, pid}
//   POST /battle/opponent {difficulty, rating}                 -> {name, score, rating, bot}
//   POST /battle/result   {pid, name, difficulty, score, oppScore, win, rating} -> {rating, rank}
//   GET  /battle/leaderboard?difficulty=medium                 -> [{name, rating, wins}]
//   POST /poi/done        {poiId}                              -> {count}
//   GET  /poi/counts?ids=a,b,c                                 -> {a:1,b:0,...}
const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT     = 8092;
const DATA_DIR = process.env.GREAM_DATA_DIR || '/data';
fs.mkdirSync(DATA_DIR, { recursive: true });
const F = (n) => path.join(DATA_DIR, n);

function loadJSON(file, fallback) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } }
const reports = loadJSON(F('reports.json'), []);
const battle  = loadJSON(F('battle.json'), { players: {}, runs: {} });     // runs: {diff: [{pid,name,score,rating,ts}]}
const poi     = loadJSON(F('poi.json'), {});
const daily   = loadJSON(F('daily.json'), {});                             // { 'YYYY-MM-DD': { pid: {name,score,ts} } }

// ─── Simple in-memory rate limiter (per IP): max BURST requests / WINDOW ms ───
const RL = new Map();
const RL_WINDOW = 10000, RL_BURST = 40;
function rateLimited(ip) {
  const now = Date.now();
  const arr = (RL.get(ip) || []).filter(t => now - t < RL_WINDOW);
  arr.push(now);
  RL.set(ip, arr);
  if (RL.size > 5000) for (const [k, v] of RL) if (!v.length || now - v[v.length - 1] > RL_WINDOW) RL.delete(k);
  return arr.length > RL_BURST;
}

const timers = {};
function persist(name, file, obj) {
  if (timers[name]) return;
  timers[name] = setTimeout(() => {
    timers[name] = null;
    const tmp = file + '.tmp';
    try { fs.writeFileSync(tmp, JSON.stringify(obj)); fs.renameSync(tmp, file); }
    catch (e) { console.error('persist', name, e.message); }
  }, 800);
}

const DIFFS = ['easy','medium','hard','extreme'];
const clampName = (s) => String(s || 'Hráč').slice(0, 20).replace(/[<>]/g, '');
const MAX_REPORTS = 8000;
const RUNS_PER_DIFF = 300;      // pool of recent runs used as async opponents

function corsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
}
function send(res, code, obj) { res.writeHead(code); res.end(JSON.stringify(obj)); }

function pickOpponent(diff, rating) {
  const pool = (battle.runs[diff] || []).filter(r => r.rating != null);
  if (pool.length) {
    // closest by rating, small randomness so it's not always the same
    pool.sort((a, b) => Math.abs(a.rating - rating) - Math.abs(b.rating - rating));
    const near = pool.slice(0, Math.min(8, pool.length));
    const o = near[Math.floor(Math.random() * near.length)];
    return { name: o.name, score: o.score, rating: o.rating, bot: false };
  }
  // No real opponent yet → generated bot scaled by difficulty
  const acc = { easy:0.55, medium:0.65, hard:0.72, extreme:0.78 }[diff] || 0.65;
  let score = 0; for (let i = 0; i < 10; i++) if (Math.random() < acc) score++;
  return { name: 'Gream Bot', score, rating: 1000, bot: true };
}

function updateRating(cur, oppRating, win) {
  const K = 28;
  const expected = 1 / (1 + Math.pow(10, (oppRating - cur) / 400));
  return Math.round(cur + K * ((win ? 1 : 0) - expected));
}

function readBody(req, cb) {
  let b = ''; req.on('data', d => { b += d; if (b.length > 1e5) req.destroy(); });
  req.on('end', () => { try { cb(b ? JSON.parse(b) : {}); } catch { cb(null); } });
}

const server = http.createServer((req, res) => {
  corsHeaders(res);
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  const u = new URL(req.url, 'http://x');
  const p = u.pathname.replace(/\/+$/, '') || '/';

  if (req.method === 'GET' && (p === '/health' || p === '/')) return send(res, 200, { ok: true, service: 'gream-api' });

  // Rate limit writes (anti-spam / anti-inflation).
  if (req.method === 'POST') {
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'x';
    if (rateLimited(ip)) return send(res, 429, { error: 'rate-limited' });
  }

  // ─── Daily round: everyone plays the same date-seeded set; ranked per day ───
  if (req.method === 'POST' && p === '/battle/daily/result') return readBody(req, (d) => {
    if (!d || !d.pid || !d.date) return send(res, 400, { error: 'bad' });
    const date = String(d.date).slice(0, 10);
    const name = clampName(d.name);
    const score = Math.max(0, Math.min(10, Number(d.score) || 0));
    const day = daily[date] = daily[date] || {};
    if (!day[d.pid] || score > day[d.pid].score) day[d.pid] = { name, score, ts: Date.now() };
    // keep only last 7 days
    const keys = Object.keys(daily).sort();
    while (keys.length > 7) delete daily[keys.shift()];
    persist('daily', F('daily.json'), daily);
    const board = Object.values(day).sort((a, b) => b.score - a.score);
    const rank = board.findIndex(x => x.name === name && x.score === day[d.pid].score) + 1;
    return send(res, 200, { rank: rank || board.length, players: board.length });
  });

  if (req.method === 'GET' && p === '/battle/daily/leaderboard') {
    const date = String(u.searchParams.get('date') || '').slice(0, 10);
    const day = daily[date] || {};
    const board = Object.values(day).sort((a, b) => b.score - a.score).slice(0, 20)
      .map(x => ({ name: x.name, score: x.score }));
    return send(res, 200, board);
  }

  if (req.method === 'POST' && p === '/report') return readBody(req, (d) => {
    if (!d) return send(res, 400, { error: 'bad-json' });
    const rec = {
      id: Date.now() + '-' + Math.random().toString(36).slice(2, 7),
      challengeId: String(d.challengeId || '').slice(0, 80),
      world: String(d.world || '').slice(0, 20),
      difficulty: String(d.difficulty || '').slice(0, 10),
      text: String(d.text || '').slice(0, 300),
      lang: String(d.lang || '').slice(0, 4),
      reason: String(d.reason || '').slice(0, 40),
      note: String(d.note || '').slice(0, 500),
      pid: String(d.pid || '').slice(0, 40),
      ts: Date.now(),
    };
    reports.push(rec);
    if (reports.length > MAX_REPORTS) reports.splice(0, reports.length - MAX_REPORTS);
    persist('reports', F('reports.json'), reports);
    return send(res, 200, { ok: true, id: rec.id });
  });

  if (req.method === 'POST' && p === '/battle/opponent') return readBody(req, (d) => {
    if (!d) return send(res, 400, { error: 'bad-json' });
    const diff = DIFFS.includes(d.difficulty) ? d.difficulty : 'medium';
    const rating = Number(d.rating) || 1000;
    return send(res, 200, pickOpponent(diff, rating));
  });

  if (req.method === 'POST' && p === '/battle/result') return readBody(req, (d) => {
    if (!d || !d.pid) return send(res, 400, { error: 'bad' });
    const diff = DIFFS.includes(d.difficulty) ? d.difficulty : 'medium';
    const name = clampName(d.name);
    const win = !!d.win;
    const score = Math.max(0, Math.min(10, Number(d.score) || 0));
    const oppRating = Number(d.oppRating) || 1000;
    const pl = battle.players[d.pid] || { name, rating: 1000, wins: 0, losses: 0 };
    pl.name = name;
    pl.rating = updateRating(pl.rating, oppRating, win);
    if (win) pl.wins++; else pl.losses++;
    battle.players[d.pid] = pl;
    // store this run as a future opponent
    (battle.runs[diff] = battle.runs[diff] || []).push({ pid: d.pid, name, score, rating: pl.rating, ts: Date.now() });
    if (battle.runs[diff].length > RUNS_PER_DIFF) battle.runs[diff].splice(0, battle.runs[diff].length - RUNS_PER_DIFF);
    persist('battle', F('battle.json'), battle);
    // rank by rating
    const board = Object.values(battle.players).sort((a, b) => b.rating - a.rating);
    const rank = board.findIndex(x => x.name === name && x.rating === pl.rating) + 1;
    return send(res, 200, { rating: pl.rating, rank: rank || board.length, wins: pl.wins });
  });

  if (req.method === 'GET' && p === '/battle/leaderboard') {
    const board = Object.values(battle.players)
      .sort((a, b) => b.rating - a.rating).slice(0, 20)
      .map(x => ({ name: x.name, rating: x.rating, wins: x.wins || 0 }));
    return send(res, 200, board);
  }

  if (req.method === 'POST' && p === '/poi/done') return readBody(req, (d) => {
    if (!d || !d.poiId) return send(res, 400, { error: 'bad' });
    const id = String(d.poiId).slice(0, 40);
    poi[id] = (poi[id] || 0) + 1;
    persist('poi', F('poi.json'), poi);
    return send(res, 200, { count: poi[id] });
  });

  if (req.method === 'GET' && p === '/poi/counts') {
    const ids = String(u.searchParams.get('ids') || '').split(',').filter(Boolean).slice(0, 200);
    const out = {}; for (const id of ids) out[id] = poi[id] || 0;
    return send(res, 200, out);
  }

  return send(res, 404, { error: 'not-found' });
});

server.listen(PORT, () => console.log('gream-api on', PORT));
