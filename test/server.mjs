// Test serveru gream-api (lokálně, dočasná data): nahrávky soubojů, soupeř ≠ já, týdenní liga + postup.
// node test/server.mjs   (port 8092 musí být volný)
import { spawn } from 'node:child_process'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gream-'));
const start = () => spawn(process.execPath, [new URL('../server/gream-api.js', import.meta.url).pathname], { env: { ...process.env, GREAM_DATA_DIR: dir, GREAM_RL_OFF: '1' }, stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const B = 'http://localhost:8092';
const post = (p, b) => fetch(B + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then(r => r.json());
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗', m); } };
let srv = start(); await sleep(800);
try {
  const ans = Array.from({ length: 10 }, (_, i) => ({ ok: i % 3 !== 0, ms: 2000 + i * 300 }));
  for (let i = 0; i < 10; i++) for (let g = 0; g <= i; g++) await post('/battle/result', { pid: 'p' + i, name: 'Hráč ' + i, difficulty: 'medium', score: 7, win: g % 2 === 0, ko: g === 0, arch: 'lilek', stage: 3, acc: 'acc_crown', answers: ans });
  const L = await fetch(B + '/league?pid=p9').then(r => r.json());
  ok(L.tier === 'bronze' && L.players === 10, 'liga: 10 hráčů v bronzu');
  ok(L.me?.rank === 1 && L.me.pts === 21, `liga: body (výhra 3, prohra 1, K.O. +1) → ${JSON.stringify(L.me)}`);
  ok(L.promote === 3 && L.demote === 2, 'liga: postup 30 %, sestup 20 %');
  const o = await post('/battle/opponent', { difficulty: 'medium', rating: 1000, pid: 'p9' });
  ok(o.name !== 'Hráč 9' && o.arch === 'lilek' && o.answers?.length === 10 && o.acc === 'acc_crown', 'soupeř: nahrávka jiného hráče i s doplňkem');
  const bad = await post('/battle/result', { pid: 'x', name: 'kokot', difficulty: 'medium', score: 3, win: false, arch: 'zlo', answers: [{ ok: 1, ms: -5 }] });
  ok(bad.rating, 'výsledek s nesmyslnými daty nepadá');
  // Bitevní místa: převzetí jen lepším skóre, bez identity hráče
  ok((await post('/spots/claim', { id: 'node/1', arch: 'kamen', stage: 3, score: 80, tok: 'aaa', name: 'Ema', pid: 'p1' })).held === true, 'místo: první převezme');
  ok((await post('/spots/claim', { id: 'node/1', arch: 'lilek', stage: 2, score: 60, tok: 'bbb' })).held === false, 'místo: slabší skóre nepřevezme');
  ok((await post('/spots/claim', { id: 'node/1', arch: 'vlnka', stage: 4, score: 95, tok: 'ccc' })).held === true, 'místo: lepší skóre převezme');
  ok((await post('/spots/claim', { id: 'node/9', arch: 'tlapka', stage: 3, score: 70, tok: 'ddd' })).held === true, 'místo: greamík podkategorie (tlapka) je povolený');
  const sp = await fetch(B + '/spots?ids=node/1,node/2').then(r => r.json());
  ok(sp['node/1']?.arch === 'vlnka' && sp['node/1'].score === 95 && !('name' in sp['node/1']) && !('pid' in sp['node/1']) && !sp['node/2'], 'místo: vrací greamíka a skóre, žádné jméno ani ID');
  await sleep(1200);
  const f = path.join(dir, 'league.json'); const d = JSON.parse(fs.readFileSync(f, 'utf8')); d.week = '2020-W01'; fs.writeFileSync(f, JSON.stringify(d));
  srv.kill(); await sleep(300); srv = start(); await sleep(800);
  const a = await fetch(B + '/league?pid=p9').then(r => r.json()), b = await fetch(B + '/league?pid=p6').then(r => r.json());
  ok(a.tier === 'silver' && a.last?.from === 'bronze' && a.last?.to === 'silver', 'nový týden: nejlepší postoupil');
  ok(b.tier === 'bronze' && b.last?.rank === 4, 'nový týden: 4. místo zůstává');
  ok(!a.me, 'nový týden: body vynulované');
} finally { srv.kill(); fs.rmSync(dir, { recursive: true, force: true }); }
console.log(`${fail ? '✗ FAILURES' : '✓ SERVER OK'} — ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
