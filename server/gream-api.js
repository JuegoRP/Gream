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
//   POST /poi             {lat, lon}  (≈500 m, zaokrouhluje i server) -> Overpass JSON {elements}
//   GET  /tiles/{z}/{x}/{y}.pbf  vektorové dlaždice mapy (OpenFreeMap) přes cache – cizí server hráče nevidí
//
// Soukromí: nic z /poi ani /tiles se neukládá s IP ani polohou hráče (jen cache podle buňky/dlaždice).
const http = require('http');
const fs   = require('fs');
const path = require('path');
const zlib = require('zlib');

const PORT     = 8092;
const DATA_DIR = process.env.GREAM_DATA_DIR || '/data';
fs.mkdirSync(DATA_DIR, { recursive: true });
const F = (n) => path.join(DATA_DIR, n);

function loadJSON(file, fallback) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } }
const reports = loadJSON(F('reports.json'), []);
const battle  = loadJSON(F('battle.json'), { players: {}, runs: {} });     // runs: {diff: [{pid,name,score,rating,ts}]}
const league  = loadJSON(F('league.json'), { week: null, tier: {}, pts: {}, last: {} });   // týdenní ligy (1.1)
const poi     = loadJSON(F('poi.json'), {});
const daily   = loadJSON(F('daily.json'), {});                             // { 'YYYY-MM-DD': { pid: {name,score,ts} } }
const rank    = loadJSON(F('rank.json'), {});                              // { pid: {name,avatar,score,tasks,badges,streak,greamStage,ts} }

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
// Přezdívky vidí ostatní (i děti) → filtr i na serveru, aplikace se dá obejít.
const BAD = ['kurv', 'pica', 'picus', 'picovin', 'kokot', 'curak', 'debil', 'zmrd', 'hovn', 'prdel', 'sukat', 'buzn', 'kreten', 'idiot', 'cikan', 'negr', 'nigg',
  'fuck', 'shit', 'bitch', 'cunt', 'dick', 'cock', 'pussy', 'whore', 'slut', 'fagg', 'nazi', 'hitler', 'porn', 'sex', 'penis', 'vagin', 'rape', 'zabij'];
const norm = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[0@]/g, 'o').replace(/[1!|]/g, 'i').replace(/3/g, 'e').replace(/4/g, 'a').replace(/5|\$/g, 's').replace(/7/g, 't').replace(/[^a-z]/g, '');
const BADN = [...new Set(BAD.map(norm))].filter(w => w.length >= 3);
const isBadName = (s) => { const n = norm(s); return BADN.some(w => n.includes(w)); };
const clampName = (s) => { const n = String(s || 'Hráč').slice(0, 20).replace(/[<>]/g, '').trim() || 'Hráč'; return isBadName(n) ? 'Hráč' : n; };
const MAX_REPORTS = 8000;
const RUNS_PER_DIFF = 300;      // pool of recent runs used as async opponents

function corsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
}
function send(res, code, obj) { res.writeHead(code); res.end(JSON.stringify(obj)); }

const ARCHES = ['lilek', 'jiskra', 'kamen', 'srodik', 'vlnka', 'atlas'];
// Nahrávka souboje (1.1): greamík + odpovědi a časy po kolech → přehraje se soupeři
function cleanAnswers(a) {
  if (!Array.isArray(a)) return null;
  const out = a.slice(0, 10).map(x => ({ ok: !!(x && x.ok), ms: Math.max(300, Math.min(30000, Math.round(Number(x && x.ms) || 0))) }));
  return out.length >= 5 ? out : null;
}
function pickOpponent(diff, rating, pid) {
  const pool = (battle.runs[diff] || []).filter(r => r.rating != null && (!pid || r.pid !== pid));
  if (pool.length) {
    // closest by rating, small randomness so it's not always the same
    pool.sort((a, b) => Math.abs(a.rating - rating) - Math.abs(b.rating - rating));
    const near = pool.slice(0, Math.min(8, pool.length));
    const o = near[Math.floor(Math.random() * near.length)];
    return { name: o.name, score: o.score, rating: o.rating, bot: false, arch: o.arch, stage: o.stage, acc: o.acc || null, answers: o.answers };
  }
  // No real opponent yet → generated bot scaled by difficulty
  const acc = { easy:0.55, medium:0.65, hard:0.72, extreme:0.78 }[diff] || 0.65;
  let score = 0; for (let i = 0; i < 10; i++) if (Math.random() < acc) score++;
  return { name: 'Gream Bot', score, rating: 1000, bot: true };
}

