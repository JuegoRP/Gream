// (audit) Tutoriál + zahrada na iPhonu/Androidu se simulovaným výřezem: node audit/checks/safe_area_tutorial.mjs <url> <out> <název> <šířka> <výška> <horní> <dolní okraj>
// Tutoriál + zahrada na různých telefonech se simulovanými okraji: node tut.mjs URL OUT name W H SAT SAB
import fs from 'node:fs';
const { webkit, chromium, devices } = await import('playwright');
const [URL, OUT, NAME, W, H, SAT, SAB] = process.argv.slice(2); fs.mkdirSync(OUT, { recursive: true });
const eng = NAME.startsWith('android') ? chromium : webkit;
const b = await eng.launch();
const ctx = await b.newContext({ viewport: { width: +W, height: +H }, deviceScaleFactor: 2, hasTouch: true });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e).slice(0, 200)));
const fixEnv = (t) => t.replace(/env\(\s*safe-area-inset-top[^)]*\)/g, SAT + 'px').replace(/env\(\s*safe-area-inset-bottom[^)]*\)/g, SAB + 'px').replace(/env\(\s*safe-area-inset-(left|right)[^)]*\)/g, '0px');
await page.route(/\.(css|js|html)(\?.*)?$/, async (r) => { const res = await r.fetch(); r.fulfill({ response: res, body: fixEnv(await res.text()) }); });
await page.goto(URL); await page.waitForTimeout(2000);
await page.evaluate(async () => { const { Profiles } = await import('./js/profiles.js'); const { Gream } = await import('./js/gream.js'); const { Skins } = await import('./js/skins.js');
  const p = Profiles.create({ name: 'Ema', avatar: '🦊', lang: 'cs' }); Profiles.setActive(p.id); Gream.createStarter(p.id); Skins.addSeeds(p.id, 50); });
await page.reload(); await page.waitForTimeout(4000);
const res = [];
for (let i = 0; i < 7; i++) {
  if (!(await page.$('#tutNext'))) { res.push(`krok ${i + 1}: tutoriál nenalezen`); break; }
  const m = await page.evaluate(() => { const c = document.querySelector('.tut-card').getBoundingClientRect(), t = document.querySelector('.tab-bar')?.getBoundingClientRect(); const sat = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sat')) || 0;
    return { top: Math.round(c.top), bottom: Math.round(c.bottom), tab: Math.round(t?.top ?? innerHeight), sat }; });
  res.push(`krok ${i + 1}: karta ${m.top}–${m.bottom}, lišta od ${m.tab}${m.bottom > m.tab ? ' ✗ PŘES LIŠTU' : ''}${m.top < m.sat ? ' ✗ POD VÝŘEZ' : ''}`);
  await page.screenshot({ path: `${OUT}/${NAME}-tut${i + 1}.png` });
  await page.click('#tutNext'); await page.waitForTimeout(400);
}
await page.waitForTimeout(500);
await page.evaluate(() => document.querySelectorAll('.toast,#toast').forEach(x => x.remove()));
const fit = await page.evaluate(() => { const s = document.getElementById('screen-map'); const a = document.querySelector('.home-actions').getBoundingClientRect(); const t = document.querySelector('.tab-bar').getBoundingClientRect();
  return { over: s.scrollHeight - s.clientHeight, actionsBottom: Math.round(a.bottom), tabTop: Math.round(t.top), stage: document.getElementById('greamStage').offsetHeight }; });
res.push(`zahrada: tlačítka končí ${fit.actionsBottom}, lišta od ${fit.tabTop}${fit.actionsBottom > fit.tabTop ? ' ✗ POD LIŠTOU' : ' OK'}, scéna ${fit.stage}px, přetéká ${fit.over}px`);
await page.screenshot({ path: `${OUT}/${NAME}-zahrada.png` });
console.log(NAME, '\n ' + res.join('\n ') + (errs.length ? '\n chyby: ' + errs.join(' | ') : ''));
await b.close();
