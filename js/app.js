// ═══════════════════════════════════
//  GREAM — app.js
//  Main controller, global App object
// ═══════════════════════════════════

import { getLang, setLang, tr } from './i18n.js';
import { Profiles } from './profiles.js';
import { Badges } from './badges.js';
import { Router } from './router.js';
import { Challenge } from './challenge.js';
// camera/draw/voice removed in v7
import { Stats } from './stats.js';
import { Feedback } from './feedback.js';
import { Geo, WORLD_EMOJIS, isBattleSpot } from './geo.js';
import { Skins, SKIN_CATALOG } from './skins.js';
import { MapView, PROXIMITY_M } from './mapview.js';
import { Dev } from './dev.js';
import { Battle, clearPoolCache } from './battle.js';
import { Net } from './net.js';
import { hasProfanity } from './profanity.js';
import { shinySource } from './shiny.js';
import { GardenLife } from './garden-life.js';
import { SPECIALS } from './battle-rules.js';
import { SUBCAT_TAXONOMY, subcatName, groupName } from './subcats.js';

// Rozmístění ve 2D zahradě (% světa; y = spodní hrana předmětu, čím víc, tím blíž).
// Sladěno s pozadím garden_wide.jpg: nic nestojí na cestičce (vede zleva y≈55 esíčkem dolů doprava y≈90),
// lavička a lucerna na jejím okraji, jezírko a hříbek na trávě vpravo, košíček a záhonek vlevo dole.
// base = podíl výšky obrázku, který tvoří podstavu (přes ni se nechodí)
const GARDEN_LAYOUT = {
  nest:           { x: 14, y: 92, base: 0.5 },
  deco_flowerbed: { x: 37, y: 99, base: 0.55 },
  deco_bench:     { x: 45, y: 75, base: 0.35 },
  deco_lantern:   { x: 55, y: 79, base: 0.15 },
  deco_birdhouse: { x: 63, y: 67, base: 0.06 },
  deco_pond:      { x: 81, y: 77, base: 0.85 },
  deco_mushroom:  { x: 94, y: 71, base: 0.3 },
};
const DECOR_ASPECT = { nest: 46 / 78, deco_flowerbed: 0.67, deco_bench: 0.75, deco_lantern: 1.67, deco_birdhouse: 2.77, deco_pond: 0.64, deco_mushroom: 1.14 };
import { Gream, ARCHETYPES, BASE_ARCHETYPES, eggLeaning, spritePath, smartSpritePath } from './gream.js';
import { Moods } from './moods.js';
import { Subscription, FREE } from './subscription.js';
const NAME_CHANGE_COST = 50;   // semínek za změnu jména (nejvýš jednou za 7 dní)
import { Paywall } from './paywall.js';
import { Content } from './content.js';
import { Billing } from './billing.js';
import { Ranking } from './ranking.js';
import { Audio } from './audio.js';
import { fillIcons } from './icons.js';
import { Expedition, REWARD as EXP_REWARD } from './expedition.js';
import { ParentGate, Playtime } from './parents.js';
window.__greamLoaded = true;
const escAttr = (x) => String(x ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); // modul hry se načetl (index.html pak neukáže „Failed to start“)

// ─── Global error boundary ───
// Catches uncaught errors and shows a friendly recovery UI instead of white screen
window.addEventListener('error', (e) => {
  console.error('[Gream] Uncaught error:', e.error || e.message);
  showErrorBoundary(e.error?.message || e.message || 'Unknown error');
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('[Gream] Unhandled promise rejection:', e.reason);
  showErrorBoundary(e.reason?.message || String(e.reason) || 'Unknown error');
});

let _errorShown = false;
function showErrorBoundary(msg) {
  if (_errorShown) return;
  _errorShown = true;
  setTimeout(() => { _errorShown = false; }, 5000);

  const lang = localStorage.getItem('gream_lang') || 'en';
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position:fixed; inset:0; background:rgba(15,42,7,0.85);
    display:flex; align-items:center; justify-content:center;
    z-index:9999; padding:20px; font-family:'Nunito',sans-serif;
  `;
  const card = document.createElement('div');
  card.style.cssText = `
    background:white; border-radius:24px; padding:24px;
    max-width:340px; width:100%; text-align:center;
    box-shadow:0 10px 30px rgba(0,0,0,0.3);
  `;
  card.innerHTML = `
    <div style="font-size:48px;margin-bottom:8px">😅</div>
    <h3 style="font-size:18px;font-weight:900;color:#1a3d0a;margin:0 0 8px">
      ${lang === 'cs' ? 'Něco se nepovedlo' : 'Something broke'}
    </h3>
    <p style="font-size:13px;color:#5a8f3a;font-weight:600;margin:0 0 14px;line-height:1.4">
      ${lang === 'cs' ? 'Zkus aplikaci načíst znovu.' : 'Try reloading the app.'}
    </p>
    <details style="font-size:11px;color:#888;text-align:left;margin-bottom:14px">
      <summary style="cursor:pointer;font-weight:700">${lang === 'cs' ? 'Detaily' : 'Details'}</summary>
      <pre style="white-space:pre-wrap;word-break:break-word;margin-top:8px;padding:8px;background:#f5f5f5;border-radius:6px;font-family:monospace;font-size:10px">${msg}</pre>
    </details>
    <button onclick="location.reload()" style="
      width:100%;padding:14px;border:none;border-radius:50px;
      background:linear-gradient(135deg,#5a8f3a,#2d5a1b);color:white;
      font-family:'Nunito',sans-serif;font-weight:800;font-size:15px;cursor:pointer
    ">${lang === 'cs' ? 'Načíst znovu' : 'Reload'}</button>
  `;
  overlay.appendChild(card);
  document.body.appendChild(overlay);
}

// ─── Service worker ───
// Enabled by default for offline support.
// Disable via URL: ?sw=off  → unregisters SW (for development)
// V aplikaci (Capacitor) jsou soubory přibalené → service worker nepotřebujeme
if ('serviceWorker' in navigator && !window.Capacitor?.isNativePlatform?.()) {
  const params = new URLSearchParams(location.search);
  if (params.get('sw') === 'off') {
    navigator.serviceWorker.getRegistrations().then(regs => {
      regs.forEach(r => r.unregister());
      console.log('[Gream] SW disabled via ?sw=off');
    }).catch(() => {});
  } else {
    // Register, but don't block app startup if it fails
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js')
        .then(reg => console.log('[Gream] SW registered:', reg.scope))
        .catch(err => console.warn('[Gream] SW registration failed:', err));
    });
  }
}

// ─── WORLD constants ───
const WORLDS = ['nature','language','logic','feelings','arts','world'];
const WORLD_ICONS = { nature:'🌿', language:'📖', logic:'🧩', feelings:'💛', arts:'🎨', world:'🌍' };

// ─── Scene generation helpers ───
function _genStars(tod) {
  const count = tod === 'night' ? 40 : 15;
  const stars = [];
  // Deterministic positions (seed-like using index)
  for (let i = 0; i < count; i++) {
    const x = ((i * 97 + 13) % 370) + 5;
    const y = ((i * 61 + 7)  % 80)  + 5;
    const r = i % 4 === 0 ? 1.5 : 0.8;
    const op = tod === 'night' ? (0.5 + (i % 5) * 0.1) : (0.2 + (i % 3) * 0.05);
    stars.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="white" opacity="${op.toFixed(2)}"/>`);
  }
  return stars.join('');
}

function _tree(x, h, trunkColor, leafColor, leafR, season) {
  const ly = 170 - h;
  const leafColors = season === 'autumn' ? ['#d4722a','#e8a030','#c85820'] :
                     season === 'winter' ? ['#7a9a8a','#6a8a7a'] :
                     season === 'spring' ? ['#88cc66','#66aa44','#ff99bb'] :
                                           [leafColor, '#3a7a1e','#2d6518'];
  const lc = leafColors[x % leafColors.length];
  return `<rect x="${x-4}" y="${ly+leafR}" width="8" height="${h - leafR}" fill="${trunkColor}"/>
    <circle cx="${x}" cy="${ly}" r="${leafR}" fill="${lc}" opacity="0.92"/>
    ${season === 'winter' ? `<circle cx="${x}" cy="${ly}" r="${leafR*0.4}" fill="white" opacity="0.5"/>` : ''}
    ${season === 'spring' && x%3===0 ? `<circle cx="${x+leafR*0.5}" cy="${ly-leafR*0.3}" r="4" fill="#ffaac8" opacity="0.85"/>` : ''}`;
}

function _floraForest(season, tod) {
  const tc = '#5a3a1a', lc = '#3a7a1e';
  const trees = [
    _tree(30, 85, tc, lc, 30, season),
    _tree(340, 95, tc, lc, 34, season),
    _tree(290, 70, tc, lc, 26, season),
    _tree(70, 60, tc, lc, 22, season),
  ];
  const grass = season === 'winter' ? '' :
    `<ellipse cx="160" cy="170" rx="40" ry="6" fill="#5ab030" opacity="0.6"/>
     <ellipse cx="250" cy="172" rx="28" ry="4" fill="#4a9820" opacity="0.5"/>`;
  const snow = season === 'winter' ?
    `<ellipse cx="190" cy="170" rx="190" ry="10" fill="white" opacity="0.35"/>` : '';
  const firefly = tod === 'night' ?
    `<circle cx="130" cy="145" r="2" fill="#ccff66" opacity="0.8" filter="url(#glow)"/>
     <circle cx="210" cy="150" r="1.5" fill="#ccff66" opacity="0.7" filter="url(#glow)"/>` : '';
  return trees.join('') + grass + snow + firefly;
}

function _floraLibrary(season, tod) {
  // Cobblestone path + lanterns + bookish park feel
  const path = `<ellipse cx="190" cy="175" rx="60" ry="8" fill="#aa8855" opacity="0.45"/>`;
  const lantern = (x) => `
    <rect x="${x-3}" y="145" width="6" height="24" fill="#7a6040"/>
    <rect x="${x-7}" y="138" width="14" height="14" rx="3" fill="#ffd87a" opacity="0.85"/>
    <circle cx="${x}" cy="145" r="12" fill="#ffd87a" opacity="${tod==='day'?0.2:0.5}" filter="url(#glow)"/>`;
  const bench = `<rect x="150" y="163" width="60" height="6" rx="2" fill="#8a6040"/>
    <rect x="153" y="169" width="6" height="8" fill="#6a4820"/>
    <rect x="201" y="169" width="6" height="8" fill="#6a4820"/>`;
  const hedges = `<rect x="20" y="148" width="40" height="22" rx="6" fill="#3a7a2e"/>
    <rect x="310" y="148" width="50" height="22" rx="6" fill="#3a7a2e"/>`;
  return path + lantern(85) + lantern(295) + bench + hedges;
}

function _floraLab(season, tod) {
  // Crystal formations, geometric rocks
  const crystals = [
    [80, 165, 12, 35, '#7ab8d4'],
    [95, 158, 9, 28, '#9bcce8'],
    [68, 168, 7, 22, '#5a9ab8'],
    [290, 163, 14, 38, '#7ab8d4'],
    [308, 155, 10, 32, '#9bcce8'],
  ].map(([x,y,w,h,c]) =>
    `<polygon points="${x},${y} ${x-w/2},${y+h} ${x+w/2},${y+h}" fill="${c}" opacity="0.8"/>
     <polygon points="${x},${y+2} ${x-w/2+2},${y+h}" stroke="rgba(255,255,255,0.4)" stroke-width="1" fill="none"/>`
  ).join('');
  const grid = `<line x1="0" y1="172" x2="380" y2="172" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>`;
  return crystals + grid;
}

function _floraField(season, tod) {
  // Wildflowers, rolling hills
  const flowers = [];
  const fcolors = season === 'winter' ? ['#cce8ff','#aac8ee'] :
                  season === 'autumn' ? ['#ff8844','#ffaa22','#dd6622'] :
                                        ['#ff88aa','#ffcc44','#cc44ff','#44aaff'];
  for (let i = 0; i < 18; i++) {
    const x = 20 + (i * 21) % 340;
    const y = 158 + (i * 7) % 14;
    const c = fcolors[i % fcolors.length];
    flowers.push(`<circle cx="${x}" cy="${y}" r="4" fill="${c}" opacity="0.85"/>
      <rect x="${x-1}" y="${y+3}" width="2" height="8" fill="#4a8a2e" opacity="0.7"/>`);
  }
  // Heart in sky for feelings world
  const heart = tod === 'night' ? '' :
    `<path d="M190,60 C190,60 178,48 172,54 C166,60 178,72 190,82 C202,72 214,60 208,54 C202,48 190,60 190,60Z" fill="#ff6688" opacity="0.25"/>`;
  return flowers.join('') + heart;
}

function _floraStudio(season, tod) {
  // Paint splatters, easel, colorful mess
  const splatters = [
    [50, 160, 18, '#ff4488'],
    [320, 155, 14, '#4488ff'],
    [160, 165, 10, '#ffcc00'],
    [240, 162, 12, '#44cc88'],
    [100, 158, 8, '#ff8800'],
  ].map(([x,y,r,c]) =>
    `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" opacity="0.4"/>
     <circle cx="${x+r*0.4}" cy="${y-r*0.3}" r="${r*0.5}" fill="${c}" opacity="0.3"/>`
  ).join('');
  const easel = `<line x1="190" y1="120" x2="175" y2="170" stroke="#8a6040" stroke-width="3"/>
    <line x1="190" y1="120" x2="205" y2="170" stroke="#8a6040" stroke-width="3"/>
    <rect x="174" y="118" width="32" height="22" rx="2" fill="white" opacity="0.85"/>
    <rect x="176" y="120" width="28" height="18" fill="#eef8cc" opacity="0.7"/>`;
  return splatters + easel;
}

function _floraWorld(season, tod) {
  // Globe silhouette, world map vibes
  const globe = `<circle cx="190" cy="148" r="28" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="2"/>
    <ellipse cx="190" cy="148" rx="28" ry="10" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>
    <line x1="190" y1="120" x2="190" y2="176" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>`;
  const compass = `<circle cx="50" cy="155" r="12" fill="rgba(255,255,255,0.12)"/>
    <text x="50" y="159" text-anchor="middle" font-size="12" fill="rgba(255,255,255,0.5)">✦</text>`;
  const mountains = `<polygon points="300,170 320,138 340,170" fill="#4a6a8a" opacity="0.5"/>
    <polygon points="320,170 345,130 370,170" fill="#3a5a7a" opacity="0.6"/>
    <polygon points="320,138 332,150 345,130" fill="white" opacity="0.35"/>`;
  return globe + compass + mountains;
}
const AVATAR_POOL = ['chr_fox','chr_cat','chr_owl','chr_frog','chr_bear','chr_bunny'];   // postavičky zdarma (img/avatars)
let _obAv = AVATAR_POOL[Math.floor(Math.random() * AVATAR_POOL.length)];