// ─── Týdenní ligy: body za souboje, na konci týdne postup / sestup ───
const TIERS = ['bronze', 'silver', 'gold', 'diamond'];
const PROMOTE = 0.3, DEMOTE = 0.2;
function isoWeek(d = new Date()) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = t.getUTCFullYear(), w = Math.ceil(((t - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7);
  return `${y}-W${String(w).padStart(2, '0')}`;
}
function weekEnds() {   // pondělí 00:00 UTC příštího týdne
  const d = new Date(); const day = d.getUTCDay() || 7;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 8 - day);
}
function rollLeague() {
  const wk = isoWeek();
  if (league.week === wk) return;
  if (league.week) {   // vyhodnotit uplynulý týden po ligách
    league.last = {};
    const before = { ...league.tier };   // vyhodnotit podle lig na začátku týdne (postoupivší se nepočítají dvakrát)
    for (const tier of TIERS) {
      const rows = Object.entries(league.pts).filter(([pid]) => (before[pid] || 'bronze') === tier).sort((a, b) => b[1].pts - a[1].pts);
      const n = rows.length, up = Math.floor(n * PROMOTE), down = Math.floor(n * DEMOTE);
      rows.forEach(([pid], i) => {
        const ti = TIERS.indexOf(tier);
        let to = tier;
        if (i < up && ti < TIERS.length - 1) to = TIERS[ti + 1];
        else if (i >= n - down && ti > 0 && n >= 5) to = TIERS[ti - 1];
        league.tier[pid] = to;
        league.last[pid] = { week: league.week, from: tier, to, rank: i + 1, of: n };
      });
    }
  }
  league.week = wk; league.pts = {};
  persist('league', F('league.json'), league);
}
function leagueAdd(pid, name, add) {
  rollLeague();
  const row = league.pts[pid] || { name, pts: 0, games: 0 };
  row.name = name; row.pts += add; row.games++;
  league.pts[pid] = row;
  persist('league', F('league.json'), league);
}
function leagueView(pid) {
  rollLeague();
  const tier = league.tier[pid] || 'bronze';
  const rows = Object.entries(league.pts).filter(([id]) => (league.tier[id] || 'bronze') === tier).sort((a, b) => b[1].pts - a[1].pts);
  const n = rows.length;
  const me = rows.findIndex(([id]) => id === pid);
  return {
    week: league.week, endsAt: weekEnds(), tier, players: n,
    promote: Math.floor(n * PROMOTE), demote: n >= 5 ? Math.floor(n * DEMOTE) : 0,
    top: rows.slice(0, 20).map(([id, r], i) => ({ rank: i + 1, name: r.name, pts: r.pts, me: id === pid })),
    me: me >= 0 ? { rank: me + 1, pts: rows[me][1].pts } : null,
    last: league.last[pid] || null,
  };
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
    if (!process.env.GREAM_RL_OFF && rateLimited(ip)) return send(res, 429, { error: 'rate-limited' });   // GREAM_RL_OFF jen pro lokální testy
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
    return send(res, 200, pickOpponent(diff, rating, d.pid ? String(d.pid).slice(0, 40) : null));
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
    const run = { pid: d.pid, name, score, rating: pl.rating, ts: Date.now() };
    const answers = cleanAnswers(d.answers);
    if (answers && ARCHES.includes(d.arch)) Object.assign(run, { arch: d.arch, stage: Math.max(2, Math.min(4, Number(d.stage) || 2)), answers, acc: /^acc_[a-z]{2,12}$/.test(d.acc || '') ? d.acc : null });
    (battle.runs[diff] = battle.runs[diff] || []).push(run);
    if (battle.runs[diff].length > RUNS_PER_DIFF) battle.runs[diff].splice(0, battle.runs[diff].length - RUNS_PER_DIFF);
    persist('battle', F('battle.json'), battle);
    leagueAdd(String(d.pid).slice(0, 40), name, (win ? 3 : 1) + (d.ko ? 1 : 0));
    // rank by rating
    const board = Object.values(battle.players).sort((a, b) => b.rating - a.rating);
    const rank = board.findIndex(x => x.name === name && x.rating === pl.rating) + 1;
    return send(res, 200, { rating: pl.rating, rank: rank || board.length, wins: pl.wins });
  });

  if (req.method === 'GET' && p === '/league') {
    const pid = String(u.searchParams.get('pid') || '').slice(0, 40);
    return send(res, 200, leagueView(pid));
  }

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

  // ─── Global overall-score ranking (the "Svět" leaderboard) ───
  if (req.method === 'POST' && p === '/rank/submit') return readBody(req, (d) => {
    if (!d || !d.pid) return send(res, 400, { error: 'bad' });
    rank[d.pid] = {
      name:       clampName(d.name),
      avatar:     String(d.avatar || '🧒').slice(0, 8),
      score:      Math.max(0, Math.min(1e9, Number(d.score)  || 0)),
      tasks:      Math.max(0, Math.min(1e7, Number(d.tasks)  || 0)),
      badges:     Math.max(0, Math.min(1000, Number(d.badges) || 0)),
      streak:     Math.max(0, Math.min(1e5, Number(d.streak) || 0)),
      greamStage: Math.max(0, Math.min(4,   Number(d.greamStage) || 0)),
      ts: Date.now(),
    };
    // cap stored entries (keep the 500 highest scores)
    const keys = Object.keys(rank);
    if (keys.length > 500) {
      const low = keys.map(k => [k, rank[k].score]).sort((a, b) => a[1] - b[1]);
      for (let i = 0; i < keys.length - 500; i++) delete rank[low[i][0]];
    }
    persist('rank', F('rank.json'), rank);
    const board = Object.values(rank).sort((a, b) => b.score - a.score);
    const myRank = board.findIndex(x => x.score <= rank[d.pid].score) + 1;
    return send(res, 200, { rank: myRank || board.length, total: board.length });
  });

  if (req.method === 'GET' && p === '/rank/top') {
    const board = Object.values(rank).sort((a, b) => b.score - a.score).slice(0, 50)
      .map(x => ({ name: x.name, avatar: x.avatar, score: x.score, tasks: x.tasks, badges: x.badges, streak: x.streak, greamStage: x.greamStage }));
    return send(res, 200, board);
  }

  // ─── Místa v okolí: klient posílá polohu zaokrouhlenou na ≈500 m, server zaokrouhlí znovu ───
  if (req.method === 'POST' && p === '/poi') return readBody(req, async (d) => {
    const lat = Number(d && d.lat), lon = Number(d && d.lon);
    if (!isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 85 || Math.abs(lon) > 180) return send(res, 400, { error: 'bad' });
    try { return send(res, 200, await poiCell(roundCoord(lat), roundCoord(lon))); }
    catch { return send(res, 502, { error: 'overpass-unavailable' }); }
  });

  // ─── Vektorové dlaždice mapy (OpenFreeMap) přes cache ───
  const tm = p.match(/^\/tiles\/(\d{1,2})\/(\d{1,6})\/(\d{1,6})\.pbf$/);
  if (req.method === 'GET' && tm) {
    const [z, x, y] = tm.slice(1).map(Number);
    if (z > TILE_MAX_Z || x >= 2 ** z || y >= 2 ** z) return send(res, 404, { error: 'not-found' });
    return tile(z, x, y).then((gz) => {
      res.setHeader('Content-Type', 'application/x-protobuf');
      res.setHeader('Cache-Control', 'public, max-age=604800');
      if (!gz.length) { res.writeHead(204); return res.end(); }
      // dlaždice držíme gzipované (≈5× menší); prohlížeč/MapLibre je rozbalí sám
      if (/\bgzip\b/.test(req.headers['accept-encoding'] || '')) { res.setHeader('Content-Encoding', 'gzip'); res.writeHead(200); return res.end(gz); }
      res.writeHead(200); res.end(zlib.gunzipSync(gz));
    }).catch(() => send(res, 502, { error: 'tiles-unavailable' }));
  }

  return send(res, 404, { error: 'not-found' });
});

