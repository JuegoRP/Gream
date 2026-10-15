// Test balancu soubojů: pravidla z js/battle-rules.js (stejná jako ve hře).
// Každý greamík musí na každé úrovni hráče vyhrávat 46–54 % v průměru a žádná dvojice nesmí být horší než 40 : 60.
// Rychlá verze v `npm test` (N=1500); důkladná: N=20000 node test/battle-balance.mjs
import { ARCHES, winMatrix, SPECIALS } from '../js/battle-rules.js';
const N = +(process.env.N || 1500);
const LEVELS = { 'začátečník': 0.45, 'průměr': 0.65, 'expert': 0.85 };
const AVG = N >= 10000 ? [47.5, 52.5] : [46, 54];   // tolerance podle počtu zápasů (šum)
const PAIR = N >= 10000 ? 59 : 61;
let fail = 0;
for (const [name, K] of Object.entries(LEVELS)) {
  const m = winMatrix(K, N);
  const avg = Object.fromEntries(ARCHES.map(a => [a, ARCHES.filter(b => b !== a).reduce((s, b) => s + m[a][b], 0) / 5]));
  let worst = ['', 0];
  for (const a of ARCHES) for (const b of ARCHES) if (a !== b && m[a][b] > worst[1]) worst = [`${a}>${b}`, m[a][b]];
  const bad = ARCHES.filter(a => avg[a] < AVG[0] || avg[a] > AVG[1]);
  const ok = !bad.length && worst[1] <= PAIR;
  if (!ok) fail++;
  console.log(`${ok ? '✓' : '✗'} ${name.padEnd(10)} ${ARCHES.map(a => `${a} ${avg[a].toFixed(1)}`).join('  ')} | nejsilnější dvojice ${worst[0]} ${worst[1].toFixed(1)} %`);
}
if (fail) { console.log('✗ BALANC NEPROŠEL – spusť: WRITE=1 node scripts/tune-battle.mjs'); process.exit(1); }
console.log(`✓ BALANC OK (N=${N} zápasů na dvojici a úroveň) ${JSON.stringify(SPECIALS)}`);
