// ═══════════════════════════════════
//  GREAM — garden-life.js  (2D zahrada: greamíci chodí, používají předměty a potkávají se)
//  Pozice v % „světa“ zahrady (šířka = panorama, výška = scéna), takže drží při změně velikosti.
//  y = spodní hrana (kde greamík stojí); čím větší y, tím blíž → větší a vepředu.
//  „Omezit pohyb“ v telefonu → greamíci stojí na místě, žádné akce.
// ═══════════════════════════════════

// Pás trávníku, kde se greamíci procházejí (% výšky scény). 64 % je pod horizontem na všech pozadích.
export const GROUND = { top: 64, bottom: 97 };

// Co greamík u předmětu dělá. p = předmět { x, y (spodní hrana), w (šířka v % světa), d (hloubka podstavy v % výšky) }.
// spot = kde skončí; via = mezizastávka (odkud se k předmětu přichází – např. lavička zepředu, hříbek z boku);
// layer = 'front' / 'behind' se zapne až na posledním úseku (jde si sednout / schovat se, ne skrz)
const side = () => (Math.random() < 0.5 ? -1 : 1);
export const PROP_ACTS = {
  deco_bench:     { act: 'sit',    layer: 'front',  dur: [5, 9], fx: ['💤', '♪'],
                    plan: (p) => { const x = p.x + rand(-0.18, 0.18) * p.w; return { via: { x, y: p.y + 4 }, spot: { x, y: p.y - 1.5 } }; } },
  deco_pond:      { act: 'splash', dur: [3, 5], fx: ['💧', '💦'],
                    plan: (p) => { const s = side(); return { spot: { x: p.x + s * (p.w / 2 + 2.5), y: p.y - p.d * 0.45 } }; } },
  deco_mushroom:  { act: 'hide',   layer: 'behind', dur: [3, 5], fx: ['👀'],
                    plan: (p) => { const s = side(); return { via: { x: p.x + s * (p.w / 2 + 3), y: p.y - 2 }, spot: { x: p.x + s * p.w * 0.1, y: p.y - 2.5 } }; } },
  deco_birdhouse: { act: 'look',   dur: [3, 5], fx: ['🐦', '♪'],
                    plan: (p) => ({ spot: { x: p.x + side() * 4, y: p.y + 3 } }) },
  deco_flowerbed: { act: 'sniff',  dur: [3, 5], fx: ['🌸', '💗'],
                    plan: (p) => ({ spot: { x: p.x + p.w / 2 + 3, y: p.y - p.d * 0.3 } }) },
  deco_lantern:   { act: 'warm',   dur: [3, 5], fx: ['✨'],
                    plan: (p) => ({ spot: { x: p.x + side() * (p.w / 2 + 3), y: p.y + 1 } }) },
  nest:           { act: 'guard',  dur: [4, 7], fx: ['💛', '🥚'],
                    plan: (p) => ({ spot: { x: p.x + p.w / 2 + 3, y: p.y + 1 } }) },
};

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export class GardenLife {
  // world = element světa (position:relative), actors = [{ el, id, active }], props = [{ id, x, y, el }]
  constructor(world, { reduced = false, onFrame = null } = {}) {
    this.world = world; this.reduced = reduced; this.onFrame = onFrame;
    this.actors = []; this.props = []; this._raf = null; this._last = 0;
  }

  // všechny předměty jsou překážky; k prázdnému košíčku se nechodí (hlídá se jen vejce)
  setProps(props) { this.props = props.filter(p => PROP_ACTS[p.id]); this.targets = this.props.filter(p => p.id !== 'nest' || p.egg); }

  // Rozestaví greamíky po trávníku. prev = { id: {x, y, dir} } – po překreslení (klepnutí, výběr) zůstanou, kde byli
  setActors(list, prev = {}) {
    const n = list.length;
    this.actors = list.map((a, i) => {
      const old = prev[a.id];
      let x = old ? old.x : (n === 1 ? 50 : 12 + (76 * i) / (n - 1) + rand(-3, 3));
      let y = old ? old.y : (a.active ? 93 : rand(GROUND.top + 6, GROUND.bottom));
      if (!old) ({ x, y } = this._free({ x, y }));   // uložené pozice nechat přesně (klidně i na lavičce)
      const actor = { ...a, x, y, dir: old?.dir || (Math.random() < 0.5 ? 1 : -1), mode: 'idle', until: performance.now() + rand(400, 2500), route: [], prop: null };
      this._place(actor);
      return actor;
    });
  }
  positions() { return Object.fromEntries(this.actors.map(a => [a.id, { x: a.x, y: a.y, dir: a.dir }])); }

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
    if (a.mode === 'act' && a.prop) { this._leave(a, performance.now()); }
    else { this._endAct(a); a.prop = null; a.route = []; a.mode = 'idle'; a.until = performance.now() + 1500; a.el.classList.remove('walking'); }
    this._jump(a); this._fx(a, pick(['💚', '✨', '❤️']));
  }

  // ─── vnitřek ───
  _tick(a, now, dt) {
    if (a.mode === 'walk') {
      const leg = a.route[0];
      const wW = this.world.clientWidth || 600;
      const speed = 42 / wW * 100;                          // px/s → % světa
      const dx = leg.x - a.x, dy = leg.y - a.y;
      const dist = Math.hypot(dx, dy * 2.2);
      const k = Math.min(1, speed * dt / 1000 / Math.max(0.001, dist));
      a.x += dx * k; a.y += dy * k;
      if (Math.abs(dx) > 0.3) a.dir = dx > 0 ? 1 : -1;
      this._place(a);
      if (dist < 0.4) {
        const done = a.route.shift();
        if (done.clearLayer) { a.front = a.behind = false; a.leaving = null; this._place(a); }
        if (a.route[0]?.layer) { a[a.route[0].layer] = true; this._place(a); }   // poslední úsek: sednout / zalézt za předmět
        if (!a.route.length) this._arrive(a, now);
      }
      return;
    }
    if (now < a.until) return;
    if (a.mode === 'act') { this._leave(a, now); return; }
    this._decide(a, now);
  }

  _decide(a, now) {
    const free = (this.targets || this.props).filter(p => !this.actors.some(o => o !== a && o.prop === p));
    const others = this.actors.filter(o => o !== a && o.mode !== 'act' && !o.meet && !o.prop);   // kdo zrovna jde k předmětu, toho nerušit
    const r = Math.random();
    if (r < 0.42 && free.length) {                                 // jít k předmětu (přes mezizastávku, kolem ostatních věcí)
      const p = pick(free), d = PROP_ACTS[p.id], pl = d.plan(p);
      a.prop = p;
      const legs = [];
      if (pl.via) legs.push(...this._plan(a, this._clampGround(pl.via)), { ...pl.spot, layer: d.layer });   // k mezizastávce kolem všeho, pak krok na místo
      else legs.push(...this._plan(a, pl.spot));
      if (!pl.via && d.layer) legs[legs.length - 1].layer = d.layer;
      this._go(a, legs);
    } else if (r < 0.55 && others.length) {                        // potkat kamaráda
      const o = pick(others), mx = (a.x + o.x) / 2, my = Math.min(GROUND.bottom, Math.max(GROUND.top + 4, (a.y + o.y) / 2));
      a.meet = o; o.meet = a; a.prop = o.prop = null;
      const t1 = this._free({ x: mx - 5, y: my }), t2 = this._free({ x: mx + 5, y: my });
      this._go(a, this._plan(a, t1)); this._go(o, this._plan(o, t2));
    } else if (r < 0.85) {                                         // procházka po trávníku
      const t = this._free({ x: Math.max(5, Math.min(95, a.x + rand(-30, 30))), y: rand(GROUND.top, GROUND.bottom) });
      this._go(a, this._plan(a, t));
    } else {                                                       // chvíli jen tak stát
      a.until = now + rand(1500, 4000);
    }
  }

  // Odejít od předmětu stejnou cestou, kudy přišel (z lavičky dopředu, zpoza hříbku do strany)
  _leave(a, now) {
    const p = a.prop, d = p && PROP_ACTS[p.id];
    const back = a.cameVia;
    this._endAct(a);
    if (back && d?.layer) { a.leaving = p; a.prop = null; a[d.layer] = true; this._place(a); this._go(a, [{ ...back, clearLayer: true }]); return; }
    a.prop = null;
    a.mode = 'idle'; a.until = now + rand(800, 2500);
  }

  _go(a, legs) {
    a.route = legs.map(l => this._clampGround(l, !!l.layer));
    a.cameVia = legs.length > 1 && legs[legs.length - 1].layer ? legs[legs.length - 2] : null;
    a.mode = 'walk'; a.el.classList.add('walking'); a.el.classList.remove('idle');
  }

  _clampGround(t, loose = false) {
    return { ...t, x: Math.max(3, Math.min(97, t.x)), y: loose ? Math.max(GROUND.top - 6, Math.min(99, t.y)) : Math.max(GROUND.top, Math.min(GROUND.bottom, t.y)) };
  }

  // Obdélník, přes který se nechodí: celý předmět (šířka × výška) + polovina šířky greamíka, ať se s ním ani
  // vizuálně nepřekrývá – greamíci chodí jen před předměty nebo kolem nich, ne „skrz“ ani těsně za nimi
  _rect(p, m = 3.5) { return { x0: p.x - p.w / 2 - m, x1: p.x + p.w / 2 + m, y0: p.y - (p.h || p.d) - 1, y1: p.y + 1.5 }; }
  _inRect(pt, r) { return pt.x > r.x0 && pt.x < r.x1 && pt.y > r.y0 && pt.y < r.y1; }
  // Cíl uvnitř předmětu → posunout před něj
  _free(t, ignore = null) {
    for (const p of this.props) { if (p === ignore) continue; const r = this._rect(p); if (this._inRect(t, r)) return this._clampGround({ x: t.x, y: r.y1 + 2 <= GROUND.bottom ? r.y1 + 2 : r.y0 - 2 }); }
    return this._clampGround(t);
  }
  // Cesta z místa greamíka k cíli kolem předmětů: když úsek protne předmět, obejde ho zepředu (u předmětu úplně
  // vpředu zezadu); objížďky se kontrolují stejně (rekurzivně), takže greamík neprojde ani sousední věcí
  _firstHit(from, to) {
    let hit = null, hitT = 2;
    for (const p of this.props) {
      const r = this._rect(p);
      if (this._inRect(from, r) || this._inRect(to, r)) continue;     // stojí u něj / jde přímo k němu (lavička, hříbek)
      for (let k = 1; k < 30; k++) { const t = k / 30;
        if (this._inRect({ x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t }, r)) { if (t < hitT) { hitT = t; hit = r; } break; } }
    }
    return hit;
  }
  _route(from, to, depth = 0) {
    const r = this._firstHit(from, to);
    if (!r || depth > 3) return [to];
    const s = Math.sign(to.x - from.x) || 1;
    const front = r.y1 + 2.5 <= GROUND.bottom, fy = front ? r.y1 + 2.5 : Math.max(GROUND.top, r.y0 - 2);
    const near = this._free({ x: s > 0 ? r.x0 - 1 : r.x1 + 1, y: fy }), far = this._free({ x: s > 0 ? r.x1 + 1 : r.x0 - 1, y: fy });
    return [...this._route(from, near, depth + 1), ...this._route(near, far, depth + 1), ...this._route(far, to, depth + 1)];
  }
  _plan(a, target) { return this._route({ x: a.x, y: a.y }, this._free(target)); }

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
    if (!p) { a.front = a.behind = false; this._place(a); a.mode = 'idle'; a.until = now + rand(1200, 3500); return; }
    const d = PROP_ACTS[p.id];
    a.mode = 'act'; a.until = now + rand(d.dur[0], d.dur[1]) * 1000;
    if (d.act === 'sit') a.dir = Math.random() < 0.5 ? 1 : -1;
    else if (d.act !== 'look') a.dir = p.x > a.x ? 1 : -1;
    a.el.classList.add('act-' + d.act);
    this._place(a);
    if (d.act === 'splash') { this._jump(a); this._fxRepeat(a, d.fx, 3, 650); }
    else if (d.act === 'hide') setTimeout(() => this._fx(a, d.fx[0], true), rand(1200, 2200));
    else this._fxRepeat(a, d.fx, d.act === 'sit' ? 2 : 3, 1100);
  }

  _endAct(a) {
    [...a.el.classList].filter(c => c.startsWith('act-')).forEach(c => a.el.classList.remove(c));
    a.behind = a.front = false; a.meet = null; this._place(a);
  }

  _place(a) {
    const s = a.el.style;
    s.left = a.x + '%'; s.top = a.y + '%';
    // hloubka: dál = menší a vzadu; aktivní greamík o kousek větší
    const depth = 0.78 + (a.y - 70) / 27 * 0.3;
    s.setProperty('--gw-scale', (depth * (a.active ? 1 : 0.86)).toFixed(3));
    s.setProperty('--gw-dir', a.dir);
    const pp = a.prop || a.leaving, pz = pp ? Math.round(pp.y * 10) : 0;
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
