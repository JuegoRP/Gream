// ═══════════════════════════════════
//  GREAM — dev.js  (DEV MODE — testing only)
//  Zapnutí: otevři appku s ?dev  (přepíná gream_dev v localStorage)
//  Pak se vlevo dole objeví 🛠 tlačítko → dev panel.
//  Nic z tohohle se free uživateli nikdy nezobrazí (musí ho vědomě zapnout).
// ═══════════════════════════════════

import { Profiles } from './profiles.js';
import { Gream } from './gream.js';
import { Skins } from './skins.js';
import { Subscription } from './subscription.js';
import { Router } from './router.js';

const WORLDS = ['nature','language','logic','feelings','arts','world'];
const WORLD_ICONS = { nature:'🌿', language:'📖', logic:'🧩', feelings:'💛', arts:'🎨', world:'🌍' };
const KEY = 'gream_dev';

let _world = 'nature';

function refresh() {
  // re-render garden so pet/seeds update live
  try { window.App?.renderMap?.(); } catch {}
  renderPanel();
}

function toast(msg) {
  const t = document.createElement('div');
  t.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#222;color:#fff;padding:10px 16px;border-radius:20px;font:600 13px sans-serif;z-index:100001;box-shadow:0 4px 16px rgba(0,0,0,.3)';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 1800);
}

function statusLine() {
  const p = Profiles.active();
  if (!p) return 'Žádný profil';
  const g = Gream.active(p.id);
  const sub = Subscription.get(p.id);
  const seeds = Skins.getSeeds(p.id);
  const stage = g ? `${g.archetype || 'vejce'} · stage ${g.stage}${g.isShiny ? ' ✨' : ''} · ${g.tasksFor||0} úk.` : '—';
  return `${p.name} · 🌱 ${seeds} · ${sub.isPremium ? '⭐ Premium' : 'Free'} · ${p.difficulty||'medium'}\n🐣 ${stage}`;
}

function btn(label, onClick, bg = '#4a8a2e') {
  const b = document.createElement('button');
  b.textContent = label;
  b.style.cssText = `padding:9px 10px;border:none;border-radius:10px;background:${bg};color:#fff;font:700 12px sans-serif;cursor:pointer;text-align:center`;
  b.onclick = onClick;
  return b;
}

