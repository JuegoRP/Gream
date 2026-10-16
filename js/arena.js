// ═══════════════════════════════════
//  GREAM — arena.js  (aréna soubojů 1.1: vykreslení greamíků, životy, energie, animace)
//  Jen zobrazení a efekty – pravidla jsou v battle-rules.js, průběh řídí battle.js.
//  Animace: <canvas> s částicemi podle druhu greamíka, žádné knihovny.
//  „Omezit pohyb“ v telefonu → bez částic, jen čísla a krátké záblesky.
// ═══════════════════════════════════

import { RULES } from './battle-rules.js';
import { shinySource } from './shiny.js';

const REDUCED = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Barvy a tvary útoků podle druhu (sladěné s paletou světů)
export const ARCH_STYLE = {
  lilek:  { color: '#5fae3a', light: '#b6e388', glyphs: null,                 shape: 'leaf'   },
  jiskra: { color: '#38d6e8', light: '#b9f3fa', glyphs: 'AÁBCČDEĚFGHIJKLMNOPRŘSŠTUVZŽ', shape: 'letter' },
  kamen:  { color: '#5c7fa8', light: '#9fd3ff', glyphs: '0123456789+=×',        shape: 'cube'   },
  srodik:  { color: '#f07aa8', light: '#ffd1e4', glyphs: null,                 shape: 'heart'  },
  vlnka:  { color: '#f2a93b', light: '#ffe08a', glyphs: null,                 shape: 'paint'  },
  atlas:  { color: '#3f8a5a', light: '#f3d27a', glyphs: null,                 shape: 'star'   },
  tlapka:  { color: '#a8743c', light: '#f1d3a0', glyphs: null,                shape: 'leaf'   },
  kanka:   { color: '#5b4fd6', light: '#c9c3ff', glyphs: 'AÁBCČDEĚŘŠŽ.,!?',    shape: 'letter' },
  poctik:  { color: '#2bb3a8', light: '#c2f2ec', glyphs: '0123456789+−×÷',     shape: 'cube'   },
  hrejik:  { color: '#f28c28', light: '#ffe08a', glyphs: null,                shape: 'heart'  },
  noticka: { color: '#e0503a', light: '#ffb199', glyphs: '♪♫♩♬',              shape: 'letter' },
  mapka:   { color: '#2f9e8f', light: '#f0d48a', glyphs: null,                shape: 'star'   },
  hvezdik: { color: '#3b4fb8', light: '#ffe68a', glyphs: null,                shape: 'star'   },
  mnamka:  { color: '#d9862e', light: '#ffd9a0', glyphs: null,                shape: 'heart'  },
  bajka:   { color: '#5aa06e', light: '#f3e7c4', glyphs: 'ABCDEFGH✦',          shape: 'letter' },
  ahojik:  { color: '#1fb3b3', light: '#fff0a0', glyphs: 'αβγЖЯあ字ñ',          shape: 'letter' },
  banka:   { color: '#59c26b', light: '#d6f7c8', glyphs: null,                shape: 'paint'  },
  hadak:   { color: '#7b4fc4', light: '#e0d0ff', glyphs: '?!',                shape: 'letter' },
  mozik:   { color: '#d48ac4', light: '#f9dff2', glyphs: null,                shape: 'heart'  },
  zdravik: { color: '#3fbf8f', light: '#ffffff', glyphs: '+',                 shape: 'letter' },
  klapka:  { color: '#333333', light: '#f5f5f5', glyphs: '★',                 shape: 'letter' },
  maska:   { color: '#8b5bc4', light: '#d0302a', glyphs: null,                shape: 'paint'  },
  micek:   { color: '#e8762b', light: '#ffffff', glyphs: null,                shape: 'paint'  },
  lvicek:  { color: '#c9d0dc', light: '#d0302a', glyphs: null,                shape: 'star'   },
};
const PAINT = ['#ff5a5f', '#ffb400', '#3ec1d3', '#7b61ff', '#4cd964', '#ff7ac6'];

