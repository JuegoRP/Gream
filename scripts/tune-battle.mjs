// Ladí čísla speciálů v js/battle-rules.js: každý greamík ~50 % výher NA KAŽDÉ úrovni hráče.
// Každý speciál má složku „pro všechny“ (A) a složku, která roste se zkušeností (B).
// Použití: node scripts/tune-battle.mjs  → vypíše SPECIALS k přepsání do battle-rules.js
import fs from 'node:fs';
import { SPECIALS, ARCHES, winMatrix } from '../js/battle-rules.js';
const DAMP = +(process.env.DAMP || 1);
// [klíč A, meze], [klíč B, meze, směr (+1 = větší hodnota = silnější)]
const P = {
  lilek:  { A: ['dmg', 0, 20],  B: ['mult', 1, 4, +1] },
  jiskra: { A: ['dmg', 0, 30],  B: ['stun', 0.15, 1, -1] },
  kamen:  { A: ['dmg', 0, 20],  B: ['block', 0.05, 0.95, +1] },
  srodik:  { A: ['heal', 2, 50], B: null },  // vrácená energie je skoková → necháváme 0
  vlnka:  { A: ['dmg', 0, 30],  B: ['mult', 1, 3, +1] },
  atlas:  { A: ['dmg', 0, 30],  B: null },
};
const Ks = [0.45, 0.65, 0.85];
const avgOf = (m) => Object.fromEntries(ARCHES.map(a => [a, ARCHES.filter(b => b !== a).reduce((s, b) => s + m[a][b], 0) / 5]));
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
for (let it = 0; it < +(process.env.IT || 16); it++) {
  const avgs = Ks.map(K => avgOf(winMatrix(K, +(process.env.N || 1500))));
  const line = [];
  for (const a of ARCHES) {
    const mean = avgs.reduce((s, x) => s + x[a], 0) / Ks.length;
    const slope = avgs[2][a] - avgs[0][a];             // + = silnější u expertů
    line.push(`${a} ${mean.toFixed(1)} [${avgs.map(x => x[a].toFixed(0)).join('/')}]`);
    const [ka, la, ha] = P[a].A;
    // A: vyrovnává průměr (aditivní krok, ať jde i z nuly)
    SPECIALS[a][ka] = +clamp(SPECIALS[a][ka] - (mean - 50) * 0.25 * DAMP * (ka === 'heal' ? 0.4 : ka === 'dmg' ? 1 : 0.05), la, ha).toFixed(3);
    if (P[a].B) {
      const [kb, lb, hb, dir] = P[a].B;
      const step = kb === 'energy' ? 0.08 : (kb === 'mult' ? 0.04 : 0.02);
      SPECIALS[a][kb] = +clamp(SPECIALS[a][kb] - dir * Math.sign(slope) * Math.min(1, Math.abs(slope) / 4) * step * DAMP, lb, hb).toFixed(3);
    }
  }
  console.log(it, line.join(' | '));
}
const json = Object.fromEntries(ARCHES.map(a => [a, SPECIALS[a]]));
console.log(JSON.stringify(json));
if (process.env.WRITE) {   // přepíše čísla v js/battle-rules.js (zachová komentáře)
  const f = new URL('../js/battle-rules.js', import.meta.url);
  let src = fs.readFileSync(f, 'utf8');
  for (const a of ARCHES) {
    const body = Object.entries(SPECIALS[a]).map(([k, v]) => `${k}: ${typeof v === 'string' ? `'${v}'` : v}`).join(', ');
    src = src.replace(new RegExp(`(\\n  ${a}: +)\\{[^}]*\\}`), `$1{ ${body} }`);
  }
  fs.writeFileSync(f, src); console.log('zapsáno do js/battle-rules.js');
}
