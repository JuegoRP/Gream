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
import { Subscription, FREE_DAILY_INDOOR, PREMIUM_DAILY_INDOOR } from './subscription.js';
import { Ranking } from './ranking.js';

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
let _obAge = '4-6', _obAv = AVATAR_POOL[Math.floor(Math.random() * AVATAR_POOL.length)];

// ═══════════════════════════════════
//  App — global namespace (window.App)
// ═══════════════════════════════════
window.App = {

  async init() {
    console.log('[Gream] Init starting...');
    this._syncLangBtns();
    const profiles = Profiles.all();
    const active   = Profiles.active();
    console.log('[Gream] Profiles:', profiles.length, 'Active:', active?.name || 'none');

    if (active) this.applyTheme(active.age);

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
    Router.prefetch(['challenge', 'step-done', 'badge-earned', 'home', 'map']);
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
      const btn = e.target.closest('.btn-primary, .btn-action, .qa-btn, .age-btn, .av-opt, .lang-btn, .ward-tab');
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

  // ─── Apply age theme to body ───
  applyTheme(age) {
    const map = { '4-6':'age-4-6', '7-9':'age-7-9', '10-15':'age-10-15', '15+':'age-15plus' };
    const cls = map[age] || 'age-7-9';
    document.body.className = document.body.className.replace(/\bage-[\w-]+/g,'').trim();
    document.body.classList.add(cls);
    // Reapply cosmetics so they're not lost when class is rewritten
    this.applyCosmetics();
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
    this._setText('ob-age-lbl', getLang() === 'cs' ? 'Věk' : 'Age');
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
      age: _obAge || '7-9',
      lang: getLang()
    });
    if (_obAv === '__photo__' && window._pendingPhoto) {
      Profiles.savePhoto(p.id, window._pendingPhoto);
      window._pendingPhoto = null;
    }
    // Mark consent timestamp
    try { localStorage.setItem('gream_consent_at', String(Date.now())); } catch {}
    document.getElementById('nameInput').value = '';
    this.applyTheme(_obAge || '7-9');
    // Move to egg reveal step instead of jumping to map
    this._obStep = 6;
    this._renderObStep();
    Feedback.celebrate();
  },

  pickAge(btn, age) {
    _obAge = age;
    document.querySelectorAll('.age-btn').forEach(b => {
      b.style.background = 'white';
      b.style.color = 'var(--green-deep)';
      b.classList.remove('active');
    });
    btn.style.background = 'var(--green-mid)';
    btn.style.color = 'white';
    btn.classList.add('active');
  },

  async obFinish() {
    Feedback.tap();
    await Router.show('home');
  },

  // ─── Legacy stub (kept for backward compatibility) ───
  setObAge(age, btn) {
    _obAge = age;
    document.querySelectorAll('.age-btn').forEach(b => b.classList.remove('active'));
    btn?.classList.add('active');
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
    if (p?.age)  { this.applyTheme(p.age); }
    await Router.show('map');
  },

  // ─── MAP ───
  async renderMap() {
    const p = Profiles.active();
    if (!p) return Router.show('profiles');
    const streakResult = Profiles.checkStreak(p.id);

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
    if (mapAvEl) {
      if (fresh.hasPhoto) {
        const photo = Profiles.getPhoto(fresh.id);
        if (photo) mapAvEl.innerHTML = `<img src="${photo}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
        else mapAvEl.textContent = fresh.avatar || '🧒';
      } else { mapAvEl.textContent = fresh.avatar || '🧒'; }
    }

    // Greeting
    this._setText('mapGreeting', Gream.getGreeting(pet, lang));
    this._setText('mapName', fresh.name);
    this._setText('streakNum', fresh.streak || 0);
    this._setText('seedNum',   Skins.getSeeds(fresh.id));

    // ─── Streak milestone overlay ───
    if (streakResult.isMilestone) {
      setTimeout(() => this._showStreakMilestone(streakResult.streak, lang), 600);
    }

    // ─── Determine display mode: seed-jar OR Gream sprite ───
    // Until first task is completed → show egg jar
    // Stage 1 OR archetype not yet resolved → show mystery egg/jar
    const tasksDone = pet.tasksFor || 0;
    const showJar = pet.stage < 2 || !pet.archetype; // mystery until hatched AND archetype known

    const jarWrap   = document.getElementById('homeJarWrap');
    const sprite    = document.getElementById('greamSprite');
    const shadow    = document.getElementById('greamShadow');
    const needsBar  = document.getElementById('needsBar');

    if (showJar) {
      if (jarWrap) jarWrap.style.display = 'flex';
      if (sprite) sprite.style.display = 'none';
      if (shadow) shadow.style.display = 'none';
      if (needsBar) needsBar.style.display = 'none';

      // Hatching-soon: faster egg wobble + glow when ≥8 tasks done
      if (jarWrap) jarWrap.classList.toggle('hatching-soon', tasksDone >= 8);

      this._setText('greamDisplayName', lang === 'cs' ? '🌱 Záhadné vajíčko' : '🌱 Mystery egg');
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
      if (jarWrap) jarWrap.style.display = 'none';
      if (jarWrap) jarWrap.classList.remove('hatching-soon');
      if (sprite) {
        sprite.style.display = 'block';
        this._applyGreamSprite(sprite, pet);
        sprite.classList.toggle('shiny', !!pet.isShiny);
        sprite.alt = Gream.getDisplayName(pet, lang);
      }
      if (shadow) shadow.style.display = 'block';
      if (needsBar) needsBar.style.display = 'grid';

      // ─── Accessory overlay (emoji above sprite) ───
      const p2 = Profiles.active();
      let accOverlay = document.getElementById('greamAccessoryOverlay');
      const accId = p2 ? Skins.getEquippedAccessory(p2.id) : null;
      const accDef = accId ? (SKIN_CATALOG.accessories.find(a => a.id === accId)) : null;
      if (!accOverlay) {
        accOverlay = document.createElement('div');
        accOverlay.id = 'greamAccessoryOverlay';
        accOverlay.style.cssText = 'position:absolute;top:0;left:50%;transform:translateX(-50%) translateY(-18px);font-size:28px;pointer-events:none;z-index:5;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.2))';
        sprite?.parentElement?.style && (sprite.parentElement.style.position = 'relative');
        sprite?.parentElement?.appendChild(accOverlay);
      }
      accOverlay.textContent = accDef ? accDef.emoji : '';

      this._setText('greamDisplayName', Gream.getDisplayName(pet, lang));
      const stageNames = {
        cs: ['Mládě', 'Mladý', 'Dospívající', 'Dospělý'],
        en: ['Baby', 'Young', 'Teen', 'Adult']
      };
      const stageName = (stageNames[lang] || stageNames.cs)[pet.stage - 2] || '';
      this._setText('greamStageInfo',
        lang === 'cs' ? `${stageName} · ${tasksDone} úkolů` : `${stageName} · ${tasksDone} tasks`);

      this._renderNeedsBar(pet);
    }

    // ─── Dynamic background scene ───
    this._renderGreamScene(pet);

    // ─── Speech bubble greeting ───
    const speech = document.getElementById('greamSpeech');
    if (speech) {
      speech.textContent = Gream.getGreeting(pet, lang);
      speech.classList.add('show');
      setTimeout(() => speech.classList.remove('show'), 4000);
    }

    // ─── Indoor / Outdoor button labels ───
    this._setText('hcIndoorTitle',  lang === 'cs' ? 'Doma klid' : 'Stay home');
    this._setText('hcIndoorSub',    lang === 'cs' ? 'Krátký úkol z domova' : 'A quick task from home');
    this._setText('hcOutdoorTitle', lang === 'cs' ? 'Pojďme ven!' : "Let's go out!");
    this._setText('hcOutdoorSub',   lang === 'cs' ? 'Najdi místa kolem' : 'Find places nearby');

    // Quick action labels
    this._setText('qaMapLbl',   t.map_view_btn);
    this._setText('qaWardLbl',  t.ward_title);
    this._setText('qaHistLbl',  t.history_btn);
    this._setText('qaRankLbl',  lang === 'cs' ? 'Žebříček' : 'Ranking');
    this._setText('qaSetLbl',   lang === 'cs' ? 'Nastavení' : 'Settings');

    this.applyCosmetics();

    // First-run tutorial — show pulsing hint on Doma klid for new users
    if ((pet.tasksFor || 0) === 0) {
      this._showFirstRunHint(lang);
    } else {
      document.getElementById('frHint')?.remove();
    }

    // Trial banner (first 7 days)
    this._renderTrialBanner(p.id, lang);

    // Daily indoor counter pill
    const indoorDone = Subscription.getIndoorToday(p.id);
    const sub        = Subscription.get(p.id);
    const indoorMax  = sub.isPremium ? PREMIUM_DAILY_INDOOR : 2;
    const hcIndoor   = document.querySelector('.home-choice-indoor');
    if (hcIndoor) {
      const pillId = 'indoorPill';
      let pill = document.getElementById(pillId);
      if (!pill) {
        pill = document.createElement('div');
        pill.id = pillId;
        pill.style.cssText = 'position:absolute;top:8px;right:8px;font-size:10px;font-weight:800;padding:2px 8px;border-radius:50px;background:rgba(0,0,0,0.12);color:white';
        hcIndoor.style.position = 'relative';
        hcIndoor.appendChild(pill);
      }
      pill.textContent = `${indoorDone}/${indoorMax}`;
      pill.style.background = indoorDone >= indoorMax ? 'rgba(200,70,50,0.7)' : 'rgba(0,0,0,0.15)';
    }

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
  },

  // ─── Render HP needs row ───
  _renderNeedsBar(pet) {
    const bar = document.getElementById('needsBar');
    if (!bar || !pet) return;
    const lang = getLang();
    bar.innerHTML = '';
    const needIcons = {
      water: '💧', sun: '☀️', food: '🍎',
      love: '💛', color: '🎨', space: '🌌'
    };
    const order = ['water','sun','food','love','color','space'];
    order.forEach(k => {
      const v = pet.hp[k] || 0;
      const div = document.createElement('div');
      div.className = 'need-dot';
      const cls = v < 20 ? 'critical' : v < 40 ? 'low' : '';
      div.innerHTML = `
        <span class="need-dot-icon">${needIcons[k]}</span>
        <div class="need-dot-bar">
          <div class="need-dot-fill ${cls}" style="width:${v}%"></div>
        </div>
      `;
      bar.appendChild(div);
    });
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

    // Scale to fit canvas while preserving aspect ratio
    const scale = Math.min(canvasW / cw, canvasH / ch);
    const dw = Math.round(cw * scale);
    const dh = Math.round(ch * scale);
    const dx = Math.round((canvasW - dw) / 2);
    const dy = Math.round((canvasH - dh) / 2);

    ctx.clearRect(0, 0, canvasW, canvasH);
    ctx.imageSmoothingEnabled = false;
    // Draw the cropped content region centered on the destination canvas
    ctx.drawImage(img,
      sx + minX - PAD, sy + minY - PAD, cw, ch,  // source: content bbox + padding
      dx, dy, dw, dh                               // dest: centered on canvas
    );
  },

  _initSpriteCanvases(root) {
    const canvases = (root || document).querySelectorAll('canvas[data-sprite-sheet]');
    canvases.forEach(canvas => {
      const src  = canvas.dataset.spriteSheet;
      const mood = canvas.dataset.spriteMood || 'happy';
      const [sx, sy] = this._moodToQuad(mood);
      const w = canvas.width  || 52;
      const h = canvas.height || 52;
      const img = new Image();
      img.src = src;
      const draw = () => {
        const ctx = canvas.getContext('2d');
        this._drawSpriteCell(ctx, img, sx, sy, w, h);
      };
      if (img.complete) draw();
      else { img.onload = draw; img.onerror = () => {}; }
    });
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

    let canvas = document.getElementById('greamSpriteCanvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'greamSpriteCanvas';
      canvas.width = SIZE; canvas.height = SIZE;
      canvas.onclick = spriteEl.onclick;
      spriteEl.parentElement.insertBefore(canvas, spriteEl);
      spriteEl.style.display = 'none';
    }
    canvas.classList.toggle('shiny', spriteEl.classList.contains('shiny'));

    const redraw = canvas.dataset.src !== src || canvas.dataset.mood !== mood;
    if (redraw) {
      canvas.dataset.src  = src;
      canvas.dataset.mood = mood;
      const img = new Image();
      img.src = src;
      const draw = () => this._drawSpriteCell(canvas.getContext('2d'), img, sx, sy, SIZE, SIZE);
      img.onerror = () => {
        // Stage 3/4 not uploaded yet — fall back to stage 2
        const fallback = new Image();
        fallback.src = src.replace(/_[34]\.png$/, '_2.png');
        fallback.onload = () => this._drawSpriteCell(canvas.getContext('2d'), fallback, sx, sy, SIZE, SIZE);
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
    const p = Profiles.active();
    if (p?.age === '4-6') Feedback.tap();
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
      const stepNames = t.steps[item.world]?.[item.step]?.label || `Step ${item.step+1}`;
      row.innerHTML = `
        <div style="font-size:30px;width:44px;height:44px;background:var(--green-pale);border-radius:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0">${WORLD_ICONS[item.world]}</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:800;color:var(--green-deep);font-size:14px">${t.worlds[item.world]} · ${stepNames}</div>
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

    const svgH = 240;
    const groundY = 170;

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
  ${stars}${moon}${sun}${sunriseGlow}

  <!-- Horizon mist -->
  <ellipse cx="190" cy="${groundY}" rx="220" ry="24" fill="${scene.mid}" opacity="0.35"/>

  <!-- Ground -->
  <rect x="0" y="${groundY}" width="380" height="${svgH - groundY}" fill="url(#groundG)"/>

  <!-- Flora / scene elements -->
  ${scene.flora}

  <!-- Ground shine -->
  <rect x="0" y="${groundY}" width="380" height="4" fill="rgba(255,255,255,0.12)"/>
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
      // Show confirm overlay
      this._confirmSeedSpend(msg, cost, () => {
        Skins.addSeeds(p.id, -cost);
        this._setText('seedNum', Skins.getSeeds(p.id));
        this._doStartIndoor(p);
      });
      return;
    }

    this._doStartIndoor(p);
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
    await Router.show('map-view');
    this.renderMapView(world);
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
        cell.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:6px;';
        const badgeEl = Badges.renderWorldBadge(w, tasks, 72);
        const worldLbl = document.createElement('div');
        worldLbl.style.cssText = 'font-size:10px;font-weight:800;color:var(--green-mid);text-align:center';
        worldLbl.textContent = t.worlds[w];
        const countLbl = document.createElement('div');
        countLbl.style.cssText = 'font-size:9px;font-weight:700;color:var(--green-mid);text-align:center';
        countLbl.textContent = next ? `${tasks}/${next}` : `${tasks} ★`;
        cell.appendChild(badgeEl);
        cell.appendChild(worldLbl);
        cell.appendChild(countLbl);
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
      this._setText('ss-age-label',     t.ss_age);
      this._setText('ss-name-label',    t.ss_name);
      // age buttons
      const row = document.getElementById('ssAgeRow');
      if (row) {
        row.innerHTML = '';
        ['4-6','7-9','10-15','15+'].forEach(a => {
          const btn = document.createElement('button');
          btn.className = 'abtn' + (p.age === a ? ' active' : '');
          btn.textContent = a;
          btn.onclick = () => {
            Profiles.update(p.id, { age: a });
            this.applyTheme(a);
            this.renderSettings();
          };
          row.appendChild(btn);
        });
      }
      // Theme preview label
      const themeLabels = {
        en: { '4-6':'Jumbo UI, auto voice, big buttons', '7-9':'Playful, colorful, full map', '10-15':'Clean dark UI, fast, no baby stuff', '15+':'Minimal, calm, journal-like' },
        cs: { '4-6':'Velké UI, automatický hlas, mega tlačítka', '7-9':'Hravé, barevné, celá mapa', '10-15':'Čisté tmavé UI, rychlé, bez dětských prvků', '15+':'Minimální, klidné, deníkový styl' }
      };
      const lang2 = getLang();
      const themeDesc = themeLabels[lang2]?.[p.age] || '';
      this._setText('ssThemePreview', themeDesc);
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

    let pos = null;
    if (!pos) {
      // No cache at all — wait briefly (first ever open)
      try {
        pos = await Promise.race([
          Geo.getPosition(),
          new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000))
        ]);
      } catch {}
    } else {
      // Has cache — show map right away, refresh GPS quietly in background
      Geo.getPosition().catch(() => {});
    }
    if (!pos) pos = { lat: 50.0875, lon: 14.4214, fallback: true };

    // World filter pills
    const WORLDS = ['nature','language','logic','feelings','arts','world'];
    const WC = { nature:'#4a8a2e', language:'#5a4a8a', logic:'#2d7abf', feelings:'#d46d94', arts:'#c87030', world:'#a8743c' };
    const pillsEl = document.getElementById('mapWorldPills');
    if (pillsEl) {
      pillsEl.innerHTML = '';
      const allPill = document.createElement('div');
      allPill.id = 'pill-all';
      allPill.style.cssText = 'flex-shrink:0;padding:7px 14px;border-radius:50px;font-size:12px;font-weight:800;cursor:pointer;border:2px solid var(--green-mid);color:var(--green-deep);background:var(--green-pale)';
      allPill.textContent = lang === 'cs' ? 'Vše' : 'All';
      allPill.onclick = () => this._filterMapWorld(null);
      pillsEl.appendChild(allPill);
      WORLDS.forEach(w => {
        const pill = document.createElement('div');
        pill.id = `pill-${w}`;
        pill.style.cssText = 'flex-shrink:0;padding:7px 12px;border-radius:50px;font-size:12px;font-weight:800;cursor:pointer;border:2px solid rgba(0,0,0,0.08);color:#555;background:rgba(0,0,0,0.04)';
        pill.textContent = `${WORLD_EMOJIS[w] || ''} ${t.worlds?.[w] || w}`;
        pill.onclick = () => this._filterMapWorld(w);
        pillsEl.appendChild(pill);
      });
    }

    // Expose archetypes globally for mapview sprite path
    window._greamArchetypes = ARCHETYPES;

    try {
      const activeGream = Profiles.active() ? Gream.active(Profiles.active().id) : null;
      await MapView.open('leafletMap', pos, {
        radius: 1500,
        gream: activeGream,
        onPoiTap: (poi, info = {}) => {
          if (info.tooFar) {
            const lang = getLang();
            this._showToast(lang === 'cs'
              ? `📍 Jsi ${info.dist} m daleko — přibliž se (max 60 m)`
              : `📍 You're ${info.dist} m away — get closer (max 60 m)`);
            return;
          }
          this.openPoiSheet(poi);
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

  openPoiSheet(poi) {
    Feedback.click();
    this._currentPoi      = poi;
    this._currentPoiWorld = null;
    const t    = tr();
    const lang = getLang();
    const sheet = document.getElementById('poiSheet');
    if (!sheet) return;

    const WORLDS = ['nature','language','logic','feelings','arts','world'];
    const WC  = { nature:'#4a8a2e', language:'#5a4a8a', logic:'#2d7abf', feelings:'#d46d94', arts:'#c87030', world:'#a8743c' };
    const KE  = { park:'🌳', nature_reserve:'🌿', playground:'🛝', tree:'🌲', spring:'💧', peak:'⛰️', wood:'🌲', castle:'🏰', monument:'🗿', memorial:'🕊️', ruins:'🏚️', place_of_worship:'⛪', library:'📚', theatre:'🎭', arts_centre:'🎨', planetarium:'🔭', museum:'🏛️', artwork:'🖼️', gallery:'🖼️', viewpoint:'👁️', attraction:'✨', info:'ℹ️', bench:'🪑', social_centre:'🤝', community_centre:'🏘️', garden:'🌸', poi:'📍' };

    const kindEl = document.getElementById('poiKindBadge');
    if (kindEl) kindEl.textContent = `${KE[poi.kind] || '📍'} ${(poi.kind || 'place').replace(/_/g,' ')}`;

    const bonusRow = document.getElementById('poiBonusRow');
    if (bonusRow) {
      bonusRow.innerHTML = '';
      if (poi.bonusWorld) {
        const chip = document.createElement('div');
        chip.style.cssText = `padding:5px 12px;border-radius:50px;background:${WC[poi.bonusWorld]};color:white;font-size:12px;font-weight:800`;
        chip.textContent = `${WORLD_EMOJIS[poi.bonusWorld]} ${lang==='cs'?'+5 semínek za':'+5 seeds for'} ${t.worlds?.[poi.bonusWorld]||poi.bonusWorld}`;
        bonusRow.appendChild(chip);
      } else {
        // Neutral place — no bonus, explain it
        const chip = document.createElement('div');
        chip.style.cssText = 'padding:5px 12px;border-radius:50px;background:rgba(0,0,0,0.06);color:#666;font-size:12px;font-weight:700';
        chip.textContent = lang==='cs' ? '✨ Neutrální místo — všechny světy jsou stejné' : '✨ Neutral place — all worlds equal here';
        bonusRow.appendChild(chip);
      }
    }

    const worldBtns = document.getElementById('poiWorldBtns');
    const startBtn  = document.getElementById('poiStartBtn');
    if (worldBtns) {
      worldBtns.innerHTML = '';
      WORLDS.forEach(w => {
        const done = (poi.worldsDone || []).includes(w);
        const btn = document.createElement('button');
        btn.style.cssText = `padding:10px 6px;border-radius:12px;cursor:pointer;font-family:inherit;border:2px solid rgba(0,0,0,0.08);background:${done?WC[w]:'white'};color:${done?'white':'#333'};font-size:20px;font-weight:800;display:flex;flex-direction:column;align-items:center;gap:3px;transition:all 0.18s`;
        btn.innerHTML = `<span>${WORLD_EMOJIS[w]||'?'}</span>${done?'<span style="font-size:9px">✓</span>':''}`;
        btn.onclick = () => {
          worldBtns.querySelectorAll('button').forEach(b => { b.style.borderColor='rgba(0,0,0,0.08)'; b.style.borderWidth='2px'; });
          btn.style.borderColor = WC[w]; btn.style.borderWidth = '3px';
          this._currentPoiWorld = w;
          if (startBtn) {
            startBtn.style.display = 'block';
            startBtn.style.background = WC[w];
            const bonus = poi.bonusWorld === w;
            startBtn.textContent = bonus
              ? (lang==='cs'?`🌟 Hrát ${t.worlds[w]} (+5 semínek)`:`🌟 Play ${t.worlds[w]} (+5 seeds)`)
              : (lang==='cs'?`▶ Hrát ${t.worlds[w]}`:`▶ Play ${t.worlds[w]}`);
          }
        };
        worldBtns.appendChild(btn);
      });
    }
    if (startBtn) startBtn.style.display = 'none';
    const pickLabel = document.getElementById('poiPickLabel');
    if (pickLabel) pickLabel.textContent = lang==='cs' ? 'Vyber svět pro toto místo:' : 'Pick a world to explore here:';
    sheet.style.transform = 'translateY(0)';
  },

  closePoiSheet() {
    const sheet = document.getElementById('poiSheet');
    if (sheet) sheet.style.transform = 'translateY(100%)';
    this._currentPoi      = null;
    this._currentPoiWorld = null;
  },

  startPoiChallenge() {
    const poi   = this._currentPoi;
    const world = this._currentPoiWorld;
    if (!poi || !world) return;
    Feedback.success();
    this.closePoiSheet();
    Challenge.open(world, { poi: { ...poi, selectedWorld: world } });
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

    this._setText('wardTitle',      lang === 'cs' ? '🛒 Obchod' : '🛒 Shop');
    this._setText('wardSeeds',      Skins.getSeeds(p.id));
    this._setText('wardTabGreams',  lang === 'cs' ? '🥚 Greamíci' : '🥚 Greams');
    this._setText('wardTabBoosts',  lang === 'cs' ? '✨ Boosty' : '✨ Boosts');
    this._setText('wardTabAcc',     lang === 'cs' ? '🎩 Doplňky' : '🎩 Accessories');
    this._setText('wardTabAvatars', t.ward_avatars);
    this._setText('wardTabFrames',  t.ward_frames);

    this.wardSwitchTab(this._wardTab || 'greams');
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
    if (tab === 'greams') {
      this._renderWardrobeGreams();
    } else if (tab === 'boosts') {
      this._renderWardrobeBoosts();
    } else if (tab === 'acc') {
      this._renderWardrobeAccessories();
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
      SKIN_CATALOG.avatars.forEach(skin => {
        const isUnlocked = skin.unlock.type === 'free' || unlocked.has(skin.id);
        const isEquipped = equipped.avatar === skin.id;
        const item = document.createElement('button');
        item.style.cssText = `
          display:flex; flex-direction:column; align-items:center; gap:6px;
          padding:12px 6px 8px; border-radius:14px;
          background:${isEquipped ? 'linear-gradient(135deg,#cbe3a0,#a8cd7c)' : (isUnlocked ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.04)')};
          cursor:${isUnlocked ? 'pointer' : 'default'};
          opacity:${isUnlocked ? '1' : '0.55'};
          font-family:inherit;
          border:2px solid ${isEquipped ? 'var(--green-mid)' : 'transparent'};
          min-height:120px; position:relative;
        `;
        const unlockTxt = !isUnlocked ? `<div style="font-size:9px;color:var(--green-mid);font-weight:700;line-height:1.2;margin-top:auto">${Skins.unlockText(skin, lang)}</div>` : '';
        item.innerHTML = `
          <span style="font-size:32px;line-height:1">${skin.emoji}</span>
          <div style="font-size:10px;font-weight:800;color:var(--green-deep);text-align:center;line-height:1.15;flex-shrink:0">${skin.name?.[lang] || skin.id}</div>
          ${unlockTxt}
          ${isEquipped ? `<span style="position:absolute;top:4px;right:6px;font-size:12px">✓</span>` : ''}
        `;
        if (isUnlocked) {
          item.onclick = () => {
            Feedback.pop();
            Skins.setEquipped(p.id, 'avatar', skin.id);
            Profiles.update(p.id, { avatar: skin.emoji });
            this._renderWardrobeGrid('avatars');
          };
        }
        grid.appendChild(item);
      });
    } else if (tab === 'frames' || tab === 'bg') {
      const items = tab === 'frames' ? SKIN_CATALOG.frames : SKIN_CATALOG.backgrounds;
      const slot  = tab === 'frames' ? 'frame' : 'bg';
      const seeds = Skins.getSeeds(p.id);

      items.forEach(item => {
        const isOwned    = owned.has(item.id);
        const isEquipped = equipped[slot] === item.id;
        const canAfford  = seeds >= item.cost;

        const card = document.createElement('button');
        card.style.cssText = `
          display:flex; flex-direction:column; align-items:center; gap:6px;
          padding:12px 6px 8px; border-radius:14px; border:none;
          background:${isEquipped ? 'linear-gradient(135deg,#cbe3a0,#a8cd7c)' : 'rgba(255,255,255,0.85)'};
          cursor:pointer; font-family:inherit;
          border:2px solid ${isEquipped ? 'var(--green-mid)' : 'transparent'};
          min-height:120px; position:relative;
        `;
        // Visual preview
        const previewEmoji = tab === 'frames'
          ? (item.id === 'fr_none' ? '◯' : item.id === 'fr_leaf' ? '🍃' : item.id === 'fr_gold' ? '⭐' : item.id === 'fr_rainbow' ? '🌈' : '🌌')
          : (item.id === 'bg_default' ? '🌿' : item.id === 'bg_sunset' ? '🌅' : item.id === 'bg_forest' ? '🌲' : item.id === 'bg_ocean' ? '🌊' : '🌃');
        card.innerHTML = `
          <span style="font-size:30px">${previewEmoji}</span>
          <span style="font-size:10px;font-weight:800;color:var(--green-deep);text-align:center;line-height:1.1">${item.name?.[lang] || item.id}</span>
          <span style="font-size:11px;font-weight:800;color:${isOwned ? 'var(--green-mid)' : (canAfford ? 'var(--orange)' : '#999')}">
            ${isOwned ? (isEquipped ? '✓' : t.ward_equip) : `🌱 ${item.cost}`}
          </span>
        `;
        card.onclick = () => {
          if (isOwned) {
            Feedback.pop();
            Skins.setEquipped(p.id, slot, item.id);
            this._renderWardrobeGrid(tab);
          } else if (canAfford) {
            const r = Skins.buyCosmetic(p.id, item.id);
            if (r.ok) {
              Feedback.coin();
              Skins.setEquipped(p.id, slot, item.id);
              this._setText('wardSeeds', Skins.getSeeds(p.id));
              this._renderWardrobeGrid(tab);
            }
          } else {
            Feedback.error();
            const toast = document.createElement('div');
            toast.style.cssText = 'position:fixed;bottom:120px;left:50%;transform:translateX(-50%);background:#1a3d0a;color:white;padding:12px 20px;border-radius:50px;font-weight:700;z-index:999';
            toast.textContent = t.ward_not_enough;
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 2500);
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
  }
};

// ─── Screen lifecycle events ───
document.addEventListener('screen:ready', ({ detail: { screenId } }) => {
  switch (screenId) {
    case 'onboarding':  App.renderOnboarding(); break;
    case 'profiles':    App.renderProfiles();   break;
    case 'map':         App.renderMap();         break;
    case 'home':        App.renderMap();         break;
    case 'badges':      App.renderBadges();      break;
    case 'ranking':     App.renderRanking();     break;
    case 'settings':      App.renderSettings();      break;
    case 'stats':         App.renderStats();         break;
    case 'parent-confirm':App._initParentConfirm(); break;
    case 'map-view':      App.renderMapView(App._mapViewWorld || 'nature'); break;
    case 'wardrobe':      App.renderWardrobe();     break;
    case 'geo-gate':      App.renderGeoGate();      break;
    case 'history':       App.renderHistory();      break;
    case 'challenge': {
      // If user lands here without an active challenge, redirect home
      // (e.g. after step-done / browser back without proper flow)
      const hasChallenge = !!Challenge._currentChallenge;
      if (!hasChallenge) {
        console.warn('[Gream] Challenge screen reached without active challenge — redirecting home');
        Router.show('home');
      }
      break;
    }
    case 'step-done': {
      const lang = getLang();
      const t = tr();
      // Bind buttons for retry / continue (text might miss otherwise)
      App._setText('sdNextBtn',  t.next_step);
      App._setText('sdLaterBtn', t.come_back);
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