// ─── Kreslení greamíka (sprite sheet 256×256, obsah v pravém sloupci) ───
const _imgCache = {};
function loadImg(src) {
  if (typeof Image === 'undefined') return Promise.resolve(null);   // testy bez prohlížeče
  if (_imgCache[src]) return _imgCache[src];
  const p = new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
  _imgCache[src] = p; return p;
}
export function spriteSrc(arch, stage) {
  return `img/greamici/${arch}_${Math.max(2, Math.min(4, stage || 2))}.png`;
}
// mood: 'happy' (spodní buňka) | 'sad' (horní buňka)
export async function drawFighter(canvas, arch, stage, { mood = 'happy', flip = false, shiny = false } = {}) {
  let img = await loadImg(spriteSrc(arch, stage));
  if (!img || !canvas?.getContext) return;
  if (shiny) img = shinySource(img, arch);
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const css = canvas.clientWidth || 120;
  canvas.width = canvas.height = Math.round(css * dpr);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const sy = mood === 'sad' ? 0 : 128;
  // ořez na obsah buňky (stejná velikost všech druhů)
  const off = document.createElement('canvas'); off.width = off.height = 128;
  const o = off.getContext('2d'); o.drawImage(img, 128, sy, 128, 128, 0, 0, 128, 128);
  const d = o.getImageData(0, 0, 128, 128).data;
  let x0 = 128, y0 = 128, x1 = 0, y1 = 0;
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) if (d[(y * 128 + x) * 4 + 3] > 15) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < x0) return;
  const w = x1 - x0 + 1, h = y1 - y0 + 1, W = canvas.width;
  const s = Math.min(W * 0.92 / w, W * 0.92 / h);
  const dw = Math.round(w * s), dh = Math.round(h * s);
  ctx.save();
  if (flip) { ctx.translate(W, 0); ctx.scale(-1, 1); }
  ctx.drawImage(off, x0, y0, w, h, Math.round((W - dw) / 2), W - dh, dw, dh);
  ctx.restore();
  canvas.classList.toggle('shiny', !!shiny);
}

// ─── Aréna ───
export class Arena {
  constructor(root, { me, op, labels }) {
    this.root = root; this.me = me; this.op = op; this.L = labels;
    const night = (() => { const h = new Date().getHours(); return h >= 20 || h < 6; })();
    root.innerHTML = `
      <div class="ar-stage${night ? ' ar-night' : ''}">
        <div class="ar-side ar-op">
          <div class="ar-card">
            <div class="ar-name">${esc(op.name)}</div>
            <div class="ar-hp"><i style="width:100%"></i><b>${RULES.HP}</b></div>
            <div class="ar-en" aria-label="${labels.energy}"></div>
          </div>
          <div class="ar-mon"><canvas class="ar-sprite"></canvas><div class="ar-status"></div></div>
        </div>
        <div class="ar-side ar-me">
          <div class="ar-mon"><canvas class="ar-sprite"></canvas><div class="ar-status"></div></div>
          <div class="ar-card">
            <div class="ar-name">${esc(me.name)}</div>
            <div class="ar-hp"><i style="width:100%"></i><b>${RULES.HP}</b></div>
            <div class="ar-en" aria-label="${labels.energy}"></div>
          </div>
        </div>
        <canvas class="ar-fx"></canvas>
        <div class="ar-banner" aria-live="polite"></div>
      </div>`;
    this.el = {
      stage: root.querySelector('.ar-stage'),
      fx: root.querySelector('.ar-fx'),
      banner: root.querySelector('.ar-banner'),
      side: [root.querySelector('.ar-me'), root.querySelector('.ar-op')],
    };
    this.parts = []; this._raf = null;
    this.sprite = this.el.side.map(s => s.querySelector('.ar-sprite'));
    drawFighter(this.sprite[0], me.arch, me.stage, { shiny: me.shiny });
    drawFighter(this.sprite[1], op.arch, op.stage, { flip: true, shiny: op.shiny });
    this._resizeFx();
    this._onResize = () => this._resizeFx();
    window.addEventListener('resize', this._onResize);
  }