// ─── Místa (Overpass) – cache po buňkách ≈500 m na 24 h, bez vazby na hráče ───
const roundCoord = (v) => Math.round(v / 0.005) * 0.005;
const POI_TAGS = ['leisure=park', 'leisure=garden', 'leisure=nature_reserve', 'leisure=playground', 'natural=tree', 'natural=spring', 'natural=peak', 'natural=wood', 'natural=water',
  'historic=monument', 'historic=memorial', 'historic=castle', 'historic=ruins', 'historic=wayside_cross', 'historic=boundary_stone', 'amenity=place_of_worship', 'tourism=attraction', 'tourism=viewpoint',
  'amenity=library', 'tourism=museum', 'amenity=planetarium', 'amenity=school', 'amenity=university', 'amenity=post_office', 'information=board', 'information=map',
  'tourism=artwork', 'tourism=gallery', 'amenity=theatre', 'amenity=arts_centre', 'amenity=cinema', 'amenity=music_venue',
  'amenity=fountain', 'tourism=information', 'amenity=clock', 'amenity=telephone', 'man_made=tower',
  'amenity=bench', 'amenity=social_centre', 'amenity=community_centre', 'amenity=cafe', 'leisure=sports_centre', 'amenity=hospital', 'amenity=pub', 'amenity=bar'];
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.openstreetmap.fr/api/interpreter'];
const poiCache = new Map(); // klíč buňky → { t, data }
async function poiCell(lat, lon) {
  const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  const c = poiCache.get(key);
  if (c && Date.now() - c.t < 24 * 3600e3) return c.data;
  const parts = POI_TAGS.map(t => { const [k, v] = t.split('='); return `node["${k}"="${v}"](around:2200,${lat},${lon});way["${k}"="${v}"](around:2200,${lat},${lon});`; }).join('');
  const body = 'data=' + encodeURIComponent(`[out:json][timeout:20];(${parts});out center 120;`);
  const one = async (url) => {
    const r = await fetch(url, { method: 'POST', body, headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Gream/1.0 (3rstudio.eu)' }, signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error('overpass ' + r.status);
    return r.json();
  };
  const json = await Promise.any(OVERPASS.map(one));
  const data = { elements: (json.elements || []).map(e => ({ id: e.id, lat: e.lat, lon: e.lon, center: e.center, tags: e.tags })) };
  poiCache.set(key, { t: Date.now(), data });
  if (poiCache.size > 3000) poiCache.delete(poiCache.keys().next().value);
  return data;
}

// ─── Dlaždice: OpenFreeMap (zdarma i komerčně, data © OpenStreetMap) – cache na disku 30 dní ───
const TILE_MAX_Z = 14;
const TILE_DIR = path.join(DATA_DIR, 'tiles');
let tileTpl = null, tileTplAt = 0;
async function tileTemplate() {
  if (tileTpl && Date.now() - tileTplAt < 24 * 3600e3) return tileTpl;
  const r = await fetch('https://tiles.openfreemap.org/planet', { signal: AbortSignal.timeout(10000) });
  const j = await r.json();
  tileTpl = j.tiles[0]; tileTplAt = Date.now();
  return tileTpl;
}
async function tile(z, x, y) {
  const f = path.join(TILE_DIR, String(z), String(x), `${y}.pbf.gz`);
  try { const st = fs.statSync(f); if (Date.now() - st.mtimeMs < 30 * 86400e3) return fs.readFileSync(f); } catch { /* není v cache */ }
  const url = (await tileTemplate()).replace('{z}', z).replace('{x}', x).replace('{y}', y);
  const r = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'Gream/1.0 (3rstudio.eu)' } });
  if (r.status === 404 || r.status === 204) return Buffer.alloc(0);
  if (!r.ok) throw new Error('tile ' + r.status);
  const buf = zlib.gzipSync(Buffer.from(await r.arrayBuffer()), { level: 9 });
  try { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f + '.tmp', buf); fs.renameSync(f + '.tmp', f); } catch { /* cache je bonus */ }
  return buf;
}

server.listen(PORT, () => console.log('gream-api on', PORT));
