// Sestaví www/ pro Capacitor: zkopíruje JEN to, co hra potřebuje za běhu.
// Nic jiného (server/, test/, dokumenty, Assety/, .claude) se do aplikace nesmí dostat.
// Použití: node scripts/build-www.mjs   (pak: npx cap sync android)
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const OUT = path.join(ROOT, 'www');
const FILES = ['index.html', 'manifest.json', 'favicon.ico'];
const DIRS = ['css', 'js', 'screens', 'img', 'audio', 'icons', 'fonts', 'vendor'];
const SKIP = /(^|\/)(\.DS_Store|Thumbs\.db)$|\.(md|py|psd|xcf|map)$/i;

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
let n = 0, bytes = 0;
const copy = (rel) => {
  const src = path.join(ROOT, rel);
  if (SKIP.test(rel)) return;
  const st = fs.statSync(src);
  if (st.isDirectory()) { for (const f of fs.readdirSync(src)) copy(path.join(rel, f)); return; }
  fs.mkdirSync(path.dirname(path.join(OUT, rel)), { recursive: true });
  fs.copyFileSync(src, path.join(OUT, rel)); n++; bytes += st.size;
};
for (const f of [...FILES, ...DIRS]) {
  if (!fs.existsSync(path.join(ROOT, f))) { console.error(`CHYBÍ: ${f}`); process.exit(1); }
  copy(f);
}

// Kontrola: každý lokální odkaz v HTML/CSS/JS musí v www/ existovat
const missing = new Set();
const refRe = /(?:src|href)=["']([^"'#?:]+)["']|url\(["']?([^"')#?:]+)["']?\)|["'`]((?:img|audio|icons|fonts|vendor|screens|css|js)\/[^"'`$?#]+\.[a-z0-9]+)["'`]/gi;
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
for (const f of walk(OUT).filter(f => /\.(html|css|js)$/.test(f) && !f.includes(`${path.sep}vendor${path.sep}`))) {
  const txt = fs.readFileSync(f, 'utf8');
  for (const m of txt.matchAll(refRe)) {
    if (m[2] && !f.endsWith('.css')) continue;            // url(...) kontrolujeme jen v CSS
    const ref = m[1] || m[2] || m[3];
    if (!ref || ref.startsWith('/') || ref.startsWith('data') || ref.includes('${') || !/\.[a-z0-9]{2,5}$/i.test(ref)) continue;
    const base = f.endsWith('.css') ? path.dirname(f) : OUT;
    if (!fs.existsSync(path.resolve(base, ref)) && !fs.existsSync(path.resolve(path.dirname(f), ref))) missing.add(`${path.relative(OUT, f)} → ${ref}`);
  }
}
console.log(`www/: ${n} souborů, ${(bytes / 1048576).toFixed(1)} MB`);
if (missing.size) { console.error(`Chybějící soubory (${missing.size}):\n  ` + [...missing].slice(0, 30).join('\n  ')); process.exit(1); }