  destroy() { cancelAnimationFrame(this._raf); window.removeEventListener('resize', this._onResize); }

  _resizeFx() {
    const r = this.el.stage.getBoundingClientRect(); const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.el.fx.width = Math.round(r.width * dpr); this.el.fx.height = Math.round(r.height * dpr); this._dpr = dpr;
  }

  // Stav: f = [hráč, soupeř] z battle-rules
  update(f) {
    f.forEach((x, i) => {
      const side = this.el.side[i];
      const hp = Math.max(0, Math.round(x.hp));
      const bar = side.querySelector('.ar-hp i');
      bar.style.width = (hp / RULES.HP * 100) + '%';
      bar.classList.toggle('low', hp <= 30);
      side.querySelector('.ar-hp b').textContent = hp;
      const en = Math.min(RULES.ENERGY_COST, Math.floor(x.energy));
      side.querySelector('.ar-en').innerHTML = Array.from({ length: RULES.ENERGY_COST }, (_, k) => `<span class="${k < en ? 'on' : ''}"></span>`).join('');
      side.classList.toggle('ar-ready', x.energy >= RULES.ENERGY_COST);
      const st = side.querySelector('.ar-status');
      st.innerHTML = (x.wall > 0 ? '<span class="st-wall"></span>' : '') + (x.mult > 1 ? '<span class="st-boost"></span>' : '') + (x.stun < 1 ? '<span class="st-stun"></span>' : '');
    });
  }

  _center(i) {
    const s = this.sprite[i].getBoundingClientRect(), r = this.el.stage.getBoundingClientRect();
    return { x: (s.left - r.left + s.width / 2) * this._dpr, y: (s.top - r.top + s.height * 0.55) * this._dpr };
  }

  banner(text, cls = '') {
    const b = this.el.banner; b.className = 'ar-banner show ' + cls; b.textContent = text;
    clearTimeout(this._bt); this._bt = setTimeout(() => { b.className = 'ar-banner'; }, 1100);
  }

  floatText(i, text, cls) {
    const t = document.createElement('div'); t.className = 'ar-float ' + (cls || ''); t.textContent = text;
    this.el.side[i].querySelector('.ar-mon').appendChild(t); setTimeout(() => t.remove(), 1200);
  }

  _hitFx(i, hit) {
    const mon = this.el.side[i].querySelector('.ar-mon');
    mon.classList.remove('hit'); void mon.offsetWidth; mon.classList.add('hit');
    this.floatText(i, `−${hit.dmg}`, hit.crit ? 'crit' : '');
    if (hit.blocked) this.floatText(i, '🛡', 'shield');
  }

  // Útok: částice letí od útočníka k soupeři, pak zásah. Vrací Promise.
  attack(hit) {
    const from = hit.from, to = 1 - from;
    const arch = from === 0 ? this.me.arch : this.op.arch;
    const mon = this.el.side[from].querySelector('.ar-mon');
    mon.classList.remove('lunge'); void mon.offsetWidth; mon.classList.add('lunge');
    if (hit.domain) this.banner(this.L.superEffective, 'dom');
    else if (hit.half && this.L.effective) this.banner(this.L.effective, 'dom');
    else if (hit.crit) this.banner(this.L.crit, 'crit');
    if (REDUCED()) { this._hitFx(to, hit); return wait(450); }
    const a = this._center(from), b = this._center(to);
    const n = hit.boosted ? 22 : 12;
    return new Promise(res => {
      let landed = 0;
      for (let k = 0; k < n; k++) {
        this.parts.push(projectile(arch, a, b, k * 28, this._dpr, () => { if (++landed === 1) this._hitFx(to, hit); if (landed === n) res(); }));
      }
      this._loop();
    }).then(() => wait(120));
  }

