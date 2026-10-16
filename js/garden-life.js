// ═══════════════════════════════════
//  GREAM — garden-life.js  (2D zahrada: greamíci chodí, používají předměty a potkávají se)
//  Pozice v % „světa“ zahrady (šířka = panorama, výška = scéna), takže drží při změně velikosti.
//  y = spodní hrana (kde greamík stojí); čím větší y, tím blíž → větší a vepředu.
//  „Omezit pohyb“ v telefonu → greamíci stojí na místě, žádné akce.
// ═══════════════════════════════════

export const GROUND = { top: 80, bottom: 96 };   // pás trávníku, kde se greamíci procházejí (% výšky)

// Co greamík u předmětu dělá: kde stojí (dx, dy vůči předmětu), jak dlouho (s) a co nad ním vyletí
export const PROP_ACTS = {
  deco_bench:     { act: 'sit',   dx: 0,   dy: -5, front: true,  dur: [5, 9], fx: ['💤', '♪'] },
  deco_pond:      { act: 'splash', dx: -12, dy: -3, dur: [3, 5], fx: ['💧', '💦'] },
  deco_mushroom:  { act: 'hide',  dx: 0,   dy: -3, behind: true, dur: [3, 5], fx: ['👀'] },
  deco_birdhouse: { act: 'look',  dx: 5,   dy: 12, dur: [3, 5], fx: ['🐦', '♪'] },
  deco_flowerbed: { act: 'sniff', dx: 9,   dy: -1, dur: [3, 5], fx: ['🌸', '💗'] },
  deco_lantern:   { act: 'warm',  dx: 6,   dy: 4,  dur: [3, 5], fx: ['✨'] },
  nest:           { act: 'guard', dx: 9,   dy: 6,  dur: [4, 7], fx: ['💛', '🥚'] },
};

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export class GardenLife {
  // world = element světa (position:relative), actors = [{ el, id, active }], props = [{ id, x, y, el }]
  constructor(world, { reduced = false, onFrame = null } = {}) {
    this.world = world; this.reduced = reduced; this.onFrame = onFrame;
    this.actors = []; this.props = []; this._raf = null; this._last = 0;
  }

  setProps(props) { this.props = props.filter(p => PROP_ACTS[p.id]); }

  // Rozestaví greamíky po trávníku (aktivní uprostřed) a vrátí jejich výchozí pozice
  setActors(list) {
    const n = list.length;
    this.actors = list.map((a, i) => {
      const x = n === 1 ? 50 : 12 + (76 * i) / (n - 1) + rand(-3, 3);
      const y = a.active ? 93 : rand(GROUND.top + 1, GROUND.bottom);
      const actor = { ...a, x, y, dir: Math.random() < 0.5 ? 1 : -1, mode: 'idle', until: performance.now() + rand(400, 2500), target: null, prop: null };
      this._place(actor);
      return actor;
    });
  }

  start() {
    if (this.reduced || this._raf) return;
    const step = (now) => {
      if (!this.world.isConnected) { this.stop(); return; }
      const dt = Math.min(100, now - (this._last || now)); this._last = now;
      if (!document.hidden) this.actors.forEach(a => this._tick(a, now, dt));
      this._raf = requestAnimationFrame(step);
    };
    this._raf = requestAnimationFrame(step);
  }
  stop() { if (this._raf) cancelAnimationFrame(this._raf); this._raf = null; this._last = 0; }

  // Klepnutí na greamíka: vyskočí (a přeruší, co dělal)
  poke(id) {
    const a = this.actors.find(x => x.id === id); if (!a) return;
    this._endAct(a);
    a.mode = 'idle'; a.until = performance.now() + 1500;
    this._jump(a); this._fx(a, pick(['💚', '✨', '❤️']));
  }

  // ─── vnitřek ───
  _tick(a, now, dt) {
    if (a.mode === 'walk') {
      const wW = this.world.clientWidth || 600;
      const speed = (a.fast ? 70 : 42) / wW * 100;           // px/s → % světa
      const dx = a.target.x - a.x, dy = a.target.y - a.y;
      const dist = Math.hypot(dx, dy * 2.2);
      const k = Math.min(1, speed * dt / 1000 / Math.max(0.001, dist));
      a.x += dx * k; a.y += dy * k;
      if (Math.abs(dx) > 0.3) a.dir = dx > 0 ? 1 : -1;
      this._place(a);
      if (dist < 0.4) this._arrive(a, now);
      return;
    }
    if (now < a.until) return;
    if (a.mode === 'act') { this._endAct(a); a.mode = 'idle'; a.until = now + rand(800, 2500); return; }
    this._decide(a, now);
  }

  _decide(a, now) {
    const free = this.props.filter(p => !this.actors.some(o => o !== a && o.prop === p));
    const others = this.actors.filter(o => o !== a && o.mode !== 'act' && !o.meet && !o.prop);   // kdo zrovna jde k předmětu, toho nerušit
    const r = Math.random();
    if (r < 0.42 && free.length) {                                 // jít k předmětu
      const p = pick(free), d = PROP_ACTS[p.id];
      a.prop = p; this._walk(a, { x: p.x + d.dx * (d.dx && Math.random() < 0.5 && p.id !== 'deco_pond' ? -1 : 1), y: p.y + d.dy });
    } else if (r < 0.55 && others.length) {                        // potkat kamaráda
      const o = pick(others), mx = (a.x + o.x) / 2, my = Math.min(GROUND.bottom, Math.max(GROUND.top, (a.y + o.y) / 2));
      a.meet = o; o.meet = a; a.prop = o.prop = null;
      this._walk(a, { x: mx - 5, y: my }); this._walk(o, { x: mx + 5, y: my });
    } else if (r < 0.85) {                                         // procházka
      this._walk(a, { x: Math.max(5, Math.min(95, a.x + rand(-30, 30))), y: rand(GROUND.top, GROUND.bottom) });
    } else {                                                       // chvíli jen tak stát
      a.until = now + rand(1500, 4000);
    }
  }

  _walk(a, target) {
    a.mode = 'walk'; a.target = { x: Math.max(3, Math.min(97, target.x)), y: target.y };
    a.el.classList.add('walking'); a.el.classList.remove('idle');
  }

  _arrive(a, now) {
    a.el.classList.remove('walking'); a.el.classList.add('idle');
    if (a.meet) {                                                  // setkání: otočit se k sobě, poskočit
      const o = a.meet;
      if (o.mode !== 'walk') {
        a.dir = o.x > a.x ? 1 : -1; o.dir = -a.dir; this._place(a); this._place(o);
        this._jump(a); setTimeout(() => this._jump(o), 180);
        this._fx(a, pick(['💬', '❤️', '😄'])); this._fx(o, pick(['💬', '✨', '😊']));
        a.meet = o.meet = null;
        a.mode = o.mode = 'act'; a.until = o.until = now + rand(1800, 3000);
      } else { a.mode = 'idle'; a.until = now + 400; }          // počká na kamaráda
      return;
    }
    const p = a.prop;
    if (!p) { a.mode = 'idle'; a.until = now + rand(1200, 3500); return; }
    const d = PROP_ACTS[p.id];
    a.mode = 'act'; a.until = now + rand(d.dur[0], d.dur[1]) * 1000;
    if (d.act !== 'look') a.dir = p.x > a.x ? 1 : -1;
    a.el.classList.add('act-' + d.act);
    a.behind = !!d.behind; a.front = !!d.front; this._place(a);
    if (d.act === 'splash') { this._jump(a); this._fxRepeat(a, d.fx, 3, 650); }
    else if (d.act === 'hide') setTimeout(() => this._fx(a, d.fx[0], true), rand(1200, 2200));
    else this._fxRepeat(a, d.fx, d.act === 'sit' ? 2 : 3, 1100);
  }

  _endAct(a) {
    [...a.el.classList].filter(c => c.startsWith('act-')).forEach(c => a.el.classList.remove(c));
    a.prop = null; a.behind = a.front = false; a.meet = null; this._place(a);
  }

  _place(a) {
    const s = a.el.style;
    s.left = a.x + '%'; s.top = a.y + '%';
    // hloubka: dál = menší a vzadu; aktivní greamík o kousek větší
    const depth = 0.78 + (a.y - 70) / 27 * 0.3;
    s.setProperty('--gw-scale', (depth * (a.active ? 1 : 0.86)).toFixed(3));
    s.setProperty('--gw-dir', a.dir);
    const pz = a.prop ? Math.round(a.prop.y * 10) : 0;
    s.zIndex = a.behind ? pz - 1 : a.front ? pz + 2 : Math.round(a.y * 10) + (a.active ? 2 : 0);
  }

  _jump(a) {
    const b = a.el.querySelector('.gw-hop'); if (!b) return;
    b.classList.remove('gw-jump'); void b.offsetWidth; b.classList.add('gw-jump');
    setTimeout(() => b.classList.remove('gw-jump'), 520);
  }

  _fx(a, emoji, peek = false) {
    const e = document.createElement('span');
    e.className = 'gw-fx' + (peek ? ' peek' : ''); e.textContent = emoji;
    e.style.left = (a.x + rand(-2, 2)) + '%'; e.style.top = a.y + '%';
    e.style.zIndex = 2000;
    this.world.appendChild(e);
    setTimeout(() => e.remove(), 1600);
  }
  _fxRepeat(a, list, n, gap) { for (let i = 0; i < n; i++) setTimeout(() => { if (a.mode === 'act') this._fx(a, list[i % list.length]); }, 300 + i * gap); }
}
