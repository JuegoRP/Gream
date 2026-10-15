// ═══════════════════════════════════
//  GREAM — mapview.js  v4 (MapLibre)
//  - Vlastní styl „Gream“ nad vektorovými dlaždicemi OpenFreeMap (© OpenStreetMap),
//    dlaždice i místa jdou přes náš server → cizí servery hráče nevidí
//  - Hráč = jeho greamík, místa = odznaky v barvě světa, splněná místa = sloučené území
//  - Rozhraní MapView zůstává stejné jako u verze s Leafletem (app.js, challenge.js, router.js)
// ═══════════════════════════════════

import { Geo, WORLD_COLORS, WORLD_EMOJIS, isBattleSpot } from './geo.js';
import { Net } from './net.js';

const TILES_URL = 'https://3rstudio.eu/api/gream/tiles/{z}/{x}/{y}.pbf';
const ATTRIBUTION = '© <a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>';
const ML_JS  = 'vendor/maplibre/maplibre-gl.js';
const ML_CSS = 'vendor/maplibre/maplibre-gl.css';

// Must be within this many metres to interact with a POI
const PROXIMITY_M = 60;
const TERRITORY_COLOR = '#5aa02c';

// ─── Styl mapy „Gream“: papír, měkká zeleň, světlá voda, bílé cesty, žádné popisky ───
const C = { paper: '#f7f3e8', town: '#f0e8d6', grass: '#d4ebb6', park: '#c6e3a2', wood: '#a9d38c', water: '#a9dcf1', waterLine: '#8ccbe6',
  road: '#ffffff', roadCase: '#e3dbc8', path: '#d8c49c', rail: '#d9d2c2', building: '#e6dfcd' };