  // Speciál: záblesk v barvě druhu + výbuch částic kolem greamíka
  special(i, ev, title) {
    const arch = i === 0 ? this.me.arch : this.op.arch;
    const st = ARCH_STYLE[arch];
    this.el.stage.style.setProperty('--sp', st.color);
    this.el.stage.classList.remove('ar-special'); void this.el.stage.offsetWidth; this.el.stage.classList.add('ar-special');
    this.banner(title, 'sp');
    if (ev.heal) this.floatText(i, `+${Math.round(ev.heal)}`, 'heal');
    if (ev.dmg) this.floatText(1 - i, `−${Math.round(ev.dmg)}`, '');
    if (!REDUCED()) {
      const c = this._center(i);
      for (let k = 0; k < 34; k++) this.parts.push(burst(arch, c, this._dpr));
      if (ev.dmg) { const c2 = this._center(1 - i); for (let k = 0; k < 14; k++) this.parts.push(projectile(arch, c, c2, 200 + k * 20, this._dpr, () => {})); }
      this._loop();
    }
    return wait(900);
  }

  // Konec: poražený padá, vítěz poskočí, konfety v barvě vítěze
  finish(winnerIdx) {
    const lose = this.el.side[1 - winnerIdx].querySelector('.ar-mon');
    const win = this.el.side[winnerIdx].querySelector('.ar-mon');
    lose.classList.add('ko'); win.classList.add('victory');
    const loserArch = winnerIdx === 0 ? this.op : this.me;
    drawFighter(this.sprite[1 - winnerIdx], loserArch.arch, loserArch.stage, { mood: 'sad', flip: winnerIdx === 0, shiny: loserArch.shiny });
    if (!REDUCED()) {
      const arch = winnerIdx === 0 ? this.me.arch : this.op.arch;
      const W = this.el.fx.width;
      for (let k = 0; k < 60; k++) this.parts.push(confetti(arch, W, this._dpr));
      this._loop();
    }
    return wait(1300);
  }

  _loop() {
    if (this._raf) return;
    const ctx = this.el.fx.getContext('2d');
    let last = performance.now();
    const step = (now = performance.now()) => {
      const dt = Math.min(50, Math.max(0, now - last)); last = now;
      ctx.clearRect(0, 0, this.el.fx.width, this.el.fx.height);
      this.parts = this.parts.filter(p => p.step(dt, ctx));
      this._raf = this.parts.length ? requestAnimationFrame(step) : null;
      if (!this._raf) ctx.clearRect(0, 0, this.el.fx.width, this.el.fx.height);
    };
    this._raf = requestAnimationFrame(step);
  }
}

