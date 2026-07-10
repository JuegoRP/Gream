// Gream — headless simulator/tester. Runs core flows in Node (no browser) and
// asserts invariants. Catches logic regressions in challenges, evolution, battles.
//   node test/sim.mjs
const store = {};
globalThis.localStorage = { getItem:k=>store[k]??null, setItem:(k,v)=>{store[k]=String(v)}, removeItem:k=>{delete store[k]}, clear:()=>{for(const k in store)delete store[k]} };
Object.defineProperty(globalThis,'navigator',{value:{geolocation:{},storage:{}},configurable:true});
Object.defineProperty(globalThis,'window',{value:{Audio:function(){this.play=()=>Promise.resolve()},addEventListener(){},location:{search:''}},configurable:true});
globalThis.requestAnimationFrame = cb => cb();

const base = new URL('../js/', import.meta.url);
const { T } = await import(new URL('i18n.js', base));
const { Profiles } = await import(new URL('profiles.js', base));
const { Gream } = await import(new URL('gream.js', base));
const { Skins } = await import(new URL('skins.js', base));
const { Battle } = await import(new URL('battle.js', base));

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) pass++; else { fail++; console.log('  ✗ FAIL:', msg); } };

// ── 1. Challenge pools integrity (EN/CZ aligned, no within-difficulty dups) ──
{
  let mismatch = 0, dups = 0, total = 0;
  for (const w of Object.keys(T.en.challenges)) for (const d of Object.keys(T.en.challenges[w])) {
    const e = T.en.challenges[w][d].length, c = T.cs.challenges[w]?.[d]?.length || 0;
    if (e !== c) mismatch++;
    total += e;
    const seen = new Set();
    for (const ch of T.en.challenges[w][d]) { if (seen.has(ch.text)) dups++; seen.add(ch.text); }
  }
  ok(mismatch === 0, `EN/CZ pool alignment (${mismatch} mismatches)`);
  ok(dups === 0, `no within-difficulty duplicates (${dups})`);
  console.log(`  challenges/lang: ${total}`);
}

// ── 2. Evolution: starter → stage 4 via thresholds ──
{
  Profiles.create({ name:'E', avatar:'🦊', lang:'cs' });
  const p = Profiles.active(); Gream.createStarter(p.id);
  let stages = [];
  for (let i=0;i<4;i++){ const r = Gream.devAdvanceStage(p.id,'logic'); if (r && r.toStage) stages.push(r.toStage); }
  ok(JSON.stringify(stages) === JSON.stringify([2,3,4]), `evolution 1→2→3→4 (${stages})`);
  ok(Gream.active(p.id).archetype === 'kamen', 'archetype resolved from played world (logic→kamen)');
}

// ── 3. Battle economy + invariants over many runs ──
{
  localStorage.clear();
  Profiles.create({ name:'B', avatar:'🐻', lang:'cs' });
  const p = Profiles.active(); Gream.createStarter(p.id);
  Gream.devAdvanceStage(p.id, 'nature'); // lilek stage2 → nature time bonus
  Skins.addSeeds(p.id, 100000);
  let wins=0, seedsNeverNeg=true, entryAlways=true, rewardOnlyOnWin=true, tenQ=true;
  const diffs=['easy','medium','hard','extreme'];
  for (let i=0;i<400;i++){
    const before = Skins.getSeeds(p.id);
    const diff = diffs[i%4];
    const { entry, reward } = Battle.economy(diff, i%2===0);
    const r = Battle.simulate(p.id, diff, 0.8, i%2===0);
    if (r.error) { entryAlways=false; continue; }
    const after = Skins.getSeeds(p.id);
    if (after < 0) seedsNeverNeg=false;
    // net = -entry (+reward if win)
    const expected = before - entry + (r.win ? reward : 0);
    if (after !== expected) entryAlways=false;
    if (!r.win && r.reward !== 0) rewardOnlyOnWin=false;
    if (r.questions !== 10) tenQ=false;
    if (r.win) wins++;
  }
  ok(seedsNeverNeg, 'seeds never negative');
  ok(entryAlways, 'entry deducted + reward math correct every battle');
  ok(rewardOnlyOnWin, 'reward only on win');
  ok(tenQ, 'every battle has 10 questions');
  ok(wins>50 && wins<390, `win rate sane (${wins}/400)`);
  const s = Battle.getStats(p.id);
  ok(s.wins + s.losses === s.total && s.total === 400, `stats consistent (w${s.wins}+l${s.losses}=${s.total})`);
  ok(s.bestStreak >= s.streak, 'bestStreak >= current streak');
}

// ── 4. Economy ratios: entry = 1/4 of win (home), 1/8 (outdoor) ──
{
  for (const d of ['easy','medium','hard','extreme']) {
    const home = Battle.economy(d, false), out = Battle.economy(d, true);
    ok(home.entry === Math.max(1, Math.round(home.reward/4)), `home entry = win/4 (${d})`);
    ok(out.entry === Math.max(1, Math.round(out.reward/8)), `outdoor entry = win/8 (${d})`);
  }
}

console.log(`\n${fail===0?'✓ ALL PASS':'✗ FAILURES'} — ${pass} passed, ${fail} failed`);
process.exit(fail===0?0:1);