const GREAM_STYLE = {
  version: 8,
  sources: { omt: { type: 'vector', tiles: [TILES_URL], maxzoom: 14, attribution: ATTRIBUTION } },
  layers: [
    { id: 'paper', type: 'background', paint: { 'background-color': C.paper } },
    { id: 'town', type: 'fill', source: 'omt', 'source-layer': 'landuse', filter: ['in', ['get', 'class'], ['literal', ['residential', 'suburb', 'neighbourhood', 'commercial', 'retail', 'industrial']]], paint: { 'fill-color': C.town } },
    { id: 'grass', type: 'fill', source: 'omt', 'source-layer': 'landcover', filter: ['in', ['get', 'class'], ['literal', ['grass', 'farmland', 'scrub', 'wetland']]], paint: { 'fill-color': C.grass, 'fill-opacity': 0.8 } },
    { id: 'wood', type: 'fill', source: 'omt', 'source-layer': 'landcover', filter: ['==', ['get', 'class'], 'wood'], paint: { 'fill-color': C.wood } },
    // jen skutečné parky – ne chráněná území (celé historické centrum by bylo zelené)
    { id: 'park', type: 'fill', source: 'omt', 'source-layer': 'park', filter: ['==', ['get', 'class'], 'park'], paint: { 'fill-color': C.park } },
    { id: 'pitch', type: 'fill', source: 'omt', 'source-layer': 'landuse', filter: ['in', ['get', 'class'], ['literal', ['pitch', 'playground', 'cemetery', 'garden']]], paint: { 'fill-color': C.park } },
    { id: 'water', type: 'fill', source: 'omt', 'source-layer': 'water', paint: { 'fill-color': C.water } },
    { id: 'waterway', type: 'line', source: 'omt', 'source-layer': 'waterway', paint: { 'line-color': C.waterLine, 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 1, 18, 5] } },
    { id: 'building', type: 'fill', source: 'omt', 'source-layer': 'building', minzoom: 15, paint: { 'fill-color': C.building, 'fill-opacity': 0.7 } },
    { id: 'path', type: 'line', source: 'omt', 'source-layer': 'transportation', filter: ['in', ['get', 'class'], ['literal', ['path', 'track']]], minzoom: 15,
      paint: { 'line-color': C.path, 'line-opacity': 0.6, 'line-width': ['interpolate', ['linear'], ['zoom'], 15, 0.8, 18, 2.5], 'line-dasharray': [2, 2] } },
    // železnice jen nad zemí (tunely metra by kreslily čáry přes celé centrum)
    { id: 'rail', type: 'line', source: 'omt', 'source-layer': 'transportation', filter: ['all', ['in', ['get', 'class'], ['literal', ['rail', 'transit']]], ['!=', ['get', 'brunnel'], 'tunnel']], paint: { 'line-color': C.rail, 'line-width': 2 } },
    { id: 'road-case', type: 'line', source: 'omt', 'source-layer': 'transportation', filter: ['all', ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor', 'service']]], ['!=', ['get', 'brunnel'], 'tunnel']],
      layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': C.roadCase, 'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 12, 1, 15, 4.5, 18, 20] } },
    { id: 'road', type: 'line', source: 'omt', 'source-layer': 'transportation', filter: ['all', ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor', 'service']]], ['!=', ['get', 'brunnel'], 'tunnel']],
      layout: { 'line-cap': 'round', 'line-join': 'round' }, paint: { 'line-color': C.road, 'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 12, 0.5, 15, 3, 18, 16] } },
  ],
};

let _mlReady = null;
let _map = null, _mapHost = null, _userMarker = null, _userPos = null, _userEl = null;
let _poiLayers = [];          // { poi, el, marker }
let _watchId = null, _onPoiTap = null, _activePoi = null, _allPois = [];
let _heading = null, _headingOn = false, _destination = null, _destMarker = null;
let _following = true, _lastFetchCenter = null, _lastOpts = null, _filterWorld = null;

function loadMapLibre() {
  if (_mlReady) return _mlReady;
  _mlReady = new Promise((resolve, reject) => {
    if (window.maplibregl) return resolve(window.maplibregl);
    if (!document.querySelector(`link[href="${ML_CSS}"]`)) {
      const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = ML_CSS; document.head.appendChild(link);
    }
    const s = document.createElement('script'); s.src = ML_JS;
    s.onload = () => resolve(window.maplibregl); s.onerror = () => { _mlReady = null; reject(new Error('maplibre-load-failed')); };
    document.head.appendChild(s);
  });
  return _mlReady;
}

// ─── Haversine distance in metres ───
function distM(a, b) {
  const R = 6371000;
  const dLat = (b.lat - a.lat) * Math.PI / 180, dLon = (b.lon - a.lon) * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

// ─── Hráč: greamík (od stádia 2), jinak semínko ───
function userMarkerEl(gream) {
  const el = document.createElement('div');
  el.className = 'gm-user';
  const COLORS = { nature: '#4a8a2e', language: '#5a4a8a', logic: '#2d7abf', feelings: '#d46d94', arts: '#c87030', world: '#a8743c' };
  if (gream && gream.stage >= 2 && gream.archetype) {
    const stage = Math.min(gream.stage, 4);
    const world = window._greamArchetypes?.[gream.archetype]?.primaryWorld || 'nature';
    const ring = COLORS[world] || '#4a8a2e';
    el.style.setProperty('--ring', ring);
    el.innerHTML = `<div class="gm-heading"></div><div class="gm-pulse"></div>
      <div class="gm-avatar gm-avatar-big"><div style="width:44px;height:44px;background-image:url('img/greamici/${gream.archetype}_${stage}.png');background-size:200% 200%;background-position:100% 100%;background-repeat:no-repeat;image-rendering:pixelated"></div></div>`;
  } else {
    el.style.setProperty('--ring', '#4a8a2e');
    el.innerHTML = `<div class="gm-heading"></div><div class="gm-pulse"></div><div class="gm-avatar">🌱</div>`;
  }
  return el;
}

// ─── Místo: kulatý odznak v barvě světa ───
function poiEl(poi) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'gm-poi';
  el.setAttribute('aria-label', poi.kind || 'místo');
  el.innerHTML = `<span class="gm-poi-icon"></span><span class="gm-poi-badge" hidden></span>`;
  stylePoi(el, poi);
  return el;
}
function stylePoi(el, poi) {
  const done = (poi.worldsDone || []).length > 0;
  const near = _userPos ? distM(_userPos, poi) <= PROXIMITY_M : false;
  const world = done ? poi.worldsDone[poi.worldsDone.length - 1] : poi.bonusWorld;
  el.style.setProperty('--c', WORLD_COLORS[world] || '#4a8a2e');
  el.classList.toggle('done', done);
  el.classList.toggle('near', near && !done);
  el.classList.toggle('dim', !!_filterWorld && poi.bonusWorld !== _filterWorld);
  el.querySelector('.gm-poi-icon').textContent = isBattleSpot(poi) && !done ? '⚔️' : (WORLD_EMOJIS[world] || '•');
}

// ─── Území: sloučené „bubliny“ kolem splněných míst (stabilní tvar podle souřadnic) ───
function blob(poi) {
  const { lat, lon } = poi; const POINTS = 18, BASE_R = 0.00085, JITTER = 0.5;
  let rng = ((lat * 73856 + lon * 49812) * 1000) | 0;
  const rand = () => { rng = (rng * 1664525 + 1013904223) & 0xffffffff; return (rng >>> 0) / 0xffffffff; };
  const cosLat = Math.cos(lat * Math.PI / 180); const ring = [];
  for (let i = 0; i < POINTS; i++) {
    const a = (i / POINTS) * 2 * Math.PI, r = BASE_R * (1 + JITTER * (rand() * 2 - 1));
    ring.push([lon + (r * Math.cos(a)) / cosLat, lat + r * Math.sin(a)]);
  }
  ring.push(ring[0]);
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } };
}
function updateTerritory() {
  const src = _map?.getSource('territory');
  if (!src) return;
  src.setData({ type: 'FeatureCollection', features: _allPois.filter(p => (p.worldsDone || []).length).map(blob) });
}