// ═══════════════════════════════════
//  App — global namespace (window.App)
// ═══════════════════════════════════
window.App = {

  async init() {
    console.log('[Gream] Init starting...');
    this._initNativeBack();
    Playtime.start(() => Profiles.active()?.id);
    // Ask the OS not to evict our data (profiles, pet, progress live in
    // localStorage). iOS/Safari can clear WebView storage under space pressure;
    // losing a child's Gream is the worst possible bug. Best-effort, non-blocking.
    if (navigator.storage?.persist) {
      navigator.storage.persist()
        .then(granted => console.log('[Gream] Storage persisted:', granted))
        .catch(() => {});
    }
    Audio.init();
    // Resume AudioContext and start music on first user gesture (required for iOS)
    // Persistent listeners — retry on every touch until music is actually playing
    document.addEventListener('touchstart', () => Audio.onUserGesture(), { passive: true });
    document.addEventListener('click',      () => Audio.onUserGesture(), { passive: true });
    this._syncLangBtns();
    const profiles = Profiles.all();
    const active   = Profiles.active();
    console.log('[Gream] Profiles:', profiles.length, 'Active:', active?.name || 'none');

    // Nové otázky ze serveru: uložená kopie hned, novější verze na pozadí (jen data, přísně ověřená)
    try { Content.loadCached(); } catch {}
    Content.refresh().then(n => { if (n) clearPoolCache(); }).catch(() => {});
    if (active) this.applyCosmetics();
    // Doplňky byly zrušeny (2026-10-16): kdo nějaký koupil, dostane semínka zpět
    try {
      let back = 0; Profiles.all().forEach(pr => { back += Skins.refundAccessories(pr.id) + Skins.refundRemovedDecor(pr.id); });
      if (back) setTimeout(() => this._showToast(tr().acc_refund(back)), 2500);
    } catch {}

    if (!profiles.length) {
      console.log('[Gream] → onboarding');
      await Router.show('onboarding');
    } else if (active) {
      console.log('[Gream] → home (map)');
      await Router.show('map');
    } else {
      console.log('[Gream] → profiles');
      await Router.show('profiles');
    }
    this._initParallax();
    this._initRipple();
    this._initOfflineBanner();
    try { Geo.invalidateIfMoved(500); } catch {}
    // Prefetch frequently-used screens into cache so navigation is instant
    Router.prefetch(['challenge', 'step-done', 'badge-earned', 'home', 'map', 'hub']);
    console.log('[Gream] Init complete.');
    try { window.Dev = Dev; Dev.init(); } catch (e) { console.warn('[Gream] Dev init skipped:', e); }
    // Gream Plus: obchod Google Play (jen v aplikaci se zapnutým placením) + upozornění na konec týdne zdarma
    try { Billing.init(() => this.renderMap?.()); } catch (e) { console.warn('[Gream] Billing init:', e); }
    if (active) setTimeout(() => { try { Paywall.trialNotice(); } catch {} }, 3000);
  },

  // ─── Parallax clouds on scroll ───
  _initParallax() {
    let raf = null;
    const handler = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = null;
        const y = window.scrollY || document.documentElement.scrollTop || 0;
        document.querySelectorAll('.bg-nature .cloud').forEach((el, i) => {
          const speed = i % 2 === 0 ? 0.15 : 0.25;
          el.style.transform = `translateX(${y * speed * (i % 2 ? -1 : 1)}px)`;
        });
      });
    };
    window.addEventListener('scroll', handler, { passive: true });
  },

  // ─── Ripple effect on tappable elements ───
  _initRipple() {
    document.addEventListener('click', e => {
      const btn = e.target.closest('.btn-primary, .btn-action, .qa-btn, .av-opt, .lang-btn, .ward-tab');
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const ripple = document.createElement('span');
      ripple.className = 'gream-ripple';
      const size = Math.max(rect.width, rect.height);
      ripple.style.width  = ripple.style.height = size + 'px';
      ripple.style.left = (e.clientX - rect.left - size/2) + 'px';
      ripple.style.top  = (e.clientY - rect.top  - size/2) + 'px';
      btn.appendChild(ripple);
      setTimeout(() => ripple.remove(), 500);
    }, true);
  },

  // ─── Offline detection banner ───
  _initOfflineBanner() {
    const updateBanner = () => {
      let banner = document.getElementById('gream-offline-banner');
      if (navigator.onLine) {
        banner?.remove();
        return;
      }
      if (banner) return;
      const lang = getLang();
      banner = document.createElement('div');
      banner.id = 'gream-offline-banner';
      banner.style.cssText = `
        position:fixed; top:0; left:0; right:0; z-index:1001;
        background:#1a3d0a; color:white; padding:8px 16px;
        text-align:center; font-weight:800; font-size:13px;
        font-family:'Nunito',sans-serif;
      `;
      banner.textContent = lang === 'cs'
        ? '📡 Offline — některé funkce nemusí být dostupné'
        : '📡 Offline — some features may be unavailable';
      document.body.appendChild(banner);
    };
    window.addEventListener('online',  updateBanner);
    window.addEventListener('offline', updateBanner);
    updateBanner();
  },

  // ─── Apply equipped frame + background ───
  applyCosmetics() {
    const p = Profiles.active();
    if (!p) return;
    const eq = Skins.getEquipped(p.id);
    // Background — strip old bg-* classes and apply current
    document.body.className = document.body.className.replace(/\bbg-[\w]+/g,'').trim();
    const bg = Skins.findBackground(eq.bg);
    if (bg.cssClass) document.body.classList.add(bg.cssClass);
    // Frame — applied to map avatar element when present
    const av = document.getElementById('mapAv');
    if (av) {
      av.className = av.className.replace(/\bframe-[\w]+/g,'').trim();
      const fr = Skins.findFrame(eq.frame);
      if (fr.cssClass) av.classList.add(fr.cssClass);
    }
  },

  // ─── Navigation ───
  async goTo(screen, data) { await Router.show(screen, data); },
  back() { Router.back(); },

  // ─── Tab bar switching ───
  showTab(tab) {
    const lang = getLang();
    if (tab === 'garden') {
      Audio.switchScene('menu');
      Router.show('map');
    } else if (tab === 'map') {
      clearInterval(this._greamIdleTimer);
      Audio.switchScene('outdoor');
      this.openMapView('nature');
    } else if (tab === 'hub') {
      clearInterval(this._greamIdleTimer);
      Audio.switchScene('menu');
      Router.show('hub');
    }
    this._decorate();
  },

  // ─── Systémové tlačítko Zpět na Androidu (hra nemá historii prohlížeče → bez tohohle by Zpět zavřel aplikaci) ───
  _initNativeBack() {
    const CapApp = window.Capacitor?.isNativePlatform?.() && window.Capacitor.Plugins?.App;
    if (!CapApp) return;
    // Android: aplikace na pozadí / zamčený telefon → hudba stop (WebView nemusí poslat visibilitychange)
    CapApp.addListener('appStateChange', ({ isActive }) => (isActive ? Audio.foreground() : Audio.background()));
    CapApp.addListener('pause', () => Audio.background());
    CapApp.addListener('resume', () => Audio.foreground());
    CapApp.addListener('backButton', () => {
      // Souboj a průvodce: Zpět nic nedělá (žádný omylem přerušený souboj)
      if (document.getElementById('battleOverlay') || document.getElementById('battleBoardOverlay') || document.getElementById('tutOverlay')) return;
      // Otevřené okno → zavřít
      const modal = ['poiModalOverlay', 'infoModalOverlay', 'reportOverlay', 'outdoorSuggestionOverlay', 'resetConfirmOverlay']
        .map(id => document.getElementById(id)).find(Boolean);
      if (modal) { modal.remove(); return; }
      const cur = Router.current();
      if (!cur || ['map', 'home', 'onboarding', 'profiles'].includes(cur)) { CapApp.minimizeApp(); return; }
      if (['map-view', 'hub'].includes(cur)) { this.showTab('garden'); return; }
      if (cur === 'challenge') { Router.show('home'); return; }
      this.back();
    });
  },

  // ─── Sdílené prvky: ikony, popisky lišty a přístupnost tlačítek (po každé obrazovce i změně jazyka) ───
  _decorate() {
    const t = tr();
    fillIcons(document);
    this._setText('tabLblGarden', t.tab_garden);
    this._setText('tabLblMap',    t.tab_map);
    this._setText('tabLblHub',    t.tab_hub);
    document.querySelectorAll('.btn-back').forEach(b => b.setAttribute('aria-label', t.nav_back));
    const aria = { bcStatsBtn: t.open_stats, mapLocateBtn: t.map_locate, mapWorldsBtn: t.map_worlds };
    for (const [id, lbl] of Object.entries(aria)) document.getElementById(id)?.setAttribute('aria-label', lbl);
  },

  // ─── Hub screen ───
  async renderHub() {
    const p = Profiles.active();
    if (!p) return;
    const lang = getLang();
    const cs = lang === 'cs';

    // Avatar
    const hubAv = document.getElementById('hubAv');
    if (hubAv) this._applyAvatarToEl(hubAv, p);
    this._setText('hubName', p.name || '');
    this._setText('hubSeedsLbl', cs ? 'Semínka' : 'Seeds');
    this._setText('hubSeeds',    `🌱 ${Skins.getSeeds(p.id)}`);

    // Streak sub
    const streak = p.streak || 0;
    this._setText('hubSub', streak > 0
      ? `🔥 ${streak} ${cs ? (streak === 1 ? 'den v řadě' : streak < 5 ? 'dny v řadě' : 'dní v řadě') : (streak === 1 ? 'day streak' : 'day streak')}`
      : (cs ? 'Začni svou sérii!' : 'Start your streak!'));

    // Gream Plus — skryté, dokud není zapnuté placení (nebo testovací režim)
    const subSec = document.getElementById('hubSubscribeSection');
    if (subSec) {
      subSec.style.display = Subscription.paywallEnabled() ? 'block' : 'none';
      this._setText('hubSubscribeLbl', tr().plus_title + (Subscription.get().paid ? ' ✓' : ''));
    }

    // Labels (bilingual)
    const t = tr();
    const greams = Gream.all(p.id).filter(g => !g.archived);
    this._setText('hubGreamiciLbl', t.hub_greams);
    this._setText('hubGreamiciSub', t.hub_greams_sub(greams.filter(g => g.stage >= 2 && g.archetype).length, greams.filter(g => g.stage < 2 || !g.archetype).length));
    this._setText('hubShopLbl', t.hub_shop);
    this._setText('hubShopSub', t.hub_shop_sub);
    this._setText('hubStatsLbl', t.hub_stats);
    this._setText('hubStatsSub', t.hub_stats_sub);
    this._setText('hubRankLbl',   cs ? 'Žebříček'   : 'Ranking');
    this._setText('hubRankSub',   cs ? 'Porovnej se s ostatními' : 'Compare with others');
    this._setText('hubBadgesLbl', cs ? 'Odznaky'    : 'Badges');
    this._setText('hubBadgesSub', cs ? 'Tvůj postup' : 'Your progress');
    this._setText('hubHistLbl',   cs ? 'Historie'   : 'History');
    this._setText('hubHistSub',   cs ? 'Splněné úkoly' : 'Completed tasks');
    this._setText('hubSetLbl',    cs ? 'Nastavení'  : 'Settings');
    this._setText('hubSetSub',    cs ? 'Jazyk, profil, info' : 'Language, profile, info');

    // Also update tab labels
    this.showTab('hub');
  },

  // ─── Language (settings only) ───

  _syncLangBtns() {
    const l = getLang();
    document.getElementById('glEN')?.classList.toggle('active', l === 'en');
    document.getElementById('glCZ')?.classList.toggle('active', l === 'cs');
  },

  // ─── ONBOARDING v4 (6 steps with GDPR + egg reveal) ───
  _obStep: 1,
  _obConsent: false,

  renderOnboarding() {
    const t = tr();
    this._obStep = 1;
    this._obConsent = false;
    this._renderObStep();

    // Step 1
    this._setText('obTitle1', t.slogan);   // oficiální podtitul pod logem (logo nese název hry)
    this._setText('obSub1',   t.ob_v4_step1_sub);
    this._setText('obBtn1',   t.ob_v4_step1_btn);

    // Step 2 — Parent + GDPR
    this._setText('obTitle2', t.ob_v4_step2_title);
    this._setText('obSub2',   t.ob_v4_step2_sub);
    this._setText('obLegalDataName', t.ob_v4_legal_data_name);
    this._setText('obLegalDataDesc', t.ob_v4_legal_data_desc);
    this._setText('obLegalLocName',  t.ob_v4_legal_loc_name);
    this._setText('obLegalLocDesc',  t.ob_v4_legal_loc_desc);
    this._setText('obLegalCamName',  t.ob_v4_legal_cam_name);
    this._setText('obLegalCamDesc',  t.ob_v4_legal_cam_desc);
    this._setText('obLegalAdsName',  t.ob_v4_legal_ads_name);
    this._setText('obLegalAdsDesc',  t.ob_v4_legal_ads_desc);
    this._setText('obLegalFineprint', t.ob_v4_legal_fineprint);
    this._setText('obConsentText',   t.ob_v4_consent);
    this._setText('obBtn2',          t.ob_v4_step2_btn);

    // Step 3 — Greamíci story
    this._setText('obTitle3', t.ob_v4_step3_title);
    this._setText('obSub3',   t.ob_v4_step3_sub);
    this._setText('obBtn3',   t.ob_v4_step3_btn);

    // Step 4 — Permissions
    this._setText('obTitle4', t.ob_v4_step4_title);
    this._setText('obSub4',   t.ob_v4_step4_sub);
    this._setText('obBtn4',   t.ob_step3_btn);
    this._setText('obBtnSkip',t.ob_step3_skip);
    this._setText('obPermLocName', t.ob_perm_loc);
    this._setText('obPermLocDesc', t.ob_perm_loc_desc);
    this._setText('obPermSndName', t.ob_perm_snd);
    this._setText('obPermSndDesc', t.ob_perm_snd_desc);

    // Step 5 — Name + avatar + age
    this._setText('obTitle5', t.ob_v4_step5_title);
    this._setText('obSub5',   t.ob_v4_step5_sub);
    this._setAttr('nameInput', 'placeholder', t.ob_placeholder);
    this._setText('ob-av-lbl', t.ob_av);
    this._setText('btnOb',     t.ob_start);

    // Step 6 — Egg reveal
    this._setText('obTitle6', t.ob_v4_step6_title);
    this._setText('obSub6',   t.ob_v4_step6_sub);
    this._setText('obBtn6',   t.ob_v4_step6_btn);

    this._syncLangBtns();
    document.querySelectorAll('.av-opt').forEach(b => {
      b.classList.toggle('active', b.dataset.av === _obAv);
    });
    this.validateOb();
  },


  _renderObStep() {
    document.querySelectorAll('.ob-step').forEach(s => {
      s.classList.toggle('active', Number(s.dataset.step) === this._obStep);
    });
    document.querySelectorAll('.ob-dot').forEach(d => {
      d.classList.toggle('active', Number(d.dataset.step) === this._obStep);
    });
    if (this._obStep === 5) {
      setTimeout(() => document.getElementById('nameInput')?.focus(), 200);
    }
  },

  obToggleConsent() {
    const cb = document.getElementById('obConsentCheck');
    this._obConsent = !!cb?.checked;
    const btn = document.getElementById('obBtn2');
    if (btn) btn.disabled = !this._obConsent;
    if (this._obConsent) Feedback.tap();
  },

  obNext() {
    Feedback.tap();
    if (this._obStep === 2 && !this._obConsent) {
      // Block forward without consent
      const row = document.getElementById('obConsentRow');
      if (row) {
        row.classList.add('shake');
        setTimeout(() => row.classList.remove('shake'), 400);
      }
      return;
    }
    if (this._obStep < 6) {
      this._obStep++;
      this._renderObStep();
    }
  },

  obBack() {
    Feedback.tap();
    if (this._obStep > 1) {
      this._obStep--;
      this._renderObStep();
    }
  },

  // ─── Permission handlers ───
  async obAskLocation() {
    Feedback.click();
    const row   = document.getElementById('obPermLoc');
    const state = document.getElementById('obPermLocState');
    if (!('geolocation' in navigator)) {
      if (state) state.textContent = '✗';
      return;
    }
    try {
      await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          pos => resolve(pos),
          err => reject(err),
          { enableHighAccuracy: true, timeout: 8000 }
        );
      });
      row?.classList.add('granted');
      if (state) state.textContent = '✓';
    } catch {
      if (state) state.textContent = '✗';
    }
  },

  obAskSound() {
    Feedback.click();
    const row   = document.getElementById('obPermSnd');
    const state = document.getElementById('obPermSndState');
    Feedback.setSoundEnabled(true);
    Feedback.success();
    row?.classList.add('granted');
    if (state) state.textContent = '✓';
  },

  pickAvatar(el, emoji) {
    Feedback.tap();
    _obAv = emoji || el.dataset.av;
    document.querySelectorAll('.av-opt').forEach(b => b.classList.remove('active'));
    el.classList.add('active');
  },

  async pickAvatarPhoto() {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        _obAv = '__photo__';
        window._pendingPhoto = ev.target.result;
        const btn = document.querySelector('.av-photo-btn');
        if (btn) { btn.innerHTML = `<img src="${ev.target.result}" style="width:100%;height:100%;border-radius:50%;object-fit:cover">`; }
        document.querySelectorAll('.av-opt').forEach(b => b.classList.remove('active'));
      };
      reader.readAsDataURL(file);
    };
    input.click();
  },

  validateOb() {
    const v = document.getElementById('nameInput')?.value.trim();
    const btn = document.getElementById('btnOb');
    if (btn) btn.disabled = !v;
  },

  async createProfile() {
    const name = document.getElementById('nameInput')?.value.trim();
    if (!name) return;
    if (hasProfanity(name)) {
      Feedback.error?.();
      this._showToast(getLang() === 'cs' ? '🙈 Zvol prosím slušnější jméno.' : '🙈 Please choose a nicer name.');
      return;
    }
    Feedback.success();
    const chr = SKIN_CATALOG.char_avatars.find(c => c.id === _obAv);   // postavička (výchozí výběr)
    const p = Profiles.create({
      name,
      avatar: _obAv === '__photo__' ? '🧒' : chr ? chr.emoji : _obAv,
      lang: getLang()
    });
    if (chr) { Profiles.update(p.id, { avatarImg: chr.img }); Skins.setEquipped(p.id, 'avatar', chr.id); }
    if (_obAv === '__photo__' && window._pendingPhoto) {
      Profiles.savePhoto(p.id, window._pendingPhoto);
      window._pendingPhoto = null;
    }
    // Mark consent timestamp
    try { localStorage.setItem('gream_consent_at', String(Date.now())); } catch {}
    document.getElementById('nameInput').value = '';
    this.applyCosmetics();
    // Move to egg reveal step instead of jumping to map
    this._obStep = 6;
    this._renderObStep();
    Feedback.celebrate();
  },

  async obFinish() {
    Feedback.tap();
    await Router.show('home');
  },

  // ─── PROFILES ───
  async renderProfiles() {
    const t = tr();
    this._setText('ps-title', t.ps_title);
    this._setText('ps-sub',   t.ps_sub);
    this._setText('btnAdd',   t.ps_add);
    this._setText('lbl-set',  t.settings);

    const list = document.getElementById('profilesList');
    if (!list) return;
    list.innerHTML = '';
    const profiles = Profiles.all();
    const activeId = Profiles.active()?.id;

    if (!profiles.length) {
      list.innerHTML = `<div style="text-align:center;padding:22px;font-size:14px;color:var(--green-mid);font-weight:700">
        ${getLang()==='cs'?'Zatím žádný profil':'No profiles yet — add one!'}</div>`;
      return;
    }

    profiles.forEach(p => {
      const card = document.createElement('div');
      card.className = 'profile-card' + (p.id === activeId ? ' active' : '');
      const avEl  = Profiles.renderAvatar(p);
      const totalTasks = p.worldTasks ? Object.values(p.worldTasks).reduce((a,b)=>a+b,0) : 0;
      const lang = getLang();
      card.appendChild(avEl);
      card.innerHTML += `
        <div style="flex:1;min-width:0">
          <div class="p-name">${p.name}</div>
          <div class="p-meta">${totalTasks} ${lang === 'cs' ? 'splněných výzev' : 'tasks done'}</div>
        </div>
        <div class="p-streak">🔥 ${p.streak || 0}</div>
      `;
      card.onclick = () => this.selectProfile(p.id);
      list.appendChild(card);
    });
  },

  async selectProfile(id) {
    Profiles.setActive(id);
    const p = Profiles.all().find(x => x.id === id);
    if (p?.lang) { setLang(p.lang); this._syncLangBtns(); }
    this.applyCosmetics();
    await Router.show('map');
  },

  // ─── MAP ───
  async renderMap() {
    setTimeout(() => this._renderGardenDecor(), 0);
    const p = Profiles.active();
    if (!p) return Router.show('profiles');
    const streakResult = Profiles.checkStreak(p.id);

    // Daily login bonus — once per day
    const bonus = Skins.claimDailyBonus(p.id);
    if (bonus.claimed) {
      const l = getLang();
      setTimeout(() => this._showToast(
        l === 'cs' ? `🌱 +${bonus.amount} semínek za dnešní přihlášení!` : `🌱 +${bonus.amount} seeds for logging in today!`
      ), 1200);
    }

    Gream.tickMood(p.id);
    Moods.visit(p.id);   // po 2+ dnech pauzy: radost z návratu (nikdy smutek)

    let pet = Gream.active(p.id);
    if (!pet) {
      pet = Gream.createStarter(p.id);
    }

    const t = tr();
    const fresh = Profiles.active();
    const lang = getLang();

    // Avatar
    const mapAvEl = document.getElementById('mapAv');
    if (mapAvEl) this._applyAvatarToEl(mapAvEl, fresh);

    // Greeting
    this._setText('mapGreeting', (pet?.stage >= 2 && Moods.greeting(pet, fresh)) || Gream.getGreeting(pet, lang));
    this._setText('mapName', fresh.name);
    this._setText('streakNum', fresh.streak || 0);
    this._setText('seedNum',   Skins.getSeeds(fresh.id));

    // ─── Streak milestone overlay ───
    if (streakResult.isMilestone) {
      setTimeout(() => this._showStreakMilestone(streakResult.streak, lang), 600);
    }

    // ─── Stage info for active pet (shown below display name) ───
    const tasksDone = pet.tasksFor || 0;
    const showJarActive = pet.stage < 2 || !pet.archetype;
    if (showJarActive) {
      const remaining = Math.max(0, 12 - tasksDone);
      let stageInfo = '';
      if (remaining > 0) {
        stageInfo = lang === 'cs' ? `Ještě ${remaining} úkolů do vylíhnutí (venku 2×)` : `${remaining} more tasks to hatch (2× outdoors)`;
        if (tasksDone >= 4 && pet.taskByWorld) {
          const entries = Object.entries(pet.taskByWorld).sort((a,b) => b[1]-a[1]);
          const topWorld = entries[0]?.[0];
          const worldHints = { cs: { nature:'Cítím přírodu...', language:'Slyším slova...', logic:'Vnímám logiku...', feelings:'Cítím emoce...', arts:'Vidím barvy...', world:'Toužím po světě...' }, en: { nature:'I sense nature...', language:'I hear words...', logic:'I feel logic...', feelings:'I feel emotions...', arts:'I see colors...', world:'I long for the world...' } };
          const hint = worldHints[lang]?.[topWorld];
          if (hint) stageInfo += ` · ${hint}`;
        }
      } else {
        stageInfo = lang === 'cs' ? 'Brzy se vylíhne!' : 'Hatching soon!';
      }
      this._setText('greamStageInfo', stageInfo);
    } else {
      const stageNames = {
        cs: ['Mládě', 'Mladý', 'Dospívající', 'Dospělý'],
        en: ['Baby', 'Young', 'Teen', 'Adult']
      };
      const stageName = (stageNames[lang] || stageNames.cs)[pet.stage - 2] || '';
      this._setText('greamStageInfo',
        lang === 'cs' ? `${stageName} · ${tasksDone} úkolů` : `${stageName} · ${tasksDone} tasks`);
      this._renderNeedsBar(pet);
    }

    // ─── Multi-gream garden ───
    const allGreams = Gream.all(p.id).filter(g => !g.archived);
    this._renderGardenGreams(allGreams, pet, lang);

    const legacyJar = document.getElementById('homeJarWrap');
    const legacySprite = document.getElementById('greamSprite');
    const legacyShadow = document.getElementById('greamShadow');
    if (legacyJar) legacyJar.style.display = 'none';
    if (legacySprite) legacySprite.style.display = 'none';
    if (legacyShadow) legacyShadow.style.display = 'none';

    // ─── Dynamic background scene ───
    this._renderGreamScene(pet);
    this._maybeAddRainOverlay();
    this._renderFeedButton(p, pet, lang);

    // ─── Chat bubbles when 2+ greams are hatched ───
    clearTimeout(this._chatTimer);
    const hatchedGreams = allGreams.filter(g => g.stage >= 2 && g.archetype);
    if (hatchedGreams.length >= 2) this._startGardenChat(hatchedGreams, lang);

    // ─── Speech bubble greeting ───
    const speech = document.getElementById('greamSpeech');
    if (speech) {
      speech.textContent = (pet?.stage >= 2 && Moods.greeting(pet, fresh)) || Gream.getGreeting(pet, lang);
      speech.classList.add('show');
      setTimeout(() => speech.classList.remove('show'), 4000);
    }

    // ─── Ambient idle speech ───
    clearInterval(this._greamIdleTimer);
    if (pet?.archetype) {
      const idleLines = {
        cs: ['Dneska je krásně!', 'Pojď si hrát!', '🌱', 'Hmm...', 'Co děláš?', 'Jsem tady!', '✨'],
        en: ['Nice day!', 'Let\'s play!', '🌱', 'Hmm...', 'What\'s up?', 'I\'m here!', '✨']
      };
      this._greamIdleTimer = setInterval(() => {
        const el = document.getElementById('greamSpeech');
        if (!el) { clearInterval(this._greamIdleTimer); return; }
        const pr = Profiles.active(), g = pr && Gream.active(pr.id);
        const arr = idleLines[getLang()] || idleLines.en;
        el.textContent = (g && Moods.idle(g, pr)) || arr[Math.floor(Math.random() * arr.length)];
        el.classList.add('show');
        setTimeout(() => el.classList.remove('show'), 2500);
      }, 18000 + Math.random() * 14000);
    }

    // ─── Indoor / Outdoor button labels ───
    this._setText('hcIndoorTitle',  lang === 'cs' ? 'Domácí výzva' : 'Home challenge');
    this._setText('hcGoOutTitle',   lang === 'cs' ? 'Pojď ven'     : 'Go outside');
    this._setText('hcBattleTitle',  lang === 'cs' ? 'Souboj'       : 'Battle');
    this._setText('hcIndoorSub',    lang === 'cs' ? 'Krátký úkol z domova' : 'A quick task from home');
    this._setText('hcOutdoorTitle', lang === 'cs' ? 'Venkovní výzva' : 'Outdoor Quest');
    this._setText('hcOutdoorSub',   lang === 'cs' ? 'Nejbližší místo v okolí' : 'Nearest place near you');

    // Quick action labels
    this._setText('qaMapLbl',   t.map_view_btn);
    this._setText('qaWardLbl',  t.ward_title);
    this._setText('qaHistLbl',  t.history_btn);
    this._setText('qaRankLbl',  lang === 'cs' ? 'Žebříček' : 'Ranking');
    this._setText('qaSetLbl',   lang === 'cs' ? 'Nastavení' : 'Settings');

    this.applyCosmetics();

    // First-run tutorial
    const tutorialSeen = !!localStorage.getItem('gream_tutorial_v1');
    if (!tutorialSeen) {
      // Tutorial covers everything — don't show the hint arrow at the same time
      document.getElementById('frHint')?.remove();
      setTimeout(() => this._showTutorial(lang), 800);
    } else if ((pet.tasksFor || 0) === 0) {
      this._showFirstRunHint(lang);
    } else {
      document.getElementById('frHint')?.remove();
    }

    // Trial banner (first 7 days)
    this._renderTrialBanner(p.id, lang);

    // Denní limit výzev doma (jen zdarma verze po týdnu zdarma); venku bez limitu
    const sub        = Subscription.get();
    const indoorDone = Subscription.getIndoorToday();
    const limited    = Subscription.paywallEnabled() && !sub.isPremium;
    const hcIndoor = document.querySelector('.home-choice-indoor');
    if (hcIndoor) {
      let pill = document.getElementById('indoorPill');
      if (!pill && limited) {
        pill = document.createElement('div');
        pill.id = 'indoorPill';
        pill.style.cssText = 'position:absolute;top:8px;right:8px;font-size:10px;font-weight:800;padding:2px 8px;border-radius:50px;color:white';
        hcIndoor.style.position = 'relative';
        hcIndoor.appendChild(pill);
      }
      if (pill) {
        pill.style.display = limited ? '' : 'none';
        pill.textContent = `🏠 ${Math.min(indoorDone, FREE.homeTasks)}/${FREE.homeTasks}`;
        pill.style.background = indoorDone >= FREE.homeTasks ? 'rgba(200,70,50,0.75)' : 'rgba(0,0,0,0.15)';
      }
    }
    document.getElementById('outdoorPill')?.remove();

    // Toggle indoor/outdoor button: show outdoor when indoor is exhausted
    const indoorExhausted = limited && indoorDone >= FREE.homeTasks;
    const gardenIndoorBtn  = document.getElementById('gardenIndoorBtn');
    const gardenOutdoorBtn = document.getElementById('gardenOutdoorBtn');
    if (gardenIndoorBtn)  gardenIndoorBtn.style.display  = indoorExhausted ? 'none' : '';
    if (gardenOutdoorBtn) gardenOutdoorBtn.style.display = indoorExhausted ? '' : 'none';

    // Daily counter
    const todayCount = (fresh.completedToday || []).length;
    const totalWorlds = WORLDS.length;
    const dc = document.getElementById('dailyCounter');
    const dcText = document.getElementById('dailyCountText');
    const dcCountdown = document.getElementById('dailyCountdown');
    if (dc && dcText) {
      const isCs = lang === 'cs';
      if (todayCount === 0) {
        dc.style.display = 'none';
      } else if (todayCount >= totalWorlds) {
        dc.style.display = 'flex';
        dcText.textContent = isCs ? `🎉 Vše splněno! Další zítra` : `🎉 All done! New tasks tomorrow`;
        if (dcCountdown) dcCountdown.textContent = this._timeUntilMidnight(isCs);
      } else {
        dc.style.display = 'flex';
        dcText.textContent = isCs ? `Dnes splněno: ${todayCount}/${totalWorlds}` : `Today: ${todayCount}/${totalWorlds}`;
        if (dcCountdown) dcCountdown.textContent = '';
      }
    }

    // Difficulty quick-picker — highlight active button, set label
    const curDiff = p.difficulty || 'medium';
    this._setText('dqLabel', lang === 'cs' ? 'Obtížnost:' : 'Difficulty:');
    this._updateDiffPills(curDiff);
  },

  _updateDiffPills(diff) {
    document.querySelectorAll('.dq-btn').forEach(btn => {
      const active = btn.dataset.diff === diff;
      btn.style.background  = active ? 'var(--green-mid)' : 'rgba(255,255,255,0.85)';
      btn.style.color       = active ? 'white' : 'var(--green-mid)';
      btn.style.borderColor = active ? 'var(--green-mid)' : 'rgba(74,138,46,0.2)';
    });
  },

  openBattleIntro(opts) { opts = opts || {}; if (opts.spot === true) opts.spot = this._lastPoi ? { id: this._lastPoi.id, kind: this._lastPoi.kind } : null; Battle.intro(opts); },
  showBattleLeaderboard() { Battle.showLeaderboard(); },

  reportCurrentChallenge() {
    try { this.reportChallenge(Challenge.reportInfo()); } catch {}
  },

  // ─── Report a bad question → server (challengeId + reason + note) ───
  reportChallenge(info) {
    if (!info) return;
    const cs = getLang() === 'cs';
    const p = Profiles.active();
    const REASONS = cs
      ? [['wrong','Špatná odpověď'],['ambiguous','Nejednoznačné'],['typo','Překlep/chyba'],['too_hard','Moc těžké'],['other','Jiné']]
      : [['wrong','Wrong answer'],['ambiguous','Ambiguous'],['typo','Typo/error'],['too_hard','Too hard'],['other','Other']];
    document.getElementById('reportOverlay')?.remove();
    const ov = document.createElement('div');
    ov.id = 'reportOverlay';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(10,10,15,0.7);display:flex;align-items:flex-end;justify-content:center;z-index:1003;padding:0';
    ov.onclick = e => { if (e.target === ov) ov.remove(); };
    ov.innerHTML = `
      <div style="background:#fff;border-radius:22px 22px 0 0;max-width:480px;width:100%;padding:20px 20px 30px">
        <div style="width:36px;height:4px;background:rgba(0,0,0,0.12);border-radius:2px;margin:0 auto 16px"></div>
        <div style="font-size:17px;font-weight:900;color:var(--green-deep);margin-bottom:4px">🚩 ${cs?'Nahlásit otázku':'Report question'}</div>
        <div style="font-size:12px;color:#999;margin-bottom:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${info.text || ''}</div>
        <div style="font-size:12px;font-weight:800;color:#888;margin-bottom:6px">${cs?'Co je špatně?':'What\'s wrong?'}</div>
        <div id="repReasons" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px"></div>
        <textarea id="repNote" placeholder="${cs?'Napiš proč (nepovinné)…':'Tell us why (optional)…'}" style="width:100%;box-sizing:border-box;min-height:64px;border:2px solid rgba(0,0,0,0.12);border-radius:12px;padding:10px;font-family:inherit;font-size:14px;resize:vertical;margin-bottom:12px"></textarea>
        <button id="repSend" style="width:100%;padding:14px;border:none;border-radius:14px;background:var(--green-mid);color:#fff;font-family:inherit;font-weight:900;font-size:15px;cursor:pointer">${cs?'Odeslat':'Send'}</button>
      </div>`;
    document.body.appendChild(ov);
    let reason = 'wrong';
    const rr = ov.querySelector('#repReasons');
    REASONS.forEach(([id, label], i) => {
      const b = document.createElement('button');
      const active = i === 0;
      b.dataset.r = id;
      b.style.cssText = `padding:8px 12px;border-radius:50px;border:2px solid ${active?'var(--green-mid)':'rgba(0,0,0,0.12)'};background:${active?'var(--green-pale)':'#fff'};font-family:inherit;font-weight:700;font-size:13px;cursor:pointer;color:var(--green-deep)`;
      b.textContent = label;
      b.onclick = () => { reason = id; rr.querySelectorAll('button').forEach(x => { const on = x.dataset.r === id; x.style.borderColor = on?'var(--green-mid)':'rgba(0,0,0,0.12)'; x.style.background = on?'var(--green-pale)':'#fff'; }); };
      rr.appendChild(b);
    });
    ov.querySelector('#repSend').onclick = async () => {
      const note = ov.querySelector('#repNote').value.trim();
      ov.remove();
      Feedback.tap?.();
      this._showToast(cs ? '🚩 Díky, nahlášeno!' : '🚩 Thanks, reported!');
      Net.report({
        challengeId: info.id, world: info.world, difficulty: info.difficulty,
        text: info.enText || info.text, textCs: getLang() === 'cs' ? info.text : '', answer: info.answer || '', lang: getLang(), reason, note, pid: p?.id || '',
      });
    };
  },

  setDifficultyFromGarden(diff) {
    const p = Profiles.active();
    if (!p) return;
    Profiles.update(p.id, { difficulty: diff });
    this._updateDiffPills(diff);
    this._updateDiffBtns(diff);
    Feedback.tap();
  },

  // ─── Render mood ring (replaces 6-dot HP bar) ───
  _renderNeedsBar(pet) {
    const bar = document.getElementById('needsBar');
    if (!bar || !pet) return;
    const lang = getLang();
    const mood = pet.mood === 'sad' ? 'sad' : 'happy';
    const moodData = {
      happy: { emoji: '😊', color: 'var(--green-mid)', label: lang === 'cs' ? 'Šťastný' : 'Happy' },
      sad:   { emoji: '😢', color: '#6a9fe0',          label: lang === 'cs' ? 'Smutný'  : 'Sad'   },
    };
    const d = moodData[mood];
    bar.innerHTML = `
      <div style="display:flex;align-items:center;gap:6px;justify-content:center;padding:4px 12px;border-radius:50px;background:rgba(255,255,255,0.7);border:1.5px solid ${d.color}22;cursor:default" onclick="App.tapGream()">
        <span style="font-size:16px">${d.emoji}</span>
        <span style="font-size:11px;font-weight:800;color:${d.color}">${d.label}</span>
      </div>
    `;
    bar.style.justifyContent = 'center';
  },

  // ─── 2D zahrada: posuvný „svět“ (panorama) uvnitř #greamStage; ovládací prvky zůstávají pevně v rámu ───
  _gardenWorld() {
    const stage = document.getElementById('greamStage');
    if (!stage) return null;
    let scroll = stage.querySelector('.garden-scroll');
    if (!scroll) {
      scroll = document.createElement('div'); scroll.className = 'garden-scroll';
      const world = document.createElement('div'); world.className = 'garden-world'; world.dataset.wide = '1';   // všechna pozadí jsou panoramata – šířka musí sedět už při rozmístění greamíků
      scroll.appendChild(world);
      (stage.querySelector('.gream-floor') || stage.firstChild)?.after(scroll);
      if (!this._gardenResize) {
        this._gardenResize = () => this._sizeGardenWorld();
        window.addEventListener('resize', this._gardenResize);
      }
      // Scéna mění výšku i bez změny okna (proužek týdne zdarma, načtení písma, flex) → přepočítat šířku panoramatu,
      // jinak by obrázek byl užší než posuvná plocha a šipka by ujela za jeho konec
      if (window.ResizeObserver) { stage._ro?.disconnect(); stage._ro = new ResizeObserver(() => this._sizeGardenWorld()); stage._ro.observe(stage); }
    }
    return scroll.querySelector('.garden-world');
  },
  // Šířka světa: panorama 3 : 2 podle výšky scény (posouvá se do stran); kupované pozadí = jen šířka rámu
  _sizeGardenWorld() {
    const stage = document.getElementById('greamStage'), world = stage?.querySelector('.garden-world');
    if (!world) return;
    const wide = world.dataset.wide === '1';
    // panorama zvětšené 1,3× a ukotvené dole → méně oblohy, víc trávníku (obrázek 3 : 2)
    world.style.width = (wide ? Math.max(stage.clientWidth, Math.round(stage.clientHeight * 1.3 * 1.5)) : stage.clientWidth) + 'px';
    world.style.setProperty('--stage-w', stage.clientWidth + 'px');
    this._updateGardenArrows();
  },
  // Šipky na okrajích: ukazují, že zahrada pokračuje, a klepnutím ji posunou
  _updateGardenArrows() {
    const stage = document.getElementById('greamStage'), scroll = stage?.querySelector('.garden-scroll');
    if (!scroll) return;
    ['left', 'right'].forEach(side => {
      let b = stage.querySelector('.garden-arrow.' + side);
      if (!b) {
        b = document.createElement('button'); b.className = 'garden-arrow ' + side; b.type = 'button';
        b.setAttribute('aria-label', side === 'left' ? '←' : '→');
        // Vlastní animace místo scrollBy smooth: na iPhonu klepnutí během dojezdu po swipu jen zastavilo pohyb / smooth se přepsal.
        // Reaguje hned na dotyk (pointerdown), dojezd zastaví (overflow hidden na okamžik) a opakované klepnutí navazuje na cíl.
        const go = (e) => { e.preventDefault(); e.stopPropagation(); this._gardenScrollBy(scroll, (side === 'left' ? -1 : 1) * scroll.clientWidth * 0.7); };
        b.addEventListener('pointerdown', go);
        b.onclick = (e) => { e.stopPropagation(); if (!e.detail) go(e); };   // klávesnice / čtečka (bez ukazatele)
        stage.appendChild(b);
      }
      const more = side === 'left' ? scroll.scrollLeft > 8 : scroll.scrollLeft < scroll.scrollWidth - scroll.clientWidth - 8;
      b.classList.toggle('show', more);
    });
    if (!scroll._arrows) { scroll._arrows = true; scroll.addEventListener('scroll', () => this._updateGardenArrows(), { passive: true }); }
  },

  _gardenScrollBy(scroll, dx) {
    const max = scroll.scrollWidth - scroll.clientWidth;
    const from = scroll.scrollLeft;
    const to = Math.max(0, Math.min(max, (scroll._target ?? from) + dx));
    scroll._target = to;
    scroll.style.overflowX = 'hidden';                 // zastaví setrvačný dojezd swipu (iOS)
    cancelAnimationFrame(scroll._raf);
    const t0 = performance.now(), dur = 320;
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      scroll.scrollLeft = from + (to - from) * e;
      if (k < 1) scroll._raf = requestAnimationFrame(step);
      else { scroll._target = null; scroll.style.overflowX = ''; this._updateGardenArrows(); }
    };
    scroll._raf = requestAnimationFrame(step);
  },

  // Počká na obrázky aktuální obrazovky (img i pozadí zahrady i zdroje sprite canvasů), nejdéle maxMs
  async _imagesReady(maxMs = 2500) {
    const urls = new Set();
    const scr = document.querySelector('.screen:not(.hidden)') || document;
    scr.querySelectorAll('img[src]').forEach(i => urls.add(i.src));
    scr.querySelectorAll('canvas[data-sprite-sheet]').forEach(c => urls.add(c.dataset.spriteSheet));
    scr.querySelectorAll('.garden-world, .gream-stage').forEach(el => { const m = (el.style.backgroundImage || '').match(/url\(["']?([^"')]+)/); if (m) urls.add(m[1]); });
    const load = (u) => new Promise(res => { const i = new Image(); i.onload = i.onerror = () => (i.decode ? i.decode().catch(() => {}).then(res) : res()); i.src = u; });
    await Promise.race([Promise.all([...urls].map(load)), new Promise(r => setTimeout(r, maxMs))]);
  },

  // Výběr jiného greamíka v zahradě: jen přepnout „aktivního“ (velikost, jméno, pozdrav), nic znovu nevykreslovat
  _switchActiveInGarden(g, slot) {
    const p = Profiles.active(); if (!p) return;
    Gream.setActive(p.id, g.id);
    const lang = getLang(), world = slot.closest('.garden-world');
    world?.querySelectorAll('.garden-gream-slot.is-active').forEach(el => el.classList.remove('is-active'));
    slot.classList.add('is-active');
    (this._gardenLife?.actors || []).forEach(a => { a.active = a.id === g.id; this._gardenLife._place(a); });
    const egg = g.stage < 2 || !g.archetype;
    this._setText('greamDisplayName', egg ? (lang === 'cs' ? '🌱 Záhadné vajíčko' : '🌱 Mystery egg') : Gream.getDisplayName(g, lang));
    this._setText('mapGreeting', (g.stage >= 2 && Moods.greeting(g, Profiles.active())) || Gream.getGreeting(g, lang));
    this._gardenLife?.poke(g.id);
    if (g.archetype && g.stage >= 2) Audio.playCry(g.archetype, g.stage);
  },

  _renderGardenGreams(allGreams, activeGream, lang) {
    const stage = document.getElementById('greamStage');
    const world = this._gardenWorld();
    if (!stage || !world) return;
    const prevPos = this._gardenLife?.positions?.() || {};   // po klepnutí / výběru zůstanou greamíci, kde byli
    this._gardenLife?.stop();
    world.querySelectorAll('.garden-gream-slot, .garden-nest, .gw-fx').forEach(el => el.remove());
    stage.querySelectorAll(':scope > .garden-gream-slot, :scope > .garden-nest').forEach(el => el.remove());   // starý 1D rozvrh
    this._sizeGardenWorld();

    // Vejce leží v košíčku (stálé místo líhnutí), vylíhnutí greamíci chodí po zahradě
    const isEgg = (g) => g.stage < 2 || !g.archetype;
    const hatched = allGreams.filter(g => !isEgg(g));
    const eggs = allGreams.filter(isEgg);
    const NEST = GARDEN_LAYOUT.nest;
    const nest = document.createElement('img');
    nest.className = 'garden-nest';
    nest.src = 'img/zahrada/nest.png'; nest.alt = '';
    nest.style.cssText = `left:${NEST.x}%;top:${NEST.y}%;width:calc(var(--stage-w) * ${hatched.length ? 0.2 : 0.3});z-index:${Math.round(NEST.y * 10)}`;
    world.appendChild(nest);

    const actors = [];
    allGreams.forEach((g) => {
      const isActive = g.id === activeGream?.id;
      const showJar = isEgg(g);
      const slot = document.createElement('div');
      slot.className = 'garden-gream-slot' + (showJar ? ' gw-egg' : ' gw-slot idle') + (isActive ? ' is-active' : '');

      if (showJar) {
        // Vejce v košíčku: blízko vylíhnutí (8+ výzev) se kolébá
        const i = eggs.indexOf(g);
        const nw = hatched.length ? 0.2 : 0.3;   // šířka košíčku vůči rámu; vejce sedí v seně – před košíčkem, spodkem kousek pod horním okrajem (78×46)
        slot.style.cssText = `left:${NEST.x + (eggs.length > 1 ? (i - (eggs.length - 1) / 2) * 2.4 : 0)}%;top:calc(${NEST.y}% - var(--stage-w) * ${(nw * 46 / 78 * 0.42).toFixed(3)});z-index:${Math.round(NEST.y * 10) + 1};width:calc(var(--stage-w) * ${hatched.length ? 0.1 : 0.15})`;
        slot.innerHTML = `<img src="img/greamici/seed_1.png" alt="" style="width:100%;image-rendering:pixelated;display:block;transform-origin:50% 90%;
            ${g.tasksFor >= 8 ? 'animation:eggWobble 1.6s ease-in-out infinite;' : ''}${isActive ? '' : 'filter:brightness(.92);'}">`;
      } else {
        const arch = g.archetype;
        const stageN = Math.min(g.stage, 4);
        // Větší stádium → viditelně větší (stádium 2 = základ)
        const STAGE_SCALE = { 1: 0.85, 2: 1.0, 3: 1.2, 4: 1.56 };
        const gSize = Math.round(76 * (STAGE_SCALE[stageN] || 1));
        const an = g.isShiny ? ['greamShinyGlow 3s ease-in-out infinite'] : [];
        slot.innerHTML = `
          <div class="gw-body"><div class="gw-hop"><div class="gw-bob">
            <canvas data-sprite-sheet="img/greamici/${arch}_${stageN}.png"
              data-sprite-mood="${g.mood || 'happy'}" data-arch="${arch}" data-shiny="${g.isShiny ? '1' : ''}"
              width="${gSize}" height="${gSize}"
              style="width:${gSize}px;height:${gSize}px;image-rendering:pixelated;display:block;${an.length ? `animation:${an.join(', ')};` : ''}filter:drop-shadow(0 4px 6px rgba(0,0,0,0.22));"></canvas>
          </div></div></div>
          <div class="gw-shadow" style="width:${Math.round(gSize * 0.6)}px"></div>`;
        actors.push({ el: slot, id: g.id, active: isActive });
      }

      slot.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!slot.classList.contains('is-active')) {
          this._switchActiveInGarden(g, slot);   // bez překreslení zahrady (dřív všichni problikli)
          Feedback.tap();
        } else {
          this._gardenLife?.poke(g.id);
          this.tapGream(slot);
        }
      });
      world.appendChild(slot);
    });

    this._initSpriteCanvases(world);

    // Chování: greamíci chodí k předmětům v zahradě (výzdoba + košíček, když v něm je vejce)
    const p = Profiles.active();
    // rozměry předmětů v % světa (šířka) a % výšky scény (podstava) – greamíci je obcházejí
    const sw = stage.clientWidth || 360, sh = stage.clientHeight || 440, ww = world.clientWidth || sw;
    const dims = (id, wPctOfStage) => { const L = GARDEN_LAYOUT[id] || {}, wpx = wPctOfStage / 100 * sw;
      const hpx = wpx * (DECOR_ASPECT[id] || 0.7);
      return { w: wpx / ww * 100, d: hpx * (L.base ?? 0.4) / sh * 100, h: hpx / sh * 100 }; };
    const props = (p ? Skins.shownDecor(p.id) : []).map(it => ({ id: it.id, ...(GARDEN_LAYOUT[it.id] || { x: it.x, y: it.y }), ...dims(it.id, it.w) }));
    props.push({ id: 'nest', ...NEST, ...dims('nest', hatched.length ? 20 : 30), egg: eggs.length > 0 });
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    this._gardenLife = new GardenLife(world, { reduced });
    this._gardenLife.setProps(props);
    this._gardenLife.setActors(actors, prevPos);
    this._gardenLife.start();

    // Na začátku ukázat aktivního greamíka (nebo vejce) uprostřed rámu
    requestAnimationFrame(() => {
      const scroll = stage.querySelector('.garden-scroll');
      const focus = world.querySelector('.garden-gream-slot.is-active') || world.querySelector('.garden-gream-slot');
      if (scroll && focus && !this._gardenScrolled) {
        scroll.scrollLeft = Math.max(0, focus.offsetLeft - scroll.clientWidth / 2);
        this._gardenScrolled = true;
        this._updateGardenArrows();
      }
    });

    const activePet = activeGream;
    if (activePet) {
      const showJar = activePet.stage < 2 || !activePet.archetype;
      if (showJar) {
        this._setText('greamDisplayName', lang === 'cs' ? '🌱 Záhadné vajíčko' : '🌱 Mystery egg');
      } else {
        this._setText('greamDisplayName', Gream.getDisplayName(activePet, lang));
      }
    }
  },

  _maybeAddRainOverlay() {
    const stage = document.getElementById('greamStage');
    if (!stage) return;
    stage.querySelectorAll('.garden-rain').forEach(e => e.remove());

    const dateKey = new Date().toDateString();
    let hash = 0;
    for (const c of dateKey) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
    const shouldRain = (Math.abs(hash) % 100) < 15;
    if (!shouldRain) return;

    const rainEl = document.createElement('div');
    rainEl.className = 'garden-rain';
    rainEl.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:6';
    const drops = [];
    for (let i = 0; i < 18; i++) {
      const x = Math.random() * 100;
      const delay = Math.random() * 2;
      const dur = 0.7 + Math.random() * 0.5;
      drops.push(`<div style="position:absolute;left:${x}%;top:-10px;width:1.5px;height:${8+Math.random()*8}px;background:rgba(180,220,255,0.55);border-radius:2px;animation:rainFall ${dur}s linear ${delay}s infinite"></div>`);
    }
    rainEl.innerHTML = drops.join('');
    stage.appendChild(rainEl);

    if (!document.getElementById('rainKeyframe')) {
      const style = document.createElement('style');
      style.id = 'rainKeyframe';
      style.textContent = '@keyframes rainFall { from{top:-10px;opacity:0.7} to{top:110%;opacity:0.1} }';
      document.head.appendChild(style);
    }
  },

  // ─── User taps the Gream — playful reaction ───
  // ─── Sprite sheet rendering ───
  // Files: 256×256px, 2×2 grid, each cell 128×128px
  //   TL (0,0)=neutral  TR (128,0)=sad  BL (0,128)=serious  BR (128,128)=happy
  // Drawing: detect content bounding box → draw only that region → centered in canvas
  _moodToQuad(/* mood */) {
    // Always use the "happy" cell (bottom-right). The other cells are either empty
    // (left column) or hold the "sad" art whose baked-in checkerboard background
    // can't be cleanly removed — so we show the clean happy sprite for every mood.
    return [128, 128];
  },

  // Draw sprite sheet cell onto canvas, cropped to content and centered
  // 7. parametr byl doplněk (zrušeno 2026-10-16) – zůstává kvůli pořadí argumentů
  _drawSpriteCell(ctx, img, sx, sy, canvasW, canvasH, _acc = null, arch = null, shiny = false) {
    if (shiny && arch) img = shinySource(img, arch);
    // Use offscreen canvas to detect content bbox
    const off = document.createElement('canvas');
    off.width = 128; off.height = 128;
    const oCtx = off.getContext('2d');
    oCtx.clearRect(0, 0, 128, 128);
    oCtx.drawImage(img, sx, sy, 128, 128, 0, 0, 128, 128);

    const data = oCtx.getImageData(0, 0, 128, 128).data;
    let minX=128, minY=128, maxX=0, maxY=0;
    for (let y = 0; y < 128; y++) {
      for (let x = 0; x < 128; x++) {
        if (data[(y*128+x)*4+3] > 15) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < minX) { // empty
      ctx.clearRect(0, 0, canvasW, canvasH);
      return;
    }

    // Content dimensions with a small padding
    const PAD = 4;
    const cw = maxX - minX + 1 + PAD*2;
    const ch = maxY - minY + 1 + PAD*2;

    // Target 80% of canvas height so all archetypes appear at consistent visual size
    const scale = Math.min(canvasW * 0.80 / cw, canvasH * 0.80 / ch);
    const dw = Math.round(cw * scale);
    const dh = Math.round(ch * scale);
    const dx = Math.round((canvasW - dw) / 2); // center horizontally
    const dy = Math.round(canvasH - dh);         // bottom-align so sprite "stands"

    ctx.clearRect(0, 0, canvasW, canvasH);
    ctx.imageSmoothingEnabled = false;
    // Draw the cropped content region centered on the destination canvas
    ctx.drawImage(img,
      sx + minX - PAD, sy + minY - PAD, cw, ch,  // source: content bbox + padding
      dx, dy, dw, dh                               // dest: centered on canvas
    );
  },

  _initSpriteCanvases(root) {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const canvases = (root || document).querySelectorAll('canvas[data-sprite-sheet]');
    canvases.forEach(canvas => {
      const src  = canvas.dataset.spriteSheet;
      const mood = canvas.dataset.spriteMood || 'happy';
      const [sx, sy] = this._moodToQuad(mood);
      const cssW = parseInt(canvas.getAttribute('width')) || 52;
      const cssH = parseInt(canvas.getAttribute('height')) || 52;
      canvas.width  = cssW * dpr;
      canvas.height = cssH * dpr;
      canvas.style.width  = cssW + 'px';
      canvas.style.height = cssH + 'px';
      const img = new Image();
      img.src = src;
      const draw = () => {
        const ctx = canvas.getContext('2d');
        this._drawSpriteCell(ctx, img, sx, sy, cssW * dpr, cssH * dpr, null, canvas.dataset.arch || null, canvas.dataset.shiny === '1');
      };
      if (img.complete) draw();
      else { img.onload = draw; img.onerror = () => {}; }
    });
  },

  // ─── Render profile avatar: greamík canvas or emoji/photo ───
  _applyAvatarToEl(el, p) {
    if (!el || !p) return;
    const avId = Skins.getEquipped(p.id).avatar;
    if (avId?.startsWith('gream_')) {
      const arch = avId.slice(6);
      const pets = Gream.all(p.id).filter(g => !g.archived && g.archetype === arch && g.stage >= 2);
      if (pets.length) {
        const best = pets.reduce((a, b) => b.stage > a.stage ? b : a);
        const stage = Math.min(best.stage, 4);
        el.innerHTML = '';
        el.style.overflow = 'hidden';
        const size = el.offsetWidth || 44;
        const cv = document.createElement('canvas');
        cv.setAttribute('data-sprite-sheet', `img/greamici/${arch}_${stage}.png`);
        cv.setAttribute('data-sprite-mood', 'happy');
        cv.setAttribute('width', size); cv.setAttribute('height', size);
        cv.style.cssText = `width:${size}px;height:${size}px`;
        el.appendChild(cv);
        this._initSpriteCanvases(el);
        return;
      }
    }
    if (p.hasPhoto) {
      const photo = Profiles.getPhoto(p.id);
      if (photo) { el.innerHTML = `<img src="${photo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`; return; }
    }
    if (p.avatarImg) { el.innerHTML = `<img src="${p.avatarImg}" alt="" style="width:100%;height:100%;object-fit:contain">`; return; }
    el.textContent = p.avatar || '🧒';
  },

  _applyGreamSprite(spriteEl, pet) {
    const src = smartSpritePath(pet);

    // Stage 1 = seed — single full image
    if (!pet?.archetype || pet.stage < 2) {
      const old = document.getElementById('greamSpriteCanvas');
      if (old) { old.remove(); spriteEl.style.display = 'block'; }
      spriteEl.src = src;
      spriteEl.style.width  = '160px';
      spriteEl.style.height = '160px';
      spriteEl.style.objectFit = 'contain';
      spriteEl.style.imageRendering = 'pixelated';
      return;
    }

    const mood = pet.mood || 'happy';
    const [sx, sy] = this._moodToQuad(mood);
    const SIZE = 160;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);

    let canvas = document.getElementById('greamSpriteCanvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'greamSpriteCanvas';
      canvas.style.width  = SIZE + 'px';
      canvas.style.height = SIZE + 'px';
      canvas.onclick = spriteEl.onclick;
      spriteEl.parentElement.insertBefore(canvas, spriteEl);
      spriteEl.style.display = 'none';
    }
    // Keep canvas buffer matched to current DPR for crisp rendering on retina
    const bufW = SIZE * dpr;
    if (canvas.width !== bufW) { canvas.width = bufW; canvas.height = bufW; }
    canvas.classList.toggle('shiny', spriteEl.classList.contains('shiny'));

    const redraw = canvas.dataset.src !== src || canvas.dataset.mood !== mood || canvas.dataset.shiny !== (pet.isShiny ? '1' : '');
    if (redraw) {
      canvas.dataset.src  = src;
      canvas.dataset.mood = mood;
      canvas.dataset.shiny = pet.isShiny ? '1' : '';
      const img = new Image();
      img.src = src;
      const draw = () => this._drawSpriteCell(canvas.getContext('2d'), img, sx, sy, bufW, bufW, null, pet.archetype, !!pet.isShiny);
      img.onerror = () => {
        // Stage 3/4 not uploaded yet — fall back to stage 2
        const fallback = new Image();
        fallback.src = src.replace(/_[34]\.png$/, '_2.png');
        fallback.onload = () => this._drawSpriteCell(canvas.getContext('2d'), fallback, sx, sy, bufW, bufW);
      };
      if (img.complete && img.naturalWidth) draw();
      else img.onload = draw;
    }
  },

  tapGream(slot = null) {
    Feedback.pop();
    // Cute per-archetype cry (deeper the bigger the Gream)
    const _tp = Profiles.active();
    const _pet = _tp ? Gream.active(_tp.id) : null;
    if (_pet?.archetype && _pet.stage >= 2) Audio.playCry(_pet.archetype, _pet.stage);
    // Works with both canvas (sprite sheet) and original img element
    // 2D zahrada: poskočení dělá GardenLife.poke, tady jen jiskry v místě greamíka
    const target = slot ? null : (document.getElementById('greamSpriteCanvas') || document.getElementById('greamSprite'));
    if (!slot && !target) return;
    if (target) {
      target.classList.remove('tapped');
      void target.offsetWidth; // reflow
      target.classList.add('tapped');
      setTimeout(() => target.classList.remove('tapped'), 400);
    }
    let sparkAt = 'left:50%;top:42%;';
    if (slot) {
      const r = slot.getBoundingClientRect(), sr = document.getElementById('greamStage')?.getBoundingClientRect();
      if (sr) sparkAt = `left:${Math.round(r.left - sr.left + r.width / 2)}px;top:${Math.round(r.top - sr.top + r.height * 0.45)}px;`;
    }

    // Sparkle particle burst
    const stage = document.getElementById('greamStage');
    if (stage) {
      const colors = ['#87c26d','#ffd54f','#ff88aa','#88ccff','#ffffff','#ffaa44'];
      const count = 8;
      for (let i = 0; i < count; i++) {
        const p = document.createElement('div');
        const angle = (i / count) * Math.PI * 2;
        const dist  = 38 + Math.random() * 32;
        p.style.cssText = `
          position:absolute;width:7px;height:7px;border-radius:50%;
          background:${colors[i % colors.length]};
          ${sparkAt}pointer-events:none;z-index:20;
          --sx:${(Math.cos(angle) * dist).toFixed(1)}px;
          --sy:${(Math.sin(angle) * dist).toFixed(1)}px;
          animation:sparkleOut 0.55s ease forwards;
        `;
        stage.appendChild(p);
        setTimeout(() => p.remove(), 620);
      }
    }

    // Show a contextual line
    const p = Profiles.active();
    if (!p) return;
    const pet = Gream.active(p.id);
    if (!pet) return;
    const speech = document.getElementById('greamSpeech');
    if (speech) {
      const lang = getLang();
      const tapLines = {
        cs: ['Hihihi!', 'Lechtá to!', 'Ještě!', 'Ahoj!', '<3'],
        en: ['Hehehe!', "That tickles!", 'Again!', 'Hi!', '<3']
      };
      const arr = tapLines[lang] || tapLines.cs;
      speech.textContent = (pet.stage >= 2 && Moods.tap(pet, p)) || arr[Math.floor(Math.random() * arr.length)];
      speech.classList.add('show');
      setTimeout(() => speech.classList.remove('show'), 2200);
    }
    // Popisek nálady pod jménem jen po klepnutí (Roman 2026-10-17), na chvíli
    if (pet.stage >= 2) this._showMoodLabel(Moods.label(pet, p));
  },

  _showMoodLabel(text) {
    const nameEl = document.getElementById('greamDisplayName');
    if (!nameEl || !text) return;
    let el = document.getElementById('greamMoodLbl');
    if (!el) { el = document.createElement('div'); el.id = 'greamMoodLbl'; el.className = 'gream-mood-lbl'; nameEl.after(el); }
    el.textContent = text; el.classList.add('show');
    clearTimeout(this._moodLblT); this._moodLblT = setTimeout(() => el.classList.remove('show'), 2800);
  },

  // ─── Helper: time until midnight ───
  _timeUntilMidnight(isCs) {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const diff = midnight - now;
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return isCs ? `· za ${h}h ${m}min` : `· in ${h}h ${m}min`;
  },

  // ─── Update egg pill on map header (called by renderMap) ───
  _renderSeedPill(profileId) {
    const seeds = Skins.getSeeds(profileId);
    let pill = document.getElementById('mapSeedHeader');
    const bar = document.querySelector('#screen-map .map-bar') || document.querySelector('.map-bar');
    if (!bar) return;
    if (!pill) {
      pill = document.createElement('div');
      pill.id = 'mapSeedHeader';
      pill.className = 'streak-pill';
      pill.style.cssText = 'background:linear-gradient(135deg,#fde7a8,#f5a623);cursor:pointer;margin-left:6px';
      pill.onclick = () => this.goTo('wardrobe');
      bar.appendChild(pill);
    }
    pill.innerHTML = `🥚 <span>${seeds}</span>`;
  },

  async openWorld(world) {
    await Challenge.open(world);
  },

  // ─── Recent activity / history ───
  renderHistory() {
    const t = tr();
    const lang = getLang();
    const p = Profiles.active();
    if (!p) return;
    this._setText('histTitle', t.history_title);
    this._setText('histEmptyTitle', t.history_empty_title);
    this._setText('histEmptyMsg', t.history_empty);
    this._setText('histEmptyCta', t.history_empty_cta);

    const items = Profiles.getHistory(p.id, 50);
    const list  = document.getElementById('histList');
    const empty = document.getElementById('histEmpty');

    if (!list) return;
    list.innerHTML = '';

    if (items.length === 0) {
      if (empty) empty.style.display = 'flex';
      return;
    }
    if (empty) empty.style.display = 'none';

    items.forEach(item => {
      const date = new Date(item.t);
      const today = new Date();
      let dateLabel;
      if (date.toDateString() === today.toDateString()) {
        dateLabel = lang === 'cs' ? 'Dnes' : 'Today';
      } else {
        const yest = new Date(today); yest.setDate(yest.getDate()-1);
        if (date.toDateString() === yest.toDateString()) {
          dateLabel = lang === 'cs' ? 'Včera' : 'Yesterday';
        } else {
          dateLabel = date.toLocaleDateString(lang === 'cs' ? 'cs-CZ' : 'en-US', { day:'numeric', month:'short' });
        }
      }
      const time = date.toLocaleTimeString(lang === 'cs' ? 'cs-CZ' : 'en-US', { hour:'2-digit', minute:'2-digit' });

      const row = document.createElement('div');
      row.style.cssText = `
        display:flex; align-items:center; gap:12px;
        padding:12px 14px; border-radius:14px;
        background:rgba(255,255,255,0.85);
        box-shadow:0 2px 6px rgba(0,0,0,0.06);
      `;
      const stepNames = item.text || t.steps[item.world]?.[item.step]?.label || t.step_lbl(item.step + 1);
      row.innerHTML = `
        <div style="font-size:30px;width:44px;height:44px;background:var(--green-pale);border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0">${WORLD_ICONS[item.world]}</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:800;color:var(--green-deep);font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.worlds[item.world]} · ${stepNames}</div>
          <div style="font-size:11px;color:var(--green-mid);font-weight:700">
            ${dateLabel} · ${time}
            ${item.outdoor ? ' · 🌳' : ''}
            ${item.poiName ? ' · 🌳' : ''}
          </div>
        </div>
      `;
      list.appendChild(row);
    });
  },

  // ─── Dynamic SVG scene behind Greamík ───
  _renderGreamScene(pet) {
    const stage = document.getElementById('greamStage');
    const bg = this._gardenWorld();   // pozadí nese posuvný svět zahrady (2D)
    if (!stage || !bg) return;
    stage.style.backgroundImage = '';

    // Apply purchased background image if equipped
    const p = Profiles.active();
    const equippedBg = p ? Skins.getEquippedBg(p.id) : null;
    if (equippedBg?.file) {
      bg.dataset.wide = '1';   // i kupovaná pozadí jsou panoramata 3 : 2 → posouvají se stejně jako louka
      this._sizeGardenWorld();
      bg.style.backgroundImage = `url('img/backgrounds/${equippedBg.file}')`;
      bg.style.backgroundSize = 'cover';   // vždy pokryje celou posuvnou plochu (svět je 3 : 2 jako obrázek, ukotveno dole)
      bg.style.backgroundPosition = 'left bottom';
      this._applyTodTint(bg);
      bg.querySelector('svg.scene-svg')?.remove();
      this._applyLivingOverlay(bg);
      return; // skip procedural SVG generation
    }

    // Výchozí zahrada: široké panorama (img/bg/garden_wide.jpg, 3 : 2), posouvá se do stran
    bg.dataset.wide = '1';
    this._sizeGardenWorld();
    bg.style.backgroundImage = "url('img/bg/garden_wide.jpg')";
    bg.style.backgroundSize = 'cover';
    bg.style.backgroundPosition = 'left bottom';
    this._applyTodTint(bg);
    bg.querySelector('svg.scene-svg')?.remove();
    this._applyLivingOverlay(bg);
    return;

    /* eslint-disable no-unreachable */
    // ── Legacy procedural SVG scene — kept as fallback reference, no longer reached ──
    const now    = new Date();
    const hour   = now.getHours();
    const month  = now.getMonth(); // 0-11
    const world  = pet?.archetype ? (ARCHETYPES[pet.archetype]?.primaryWorld || 'nature') : 'nature';

    // Time of day
    const tod = hour < 6 ? 'night' : hour < 9 ? 'dawn' : hour < 18 ? 'day' : hour < 21 ? 'dusk' : 'night';

    // Season
    const season = month <= 1 || month === 11 ? 'winter'
                 : month <= 4 ? 'spring'
                 : month <= 7 ? 'summer'
                 : 'autumn';

    // Sky gradients by time
    const skies = {
      night: ['#0d1b3e','#1a2a5e','#1e3060'],
      dawn:  ['#ff6b35','#ff9f65','#ffd4a3','#b8d8f0'],
      day:   ['#5ba4d4','#7ec8e8','#a8ddf0'],
      dusk:  ['#2d1b4e','#7a2d6e','#d4634f','#f5a04a'],
    };
    const sky = skies[tod];

    let skyTint = '';
    if (hour >= 21 || hour < 6) {
      skyTint = 'rgba(10,20,60,0.55)';
    } else if (hour >= 19) {
      skyTint = 'rgba(200,80,20,0.3)';
    } else if (hour >= 17) {
      skyTint = 'rgba(180,120,0,0.2)';
    } else if (hour >= 6 && hour < 9) {
      skyTint = 'rgba(255,200,100,0.15)';
    }

    // Ground/flora by world + season
    const scenes = {
      nature:   { ground: '#5a9a3a', mid: '#4a8a2e', flora: _floraForest(season, tod) },
      language: { ground: '#8b7355', mid: '#7a6348', flora: _floraLibrary(season, tod) },
      logic:    { ground: '#5a6a8a', mid: '#4a5a7a', flora: _floraLab(season, tod) },
      feelings: { ground: '#c87090', mid: '#b86080', flora: _floraField(season, tod) },
      arts:     { ground: '#9b6b4a', mid: '#8a5a3a', flora: _floraStudio(season, tod) },
      world:    { ground: '#4a7aaa', mid: '#3a6a9a', flora: _floraWorld(season, tod) },
    };
    const scene = scenes[world] || scenes.nature;

    // Stars for night/dawn
    const stars = (tod === 'night' || tod === 'dawn') ? _genStars(tod) : '';
    // Moon
    const moon = tod === 'night' ? `<ellipse cx="72" cy="38" rx="16" ry="16" fill="#fff5c8" opacity="0.9"/>
      <ellipse cx="77" cy="35" rx="13" ry="13" fill="${sky[0]}" opacity="0.7"/>` : '';
    // Sun
    const sun = tod === 'day' ? `<circle cx="310" cy="42" r="22" fill="#ffd54f" opacity="0.9"/>
      ${[0,45,90,135,180,225,270,315].map(a => `<line x1="${310+22*Math.cos(a*Math.PI/180)}" y1="${42+22*Math.sin(a*Math.PI/180)}" x2="${310+32*Math.cos(a*Math.PI/180)}" y2="${42+32*Math.sin(a*Math.PI/180)}" stroke="#ffd54f" stroke-width="2" opacity="0.6"/>`).join('')}` : '';
    const sunriseGlow = (tod === 'dawn' || tod === 'dusk') ? `<circle cx="${tod==='dawn'?40:340}" cy="90" r="55" fill="${tod==='dawn'?'#ff8a50':'#ff6b35'}" opacity="0.35"/>` : '';

    const svgH = 300;
    const groundY = 218;

    // Animated clouds for day/dawn
    const clouds = (tod === 'day' || tod === 'dawn') ? `
      <style>
        @keyframes cDrift1{from{transform:translateX(-120px)}to{transform:translateX(480px)}}
        @keyframes cDrift2{from{transform:translateX(-160px)}to{transform:translateX(500px)}}
        @keyframes cDrift3{from{transform:translateX(-80px)}to{transform:translateX(450px)}}
        .sc1{animation:cDrift1 22s linear infinite}
        .sc2{animation:cDrift2 35s linear infinite -14s}
        .sc3{animation:cDrift3 28s linear infinite -8s}
      </style>
      <g class="sc1" opacity="0.72">
        <ellipse cx="60" cy="52" rx="36" ry="13" fill="white"/>
        <ellipse cx="44" cy="56" rx="22" ry="10" fill="white"/>
        <ellipse cx="78" cy="55" rx="24" ry="10" fill="white"/>
      </g>
      <g class="sc2" opacity="0.55">
        <ellipse cx="240" cy="32" rx="48" ry="15" fill="white"/>
        <ellipse cx="220" cy="37" rx="28" ry="11" fill="white"/>
        <ellipse cx="264" cy="36" rx="30" ry="12" fill="white"/>
      </g>
      <g class="sc3" opacity="0.45">
        <ellipse cx="150" cy="68" rx="28" ry="9" fill="white"/>
        <ellipse cx="136" cy="71" rx="16" ry="7" fill="white"/>
        <ellipse cx="164" cy="70" rx="18" ry="8" fill="white"/>
      </g>` : '';

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 380 ${svgH}" style="position:absolute;inset:0;width:100%;height:100%">
  <defs>
    <linearGradient id="skyG" x1="0" y1="0" x2="0" y2="1">
      ${sky.map((c,i) => `<stop offset="${i/(sky.length-1)*100}%" stop-color="${c}"/>`).join('')}
    </linearGradient>
    <linearGradient id="groundG" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${scene.mid}"/>
      <stop offset="100%" stop-color="${scene.ground}"/>
    </linearGradient>
    <filter id="glow"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>

  <!-- Sky -->
  <rect width="380" height="${svgH}" fill="url(#skyG)"/>
  ${stars}${moon}${sun}${sunriseGlow}${clouds}

  <!-- Horizon mist -->
  <ellipse cx="190" cy="${groundY}" rx="220" ry="28" fill="${scene.mid}" opacity="0.35"/>

  <!-- Ground -->
  <rect x="0" y="${groundY}" width="380" height="${svgH - groundY}" fill="url(#groundG)"/>

  <!-- Flora / scene elements -->
  <!-- Flora shifted to match new groundY (old coords assume groundY=170, delta=+48) -->
  <g transform="translate(0,48)">${scene.flora}</g>

  <!-- Ground shine -->
  <rect x="0" y="${groundY}" width="380" height="4" fill="rgba(255,255,255,0.12)"/>
  ${skyTint ? `<rect width="380" height="${svgH}" fill="${skyTint}" pointer-events="none"/>` : ''}
  ${(hour >= 21 || hour < 6) ? `
    <circle cx="320" cy="30" r="16" fill="rgba(255,255,200,0.9)" filter="url(#moonGlow)"/>
    <defs><filter id="moonGlow"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
    <circle cx="50" cy="40" r="1.5" fill="white" opacity="0.8"/>
    <circle cx="120" cy="20" r="1" fill="white" opacity="0.6"/>
    <circle cx="200" cy="15" r="1.5" fill="white" opacity="0.7"/>
    <circle cx="270" cy="35" r="1" fill="white" opacity="0.5"/>
  ` : ''}
</svg>`;

    // Remove old SVG, inject new one
    const existing = bg.querySelector('svg.scene-svg');
    if (existing) existing.remove();
    const temp = document.createElement('div');
    temp.innerHTML = svg;
    const svgEl = temp.firstChild;
    svgEl.classList.add('scene-svg');
    svgEl.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:0';
    bg.insertBefore(svgEl, bg.firstChild);
  },
  // ─── Time-of-day tint overlay (shared by painted + shop backgrounds) ───
  _applyTodTint(bg) {
    let tintEl = bg.querySelector('.bg-tint');
    if (!tintEl) {
      tintEl = document.createElement('div');
      tintEl.className = 'bg-tint';
      tintEl.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:1;transition:background 2s';
      bg.prepend(tintEl);
    }
    const h = new Date().getHours();
    let tint = 'transparent';
    if (h >= 21 || h < 6)      tint = 'rgba(10,20,60,0.45)';   // night
    else if (h >= 19)          tint = 'rgba(200,80,20,0.22)';  // dusk
    else if (h >= 17)          tint = 'rgba(180,120,0,0.13)';  // late afternoon
    else if (h >= 6 && h < 8)  tint = 'rgba(255,200,100,0.13)'; // dawn
    tintEl.style.background = tint;
  },

  // ─── Living overlay: floating pollen by day, fireflies by night ───
  _applyLivingOverlay(bg) {
    let live = bg.querySelector('.garden-live');
    if (!live) {
      live = document.createElement('div');
      live.className = 'garden-live';
      bg.appendChild(live);
    }
    const h = new Date().getHours();
    live.classList.toggle('night', h >= 21 || h < 6);
    if (live.childElementCount) return; // populate particles only once
    const N = 9;
    for (let i = 0; i < N; i++) {
      const s = document.createElement('span');
      s.className = 'garden-particle';
      const dur = 7 + Math.random() * 7;
      const sc  = 0.6 + Math.random() * 0.9;
      s.style.left = (5 + Math.random() * 90) + '%';
      s.style.setProperty('--drift', (Math.random() * 40 - 20) + 'px');
      s.style.width = s.style.height = (5 * sc).toFixed(1) + 'px';
      s.style.animationDuration = dur.toFixed(1) + 's';
      s.style.animationDelay = (-Math.random() * dur).toFixed(1) + 's';
      live.appendChild(s);
    }
  },

  startIndoor() {
    Feedback.click();
    const p = Profiles.active();
    if (!p) return;
    const lang  = getLang();
    const seeds = Skins.getSeeds(p.id);
    const check = Subscription.canStartIndoor(p.id, seeds);

    if (!check.allowed) {
      Feedback.error();
      if (!Paywall.open(check.paywall)) this._showToast(check.reason);
      return;
    }

    this._showDifficultyPicker(() => this._doStartIndoor(p));
  },

  // ─── Difficulty picker overlay (shown before any challenge) ───
  _showDifficultyPicker(onConfirm) {
    const lang = getLang();
    const p    = Profiles.active();
    const locked = (d) => !Subscription.difficultyAllowed(d);   // zdarma: lehká + střední
    const cur  = locked(p?.difficulty || 'medium') ? 'medium' : (p?.difficulty || 'medium');
    const diffs = [
      { id:'easy',    emoji:'🟢', cs:'Snadné',   en:'Easy' },
      { id:'medium',  emoji:'🟡', cs:'Střední',  en:'Medium' },
      { id:'hard',    emoji: locked('hard') ? '🔒' : '🔴', cs:'Těžké',    en:'Hard' },
      { id:'extreme', emoji: locked('extreme') ? '🔒' : '⚡', cs:'Extrémní', en:'Extreme' },
    ];
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;z-index:999;padding:20px';
    overlay.innerHTML = `
      <div style="background:white;border-radius:24px;padding:24px;max-width:320px;width:100%;text-align:center">
        <div style="font-size:22px;margin-bottom:8px">🎯</div>
        <div style="font-size:18px;font-weight:900;color:var(--green-deep);margin-bottom:16px">
          ${lang==='cs'?'Jak těžké to chceš?':'How hard?'}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">
          ${diffs.map(d=>`<button data-d="${d.id}" onclick="window._dpSel('${d.id}')"
            style="padding:14px 8px;border-radius:14px;border:2.5px solid ${d.id===cur?'var(--green-mid)':'rgba(0,0,0,0.08)'};background:${d.id===cur?'var(--green-pale)':'white'};font-family:inherit;font-weight:800;font-size:14px;cursor:pointer;transition:all 0.12s">
            ${d.emoji} ${lang==='cs'?d.cs:d.en}
          </button>`).join('')}
        </div>
        <button onclick="window._dpGo()" style="width:100%;padding:14px;border-radius:14px;border:none;background:var(--green-mid);color:white;font-family:inherit;font-weight:800;font-size:16px;cursor:pointer">
          ${lang==='cs'?'Hrát! 🏃':'Play! 🏃'}
        </button>
      </div>`;
    let selected = cur;
    window._dpSel = (diff) => {
      if (locked(diff)) { this.openSubscription('difficulty'); return; }
      selected = diff;
      overlay.querySelectorAll('[data-d]').forEach(b => {
        const active = b.dataset.d === diff;
        b.style.borderColor = active ? 'var(--green-mid)' : 'rgba(0,0,0,0.08)';
        b.style.background  = active ? 'var(--green-pale)' : 'white';
      });
    };
    window._dpGo = () => {
      if (p) Profiles.update(p.id, { difficulty: selected });
      overlay.remove();
      window._dpSel = null; window._dpGo = null;
      onConfirm();
    };
    document.body.appendChild(overlay);
  },

  // ─── Tap Greamík name → rename dialog ───
  promptRenameGream() {
    const lang = getLang();
    const p    = Profiles.active();
    if (!p) return;
    import('./gream.js').then(({ Gream: G }) => {
      const pet = G.active(p.id);
      if (!pet || pet.stage < 2) return;
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,42,7,0.7);display:flex;align-items:center;justify-content:center;z-index:1001;padding:20px';
      const cur = pet.name || '';
      overlay.innerHTML = `
        <div style="background:white;border-radius:24px;padding:24px;max-width:320px;width:100%;text-align:center">
          <div style="font-size:40px;margin-bottom:8px">✏️</div>
          <div style="font-size:18px;font-weight:900;color:var(--green-deep);margin-bottom:14px">
            ${lang==='cs'?'Přejmenovat Greamíka':'Rename Gream'}
          </div>
          <input id="_rnInput" type="text" maxlength="20" value="${cur}"
            placeholder="${lang==='cs'?'Jméno...':'Name...'}"
            style="width:100%;padding:12px 14px;border:2px solid rgba(74,138,46,0.3);border-radius:12px;font-family:'Nunito',sans-serif;font-size:16px;font-weight:700;color:var(--green-deep);text-align:center;margin-bottom:14px;outline:none;box-sizing:border-box">
          <button id="_rnSave" class="btn-primary" style="width:100%;margin-bottom:8px">${lang==='cs'?'Uložit':'Save'}</button>
          <button onclick="this.closest('[style*=fixed]').remove()" class="btn-ghost" style="width:100%">${lang==='cs'?'Zrušit':'Cancel'}</button>
        </div>`;
      const save = () => {
        const name = overlay.querySelector('#_rnInput')?.value.trim();
        if (name) { G.rename(p.id, pet.id, name); this.renderMap(); if (document.getElementById('greamsList')?.offsetParent) this._renderWardrobeGreams(); }
        overlay.remove();
      };
      overlay.querySelector('#_rnSave').onclick = save;
      overlay.querySelector('#_rnInput').addEventListener('keypress', e => { if (e.key==='Enter') save(); });
      document.body.appendChild(overlay);
      setTimeout(() => { overlay.querySelector('#_rnInput')?.focus(); }, 150);
    });
  },

  _doStartIndoor(p) {
    const pet = Gream.active(p.id);
    const allWorlds = ['nature', 'language', 'logic', 'arts', 'feelings', 'world'];
    const indoorWorlds = ['feelings', 'language', 'logic', 'arts'];
    let chosen;

    // 30% chance: pick any random world (including nature/world) for variety
    if (Math.random() < 0.3) {
      chosen = allWorlds[Math.floor(Math.random() * allWorlds.length)];
    } else {
      // Otherwise: suggest based on Gream needs, or pick least-played
      // Vylíhnutý greamík: svět podle jeho potřeb. Vajíčko: náhodně mezi nejméně hranými světy – jinak by všichni
      // noví hráči dostali stejný svět a stejného prvního greamíka
      if (pet && pet.stage >= 2 && pet.archetype) {
        const suggested = Gream.suggestWorld(pet);
        if (suggested) chosen = suggested;
      }
      if (!chosen) {
        const worldCounts = p.worldTasks || {};
        const min = Math.min(...allWorlds.map(w => worldCounts[w] || 0));
        const least = allWorlds.filter(w => (worldCounts[w] || 0) === min);
        chosen = least[Math.floor(Math.random() * least.length)];
      }
    }
    Subscription.recordIndoor(p.id);
    Challenge.open(chosen, { indoor: true });
  },

  _confirmSeedSpend(msg, cost, onConfirm) {
    const lang = getLang();
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:999;padding:20px';
    overlay.innerHTML = `
      <div style="background:white;border-radius:20px;padding:24px;max-width:320px;width:100%;text-align:center">
        <div style="font-size:40px;margin-bottom:12px">🌱</div>
        <div style="font-size:16px;font-weight:800;color:var(--green-deep);margin-bottom:16px">${msg}</div>
        <button onclick="this.closest('[style*=fixed]').remove();(window._seedConfirmCb||function(){})()" 
          style="width:100%;padding:14px;border-radius:14px;border:none;background:var(--green-mid);color:white;font-family:inherit;font-weight:800;font-size:15px;cursor:pointer;margin-bottom:8px">
          ✓ ${lang==='cs'?'Koupit':'Buy'}
        </button>
        <button onclick="this.closest('[style*=fixed]').remove()"
          style="width:100%;padding:10px;border-radius:14px;border:none;background:none;font-family:inherit;font-weight:700;font-size:14px;color:var(--green-mid);cursor:pointer">
          ${lang==='cs'?'Zrušit':'Cancel'}
        </button>
      </div>`;
    window._seedConfirmCb = onConfirm;
    document.body.appendChild(overlay);
  },

  // ─── Smart action: outdoor — auto-pick a nearby POI ───
  async startOutdoor() {
    Feedback.click();
    const t = tr();
    const lang = getLang();

    const loadingToast = document.createElement('div');
    loadingToast.style.cssText = `position:fixed;bottom:120px;left:50%;transform:translateX(-50%);background:#1a3d0a;color:white;padding:14px 22px;border-radius:50px;font-family:'Nunito',sans-serif;font-size:15px;font-weight:700;z-index:999;box-shadow:0 4px 20px rgba(0,0,0,0.3);`;
    loadingToast.textContent = lang === 'cs' ? '🔍 Hledám místo...' : '🔍 Finding a place...';
    document.body.appendChild(loadingToast);

    let pos = Geo.lastPosition();
    if (pos && Date.now() - pos.t < 5 * 60 * 1000) {
      // Recent cache — use immediately, refresh in background
      Geo.getPosition().catch(() => {});
    } else {
      // No fresh cache — wait briefly
      try {
        pos = await Promise.race([
          Geo.getPosition(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 6000))
        ]);
      } catch { pos = Geo.lastPosition(); }
    }
    loadingToast.remove();

    if (!pos) {
      this._showToast(t.geo_no_signal);
      Feedback.error();
      return;
    }

    // Single query — all POI types at once
    let allPOIs = [];
    try { allPOIs = await Geo.fetchAllPOI(pos, 1500); } catch {}

    // Filter to outdoor-relevant (exclude purely indoor-only kinds)
    const indoorOnly = ['library']; // library = indoor feel, better for "stay home"
    allPOIs = allPOIs.filter(p => !indoorOnly.includes(p.kind));

    if (allPOIs.length === 0) {
      this._showToast(lang === 'cs' ? 'Žádná místa v okolí. Otevírám mapu...' : 'No places nearby. Opening map...');
      setTimeout(() => this.openMapView('nature'), 1200);
      return;
    }

    allPOIs.forEach(p => p._dist = Geo.distance(pos, p));
    allPOIs.sort((a, b) => a._dist - b._dist);
    const target = allPOIs[0];
    this._showOutdoorSuggestion(target, allPOIs.slice(0, 4));
  },

  // ─── Overlay showing the suggested outdoor target ───
  _showOutdoorSuggestion(target, alternates) {
    const lang = getLang();
    const WC = { nature:'#4a8a2e', language:'#5a4a8a', logic:'#2d7abf', feelings:'#d46d94', arts:'#c87030', world:'#a8743c' };
    const existing = document.getElementById('outdoorSuggestionOverlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'outdoorSuggestionOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,42,7,0.65);display:flex;align-items:flex-end;justify-content:center;z-index:998;padding:0;animation:slideUp 0.25s ease both;';
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    const dist = Math.round(target._dist || 0);
    const distStr = dist < 1000 ? `${dist} m` : `${(dist/1000).toFixed(1)} km`;
    const bonusLabel = target.bonusWorld
      ? `<div style="display:inline-flex;align-items:center;gap:5px;padding:4px 12px;border-radius:50px;background:${WC[target.bonusWorld]};color:white;font-size:12px;font-weight:800;margin-bottom:12px">${WORLD_EMOJIS[target.bonusWorld]} +5 bonus seeds</div>`
      : '';

    // Build world buttons
    const WORLDS = ['nature','language','logic','feelings','arts','world'];
    const worldBtnsHtml = WORLDS.map(w => {
      const isSuggested = w === target.bonusWorld;
      return `<button onclick="App._selectOutdoorWorld('${target.id}','${w}')" id="owb-${w}" style="padding:10px 4px;border-radius:12px;border:2px solid ${isSuggested ? WC[w] : 'rgba(0,0,0,0.08)'};background:${isSuggested ? WC[w]+'22' : 'white'};font-size:20px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;transition:all 0.15s">${WORLD_EMOJIS[w]||'?'}</button>`;
    }).join('');

    const altBtns = alternates.filter(a => a.id !== target.id).slice(0,2).map(a =>
      `<button onclick="App._switchOutdoorTarget('${a.id}')" style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;border:none;background:rgba(255,255,255,0.7);cursor:pointer;font-family:inherit;text-align:left;width:100%;font-size:13px;color:var(--green-deep);font-weight:700;margin-bottom:6px">
        <span style="font-size:20px">${this._poiIcon(a.kind)}</span>
        <div style="flex:1;min-width:0;overflow:hidden">
          <div style="font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${a.name || a.kind}</div>
          <div style="font-size:11px;color:var(--green-mid)">${Math.round(a._dist)} m</div>
        </div>
        <span style="color:var(--green-mid)">→</span>
      </button>`
    ).join('');

    overlay.innerHTML = `<div style="background:white;border-radius:24px 24px 0 0;padding:20px 20px 36px;max-width:480px;width:100%;box-shadow:0 -6px 30px rgba(0,0,0,0.2)">
      <div style="width:36px;height:4px;background:rgba(0,0,0,0.12);border-radius:2px;margin:0 auto 16px"></div>
      <div style="text-align:center;margin-bottom:14px">
        <div style="font-size:40px;margin-bottom:4px">${this._poiIcon(target.kind)}</div>
        <div style="font-size:11px;font-weight:700;color:var(--green-mid);margin-bottom:4px">${lang==='cs'?'Nejbližší místo':'Nearest place'}</div>
        <div style="font-size:18px;font-weight:900;color:var(--green-deep);margin-bottom:2px">${target.name || (target.kind||'').replace(/_/g,' ')}</div>
        <div style="font-size:13px;color:var(--green-mid);font-weight:700;margin-bottom:10px">${distStr}</div>
        ${bonusLabel}
      </div>
      <div style="font-size:12px;font-weight:700;color:var(--green-mid);margin-bottom:8px">${lang==='cs'?'Vyber svět:':'Pick a world:'}</div>
      <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:6px;margin-bottom:14px">${worldBtnsHtml}</div>
      <button id="outdoorGoBtn" class="btn-primary" style="width:100%;margin-bottom:10px;opacity:0.4;pointer-events:none" onclick="App.startOutdoorTo('${target.id}')">
        ${lang==='cs'?'▶ Vyrazit':'▶ Let\'s go'}
      </button>
      <button onclick="App._closeOutdoorOverlay();App.openMapView('nature')" style="width:100%;background:none;border:none;font-family:inherit;font-weight:700;color:var(--green-mid);cursor:pointer;font-size:14px;padding:6px;margin-bottom:${altBtns?'12px':'0'}">
        🗺️ ${lang==='cs'?'Otevřít mapu':'Open map'}
      </button>
      ${altBtns ? `<div style="font-size:11px;font-weight:700;color:var(--green-mid);margin-bottom:6px">${lang==='cs'?'Nebo jiné místo:':'Or another place:'}</div>${altBtns}` : ''}
    </div>`;

    document.body.appendChild(overlay);
    this._outdoorTargets = {};
    [target, ...alternates].forEach(p => { this._outdoorTargets[p.id] = p; });
    this._outdoorSelectedWorld = null;
  },

  _selectOutdoorWorld(poiId, world) {
    const WC = { nature:'#4a8a2e', language:'#5a4a8a', logic:'#2d7abf', feelings:'#d46d94', arts:'#c87030', world:'#a8743c' };
    const WORLDS = ['nature','language','logic','feelings','arts','world'];
    // Highlight selected
    WORLDS.forEach(w => {
      const btn = document.getElementById(`owb-${w}`);
      if (!btn) return;
      btn.style.borderColor = w === world ? WC[w] : 'rgba(0,0,0,0.08)';
      btn.style.background  = w === world ? WC[w] + '22' : 'white';
      btn.style.borderWidth = w === world ? '3px' : '2px';
    });
    this._outdoorSelectedWorld = world;
    // Enable go button
    const goBtn = document.getElementById('outdoorGoBtn');
    if (goBtn) {
      const lang = getLang();
      const poi = this._outdoorTargets?.[poiId];
      const bonus = poi?.bonusWorld === world;
      goBtn.style.opacity = '1';
      goBtn.style.pointerEvents = 'auto';
      goBtn.style.background = WC[world];
      goBtn.textContent = bonus
        ? (lang==='cs'?`🌟 Vyrazit (+5 semínek)`:`🌟 Let's go (+5 seeds)`)
        : (lang==='cs'?`▶ Vyrazit`:`▶ Let's go`);
    }
  },

  _switchOutdoorTarget(poiId) {
    const poi = this._outdoorTargets?.[poiId];
    if (!poi) return;
    const allTargets = Object.values(this._outdoorTargets || {});
    this._showOutdoorSuggestion(poi, allTargets.filter(p => p.id !== poi.id));
  },

  _closeOutdoorOverlay() { document.getElementById('outdoorSuggestionOverlay')?.remove(); },

  startOutdoorTo(poiId) {
    const target = this._outdoorTargets?.[poiId];
    const world  = this._outdoorSelectedWorld;
    if (!target || !world) return;
    this._closeOutdoorOverlay();
    Challenge.open(world, { poi: { ...target, selectedWorld: world } });
  },

  // ─── Privacy Policy modal ───
  openPrivacyInfo() {
    Feedback.click();
    const lang = getLang();
    const title = lang === 'cs' ? 'Zásady ochrany soukromí' : 'Privacy Policy';
    const content = lang === 'cs' ? `
      <p><strong>Stručně:</strong> Tvoje přesná poloha (GPS) a fotky nikdy neopustí zařízení. Kvůli mapě posíláme na náš server jen přibližnou polohu (zaokrouhlenou na zhruba 500 m) a neukládáme ji. Pro souboje a žebříčky posíláme jen zvolenou přezdívku a skóre.</p>

      <p><strong>1. Co zůstává jen v zařízení</strong><br>
      Přezdívka, avatar, postup ve hře (úkoly, odznaky, semínka), greamíci, volitelná fotka,
      pozice "domov" a historie úkolů. <strong>Přesné GPS souřadnice</strong> se zpracují jen v zařízení
      (vzdálenost k místům, „jsi u místa") a nikdy se neodesílají. Jen v zařízení zůstává i prozkoumané okolí,
      výprava dne a denní čas hraní nastavený rodičem. Otázka „Kde to je?“ tvou polohu nepoužívá.</p>

      <p><strong>2. Co posíláme na server</strong> (3rstudio.eu, bez účtu, anonymně)<br>
      • Přezdívku + skóre a rating ze soubojů → veřejný žebříček<br>
      • Anonymní ID splněných míst na mapě (kolik hráčů je splnilo)<br>
      • Bitevní místa: u místa uložíme jen greamíka a skóre toho, kdo ho drží (bez přezdívky a ID), na 14 dní<br>
      • Týdenní liga: body ze soubojů pod náhodným ID hráče (žebříček ligy ukazuje přezdívky)<br>
      • Nahlášení špatné otázky (které a proč)<br>
      • <strong>Přibližnou polohu</strong> (zaokrouhlenou na ≈ 500 m) a výřez mapy – náš server podle ní najde zajímavá místa v okolí a pošle mapu. Neukládáme ji a není spojená s tebou ani s přezdívkou.<br>
      • Nahrávku souboje (odpovědi, čas a greamík), aby proti ní mohli hrát ostatní<br>
      • Při stahování nových otázek jen číslo verze otázek, kterou už máš<br>
      • Zadaný promo kód (k ověření; server si pamatuje jen, že byl použit)<br>
      Přezdívku si volíš ty a je vidět ostatním — nedávej do ní osobní údaje. Nevhodné přezdívky server automaticky nahradí.</p>

      <p><strong>Gream Plus (předplatné)</strong><br>
      Platí se jen přes Google Play nebo App Store – platební údaje zpracovává Google / Apple, my je nevidíme. Do hry přijde jen informace, že je předplatné aktivní (uloží se v zařízení). Nákup chrání otázka pro dospělé, zrušit jde kdykoli v nastavení obchodu.</p>

      <p><strong>3. Co Gream NEDĚLÁ</strong><br>
      • Žádné reklamy<br>
      • Žádné sledování napříč aplikacemi ani reklamní ID<br>
      • Žádná analytika třetích stran ve hře<br>
      • Neprodáváme data · nesbíráme e-mail/telefon<br>
      • Přesná poloha a fotky nikdy neopustí zařízení</p>

      <p><strong>4. Externí služby</strong><br>
      Mapová data © OpenStreetMap (přes OpenFreeMap) – stahuje je náš server, tvoje zařízení se s cizími servery nespojuje. Písmo je součástí aplikace.</p>

      <p><strong>5. Děti</strong><br>
      Obsah je bezpečný a bez reklam; v úvodu je obrazovka pro rodiče. Rodič může požádat
      o smazání přezdívky a skóre dítěte ze serveru.</p>

      <p><strong>6. Vaše práva</strong><br>
      • Výmaz: tlačítko "Smazat všechna data" smaže vše v zařízení.<br>
      • Přezdívku a skóre ze serveru smažeme na žádost e-mailem.</p>

      <p style="margin-top:12px"><strong>Úplné znění:</strong>
      <a href="#" onclick="App.openExternal('https://3rstudio.eu/gream-privacy.html');return false;">3rstudio.eu/gream-privacy.html</a><br>
      Kontakt: romanpavlorek@gmail.com</p>

      <p style="font-size:11px;opacity:0.7;margin-top:14px">Naposledy aktualizováno: říjen 2026</p>
    ` : `
      <p><strong>In short:</strong> Your precise location (GPS) and photos never leave your device. For the map we send our server only an approximate location (rounded to about 500 m) and don't store it. For battles and leaderboards we send only your chosen nickname and score.</p>

      <p><strong>1. What stays only on your device</strong><br>
      Nickname, avatar, game progress (tasks, badges, seeds), greamíci, optional photo,
      "home" pin and task history. <strong>Precise GPS coordinates</strong> are processed on-device only
      (distance to places, "you're at a place") and are never sent. Explored areas, the daily expedition
      and the daily play time set by a parent also stay on your device. The "Where is it?" question doesn't use your location.</p>

      <p><strong>2. What we send to our server</strong> (3rstudio.eu, no account, anonymous)<br>
      • Nickname + score and rating from battles → public leaderboard<br>
      • Anonymous IDs of completed map places (how many players completed them)<br>
      • Battle spots: for a place we store only the greamík and score of whoever holds it (no nickname or ID), for 14 days<br>
      • Weekly league: battle points under a random player ID (the league table shows nicknames)<br>
      • Bad-question reports (which one and why)<br>
      • <strong>Approximate location</strong> (rounded to ≈ 500 m) and the map area – our server uses it to find interesting places nearby and to send the map. It is not stored and not linked to you or your nickname.<br>
      • A battle recording (answers, time and Gream) so others can play against it<br>
      • When downloading new questions, only the version number you already have<br>
      • An entered promo code (to check it; the server only remembers that it was used)<br>
      You choose your nickname and others can see it — don't put personal details in it. The server automatically replaces inappropriate nicknames.</p>

      <p><strong>Gream Plus (subscription)</strong><br>
      Paid only through Google Play or the App Store – payment details are handled by Google / Apple and we never see them. The game only learns that the subscription is active (stored on the device). Purchases are protected by a question for adults; cancel any time in the store settings.</p>

      <p><strong>3. What Gream does NOT do</strong><br>
      • No ads<br>
      • No cross-app tracking or advertising IDs<br>
      • No third-party analytics in the game<br>
      • We don't sell data · we don't collect email/phone<br>
      • Precise location and photos never leave the device</p>

      <p><strong>4. External services</strong><br>
      Map data © OpenStreetMap (via OpenFreeMap) – downloaded by our server; your device does not connect to third-party servers. The font is bundled with the app.</p>

      <p><strong>5. Children</strong><br>
      Content is safe and ad-free; a parent screen appears at the start. Parents can request
      deletion of a child's nickname and scores from the server.</p>

      <p><strong>6. Your rights</strong><br>
      • Erasure: the "Delete all data" button removes everything on the device.<br>
      • We delete your server nickname and scores on request by email.</p>

      <p style="margin-top:12px"><strong>Full policy:</strong>
      <a href="#" onclick="App.openExternal('https://3rstudio.eu/gream-privacy.html');return false;">3rstudio.eu/gream-privacy.html</a><br>
      Contact: romanpavlorek@gmail.com</p>

      <p style="font-size:11px;opacity:0.7;margin-top:14px">Last updated: October 2026</p>
    `;
    this._showInfoModal(title, content);
  },

  openTermsInfo() {
    Feedback.click();
    const lang = getLang();
    const title = lang === 'cs' ? 'Podmínky použití' : 'Terms of use';
    const content = lang === 'cs' ? `
      <p><strong>Co je Gream</strong><br>
      Gream je kvízová hra pro celou rodinu. Bav se otázkami od snadných po expertní,
      objevuj svět venku, líhni a vychovej si greamíky a měř síly v soubojích.</p>

      <p><strong>Pro koho</strong><br>
      Gream je pro všechny věkové kategorie — přístupný a bezpečný i pro děti (od 4 let).
      Pro děti pod 13 let je vyžadován souhlas rodiče.</p>

      <p><strong>Bezpečnost</strong><br>
      Některé úkoly vybízejí k venkovní aktivitě. <strong>Rodič nese odpovědnost za bezpečnost
      dítěte při venkovních aktivitách.</strong> Doporučujeme:<br>
      • Děti 4–9: vždy s dospělým<br>
      • Děti 10+: s ohledem na rodičovský dohled<br>
      Nastavení "domov" pomáhá omezit oblast venkovních úkolů.</p>

      <p><strong>Obsah uživatele</strong><br>
      Textové odpovědi napsané v Gream jsou uloženy pouze v zařízení a nikam se neodesílají.
      Doporučujeme nezveřejňovat osobní údaje (jména, adresy) v odpovědích.</p>

      <p><strong>Žádná záruka</strong><br>
      Aplikace je poskytována "jak je". Tvůrce neodpovídá za škody způsobené použitím
      či nemožností použití aplikace.</p>

      <p><strong>Změny</strong><br>
      Tyto podmínky se mohou měnit. Aktuální verzi najdete vždy v aplikaci.</p>

      <p style="font-size:11px;opacity:0.7;margin-top:14px">Naposledy aktualizováno: květen 2026</p>
    ` : `
      <p><strong>What is Gream</strong><br>
      Gream is a quiz game for the whole family. Enjoy questions from easy to expert,
      explore the world outdoors, hatch and raise your greamíci, and battle other players.</p>

      <p><strong>For whom</strong><br>
      Gream is for all ages — accessible and safe for children too (from age 4).
      For children under 13, parental consent is required.</p>

      <p><strong>Safety</strong><br>
      Some tasks encourage outdoor activity. <strong>Parents are responsible for child safety
      during outdoor activities.</strong> We recommend:<br>
      • Children 4–9: always with an adult<br>
      • Children 10+: with parental oversight<br>
      The "home pin" setting helps limit the area of outdoor tasks.</p>

      <p><strong>User content</strong><br>
      Text answers written in Gream are stored only on your device and never sent anywhere.
      We recommend not including personal information (names, addresses) in answers.</p>

      <p><strong>No warranty</strong><br>
      The app is provided "as is". The creator is not responsible for damages caused by the use
      or inability to use the application.</p>

      <p><strong>Changes</strong><br>
      These terms may change. The current version can always be found in the application.</p>

      <p style="font-size:11px;opacity:0.7;margin-top:14px">Last updated: May 2026</p>
    `;
    this._showInfoModal(title, content);
  },

  // ─── Generic info modal ───
  _showInfoModal(title, htmlContent) {
    const lang = getLang();
    const existing = document.getElementById('infoModalOverlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'infoModalOverlay';
    overlay.style.cssText = `
      position:fixed; inset:0; background:rgba(15,42,7,0.7);
      display:flex; align-items:center; justify-content:center;
      z-index:1000; padding:20px;
      animation:slideUp 0.3s ease both;
    `;
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    const card = document.createElement('div');
    card.style.cssText = `
      background:white; border-radius:24px; padding:24px; max-width:480px; width:100%;
      max-height:80vh; overflow-y:auto;
      box-shadow:0 10px 30px rgba(0,0,0,0.3);
    `;
    card.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
        <h3 style="font-size:18px;font-weight:900;color:var(--green-deep);margin:0">${title}</h3>
        <button onclick="document.getElementById('infoModalOverlay').remove()" style="background:none;border:none;font-size:22px;cursor:pointer;color:var(--green-mid)">✕</button>
      </div>
      <div style="font-size:13px;line-height:1.6;color:var(--green-deep);font-weight:500">
        ${htmlContent}
      </div>
      <button onclick="document.getElementById('infoModalOverlay').remove()" class="btn-primary" style="width:100%;margin-top:18px">${lang === 'cs' ? 'Zavřít' : 'Close'}</button>
    `;
    overlay.appendChild(card);
    document.body.appendChild(overlay);
  },

  // ─── First-run hint pulse on choice buttons ───
  _renderTrialBanner(profileId, lang) {
    const existing = document.getElementById('trialBanner');
    const sub = Subscription.get();
    if (!Subscription.paywallEnabled() || !sub.inTrial) { existing?.remove(); return; }
    const t = tr();
    if (existing) { existing.querySelector('.tb-days').textContent = t.plus_trial_banner(sub.trialDaysLeft); return; }
    const banner = document.createElement('div');
    banner.id = 'trialBanner';
    banner.style.cssText = 'background:linear-gradient(135deg,#fde7a8,#f5c842);border-radius:12px;padding:5px 8px 5px 12px;margin:4px auto 0;display:flex;align-items:center;gap:8px;width:100%;max-width:480px;box-sizing:border-box;flex-shrink:0';
    banner.innerHTML = `
      <div style="font-size:16px">⭐</div>
      <div style="flex:1;min-width:0;font-size:12px;line-height:1.25;color:#7a3d00"><b>${t.plus_trial_title}</b> · <span class="tb-days">${t.plus_trial_banner(sub.trialDaysLeft)}</span></div>
      <button onclick="App.openSubscription()" style="padding:6px 12px;border-radius:50px;border:none;background:#f5a623;color:white;font-weight:800;font-size:11px;cursor:pointer;font-family:inherit">${t.plus_badge}</button>`;
    const choices = document.querySelector('.home-actions') || document.querySelector('.home-choices');
    choices?.parentNode?.insertBefore(banner, choices);
  },

  // Nabídka Gream Plus (reason = proč se ukazuje: home/battle/difficulty/profile/…)
  openSubscription(reason) { return Paywall.open(reason); },

  // Další profil: zdarma jen jeden (po týdnu zdarma)
  addProfile() {
    if (!Subscription.canAddProfile(Profiles.all().length)) { if (Paywall.open('profile')) return; }
    this.goTo('onboarding');
  },

  // ─── Feed button overlay on garden stage ───
  _renderFeedButton(p, pet, lang) {
    const stage = document.getElementById('greamStage');
    if (!stage) return;
    stage.querySelector('.garden-feed-btn')?.remove();
    if (!pet || pet.stage < 2) return;

    const btn = document.createElement('button');
    btn.className = 'garden-feed-btn';
    btn.id = 'gardenFeedBtn';
    btn.style.cssText = `
      position:absolute;bottom:12px;right:12px;z-index:10;
      width:38px;height:38px;border-radius:50%;
      background:rgba(255,255,255,0.88);border:2px solid rgba(74,138,46,0.3);
      font-size:18px;display:flex;align-items:center;justify-content:center;
      box-shadow:0 2px 8px rgba(0,0,0,0.15);cursor:pointer;
      transition:transform 0.15s;
    `;
    btn.textContent = '🍃';
    btn.addEventListener('click', e => { e.stopPropagation(); this._feedActiveGream(); });
    stage.appendChild(btn);
  },

  _feedActiveGream() {
    const p = Profiles.active();
    if (!p) return;
    const lang = getLang();
    // Pamlsek je zdarma a dobrovolný (2026-10-17) – žádná povinnost ani placení semínky
    Gream.manualFeed(p.id);
    Feedback.pop();
    const sp = document.getElementById('greamSpeech');
    if (sp) { sp.textContent = Moods.fed(); sp.classList.add('show'); setTimeout(() => sp.classList.remove('show'), 2000); }

    const stage = document.getElementById('greamStage');
    if (stage) {
      if (!document.getElementById('heartFloatKf')) {
        const s = document.createElement('style');
        s.id = 'heartFloatKf';
        s.textContent = '@keyframes heartFloat{from{opacity:1;transform:translateY(0)}to{opacity:0;transform:translateY(-55px)}}';
        document.head.appendChild(s);
      }
      const hearts = ['❤️','💚','💛','🌱'];
      for (let i = 0; i < 5; i++) {
        const h = document.createElement('div');
        h.style.cssText = `position:absolute;left:${25+Math.random()*50}%;bottom:30%;font-size:${14+Math.random()*10}px;pointer-events:none;z-index:20;animation:heartFloat 1.2s ease forwards`;
        h.textContent = hearts[Math.floor(Math.random() * hearts.length)];
        stage.appendChild(h);
        setTimeout(() => h.remove(), 1300);
      }
    }
    this._showToast(lang === 'cs' ? '🍃 Greamík nakrmen! 💚' : '🍃 Gream fed! 💚');
  },

  // ─── Chat bubbles when 2+ greams are present ───
  _startGardenChat(hatchedGreams, lang) {
    if (Moods.sleeping()) { this._chatTimer = setTimeout(() => this._startGardenChat(hatchedGreams, lang), 60000); return; }   // v noci spí
    const chatLines = {
      cs: [['Ahoj!','Čau!'],['Jak se máš?','Super!'],['Pojď si hrát!','Jdu!'],['Dnes bylo hezky','Hmm!'],['✨','🌱']],
      en: [['Hello!','Hi there!'],['How are you?','Great!'],['Let\'s play!','Coming!'],['Nice day','Hmm!'],['✨','🌱']]
    };
    const delay = 6000 + Math.random() * 8000;
    this._chatTimer = setTimeout(() => {
      const slots = [...document.querySelectorAll('.garden-gream-slot')].filter(el => el.querySelector('canvas'));   // jen vylíhnutí (ne vejce v košíčku)
      if (slots.length < 2) return;
      const lines = chatLines[lang] || chatLines.en;
      const pair = lines[Math.floor(Math.random() * lines.length)];
      [0, 1].forEach(idx => {
        const slot = slots[idx];
        if (!slot) return;
        let bubble = slot.querySelector('.gream-chat-bubble');
        if (!bubble) {
          bubble = document.createElement('div');
          bubble.className = 'gream-chat-bubble';
          bubble.style.cssText = `position:absolute;bottom:calc(100% + 4px);left:50%;transform:translateX(-50%);background:white;padding:5px 10px;border-radius:12px;font-size:12px;font-weight:800;color:var(--green-deep);box-shadow:0 2px 8px rgba(0,0,0,0.15);white-space:nowrap;opacity:0;transition:opacity 0.3s;pointer-events:none;z-index:15`;
          slot.appendChild(bubble);
        }
        bubble.textContent = pair[idx] || '...';
        // bublina nesmí přetéct přes okraj zahrady (greamík na kraji); greamík mimo záběr (2D zahrada) nemluví
        bubble.style.transform = 'translateX(-50%)';
        const st = document.getElementById('greamStage')?.getBoundingClientRect(), br = bubble.getBoundingClientRect();
        const sr = slot.getBoundingClientRect();
        if (st && (sr.right < st.left + 10 || sr.left > st.right - 10)) return;
        if (st && br.width) {
          const scale = br.width / bubble.offsetWidth || 1;   // slot bývá zmenšený (scale)
          const dx = br.left < st.left + 6 ? st.left + 6 - br.left : br.right > st.right - 6 ? st.right - 6 - br.right : 0;
          if (dx) bubble.style.transform = `translateX(calc(-50% + ${Math.round(dx / scale)}px))`;
        }
        bubble.style.opacity = '1';
        setTimeout(() => { bubble.style.opacity = '0'; }, 2800);
      });
      this._chatTimer = setTimeout(() => this._startGardenChat(hatchedGreams, lang), 14000 + Math.random() * 10000);
    }, delay);
  },

  // ─── In-garden tutorial (shown once on first launch) ───
  _showTutorial(lang) {
    if (localStorage.getItem('gream_tutorial_v1')) return;
    localStorage.setItem('gream_tutorial_v1', '1');

    const t = tr();
    const SELS = ['#greamStage', '.garden-gream-slot.is-active, .garden-gream-slot, #homeJarWrap', '.home-choice-indoor', '.seed-pill', '.streak-pill', '#tab-hub', '#tab-map'];
    const steps = SELS.map((sel, i) => ({ sel, icon: t.tut_steps[i][0], title: t.tut_steps[i][1], text: t.tut_steps[i][2] }));

    let prevEl = null;

    const overlay = document.createElement('div');
    overlay.id = 'tutOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:5000;pointer-events:all';

    // Inject tutorial CSS once
    if (!document.getElementById('tutCss')) {
      const s = document.createElement('style');
      s.id = 'tutCss';
      s.textContent = `
        .tut-card {
          position:fixed;left:50%;transform:translateX(-50%);
          background:white;border-radius:22px;
          padding:20px 22px 16px;
          box-shadow:0 8px 32px rgba(0,0,0,0.4);
          max-width:390px;width:calc(100vw - 32px);
          z-index:5002;pointer-events:all;
          animation:tutCardIn 0.25s ease;
        }
        @keyframes tutCardIn{from{opacity:0;transform:translateX(-50%) translateY(12px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
        .tut-arrow-down::after{content:'';display:block;width:0;height:0;border-left:10px solid transparent;border-right:10px solid transparent;border-top:12px solid white;margin:0 auto;margin-top:2px}
        .tut-arrow-up::before{content:'';display:block;width:0;height:0;border-left:10px solid transparent;border-right:10px solid transparent;border-bottom:12px solid white;margin:0 auto;margin-bottom:2px}
      `;
      document.head.appendChild(s);
    }

    document.body.appendChild(overlay);

    const cardEl = document.createElement('div');
    cardEl.className = 'tut-card';
    document.body.appendChild(cardEl);

    let ringEl = null;
    const cleanup = () => {
      ringEl?.remove(); ringEl = null;
      prevEl = null;
    };

    const showStep = (i) => {
      cleanup();
      if (i >= steps.length) {
        overlay.remove(); cardEl.remove();
        document.getElementById('tutCss')?.remove();
        return;
      }

      const step = steps[i];
      const isLast = i === steps.length - 1;

      // Find target element
      const selectors = step.sel.split(',').map(s => s.trim());
      let target = null;
      for (const s of selectors) { target = document.querySelector(s); if (target) break; }

      if (target) {
        const r = target.getBoundingClientRect(), PAD = 8;
        // Kruh kolem cíle (oříznutý do obrazovky – velká zahrada nesmí vyčnívat pod lištu)
        const top = Math.max(4, r.top - PAD), bottom = Math.min(window.innerHeight - 4, r.bottom + PAD);
        ringEl = document.createElement('div');
        ringEl.id = 'tutRing';
        ringEl.style.cssText = `position:fixed;pointer-events:none;z-index:5001;border-radius:18px;border:3px solid var(--green-mid);box-shadow:0 0 0 9999px rgba(0,0,0,0.6),0 0 20px rgba(74,138,46,0.5);transition:all 0.25s;left:${r.left-PAD}px;top:${top}px;width:${r.width+PAD*2}px;height:${bottom-top}px`;
        document.body.appendChild(ringEl);
        prevEl = target;
      }

      const dotsHtml = steps.map((_, di) =>
        `<div style="width:8px;height:8px;border-radius:50%;background:${di === i ? 'var(--green-mid)' : '#e0e0e0'};transition:background 0.2s"></div>`
      ).join('');
      cardEl.className = 'tut-card';
      cardEl.style.top = '0px'; cardEl.style.bottom = ''; cardEl.style.visibility = 'hidden';
      cardEl.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
          <span style="font-size:30px;flex-shrink:0">${step.icon}</span>
          <div style="font-size:17px;font-weight:900;color:var(--green-deep)">${step.title}</div>
          <div style="margin-left:auto;font-size:11px;font-weight:700;color:#bbb">${i+1}/${steps.length}</div>
        </div>
        <div style="font-size:14px;font-weight:700;color:#444;line-height:1.5;margin-bottom:12px">${step.text}</div>
        <div style="display:flex;gap:5px;justify-content:center;margin-bottom:12px">${dotsHtml}</div>
        <button id="tutNext" class="btn-primary" style="width:100%;padding:13px;font-size:15px">${isLast ? t.tut_done : t.tut_next}</button>
        <button id="tutSkip" style="width:100%;padding:7px;font-size:12px;color:#999;font-weight:700;background:none;border:none;cursor:pointer;margin-top:2px">${t.tut_skip}</button>
      `;
      // Umístění podle skutečné výšky karty: vždy mezi horním okrajem (výřez) a spodní lištou, nikdy přes ni
      const css = getComputedStyle(document.documentElement);
      const sat = parseFloat(css.getPropertyValue('--sat')) || 0;
      const tabs = document.querySelector('.tab-bar');
      const tr_ = tabs?.getBoundingClientRect();   // lišta je position:fixed → offsetParent je vždy null, rozhoduje viditelnost a výška
      const tabTop = tr_ && tr_.height > 0 && getComputedStyle(tabs).display !== 'none' && getComputedStyle(tabs).visibility !== 'hidden' ? tr_.top : window.innerHeight;
      const minY = sat + 8, maxY = tabTop - 10, h = cardEl.offsetHeight;
      let y, arrow = '';
      if (target) {
        const r = target.getBoundingClientRect();
        const below = r.bottom + 14, above = Math.min(r.top, maxY) - 14 - h;
        if (below + h <= maxY) { y = below; arrow = 'tut-arrow-up'; }
        else if (above >= minY) { y = above; arrow = 'tut-arrow-down'; }
        else y = Math.max(minY, maxY - h);   // velký cíl (zahrada): karta dole nad lištou, přes cíl
      } else y = Math.max(minY, maxY - h);
      cardEl.className = `tut-card ${arrow}`;
      cardEl.style.top = `${Math.round(Math.max(minY, Math.min(y, maxY - h)))}px`;
      cardEl.style.visibility = '';

      document.getElementById('tutNext').onclick = () => showStep(i + 1);
      document.getElementById('tutSkip').onclick = () => { cleanup(); overlay.remove(); cardEl.remove(); };
    };

    showStep(0);
  },

  _showFirstRunHint(lang) {
    if (document.getElementById('frHint')) return;
    // Find the indoor choice button to highlight
    const indoor = document.querySelector('.home-choice-indoor');
    if (!indoor) return;
    indoor.classList.add('frHintTarget');

    const hint = document.createElement('div');
    hint.id = 'frHint';
    hint.style.cssText = `
      position:absolute; top:-32px; left:50%; transform:translateX(-50%);
      background:#1a3d0a; color:white; padding:6px 12px; border-radius:50px;
      font-size:11px; font-weight:800; white-space:nowrap;
      box-shadow:0 4px 12px rgba(0,0,0,0.25);
      animation: greamHintBob 1.2s ease-in-out infinite;
      pointer-events:none; z-index:5;
    `;
    hint.textContent = lang === 'cs' ? '👇 Začni tady!' : '👇 Start here!';
    indoor.style.position = 'relative';
    indoor.appendChild(hint);
  },

  // ─── Open world in map view (Pokemon Go style) ───
  async openMapView(world, opts = {}) {
    const p = Profiles.active();
    if (!p) return;
    Feedback.click();
    this._mapPreviewMode = !!opts.preview;
    // Set the target world BEFORE navigating so the 'map-view' screen:ready
    // handler renders the correct world. We must NOT also call renderMapView()
    // directly here — that would open the Leaflet map twice (double POI fetch,
    // stutter, duplicated user marker).
    this._mapViewWorld = world;
    await Router.show('map-view');
  },

  // ─── Open map in preview mode (browse without playing) ───
  async openMapPreview() {
    Feedback.click();
    this.openMapView('nature', { preview: true });
  },

  // ─── Show map (all worlds, filter inside map) ───
  showMapPicker() {
    Feedback.click();
    this.openMapView('nature');
  },

  // ─── RANKING ───
  // ─── Žebříček 1.1: Liga (týdenní souboje) · Dnes (denní kolo) · Sbírka (výzvy, greamíci, odznaky) ───
  async renderRanking() {
    const p = Profiles.active();
    if (!p) return;
    const t = tr();
    this._setText('rankTitle', t.rank_title);
    this._setText('rankTabLeague', t.rank_tab_league);
    this._setText('rankTabDaily', t.rank_tab_daily);
    this._setText('rankTabCollection', t.rank_tab_collection);
    Ranking.update(p.id, p, null, Gream.all(p.id));
    const own = Ranking.own(p.id);
    if (own) Net.rankSubmit({ pid: p.id, name: own.name, avatar: own.avatar, score: own.score, tasks: own.tasks, badges: own.badges, streak: own.streak, greamStage: own.greamStage, greams: own.greams });
    const ownCard = document.getElementById('rankOwnCard');
    if (ownCard && own) {
      ownCard.innerHTML = `<div class="rk-own">
        <div class="rk-own-av">${escAttr(own.avatar)}</div>
        <div style="flex:1;min-width:0"><div class="rk-own-name">${escAttr(own.name)}</div>
          <div class="rk-own-sub">${Ranking.rankTitle(own.score, getLang())} · ${own.score.toLocaleString()} ${t.points_unit}</div></div>
        <div class="rk-own-stats"><b>${own.greams}/24</b><small>${t.rank_greams}</small></div></div>`;
    }
    this.rankSwitchTab(this._rankTab || 'league');
  },

  rankSwitchTab(tab) {
    this._rankTab = tab;
    ['league', 'daily', 'collection'].forEach(k => document.getElementById('rankTab' + k[0].toUpperCase() + k.slice(1))?.classList.toggle('active', k === tab));
    const list = document.getElementById('rankList');
    if (!list) return;
    const t = tr(), p = Profiles.active();
    const loading = `<div class="rk-empty">${t.rank_loading}</div>`;
    const offline = `<div class="rk-empty">📡 ${t.rank_offline}</div>`;
    const row = (rank, name, val, opts = {}) => `<div class="lg-row${opts.zone ? ' ' + opts.zone : ''}${opts.me ? ' me' : ''}"><span>${rank}.</span><b>${opts.av ? `<i class="rk-av">${escAttr(opts.av)}</i>` : ''}${escAttr(name)}</b><span>${val}</span></div>`;
    list.innerHTML = loading;

    if (tab === 'league') {
      if (!Subscription.isPremium()) {
        list.innerHTML = `<div class="rk-lock"><div style="font-size:30px">🏆</div><div>${t.plus_reason.league}</div><button class="btn-primary" onclick="App.openSubscription('league')">⭐ ${t.plus_title}</button></div>`;
        return;
      }
      Net.league(p.id).then(L => {
        if (this._rankTab !== 'league') return;
        if (!L) { list.innerHTML = offline; return; }
        const icon = { bronze: '🥉', silver: '🥈', gold: '🥇', diamond: '💎' }[L.tier] || '🏆';
        const days = Math.max(0, Math.ceil((L.endsAt - Date.now()) / 864e5));
        const rows = (L.top || []).map(r => row(r.rank, r.name, `${r.pts} ${t.league_pts}`, { me: r.me,
          zone: r.rank <= L.promote ? 'up' : (L.demote && r.rank > L.players - L.demote ? 'down' : '') })).join('');
        list.innerHTML = `<div class="rk-head">${icon} <b>${t.league_name[L.tier]}</b><small>${t.league_how(days)}</small></div>
          ${rows || `<div class="rk-empty">${t.league_empty}</div>`}
          <div class="rk-note"><span class="lg-dot up"></span> ${t.league_zone_up} &nbsp; <span class="lg-dot down"></span> ${t.league_zone_down}</div>`;
      });
      return;
    }
    if (tab === 'daily') {
      Net.dailyLeaderboard(new Date().toISOString().slice(0, 10)).then(board => {
        if (this._rankTab !== 'daily') return;
        if (!board) { list.innerHTML = offline; return; }
        list.innerHTML = `<div class="rk-head">📅 <b>${t.rank_daily_title}</b><small>${t.rank_daily_how}</small></div>` +
          (board.length ? board.map((x, i) => row(i + 1, x.name, `${x.score}/10`, { me: x.name === p.name })).join('') : `<div class="rk-empty">${t.rank_daily_empty}</div>`) +
          `<button class="btn-primary rk-cta" onclick="App.openBattleIntro()">⚔️ ${t.rank_daily_play}</button>`;
      });
      return;
    }
    // Sbírka: rodina na tomhle zařízení + svět
    Profiles.all().forEach(x => Ranking.update(x.id, x, null, Gream.all(x.id)));
    const fam = Ranking.local().filter(e => Profiles.all().some(x => x.id === e.id));
    const val = (e) => `${(e.score || 0).toLocaleString()} <small>🐣 ${e.greams ?? 0}/24</small>`;
    const famHtml = fam.length > 1 ? `<div class="rk-sub">${t.rank_family}</div>` + fam.map((e, i) => row(i + 1, e.name, val(e), { me: e.id === p.id, av: e.avatar })).join('') : '';
    list.innerHTML = `<div class="rk-head">🐣 <b>${t.rank_collection_title}</b><small>${t.rank_collection_how}</small></div>${famHtml}<div class="rk-sub">${t.rank_world}</div>${loading}`;
    Net.rankTop(p.id).then(board => {
      if (this._rankTab !== 'collection') return;
      const w = !board ? offline : board.length ? board.slice(0, 20).map((e, i) => row(i + 1, e.name, val(e), { me: !!e.me, av: e.avatar })).join('') : `<div class="rk-empty">${t.rank_world_empty}</div>`;
      list.innerHTML = `<div class="rk-head">🐣 <b>${t.rank_collection_title}</b><small>${t.rank_collection_how}</small></div>${famHtml}<div class="rk-sub">${t.rank_world}</div>${w}`;
    });
  },



  async renderBadges() {
    const p = Profiles.active();
    if (!p) return;
    const t = tr(), lang = getLang();
    this._setText('bc-title', t.my_badges);
    this._setText('streak-title', t.bdg_streak);
    this._setText('bdgWorldsTitle', t.bdg_worlds);
    this._setText('bdgBattleTitle', t.bdg_battles);
    const WC = { nature:'#4a8a2e', language:'#5a4a8a', logic:'#2d7abf', feelings:'#d46d94', arts:'#c87030', world:'#a8743c' };
    const TH = [0, 10, 20, 30, 40, 50, 100];
    let got = 0, all = 0;

    // ── Světy: medaile aktuální úrovně, název, pruh k další úrovni, cesta 7 úrovní ──
    const grid = document.getElementById('worldBadgeGrid');
    if (grid) {
      grid.innerHTML = '';
      WORLDS.forEach(w => {
        const tasks = p.worldTasks?.[w] || 0;
        const lvl = Badges.getLevelIndex(tasks);
        const levels = t.badgeLevels?.[w] || [];
        const cur = levels[lvl] || {}, next = Badges.nextThreshold(tasks);
        const from = TH[lvl], pct = next ? Math.round((tasks - from) / (next - from) * 100) : 100;
        got += lvl; all += TH.length - 1;
        const card = document.createElement('div');
        card.className = 'bdg-world';
        card.style.setProperty('--wc', WC[w]);
        // průhledné odstíny barvy světa (místo color-mix – ten starší Android WebView / Safari < 16.2 neumí)
        card.style.setProperty('--wc-soft', WC[w] + '59'); card.style.setProperty('--wc-mid', WC[w] + 'b3'); card.style.setProperty('--wc-faint', WC[w] + '2e');
        card.innerHTML = `
          <div class="bdg-medal lvl${lvl}"><span>${cur.e || '🏅'}</span><i>${lvl + 1}</i></div>
          <div class="bdg-info">
            <div class="bdg-name">${t.worlds[w]} <small>· ${cur.n || ''}</small></div>
            <div class="bdg-bar"><b style="width:${pct}%"></b></div>
            <div class="bdg-next">${next ? t.bdg_next(next - tasks, levels[lvl + 1]?.n || '') : t.bdg_max}</div>
            <div class="bdg-path">${levels.map((L, i) => `<span class="${i <= lvl ? 'on' : ''}" title="${L.n}">${i <= lvl ? L.e : '·'}</span>`).join('')}</div>
          </div>`;
        grid.appendChild(card);
      });
    }

    // ── Série dní ──
    const medal = (on, e, label, sub) => `<div class="bdg-m ${on ? 'on' : ''}"><div class="bdg-ring">${on ? e : '🔒'}</div><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</div>`;
    const row = document.getElementById('streakRow');
    if (row) {
      row.innerHTML = (t.streakBadges || []).map(sb => {
        const on = Badges.streakEarned(p, sb); all++; if (on) got++;
        return medal(on, sb.e, t.bdg_days(sb.days), sb.desc.replace(/^\d+\s*\S+\s*—\s*/, '').replace(/^\d+ dny v řadě|^\d+ days in a row/, ''));
      }).join('');
    }

    // ── Souboje (dřív jen ve statistikách) ──
    const brow = document.getElementById('bdgBattleRow');
    if (brow) {
      let bb = {}; try { bb = JSON.parse(localStorage.getItem('gream_battle_badges') || '{}')[p.id] || {}; } catch {}
      const B = [['first_win', '🥇'], ['wins_10', '🏆'], ['streak_5', '🔥'], ['extreme_win', '⚡']];
      brow.innerHTML = B.map(([k, e]) => { const on = !!bb[k]; all++; if (on) got++; return medal(on, e, t.bdg_battle[k], ''); }).join('');
    }

    const sum = document.getElementById('bdgSummary');
    if (sum) sum.innerHTML = `<div class="bdg-sum-num">${got}<small>/${all}</small></div><div class="bdg-sum-txt"><b>${t.bdg_summary}</b><div class="bdg-bar"><b style="width:${Math.round(got / all * 100)}%"></b></div></div>`;
  },

  // ─── SETTINGS ───
  async renderSettings() {
    const t = tr(), p = Profiles.active();
    this._setText('set-title',      t.set_title);
    this._setText('ss-lang-title',  t.ss_lang);
    this._setText('ss-lang-lbl',    t.ss_lang_lbl);
    this._setText('ss-data-title',  t.ss_data);
    this._setText('ss-reset-btn',   t.ss_reset);
    this._setText('ss-data-info',   t.ss_data_info);
    this._setText('ss-privacy-title', t.ss_privacy_title);
    this._setText('ss-parents-title', t.parents_title);
    this._setText('parentsOpenBtn', '🔒 ' + t.parents_open);
    this._setText('ss-privacy-lbl',   t.ss_privacy_lbl);
    this._setText('ss-feedback-lbl',  t.ss_feedback_lbl);
    this._setText('ss-terms-lbl',     t.ss_terms_lbl);
    // Player ID
    const csId = getLang() === 'cs';
    this._setText('ss-id-title', csId ? '🆔 Tvé ID hráče' : '🆔 Your player ID');
    this._setText('ss-id-info',  csId
      ? 'Tvoje jedinečné ID pro párování soupeřů a žebříčky. Klepnutím zkopíruješ.'
      : 'Your unique ID for matchmaking and leaderboards. Tap to copy.');
    this._setText('ssPlayerId',  p?.id || '—');
    // Číslo sestavení = verze service workeru (sw.js VERSION) → hned je vidět, jestli telefon nemá starou verzi
    window.caches?.keys?.().then(k => { const v = (k.find(x => /^gream-v\d+-static$/.test(x)) || '').replace('-static', ''); this._setText('ssBuild', `Gream 1.1 · ${v || 'web'}`); }).catch(() => {});
    // Difficulty section
    const cs = getLang() === 'cs';
    this._setText('ss-diff-title', cs ? 'Obtížnost' : 'Difficulty');
    this._setText('ss-diff-hint',  cs
      ? 'Těžší úkoly = více semínek. Snadné 1×, Střední 1.5×, Těžké 2×, Extrémní 3×'
      : 'Harder tasks = more seeds. Easy 1×, Medium 1.5×, Hard 2×, Extreme 3×');
    this._setText('diffLblEasy',    cs ? 'Snadné'   : 'Easy');
    this._setText('diffLblMedium',  cs ? 'Střední'  : 'Medium');
    this._setText('diffLblHard',    cs ? 'Těžké'    : 'Hard');
    this._setText('diffLblExtreme', cs ? 'Extrémní' : 'Extreme');
    const curDiff = Profiles.active()?.difficulty || 'medium';
    document.querySelectorAll('.diff-btn').forEach(btn => {
      const active = btn.dataset.diff === curDiff;
      btn.style.background     = active ? 'var(--green-mid)' : 'white';
      btn.style.color          = active ? 'white' : 'var(--green-deep)';
      btn.style.borderColor    = active ? 'var(--green-mid)' : 'rgba(74,138,46,0.25)';
    });

    this._setText('ss-sound-title', t.ss_sound);
    this._setText('ss-sound-lbl',   t.ss_sound_on);
    this._setText('ss-geo-title',   t.ss_geo);
    this._setText('ss-geo-hint',    t.ss_geo_set_hint);
    this._setText('ss-geo-set-btn', t.ss_geo_set);

    // Sound toggle reflects current state
    const soundEl = document.getElementById('ssSoundToggle');
    if (soundEl) soundEl.checked = Feedback.soundEnabled();

    this._renderMenuMusicSetting();

    // Show clear home button if home is set
    const homeSet = !!Geo.getHome();
    const clearBtn = document.getElementById('ssClearHomeBtn');
    if (clearBtn) clearBtn.style.display = homeSet ? 'inline-flex' : 'none';
    if (homeSet) this._setText('ssGeoStatus', t.ss_geo_set_done);
    this._setText('ss-family-title',   t.ss_family);
    this._setText('ss-family-code-lbl',t.ss_family_code);
    this._setText('ss-family-join',    t.ss_family_join);
    this._setText('ss-join-btn',       t.ss_join_btn);
    this._setAttr('joinCodeInput', 'placeholder', t.ss_join_placeholder || 'XXXXXX');

    const l = getLang();
    document.getElementById('ssEN')?.classList.toggle('active', l === 'en');
    document.getElementById('ssCZ')?.classList.toggle('active', l === 'cs');

    // Profile section
    const psec = document.getElementById('ss-profile-sec');
    if (psec) psec.style.display = p ? 'block' : 'none';
    if (p) {
      this._setText('ss-profile-title', t.ss_profile);
      this._setText('ss-name-label',    t.ss_name);
      this._setText('ss-avatar',        t.ss_avatar);
      const prev = document.getElementById('ssAvatarPreview');
      if (prev) {
        if (p.hasPhoto) {
          const photo = Profiles.getPhoto(p.id);
          prev.innerHTML = photo ? `<img src="${photo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">` : p.avatar || '🧒';
        } else { prev.textContent = p.avatar || '🧒'; }
      }
      // Jméno: jednou zvolené zůstává; změna za semínka nejvýš jednou za týden
      this._setText('ssNameText', p.name);
      this._setText('ssNameBtn', t.name_change_btn(NAME_CHANGE_COST));
      // Family code
      const code = Profiles.getFamilyCode();
      this._setText('ssFamilyCodeNum', code || '——');
    }
  },

  // Změna jména hráče: NAME_CHANGE_COST semínek, nejvýš jednou za 7 dní (jméno vidí ostatní v žebříčcích)
  changeName() {
    const p = Profiles.active(); if (!p) return;
    const t = tr(), lang = getLang();
    const wait = (p.nameChangedAt || 0) + 7 * 864e5 - Date.now();
    if (wait > 0) { this._showToast(t.name_change_wait(Math.ceil(wait / 864e5))); Feedback.error?.(); return; }
    if (Skins.getSeeds(p.id) < NAME_CHANGE_COST) { this._showToast(t.name_change_seeds(NAME_CHANGE_COST)); Feedback.error?.(); return; }
    document.getElementById('nameOverlay')?.remove();
    const ov = document.createElement('div'); ov.id = 'nameOverlay'; ov.className = 'pg-overlay';
    ov.innerHTML = `<div class="pg-card anim-pop"><div class="pg-title">✏️ ${t.name_change_title}</div>
      <div class="pg-reason">${t.name_change_info(NAME_CHANGE_COST)}</div>
      <input class="pg-in" style="width:100%;font-size:18px" maxlength="20" autocomplete="off" value="${escAttr(p.name)}" aria-label="${escAttr(t.name_change_title)}">
      <div class="pg-err" hidden></div>
      <button class="btn-primary">${t.name_change_ok(NAME_CHANGE_COST)}</button><button class="pg-cancel">${t.pg_cancel}</button></div>`;
    document.body.appendChild(ov);
    const inp = ov.querySelector('input'), err = ov.querySelector('.pg-err');
    ov.querySelector('.pg-cancel').onclick = () => ov.remove();
    ov.querySelector('.btn-primary').onclick = () => {
      const v = inp.value.trim().slice(0, 20);
      const bad = !v ? t.name_change_empty : v === p.name ? t.name_change_same : hasProfanity(v) ? (lang === 'cs' ? '🙈 Zvol prosím slušnější jméno.' : '🙈 Please choose a nicer name.') : '';
      if (bad) { err.textContent = bad; err.hidden = false; return; }
      if (!Skins.spendSeeds(p.id, NAME_CHANGE_COST)) { err.textContent = t.name_change_seeds(NAME_CHANGE_COST); err.hidden = false; return; }
      Profiles.update(p.id, { name: v, nameChangedAt: Date.now() });
      ov.remove(); Feedback.success?.();
      this._showToast(t.name_change_done(v));
      this.renderSettings?.();
    };
    inp.focus(); inp.select();
  },

  generateFamilyCode() {
    const code = Profiles.generateFamilyCode();
    this._setText('ssFamilyCodeNum', code);
  },

  joinFamily() {
    const input = document.getElementById('joinCodeInput');
    const code  = input?.value.trim().toUpperCase();
    if (!code || code.length < 4) return;
    const p = Profiles.active();
    if (p) {
      Profiles.update(p.id, { familyCode: code });
      this._setText('ssFamilyCodeNum', code);
      input.value = '';
      // Visual feedback
      const btn = document.getElementById('ss-join-btn');
      if (btn) { btn.textContent = '✓'; setTimeout(() => { btn.textContent = '→'; }, 1500); }
    }
  },

  setLang(l) {
    setLang(l);
    this._syncLangBtns();
    const currentScreen = document.querySelector('.screen:not(.hidden)')?.id;
    if (currentScreen === 'screen-onboarding') {
      this.renderOnboarding();
    }
    const p = Profiles.active();
    if (p) Profiles.update(p.id, { lang: l });
  },

  // ─── Menu music: buy an alternative track with seeds, then switch between them ───
  _renderMenuMusicSetting() {
    const box = document.getElementById('ssMenuMusic');
    if (!box) return;
    const cs = getLang() === 'cs';
    box.innerHTML = '';
    const title = document.createElement('div');
    title.style.cssText = 'font-size:12px;font-weight:800;color:var(--green-mid);margin-bottom:6px';
    title.textContent = cs ? '🎵 Hudba v menu' : '🎵 Menu music';   // nová skladba je výchozí a zdarma (úvod hraje původní)
    box.appendChild(title);

    {
      const cur = Audio.getMenuTrack();
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:6px';
      [['alt', cs ? 'Nová (výchozí)' : 'New (default)'], ['default', cs ? 'Původní' : 'Original']].forEach(([val, label]) => {
        const active = cur === val;
        const b = document.createElement('button');
        b.style.cssText = `flex:1;padding:9px;border-radius:10px;border:2px solid ${active ? 'var(--green-mid)' : 'rgba(0,0,0,0.1)'};background:${active ? 'var(--green-pale)' : 'white'};font-family:inherit;font-weight:800;font-size:13px;cursor:pointer;color:var(--green-deep)`;
        b.textContent = label;
        b.onclick = () => { Audio.setMenuTrack(val); Feedback.tap(); this._renderMenuMusicSetting(); };
        row.appendChild(b);
      });
      box.appendChild(row);
    }
  },

  setDifficulty(diff) {
    const p = Profiles.active();
    if (!p) return;
    Profiles.update(p.id, { difficulty: diff });
    this._updateDiffBtns(diff);
    this._updateDiffPills(diff);
    this.renderSettings();
    Feedback.tap();
  },

  _updateDiffBtns(diff) {
    document.querySelectorAll('.diff-btn').forEach(btn => {
      const active = btn.dataset.diff === diff;
      btn.style.background  = active ? 'var(--green-mid)' : 'white';
      btn.style.color       = active ? 'white' : 'var(--green-deep)';
      btn.style.borderColor = active ? 'var(--green-mid)' : 'rgba(74,138,46,0.25)';
    });
  },

  setLangSetting(l) {
    setLang(l);
    const p = Profiles.active();
    if (p) Profiles.update(p.id, { lang: l });
    this.renderSettings();
    this._syncLangBtns();
  },

  // ─── Profile edit (photo) ───
  async openPhotoUpload() {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        const p = Profiles.active();
        if (!p) return;
        Profiles.savePhoto(p.id, ev.target.result);
        // Update preview
        const prev = document.getElementById('ssAvatarPreview');
        if (prev) prev.innerHTML = `<img src="${ev.target.result}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
      };
      reader.readAsDataURL(file);
    };
    input.click();
  },

  removePhoto() {
    const p = Profiles.active();
    if (!p) return;
    Profiles.removePhoto(p.id);
    const prev = document.getElementById('ssAvatarPreview');
    if (prev) prev.textContent = p.avatar || '🧒';
  },

  // ─── Stats ───
  async renderStats() {
    const container = document.getElementById('screen-stats');
    if (container) Stats.render(container);
    this._renderBattleStats(container);
  },

  // ─── Battle stats + badges section on the Stats screen ───
  _renderBattleStats(container) {
    if (!container) return;
    const p = Profiles.active(); if (!p) return;
    const cs = getLang() === 'cs';
    const s = Battle.getStats(p.id) || {};
    container.querySelector('#battleStatsSection')?.remove();

    let badges = {};
    try { badges = JSON.parse(localStorage.getItem('gream_battle_badges') || '{}')[p.id] || {}; } catch {}
    // All 4 badges are always shown — earned in colour, locked greyed with 🔒 — so the
    // player sees the whole collection to complete (not just what they already have).
    const BADGE_LBL = cs
      ? { first_win:'🥇 První výhra', wins_10:'🏆 10 výher', streak_5:'🔥 Série 5', extreme_win:'⚡ Extrémní vítěz' }
      : { first_win:'🥇 First win', wins_10:'🏆 10 wins', streak_5:'🔥 5 streak', extreme_win:'⚡ Extreme winner' };
    const earnedCount = Object.keys(badges).filter(k => BADGE_LBL[k]).length;
    const badgeChips = Object.keys(BADGE_LBL).map(k => {
      const on = !!badges[k];
      return `<span style="padding:6px 10px;border-radius:50px;background:${on?'var(--green-pale)':'#f1f1f1'};color:${on?'var(--green-deep)':'#b3b3b3'};font-size:12px;font-weight:800">${on ? BADGE_LBL[k] : '🔒 ' + BADGE_LBL[k].replace(/^\S+\s/, '')}</span>`;
    }).join('');

    const hasBattles = !!s.total;
    const winRate = hasBattles ? Math.round((s.wins || 0) / s.total * 100) : 0;
    const sec = document.createElement('div');
    sec.id = 'battleStatsSection';
    sec.className = 'card-section max-w';
    sec.style.marginTop = '14px';
    sec.innerHTML = `
      <div class="section-title">⚔️ ${cs ? 'Souboje' : 'Battles'}</div>
      ${hasBattles ? `
      <div class="stats-grid" style="margin-bottom:12px">
        <div class="stat-card"><div class="stat-num">${s.rating || 1000}</div><div class="stat-label">${cs ? 'Rating' : 'Rating'}</div></div>
        <div class="stat-card"><div class="stat-num">${s.wins || 0}</div><div class="stat-label">${cs ? 'Výhry' : 'Wins'}</div></div>
        <div class="stat-card"><div class="stat-num">${winRate}%</div><div class="stat-label">${cs ? 'Úspěšnost' : 'Win rate'}</div></div>
        <div class="stat-card"><div class="stat-num">${s.bestStreak || 0} 🔥</div><div class="stat-label">${cs ? 'Nejdelší série' : 'Best streak'}</div></div>
      </div>` : `
      <div class="empty-state compact" style="margin-bottom:12px">
        <img src="img/greamici/jiskra_1.png" alt="">
        <div class="es-title">${tr().battles_empty_title}</div>
        <div class="es-text">${tr().battles_empty_text}</div>
        <button class="btn-primary" onclick="App.openBattleIntro()">${tr().battles_empty_cta}</button>
      </div>`}
      <div style="font-size:11px;font-weight:800;color:#999;margin-bottom:7px;text-transform:uppercase;letter-spacing:.5px">${cs ? 'Odznaky' : 'Badges'} ${earnedCount}/4</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">${badgeChips}</div>
      <button onclick="App.showBattleLeaderboard()" style="width:100%;margin-top:14px;padding:11px;border:none;border-radius:12px;background:#f0f0f0;color:#555;font-family:inherit;font-weight:800;font-size:14px;cursor:pointer">🏆 ${cs ? 'Žebříček soubojů' : 'Battle leaderboard'}</button>`;
    container.appendChild(sec);
  },

  // ═══════════════════════════════════
  //  MAP VIEW (Pokemon Go style POI display)
  // ═══════════════════════════════════
  _mapViewWorld: null,
  _mapPOIs: [],

  async renderMapView(world) {
    const t    = tr();
    const lang = getLang();
    const p    = Profiles.active();
    if (!p) return;
    this._mapViewWorld    = world;
    this._currentPoi      = null;
    this._currentPoiWorld = null;

    this._setText('mapViewTitle', t.map_title);
    this._setText('mapViewSub',   lang === 'cs' ? 'Hledám zajímavá místa…' : 'Finding places nearby…');
    this._setText('mapLoadingMsg', lang === 'cs' ? 'Hledám zajímavá místa…' : 'Finding places nearby…');

    // Try last known position first for instant map open
    let pos = Geo.lastPosition();
    if (pos && Date.now() - pos.t < 120000) {
      // Fresh cached position — show map immediately, refresh GPS in background
      Geo.getPosition().catch(() => {});
    } else {
      // No fresh cache — wait for GPS (iOS needs up to 12s for cold start)
      pos = null;
      try {
        pos = await Promise.race([
          Geo.getPosition(),
          new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 12000))
        ]);
      } catch {}
      if (!pos) {
        // Last resort: use stale cached position rather than hardcoded fallback
        pos = Geo.lastPosition() || { lat: 50.0875, lon: 14.4214, fallback: true };
      }
    }

    // Location unavailable/denied → don't silently drop the user in Prague.
    // Show a clear notice + a route back to home challenges.
    const locationOff = !!pos.fallback;
    this._renderMapLocationNotice(locationOff, lang);

    // World filter pills — populate side panel
    const WORLDS = ['nature','language','logic','feelings','arts','world'];
    const WC = { nature:'#4a8a2e', language:'#5a4a8a', logic:'#2d7abf', feelings:'#d46d94', arts:'#c87030', world:'#a8743c' };
    const pillsEl = document.getElementById('mapSidePillsContainer');
    if (pillsEl) {
      pillsEl.innerHTML = '';
      const allPill = document.createElement('div');
      allPill.id = 'pill-all';
      allPill.style.cssText = 'padding:10px 14px;border-radius:12px;font-size:13px;font-weight:800;cursor:pointer;border:2px solid var(--green-mid);color:var(--green-deep);background:var(--green-pale)';
      allPill.textContent = (lang === 'cs' ? 'Vše' : 'All');
      allPill.onclick = () => this._filterMapWorld(null);
      pillsEl.appendChild(allPill);
      WORLDS.forEach(w => {
        const pill = document.createElement('div');
        pill.id = `pill-${w}`;
        pill.style.cssText = 'padding:10px 14px;border-radius:12px;font-size:13px;font-weight:800;cursor:pointer;border:2px solid rgba(0,0,0,0.08);color:#555;background:rgba(0,0,0,0.04)';
        pill.textContent = `${WORLD_EMOJIS[w] || ''} ${t.worlds?.[w] || w}`;
        pill.onclick = () => { this._filterMapWorld(w); this.toggleMapSidePanel(); };
        pillsEl.appendChild(pill);
      });
    }

    // Expose archetypes globally for mapview sprite path
    window._greamArchetypes = ARCHETYPES;

    try {
      const activeGream = Profiles.active() ? Gream.active(Profiles.active().id) : null;
      await MapView.open('leafletMap', pos, {
        radius: 2000,
        gream: activeGream,
        onPoiTap: (poi, info = {}) => {
          // Always open the modal — even when far, so the user can NAVIGATE toward
          // it (play/battle stay gated by proximity inside the modal).
          this.openPoiModal(poi, info);
        },
        onPoisLoaded: pois => {
          const loading = document.getElementById('mapLoading');
          if (loading) loading.style.display = 'none';
          try {
            const here = MapView.userPos() || pos;
            const st = Expedition.ensure(p.id, pois, here);
            const basketEmpty = !Gream.all(p.id).some(g => !g.archived && (g.stage < 2 || !g.archetype)) && Gream.all(p.id).filter(g => !g.archived).length < 6;
            Expedition.eggSpot(p.id, pois, here, basketEmpty);
            MapView.markExpedition(Expedition.get(p.id) || st); this._renderExpeditionChip(Expedition.get(p.id) || st, pois);
          } catch (e) { console.warn('[Expedition]', e); }
          const count = pois.length;
          this._setText('mapViewSub', count > 0
            ? (lang === 'cs' ? `${count} míst v okolí` : `${count} places nearby`)
            : (lang === 'cs' ? 'Žádná místa nenalezena' : 'No places found'));
        }
      });
    } catch (e) {
      console.error('[MapView] open failed:', e);
      const loading = document.getElementById('mapLoading');
      if (loading) loading.querySelector('#mapLoadingMsg').textContent = lang === 'cs' ? 'Chyba načítání.' : 'Load error.';
    }
  },

  // ─── Odkaz mimo hru jen po rodičovské bráně (Google Play Families) ───
  async openExternal(url) {
    if (!/^https:\/\//.test(url)) return;
    if (await ParentGate.ask(tr().open_link_reason)) window.open(url, '_blank', 'noopener');
  },

  // ─── Pro rodiče: za bránou – denní limit, přehled ───
  async openParents() {
    const p = Profiles.active(); if (!p) return;
    const t = tr();
    if (!(await ParentGate.ask(t.parents_title))) return;
    const box = document.getElementById('parentsPanel'); if (!box) return;
    const hist = Profiles.getHistory ? Profiles.getHistory(p.id, 500) : [];
    const week = hist.filter(h => Date.now() - (h.t || 0) < 7 * 864e5).length;
    const W = ['nature', 'language', 'logic', 'feelings', 'arts', 'world'];
    const max = Math.max(10, ...W.map(w => p.worldTasks?.[w] || 0));
    const bs = Battle.getStats(p.id) || {};
    const lim = Playtime.limitMin(p.id);
    box.hidden = false;
    box.innerHTML = `<label class="parents-row">${t.parents_limit}</label>
      <select id="parentsLimit">${[0, 20, 30, 45, 60, 90, 120].map(m => `<option value="${m}"${m === lim ? ' selected' : ''}>${m ? m + ' min' : t.parents_nolimit}</option>`).join('')}</select>
      <div class="parents-row">⏱️ ${t.parents_today(Math.round(Playtime.todaySec(p.id) / 60))}</div>
      <div class="parents-row">📚 ${t.parents_week(week)}</div>
      <div class="parents-row">⚔️ ${t.parents_battles(bs.total || 0)}</div>
      <div class="parents-row" style="margin-top:10px">${t.parents_worlds}</div>
      ${W.map(w => `<div class="parents-bar"><span>${WORLD_EMOJIS[w]} ${t.worlds?.[w] || w}</span><i><b style="width:${Math.round((p.worldTasks?.[w] || 0) / max * 100)}%"></b></i><span>${p.worldTasks?.[w] || 0}</span></div>`).join('')}
      <div class="parents-row" style="font-size:12px;color:var(--ink-muted);margin-top:10px">🔒 ${t.parents_note}</div>`;
    box.querySelector('#parentsLimit').onchange = (e) => { Playtime.setLimit(p.id, Number(e.target.value)); Feedback.tap(); };
    document.getElementById('parentsOpenBtn')?.setAttribute('hidden', '');
  },

  // ─── Bitevní místo: kdo ho drží (anonymně – jen greamík a skóre) ───
  async _loadSpotHolder(poi) {
    const el = document.getElementById('poiSpotHolder'); if (!el) return;
    const t = tr();
    const h = (await Net.spots([poi.id]))?.[poi.id];
    if (!document.getElementById('poiSpotHolder')) return;
    if (!h) { el.innerHTML = `<span>👑</span><div>${t.spot_free}</div>`; return; }
    const mine = (JSON.parse(localStorage.getItem('gream_spot_tokens') || '[]')).includes(h.tok);
    el.innerHTML = `<canvas width="44" height="44"></canvas><div><b>${mine ? t.spot_mine : t.spot_held}</b><br>${ARCHETYPES[h.arch]?.name?.[getLang()] || h.arch} · ${h.score} ${t.spot_pts}${mine ? '' : ` · ${t.spot_beat}`}</div>`;
    const { drawFighter } = await import('./arena.js');
    drawFighter(el.querySelector('canvas'), h.arch, h.stage);
  },

  // ─── Výprava dne: štítek na mapě + seznam míst s navigací ───
  _renderExpeditionChip(st, pois) {
    const mapEl = document.getElementById('leafletMap');
    if (!mapEl || !st) return;
    const t = tr();
    let chip = document.getElementById('expChip');
    if (!chip) { chip = document.createElement('button'); chip.id = 'expChip'; chip.className = 'exp-chip'; mapEl.appendChild(chip); }
    const done = st.done.length, n = st.ids.length;
    chip.innerHTML = `${st.egg ? '🥚 · ' : ''}⭐ ${t.exp_title} ${done}/${n}${st.rare && !st.rareDone ? ' · ✦' : ''} · ${t.exp_explored(Expedition.cells().length)}`;
    chip.onclick = () => {
      document.getElementById('expSheet')?.remove();
      const me = MapView.userPos();
      const d = (p) => { if (!me) return ''; const R = 6371000, r = Math.PI / 180; const x = Math.sin((p.lat - me.lat) * r / 2) ** 2 + Math.cos(me.lat * r) * Math.cos(p.lat * r) * Math.sin((p.lon - me.lon) * r / 2) ** 2; const m = Math.round(2 * R * Math.asin(Math.sqrt(x))); return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`; };
      const row = (id, rare) => { const p = pois.find(x => x.id === id); if (!p) return ''; const ok = rare ? st.rareDone : st.done.includes(id);
        return `<button class="exp-row${ok ? ' ok' : ''}" data-id="${id}"><span>${rare ? '✦' : ok ? '✅' : this._poiIcon(p.kind)}</span><b>${escAttr(this._poiLabel(p))}</b><small>${ok ? t.exp_done : d(p)}</small></button>`; };
      const sh = document.createElement('div'); sh.id = 'expSheet'; sh.className = 'exp-sheet';
      sh.innerHTML = `<div class="exp-card"><div class="exp-h">⭐ ${t.exp_title}</div><div class="exp-sub">${t.exp_how(EXP_REWARD.place, EXP_REWARD.all, EXP_REWARD.rare)}</div>
        ${st.egg ? `<div class="exp-sub" style="margin-top:4px">${t.exp_egg}</div>${row(st.egg, false).replace(/<span>[^<]*<\/span>/, '<span>🥚</span>')}` : ''}
        ${st.ids.map(id => row(id, false)).join('')}${st.rare ? `<div class="exp-sub" style="margin-top:8px">✦ ${t.exp_rare}</div>${row(st.rare, true)}` : ''}
        <div class="exp-sub" style="margin-top:8px">🗺️ ${t.exp_explored_long(Expedition.cells().length)}</div>
        <button class="btn-primary" style="width:100%;margin-top:10px">${t.nav_close}</button></div>`;
      sh.querySelector('.btn-primary').onclick = () => sh.remove();
      sh.onclick = (e) => { if (e.target === sh) sh.remove(); };
      sh.querySelectorAll('.exp-row').forEach(b => b.onclick = () => { const p = pois.find(x => x.id === b.dataset.id); if (p) { MapView.setDestination(p.lat, p.lon, this._poiLabel(p)); sh.remove(); } });
      mapEl.appendChild(sh);
    };
  },

  // ─── Location-off notice on the map ───
  // Shown when GPS is denied/unavailable so the user isn't silently dropped at a
  // fallback location with no explanation. Offers a jump to home challenges.
  _renderMapLocationNotice(locationOff, lang) {
    const mapEl = document.getElementById('leafletMap');
    document.getElementById('mapLocNotice')?.remove();
    if (!locationOff || !mapEl) return;
    const t = tr();
    const notice = document.createElement('div');
    notice.id = 'mapLocNotice';
    notice.style.cssText = 'position:absolute;left:12px;right:12px;top:12px;z-index:520;background:rgba(255,255,255,0.97);border:2px solid rgba(245,166,35,0.5);border-radius:14px;padding:12px 14px;box-shadow:0 4px 16px rgba(0,0,0,0.14);display:flex;align-items:center;gap:10px';
    notice.innerHTML = `
      <div style="font-size:24px;flex-shrink:0">📍</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:800;color:#8a5200">${t.geo_off_title}</div>
        <div style="font-size:11px;color:#a05000;font-weight:600;line-height:1.3">${t.geo_off_sub}</div>
      </div>
      <button id="mapLocHomeBtn" style="flex-shrink:0;padding:8px 12px;border-radius:50px;border:none;background:var(--green-mid);color:white;font-family:inherit;font-weight:800;font-size:11px;cursor:pointer;white-space:nowrap">${t.geo_off_home_btn}</button>`;
    mapEl.appendChild(notice);
    notice.querySelector('#mapLocHomeBtn').onclick = () => { notice.remove(); Router.show('home'); };
  },

  _filterMapWorld(world) {
    const WC = { nature:'#4a8a2e', language:'#5a4a8a', logic:'#2d7abf', feelings:'#d46d94', arts:'#c87030', world:'#a8743c' };
    const WORLDS = ['nature','language','logic','feelings','arts','world'];
    const allEl = document.getElementById('pill-all');
    if (allEl) {
      allEl.style.background  = world ? 'rgba(0,0,0,0.04)' : 'var(--green-pale)';
      allEl.style.color       = world ? '#555' : 'var(--green-deep)';
      allEl.style.borderColor = world ? 'rgba(0,0,0,0.08)' : 'var(--green-mid)';
    }
    WORLDS.forEach(w => {
      const el = document.getElementById(`pill-${w}`);
      if (!el) return;
      const active = world === w;
      el.style.background  = active ? WC[w] : 'rgba(0,0,0,0.04)';
      el.style.color       = active ? 'white' : '#555';
      el.style.borderColor = active ? WC[w] : 'rgba(0,0,0,0.08)';
    });
    // Filter map markers — highlight matching, dim others
    try { MapView.filterByWorld(world); } catch {}
  },

  // ─── POI modal (replaces bottom sheet) ───
  openPoiModal(poi, info = {}) {
    Feedback.click();
    const tooFar = !!info.tooFar;
    this._currentPoi      = poi;
    this._currentPoiWorld = null;
    const t    = tr();
    const lang = getLang();
    const WORLDS = ['nature','language','logic','feelings','arts','world'];
    const WC = { nature:'#4a8a2e', language:'#5a4a8a', logic:'#2d7abf', feelings:'#d46d94', arts:'#c87030', world:'#a8743c' };
    const p = Profiles.active();
    const cur = p?.difficulty || 'medium';
    const diffs = [
      { id:'easy', emoji:'🟢' }, { id:'medium', emoji:'🟡' },
      { id:'hard', emoji:'🔴' }, { id:'extreme', emoji:'⚡' },
    ];

    document.getElementById('poiModalOverlay')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'poiModalOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;z-index:999;padding:20px';
    overlay.onclick = e => { if (e.target === overlay) this.closePoiModal(); };

    this._lastPoi = poi;
    const battle = isBattleSpot(poi);   // výjimečné místo = jen souboj; ostatní = jen výzvy (místa se nepojmenovávají)
    if (battle) setTimeout(() => this._loadSpotHolder(poi), 0);
    const bonusBadge = poi.bonusWorld
      ? `<div style="display:inline-block;padding:3px 10px;border-radius:50px;background:${WC[poi.bonusWorld]};color:white;font-size:11px;font-weight:800;margin-bottom:12px">${WORLD_EMOJIS[poi.bonusWorld]} +5 🌱</div>`
      : '';

    overlay.innerHTML = `
      <div style="background:white;border-radius:24px;padding:20px;max-width:340px;width:100%">
        <div style="text-align:center;margin-bottom:14px">
          <span style="font-size:30px">${battle ? '⚔️' : '🎯'}</span>
          <div style="font-size:17px;font-weight:900;color:var(--green-deep);margin-top:2px">${battle ? t.poi_battle_title : t.poi_challenge_title}</div>
          <div style="font-size:12px;font-weight:700;color:#888;margin:2px 0 6px">${battle ? t.poi_battle_sub : t.poi_challenge_sub}</div>
          ${battle ? '' : bonusBadge}
        </div>
        ${tooFar ? `
          <div style="background:#fff6e6;border:2px solid rgba(245,166,35,0.5);border-radius:14px;padding:12px 14px;margin-bottom:14px;text-align:center">
            <div style="font-size:14px;font-weight:800;color:#8a5200">📍 ${lang==='cs'?`Jsi ${info.dist} m daleko`:`You're ${info.dist} m away`}</div>
            <div style="font-size:11px;color:#a05000;font-weight:600;margin-top:3px;line-height:1.35">${tr().poi_come_closer(PROXIMITY_M)}</div>
          </div>
          <button onclick="App.navigateToPoi()"
            style="width:100%;padding:14px;border-radius:14px;border:none;background:var(--green-mid);color:#fff;font-family:inherit;font-weight:900;font-size:15px;cursor:pointer;margin-bottom:8px">🧭 ${lang==='cs'?'Navigovat sem':'Navigate here'}</button>
        ` : `
          ${battle ? `
          <div id="poiSpotHolder" class="spot-holder"></div>
          <button onclick="App.closePoiModal();App.openBattleIntro({outdoor:true,spot:true})"
            style="width:100%;padding:14px;border-radius:14px;border:none;background:linear-gradient(135deg,#d2603a,#b0402a);color:#fff;font-family:inherit;font-weight:900;font-size:16px;cursor:pointer;margin-bottom:8px">⚔️ ${t.poi_battle_btn}</button>` : `
          <div style="font-size:12px;font-weight:800;color:var(--green-mid);margin-bottom:8px">${lang==='cs'?'Vyber svět:':'Pick a world:'}</div>
          <div id="poiModalWorlds" style="display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-bottom:14px"></div>
          <div style="font-size:12px;font-weight:800;color:var(--green-mid);margin-bottom:8px">${lang==='cs'?'Obtížnost:':'Difficulty:'}</div>
          <div style="display:flex;gap:6px;margin-bottom:16px">
            ${diffs.map(d=>`<button data-d="${d.id}" onclick="window._poiDiff('${d.id}')"
              style="flex:1;padding:10px 4px;border-radius:10px;border:2.5px solid ${d.id===cur?'var(--green-mid)':'rgba(0,0,0,0.08)'};background:${d.id===cur?'var(--green-pale)':'white'};font-family:inherit;font-weight:800;font-size:16px;cursor:pointer;transition:all 0.12s">
              ${Subscription.difficultyAllowed(d.id) ? d.emoji : '🔒'}
            </button>`).join('')}
          </div>
          <button id="poiModalStart" onclick="App.startPoiChallenge()"
            style="display:none;width:100%;padding:14px;border-radius:14px;border:none;color:white;font-family:inherit;font-weight:900;font-size:15px;cursor:pointer;margin-bottom:8px"></button>`}
          <button onclick="App.navigateToPoi()"
            style="width:100%;padding:12px;border-radius:14px;border:2px solid var(--green-pale);background:white;color:var(--green-dark);font-family:inherit;font-weight:800;font-size:14px;cursor:pointer;margin-bottom:8px">🧭 ${lang==='cs'?'Navigovat sem':'Navigate here'}</button>
        `}
        <button onclick="App.closePoiModal()" style="width:100%;background:none;border:none;color:var(--green-mid);font-weight:700;font-size:14px;cursor:pointer;padding:6px">
          ${lang==='cs'?'Zavřít':'Close'}
        </button>
      </div>`;

    // World buttons (only in the in-range challenge modal)
    if (tooFar || battle) { document.body.appendChild(overlay); return; }
    const worldGrid = overlay.querySelector('#poiModalWorlds');
    WORLDS.forEach(w => {
      const done = (poi.worldsDone || []).includes(w);
      const btn = document.createElement('button');
      btn.dataset.w = w;
      btn.style.cssText = `padding:10px 6px;border-radius:12px;cursor:pointer;font-family:inherit;border:2px solid rgba(0,0,0,0.08);background:${done?WC[w]:'white'};color:${done?'white':'#333'};font-size:22px;font-weight:800;display:flex;flex-direction:column;align-items:center;gap:2px;transition:all 0.15s`;
      btn.innerHTML = `<span>${WORLD_EMOJIS[w]||'?'}</span>${done?'<span style="font-size:9px;opacity:0.8">✓</span>':''}`;
      btn.onclick = () => {
        worldGrid.querySelectorAll('button').forEach(b => { b.style.borderColor='rgba(0,0,0,0.08)'; b.style.borderWidth='2px'; });
        btn.style.borderColor = WC[w]; btn.style.borderWidth = '3px';
        this._currentPoiWorld = w;
        const start = overlay.querySelector('#poiModalStart');
        if (start) {
          start.style.display = 'block';
          start.style.background = WC[w];
          const bonus = poi.bonusWorld === w;
          start.textContent = bonus
            ? (lang==='cs'?`🌟 Hrát ${t.worlds?.[w]||w} (+5 🌱)`:`🌟 Play ${t.worlds?.[w]||w} (+5 🌱)`)
            : (lang==='cs'?`▶ Hrát ${t.worlds?.[w]||w}`:`▶ Play ${t.worlds?.[w]||w}`);
        }
      };
      worldGrid.appendChild(btn);
    });

    let selectedDiff = cur;
    window._poiDiff = (diff) => {
      if (!Subscription.difficultyAllowed(diff)) { this.openSubscription('difficulty'); return; }
      selectedDiff = diff;
      overlay.querySelectorAll('[data-d]').forEach(b => {
        const active = b.dataset.d === diff;
        b.style.borderColor = active ? 'var(--green-mid)' : 'rgba(0,0,0,0.08)';
        b.style.background  = active ? 'var(--green-pale)' : 'white';
      });
      if (p) Profiles.update(p.id, { difficulty: diff });
    };

    document.body.appendChild(overlay);
  },

  // Místa se nepojmenovávají (data z mapy často nesedí): jen „Výzva“ / „Souboj“
  _poiLabel(poi) { const t = tr(); return isBattleSpot(poi) ? '⚔️ ' + t.poi_battle_title : (WORLD_EMOJIS[poi?.bonusWorld] || '🎯') + ' ' + t.poi_challenge_title; },

  navigateToPoi() {
    const poi = this._currentPoi;
    if (!poi) return;
    const lang = getLang();
    try { MapView.setDestination(poi.lat, poi.lon, this._poiLabel(poi)); } catch {}
    document.getElementById('poiModalOverlay')?.remove();
    window._poiDiff = null;
    this._currentPoiWorld = null;
    // keep _currentPoi cleared like closePoiModal, destination now lives in MapView
    this._currentPoi = null;
  },

  closePoiModal() {
    document.getElementById('poiModalOverlay')?.remove();
    window._poiDiff = null;
    this._currentPoi      = null;
    this._currentPoiWorld = null;
  },

  copyPlayerId() {
    const p = Profiles.active();
    if (!p) return;
    const cs = getLang() === 'cs';
    try { navigator.clipboard?.writeText(p.id); } catch {}
    Feedback.tap();
    this._showToast(cs ? '📋 ID zkopírováno' : '📋 ID copied');
  },

  // kept for legacy calls
  closePoiSheet() { this.closePoiModal(); },

  startPoiChallenge() {
    const poi   = this._currentPoi;
    const world = this._currentPoiWorld;
    if (!poi || !world) return;
    Feedback.success();
    this.closePoiModal();
    Challenge.open(world, { poi: { ...poi, selectedWorld: world } });
  },

  // ─── World side panel toggle ───
  toggleMapSidePanel() {
    const panel = document.getElementById('mapSidePanel');
    const back  = document.getElementById('mapSidePanelBack');
    if (!panel) return;
    const open = panel.style.transform === 'translateX(0px)' || panel.style.transform === 'translateX(0)';
    panel.style.transform = open ? 'translateX(110%)' : 'translateX(0)';
    if (back) back.style.display = open ? 'none' : 'block';
    const lbl = getLang() === 'cs' ? 'Světy' : 'Worlds';
    const title = document.getElementById('mapSidePanelTitle');
    if (title) title.textContent = lbl;
  },

  mapRecenter() {
    Feedback.tap();
    const pos = Geo.lastPosition();
    if (pos) MapView.recenter(pos);
    else Geo.getPosition().then(p => MapView.recenter(p)).catch(() => {});
  },

  _poiIcon(kind) {
    const map = {
      park:'🌳', nature_reserve:'🌿', playground:'🛝', tree:'🌲', spring:'💧',
      peak:'⛰️', wood:'🌲', castle:'🏰', monument:'🗿', memorial:'🕊️',
      ruins:'🏚️', place_of_worship:'⛪', library:'📚', theatre:'🎭',
      arts_centre:'🎨', planetarium:'🔭', museum:'🏛️', artwork:'🖼️',
      gallery:'🖼️', viewpoint:'👁️', attraction:'✨', info:'ℹ️',
      bench:'🪑', social_centre:'🤝', community_centre:'🏘️', garden:'🌸'
    };
    return map[kind] || '📍';
  },

  // ═══════════════════════════════════
  //  WARDROBE
  // ═══════════════════════════════════
  _wardTab: 'decor',
  _wardAvatarSub: 'chars',   // avatars sub-tab: 'chars' | 'greams' | 'emoji'

  wardAvatarSub(sub) {
    this._wardAvatarSub = sub;
    Feedback.tap();
    this._renderWardrobeGrid('avatars');
  },

  async renderWardrobe() {
    const p = Profiles.active();
    if (!p) return;
    const t    = tr();
    const lang = getLang();

    this._setText('wardTitle',      tr().ward_title);
    this._setText('wardSeeds',      Skins.getSeeds(p.id));
    this._setText('wardTitle', tr().ward_title);
    document.querySelectorAll('.shop-tabs [data-l]').forEach(el => { el.textContent = t[el.dataset.l] || ''; });

    const safeTab = ['decor','boosts','avatars','frames','bg'].includes(this._wardTab) ? this._wardTab : 'decor';
    this.wardSwitchTab(safeTab);
  },

  // ─── Obrazovka Greamíci (samostatná sekce v záložce Já) ───
  renderGreams() {
    const p = Profiles.active();
    if (!p) return;
    this._setText('greamsTitle', tr().greams_title);
    this._setText('greamsSeeds', Skins.getSeeds(p.id));
    this._renderWardrobeGreams();
  },

  _renderNewGreamBanner(profileId, lang) {
    const existing = document.getElementById('newGreamBanner');
    if (existing) existing.remove();

    if (!Gream.canAddMore(profileId)) return;

    const owned = Gream.ownedArchetypes(profileId);
    const WC = { nature:'#4a8a2e', language:'#5a4a8a', logic:'#2d7abf', feelings:'#d46d94', arts:'#c87030', world:'#a8743c' };
    const allArchetypes = BASE_ARCHETYPES.map(id => ARCHETYPES[id]);   // výběr druhého greamíka: původních šest, ostatní jen z vajíčka
    const available = allArchetypes.filter(a => !owned.includes(a.id));

    // Find a good container to prepend to
    const wardEl = document.getElementById('wardContent') || document.querySelector('.screen.active');
    if (!wardEl) return;

    const banner = document.createElement('div');
    banner.id = 'newGreamBanner';
    banner.style.cssText = 'margin-bottom:16px;padding:16px;background:linear-gradient(135deg,#fff9e6,#ffedb0);border-radius:18px;border:2px solid #f5c842';

    banner.innerHTML = `
      <div style="font-size:16px;font-weight:900;color:#7a3d00;margin-bottom:8px">
        🎊 ${lang==='cs' ? 'Odemkl ses druhého Greamíka!' : 'You unlocked a second Gream!'}
      </div>
      <div style="font-size:13px;color:#a05800;margin-bottom:12px">
        ${lang==='cs' ? 'Vyber si svého nového společníka:' : 'Choose your new companion:'}
      </div>
      <div style="display:grid;grid-template-columns:repeat(${Math.min(available.length,3)},1fr);gap:8px">
        ${available.map(a => `
          <button onclick="App._addNewGream('${a.id}')" style="
            padding:12px 6px;border-radius:14px;border:2px solid rgba(0,0,0,0.08);
            background:white;cursor:pointer;font-family:inherit;
            display:flex;flex-direction:column;align-items:center;gap:4px;
            transition:all 0.15s;font-weight:800;font-size:13px;color:#333
          ">
            <canvas data-sprite-sheet="img/greamici/${a.id}_2.png" data-sprite-mood="happy"
              width="52" height="52"
              style="width:52px;height:52px;image-rendering:pixelated;display:block;margin:0 auto"></canvas>
            <span>${a.name[lang] || a.name.cs}</span>
            <span style="font-size:10px;color:#888;font-weight:600">${WORLD_EMOJIS[a.primaryWorld]}</span>
          </button>
        `).join('')}
      </div>
    `;

    wardEl.prepend(banner);
    this._initSpriteCanvases(banner);
  },

  _addNewGream(archetypeId) {
    const p = Profiles.active();
    if (!p) return;
    const lang = getLang();
    const newGream = Gream.addNewGream(p.id, archetypeId);
    if (!newGream) return;
    Feedback.celebrate();
    this._showToast(lang === 'cs'
      ? `🥚 ${ARCHETYPES[archetypeId]?.name.cs} se přidal k tvým Greamíkům!`
      : `🥚 ${ARCHETYPES[archetypeId]?.name.en} joined your Greams!`);
    this.renderGreams();
  },

  wardSwitchTab(tab) {
    this._wardTab = tab;
    Feedback.tap();
    document.querySelectorAll('.ward-tab').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === tab);
    });
    // Vybraná záložka vždy viditelná (lišta se posouvá do strany), nový seznam od začátku
    const bar = document.querySelector('.shop-tabs'), act = bar?.querySelector('.ward-tab.active');
    if (bar && act) bar.scrollLeft = Math.max(0, act.offsetLeft - (bar.clientWidth - act.offsetWidth) / 2);
    const scr = document.getElementById('screen-wardrobe');
    if (scr) scr.scrollTop = 0;
    // Show/hide bgShopGrid vs wardGrid
    const wardGrid = document.getElementById('wardGrid');
    const bgGrid = document.getElementById('bgShopGrid');
    if (wardGrid) wardGrid.style.display = tab === 'bg' ? 'none' : '';
    if (bgGrid) bgGrid.style.display = tab === 'bg' ? 'grid' : 'none';

    if (tab === 'greams') {
      this._renderWardrobeGreams();
    } else if (tab === 'boosts') {
      this._renderWardrobeBoosts();
    } else if (tab === 'decor') {
      this._renderWardrobeDecor();
    } else if (tab === 'bg') {
      this.renderBgShop();
    } else {
      this._renderWardrobeGrid(tab);
    }
  },

  _renderWardrobeBoosts() {
    const p = Profiles.active(); if (!p) return;
    const lang = getLang(), cs = lang === 'cs';
    const grid = document.getElementById('wardGrid');
    if (!grid) return;
    this._shopGridStyle(grid, cs ? 'Jednorázové pomocníky za semínka' : 'One-time helpers, buy with seeds');
    const seeds = Skins.getSeeds(p.id);
    SKIN_CATALOG.boosts.forEach(boost => {
      const have = Skins.getBoosts(p.id)[boost.id] || 0;
      grid.appendChild(this._shopCard({
        thumb: `<span class="shop-emoji">${boost.emoji}</span>`,
        name: boost.name[lang] || boost.name.cs,
        sub: (boost.desc[lang] || boost.desc.cs) + (have ? ` · × ${have}` : ''),
        state: '🌱 ' + boost.cost,
        cls: have ? 'owned' : seeds < boost.cost ? 'poor' : '',
        onClick: () => App._buyBoost(boost.id),
      }));
    });
  },

  _buyBoost(boostId) {
    const p = Profiles.active(); if (!p) return;
    const lang = getLang();
    const ok = Skins.buyBoost(p.id, boostId);
    if (ok) {
      Feedback.coin();
      this._setText('wardSeeds', Skins.getSeeds(p.id));
      this._renderWardrobeBoosts();
      const boost = SKIN_CATALOG.boosts.find(b => b.id === boostId);
      this._showToast(`${boost.emoji} ${lang==='cs'?'Zakoupeno!':'Purchased!'}`);
    } else {
      Feedback.error();
      this._showToast(lang === 'cs' ? 'Nedostatek semínek 🌱' : 'Not enough seeds 🌱');
    }
  },

  // ─── Výzdoba v zahradě (za greamíkem) ───
  _renderGardenDecor() {
    const p = Profiles.active();
    const stage = document.getElementById('greamStage');
    if (!p || !stage) return;
    const world = this._gardenWorld();
    stage.querySelector(':scope > .garden-decor')?.remove();   // starý 1D rozvrh
    let layer = world.querySelector('.garden-decor');
    if (!layer) { layer = document.createElement('div'); layer.className = 'garden-decor'; world.prepend(layer); }
    // šířka podle rámu (ne světa) → stejná velikost jako dřív; hloubka (z-index) podle spodní hrany, ať se greamíci můžou schovat za předmět
    layer.innerHTML = Skins.shownDecor(p.id).map(it => { const L = GARDEN_LAYOUT[it.id] || it;
      return `<img src="${it.img}" alt="" data-id="${it.id}" style="left:${L.x}%;top:${L.y}%;width:calc(var(--stage-w) * ${it.w / 100});z-index:${Math.round(L.y * 10)}">`; }).join('');
  },

  // ─── Výzdoba zahrady: koupit / ukázat-schovat ───
  _renderWardrobeDecor() {
    const p = Profiles.active();
    if (!p) return;
    const t = tr(), lang = getLang();
    const grid = document.getElementById('wardGrid');
    if (!grid) return;
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:10px;max-width:420px;margin:0 auto';
    grid.innerHTML = `<div class="shop-hint" style="grid-column:1/-1">${t.shop_decor_hint}</div>`;
    const seeds = Skins.getSeeds(p.id);
    const d = Skins.getDecor(p.id);
    SKIN_CATALOG.decor.forEach(it => {
      const owned = d.owned.includes(it.id), shown = owned && !d.hidden.includes(it.id);
      const card = document.createElement('button');
      card.className = 'shop-item' + (shown ? ' on' : owned ? ' owned' : '') + (!owned && seeds < it.cost ? ' poor' : '');
      card.innerHTML = `<img src="${it.img}" alt=""><span class="shop-name">${it.name[lang] || it.name.cs}</span>
        <span class="shop-state">${shown ? t.shop_in_garden : owned ? t.shop_hidden : '🌱 ' + it.cost}</span>`;
      card.onclick = () => {
        if (owned) { Skins.toggleDecor(p.id, it.id); Feedback.tap(); this._renderWardrobeDecor(); return; }
        const r = Skins.buyDecor(p.id, it.id);
        if (r.ok) { Feedback.success(); this._setText('wardSeeds', Skins.getSeeds(p.id)); this._renderWardrobeDecor(); }
        else { Feedback.error(); this._showToast(t.shop_no_seeds); }
      };
      grid.appendChild(card);
    });
  },

  _renderWardrobeGreams() {
    const p    = Profiles.active();
    if (!p) return;
    const lang = getLang();
    const grid = document.getElementById('greamsList');   // samostatná obrazovka Greamíci (screens/greams.html)
    if (!grid) return;
    grid.style.cssText = 'width:100%;max-width:420px;margin:0 auto;display:flex;flex-direction:column;gap:10px';
    grid.innerHTML = '';

    const allGreams = Gream.all(p.id).filter(g => !g.archived);
    const WC = { nature:'#4a8a2e', language:'#5a4a8a', logic:'#2d7abf', feelings:'#d46d94', arts:'#c87030', world:'#a8743c' };
    const stageNames = {
      cs: ['', 'Vajíčko', 'Mládě', 'Dospívající', 'Dospělý'],
      en: ['', 'Egg', 'Baby', 'Teen', 'Adult']
    };
    const nextThresh = { 1: 12, 2: 60, 3: 250, 4: null };

    const activeGream = Gream.active(p.id);

    allGreams.forEach((g) => {
      const arch  = ARCHETYPES[g.archetype] || {};
      const color = WC[arch.primaryWorld] || '#4a8a2e';
      const sName = (stageNames[lang] || stageNames.cs)[g.stage] || '';
      const next  = nextThresh[g.stage];
      const prog  = next ? Math.min(100, Math.round(g.tasksFor / next * 100)) : 100;
      const isActive = g.id === activeGream?.id;

      const card = document.createElement('div');
      card.style.cssText = `
        background:white;border-radius:18px;padding:14px 16px;
        border:2.5px solid ${isActive ? color : 'rgba(0,0,0,0.07)'};
        display:flex;align-items:center;gap:14px;
        box-shadow:${isActive ? `0 4px 16px ${color}33` : '0 2px 8px rgba(0,0,0,0.06)'};
        cursor:${allGreams.length > 1 && !isActive ? 'pointer' : 'default'};
        transition:border-color 0.2s, box-shadow 0.2s;
      `;

      card.innerHTML = `
        <div style="flex-shrink:0;position:relative;width:64px;height:64px;border-radius:12px;background:${color}18;overflow:hidden;display:flex;align-items:center;justify-content:center">
          ${g.archetype && g.stage >= 2
            ? `<canvas data-sprite-sheet="img/greamici/${g.archetype}_${Math.min(g.stage, 4)}.png" data-sprite-mood="${g.mood||'happy'}" data-arch="${g.archetype}" data-shiny="${g.isShiny ? '1' : ''}"
                 width="64" height="64"
                 style="width:64px;height:64px;image-rendering:pixelated;display:block"></canvas>`
            : `<img src="img/greamici/seed_1.png" style="width:48px;height:48px;object-fit:contain;image-rendering:pixelated" onerror="this.style.fontSize='32px';this.textContent='🥚'">`
          }
          ${isActive
            ? `<div style="position:absolute;top:-4px;right:-4px;background:${color};color:white;border-radius:50%;width:18px;height:18px;font-size:9px;font-weight:900;display:flex;align-items:center;justify-content:center">✓</div>`
            : `<div style="position:absolute;top:-4px;right:-4px;background:#eee;color:#bbb;border-radius:50%;width:18px;height:18px;font-size:8px;display:flex;align-items:center;justify-content:center">○</div>`}
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:16px;font-weight:900;color:var(--green-deep)">${g.name || (arch.name?.[lang] || arch.name?.cs || 'Gream')}</div>
          <div style="font-size:12px;font-weight:700;color:${color};margin-bottom:${g.birth ? 2 : 6}px">${sName} · ${g.tasksFor} ${lang==='cs'?'úkolů':'tasks'}</div>
          ${g.birth ? `<div style="font-size:11px;font-weight:700;color:#8a7a55;margin-bottom:6px">🐣 ${tr().birth_line(g.birth.place ? tr().poi_outdoors : null, new Date(g.birth.at).toLocaleDateString(lang === 'cs' ? 'cs-CZ' : 'en-GB'))}</div>` : ''}
          ${next ? `
            <div style="background:#f0f0f0;border-radius:50px;height:6px;overflow:hidden">
              <div style="background:${color};height:100%;width:${prog}%;border-radius:50px;transition:width 0.4s"></div>
            </div>
            <div style="font-size:10px;color:#999;margin-top:3px">${lang==='cs'?`do ${stageNames[lang][g.stage+1]}: ${g.tasksFor}/${next}`:`to ${stageNames['en'][g.stage+1]}: ${g.tasksFor}/${next}`}</div>
          ` : `<div style="font-size:11px;color:${color};font-weight:700">⭐ ${lang==='cs'?'Plně vyrostlý!':'Fully grown!'}</div>`}
          <div style="font-size:11px;color:#aaa;margin-top:3px">${isActive ? `✓ ${tr().greams_active} · ` : ''}${this._greamOpen === g.id ? '▲' : '▼'} ${lang==='cs'?'detail':'details'}</div>
        </div>
      `;

      // Klepnutí = rozbalit/sbalit detail (aktivace a přejmenování jsou v detailu)
      card.style.cursor = 'pointer';
      card.addEventListener('click', () => {
        this._greamOpen = this._greamOpen === g.id ? null : g.id;
        Feedback.tap();
        this._renderWardrobeGreams();
      });

      // Sleep (archive) button — only if more than one is awake
      if (allGreams.length > 1) {
        const sleepBtn = document.createElement('button');
        sleepBtn.textContent = '😴';
        sleepBtn.title = lang === 'cs' ? 'Uspat' : 'Sleep';
        sleepBtn.style.cssText = 'flex-shrink:0;width:38px;height:38px;border-radius:50%;border:2px solid rgba(0,0,0,0.08);background:white;font-size:18px;cursor:pointer;align-self:center';
        sleepBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const r = Gream.archive(p.id, g.id);
          if (r.ok) {
            Feedback.tap();
            this._showToast(lang === 'cs' ? '😴 Greamík spí. Můžeš přidat dalšího.' : '😴 Gream is sleeping. You can add another.');
            this._renderWardrobeGreams();
          } else {
            this._showToast(lang === 'cs' ? 'Nemůžeš uspat svého jediného Greamíka.' : "Can't sleep your only awake Gream.");
          }
        });
        card.appendChild(sleepBtn);
      }

      grid.appendChild(card);
      if (this._greamOpen === g.id) { card.style.borderRadius = '18px 18px 0 0'; card.style.borderBottomWidth = '0'; grid.appendChild(this._greamDetail(p, g, isActive, color)); }
    });

    // ─── Sleeping (archived) Greams ───
    const sleeping = Gream.allWithArchived(p.id).filter(g => g.archived);
    if (sleeping.length) {
      const hdr = document.createElement('div');
      hdr.style.cssText = 'font-size:12px;font-weight:800;color:#999;text-transform:uppercase;letter-spacing:.5px;margin:14px 4px 2px';
      hdr.textContent = lang === 'cs' ? `😴 Spící (${sleeping.length})` : `😴 Sleeping (${sleeping.length})`;
      grid.appendChild(hdr);

      const full = allGreams.length >= 4;
      sleeping.forEach(g => {
        const arch  = ARCHETYPES[g.archetype] || {};
        const color = WC[arch.primaryWorld] || '#4a8a2e';
        const sName = (stageNames[lang] || stageNames.cs)[g.stage] || '';
        const row = document.createElement('div');
        row.style.cssText = 'background:rgba(255,255,255,0.6);border-radius:14px;padding:10px 14px;display:flex;align-items:center;gap:12px;opacity:0.85';
        row.innerHTML = `
          <div style="flex-shrink:0;width:44px;height:44px;border-radius:10px;background:${color}14;overflow:hidden;display:flex;align-items:center;justify-content:center;filter:grayscale(0.5)">
            ${g.archetype && g.stage >= 2
              ? `<canvas data-sprite-sheet="img/greamici/${g.archetype}_${Math.min(g.stage, 4)}.png" data-sprite-mood="${g.mood||'happy'}" data-arch="${g.archetype}" data-shiny="${g.isShiny ? '1' : ''}" width="44" height="44" style="width:44px;height:44px;image-rendering:pixelated;display:block"></canvas>`
              : `<img src="img/greamici/seed_1.png" style="width:34px;height:34px;object-fit:contain;image-rendering:pixelated">`}
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-size:14px;font-weight:800;color:#666">${g.name || (arch.name?.[lang] || arch.name?.cs || 'Gream')}</div>
            <div style="font-size:11px;font-weight:700;color:#aaa">${sName} · ${g.tasksFor} ${lang==='cs'?'úkolů':'tasks'}</div>
          </div>`;
        const wakeBtn = document.createElement('button');
        wakeBtn.textContent = full ? '🔒' : '☀️';
        wakeBtn.title = lang === 'cs' ? (full ? 'Plno (max 4)' : 'Probudit') : (full ? 'Full (max 4)' : 'Wake');
        wakeBtn.style.cssText = `flex-shrink:0;padding:8px 12px;border-radius:50px;border:none;background:${full ? '#ddd' : 'var(--green-mid)'};color:white;font-size:14px;font-weight:800;cursor:${full ? 'default' : 'pointer'}`;
        wakeBtn.addEventListener('click', () => {
          const r = Gream.unarchive(p.id, g.id);
          if (r.ok) { Feedback.tap(); this._showToast(lang === 'cs' ? '☀️ Greamík se probudil!' : '☀️ Gream woke up!'); this._renderWardrobeGreams(); }
          else this._showToast(lang === 'cs' ? 'Nejdřív uspi jiného (max 4 vzhůru).' : 'Sleep another first (max 4 awake).');
        });
        row.appendChild(wakeBtn);
        grid.appendChild(row);
      });
    }

    // Add new gream button if eligible
    if (Gream.canAddMore(p.id)) {
      const owned = Gream.ownedArchetypes(p.id);
      const available = BASE_ARCHETYPES.map(id => ARCHETYPES[id]).filter(a => !owned.includes(a.id));   // ostatní jen vylíhnutím
      const addCard = document.createElement('div');
      addCard.style.cssText = 'background:linear-gradient(135deg,#fff9e6,#ffedb0);border-radius:18px;padding:14px 16px;border:2px dashed #f5c842';
      addCard.innerHTML = `
        <div style="font-size:14px;font-weight:800;color:#7a3d00;margin-bottom:10px">
          🎊 ${lang==='cs'?'Přidej druhého Greamíka!':'Add a second Gream!'}
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
          ${available.map(a => `
            <button onclick="App._addNewGream('${a.id}')" style="padding:10px 4px;border-radius:12px;border:2px solid rgba(0,0,0,0.08);background:white;cursor:pointer;font-family:inherit;display:flex;flex-direction:column;align-items:center;gap:3px;font-size:12px;font-weight:700;color:#333">
              <canvas data-sprite-sheet="img/greamici/${a.id}_2.png" data-sprite-mood="happy"
                width="40" height="40"
                style="width:40px;height:40px;image-rendering:pixelated;display:block;margin:0 auto"></canvas>
              <span>${a.name[lang]||a.name.cs}</span>
            </button>
          `).join('')}
        </div>
      `;
      grid.appendChild(addCard);
    }
    this._initSpriteCanvases(grid);
  },

  // Detail greamíka: velký obrázek, svět, stádium, rodný list, souboje (speciál, Super účinné / Účinné)
  _greamDetail(p, g, isActive, color) {
    const t = tr(), lang = getLang();
    const box = document.createElement('div');
    box.className = 'gream-detail';
    box.style.borderColor = color;
    const egg = g.stage < 2 || !g.archetype;
    if (egg) {
      // Vajíčko: kolik zbývá, co „cítí“ (svět + podkategorie) a co by se z něj teď vylíhlo
      const lean = eggLeaning(g);
      const subName = lean ? groupName(lean.group, lang) : '';
      const willName = lean?.willBe ? (ARCHETYPES[lean.willBe]?.name?.[lang] || lean.willBe) : '';
      box.innerHTML = `<img src="img/greamici/seed_1.png" alt="" class="gd-egg"><p class="gd-hint">${t.greams_egg_hint(Math.max(0, 12 - (g.tasksFor || 0)))}</p>
        ${lean ? `<div class="gd-row"><span>🥚</span><b>${t.egg_feels(`${WORLD_EMOJIS[lean.world] || ''} ${subName} (${lean.groupCount})`, lean.second ? `${groupName(lean.second.group, lang)} (${lean.second.count})` : '')}</b></div>
        <div class="gd-row"><span>🔮</span><b>${t.egg_will(willName)}</b></div>
        <p class="gd-hint" style="font-size:12px">${t.egg_rule}</p>` : `<p class="gd-hint" style="font-size:12px">${t.egg_rule}</p>`}`;
    } else {
      const arch = ARCHETYPES[g.archetype] || {}, world = arch.primaryWorld;
      const sp = SPECIALS[g.archetype], spT = sp && t.battle_special?.[sp.id];
      const STAGE = { cs: ['', 'Vajíčko', 'Mládě', 'Dospívající', 'Dospělý'], en: ['', 'Egg', 'Baby', 'Teen', 'Adult'] }[lang] || [];
      const nextAt = { 2: 60, 3: 250 }[g.stage];
      // každý greamík patří k jedné skupině: v ní Super účinný, ve zbytku svého světa Účinný
      const myGroup = arch.group;
      const subs = `${WORLD_EMOJIS[world] || ''} ${t.worlds?.[world] || world}`;
      const born = g.birth ? t.birth_line(g.birth.place ? tr().poi_outdoors : null, new Date(g.birth.at).toLocaleDateString(lang === 'cs' ? 'cs-CZ' : 'en-GB')) : '—';
      const row = (k, v) => `<div class="gd-row"><span>${k}</span><b>${v}</b></div>`;
      box.innerHTML = `
        <div class="gd-hero"><canvas data-sprite-sheet="img/greamici/${g.archetype}_${Math.min(g.stage, 4)}.png" data-sprite-mood="happy" data-arch="${g.archetype}" data-shiny="${g.isShiny ? '1' : ''}" width="132" height="132" class="${g.isShiny ? 'shiny' : ''}"></canvas></div>
        ${g.isShiny ? `<div class="gd-shiny">${t.greams_shiny}</div>` : ''}
        ${row(t.greams_world, `${WORLD_EMOJIS[world] || ''} ${t.worlds?.[world] || world}`)}
        ${row(t.greams_stage, `${STAGE[g.stage] || ''} · ${nextAt ? t.greams_next(Math.max(0, nextAt - (g.tasksFor || 0)), STAGE[g.stage + 1]) : t.greams_max}`)}
        ${row(t.greams_born, born)}
        ${spT ? row(t.greams_special, `${spT.name} – ${spT.desc}`) : ''}
        ${row(t.greams_topic, groupName(myGroup, lang))}
        ${row(t.greams_bonus, groupName(myGroup, lang))}
        ${row(t.greams_half, subs)}
        <div class="gd-actions"></div>`;
      const act = box.querySelector('.gd-actions');
      const btn = (label, cls, fn) => { const b = document.createElement('button'); b.className = cls; b.textContent = label; b.onclick = (e) => { e.stopPropagation(); fn(); }; act.appendChild(b); };
      if (!isActive) btn(t.greams_set_active, 'btn-primary', () => {
        Gream.setActive(p.id, g.id); Feedback.tap();
        this._showToast(lang === 'cs' ? `${g.name || arch.name?.cs || 'Gream'} je teď aktivní!` : `${g.name || arch.name?.en || 'Gream'} is now active!`);
        this._renderWardrobeGreams();
      });
      btn('✏️ ' + t.greams_rename, 'btn-ghost', () => { Gream.setActive(p.id, g.id); this.promptRenameGream(); });
    }
    return box;
  },

  _renderWardrobeGrid(tab) {
    const p = Profiles.active();
    if (!p) return;
    const t = tr();
    const lang = getLang();
    const grid = document.getElementById('wardGrid');
    if (!grid) return;
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(95px,1fr));gap:10px;max-width:420px;margin:0 auto';
    grid.innerHTML = '';

    const equipped = Skins.getEquipped(p.id);
    const unlocked = Skins.getUnlocked(p.id);
    const owned    = Skins.getOwned(p.id);

    if (tab === 'avatars') {
      const cs = lang === 'cs';
      const seeds = Skins.getSeeds(p.id);
      const sub = this._wardAvatarSub || 'chars';
      const bestStage = {};
      Gream.all(p.id).filter(g => !g.archived && g.stage >= 2 && g.archetype).forEach(g => {
        if (!bestStage[g.archetype] || g.stage > bestStage[g.archetype]) bestStage[g.archetype] = g.stage;
      });
      this._shopGridStyle(grid, '');

      // ── Přepínač: Greamíci | Emoji (přes celou šířku mřížky) ──
      const sw = document.createElement('div');
      sw.className = 'shop-seg';
      [['chars', cs ? '🦊 Postavičky' : '🦊 Characters'], ['greams', cs ? '🐾 Greamíci' : '🐾 Greams'], ['emoji', '😺 Emoji']].forEach(([id, label]) => {
        const b = document.createElement('button');
        b.textContent = label; b.className = sub === id ? 'on' : '';
        b.onclick = () => this.wardAvatarSub(id);
        sw.appendChild(b);
      });
      grid.appendChild(sw);

      const equipAvatar = (id, emoji, img = null) => {
        Feedback.pop();
        Skins.setEquipped(p.id, 'avatar', id);
        Profiles.update(p.id, { avatar: emoji, avatarImg: img });   // emoji zůstává pro žebříčky na serveru
        this._applyAvatarToEl(document.getElementById('hubAv'), Profiles.active());
        this._applyAvatarToEl(document.getElementById('mapAv'), Profiles.active());
        this._renderWardrobeGrid('avatars');
      };
      if (sub === 'chars') {
        SKIN_CATALOG.char_avatars.forEach(c => {
          const isOwned = owned.has(c.id);
          const isEquipped = equipped.avatar === c.id;
          grid.appendChild(this._shopCard({
            thumb: `<img src="${c.img}" alt="" style="width:58px;height:58px;image-rendering:auto">`,
            name: c.name[lang] || c.name.cs,
            state: isEquipped ? t.shop_equipped : isOwned ? t.ward_equip : '🌱 ' + c.cost,
            cls: isEquipped ? 'on' : isOwned ? 'owned' : seeds < c.cost ? 'poor' : '',
            onClick: () => {
              if (isEquipped) return;
              if (!isOwned) {
                if (seeds < c.cost) { Feedback.error(); this._showToast(t.shop_no_seeds); return; }
                if (!Skins.buyAvatar(p.id, c.id).ok) { Feedback.error(); return; }
                Feedback.coin(); this._setText('wardSeeds', Skins.getSeeds(p.id));
              }
              equipAvatar(c.id, c.emoji, c.img);
            },
          }));
        });
      } else if (sub === 'greams') {
        SKIN_CATALOG.gream_avatars.forEach(ga => {
          const arch = ga.archetype;
          const isUnlocked = !!bestStage[arch];
          const isEquipped = equipped.avatar === ga.id;
          const thumb = isUnlocked
            ? `<canvas data-sprite-sheet="img/greamici/${arch}_${Math.min(bestStage[arch], 4)}.png" data-sprite-mood="happy" width="56" height="56"></canvas>`
            : `<span class="shop-lock">🔒</span>`;
          grid.appendChild(this._shopCard({
            thumb, name: ga.name[lang] || ga.name.cs,
            sub: `${WORLD_EMOJIS[ARCHETYPES[arch]?.primaryWorld] || ''} ${cs ? 'portrét' : 'portrait'}`,
            state: isEquipped ? t.shop_equipped : isUnlocked ? t.ward_equip : (cs ? '🔒 Vylíhni' : '🔒 Hatch'),
            cls: isEquipped ? 'on' : isUnlocked ? 'owned' : 'locked',
            onClick: (isUnlocked && !isEquipped) ? () => equipAvatar(ga.id, '🐾') : null,
          }));
        });
      } else {
        SKIN_CATALOG.avatars.forEach(skin => {
          const isBuy = skin.unlock?.type === 'buy';
          const isUnlocked = isBuy ? owned.has(skin.id) : (skin.unlock.type === 'free' || unlocked.has(skin.id));
          const isEquipped = equipped.avatar === skin.id;
          const canAfford = seeds >= (skin.cost || 0);
          grid.appendChild(this._shopCard({
            thumb: `<span class="shop-emoji">${skin.emoji}</span>`,
            name: skin.name?.[lang] || skin.id,
            sub: !isUnlocked && !isBuy ? Skins.unlockText(skin, lang) : '',
            state: isEquipped ? t.shop_equipped : isUnlocked ? t.ward_equip : isBuy ? '🌱 ' + skin.cost : '🔒',
            cls: isEquipped ? 'on' : isUnlocked ? 'owned' : isBuy ? (canAfford ? '' : 'poor') : 'locked',
            onClick: () => {
              if (isEquipped) return;
              if (isBuy && !isUnlocked) {
                if (!canAfford) { Feedback.error(); this._showToast(t.shop_no_seeds); return; }
                if (!Skins.buyAvatar(p.id, skin.id).ok) { Feedback.error(); return; }
                Feedback.coin();
                this._setText('wardSeeds', Skins.getSeeds(p.id));
              } else if (!isUnlocked) { Feedback.error(); return; }
              equipAvatar(skin.id, skin.emoji);
            },
          }));
        });
      }
      this._initSpriteCanvases(grid);
    } else if (tab === 'frames') {
      const seeds = Skins.getSeeds(p.id);
      const cs = lang === 'cs';
      this._shopGridStyle(grid, cs ? 'Rámeček kolem tvého avataru' : 'A frame around your avatar');
      const FRAME_EMOJIS = { fr_none:'◯', fr_leaf:'🍃', fr_gold:'⭐', fr_rainbow:'🌈', fr_galaxy:'🌌' };
      SKIN_CATALOG.frames.forEach(item => {
        const isOwned = item.cost === 0 || owned.has(item.id);
        const isEquipped = equipped.frame === item.id;
        const canAfford = seeds >= item.cost;
        grid.appendChild(this._shopCard({
          thumb: `<span class="shop-emoji">${FRAME_EMOJIS[item.id] || '🖼️'}</span>`,
          name: item.name?.[lang] || item.id,
          state: isEquipped ? t.shop_equipped : isOwned ? t.ward_equip : '🌱 ' + item.cost,
          cls: isEquipped ? 'on' : isOwned ? 'owned' : canAfford ? '' : 'poor',
          onClick: () => {
            if (isEquipped) return;
            if (isOwned) { Feedback.pop(); Skins.setEquipped(p.id, 'frame', item.id); this._renderWardrobeGrid('frames'); return; }
            if (!canAfford) { Feedback.error(); this._showToast(t.ward_not_enough); return; }
            const r = Skins.buyCosmetic(p.id, item.id);
            if (r.ok) { Feedback.coin(); Skins.setEquipped(p.id, 'frame', item.id); this._setText('wardSeeds', Skins.getSeeds(p.id)); this._renderWardrobeGrid('frames'); }
          },
        }));
      });
    }
  },

  // Jednotná karta obchůdku (všechny záložky): obrázek, název (max 2 řádky), popis (max 2 řádky), stav/cena dole
  _shopCard({ thumb, name, sub = '', state = '', cls = '', onClick = null }) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = ('shop-item ' + cls).trim();
    card.innerHTML = `<span class="shop-thumb">${thumb}</span><span class="shop-name">${name}</span>${sub ? `<span class="shop-sub">${sub}</span>` : ''}<span class="shop-state">${state}</span>`;
    if (onClick) card.onclick = onClick;
    return card;
  },
  _shopGridStyle(grid, hint) {
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:10px;width:100%;max-width:420px;margin:0 auto';
    grid.innerHTML = hint ? `<div class="shop-hint" style="grid-column:1/-1">${hint}</div>` : '';
  },

  // ═══════════════════════════════════
  //  GEO GATE rendering
  // ═══════════════════════════════════
  renderGeoGate() {
    const t = tr();
    const lang = getLang();
    this._setText('geoGateTitle', t.geo_required);
    this._setText('geoGateSub',   t.geo_required_sub);
    this._setText('geoGateBtn',   t.geo_check_btn);
    this._setText('geoGateSkipBtn', lang === 'cs' ? '🏠 Hrát zatím doma' : '🏠 Play from home');
  },

  // ─── Set home pin from settings ───
  async setHomePin() {
    const t = tr();
    Feedback.click();
    try {
      const pos = await Geo.getPosition();
      Geo.setHome(pos);
      Feedback.success();
      this._setText('ssGeoStatus', t.ss_geo_set_done);
      const btn = document.getElementById('ssClearHomeBtn');
      if (btn) btn.style.display = 'inline-flex';
    } catch {
      Feedback.error();
      this._setText('ssGeoStatus', t.geo_no_signal);
    }
  },

  clearHomePin() {
    const t = tr();
    Feedback.tap();
    Geo.clearHome();
    this._setText('ssGeoStatus', '');
    const btn = document.getElementById('ssClearHomeBtn');
    if (btn) btn.style.display = 'none';
  },

  // ─── Toggle sound (settings) ───
  toggleSound(on) {
    Feedback.setSoundEnabled(on);
    Audio.setEnabled(on);
    if (on) Feedback.tap();
  },

  // ─── Challenge actions ───
  nextStep()     { Challenge.nextStep(); },
  parentConfirm(){ Challenge.parentConfirm(); },
  parentDeny()   { Challenge.parentDeny(); },

  // ─── Hint — free if hint charges available, otherwise costs 2 seeds ───
  showHint() {
    const btn  = document.getElementById('chHintBtn');
    const text = document.getElementById('chHintText');
    const lbl  = document.getElementById('chHintLabel');
    if (!btn || !text) return;
    if (btn.classList.contains('used')) return;

    const lang = getLang();
    const cs   = lang === 'cs';
    const p    = Profiles.active();
    const hint = document.getElementById('chHint')?.textContent?.trim();
    if (!hint) return;

    if (p) {
      const charges = Skins.getHintCharges(p.id);
      if (charges > 0) {
        // Use a hint charge (from boost_hint)
        Skins.consumeHintCharge(p.id);
        lbl.textContent = cs ? '💡 nápověda (boost)' : '💡 hint (boost)';
      } else {
        // Fall back to seed cost
        const seeds = Skins.getSeeds(p.id);
        if (seeds >= 2) {
          Skins.addSeeds(p.id, -2);
          this._setText('seedNum', Skins.getSeeds(p.id));
          lbl.textContent = cs ? '-2 semínka' : '-2 seeds';
        } else {
          this._showToast(cs ? 'Potřebuješ 2 semínka na nápovědu 🌱' : 'Need 2 seeds for a hint 🌱');
          return;
        }
      }
    }

    btn.classList.add('used');
    text.style.display = 'block';
    Feedback.tap();
  },

  // draw/voice/write screens removed in v7

  // ─── Parent confirm screen ───
  _initParentConfirm() {
    const lang = getLang();
    const L = lang === 'cs'
      ? { title:'Rodiči, podívej se! 👀', sub:'Dítě splnilo výzvu. Zkontroluj důkaz a rozhodnutí.', yes:'✅ Splněno!', no:'↩️ Zkusit znovu', hint:'Pokud důkaz nestačí, pošli dítě splnit výzvu znovu.' }
      : { title:'Parent, take a look! 👀', sub:"Your child completed the challenge. Check the proof and decide.", yes:'✅ Completed!', no:'↩️ Try again', hint:"If the proof isn't good enough, send them back to try again." };
    this._setText('pc-title', L.title);
    this._setText('pc-sub',   L.sub);
    this._setText('pc-yes',   L.yes);
    this._setText('pc-no',    L.no);
    this._setText('pc-hint',  L.hint);
  },

  // ─── Reset (with custom modal — GDPR right to erasure) ───
  resetAll() {
    Feedback.click();
    const lang = getLang();
    const existing = document.getElementById('resetConfirmOverlay');
    if (existing) { existing.remove(); return; }

    const overlay = document.createElement('div');
    overlay.id = 'resetConfirmOverlay';
    overlay.style.cssText = `
      position:fixed; inset:0; background:rgba(15,42,7,0.7);
      display:flex; align-items:center; justify-content:center;
      z-index:1000; padding:20px;
      animation:slideUp 0.25s ease both;
    `;
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    const title = lang === 'cs' ? 'Smazat všechna data?' : 'Delete all data?';
    const sub = lang === 'cs'
      ? 'Tímto se smaže profil, Grýmík, postup a všechny statistiky. Tato akce je nevratná.'
      : 'This will delete your profile, Gream, progress and all stats. This action is irreversible.';
    const yes = lang === 'cs' ? '🗑️ Smazat vše' : '🗑️ Delete all';
    const no  = lang === 'cs' ? 'Zrušit' : 'Cancel';

    const card = document.createElement('div');
    card.style.cssText = `
      background:white; border-radius:24px; padding:24px; max-width:340px; width:100%;
      box-shadow:0 10px 30px rgba(0,0,0,0.3); text-align:center;
    `;
    card.innerHTML = `
      <div style="font-size:48px;margin-bottom:8px">⚠️</div>
      <h3 style="font-size:18px;font-weight:900;color:var(--green-deep);margin:0 0 8px">${title}</h3>
      <p style="font-size:13px;color:var(--green-mid);font-weight:600;margin:0 0 18px;line-height:1.4">${sub}</p>
      <button id="resetYes" class="btn-danger" style="width:100%;margin-bottom:8px">${yes}</button>
      <button id="resetNo" class="btn-ghost" style="width:100%">${no}</button>
    `;
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    document.getElementById('resetYes').onclick = () => {
      Feedback.error();
      // Wipe everything thoroughly
      try {
        localStorage.clear();
        sessionStorage.clear();
        // Unregister service workers too
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.getRegistrations().then(regs => {
            regs.forEach(r => r.unregister());
          }).catch(() => {});
        }
      } catch {}
      setTimeout(() => location.reload(), 300);
    };
    document.getElementById('resetNo').onclick = () => {
      Feedback.tap();
      overlay.remove();
    };
  },

  // ─── Helpers ───
  _setText(id, val)       { const el = document.getElementById(id); if (el) el.textContent = val; },
  _setAttr(id, attr, val) { const el = document.getElementById(id); if (el) el[attr] = val; },

  _showStreakMilestone(days, lang) {
    const cs = lang === 'cs';
    const existing = document.getElementById('streak-milestone-overlay');
    if (existing) existing.remove();

    const EMOJIS = { 3:'🌱', 7:'🔥', 14:'⚡', 30:'🌟', 50:'💎', 100:'👑' };
    const emoji = EMOJIS[days] || '🔥';

    // Audio + haptic
    try { Feedback.streakMilestone(); } catch {}

    const overlay = document.createElement('div');
    overlay.id = 'streak-milestone-overlay';
    overlay.style.cssText = `
      position:fixed; inset:0; background:rgba(0,0,0,0.75);
      display:flex; align-items:center; justify-content:center;
      z-index:9999; animation:fadeIn 0.3s ease both;
    `;

    const card = document.createElement('div');
    card.style.cssText = `
      background:linear-gradient(135deg,#1a3d0a,#2d5a1b);
      border:2px solid #7ecb35; border-radius:24px;
      padding:36px 28px; text-align:center; max-width:300px;
      box-shadow:0 8px 40px rgba(0,0,0,0.5);
      font-family:'Nunito',sans-serif; color:white;
      animation:scaleIn 0.4s cubic-bezier(0.34,1.56,0.64,1) both;
    `;

    card.innerHTML = `
      <div style="font-size:60px;margin-bottom:8px">${emoji}</div>
      <div style="font-size:13px;font-weight:700;color:#7ecb35;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px">
        ${cs ? 'Série dní' : 'Day streak'}
      </div>
      <div style="font-size:56px;font-weight:900;line-height:1;margin-bottom:4px">${days}</div>
      <div style="font-size:18px;font-weight:700;margin-bottom:20px">
        ${cs ? `${days} dní v řadě!` : `${days} days in a row!`}
      </div>
      <div style="font-size:14px;opacity:0.8;margin-bottom:24px">
        ${cs ? 'Tak drž dál! 💪' : 'Keep it going! 💪'}
      </div>
      <button style="
        background:#7ecb35; color:#1a3d0a; border:none;
        border-radius:50px; padding:12px 32px;
        font-size:16px; font-weight:800; cursor:pointer;
        font-family:'Nunito',sans-serif;
      " onclick="document.getElementById('streak-milestone-overlay').remove()">
        ${cs ? '🔥 Pokračovat' : '🔥 Keep going'}
      </button>
    `;

    overlay.appendChild(card);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);

    // Confetti burst
    this._confettiBurst();
  },

  _confettiBurst() {
    const colors = ['#7ecb35','#f5a623','#4fc3f7','#ff7043','#ab47bc'];
    for (let i = 0; i < 60; i++) {
      setTimeout(() => {
        const dot = document.createElement('div');
        const color = colors[Math.floor(Math.random() * colors.length)];
        const size = 6 + Math.random() * 8;
        const x = Math.random() * window.innerWidth;
        dot.style.cssText = `
          position:fixed; left:${x}px; top:-10px; width:${size}px; height:${size}px;
          background:${color}; border-radius:${Math.random()>0.5?'50%':'2px'};
          z-index:10000; pointer-events:none;
          animation:confettiFall ${1.5+Math.random()}s ease-in forwards;
        `;
        document.body.appendChild(dot);
        setTimeout(() => dot.remove(), 3000);
      }, Math.random() * 800);
    }
  },

  _showToast(message) {
    const existing = document.getElementById('app-feedback-toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.id = 'app-feedback-toast';
    toast.style.cssText = `
      position:fixed; bottom:calc(120px + env(safe-area-inset-bottom)); left:16px; right:16px; margin:0 auto; width:fit-content;   /* bez translateX – animace slideUp by ho přepsala a hláška by ujela doprava */
      background:#1a3d0a; color:white; padding:14px 22px;
      border-radius:50px; font-family:'Nunito',sans-serif;
      font-size:15px; font-weight:700; z-index:999;
      box-shadow:0 4px 20px rgba(0,0,0,0.3);
      max-width:320px; text-align:center; line-height:1.4;
      animation:slideUp 0.3s ease both;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
  },

  // ─── Background shop ───
  renderBgShop() {
    const p = Profiles.active();
    if (!p) return;
    const t = tr(), lang = getLang(), cs = lang === 'cs';
    const owned = Skins.getOwnedCosmetics(p.id);
    const equipped = Skins.getEquippedBg(p.id);
    const seeds = Skins.getSeeds(p.id);
    const container = document.getElementById('bgShopGrid');
    if (!container) return;
    this._shopGridStyle(container, cs ? 'Zahrada v jiném kraji – greamíci se v ní procházejí stejně' : 'Your garden somewhere else – Greams walk around it the same way');
    SKIN_CATALOG.backgrounds.forEach(bg => {
      const isOwned = bg.cost === 0 || owned.includes(bg.id);
      const isEquipped = equipped.id === bg.id;
      container.appendChild(this._shopCard({
        thumb: `<span class="shop-bgthumb" style="background-image:url('${bg.file ? 'img/backgrounds/' + bg.file : 'img/bg/garden_wide.jpg'}')"></span>`,
        name: bg.name[lang] || bg.name.cs,
        state: isEquipped ? t.shop_equipped : isOwned ? t.ward_equip : '🌱 ' + bg.cost,
        cls: isEquipped ? 'on' : isOwned ? 'owned' : seeds < bg.cost ? 'poor' : '',
        onClick: () => {
          if (isEquipped) return;
          const result = Skins.purchaseBg(p.id, bg.id);
          if (!result.ok) { Feedback.error(); this._showToast(t.shop_no_seeds); return; }
          Feedback.tap();
          this._setText('wardSeeds', Skins.getSeeds(p.id));
          this.renderBgShop();
        },
      }));
    });
  },
};

// ─── Screen lifecycle events ───
document.addEventListener('screen:ready', ({ detail: { screenId } }) => {
  App._decorate();
  switch (screenId) {
    case 'onboarding':
      App.renderOnboarding();
      Audio.switchScene('intro');
      break;
    case 'profiles':
      App.renderProfiles();
      Audio.switchScene('intro');
      break;
    case 'map':
    case 'home':
      App.renderMap();
      Audio.switchScene('menu');
      break;
    case 'hub':
      App.renderHub();
      Audio.switchScene('menu');
      break;
    case 'badges':
      App.renderBadges();
      Audio.switchScene('menu');
      break;
    case 'ranking':     App.renderRanking();     Audio.switchScene('menu'); break;
    case 'settings':    App.renderSettings();    Audio.switchScene('menu'); break;
    case 'stats':       App.renderStats();       Audio.switchScene('menu'); break;
    case 'parent-confirm': App._initParentConfirm(); Audio.switchScene('menu'); break;
    case 'map-view':
      App.renderMapView(App._mapViewWorld || 'nature');
      Audio.switchScene('outdoor');
      break;
    case 'wardrobe':    App.renderWardrobe();    Audio.switchScene('menu'); break;
    case 'greams':      App.renderGreams();      Audio.switchScene('menu'); break;
    case 'geo-gate':    App.renderGeoGate();     Audio.switchScene('menu'); break;
    case 'history':     App.renderHistory();     Audio.switchScene('menu'); break;
    case 'challenge': {
      // If user lands here without an active challenge, redirect home
      // (e.g. after step-done / browser back without proper flow)
      const hasChallenge = !!Challenge._currentChallenge;
      if (!hasChallenge) {
        console.warn('[Gream] Challenge screen reached without active challenge — redirecting home');
        Router.show('home');
      } else {
        Audio.switchScene('challenge');
      }
      break;
    }
    case 'step-done': {
      const lang = getLang();
      const t = tr();
      App._setText('sdNextBtn',  t.next_step);
      App._setText('sdLaterBtn', t.come_back);
      // Keep the challenge music playing through the whole challenge flow —
      // step-done/badge-earned are part of it. Switching to 'menu' here made the
      // music restart after every step. Menu music resumes when you leave home.
      break;
    }
    case 'badge-earned': {
      const t = tr();
      App._setText('btn-continue-lbl', t.continue);
      break;
    }
  }
});

// ─── Start ───
window.MapView = MapView; // expose for router cleanup
(async function startGream() {
  try {
    await App.init();
    // Úvodní obrazovku schovat až po načtení obrázků zahrady (pozadí, greamíci, výzdoba) – jinak se scéna
    // skládá po kouscích; nejdéle 2,5 s, ať pomalé připojení nezdrží hru
    await App._imagesReady(2500);
    const fallback = document.getElementById('appLoadingFallback');
    if (fallback) { fallback.style.transition = 'opacity .35s'; fallback.style.opacity = '0'; setTimeout(() => { fallback.style.display = 'none'; }, 360); }
  } catch (err) {
    console.error('[Gream] Init crashed:', err);
    const msg = document.getElementById('appLoadingMsg');
    if (msg) {
      msg.innerHTML = `<div style="color:#c54a3d;font-weight:700">Init error</div><div style="font-size:10px;opacity:0.6;margin-top:4px;max-width:280px;word-break:break-word">${err.message || err}</div><button onclick="location.reload()" style="margin-top:10px;padding:8px 16px;border:none;border-radius:8px;background:#4a8a2e;color:white;font-weight:700;cursor:pointer">Reload</button>`;
    }
  }
})();
