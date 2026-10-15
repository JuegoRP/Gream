// Kontrola pravdivosti otázek – export a sestavení zajímavostí „Víš, že…?“
//   node scripts/qa-questions.mjs export <cs|en> <out.json>      – otázky k ověření (id = challengeId z textu v daném jazyce)
//   node scripts/qa-questions.mjs facts <qa-cs.jsonl> <qa-en.jsonl> – zapíše js/facts-data.js (jen otázky s verdiktem „ok“ / opravené)
// Ověřování běží přes n8n agenta (3R Control kontejner, qa-run.mjs) – výsledky jsou JSONL: id, verdict, fact_cs, fact_en, source.
import fs from 'node:fs';
globalThis.localStorage ??= { getItem: () => null, setItem: () => {} };
globalThis.navigator ??= { language: 'cs' };
const { T } = await import('../js/i18n.js');
const { challengeId } = await import('../js/net.js');
const [cmd, a1, a2] = process.argv.slice(2);

const flat = (lang) => {
  const out = [];
  for (const [w, byD] of Object.entries(T[lang].challenges)) for (const [d, list] of Object.entries(byD)) list.forEach((ch, i) => {
    const c = ch.check || {};
    let answer;
    if (ch.action === 'choice') answer = (ch.choices || []).find(x => x.value === c.correct)?.text;
    else if (ch.action === 'number') answer = c.type === 'any' || c.answer == null ? null : `${c.answer}${c.tolerance ? ' ±' + c.tolerance : ''}${c.tolerancePct ? ' ±' + c.tolerancePct + ' %' : ''}`;
    else if (ch.action === 'sort') answer = (c.correct || ch.items || []).join(' → ');
    else if (ch.action === 'match') answer = JSON.stringify(ch.pairs);
    else answer = c.answer ?? c.correct ?? (c.accept || []).join(' / ');
    out.push({ id: challengeId(w, d, ch.text), w, d, i, type: ch.action, text: ch.text, choices: (ch.choices || []).map(x => x.text), answer: answer == null ? null : String(answer), lang });
  });
  return out;
};

if (cmd === 'export') {
  fs.writeFileSync(a2, JSON.stringify(flat(a1), null, 1));
  console.log('export', a1, flat(a1).length);
} else if (cmd === 'facts') {
  const read = (f) => f && fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)) : [];
  const live = { cs: new Set(flat('cs').map(q => q.id)), en: new Set(flat('en').map(q => q.id)) };
  const facts = {};
  for (const [lang, file] of [['cs', a1], ['en', a2]]) for (const r of read(file)) {
    const t = lang === 'cs' ? r.fact_cs : r.fact_en;
    if (!live[lang].has(r.id) || !t || !/^(ok|obtiznost)$/.test(r.verdict)) continue;   // jen ověřené otázky, které ve hře pořád jsou
    (facts[r.id] ||= {})[lang] = String(t).trim().slice(0, 220);
    if (r.source) facts[r.id].src = String(r.source).slice(0, 80);
  }
  const body = Object.entries(facts).sort().map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)},`).join('\n');
  fs.writeFileSync(new URL('../js/facts-data.js', import.meta.url), `// GENEROVÁNO: node scripts/qa-questions.mjs facts … (ověřeno fact-checkem, ${new Date().toISOString().slice(0, 10)})\n// Klíč = challengeId(svět, obtížnost, text otázky v daném jazyce) → { cs | en, src }\nexport const FACTS = {\n${body}\n};\n`);
  console.log('facts', Object.keys(facts).length);
}