// ─── Záblesk po splnění úkolu ───
function glowPoi(poi, world, container) {
  if (!_map || !container) return;
  const color = WORLD_COLORS[world] || '#4a8a2e';
  const pt = _map.project([poi.lon, poi.lat]);
  for (let i = 0; i < 4; i++) {
    const ring = document.createElement('div');
    ring.style.cssText = `position:absolute;left:${pt.x}px;top:${pt.y}px;width:0;height:0;border-radius:50%;border:3px solid ${color};transform:translate(-50%,-50%);pointer-events:none;animation:poiGlow 1.4s ease-out ${i * 0.28}s both;z-index:500`;
    container.appendChild(ring);
    setTimeout(() => ring.remove(), 2200 + i * 300);
  }
}

// ─── Kompas + navigace k cíli ───
function bearing(from, to) {
  const φ1 = from.lat * Math.PI / 180, φ2 = to.lat * Math.PI / 180, Δλ = (to.lon - from.lon) * Math.PI / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2), x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}
function _onOrientation(e) {
  let h = null;
  if (typeof e.webkitCompassHeading === 'number') h = e.webkitCompassHeading;
  else if (typeof e.alpha === 'number') h = 360 - e.alpha;
  if (h == null || isNaN(h)) return;
  _heading = (h + 360) % 360; _applyHeading();
}
function _applyHeading() {
  if (_heading == null || !_userEl) return;
  const cone = _userEl.querySelector('.gm-heading');
  if (cone) { cone.style.display = 'block'; cone.style.transform = `rotate(${_heading}deg)`; }
  _updateNav();
}
function _renderNavOverlay() {
  if (!_destination || !MapView._container) return;
  let ov = document.getElementById('navOverlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'navOverlay';
    ov.className = 'gm-nav';
    ov.innerHTML = `<div id="navArrow" class="gm-nav-arrow">⬆️</div>
      <div style="line-height:1.25;min-width:0"><div id="navLabel" class="gm-nav-label"></div><div id="navDist" class="gm-nav-dist"></div><div id="navHint" class="gm-nav-hint">Klepni na šipku pro kompas</div></div>
      <button id="navClose" class="gm-nav-close" aria-label="Zavřít">✕</button>`;
    MapView._container.appendChild(ov);
    ov.querySelector('#navClose').onclick = () => MapView.clearDestination();
    ov.querySelector('#navArrow').onclick = () => MapView.enableHeading();
  }
  ov.querySelector('#navLabel').textContent = _destination.label || 'Cíl';
}
function _updateNav() {
  if (!_destination || !_userPos) return;
  const dist = Math.round(distM(_userPos, _destination));
  const rel = _heading != null ? ((bearing(_userPos, _destination) - _heading + 360) % 360) : bearing(_userPos, _destination);
  const arrow = document.getElementById('navArrow'), dEl = document.getElementById('navDist'), hint = document.getElementById('navHint');
  if (arrow) arrow.style.transform = `rotate(${rel}deg)`;
  if (dEl) dEl.textContent = dist <= PROXIMITY_M ? '📍 Jsi na místě!' : `${dist} m`;
  if (hint) hint.style.display = _heading == null ? 'block' : 'none';
}