// ─── Částice ───
function drawShape(ctx, arch, size, color, glyph) {
  const st = ARCH_STYLE[arch];
  ctx.fillStyle = color; ctx.strokeStyle = 'rgba(20,30,20,0.55)'; ctx.lineWidth = Math.max(1, size * 0.12);
  switch (st.shape) {
    case 'leaf':
      ctx.beginPath(); ctx.ellipse(0, 0, size, size * 0.45, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-size, 0); ctx.lineTo(size, 0); ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.stroke(); break;
    case 'letter':
      ctx.font = `900 ${Math.round(size * 2)}px Nunito, system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowColor = st.color; ctx.shadowBlur = size; ctx.fillText(glyph, 0, 0); ctx.shadowBlur = 0; break;
    case 'cube':
      ctx.fillRect(-size, -size, size * 2, size * 2); ctx.strokeRect(-size, -size, size * 2, size * 2);
      ctx.fillStyle = '#e8f6ff'; ctx.font = `900 ${Math.round(size * 1.4)}px Nunito, system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(glyph, 0, 1); break;
    case 'heart':
      ctx.beginPath(); const s = size;
      ctx.moveTo(0, s * 0.9); ctx.bezierCurveTo(-s * 1.6, -s * 0.2, -s * 0.6, -s * 1.3, 0, -s * 0.35);
      ctx.bezierCurveTo(s * 0.6, -s * 1.3, s * 1.6, -s * 0.2, 0, s * 0.9); ctx.fill(); ctx.stroke(); break;
    case 'paint':
      ctx.beginPath(); ctx.arc(0, 0, size, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.arc(-size * 0.35, -size * 0.35, size * 0.3, 0, Math.PI * 2); ctx.fill(); break;
    case 'star':
      ctx.beginPath();
      for (let k = 0; k < 8; k++) { const r = k % 2 ? size * 0.42 : size * 1.1, a = k * Math.PI / 4 - Math.PI / 2; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      ctx.closePath(); ctx.fill(); ctx.stroke(); break;
  }
}
function pickColor(arch) {
  const st = ARCH_STYLE[arch];
  if (st.shape === 'paint') return PAINT[Math.floor(Math.random() * PAINT.length)];
  if (st.shape === 'star') return Math.random() < 0.5 ? st.light : st.color;
  return Math.random() < 0.7 ? st.color : st.light;
}
const pickGlyph = (arch) => { const g = ARCH_STYLE[arch].glyphs; return g ? g[Math.floor(Math.random() * g.length)] : ''; };

function projectile(arch, a, b, delay, dpr, onLand) {
  const dur = 520 + Math.random() * 160, size = (5 + Math.random() * 4) * dpr;
  const curve = (Math.random() - 0.5) * 140 * dpr, wob = Math.random() * 6;
  const color = pickColor(arch), glyph = pickGlyph(arch);
  let t = -delay, landed = false;
  return {
    step(dt, ctx) {
      t += dt; if (t < 0) return true;
      const k = Math.min(1, t / dur), e = k * k * (3 - 2 * k);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 - 60 * dpr + curve;
      const x = (1 - e) * (1 - e) * a.x + 2 * (1 - e) * e * mx + e * e * b.x;
      const y = (1 - e) * (1 - e) * a.y + 2 * (1 - e) * e * my + e * e * b.y;
      ctx.save(); ctx.translate(x, y); ctx.rotate(wob + t / 120); ctx.globalAlpha = k > 0.92 ? (1 - k) / 0.08 : 1;
      drawShape(ctx, arch, size, color, glyph); ctx.restore();
      if (k >= 1 && !landed) { landed = true; onLand(); }
      return k < 1;
    },
  };
}
function burst(arch, c, dpr) {
  const ang = Math.random() * Math.PI * 2, sp = (0.08 + Math.random() * 0.18) * dpr, size = (4 + Math.random() * 5) * dpr;
  const color = pickColor(arch), glyph = pickGlyph(arch); let t = 0; const life = 700 + Math.random() * 300;
  return { step(dt, ctx) {
    t += dt; const k = t / life; if (k >= 1) return false;
    ctx.save(); ctx.translate(c.x + Math.cos(ang) * sp * t, c.y + Math.sin(ang) * sp * t - 0.04 * t * dpr);
    ctx.rotate(t / 150); ctx.globalAlpha = 1 - k; drawShape(ctx, arch, size, color, glyph); ctx.restore(); return true;
  } };
}
function confetti(arch, W, dpr) {
  let x = Math.random() * W, y = -20 * dpr, vy = (0.12 + Math.random() * 0.16) * dpr, vx = (Math.random() - 0.5) * 0.08 * dpr;
  const size = (3 + Math.random() * 4) * dpr, color = pickColor(arch), glyph = pickGlyph(arch); let t = 0;
  return { step(dt, ctx) {
    t += dt; x += vx * dt; y += vy * dt; if (t > 1600) return false;
    ctx.save(); ctx.translate(x, y); ctx.rotate(t / 200); ctx.globalAlpha = Math.min(1, (1600 - t) / 300);
    drawShape(ctx, arch, size, color, glyph); ctx.restore(); return true;
  } };
}

const wait = (ms) => new Promise(r => setTimeout(r, ms));
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
