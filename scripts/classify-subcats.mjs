// Klasifikace otázek do podkategorií přes n8n agenta. node classify.mjs all.json tax.json out.jsonl
import fs from 'node:fs';
const [IN, TAX, OUT] = process.argv.slice(2);
const all = JSON.parse(fs.readFileSync(IN, 'utf8')), tax = JSON.parse(fs.readFileSync(TAX, 'utf8'));
const ids = new Set(); const lines = [];
for (const [w, subs] of Object.entries(tax)) { if (w.startsWith('_')) continue; lines.push(`${w}: ` + Object.entries(subs).map(([id, [cs]]) => { ids.add(id); return `${id} (${cs})`; }).join(', ')); }
const done = new Set(fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l).l + JSON.parse(l).k) : []);
const todo = all.filter(x => !done.has(x.l + x.k));
const B = 40, batches = []; for (let i = 0; i < todo.length; i += B) batches.push(todo.slice(i, i + B));
const prompt = (b) => `Úkol jen pro třídění, NEPOUŽÍVEJ žádné nástroje ani vyhledávání. Zařaď každou kvízovou otázku do podkategorie.
Podkategorie (id a význam), seskupené podle světa:
${lines.join('\n')}
Pro každou otázku vrať "s" = hlavní podkategorie (nejlépe sedící, smí být i z jiného světa než je uveden u otázky) a "t" = vedlejší podkategorie, jen pokud se otázka zřetelně týká i jiného tématu, jinak null.
Vrať POUZE JSON pole: [{"i":0,"s":"animals","t":null}]
${JSON.stringify(b.map((x, i) => ({ i, svet: x.w, q: x.t, odpoved: x.a })))}`;
async function call(p) {
  const r = await fetch('http://n8n:5678/webhook/game-designer', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Webhook-Token': process.env.WEBHOOK_TOKEN }, body: JSON.stringify({ brief: p, entity: '3R Studio' }), signal: AbortSignal.timeout(240000) });
  const raw = await r.text(); let t = raw; try { const j = JSON.parse(raw); t = typeof j === 'string' ? j : String(j.output ?? j.text ?? raw); } catch {}
  const m = t.match(/\[[\s\S]*\]/); if (!m) throw new Error('bez JSON: ' + t.slice(0, 80)); return JSON.parse(m[0]);
}
let next = 0, ok = 0;
async function worker() {
  while (next < batches.length) {
    const bi = next++, b = batches[bi];
    for (let a = 1; a <= 3; a++) {
      try {
        const res = await call(prompt(b)); let n = 0;
        res.forEach(r => { const x = b[r.i]; if (!x || !ids.has(r.s)) return; n++; fs.appendFileSync(OUT, JSON.stringify({ l: x.l, k: x.k, s: r.s, t: ids.has(r.t) && r.t !== r.s ? r.t : null }) + '\n'); });
        ok += n; console.log(new Date().toISOString().slice(11, 19), `${bi + 1}/${batches.length}`, n + '/' + b.length); break;
      } catch (e) { console.log('chyba', bi, a, e.message.slice(0, 100)); }
    }
  }
}
console.log('otázek', todo.length, 'dávek', batches.length);
await Promise.all(Array.from({ length: +(process.env.CONC || 2) }, worker));
console.log('HOTOVO', ok);