function injectStyles() {
  if (document.getElementById('gream-map-styles')) return;
  const s = document.createElement('style');
  s.id = 'gream-map-styles';
  s.textContent = `
    @keyframes poiGlow { 0%{width:0;height:0;opacity:.9} 100%{width:110px;height:110px;opacity:0} }
    @keyframes greamPulse { 0%,100%{transform:scale(1);opacity:.5} 50%{transform:scale(1.7);opacity:.1} }
    @keyframes poiBob { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-4px)} }
    .maplibregl-map{font-family:'Nunito',sans-serif}
    .maplibregl-ctrl-attrib{font-size:9px;opacity:.55;background:rgba(255,255,255,.7)!important}
    .gm-user{position:relative;width:52px;height:52px;pointer-events:none}
    .gm-pulse{position:absolute;inset:-8px;border-radius:50%;background:var(--ring);opacity:.18;animation:greamPulse 2.2s ease-in-out infinite}
    .gm-avatar{position:absolute;inset:8px;border-radius:50%;background:var(--ring);border:3px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;font-size:16px}
    .gm-avatar-big{inset:0;background:#fff;border-color:var(--ring);overflow:hidden}
    .gm-heading{display:none;position:absolute;inset:0;transition:transform .15s ease-out}
    .gm-heading::before{content:'';position:absolute;left:50%;top:-14px;transform:translateX(-50%);border-left:8px solid transparent;border-right:8px solid transparent;border-bottom:12px solid var(--ring)}
    .gm-poi{position:relative;width:30px;height:30px;padding:0;border-radius:50%;border:3px solid #fff;background:var(--c);opacity:.78;box-shadow:0 2px 6px rgba(0,0,0,.22);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:transform .2s,opacity .2s}
    .gm-poi-icon{font-size:14px;line-height:1;filter:saturate(1.1)}
    .gm-poi.done{opacity:1;width:34px;height:34px;box-shadow:0 0 0 3px var(--c),0 3px 8px rgba(0,0,0,.25)}
    .gm-poi.near{opacity:1;width:44px;height:44px;animation:poiBob 1.2s ease-in-out infinite;box-shadow:0 0 0 6px color-mix(in srgb,var(--c) 30%,transparent),0 4px 12px rgba(0,0,0,.3)}
    .gm-poi.near .gm-poi-icon{font-size:20px}
    .gm-poi.dim{opacity:.18}
    .gm-poi-badge{position:absolute;top:-10px;right:-14px;background:#1a3d0a;color:#fff;border-radius:10px;font:800 10px 'Nunito',sans-serif;padding:1px 6px;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,.3)}
    .gm-dest{font-size:28px;filter:drop-shadow(0 2px 3px rgba(0,0,0,.4));pointer-events:none}
    .gm-nav{position:absolute;left:50%;bottom:16px;transform:translateX(-50%);z-index:600;background:rgba(26,61,10,.94);color:#fff;border-radius:16px;padding:12px 16px;display:flex;align-items:center;gap:14px;box-shadow:0 4px 18px rgba(0,0,0,.3);font-family:Nunito,sans-serif;max-width:88%}
    .gm-nav-arrow{font-size:30px;line-height:1;transition:transform .15s ease-out;cursor:pointer}
    .gm-nav-label{font-weight:900;font-size:14px}.gm-nav-dist{font-weight:800;font-size:13px;opacity:.9}.gm-nav-hint{font-size:11px;opacity:.75;display:none}
    .gm-nav-close{background:rgba(255,255,255,.18);border:none;color:#fff;width:32px;height:32px;border-radius:50%;font-size:15px;font-weight:900;cursor:pointer;flex:none}
    @media (prefers-reduced-motion: reduce){.gm-pulse,.gm-poi.near{animation:none}}
  `;
  document.head.appendChild(s);
}

