// Gream — UI tester (jsdom). Drives real DOM code paths (battle flow) and asserts
// the overlays/rounds/result render without errors. Catches DOM bugs the logic
// simulator can't (wrong IDs, null refs, broken flow).   node test/ui.mjs
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
const { window } = dom;
const def = (k, v) => Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true });
def('window', window);
def('document', window.document);
def('navigator', window.navigator);
def('localStorage', window.localStorage);
def('requestAnimationFrame', cb => setTimeout(cb, 0));
def('cancelAnimationFrame', id => clearTimeout(id));
window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });   // „omezit pohyb“ → aréna bez částic, rychlejší test
// stub audio so Feedback/Audio never throw in jsdom
class FakeAudio { constructor(){ this.play=()=>Promise.resolve(); } play(){ return Promise.resolve(); } }
window.Audio = FakeAudio; globalThis.Audio = FakeAudio;
const noop = () => {};
const audioNode = new Proxy({}, { get: (_, k) => (k === 'frequency' || k === 'gain') ? { value: 0, setValueAtTime: noop, exponentialRampToValueAtTime: noop } : (k === 'connect' || k === 'start' || k === 'stop') ? noop : noop });
window.AudioContext = function(){ return new Proxy({ currentTime: 0, destination: {}, state: 'running', resume: noop, createOscillator: () => audioNode, createGain: () => audioNode }, { get: (t, k) => k in t ? t[k] : noop }); };
window.webkitAudioContext = window.AudioContext;
try { navigator.vibrate = () => {}; } catch {}

let errors = [];
window.addEventListener('error', e => errors.push(e.message));

const base = new URL('../js/', import.meta.url);
const { Profiles } = await import(new URL('profiles.js', base));
const { Gream } = await import(new URL('gream.js', base));
const { Skins } = await import(new URL('skins.js', base));
const { Battle } = await import(new URL('battle.js', base));

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ FAIL:', m); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

localStorage.setItem('gream_lang', 'cs');
const p = Profiles.create({ name: 'UI', avatar: '🦊', lang: 'cs' });
Profiles.setActive(p.id); Gream.createStarter(p.id);
Gream.devAdvanceStage(p.id, 'nature');   // lilek stage2 → time bonus exists
Skins.addSeeds(p.id, 500);

// ── Intro overlay renders ──
Battle.intro();
const ov = document.getElementById('battleOverlay');
ok(!!ov, 'intro overlay exists');
ok(document.getElementById('battleDiffRow')?.querySelectorAll('button').length === 4, 'intro has 4 difficulty buttons');
const startBtn = document.getElementById('battleStartBtn');
ok(!!startBtn, 'intro has start button');
ok(!startBtn.disabled, 'start button enabled (has seeds + premium)');

// ── Start battle ──
const seedsBefore = Skins.getSeeds(p.id);
ok(document.querySelectorAll('#battlePick button').length >= 1, 'intro has greamík picker');
ok(!!document.getElementById('battleSkill')?.textContent, 'intro shows the special of the picked greamík');
startBtn.click();
await sleep(30);
ok(!document.getElementById('battleOverlay'), 'intro overlay closed after start');
ok(Skins.getSeeds(p.id) < seedsBefore, 'entry deducted on start');
await sleep(2000);   // soupeř ze serveru (max 1,5 s) + nástup arény
ok(!!document.getElementById('battleRound'), 'first round rendered');
ok(!!document.querySelector('.ar-stage .ar-me .ar-hp'), 'arena shows HP bars');

// ── Auto-play 10 rounds (click first choice each round) ──
let rounds = 0;
let usedSpecial = false;
for (let i = 0; i < 400; i++) {
  if (document.getElementById('battleResult')) break;
  const sp = document.getElementById('btSpecial');
  if (sp && !sp.hidden && !usedSpecial) { sp.click(); usedSpecial = true; await sleep(1200); continue; }
  const choices = [...document.querySelectorAll('#btChoices button')].filter(b => !b.disabled && !b.classList.contains('gone'));
  if (choices.length) { choices[0].click(); rounds++; }
  await sleep(150);
}
ok(rounds >= 3, `played rounds until KO or 10 (${rounds})`);
const result = document.getElementById('battleResult');
ok(!!result, 'result screen rendered after 10 rounds');
const stats = Battle.getStats(p.id);
ok(stats.total === 1, `one battle recorded (total=${stats.total})`);
ok((stats.wins + stats.losses) === 1, 'win/loss recorded');

// ── Close result ──
result?.querySelector('#battleClose')?.click();
await sleep(20);
ok(!document.getElementById('battleResult'), 'result closes cleanly');

// ── Daily round: seeded set, plays to daily board ──
Battle.daily();
await sleep(500);
ok(!!document.getElementById('battleRound'), 'daily round rendered');
let dRounds = 0;
for (let i = 0; i < 400; i++) {
  if (document.getElementById('battleBoardOverlay')) break;
  const btns = [...document.querySelectorAll('#btChoices button')].filter(b => !b.disabled && !b.classList.contains('gone'));
  if (btns.length) { btns[0].click(); dRounds++; }
  await sleep(150);
}
ok(dRounds >= 3, `daily played rounds (${dRounds})`);
await sleep(60);
ok(!!document.getElementById('battleBoardOverlay'), 'daily leaderboard rendered');
document.getElementById('battleBoardOverlay')?.remove();

ok(errors.length === 0, `no window errors (${errors.length}: ${errors.slice(0,2).join(' | ')})`);

console.log(`\n${fail===0?'✓ ALL PASS':'✗ FAILURES'} — ${pass} passed, ${fail} failed`);
process.exit(fail===0?0:1);
