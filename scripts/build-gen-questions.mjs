// Sestaví js/challenges-gen.js z vygenerovaných a ověřených otázek.
//   node scripts/build-gen-questions.mjs <gen.jsonl> [facts-check.jsonl]
// Zdroj: generátor přes n8n agenta (gen-questions.mjs) + druhý průchod fact-checkem (verdict ok)
// + RUČNÍ výběr (content/gen-1.1-keep.json: pořadová čísla mezi „ok“ otázkami, opravy textů).
import fs from 'node:fs';
const [SRC, CHECK] = process.argv.slice(2);
const cfg = JSON.parse(fs.readFileSync(new URL('../content/gen-1.1-keep.json', import.meta.url), 'utf8'));
const ok = fs.readFileSync(SRC, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)).filter(r => r.verdict === 'ok');
const keep = new Set(cfg.keep);
const YEAR_TOL = { easy: 10, medium: 5, hard: 3, extreme: 1 };
const out = [];
ok.forEach((r, i) => {
  if (!keep.has(i)) return;
  const q = JSON.parse(JSON.stringify(r.q));
  for (const [from, to] of cfg.fix?.[i] || []) for (const lang of ['cs', 'en']) {
    const L = q[lang]; if (!L) continue;
    L.text = L.text.replace(from, to);
    if (L.choices) L.choices = L.choices.map(c => c.replace(from, to));
  }
  const item = { kind: r.kind === 'pack' ? 'choice' : r.kind, w: r.w, d: r.d, ...(r.pack ? { pack: r.pack } : {}), cs: q.cs, en: q.en };
  if (q.fact_cs || q.fact_en) item.fact = { cs: String(q.fact_cs || '').slice(0, 220), en: String(q.fact_en || '').slice(0, 220), src: String(q.source || '').slice(0, 80) };
  if (r.kind === 'tf') item.correct = q.correct === 'pravda' ? 'pravda' : 'mytus';
  else if (r.kind === 'estimate') {
    item.answer = Number(q.answer);
    const isYear = /^(rok|roku|year)s?$/i.test(String(q.cs?.unit || q.en?.unit || '').trim());
    if (isYear) { item.tolAbs = YEAR_TOL[r.d]; item.cs.unit = ''; item.en.unit = ''; } else item.tol = r.tol;
  } else if (r.kind !== 'timeline') item.correct_index = q.correct_index ?? 0;
  // kontrola tvaru
  const bad = !item.cs?.text || !item.en?.text || (item.kind === 'timeline' && (item.cs.items?.length !== 4 || item.en.items?.length !== 4))
    || ((item.kind === 'odd' || item.kind === 'choice') && (item.cs.choices?.length !== item.en.choices?.length || item.cs.choices.length < 3))
    || (item.kind === 'estimate' && !Number.isFinite(item.answer));
  if (bad) { console.log('vyřazeno (tvar)', i, item.cs?.text); return; }
  // „Co sem nepatří?“ – obecné zadání doplnit o možnosti (každá otázka musí mít jedinečný text: id, hlášení, zajímavosti)
  if (item.kind === 'odd') for (const lang of ['cs', 'en']) if (/^(Co sem nepatří\?|Which one doesn't belong\?)$/.test(item[lang].text.trim())) item[lang].text = `${item[lang].text.trim()} ${item[lang].choices.join(' · ')}`;
  out.push(item);
});
// ─── Tematické balíčky (content/packs-1.1.jsonl): verdikt ok, mimo ručně zamítnuté, bez duplicit ───
// Duplicita = stejná správná odpověď a podobné zadání (≥ 35 % společných slov) jako už zařazená otázka.
const PACKS_SRC = new URL('../content/packs-1.1.jsonl', import.meta.url);
const words = (t) => new Set(String(t).toLowerCase().normalize('NFC').replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/).filter(w => w.length > 3));
const ansOf = (o) => o.kind === 'tf' ? o.correct : o.kind === 'estimate' ? String(o.answer) : o.kind === 'timeline' ? o.cs.items.join('|') : String(o.cs.choices?.[o.correct_index ?? 0] || '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const isDup = (a, b) => { if (ansOf(a) !== ansOf(b)) return false; const A = words(a.cs.text), B = words(b.cs.text); let n = 0; for (const w of A) if (B.has(w)) n++; return n / Math.max(1, Math.min(A.size, B.size)) >= 0.35; };
const packFactIds = new Map();   // položka → id pro kontrolu zajímavostí (pack<řádek>)
if (fs.existsSync(PACKS_SRC)) {
  const rej = new Set(cfg.packs_reject || []);
  let added = 0, dups = 0;
  fs.readFileSync(PACKS_SRC, 'utf8').split('\n').filter(Boolean).forEach((line, i) => {
    const r = JSON.parse(line); if (r.verdict !== 'ok' || rej.has(i)) return;
    const q = r.q; if (!q?.cs?.choices || !q?.en?.choices || q.cs.choices.length !== q.en.choices.length || q.cs.choices.length < 3) return;
    const item = { kind: 'choice', w: r.w, d: r.d, pack: r.pack, cs: q.cs, en: q.en, correct_index: q.correct_index ?? 0 };
    if (q.fact_cs || q.fact_en) item.fact = { cs: String(q.fact_cs || '').slice(0, 220), en: String(q.fact_en || '').slice(0, 220), src: String(q.source || '').slice(0, 80) };
    if (out.some(o => isDup(o, item))) { dups++; return; }
    packFactIds.set(item, 'pack' + i); out.push(item); added++;
    if (process.env.LIST && i >= +process.env.LIST) console.log(`${i} ${r.pack} ${r.d[0]}${r.d === 'extreme' ? 'x' : ''}: ${q.cs.text} => ${q.cs.choices.map((x, j) => j === item.correct_index ? '*' + x : x).join(' | ')}`);
  });
  console.log('balíčky: přidáno', added, 'duplicit vynecháno', dups);
}

// Zajímavosti, které neprošly samostatnou kontrolou (content/facts-check-1.1.jsonl, id gen<i>|<jazyk>), vynechat
if (CHECK) {
  const ok = new Map(fs.readFileSync(CHECK, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)).map(r => [r.id, String(r.ok).toLowerCase() === 'yes']));
  out.forEach((o, i) => { if (!o.fact) return; const fid = packFactIds.get(o) || `gen${i}`; for (const lang of ['cs', 'en']) if (!ok.get(`${fid}|${lang}`)) delete o.fact[lang]; if (!o.fact.cs && !o.fact.en) delete o.fact; });
}
// Stejné obecné zadání časové osy ve stejné sadě → neviditelné rozlišení (zero-width), text zůstane stejný
const seen = new Map();
for (const o of out) for (const lang of ['cs', 'en']) { const k = `${lang}|${o.w}|${o.d}|${o[lang].text}`; const n = seen.get(k) || 0; seen.set(k, n + 1); if (n) o[lang].text += '\u200b'.repeat(n); }
fs.writeFileSync(new URL('../js/challenges-gen.js', import.meta.url),
  `// GENEROVÁNO: node scripts/build-gen-questions.mjs (${new Date().toISOString().slice(0, 10)}) – needitovat ručně, upravit content/gen-1.1-keep.json\n` +
  `// Otázky 1.1 vygenerované přes n8n agenta, ověřené druhým průchodem a ručně vybrané (${out.length} ks).\n` +
  `export const GEN_QUESTIONS = [\n${out.map(o => '  ' + JSON.stringify(o) + ',').join('\n')}\n];\n`);
console.log('otázek', out.length);
