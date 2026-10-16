// Sestaví js/subcats-data.js z výsledků klasifikace (content/subcats-1.1.jsonl, vytvořeno scripts/classify-subcats.mjs přes n8n agenta).
// node scripts/build-subcats.mjs
import fs from 'node:fs';
const rows = fs.readFileSync('content/subcats-1.1.jsonl', 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
const out = { cs: {}, en: {} };
for (const r of rows) {
  const i = r.k.lastIndexOf(':#'), grp = r.k.slice(0, i), h = r.k.slice(i + 2);
  ((out[r.l] ||= {})[grp] ||= {})[h] = r.t ? `${r.s}|${r.t}` : r.s;
}
const tax = JSON.parse(fs.readFileSync('content/subcats-taxonomy.json', 'utf8')); delete tax._info;
fs.writeFileSync('js/subcats-data.js', `// GENEROVÁNO scripts/build-subcats.mjs – needitovat ručně.
// Podkategorie otázek: SUBCAT_DATA[jazyk]["svět:obtížnost"][hash z challengeId] = "hlavní" nebo "hlavní|vedlejší"
export const SUBCAT_TAXONOMY = ${JSON.stringify(tax)};
export const SUBCAT_DATA = ${JSON.stringify(out)};
`);
console.log('podkategorií:', rows.length);
