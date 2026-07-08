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
import { Geo, WORLD_EMOJIS } from './geo.js';
import { Skins, SKIN_CATALOG } from './skins.js';
import { MapView } from './mapview.js';
import { Gream, ARCHETYPES, spritePath, smartSpritePath } from './gream.js';
import { Subscription, FREE_DAILY_INDOOR, PREMIUM_DAILY_INDOOR, INDOOR_MAX_TOTAL, FREE_DAILY_OUTDOOR, SEED_COST_EXTRA_TASK } from './subscription.js';
import { Ranking } from './ranking.js';
import { Audio } from './audio.js';

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
if ('serviceWorker' in navigator) {
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
const AVATAR_POOL = ['🧒','👧','👦','🧑','🌟','🦊','🐻','🐸'];
let _obAv = AVATAR_POOL[Math.floor(Math.random() * AVATAR_POOL.length)];

// ═══════════════════════════════════
//  App — global namespace (window.App)
// ═══════════════════════════════════
window.App = {

  async init() {
    console.log('[Gream] Init starting...');
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

    if (active) this.applyCosmetics();

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
    // Update tab labels with current lang
    const labels = {
      garden: lang === 'cs' ? 'Zahrada' : 'Garden',
      map:    lang === 'cs' ? 'Svět'    : 'World',
      hub:    lang === 'cs' ? 'Já'      : 'Me',
    };
    for (const [k, v] of Object.entries(labels)) {
      const el = document.getElementById('tabLbl' + k.charAt(0).toUpperCase() + k.slice(1));
      if (el) el.textContent = v;
    }
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

    // Subscribe section — hide when paywall off (v1) or already paid
    const sub = Subscription.get(p.id);
    const subSec = document.getElementById('hubSubscribeSection');
    if (subSec) {
      const hide = !Subscription.paywallEnabled() || !!sub.premiumSince;
      subSec.style.display = hide ? 'none' : 'block';
      this._setText('hubSubscribeLbl', cs ? 'Předplatit Premium ⭐' : 'Subscribe to Premium ⭐');
    }

    // Labels (bilingual)
    this._setText('hubGreamiciLbl', cs ? 'Greamíci'            : 'My Greams');
    this._setText('hubGreamiciSub', cs ? 'Správa & vývoj mazlíčků' : 'Manage & grow your pets');
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
    this._setText('obTitle1', t.ob_v4_step1_title);
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
    Feedback.success();
    const p = Profiles.create({
      name,
      avatar: _obAv === '__photo__' ? '🧒' : _obAv,
      lang: getLang()
    });
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
    this._setText('mapGreeting', Gream.getGreeting(pet, lang));
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
        stageInfo = lang === 'cs' ? `Ještě ${remaining} úkolů do vylíhnutí` : `${remaining} more tasks to hatch`;
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
      speech.textContent = Gream.getGreeting(pet, lang);
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
        const arr = idleLines[getLang()] || idleLines.en;
        el.textContent = arr[Math.floor(Math.random() * arr.length)];
        el.classList.add('show');
        setTimeout(() => el.classList.remove('show'), 2500);
      }, 18000 + Math.random() * 14000);
    }

    // ─── Indoor / Outdoor button labels ───
    this._setText('hcIndoorTitle',  lang === 'cs' ? 'Doma klid' : 'Stay home');
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

    // Daily limit pills — indoor and outdoor
    const sub         = Subscription.get(p.id);
    const indoorDone  = Subscription.getIndoorToday(p.id);
    const outdoorDone = Subscription.getOutdoorToday(p.id);
    const freeIndoor  = sub.isPremium ? PREMIUM_DAILY_INDOOR : FREE_DAILY_INDOOR;

    // Indoor pill on the start-challenge button
    const hcIndoor = document.querySelector('.home-choice-indoor');
    if (hcIndoor) {
      let pill = document.getElementById('indoorPill');
      if (!pill) {
        pill = document.createElement('div');
        pill.id = 'indoorPill';
        pill.style.cssText = 'position:absolute;top:8px;right:8px;font-size:10px;font-weight:800;padding:2px 8px;border-radius:50px;color:white';
        hcIndoor.style.position = 'relative';
        hcIndoor.appendChild(pill);
      }
      const extraBought = Math.max(0, indoorDone - freeIndoor);
      pill.textContent = `🏠 ${indoorDone}/${INDOOR_MAX_TOTAL}`;
      pill.style.background = indoorDone >= INDOOR_MAX_TOTAL ? 'rgba(200,70,50,0.75)' : indoorDone >= freeIndoor ? 'rgba(245,166,35,0.85)' : 'rgba(0,0,0,0.15)';
    }

    // Outdoor pill — only show for free users with a limit
    const hcOutdoor = document.querySelector('.home-choice-outdoor');
    if (hcOutdoor) {
      let opill = document.getElementById('outdoorPill');
      if (!opill) {
        opill = document.createElement('div');
        opill.id = 'outdoorPill';
        opill.style.cssText = 'position:absolute;top:8px;right:8px;font-size:10px;font-weight:800;padding:2px 8px;border-radius:50px;color:white';
        hcOutdoor.style.position = 'relative';
        hcOutdoor.appendChild(opill);
      }
      if (sub.isPremium) {
        opill.textContent = '∞';
        opill.style.background = 'rgba(74,138,46,0.6)';
      } else {
        opill.textContent = `🌳 ${outdoorDone}/${FREE_DAILY_OUTDOOR}`;
        opill.style.background = outdoorDone >= FREE_DAILY_OUTDOOR ? 'rgba(200,70,50,0.75)' : 'rgba(0,0,0,0.15)';
      }
    }

    // Toggle indoor/outdoor button: show outdoor when indoor is exhausted
    const indoorExhausted = indoorDone >= INDOOR_MAX_TOTAL;
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

  _renderGardenGreams(allGreams, activeGream, lang) {
    const stage = document.getElementById('greamStage');
    if (!stage) return;

    stage.querySelectorAll('.garden-gream-slot').forEach(el => el.remove());

    const POSITIONS = {
      1: [50],
      2: [30, 70],
      3: [22, 50, 78],
      4: [18, 38, 62, 82]
    };
    const xPositions = POSITIONS[allGreams.length] || POSITIONS[1];

    allGreams.forEach((g, i) => {
      const isActive = g.id === activeGream?.id;
      const xPct = xPositions[i] || 50;
      const showJar = g.stage < 2 || !g.archetype;

      const slot = document.createElement('div');
      slot.className = 'garden-gream-slot';
      slot.style.cssText = `
        position:absolute;
        left:${xPct}%;
        bottom:18px;
        transform:translateX(-50%) scale(${isActive ? 1.0 : 0.78});
        transform-origin: bottom center;
        opacity:${isActive ? 1 : 0.7};
        z-index:${isActive ? 4 : 3};
        transition:transform 0.3s,opacity 0.3s;
        cursor:pointer;
        display:flex;flex-direction:column;align-items:center;
      `;

      if (showJar) {
        slot.innerHTML = `
          <div style="width:52px;height:52px;border-radius:50%;background:rgba(255,255,255,0.25);border:2px solid rgba(255,255,255,0.5);display:flex;align-items:center;justify-content:center;
            ${g.tasksFor >= 8 ? 'animation:greamIdle 1s ease-in-out infinite;' : ''}
          ">
            <img src="img/greamici/seed_1.png" style="width:38px;height:38px;image-rendering:pixelated" onerror="this.style.display='none';this.nextSibling.style.display='block'">
            <span style="font-size:28px;display:none">🥚</span>
          </div>
          ${isActive ? '<div style="position:absolute;bottom:-18px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.18);width:40px;height:8px;border-radius:50%"></div>' : ''}
        `;
      } else {
        const arch = g.archetype;
        const stageN = Math.min(g.stage, 4);
        slot.innerHTML = `
          <canvas data-sprite-sheet="img/greamici/${arch}_${stageN}.png"
            data-sprite-mood="${isActive ? (g.mood || 'happy') : 'neutral'}"
            width="90" height="90"
            style="width:90px;height:90px;image-rendering:pixelated;display:block;
              ${isActive ? 'animation:greamWalkBlock 1.1s ease-in-out infinite;' : ''}
              filter:drop-shadow(0 4px 8px rgba(0,0,0,${isActive ? '0.3' : '0.15'}));
              ${g.isShiny ? 'filter:drop-shadow(0 4px 8px rgba(255,215,0,0.5));' : ''}
            "></canvas>
          <div style="position:absolute;bottom:-14px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,${isActive ? '0.22' : '0.1'});width:${isActive ? 60 : 44}px;height:${isActive ? 10 : 7}px;border-radius:50%;${isActive ? 'animation:greamWalkShadow 1.1s ease-in-out infinite;' : ''}"></div>
        `;
      }

      slot.addEventListener('click', () => {
        if (!isActive) {
          Gream.setActive(Profiles.active()?.id, g.id);
          this.renderMap();
          Feedback.tap();
        } else {
          this.tapGream();
        }
      });

      stage.appendChild(slot);
    });

    this._initSpriteCanvases(stage);

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
  _moodToQuad(mood) {
    return { happy:[128,128], sad:[128,0], serious:[0,128], neutral:[0,0] }[mood] || [0,0];
  },

  // Draw sprite sheet cell onto canvas, cropped to content and centered
  _drawSpriteCell(ctx, img, sx, sy, canvasW, canvasH) {
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
        this._drawSpriteCell(ctx, img, sx, sy, cssW * dpr, cssH * dpr);
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

    const redraw = canvas.dataset.src !== src || canvas.dataset.mood !== mood;
    if (redraw) {
      canvas.dataset.src  = src;
      canvas.dataset.mood = mood;
      const img = new Image();
      img.src = src;
      const draw = () => this._drawSpriteCell(canvas.getContext('2d'), img, sx, sy, bufW, bufW);
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

  tapGream() {
    Feedback.pop();
    // Works with both canvas (sprite sheet) and original img element
    const target = document.getElementById('greamSpriteCanvas') || document.getElementById('greamSprite');
    if (!target) return;
    target.classList.remove('tapped');
    void target.offsetWidth; // reflow
    target.classList.add('tapped');
    setTimeout(() => target.classList.remove('tapped'), 400);

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
          left:50%;top:42%;pointer-events:none;z-index:20;
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
      speech.textContent = arr[Math.floor(Math.random() * arr.length)];
      speech.classList.add('show');
      setTimeout(() => speech.classList.remove('show'), 1500);
    }
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
    this._setText('histTitle', '📜 ' + t.history_title);
    this._setText('histEmptyMsg', t.history_empty);

    const items = Profiles.getHistory(p.id, 50);
    const list  = document.getElementById('histList');
    const empty = document.getElementById('histEmpty');

    if (!list) return;
    list.innerHTML = '';

    if (items.length === 0) {
      if (empty) empty.style.display = 'block';
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
            ${item.poiName ? ' · 📍 ' + item.poiName : ''}
          </div>
        </div>
      `;
      list.appendChild(row);
    });
  },

  // ─── Dynamic SVG scene behind Greamík ───
  _renderGreamScene(pet) {
    const bg = document.getElementById('greamStage');
    if (!bg) return;

    // Apply purchased background image if equipped
    const p = Profiles.active();
    const equippedBg = p ? Skins.getEquippedBg(p.id) : null;
    if (equippedBg?.file) {
      bg.style.backgroundImage = `url('img/backgrounds/${equippedBg.file}')`;
      bg.style.backgroundSize = 'cover';
      bg.style.backgroundPosition = 'center bottom';
      this._applyTodTint(bg);
      bg.querySelector('svg.scene-svg')?.remove();
      this._applyLivingOverlay(bg);
      return; // skip procedural SVG generation
    }

    // No custom shop bg — use the painted default garden + living overlay
    bg.style.backgroundImage = "url('img/bg/garden_bg.jpg')";
    bg.style.backgroundSize = 'cover';
    bg.style.backgroundPosition = 'center bottom';
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
      this._showToast(check.reason);
      Feedback.error();
      return;
    }

    // Needs to buy extra task with seeds?
    if (check.isPurchase && check.seedCost > 0) {
      const cost = check.seedCost;
      const msg  = lang === 'cs'
        ? `Koupit extra úkol za ${cost} 🌱?`
        : `Buy extra task for ${cost} 🌱?`;
      this._confirmSeedSpend(msg, cost, () => {
        if (!Skins.spendSeeds(p.id, cost)) {
          const lang2 = localStorage.getItem('gream_lang') || 'en';
          this._showToast?.(lang2 === 'cs' ? 'Nemáš dost semínek!' : 'Not enough seeds!');
          return;
        }
        this._setText('seedNum', Skins.getSeeds(p.id));
        this._showDifficultyPicker(() => this._doStartIndoor(p));
      });
      return;
    }

    this._showDifficultyPicker(() => this._doStartIndoor(p));
  },

  // ─── Difficulty picker overlay (shown before any challenge) ───
  _showDifficultyPicker(onConfirm) {
    const lang = getLang();
    const p    = Profiles.active();
    const cur  = p?.difficulty || 'medium';
    const extremeLocked = !(p && Subscription.get(p.id).isPremium);
    const diffs = [
      { id:'easy',    emoji:'🟢', cs:'Snadné',   en:'Easy' },
      { id:'medium',  emoji:'🟡', cs:'Střední',  en:'Medium' },
      { id:'hard',    emoji:'🔴', cs:'Těžké',    en:'Hard' },
      { id:'extreme', emoji: extremeLocked ? '🔒' : '⚡', cs:'Extrémní', en:'Extreme', locked: extremeLocked },
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
      if (diff === 'extreme' && extremeLocked) { this.openSubscription(); return; }
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
        if (name) { G.rename(p.id, pet.id, name); this.renderMap(); }
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
      if (pet) {
        const suggested = Gream.suggestWorld(pet);
        if (suggested) chosen = suggested;
      }
      if (!chosen) {
        // Pick the world with fewest completions for this profile
        const worldCounts = p.worldTasks || {};
        const sorted = allWorlds.slice().sort((a, b) => (worldCounts[a] || 0) - (worldCounts[b] || 0));
        chosen = sorted[0];
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
      <p><strong>Stručně:</strong> Vaše data zůstávají v zařízení. Nikam se neposílají.</p>

      <p><strong>1. Jaká data Gream ukládá</strong><br>
      Jméno, avatar, postup ve hře (úkoly, odznaky, semínka), volitelně pozici "domov" pro venkovní úkoly
      a historii splněných úkolů.</p>

      <p><strong>2. Kde jsou data uložena</strong><br>
      Pouze v lokálním úložišti vašeho prohlížeče (localStorage). Nikdy se neodesílají na žádný server.</p>

      <p><strong>3. Co Gream NEDĚLÁ</strong><br>
      • Žádné reklamy<br>
      • Žádné sledování ani analytika třetích stran<br>
      • Žádné prodávání dat<br>
      • Žádné účty ani přihlášení<br>
      • Žádné cookies ke sledování</p>

      <p><strong>4. Externí služby</strong><br>
      Pro funkci mapy se používá OpenStreetMap (mapové dlaždice). OSM neukládá vaše umístění,
      jen poskytuje obrázky map. Pro fonty se používá Google Fonts.</p>

      <p><strong>5. Děti pod 13 let</strong><br>
      V souladu s COPPA a GDPR-K vyžaduje Gream souhlas rodiče v onboardingu.</p>

      <p><strong>6. Vaše práva</strong><br>
      • Právo na výmaz: tlačítko "Smazat všechna data" v Nastavení smaže vše permanentně.<br>
      • Právo na přenos: data jsou JSON v localStorage, snadno exportovatelná pomocí DevTools.<br>
      • Žádné kontaktní údaje neukládáme.</p>

      <p style="font-size:11px;opacity:0.7;margin-top:14px">Naposledy aktualizováno: květen 2026</p>
    ` : `
      <p><strong>In short:</strong> Your data stays on your device. Nothing is sent anywhere.</p>

      <p><strong>1. What Gream stores</strong><br>
      Name, avatar, game progress (tasks, badges, seeds), optional "home" pin for outdoor tasks,
      history of completed tasks and text answers you write.</p>

      <p><strong>2. Where data is stored</strong><br>
      Only in your browser's local storage (localStorage). Never sent to any server.</p>

      <p><strong>3. What Gream does NOT do</strong><br>
      • No ads<br>
      • No third-party tracking or analytics<br>
      • No data selling<br>
      • No accounts or sign-ins<br>
      • No tracking cookies</p>

      <p><strong>4. External services</strong><br>
      For the map feature, OpenStreetMap is used (map tiles). OSM does not store your location,
      it only provides map images. Google Fonts is used for typography.</p>

      <p><strong>5. Children under 13</strong><br>
      In compliance with COPPA and GDPR-K, Gream requires parental consent during onboarding.</p>

      <p><strong>6. Your rights</strong><br>
      • Right to erasure: "Delete all data" button in Settings permanently removes everything.<br>
      • Data portability: data is JSON in localStorage, easily exportable via DevTools.<br>
      • We do not store contact information.</p>

      <p style="font-size:11px;opacity:0.7;margin-top:14px">Last updated: May 2026</p>
    `;
    this._showInfoModal(title, content);
  },

  openTermsInfo() {
    Feedback.click();
    const lang = getLang();
    const title = lang === 'cs' ? 'Podmínky použití' : 'Terms of use';
    const content = lang === 'cs' ? `
      <p><strong>Co je Gream</strong><br>
      Gream je vzdělávací mobilní hra. Cílem je inspirovat děti k objevování přírody, jazyka,
      logiky a vlastních pocitů formou jednoduchých úkolů.</p>

      <p><strong>Pro koho</strong><br>
      Gream je určen dětem od 4 let. Pro děti pod 13 let je vyžadován souhlas rodiče.</p>

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
      Gream is an educational mobile game. Its goal is to inspire children to explore nature, language,
      logic and their own feelings through simple tasks.</p>

      <p><strong>For whom</strong><br>
      Gream is intended for children aged 4 and up. For children under 13, parental consent is required.</p>

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
    const sub = Subscription.get(profileId);

    // Remove if premium (not trial)
    if (sub.isPremium && !sub.inTrial) { existing?.remove(); return; }
    // Remove if trial expired
    if (!sub.isPremium && !sub.inTrial) { existing?.remove(); return; }

    if (sub.inTrial) {
      if (existing) { existing.querySelector('#trialDays').textContent = sub.trialDaysLeft; return; }
      const banner = document.createElement('div');
      banner.id = 'trialBanner';
      banner.style.cssText = 'background:linear-gradient(135deg,#fde7a8,#f5c842);border-radius:14px;padding:10px 14px;margin-bottom:10px;display:flex;align-items:center;gap:10px;max-width:380px;margin-left:auto;margin-right:auto';
      banner.innerHTML = `
        <div style="font-size:22px">⭐</div>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:800;color:#7a3d00">${lang==='cs'?'Premium trial':'Premium trial'}</div>
          <div style="font-size:11px;color:#a05000">${lang==='cs'?`Zbývá <strong id="trialDays">${sub.trialDaysLeft}</strong> dní zdarma`:`<strong id="trialDays">${sub.trialDaysLeft}</strong> days free left`}</div>
        </div>
        <button onclick="App.openSubscription()" style="padding:6px 12px;border-radius:50px;border:none;background:#f5a623;color:white;font-weight:800;font-size:11px;cursor:pointer;font-family:inherit">${lang==='cs'?'Předplatit':'Subscribe'}</button>`;
      // Insert before home-choices
      const choices = document.querySelector('.home-choices');
      choices?.parentNode?.insertBefore(banner, choices);
    }
  },

  openSubscription() {
    if (!Subscription.paywallEnabled()) return; // v1 ships free — no paywall
    const lang = getLang();
    const p    = Profiles.active();
    const sub  = p ? Subscription.get(p.id) : null;
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(10,20,5,0.7);display:flex;align-items:flex-end;justify-content:center;z-index:999';
    overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
    const cs = lang === 'cs';
    overlay.innerHTML = `
      <div style="background:white;border-radius:24px 24px 0 0;padding:24px 20px 40px;max-width:480px;width:100%;box-shadow:0 -6px 30px rgba(0,0,0,0.2)">
        <div style="width:36px;height:4px;background:rgba(0,0,0,0.12);border-radius:2px;margin:0 auto 20px"></div>
        <div style="text-align:center;margin-bottom:20px">
          <div style="font-size:40px;margin-bottom:8px">⭐</div>
          <div style="font-size:22px;font-weight:900;color:var(--green-deep);margin-bottom:4px">${cs?'Gream Premium':'Gream Premium'}</div>
          <div style="font-size:14px;color:#888">${cs?'99 Kč / měsíc · 7 dní zdarma':'99 CZK / month · 7 days free'}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:20px">
          ${[
            [cs?'6 domácích úkolů denně':'6 indoor tasks per day', '🏠'],
            [cs?'Venku neomezeně':'Unlimited outdoor tasks', '🌳'],
            [cs?'Extra úkoly za semínka (neomezeně)':'Extra tasks with seeds (unlimited)', '🌱'],
            [cs?'Podpora vývoje Gream':'Support Gream development', '💚'],
          ].map(([t,e]) => `<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:#f8fdf4;border-radius:12px;font-size:14px;font-weight:700;color:var(--green-deep)"><span style="font-size:20px">${e}</span>${t}</div>`).join('')}
        </div>
        <button onclick="App._activatePremium(this.closest('[style*=fixed]'))" style="width:100%;padding:16px;border-radius:16px;border:none;background:linear-gradient(135deg,#4a8a2e,#2d6518);color:white;font-family:inherit;font-weight:900;font-size:16px;cursor:pointer;margin-bottom:10px">
          ${cs?'Aktivovat Premium ⭐':'Activate Premium ⭐'}
        </button>
        <div style="text-align:center;font-size:11px;color:#aaa">${cs?'Platba přes App Store / Google Play · Kdykoli zruš':'Payment via App Store / Google Play · Cancel anytime'}</div>
      </div>`;
    document.body.appendChild(overlay);
  },

  _activatePremium(overlay) {
    const p = Profiles.active();
    if (!p) return;
    // In production: trigger in-app purchase here
    // For now: simulate activation
    Subscription.activatePremium(p.id);
    overlay?.remove();
    Feedback.celebrate();
    const lang = getLang();
    this._showToast(lang === 'cs' ? '⭐ Premium aktivováno!' : '⭐ Premium activated!');
    this.renderMap();
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
    if (Skins.getSeeds(p.id) < 1) {
      this._showToast(lang === 'cs' ? '🌱 Nemáš semínka!' : '🌱 No seeds!');
      return;
    }
    Skins.spendSeeds(p.id, 1);
    Gream.manualFeed(p.id);
    Feedback.pop();
    this._setText('seedNum', Skins.getSeeds(p.id));

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
    const chatLines = {
      cs: [['Ahoj!','Čau!'],['Jak se máš?','Super!'],['Pojď si hrát!','Jdu!'],['Dnes bylo hezky','Hmm!'],['✨','🌱']],
      en: [['Hello!','Hi there!'],['How are you?','Great!'],['Let\'s play!','Coming!'],['Nice day','Hmm!'],['✨','🌱']]
    };
    const delay = 6000 + Math.random() * 8000;
    this._chatTimer = setTimeout(() => {
      const slots = document.querySelectorAll('.garden-gream-slot');
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

    const cs = lang === 'cs';
    const steps = [
      {
        sel: '#greamStage',
        icon: '🌱',
        title: cs ? 'Tvoje zahrada' : 'Your garden',
        text: cs
          ? 'Tady bydlí tvoji Greamíci a vajíčka. Zahrada se mění podle denní doby — v noci svítí hvězdy, někdy prší. Čím víc výzev splníš, tím více Greamíků přibyde!'
          : 'Your Greams live here. The garden changes with time of day — stars at night, sometimes rain. Complete more challenges to grow your flock!',
      },
      {
        sel: '.garden-gream-slot, #homeJarWrap',
        icon: '🥚',
        title: cs ? 'Greamík' : 'Your Gream',
        text: cs
          ? 'Tohle je tvoje záhadné vajíčko! Splň 12 výzev a vejce se vylíhne — jeho charakter závisí na tom, která témata hraješ nejradši. Klepnutím na Greamíka ho potěšíš!'
          : 'This is your mystery egg! Complete 12 challenges to hatch it — its personality depends on which topics you play most. Tap it to cheer it up!',
      },
      {
        sel: '#hcIndoorTitle',
        icon: '🏠',
        title: cs ? 'Domácí výzva' : 'Home challenge',
        text: cs
          ? 'Klepni sem pro výzvu doma. Vyber téma — příroda, jazyk, logika, umění nebo svět. Každá správná odpověď přináší semínka 🌱 a pomáhá Greamíkovi růst. Špatná odpověď tě vyhodí a vezme semínka!'
          : 'Tap here to play a home challenge. Choose a topic — nature, language, logic, arts or world. Correct answers earn seeds 🌱. Wrong answers kick you out and cost seeds!',
      },
      {
        sel: '#seedNum',
        icon: '🌱',
        title: cs ? 'Semínka' : 'Seeds',
        text: cs
          ? 'Semínka jsou tvoje herní měna. Sbíráš je splněním výzev — čím těžší, tím víc! Utrácíš je za krmení Greamíků (tlačítko 🍃 v zahradě), skiny nebo boosters v záložce Greamíci.'
          : 'Seeds are your currency. Earn them by completing challenges — harder ones give more! Spend them feeding Greams (🍃 in garden), or on skins and boosters in the Greams tab.',
      },
      {
        sel: '#streakNum',
        icon: '🔥',
        title: cs ? 'Série dní' : 'Day streak',
        text: cs
          ? 'Hraj každý den a buduj sérii! Číslo vedle plamínku říká, kolik dní v řadě hraješ. Přerušení série tě vrátí na nulu — zkus ji co nejdéle udržet!'
          : 'Play every day to build your streak! The number by the flame shows how many days in a row you\'ve played. Break it and you start over — keep it going!',
      },
      {
        sel: '#tab-hub',
        icon: '⭐',
        title: cs ? 'Záložka JÁ' : 'ME tab',
        text: cs
          ? 'Záložka JÁ — tady vidíš celý svůj postup. Odznaky za splněné výzvy, žebříček hráčů, správu Greamíků, historii a nastavení.'
          : 'The ME tab — see your full progress. Badges, ranking, Gream management, history and settings.',
      },
      {
        sel: '#tab-map',
        icon: '🗺️',
        title: cs ? 'Záložka SVĚT' : 'WORLD tab',
        text: cs
          ? 'Záložka SVĚT — mapa s venkovními místy poblíž tebe. Navštiv je a hraj výzvy na místě pro bonusová semínka! Venkovní výzvy přidávají přírodní bonus k péči o Greamíka.'
          : 'The WORLD tab — map with outdoor locations near you. Visit them and play on-site for bonus seeds! Outdoor challenges add a nature bonus to Gream care.',
      },
    ];

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

      // Position card above or below target
      let cardTop = null, cardBottom = null, arrowClass = '';
      if (target) {
        const r = target.getBoundingClientRect();
        const midY = r.top + r.height / 2;
        if (midY < window.innerHeight * 0.55) {
          // Element in top half → card below
          cardTop = Math.min(r.bottom + 18, window.innerHeight - 240);
          arrowClass = 'tut-arrow-up';
        } else {
          // Element in bottom half → card above
          cardBottom = window.innerHeight - r.top + 18;
          arrowClass = 'tut-arrow-down';
        }
        // Fixed-position ring that doesn't disturb target layout
        ringEl = document.createElement('div');
        ringEl.id = 'tutRing';
        const PAD = 8;
        ringEl.style.cssText = `position:fixed;pointer-events:none;z-index:5001;border-radius:18px;border:3px solid var(--green-mid);box-shadow:0 0 0 9999px rgba(0,0,0,0.6),0 0 20px rgba(74,138,46,0.5);transition:all 0.25s;left:${r.left-PAD}px;top:${r.top-PAD}px;width:${r.width+PAD*2}px;height:${r.height+PAD*2}px`;
        document.body.appendChild(ringEl);
        prevEl = target;
      } else {
        cardBottom = 110;
      }

      cardEl.className = `tut-card ${arrowClass}`;
      cardEl.style.top = cardTop !== null ? `${cardTop}px` : '';
      cardEl.style.bottom = cardBottom !== null ? `${cardBottom}px` : '';

      // Progress dots
      const dotsHtml = steps.map((_, di) =>
        `<div style="width:8px;height:8px;border-radius:50%;background:${di === i ? 'var(--green-mid)' : '#e0e0e0'};transition:background 0.2s"></div>`
      ).join('');

      cardEl.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
          <span style="font-size:32px;flex-shrink:0">${step.icon}</span>
          <div style="font-size:17px;font-weight:900;color:var(--green-deep)">${step.title}</div>
          <div style="margin-left:auto;font-size:11px;font-weight:700;color:#bbb">${i+1}/${steps.length}</div>
        </div>
        <div style="font-size:14px;font-weight:700;color:#444;line-height:1.55;margin-bottom:16px">${step.text}</div>
        <div style="display:flex;gap:5px;justify-content:center;margin-bottom:14px">${dotsHtml}</div>
        <button id="tutNext" class="btn-primary" style="width:100%;padding:13px;font-size:15px">
          ${isLast ? (cs ? 'Jdeme na to! 🌱' : "Let's go! 🌱") : (cs ? 'Rozumím, dál →' : 'Got it, next →')}
        </button>
        <button id="tutSkip" style="width:100%;padding:7px;font-size:12px;color:#bbb;font-weight:700;background:none;border:none;cursor:pointer;margin-top:4px">
          ${cs ? 'Přeskočit' : 'Skip'}
        </button>
      `;

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
  async renderRanking() {
    const p    = Profiles.active();
    if (!p) return;
    const lang = getLang();
    const cs   = lang === 'cs';

    // Update own ranking entry
    const pet    = Gream.active(p.id);
    const badges = Badges.getEarned(p.id);
    Ranking.update(p.id, p, badges, pet);

    const own = Ranking.own(p.id);
    const ownCard = document.getElementById('rankOwnCard');
    if (ownCard && own) {
      const title = Ranking.rankTitle(own.score, lang);
      ownCard.innerHTML = `
        <div style="background:linear-gradient(135deg,#4a8a2e,#2d6518);border-radius:18px;padding:16px 18px;color:white;display:flex;align-items:center;gap:14px">
          <div style="font-size:36px">${own.avatar}</div>
          <div style="flex:1">
            <div style="font-size:11px;font-weight:700;opacity:0.7;margin-bottom:2px">${cs?'Tvůj profil':'Your profile'}</div>
            <div style="font-size:18px;font-weight:900">${own.name}</div>
            <div style="font-size:12px;opacity:0.85">${title} · ${own.score.toLocaleString()} ${cs?'bodů':'pts'}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:11px;opacity:0.7">${cs?'Úkoly':'Tasks'}</div>
            <div style="font-size:20px;font-weight:900">${own.tasks}</div>
          </div>
        </div>`;
    }

    this.rankSwitchTab('local');
  },

  rankSwitchTab(tab) {
    document.getElementById('rankTabLocal')?.classList.toggle('active', tab === 'local');
    document.getElementById('rankTabGlobal')?.classList.toggle('active', tab === 'global');
    const list = document.getElementById('rankList');
    if (!list) return;
    const lang = getLang();
    const cs   = lang === 'cs';
    const p    = Profiles.active();

    if (tab === 'global') {
      list.innerHTML = `
        <div style="text-align:center;padding:30px;color:#aaa">
          <div style="font-size:40px;margin-bottom:12px">🌍</div>
          <div style="font-size:15px;font-weight:700">${cs?'Globální žebříček':'Global leaderboard'}</div>
          <div style="font-size:12px;margin-top:6px">${cs?'Dostupný po spuštění online serveru. Hráči budou sdílet obarvenou mapu!':'Available when online server launches. Players will share a colored map!'}</div>
        </div>`;
      return;
    }

    // Local leaderboard
    const entries = Ranking.local();
    list.innerHTML = '';

    if (entries.length === 0) {
      list.innerHTML = `<div style="text-align:center;padding:20px;color:#aaa">${cs?'Zatím žádné záznamy':'No entries yet'}</div>`;
      return;
    }

    const medals = ['🥇','🥈','🥉'];
    entries.forEach((entry, i) => {
      const isOwn   = entry.id === p?.id;
      const medal   = medals[i] || `${i+1}.`;
      const title   = Ranking.rankTitle(entry.score, lang);
      const card    = document.createElement('div');
      card.style.cssText = `background:${isOwn?'rgba(74,138,46,0.08)':'white'};border-radius:14px;padding:12px 14px;border:${isOwn?'2px solid var(--green-mid)':'2px solid rgba(0,0,0,0.06)'};display:flex;align-items:center;gap:12px`;
      card.innerHTML = `
        <div style="font-size:22px;width:32px;text-align:center;flex-shrink:0">${medal}</div>
        <div style="font-size:28px;flex-shrink:0">${entry.avatar}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;font-weight:800;color:var(--green-deep)">${entry.name}</div>
          <div style="font-size:11px;color:#888;font-weight:600">${title}</div>
          <div style="display:flex;gap:8px;margin-top:4px;flex-wrap:wrap">
            <span style="font-size:11px;color:var(--green-mid);font-weight:700">✅ ${entry.tasks} ${cs?'úkolů':'tasks'}</span>
            <span style="font-size:11px;color:#f5a623;font-weight:700">🔥 ${entry.streak}</span>
            <span style="font-size:11px;color:#7a4abc;font-weight:700">🏅 ${entry.badges} ${cs?'odznaků':'badges'}</span>
            <span style="font-size:11px;color:#2d7abf;font-weight:700">🥚 ${cs?['','Vajíčko','Mládě','Dospívající','Dospělý'][entry.greamStage]||'?':['','Egg','Baby','Teen','Adult'][entry.greamStage]||'?'}</span>
          </div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-size:16px;font-weight:900;color:var(--green-deep)">${entry.score.toLocaleString()}</div>
          <div style="font-size:10px;color:#aaa">${cs?'bodů':'pts'}</div>
        </div>`;
      list.appendChild(card);
    });
  },
  async renderBadges() {
    const p = Profiles.active();
    if (!p) return;
    const t = tr();
    this._setText('bc-title', t.my_badges);
    this._setText('streak-title', t.streak_title);

    // Streak badges
    const row = document.getElementById('streakRow');
    if (row) {
      row.innerHTML = '';
      (t.streakBadges || []).forEach(sb => {
        const earned = (p.streak || 0) >= sb.days;
        const el = document.createElement('div');
        el.className = 'sbi' + (earned ? ' earned' : '');
        el.innerHTML = `<div class="sbi-ring">${earned ? sb.e : '🔒'}</div><div class="sbi-lbl">${sb.desc}</div>`;
        row.appendChild(el);
      });
    }

    // World badges — evolving
    const grid = document.getElementById('worldBadgeGrid');
    if (grid) {
      grid.innerHTML = '';
      WORLDS.forEach(w => {
        const tasks = p.worldTasks?.[w] || 0;
        const badge = Badges.getBadge(w, tasks);
        const next  = Badges.nextThreshold(tasks);
        const cell  = document.createElement('div');
        cell.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:4px;';
        const badgeEl = Badges.renderWorldBadge(w, tasks, 62);
        const worldLbl = document.createElement('div');
        worldLbl.style.cssText = 'font-size:11px;font-weight:900;color:var(--green-dark);text-align:center;margin-top:2px';
        worldLbl.textContent = t.worlds[w];
        const subLbl = document.createElement('div');
        subLbl.style.cssText = 'font-size:9.5px;font-weight:700;color:var(--green-mid);text-align:center;line-height:1.3';
        subLbl.innerHTML = `${badge.n}<br>${next ? `${tasks}/${next}` : `${tasks} ★`}`;
        cell.appendChild(badgeEl);
        cell.appendChild(worldLbl);
        cell.appendChild(subLbl);
        grid.appendChild(cell);
      });
    }
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
    this._setText('ss-privacy-lbl',   t.ss_privacy_lbl);
    this._setText('ss-terms-lbl',     t.ss_terms_lbl);
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
      const prev = document.getElementById('ssAvatarPreview');
      if (prev) {
        if (p.hasPhoto) {
          const photo = Profiles.getPhoto(p.id);
          prev.innerHTML = photo ? `<img src="${photo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">` : p.avatar || '🧒';
        } else { prev.textContent = p.avatar || '🧒'; }
      }
      const nameInput = document.getElementById('ssNameInput');
      if (nameInput) { nameInput.value = p.name; nameInput.oninput = () => Profiles.update(p.id, { name: nameInput.value.trim() || p.name }); }
      // Family code
      const code = Profiles.getFamilyCode();
      this._setText('ssFamilyCodeNum', code || '——');
    }
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

    this._setText('mapViewTitle', lang === 'cs' ? 'Mapa' : 'Map');
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
          if (info.tooFar) {
            const lang = getLang();
            this._showToast(lang === 'cs'
              ? `📍 Jsi ${info.dist} m daleko — přibliž se (max 60 m)`
              : `📍 You're ${info.dist} m away — get closer (max 60 m)`);
            return;
          }
          this.openPoiModal(poi);
        },
        onPoisLoaded: pois => {
          const loading = document.getElementById('mapLoading');
          if (loading) loading.style.display = 'none';
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
  openPoiModal(poi) {
    Feedback.click();
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

    const kindIcon = this._poiIcon(poi.kind);
    const bonusBadge = poi.bonusWorld
      ? `<div style="display:inline-block;padding:3px 10px;border-radius:50px;background:${WC[poi.bonusWorld]};color:white;font-size:11px;font-weight:800;margin-bottom:12px">${WORLD_EMOJIS[poi.bonusWorld]} +5 🌱</div>`
      : '';

    overlay.innerHTML = `
      <div style="background:white;border-radius:24px;padding:20px;max-width:340px;width:100%">
        <div style="text-align:center;margin-bottom:14px">
          <span style="font-size:28px">${kindIcon}</span>
          <div style="font-size:13px;font-weight:700;color:#888;margin-top:4px">${(poi.kind||'').replace(/_/g,' ')}</div>
          ${bonusBadge}
        </div>
        <div style="font-size:12px;font-weight:800;color:var(--green-mid);margin-bottom:8px">${lang==='cs'?'Vyber svět:':'Pick a world:'}</div>
        <div id="poiModalWorlds" style="display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-bottom:14px"></div>
        <div style="font-size:12px;font-weight:800;color:var(--green-mid);margin-bottom:8px">${lang==='cs'?'Obtížnost:':'Difficulty:'}</div>
        <div style="display:flex;gap:6px;margin-bottom:16px">
          ${diffs.map(d=>`<button data-d="${d.id}" onclick="window._poiDiff('${d.id}')"
            style="flex:1;padding:10px 4px;border-radius:10px;border:2.5px solid ${d.id===cur?'var(--green-mid)':'rgba(0,0,0,0.08)'};background:${d.id===cur?'var(--green-pale)':'white'};font-family:inherit;font-weight:800;font-size:16px;cursor:pointer;transition:all 0.12s">
            ${d.emoji}
          </button>`).join('')}
        </div>
        <button id="poiModalStart" onclick="App.startPoiChallenge()"
          style="display:none;width:100%;padding:14px;border-radius:14px;border:none;color:white;font-family:inherit;font-weight:900;font-size:15px;cursor:pointer;margin-bottom:8px"></button>
        <button onclick="App.closePoiModal()" style="width:100%;background:none;border:none;color:var(--green-mid);font-weight:700;font-size:14px;cursor:pointer;padding:6px">
          ${lang==='cs'?'Zavřít':'Close'}
        </button>
      </div>`;

    // World buttons
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

  closePoiModal() {
    document.getElementById('poiModalOverlay')?.remove();
    window._poiDiff = null;
    this._currentPoi      = null;
    this._currentPoiWorld = null;
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
  _wardTab: 'greams',

  async renderWardrobe() {
    const p = Profiles.active();
    if (!p) return;
    const t    = tr();
    const lang = getLang();

    this._setText('wardTitle',      lang === 'cs' ? '🥚 Moji Greamíci' : '🥚 My Greams');
    this._setText('wardSeeds',      Skins.getSeeds(p.id));
    // Tab emoji labels are static in HTML — only title needs updating
    this._setText('wardTitle', lang === 'cs' ? '🥚 Greamíci' : '🥚 My Greams');

    const safeTab = ['greams','boosts','avatars','frames','bg'].includes(this._wardTab) ? this._wardTab : 'greams';
    this.wardSwitchTab(safeTab);
  },

  _renderNewGreamBanner(profileId, lang) {
    const existing = document.getElementById('newGreamBanner');
    if (existing) existing.remove();

    if (!Gream.canAddMore(profileId)) return;

    const owned = Gream.ownedArchetypes(profileId);
    const WC = { nature:'#4a8a2e', language:'#5a4a8a', logic:'#2d7abf', feelings:'#d46d94', arts:'#c87030', world:'#a8743c' };
    const allArchetypes = Object.values(ARCHETYPES);
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
    // Re-render wardrobe
    this.renderWardrobe();
  },

  wardSwitchTab(tab) {
    this._wardTab = tab;
    Feedback.tap();
    document.querySelectorAll('.ward-tab').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === tab);
    });
    // Show/hide bgShopGrid vs wardGrid
    const wardGrid = document.getElementById('wardGrid');
    const bgGrid = document.getElementById('bgShopGrid');
    if (wardGrid) wardGrid.style.display = tab === 'bg' ? 'none' : '';
    if (bgGrid) bgGrid.style.display = tab === 'bg' ? 'flex' : 'none';

    if (tab === 'greams') {
      this._renderWardrobeGreams();
    } else if (tab === 'boosts') {
      this._renderWardrobeBoosts();
    } else if (tab === 'bg') {
      this.renderBgShop();
    } else {
      this._renderWardrobeGrid(tab);
    }
  },

  _renderWardrobeBoosts() {
    const p    = Profiles.active(); if (!p) return;
    const lang = getLang();
    const cs   = lang === 'cs';
    const grid = document.getElementById('wardGrid');
    if (!grid) return;
    grid.style.cssText = 'max-width:420px;margin:0 auto;display:flex;flex-direction:column;gap:10px';
    grid.innerHTML = `<div style="font-size:12px;color:#888;font-weight:700;margin-bottom:4px">${cs?'Jednorázové efekty za semínka':'One-time effects, buy with seeds'}</div>`;

    const seeds = Skins.getSeeds(p.id);
    SKIN_CATALOG.boosts.forEach(boost => {
      const owned = Skins.getBoosts(p.id)[boost.id] || 0;
      const canAfford = seeds >= boost.cost;
      const card = document.createElement('div');
      card.style.cssText = `background:white;border-radius:16px;padding:14px 16px;border:2px solid rgba(0,0,0,0.07);display:flex;align-items:center;gap:14px;box-shadow:0 2px 8px rgba(0,0,0,0.05)`;
      card.innerHTML = `
        <div style="font-size:32px;flex-shrink:0">${boost.emoji}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:15px;font-weight:800;color:var(--green-deep)">${boost.name[lang]||boost.name.cs}</div>
          <div style="font-size:12px;color:#888;margin-bottom:4px">${boost.desc[lang]||boost.desc.cs}</div>
          ${owned > 0 ? `<div style="font-size:11px;font-weight:700;color:var(--green-mid)">× ${owned} ${cs?'k dispozici':'available'}</div>` : ''}
        </div>
        <button onclick="App._buyBoost('${boost.id}')" style="
          padding:8px 14px;border-radius:50px;border:none;
          background:${canAfford ? 'var(--green-mid)' : '#ddd'};
          color:${canAfford ? 'white' : '#aaa'};
          font-family:inherit;font-weight:800;font-size:13px;cursor:${canAfford?'pointer':'not-allowed'};
          flex-shrink:0;white-space:nowrap;
        ">🌱 ${boost.cost}</button>`;
      grid.appendChild(card);
      this._initSpriteCanvases(card);
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

  _renderWardrobeAccessories() {
    const p    = Profiles.active(); if (!p) return;
    const lang = getLang();
    const cs   = lang === 'cs';
    const grid = document.getElementById('wardGrid');
    if (!grid) return;
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:10px;max-width:420px;margin:0 auto';
    grid.innerHTML = '';

    const seeds = Skins.getSeeds(p.id);
    const equipped   = Skins.getAccessory(p.id);

    SKIN_CATALOG.accessories.forEach(acc => {
      const owned    = Skins.isAccessoryOwned(p.id, acc.id);
      const isOn     = equipped === acc.id;
      const canAfford = seeds >= acc.cost;
      const card = document.createElement('button');
      card.style.cssText = `
        padding:14px 8px;border-radius:16px;border:2.5px solid ${isOn ? '#f5a623' : owned ? 'var(--green-mid)' : 'rgba(0,0,0,0.08)'};
        background:${isOn ? '#fff9e6' : 'white'};cursor:pointer;font-family:inherit;
        display:flex;flex-direction:column;align-items:center;gap:6px;
        box-shadow:${isOn ? '0 4px 12px rgba(245,166,35,0.3)' : '0 2px 6px rgba(0,0,0,0.06)'};
      `;
      card.innerHTML = `
        <span style="font-size:32px">${acc.emoji}</span>
        <span style="font-size:12px;font-weight:800;color:var(--green-deep)">${acc.name[lang]||acc.name.cs}</span>
        ${isOn ? `<span style="font-size:10px;font-weight:700;color:#f5a623">${cs?'Nasazeno':'Equipped'}</span>`
               : owned ? `<span style="font-size:10px;font-weight:700;color:var(--green-mid)">${cs?'Vlastním':'Owned'}</span>`
               : `<span style="font-size:10px;font-weight:700;color:#888">🌱 ${acc.cost}</span>`}
      `;
      card.onclick = () => {
        if (isOn) {
          // Unequip
          try { localStorage.removeItem('gream_acc_' + p.id); } catch {}
          Feedback.tap();
          this._renderWardrobeAccessories();
          return;
        }
        const ok = Skins.equipAccessory(p.id, acc.id);
        if (ok) {
          Feedback.success();
          this._setText('wardSeeds', Skins.getSeeds(p.id));
          this._renderWardrobeAccessories();
        } else {
          Feedback.error();
          this._showToast(cs ? 'Nedostatek semínek 🌱' : 'Not enough seeds 🌱');
        }
      };
      grid.appendChild(card);
    });
  },

  _renderWardrobeGreams() {
    const p    = Profiles.active();
    if (!p) return;
    const lang = getLang();
    const grid = document.getElementById('wardGrid');
    if (!grid) return;
    grid.style.cssText = 'max-width:420px;margin:0 auto;display:flex;flex-direction:column;gap:10px';
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
            ? `<canvas data-sprite-sheet="img/greamici/${g.archetype}_${g.stage}.png" data-sprite-mood="${g.mood||'happy'}"
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
          <div style="font-size:12px;font-weight:700;color:${color};margin-bottom:6px">${sName} · ${g.tasksFor} ${lang==='cs'?'úkolů':'tasks'}</div>
          ${next ? `
            <div style="background:#f0f0f0;border-radius:50px;height:6px;overflow:hidden">
              <div style="background:${color};height:100%;width:${prog}%;border-radius:50px;transition:width 0.4s"></div>
            </div>
            <div style="font-size:10px;color:#999;margin-top:3px">${lang==='cs'?`do ${stageNames[lang][g.stage+1]}: ${g.tasksFor}/${next}`:`to ${stageNames['en'][g.stage+1]}: ${g.tasksFor}/${next}`}</div>
          ` : `<div style="font-size:11px;color:${color};font-weight:700">⭐ ${lang==='cs'?'Plně vyrostlý!':'Fully grown!'}</div>`}
          ${!isActive && allGreams.length > 1 ? `<div style="font-size:11px;color:#bbb;margin-top:3px">${lang==='cs'?'Klepni pro aktivaci':'Tap to activate'}</div>` : ''}
        </div>
      `;

      // Tap to set active gream
      if (allGreams.length > 1 && !isActive) {
        card.addEventListener('click', () => {
          Gream.setActive(p.id, g.id);
          this._renderWardrobeGreams();
          this._showToast(lang === 'cs'
            ? `${g.name || arch.name?.[lang] || 'Gream'} je teď aktivní!`
            : `${g.name || arch.name?.en || 'Gream'} is now active!`);
        });
      }

      grid.appendChild(card);
    });

    // Add new gream button if eligible
    if (Gream.canAddMore(p.id)) {
      const owned = Gream.ownedArchetypes(p.id);
      const available = Object.values(ARCHETYPES).filter(a => !owned.includes(a.id));
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
      const unlockedArchetypes = new Set(
        Gream.all(p.id).filter(g => !g.archived && g.stage >= 2 && g.archetype).map(g => g.archetype)
      );
      const bestStage = {};
      Gream.all(p.id).filter(g => !g.archived && g.stage >= 2 && g.archetype).forEach(g => {
        if (!bestStage[g.archetype] || g.stage > bestStage[g.archetype]) bestStage[g.archetype] = g.stage;
      });

      grid.style.cssText = 'max-width:420px;margin:0 auto;display:flex;flex-direction:column;gap:0';

      // Section 1: Greamík portraits
      const hdr1 = document.createElement('div');
      hdr1.style.cssText = 'font-size:11px;font-weight:800;color:#888;letter-spacing:.5px;padding:0 4px 8px;text-transform:uppercase';
      hdr1.textContent = cs ? '🐾 Tvoji Greamíci' : '🐾 Your Greams';
      grid.appendChild(hdr1);

      const gGrid = document.createElement('div');
      gGrid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(85px,1fr));gap:8px;margin-bottom:18px';
      grid.appendChild(gGrid);

      const AV = 56;
      SKIN_CATALOG.gream_avatars.forEach(ga => {
        const arch = ga.archetype;
        const isUnlocked = unlockedArchetypes.has(arch);
        const isEquipped = equipped.avatar === ga.id;
        const stage = Math.min(bestStage[arch] || 2, 4);
        const btn = document.createElement('button');
        btn.style.cssText = `display:flex;flex-direction:column;align-items:center;gap:5px;padding:10px 6px 8px;border-radius:14px;font-family:inherit;background:${isEquipped?'linear-gradient(135deg,#cbe3a0,#a8cd7c)':(isUnlocked?'rgba(255,255,255,0.9)':'rgba(0,0,0,0.04)')};border:2px solid ${isEquipped?'var(--green-mid)':'transparent'};cursor:${isUnlocked?'pointer':'default'};opacity:${isUnlocked?'1':'0.4'};position:relative`;
        if (isUnlocked) {
          const cv = document.createElement('canvas');
          cv.setAttribute('data-sprite-sheet', `img/greamici/${arch}_${stage}.png`);
          cv.setAttribute('data-sprite-mood', 'happy');
          cv.setAttribute('width', AV); cv.setAttribute('height', AV);
          cv.style.cssText = `width:${AV}px;height:${AV}px;border-radius:50%`;
          btn.appendChild(cv);
        } else {
          const ph = document.createElement('div');
          ph.style.cssText = `width:${AV}px;height:${AV}px;border-radius:50%;background:rgba(0,0,0,0.08);display:flex;align-items:center;justify-content:center;font-size:22px`;
          ph.textContent = '🔒';
          btn.appendChild(ph);
        }
        const lbl = document.createElement('div');
        lbl.style.cssText = 'font-size:10px;font-weight:800;color:var(--green-deep);text-align:center';
        lbl.textContent = ga.name[lang] || ga.name.cs;
        btn.appendChild(lbl);
        if (isEquipped) { const c = document.createElement('span'); c.style.cssText='position:absolute;top:4px;right:6px;font-size:11px'; c.textContent='✓'; btn.appendChild(c); }
        if (isUnlocked) btn.onclick = () => {
          Feedback.pop();
          Skins.setEquipped(p.id, 'avatar', ga.id);
          Profiles.update(p.id, { avatar: '🐾' });
          this._applyAvatarToEl(document.getElementById('hubAv'), Profiles.active());
          this._applyAvatarToEl(document.getElementById('mapAv'), Profiles.active());
          this._renderWardrobeGrid('avatars');
        };
        gGrid.appendChild(btn);
      });
      this._initSpriteCanvases(gGrid);

      // Section 2: Emoji
      const hdr2 = document.createElement('div');
      hdr2.style.cssText = 'font-size:11px;font-weight:800;color:#888;letter-spacing:.5px;padding:0 4px 8px;text-transform:uppercase';
      hdr2.textContent = '🎭 Emoji';
      grid.appendChild(hdr2);

      const eGrid = document.createElement('div');
      eGrid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(85px,1fr));gap:8px';
      grid.appendChild(eGrid);

      SKIN_CATALOG.avatars.forEach(skin => {
        const isBuy = skin.unlock?.type === 'buy';
        const isUnlocked = isBuy ? owned.has(skin.id) : (skin.unlock.type === 'free' || unlocked.has(skin.id));
        const isEquipped = equipped.avatar === skin.id;
        const canAfford = seeds >= (skin.cost || 0);
        const btn = document.createElement('button');
        btn.style.cssText = `display:flex;flex-direction:column;align-items:center;gap:5px;padding:10px 6px 8px;border-radius:14px;font-family:inherit;background:${isEquipped?'linear-gradient(135deg,#cbe3a0,#a8cd7c)':(isUnlocked?'rgba(255,255,255,0.9)':'rgba(0,0,0,0.04)')};border:2px solid ${isEquipped?'var(--green-mid)':'transparent'};cursor:pointer;position:relative;opacity:${(isUnlocked||isBuy)?'1':'0.55'}`;
        const costTxt = isBuy && !isUnlocked
          ? `<div style="font-size:10px;font-weight:800;color:${canAfford?'var(--orange)':'#aaa'}">🌱 ${skin.cost}</div>`
          : (!isUnlocked ? `<div style="font-size:9px;color:var(--green-mid);font-weight:700">${Skins.unlockText(skin, lang)}</div>` : '');
        btn.innerHTML = `<span style="font-size:30px;line-height:1">${skin.emoji}</span><div style="font-size:10px;font-weight:800;color:var(--green-deep);text-align:center;line-height:1.2">${skin.name?.[lang]||skin.id}</div>${costTxt}${isEquipped?'<span style="position:absolute;top:4px;right:6px;font-size:11px">✓</span>':''}`;
        btn.onclick = () => {
          if (isEquipped) return;
          if (isBuy && !isUnlocked) {
            if (!canAfford) { Feedback.error(); return; }
            if (!Skins.buyAvatar(p.id, skin.id).ok) { Feedback.error(); return; }
            Feedback.coin();
            this._setText('wardSeeds', Skins.getSeeds(p.id));
          } else if (!isUnlocked) { Feedback.error(); return; }
          Feedback.pop();
          Skins.setEquipped(p.id, 'avatar', skin.id);
          Profiles.update(p.id, { avatar: skin.emoji });
          this._applyAvatarToEl(document.getElementById('hubAv'), Profiles.active());
          this._applyAvatarToEl(document.getElementById('mapAv'), Profiles.active());
          this._renderWardrobeGrid('avatars');
        };
        eGrid.appendChild(btn);
      });
    } else if (tab === 'frames') {
      const items  = SKIN_CATALOG.frames;
      const seeds  = Skins.getSeeds(p.id);
      const cs     = lang === 'cs';

      grid.style.cssText = 'max-width:420px;margin:0 auto;display:flex;flex-direction:column;gap:10px';
      grid.innerHTML = `<div style="font-size:12px;color:#888;font-weight:700;margin-bottom:4px">${cs ? 'Rámy pro tvůj avatar' : 'Frames for your avatar'}</div>`;

      const FRAME_EMOJIS = { fr_none:'◯', fr_leaf:'🍃', fr_gold:'⭐', fr_rainbow:'🌈', fr_galaxy:'🌌' };
      items.forEach(item => {
        const isOwned    = owned.has(item.id);
        const isEquipped = equipped.frame === item.id;
        const canAfford  = seeds >= item.cost;
        const card = document.createElement('div');
        card.style.cssText = `background:white;border-radius:16px;padding:14px 16px;border:2px solid ${isEquipped ? 'var(--green-mid)' : 'rgba(0,0,0,0.07)'};display:flex;align-items:center;gap:14px;box-shadow:${isEquipped ? '0 4px 12px rgba(74,138,46,0.2)' : '0 2px 8px rgba(0,0,0,0.05)'};cursor:pointer`;
        const statusBtn = isOwned
          ? `<span style="padding:8px 14px;border-radius:50px;background:${isEquipped ? 'var(--green-mid)' : '#f0f0f0'};color:${isEquipped ? 'white' : 'var(--green-mid)'};font-weight:800;font-size:13px;font-family:inherit;flex-shrink:0">${isEquipped ? (cs?'✓ Aktivní':'✓ Active') : t.ward_equip}</span>`
          : `<button style="padding:8px 14px;border-radius:50px;border:none;background:${canAfford ? 'var(--green-mid)' : '#ddd'};color:${canAfford ? 'white' : '#aaa'};font-family:inherit;font-weight:800;font-size:13px;cursor:${canAfford?'pointer':'not-allowed'};flex-shrink:0">🌱 ${item.cost}</button>`;
        card.innerHTML = `
          <div style="font-size:34px;flex-shrink:0;width:48px;text-align:center">${FRAME_EMOJIS[item.id] || '🖼️'}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:15px;font-weight:800;color:var(--green-deep)">${item.name?.[lang] || item.id}</div>
            ${item.cost === 0 ? `<div style="font-size:12px;color:var(--green-mid);font-weight:700">${cs?'Zdarma':'Free'}</div>` : ''}
          </div>
          ${statusBtn}
        `;
        card.onclick = () => {
          if (isOwned) {
            Feedback.pop();
            Skins.setEquipped(p.id, 'frame', item.id);
            this._renderWardrobeGrid('frames');
          } else if (canAfford) {
            const r = Skins.buyCosmetic(p.id, item.id);
            if (r.ok) {
              Feedback.coin();
              Skins.setEquipped(p.id, 'frame', item.id);
              this._setText('wardSeeds', Skins.getSeeds(p.id));
              this._renderWardrobeGrid('frames');
            }
          } else {
            Feedback.error();
            this._showToast(t.ward_not_enough);
          }
        };
        grid.appendChild(card);
      });
    }
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
      position:fixed; bottom:120px; left:50%; transform:translateX(-50%);
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
    const lang = getLang();
    const owned = Skins.getOwnedCosmetics(p.id);
    const equipped = Skins.getEquippedBg(p.id);
    const seeds = Skins.getSeeds(p.id);
    const cs = lang === 'cs';

    const container = document.getElementById('bgShopGrid');
    if (!container) return;
    container.style.cssText = 'max-width:420px;margin:0 auto;display:flex;flex-direction:column;gap:10px';
    container.innerHTML = `<div style="font-size:12px;color:#888;font-weight:700;margin-bottom:4px">${cs ? 'Pozadí pro tvoji zahradu' : 'Backgrounds for your garden'}</div>`;

    SKIN_CATALOG.backgrounds.forEach(bg => {
      const isOwned = bg.cost === 0 || owned.includes(bg.id);
      const isEquipped = equipped.id === bg.id;
      const canAfford = seeds >= bg.cost;
      const card = document.createElement('div');
      card.style.cssText = `background:white;border-radius:16px;overflow:hidden;border:2px solid ${isEquipped ? 'var(--green-mid)' : 'rgba(0,0,0,0.07)'};display:flex;align-items:center;gap:0;box-shadow:${isEquipped ? '0 4px 12px rgba(74,138,46,0.2)' : '0 2px 8px rgba(0,0,0,0.05)'};cursor:pointer`;
      const bgPreview = bg.file
        ? `url('img/backgrounds/${bg.file}') center/cover`
        : 'linear-gradient(135deg,#87ceeb,#5a9a3a)';
      const statusBtn = isOwned
        ? `<span style="padding:8px 14px;border-radius:50px;background:${isEquipped ? 'var(--green-mid)' : '#f0f0f0'};color:${isEquipped ? 'white' : 'var(--green-mid)'};font-weight:800;font-size:13px;font-family:inherit;flex-shrink:0;white-space:nowrap">${isEquipped ? (cs?'✓ Aktivní':'✓ Active') : (cs?'Nasadit':'Equip')}</span>`
        : `<span style="padding:8px 14px;border-radius:50px;background:${canAfford ? 'var(--green-mid)' : '#ddd'};color:${canAfford ? 'white' : '#aaa'};font-weight:800;font-size:13px;flex-shrink:0;white-space:nowrap">🌱 ${bg.cost}</span>`;
      card.innerHTML = `
        <div style="width:72px;height:58px;flex-shrink:0;background:${bgPreview}"></div>
        <div style="flex:1;min-width:0;padding:0 12px">
          <div style="font-size:15px;font-weight:800;color:var(--green-deep)">${bg.name[lang] || bg.name.cs}</div>
          ${bg.cost === 0 ? `<div style="font-size:12px;color:var(--green-mid);font-weight:700">${cs?'Zdarma':'Free'}</div>` : ''}
        </div>
        <div style="padding:0 14px 0 0;flex-shrink:0">${statusBtn}</div>
      `;
      card.onclick = () => {
        const result = Skins.purchaseBg(p.id, bg.id);
        if (!result.ok) {
          this._showToast(cs ? `Nemáš dost semínek (${seeds} / ${bg.cost})` : `Not enough seeds (${seeds} / ${bg.cost})`);
          return;
        }
        Feedback.tap();
        this._setText('wardSeeds', Skins.getSeeds(p.id));
        this.renderBgShop();
      };
      container.appendChild(card);
    });
  },
};

// ─── Screen lifecycle events ───
document.addEventListener('screen:ready', ({ detail: { screenId } }) => {
  switch (screenId) {
    case 'onboarding':
      App.renderOnboarding();
      Audio.switchScene('menu');
      break;
    case 'profiles':
      App.renderProfiles();
      Audio.switchScene('menu');
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
      Audio.switchScene('menu');
      break;
    }
    case 'badge-earned': {
      const t = tr();
      App._setText('btn-continue-lbl', t.continue);
      Audio.switchScene('menu');
      break;
    }
  }
});

// ─── Start ───
window.MapView = MapView; // expose for router cleanup
(async function startGream() {
  try {
    await App.init();
    // Remove loading fallback once started
    const fallback = document.getElementById('appLoadingFallback');
    if (fallback) fallback.style.display = 'none';
  } catch (err) {
    console.error('[Gream] Init crashed:', err);
    const msg = document.getElementById('appLoadingMsg');
    if (msg) {
      msg.innerHTML = `<div style="color:#c54a3d;font-weight:700">Init error</div><div style="font-size:10px;opacity:0.6;margin-top:4px;max-width:280px;word-break:break-word">${err.message || err}</div><button onclick="location.reload()" style="margin-top:10px;padding:8px 16px;border:none;border-radius:8px;background:#4a8a2e;color:white;font-weight:700;cursor:pointer">Reload</button>`;
    }
  }
})();