export const MapView = {
  _container: null,

  async open(containerId, center, opts = {}) {
    const ml = await loadMapLibre();
    const placeholder = document.getElementById(containerId);
    if (!placeholder) return;
    this._container = placeholder;
    _onPoiTap = opts.onPoiTap || null;
    _lastOpts = opts;
    if (placeholder.style.position !== 'relative' && placeholder.style.position !== 'absolute') placeholder.style.position = 'relative';
    injectStyles();

    // ── KEEP-ALIVE: znovu použít teplou mapu ──
    if (_map && _mapHost) {
      placeholder.appendChild(_mapHost);
      if (center) _userPos = { lat: center.lat, lon: center.lon };
      _following = true;
      requestAnimationFrame(() => { try { _map.resize(); if (center) _map.jumpTo({ center: [center.lon, center.lat] }); } catch {} });
      this._startWatch();
      if (_destination) { _renderNavOverlay(); _updateNav(); }
      if (_allPois.length) opts.onPoisLoaded?.(_allPois);
      else this._loadPOI(null, center || _userPos, opts);
      return _map;
    }

    _mapHost = document.createElement('div');
    _mapHost.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
    placeholder.appendChild(_mapHost);
    _poiLayers = [];
    _userPos = { lat: center.lat, lon: center.lon };
    _following = true;

    _map = new ml.Map({
      container: _mapHost, style: GREAM_STYLE,
      // pozn.: MapLibre počítá s dlaždicí 512 px → zoom 15 = dřívější Leaflet 16
      center: [center.lon, center.lat], zoom: opts.zoom ? opts.zoom - 1 : 15, minZoom: 10, maxZoom: 18,
      dragRotate: false, pitchWithRotate: false, touchPitch: false,
      attributionControl: { compact: true },
    });
    _map.touchZoomRotate.disableRotation();
    _map.keyboard.disable();
    _map.on('load', () => {
      _map.addSource('territory', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      _map.addLayer({ id: 'territory', type: 'fill', source: 'territory', paint: { 'fill-color': TERRITORY_COLOR, 'fill-opacity': 0.18 } }, 'building');
      updateTerritory();
    });
    _map.on('dragstart', () => { _following = false; });

    _userEl = userMarkerEl(opts.gream || null);
    _userMarker = new ml.Marker({ element: _userEl }).setLngLat([center.lon, center.lat]).addTo(_map);

    _allPois = [];
    this._loadPOI(null, center, opts);
    this._startWatch();
    return _map;
  },

  _startWatch() {
    if (_watchId != null) return;
    _watchId = Geo.watchPosition(pos => {
      if (!_map || !_userMarker) return;
      const next = { lat: pos.lat, lon: pos.lon };
      const moved = _userPos ? distM(_userPos, next) : 999;
      _userPos = next;
      _userMarker.setLngLat([pos.lon, pos.lat]);
      if (moved < 4) { _updateNav(); return; }
      if (_following) _map.easeTo({ center: [pos.lon, pos.lat], duration: 400 });
      this._refreshDotStyles();
      _updateNav();
      const fetchR = (_lastOpts && _lastOpts.radius) || 2000;
      if (_lastFetchCenter && distM(_lastFetchCenter, next) > fetchR * 0.4) {
        _lastFetchCenter = next;
        this._loadPOI(null, next, _lastOpts || {});
      }
    }, () => {});
  },

  async enableHeading() {
    if (_headingOn) return true;
    try {
      const D = window.DeviceOrientationEvent;
      if (D && typeof D.requestPermission === 'function') { if (await D.requestPermission() !== 'granted') return false; }
      window.addEventListener('deviceorientationabsolute', _onOrientation, true);
      window.addEventListener('deviceorientation', _onOrientation, true);
      _headingOn = true;
      return true;
    } catch { return false; }
  },

  async setDestination(lat, lon, label) {
    _destination = { lat, lon, label: label || '' };
    this.enableHeading();
    if (_map && window.maplibregl) {
      _destMarker?.remove();
      const el = document.createElement('div'); el.className = 'gm-dest'; el.textContent = '📍';
      _destMarker = new window.maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([lon, lat]).addTo(_map);
    }
    _renderNavOverlay();
    _updateNav();
  },

  clearDestination() {
    _destination = null;
    _destMarker?.remove(); _destMarker = null;
    document.getElementById('navOverlay')?.remove();
  },

  async _loadPOI(_unused, center, opts) {
    try {
      const pois = await Geo.fetchAllPOI(center, opts.radius || 1500);
      _allPois = pois;
      if (!_map) return;
      _lastFetchCenter = center;
      _poiLayers.forEach(l => l.marker.remove());
      _poiLayers = [];
      pois.forEach(poi => {
        const el = poiEl(poi);
        el.addEventListener('click', (ev) => { ev.stopPropagation(); this._tapPoi(poi); });
        const marker = new window.maplibregl.Marker({ element: el }).setLngLat([poi.lon, poi.lat]).addTo(_map);
        _poiLayers.push({ poi, el, marker });
      });
      updateTerritory();
      opts.onPoisLoaded?.(pois);
      // Kolik lidí (anonymně) místo splnilo
      Net.poiCounts(pois.map(p => p.id)).then(counts => {
        if (!counts || !_map) return;
        _poiLayers.forEach(({ poi, el }) => {
          const n = counts[poi.id] || 0;
          const b = el.querySelector('.gm-poi-badge');
          if (n > 0) { b.textContent = `👥 ${n}`; b.hidden = false; }
        });
      }).catch(() => {});
    } catch (e) {
      opts.onError?.(e);
    }
  },

  _tapPoi(poi) {
    if (_userPos) {
      const d = Math.round(distM(_userPos, poi));
      if (d > PROXIMITY_M) { _onPoiTap?.(poi, { tooFar: true, dist: d }); return; }
    }
    _activePoi = poi;
    _onPoiTap?.(poi, { tooFar: false });
  },

  _refreshDotStyles() { _poiLayers.forEach(({ poi, el }) => stylePoi(el, poi)); },

  // Zpětná kompatibilita (dřívější podpis s Leafletem)
  _onTap(poi, _dot, _L, info = {}) {
    if (info.tooFar) { _onPoiTap?.(poi, { tooFar: true, dist: info.dist }); return; }
    _activePoi = poi; _onPoiTap?.(poi, { tooFar: false });
  },

  celebratePOI(poiId, world) {
    Geo.markPOIDone(poiId, world);
    const layer = _poiLayers.find(l => l.poi.id === poiId);
    if (!layer || !_map) return;
    layer.poi.worldsDone = Geo.getPOIWorldsDone(poiId);
    stylePoi(layer.el, layer.poi);
    updateTerritory();
    glowPoi(layer.poi, world, this._container);
  },

  recenter(pos) {
    if (_map && pos) { _following = true; _map.easeTo({ center: [pos.lon, pos.lat], duration: 500 }); }
  },

  destroy() {
    if (_watchId != null) { Geo.clearWatch(_watchId); _watchId = null; }
    document.getElementById('navOverlay')?.remove();
    if (_mapHost) {
      let holder = document.getElementById('gream-map-holder');
      if (!holder) {
        holder = document.createElement('div');
        holder.id = 'gream-map-holder';
        holder.style.cssText = 'position:absolute;left:-9999px;top:-9999px;width:0;height:0;overflow:hidden';
        document.body.appendChild(holder);
      }
      holder.appendChild(_mapHost);
    }
  },

  hardDestroy() {
    if (_watchId != null) { Geo.clearWatch(_watchId); _watchId = null; }
    if (_headingOn) {
      window.removeEventListener('deviceorientationabsolute', _onOrientation, true);
      window.removeEventListener('deviceorientation', _onOrientation, true);
      _headingOn = false;
    }
    _heading = null; _destination = null; _destMarker = null;
    document.getElementById('navOverlay')?.remove();
    if (_map) { _map.remove(); _map = null; }
    _mapHost = null; _lastFetchCenter = null;
    document.getElementById('gream-map-holder')?.remove();
    _poiLayers = []; _userMarker = null; _userEl = null; _activePoi = null; _allPois = []; _userPos = null;
  },

  getActivePOI() { return _activePoi; },
  getAllPOI() { return _allPois; },

  filterByWorld(world) {
    _filterWorld = world || null;
    this._refreshDotStyles();
  },
};