let _panel = null;
function renderPanel() {
  if (!_panel) return;
  const p = Profiles.active();
  const body = _panel.querySelector('#devBody');
  body.innerHTML = '';

  const status = document.createElement('div');
  status.style.cssText = 'white-space:pre-line;font:600 12px sans-serif;color:#eee;background:#111;border-radius:10px;padding:10px;margin-bottom:10px;line-height:1.5';
  status.textContent = statusLine();
  body.appendChild(status);

  if (!p) return;

  // World picker (for evolve/complete — určuje archetyp)
  const wLbl = document.createElement('div');
  wLbl.style.cssText = 'font:700 11px sans-serif;color:#aaa;margin-bottom:4px';
  wLbl.textContent = 'Svět (pro evoluci / úkol):';
  body.appendChild(wLbl);
  const wRow = document.createElement('div');
  wRow.style.cssText = 'display:flex;gap:4px;margin-bottom:10px;flex-wrap:wrap';
  WORLDS.forEach(w => {
    const wb = btn(WORLD_ICONS[w], () => { _world = w; renderPanel(); }, _world === w ? '#2d6518' : '#555');
    wb.style.flex = '1'; wb.style.fontSize = '16px';
    wRow.appendChild(wb);
  });
  body.appendChild(wRow);

  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:6px';

  grid.appendChild(btn('🌱 +50 semínek', () => { Skins.addSeeds(p.id, 50); toast('+50 🌱'); refresh(); }));
  grid.appendChild(btn('🐣 Evoluce +1', () => {
    const r = Gream.devAdvanceStage(p.id, _world);
    toast(r?.maxed ? 'Už je dospělý (stage 4)' : `→ stage ${r?.toStage}${r?.resolvedArchetype ? ' · '+r.resolvedArchetype : ''}`);
    refresh();
  }));
  grid.appendChild(btn('⚡ Max greamík', () => {
    let guard = 0, r;
    do { r = Gream.devAdvanceStage(p.id, _world); guard++; } while (r && !r.maxed && r.toStage < 4 && guard < 6);
    toast('Greamík na stage 4'); refresh();
  }));
  grid.appendChild(btn('🥚 Nové vejce', () => {
    const e = Gream.dropEgg(p.id);
    toast(e ? 'Přidáno nové vejce' : 'Max 4 greamíci'); refresh();
  }));
  grid.appendChild(btn('✅ Splň úkol', () => {
    const step = Profiles.getBadgeProgress(p.id, _world) || 0;
    Profiles.completeTask(p.id, _world, Math.min(step, 2), { outdoor:false });
    Gream.feedFromTask(p.id, _world);
    Skins.awardForTask(p.id, false, 1);
    toast(`+1 úkol (${_world})`); refresh();
  }));
  const sub = Subscription.get(p.id);
  grid.appendChild(btn(sub.isPremium ? '⭐ Premium: ZAP' : 'Premium: VYP', () => {
    if (Subscription.get(p.id).premiumSince) Subscription.cancelPremium(p.id);
    else Subscription.activatePremium(p.id);
    toast('Premium přepnuto'); refresh();
  }, sub.isPremium ? '#c8860a' : '#555'));

  body.appendChild(grid);

  // Difficulty row
  const dLbl = document.createElement('div');
  dLbl.style.cssText = 'font:700 11px sans-serif;color:#aaa;margin:10px 0 4px';
  dLbl.textContent = 'Obtížnost:';
  body.appendChild(dLbl);
  const dRow = document.createElement('div');
  dRow.style.cssText = 'display:flex;gap:4px;margin-bottom:6px';
  [['easy','🟢'],['medium','🟡'],['hard','🔴'],['extreme','⚡']].forEach(([d,e]) => {
    const db = btn(e, () => { Profiles.update(p.id, { difficulty: d }); toast('Obtížnost: '+d); refresh(); },
                   p.difficulty === d ? '#2d6518' : '#555');
    db.style.flex = '1'; db.style.fontSize = '15px';
    dRow.appendChild(db);
  });
  body.appendChild(dRow);

  // Navigation row
  const nLbl = document.createElement('div');
  nLbl.style.cssText = 'font:700 11px sans-serif;color:#aaa;margin:10px 0 4px';
  nLbl.textContent = 'Skok na obrazovku:';
  body.appendChild(nLbl);
  const nRow = document.createElement('div');
  nRow.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px';
  [['home','Domů'],['map-view','Mapa'],['hub','Hub'],['badges','Odznaky'],['wardrobe','Šatník'],['stats','Statistiky']].forEach(([s,l]) => {
    nRow.appendChild(btn(l, () => { close(); Router.show(s); }, '#3a5a8a'));
  });
  body.appendChild(nRow);

  // Danger
  const dz = btn('🗑 Smazat VŠECHNA data', () => {
    if (confirm('Opravdu smazat všechna data (profily, greamíci, semínka)? Nevratné.')) {
      localStorage.clear(); location.reload();
    }
  }, '#a53d33');
  dz.style.cssText += ';margin-top:12px;width:100%';
  body.appendChild(dz);
}

function open() {
  if (_panel) { close(); return; }
  _panel = document.createElement('div');
  _panel.style.cssText = 'position:fixed;inset:auto 12px 68px 12px;max-width:360px;margin:0 auto;background:#1a1a1a;border:2px solid #4a8a2e;border-radius:16px;padding:14px;z-index:100000;box-shadow:0 8px 40px rgba(0,0,0,.5);max-height:70vh;overflow-y:auto';
  const head = document.createElement('div');
  head.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:10px';
  head.innerHTML = '<div style="font:900 14px sans-serif;color:#7ec44a">🛠 DEV MODE</div>';
  const x = btn('✕', close, '#444'); x.style.padding = '4px 10px';
  head.appendChild(x);
  _panel.appendChild(head);
  const bodyEl = document.createElement('div');
  bodyEl.id = 'devBody';
  _panel.appendChild(bodyEl);
  document.body.appendChild(_panel);
  renderPanel();
}
function close() { _panel?.remove(); _panel = null; }

function showFab() {
  if (document.getElementById('devFab')) return;
  const fab = document.createElement('button');
  fab.id = 'devFab';
  fab.textContent = '🛠';
  fab.title = 'Dev panel';
  fab.style.cssText = 'position:fixed;left:12px;bottom:12px;width:44px;height:44px;border-radius:50%;border:none;background:#1a1a1a;color:#7ec44a;font-size:20px;cursor:pointer;z-index:99999;box-shadow:0 3px 12px rgba(0,0,0,.4);opacity:.85';
  fab.onclick = open;
  document.body.appendChild(fab);
}

export const Dev = {
  init() {
    const params = new URLSearchParams(location.search);
    if (params.has('dev')) {
      const on = localStorage.getItem(KEY) !== '1';
      localStorage.setItem(KEY, on ? '1' : '0');
    }
    if (localStorage.getItem(KEY) === '1') showFab();
  },
  open,
  enable() { localStorage.setItem(KEY, '1'); showFab(); },
};
