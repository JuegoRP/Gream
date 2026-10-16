// Generátor jednorázových promo kódů Gream Plus (kód = 1 použití = 1 zařízení natrvalo).
// Kódy žijí JEN na serveru v gream-data/promo.json (nikdy v repu). Server (/promo) soubor čte při každém pokusu.
//
// Na VPS (hostitel nemá node → přes kontejner node):
//   docker run --rm -v /opt/roman-storage/gream-data:/data -v /cesta/promo-codes.mjs:/p.mjs:ro node:20-alpine node /p.mjs <příkaz>
// Příkazy:
//   add <počet> [poznámka]   vytvoří nové kódy a vypíše je (např. add 20 "známí – test 1.1")
//   list                     přehled: kód, použitý/volný, poznámka
//   off <KÓD>                zneplatní kód
// Lokálně / v testu: PROMO_FILE=/tmp/promo.json node scripts/promo-codes.mjs add 3
import fs from 'node:fs';
import crypto from 'node:crypto';

const FILE = process.env.PROMO_FILE || '/data/promo.json';
const ABC = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';   // bez 0/O, 1/I/L – dobře se přepisuje z papíru
const part = () => Array.from(crypto.randomBytes(4), b => ABC[b % ABC.length]).join('');
const load = () => { try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return {}; } };
const save = (o) => { const tmp = FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(o, null, 1)); fs.renameSync(tmp, FILE); try { fs.chmodSync(FILE, 0o600); } catch {} };

const [cmd, a1, ...rest] = process.argv.slice(2);
const codes = load();
if (cmd === 'add') {
  const n = Math.max(1, Math.min(500, Number(a1) || 1)), note = rest.join(' ').slice(0, 80), day = new Date().toISOString().slice(0, 10);
  const out = [];
  while (out.length < n) { const c = `GREAM-${part()}-${part()}`; if (!codes[c]) { codes[c] = { max: 1, used: 0, note, created: day }; out.push(c); } }
  save(codes);
  console.log(out.join('\n'));
} else if (cmd === 'list') {
  for (const [k, v] of Object.entries(codes)) console.log(`${k}\t${v.off ? 'zrušený' : (v.used || 0) >= (v.max || 1) ? 'použitý' : 'volný'}\t${v.note || ''}\t${v.created || ''}`);
} else if (cmd === 'off' && a1) {
  const k = Object.keys(codes).find(x => x.toUpperCase() === a1.toUpperCase());
  if (!k) { console.error('kód nenalezen'); process.exit(1); }
  codes[k].off = true; save(codes); console.log('zrušen', k);
} else {
  console.log('použití: add <počet> [poznámka] | list | off <KÓD>'); process.exit(1);
}
