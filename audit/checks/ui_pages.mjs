// Audit UI: projde všechny obrazovky na iPhonu (WebKit = Safari) nebo Chromiu, uloží snímky, hlásí chyby konzole a přetékání.
// Použití: node audit/checks/ui_pages.mjs <url index.html> <výstupní složka> [webkit|chromium] [uživatel:heslo]
// Potřebuje playwright (npm i playwright && npx playwright install webkit) – mimo repo, např. ve scratchpadu: NODE_PATH=…/node_modules
import fs from 'node:fs';
const { webkit, chromium, devices } = await import('playwright');
const [URL, OUT = 'audit/shots', ENGINE = 'webkit', AUTH] = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });
const browser = await (ENGINE === 'chromium' ? chromium : webkit).launch();
const ctx = await browser.newContext({ ...devices['iPhone 13'], ...(AUTH ? { httpCredentials: { username: AUTH.split(':')[0], password: AUTH.split(':').slice(1).join(':') } } : {}) });
const page = await ctx.newPage();
// Testy NESMÍ zapisovat na ostrý server (žebříčky, souboje, ligy): zápisy na API se podvrhnou, čtení projde
await page.route(/3rstudio\.eu\/api\/gream\//, (r) => r.request().method() === 'GET' ? r.continue() : r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"ok":true}' }));
const issues = [];
page.on('console', m => { if (m.type() === 'error') issues.push(`console: ${m.text().slice(0, 160)}`); });
page.on('pageerror', e => issues.push(`pageerror: ${String(e).slice(0, 160)}`));
page.on('requestfailed', r => issues.push(`requestfailed: ${r.url().slice(-80)} ${r.failure()?.errorText}`));
await page.goto(URL); await page.waitForTimeout(3000);
await page.evaluate(async () => {
  localStorage.setItem('gream_tutorial_v1', '1');
  const { Profiles } = await import('./js/profiles.js'); const { Gream } = await import('./js/gream.js'); const { Skins } = await import('./js/skins.js');
  const p = Profiles.create({ name: 'Ema', avatar: '🦊', lang: 'cs' }); Profiles.setActive(p.id);
  Gream.createStarter(p.id); Gream.devAdvanceStage(p.id, 'nature'); Gream.devAdvanceStage(p.id, 'nature');
  Gream.addNewGream(p.id, 'kamen'); Gream.dropEgg(p.id);
  for (let i = 0; i < 34; i++) Profiles.completeTask(p.id, ['nature', 'logic', 'world', 'arts', 'nature', 'world'][i % 6], i % 3, {});
  Skins.addSeeds(p.id, 2000); ['deco_bench', 'deco_pond', 'deco_mushroom'].forEach(x => Skins.buyDecor(p.id, x));
});
await page.reload(); await page.waitForTimeout(3500);
const shot = async (name) => {
  const ov = await page.evaluate(() => {
    const scr = [...document.querySelectorAll('.screen')].find(s => getComputedStyle(s).display !== 'none' && !s.classList.contains('hidden') && s.offsetParent !== null);
    return { doc: document.documentElement.scrollWidth - innerWidth, scr: scr ? scr.scrollWidth - scr.clientWidth : 0, id: scr?.id };
  });
  if (ov.doc > 2 || ov.scr > 2) issues.push(`přetéká do strany: ${name} (${JSON.stringify(ov)})`);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
};
const go = async (js, name, wait = 1400) => { await page.evaluate(js); await page.waitForTimeout(wait); await shot(name); };
await shot('01-zahrada');
await go(`App.showTab('hub')`, '02-ja');
await go(`App.goTo('greams')`, '03-greamici');
await go(`document.querySelector('#greamsList > div').click()`, '04-greamik-detail', 900);
await go(`App.goTo('wardrobe')`, '05-obchudek');
for (const t of ['decor', 'bg', 'boosts', 'avatars', 'frames']) await go(`App.wardSwitchTab('${t}')`, `06-obchod-${t}`, 900);
await go(`App.goTo('badges')`, '07-odznaky');
await go(`document.getElementById('screen-badges').scrollTop = 1200`, '07b-odznaky-dole', 500);
await go(`App.goTo('stats')`, '08-statistiky');
await go(`App.goTo('settings')`, '09-nastaveni');
await go(`App.goTo('history')`, '10-historie');
await go(`App.goTo('ranking')`, '11-zebricek', 2500);
await go(`App.showTab('map')`, '12-svet', 2500);
await go(`App.showTab('garden'); App.goTo('map')`, '13-zahrada-znovu');
await go(`App.openBattleIntro()`, '14-souboj-uvod');
await go(`document.getElementById('battleStartBtn')?.click()`, '15-souboj-kolo', 3000);
fs.writeFileSync(`${OUT}/issues.txt`, issues.join('\n'));
console.log(issues.length ? issues.join('\n') : 'bez chyb');
await browser.close();
