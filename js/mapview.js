// ═══════════════════════════════════
//  GREAM — mapview.js  v3
//  - Fixed user marker (single 256x256 sprite, no sheet slicing)
//  - Organic colored blob area around visited POIs
//  - Proximity check: POI only tappable within PROXIMITY_M metres
//  - Dots highlight green when user is close
// ═══════════════════════════════════

import { Geo, WORLD_COLORS, WORLD_EMOJIS, WORLD_BONUS, isBattleSpot } from './geo.js';
import { Net } from './net.js';

// Voyager: colourful, kid-friendly basemap (green parks, blue water, street labels)
const TILE_URL    = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
const TILE_ATTR   = '© OpenStreetMap contributors © CARTO';
const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS  = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

// Must be within this many metres to interact with a POI
const PROXIMITY_M = 60;

let _leafletReady = null;
let _map          = null;
let _userMarker   = null;
let _userPos      = null;
let _poiLayers    = [];
let _watchId      = null;
let _onPoiTap     = null;
let _activePoi    = null;
let _allPois      = [];
let _heading      = null;    // device compass heading (deg from north, clockwise)
let _headingOn    = false;   // orientation listener active
let _destination  = null;    // { lat, lon, label } — navigation target
let _destMarker   = null;
let _mapHost      = null;    // persistent Leaflet container — survives screen changes (keep-alive)
let _following    = true;    // auto-pan to follow the user until they drag
let _lastFetchCenter = null; // centre of the last POI fetch (for refetch-on-move)
let _lastOpts     = null;    // remembered open() opts (radius, callbacks, gream)

function loadLeaflet() {
  if (_leafletReady) return _leafletReady;
  _leafletReady = new Promise((resolve, reject) => {
    if (window.L) { resolve(window.L); return; }
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet'; link.href = LEAFLET_CSS;
      document.head.appendChild(link);
    }
    const script = document.createElement('script');
    script.src = LEAFLET_JS;
    script.onload  = () => resolve(window.L);
    script.onerror = () => reject(new Error('leaflet-load-failed'));
    document.head.appendChild(script);
  });
  return _leafletReady;
}

loadLeaflet().catch(() => {});

// ─── Haversine distance in metres ───
function distM(a, b) {
  const R = 6371000;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLon = (b.lon - a.lon) * Math.PI / 180;
  const x = Math.sin(dLat/2)**2 +
    Math.cos(a.lat * Math.PI/180) * Math.cos(b.lat * Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
}

// ─── User position marker ───
function makeUserMarker(L, gream) {
  const COLORS = { nature:'#4a8a2e', language:'#5a4a8a', logic:'#2d7abf', feelings:'#d46d94', arts:'#c87030', world:'#a8743c' };

  // Facing-direction cone — rotates with device compass (see _applyHeading). Hidden
  // until heading is enabled. inset:0 → rotates around the marker centre.
  const headingCone = (ring, top) =>
    `<div class="user-heading-wrap" style="position:absolute;inset:0;transition:transform .15s ease-out;pointer-events:none;display:${_headingOn?'block':'none'};z-index:2">
       <div style="position:absolute;left:50%;top:${top}px;transform:translateX(-50%);width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-bottom:11px solid ${ring};filter:drop-shadow(0 1px 2px rgba(0,0,0,.35))"></div>
     </div>`;

  if (gream && gream.stage >= 2 && gream.archetype) {
    const stage  = Math.min(gream.stage, 4);
    const src    = `img/greamici/${gream.archetype}_${stage}.png`;
    const world  = (window._greamArchetypes?.[gream.archetype]?.primaryWorld) || 'nature';
    const ring   = COLORS[world] || '#4a8a2e';

    return L.divIcon({
      html: `<div style="position:relative;width:48px;height:48px">
        ${headingCone(ring, -13)}
        <div style="position:absolute;inset:-10px;background:${ring}1a;border-radius:50%;animation:greamPulse 2.2s ease-in-out infinite"></div>
        <div style="position:absolute;inset:0;border-radius:50%;border:2.5px solid ${ring};background:white;box-shadow:0 2px 12px rgba(0,0,0,0.22);overflow:hidden;display:flex;align-items:center;justify-content:center">
          <div style="width:40px;height:40px;background-image:url('${src}');background-size:200% 200%;background-position:100% 100%;background-repeat:no-repeat;image-rendering:pixelated"></div>
        </div>
      </div>`,
      className: '',
      iconSize:   [48, 48],
      iconAnchor: [24, 24]
    });
  }

  return L.divIcon({
    html: `<div style="position:relative;width:28px;height:28px">
      ${headingCone('#4a8a2e', -12)}
      <div style="position:absolute;inset:-10px;background:rgba(74,138,46,0.14);border-radius:50%;animation:greamPulse 2s ease-in-out infinite"></div>
      <div style="position:absolute;inset:0;background:#4a8a2e;border:2.5px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.25);display:flex;align-items:center;justify-content:center;font-size:13px">🌱</div>
    </div>`,
    className: '',
    iconSize:   [28, 28],
    iconAnchor: [14, 14]
  });
}

// ─── Organic blob area around a visited POI ───
// Uses seeded randomness so shape is stable across re-renders.
// Unified "explored territory" colour. All completed-POI blobs share it and have
// no stroke, so neighbouring ones visually merge into one growing area (puzzle /
// conquered-territory feel) instead of separate islands. Per-world identity stays
// on the coloured POI dot.
const TERRITORY_COLOR = '#5aa02c';

function makePoiArea(L, poi /* , color (unused: territory is unified) */) {
  const { lat, lon } = poi;
  const POINTS = 18;
  const BASE_R = 0.00085; // ~95m — bigger so adjacent completed POIs overlap & merge
  const JITTER = 0.5;

  let rng = ((lat * 73856 + lon * 49812) * 1000) | 0;
  const rand = () => {
    rng = (rng * 1664525 + 1013904223) & 0xffffffff;
    return (rng >>> 0) / 0xffffffff;
  };

  const cosLat = Math.cos(lat * Math.PI / 180);
  const pts = [];
  for (let i = 0; i < POINTS; i++) {
    const angle = (i / POINTS) * 2 * Math.PI;
    const r = BASE_R * (1 + JITTER * (rand() * 2 - 1));
    pts.push([lat + r * Math.sin(angle), lon + (r * Math.cos(angle)) / cosLat]);
  }

  return L.polygon(pts, {
    color:       TERRITORY_COLOR,
    fillColor:   TERRITORY_COLOR,
    fillOpacity: 0.15,   // low enough that even overlaps stay soft (no hard seams)
    weight:      0,      // no stroke → merged blobs read as one territory
    interactive: false,
    smoothFactor: 2,
  });
}

// ─── POI dot marker ───
function makePoiDot(L, poi, userPos, onTap) {
  const worldsDone = poi.worldsDone || [];
  const litUp      = worldsDone.length > 0;
  const nearby     = userPos ? distM(userPos, { lat: poi.lat, lon: poi.lon }) <= PROXIMITY_M : false;

  const worldColor = WORLD_COLORS[poi.bonusWorld] || '#4a8a2e';

  let fill, fillOp, stroke, sw, r;
  if (litUp) {
    // Completed → solid world colour with a white halo so it pops (sticker look)
    const lastWorld = worldsDone[worldsDone.length - 1];
    fill   = WORLD_COLORS[lastWorld] || worldColor;
    fillOp = 0.95;
    stroke = '#ffffff';
    sw     = 2.5;
    r      = 9;
  } else if (nearby) {
    // In reach → big, bright, pulsing
    fill   = worldColor;
    fillOp = 0.95;
    stroke = '#ffffff';
    sw     = 3;
    r      = 15;
  } else {
    // Not yet done → coloured by its world (faint), white ring — colourful & readable
    fill   = worldColor;
    fillOp = 0.55;
    stroke = '#ffffff';
    sw     = 2;
    r      = 7;
  }

  const dot = L.circleMarker([poi.lat, poi.lon], {
    radius: r, fillColor: fill, fillOpacity: fillOp,
    color: stroke, weight: sw, opacity: 0.95,
    interactive: true, bubblingMouseEvents: false
  });

  if (nearby && !litUp) {
    dot.on('add', () => { if (dot._path) dot._path.classList.add('poi-nearby'); });
  }

  dot.on('click', () => {
    const cur = _userPos;
    if (cur) {
      const d = Math.round(distM(cur, { lat: poi.lat, lon: poi.lon }));
      if (d > PROXIMITY_M) { onTap(poi, dot, { tooFar: true, dist: d }); return; }
    }
    onTap(poi, dot, { tooFar: false });
  });

  return dot;
}

// ─── Expanding ring glow on task completion ───
function glowPoi(poi, world, container) {
  if (!_map || !container) return;
  const color = WORLD_COLORS[world] || '#4a8a2e';
  const pt = _map.latLngToContainerPoint([poi.lat, poi.lon]);
  for (let i = 0; i < 4; i++) {
    const ring = document.createElement('div');
    ring.style.cssText = `position:absolute;left:${pt.x}px;top:${pt.y}px;width:0;height:0;
      border-radius:50%;border:3px solid ${color};transform:translate(-50%,-50%);
      pointer-events:none;animation:poiGlow 1.4s ease-out ${i*0.28}s both;z-index:500`;
    container.appendChild(ring);
    setTimeout(() => ring.remove(), 2200 + i * 300);
  }
}

// ─── Compass heading + navigation ───

// Great-circle bearing from → to, degrees clockwise from north.
function bearing(from, to) {
  const φ1 = from.lat * Math.PI/180, φ2 = to.lat * Math.PI/180;
  const Δλ = (to.lon - from.lon) * Math.PI/180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (Math.atan2(y, x) * 180/Math.PI + 360) % 360;
}

function _onOrientation(e) {
  let h = null;
  if (typeof e.webkitCompassHeading === 'number') h = e.webkitCompassHeading;   // iOS: from north, cw
  else if (typeof e.alpha === 'number') h = 360 - e.alpha;                       // Android: alpha is ccw
  if (h == null || isNaN(h)) return;
  _heading = (h + 360) % 360;
  _applyHeading();
}

function _applyHeading() {
  if (_heading == null) return;
  document.querySelectorAll('.user-heading-wrap').forEach(el => {
    el.style.display = 'block';
    el.style.transform = `rotate(${_heading}deg)`;
  });
  _updateNav();
}

// Nav overlay: big arrow pointing toward destination (bearing − heading) + distance.
function _renderNavOverlay() {
  if (!_destination || !MapView._container) return;
  let ov = document.getElementById('navOverlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'navOverlay';
    ov.style.cssText = 'position:absolute;left:50%;bottom:16px;transform:translateX(-50%);z-index:600;background:rgba(26,61,10,0.94);color:#fff;border-radius:16px;padding:12px 16px;display:flex;align-items:center;gap:14px;box-shadow:0 4px 18px rgba(0,0,0,.3);font-family:Nunito,sans-serif;max-width:88%';
    ov.innerHTML =
      `<div id="navArrow" style="font-size:30px;line-height:1;transition:transform .15s ease-out;transform:rotate(0deg)">⬆️</div>
       <div style="line-height:1.25">
         <div id="navLabel" style="font-weight:900;font-size:14px"></div>
         <div id="navDist" style="font-weight:800;font-size:13px;opacity:.9"></div>
         <div id="navHint" style="font-size:10px;opacity:.75;display:none">Klepni pro směr kompasu →</div>
       </div>
       <button id="navClose" style="background:rgba(255,255,255,.18);border:none;color:#fff;width:26px;height:26px;border-radius:50%;font-size:15px;font-weight:900;cursor:pointer;flex:none">✕</button>`;
    MapView._container.appendChild(ov);
    ov.querySelector('#navClose').onclick = () => MapView.clearDestination();
    ov.querySelector('#navArrow').onclick  = () => MapView.enableHeading();  // gesture → iOS permission
  }
  ov.querySelector('#navLabel').textContent = _destination.label || 'Cíl';
}

function _updateNav() {
  if (!_destination || !_userPos) return;
  const dist = Math.round(distM(_userPos, _destination));
  const brng = bearing(_userPos, _destination);
  const rel  = _heading != null ? ((brng - _heading + 360) % 360) : brng;
  const arrow = document.getElementById('navArrow');
  const dEl   = document.getElementById('navDist');
  const hint  = document.getElementById('navHint');
  if (arrow) arrow.style.transform = `rotate(${rel}deg)`;
  if (dEl)   dEl.textContent = dist <= PROXIMITY_M ? '📍 Jsi na místě!' : `${dist} m`;
  if (hint)  hint.style.display = _heading == null ? 'block' : 'none';
}

export const MapView = {
  _container: null,

  async open(containerId, center, opts = {}) {
    const L = await loadLeaflet();
    const placeholder = document.getElementById(containerId);
    if (!placeholder) return;
    this._container = placeholder;
    _onPoiTap = opts.onPoiTap || null;
    _lastOpts = opts;
    if (placeholder.style.position !== 'relative' && placeholder.style.position !== 'absolute') placeholder.style.position = 'relative';

    if (!document.getElementById('gream-map-styles')) {
      const s = document.createElement('style');
      s.id = 'gream-map-styles';
      s.textContent = `
        @keyframes poiGlow { 0%{width:0;height:0;opacity:.9} 100%{width:110px;height:110px;opacity:0} }
        @keyframes greamPulse { 0%,100%{transform:scale(1);opacity:.55} 50%{transform:scale(1.6);opacity:.12} }
        @keyframes poiNearbyPulse { 0%,100%{opacity:1} 50%{opacity:0.45} }
        .poi-nearby { animation: poiNearbyPulse 1.4s ease-in-out infinite; }
        .leaflet-container{font-family:'Nunito',sans-serif!important}
        .leaflet-control-zoom{display:none!important}
        .leaflet-control-attribution{font-size:9px!important;opacity:.35!important}
        .poi-count-tip{background:rgba(26,61,10,0.88)!important;color:#fff!important;border:none!important;border-radius:10px!important;font:800 10px 'Nunito',sans-serif!important;padding:1px 6px!important;box-shadow:0 1px 4px rgba(0,0,0,.3)!important}
        .poi-count-tip::before{display:none!important}
      `;
      document.head.appendChild(s);
    }

    // ── KEEP-ALIVE: reuse the warm map instead of rebuilding + reloading it ──
    if (_map && _mapHost) {
      placeholder.appendChild(_mapHost);           // re-parent into the freshly-rendered screen
      if (center) _userPos = { lat: center.lat, lon: center.lon };
      _following = true;
      // Leaflet must recompute size after the host is moved/resized in the DOM.
      requestAnimationFrame(() => { try { _map.invalidateSize(false); if (center) _map.setView([center.lat, center.lon], _map.getZoom()); } catch {} });
      this._startWatch(L);
      if (_destination) { _renderNavOverlay(); _updateNav(); }
      if (_allPois.length) opts.onPoisLoaded?.(_allPois);   // instant — no reload
      else this._loadPOI(L, center || _userPos, opts);
      return _map;
    }

    // ── First build: create the persistent host + Leaflet instance ──
    _mapHost = document.createElement('div');
    _mapHost.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
    placeholder.appendChild(_mapHost);
    _poiLayers = [];
    _userPos = { lat: center.lat, lon: center.lon };
    _following = true;

    _map = L.map(_mapHost, {
      center: [center.lat, center.lon],
      zoom: opts.zoom || 16,
      zoomControl: false, scrollWheelZoom: true, doubleClickZoom: true,
      touchZoom: true, boxZoom: false, keyboard: false,
      attributionControl: true, dragging: true,
    });

    L.tileLayer(TILE_URL, { attribution: TILE_ATTR, subdomains: 'abcd', maxZoom: 19 }).addTo(_map);

    _allPois = [];
    this._loadPOI(L, center, opts);

    _userMarker = L.marker([center.lat, center.lon], {
      icon: makeUserMarker(L, opts.gream || null),
      zIndexOffset: 1000
    }).addTo(_map);

    _map.on('dragstart', () => { _following = false; });
    this._startWatch(L);

    return _map;
  },

  // Start (or resume) the GPS watch. Idempotent — safe to call on every open().
  _startWatch(L) {
    if (_watchId != null) return;
    _watchId = Geo.watchPosition(pos => {
      if (!_map || !_userMarker) return;
      const next = { lat: pos.lat, lon: pos.lon };
      const moved = _userPos ? distM(_userPos, next) : 999;
      _userPos = next;
      _userMarker.setLatLng([pos.lat, pos.lon]);
      // Only pan / restyle when the user actually moved — panning on every noisy GPS
      // tick (~1/s) made the map visibly stutter.
      if (moved < 4) { _updateNav(); return; }
      if (_following) _map.panTo([pos.lat, pos.lon], { animate: true, duration: 0.4 });
      this._refreshDotStyles(L);
      _updateNav();
      // Moving far (walking / driving): pull in POIs for the new area once we've left
      // ~40% of the fetch radius. Overpass is cached 12h so it's cheap, and _loadPOI
      // replaces the set → places left behind drop off the map automatically.
      const fetchR = (_lastOpts && _lastOpts.radius) || 2000;
      if (_lastFetchCenter && distM(_lastFetchCenter, next) > fetchR * 0.4) {
        _lastFetchCenter = next;   // set before the async fetch to avoid duplicate triggers
        this._loadPOI(L, next, _lastOpts || {});
      }
    }, () => {});
  },

  // ─── Facing direction (compass) ───
  // Must be called from a user gesture on iOS (DeviceOrientation permission).
  async enableHeading() {
    if (_headingOn) return true;
    try {
      const D = window.DeviceOrientationEvent;
      if (D && typeof D.requestPermission === 'function') {
        const perm = await D.requestPermission();
        if (perm !== 'granted') return false;
      }
      window.addEventListener('deviceorientationabsolute', _onOrientation, true);
      window.addEventListener('deviceorientation', _onOrientation, true);
      _headingOn = true;
      return true;
    } catch { return false; }
  },

  // ─── Navigation: point an arrow toward a target (POI / battle spot) ───
  async setDestination(lat, lon, label) {
    _destination = { lat, lon, label: label || '' };
    this.enableHeading();   // this call chain is inside a user tap → iOS gets its gesture
    if (_map) {
      if (_destMarker) { _destMarker.remove(); _destMarker = null; }
      const L = window.L;
      if (L) {
        _destMarker = L.marker([lat, lon], {
          icon: L.divIcon({
            html: `<div style="font-size:26px;filter:drop-shadow(0 2px 3px rgba(0,0,0,.4))">📍</div>`,
            className: '', iconSize: [26, 26], iconAnchor: [13, 26]
          }), zIndexOffset: 900
        }).addTo(_map);
      }
    }
    _renderNavOverlay();
    _updateNav();
  },

  clearDestination() {
    _destination = null;
    if (_destMarker) { _destMarker.remove(); _destMarker = null; }
    document.getElementById('navOverlay')?.remove();
  },

  async _loadPOI(L, center, opts) {
    try {
      const pois = await Geo.fetchAllPOI(center, opts.radius || 1500);
      _allPois = pois;
      if (!_map) return;
      _lastFetchCenter = center;

      _poiLayers.forEach(({ dot, area }) => { dot?.remove(); area?.remove(); });
      _poiLayers = [];

      // Draw area polygons first (so dots render on top)
      pois.forEach(poi => {
        const worldsDone = poi.worldsDone || [];
        let area = null;
        if (worldsDone.length > 0) {
          const lastWorld = worldsDone[worldsDone.length - 1];
          const color = WORLD_COLORS[lastWorld] || WORLD_COLORS[poi.bonusWorld] || '#4a8a2e';
          area = makePoiArea(L, poi, color);
          area.addTo(_map);
        }
        const dot = makePoiDot(L, poi, _userPos, (p, d, info) => this._onTap(p, d, L, info));
        dot.addTo(_map);
        // ⚔️ Battle spots (parks / pubs / cafes …) are marked instantly.
        if (isBattleSpot(poi) && dot.bindTooltip) {
          dot.bindTooltip('⚔️', { permanent: true, direction: 'top', className: 'poi-count-tip poi-battle-tip', offset: [0, -6] });
        }
        _poiLayers.push({ poi, dot, area });
      });

      opts.onPoisLoaded?.(pois);

      // Shared map: show how many people (anonymously) completed each public POI,
      // combined with the ⚔️ battle-spot marker.
      Net.poiCounts(pois.map(p => p.id)).then(counts => {
        if (!counts || !_map) return;
        _poiLayers.forEach(({ poi, dot }) => {
          const n = counts[poi.id] || 0;
          const label = (isBattleSpot(poi) ? '⚔️' : '') + (n > 0 ? ` 👥${n}` : '');
          if (label && dot && dot.bindTooltip) {
            if (dot.getTooltip && dot.getTooltip()) dot.setTooltipContent(label.trim());
            else dot.bindTooltip(label.trim(), { permanent: true, direction: 'top', className: 'poi-count-tip', offset: [0, -6] });
          }
        });
      }).catch(() => {});
    } catch (e) {
      opts.onError?.(e);
    }
  },

  _refreshDotStyles(L) {
    _poiLayers.forEach(({ poi, dot }) => {
      if ((poi.worldsDone || []).length > 0) return;
      const nearby = _userPos ? distM(_userPos, { lat: poi.lat, lon: poi.lon }) <= PROXIMITY_M : false;
      dot.setRadius(nearby ? 16 : 6);
      dot.setStyle({
        fillColor: nearby ? '#5a9a3e' : '#bbb',
        fillOpacity: nearby ? 0.85 : 0.45,
        color: nearby ? '#2a6a1e' : '#999',
        weight: nearby ? 2 : 1,
      });
      if (dot._path) dot._path.classList.toggle('poi-nearby', nearby);
    });
  },

  _onTap(poi, dot, L, info = {}) {
    if (info.tooFar) {
      _onPoiTap?.(poi, { tooFar: true, dist: info.dist });
      return;
    }
    _activePoi = poi;
    _onPoiTap?.(poi, { tooFar: false });
  },

  celebratePOI(poiId, world) {
    Geo.markPOIDone(poiId, world);
    const layer = _poiLayers.find(l => l.poi.id === poiId);
    if (!layer || !_map) return;
    const L = window.L;
    if (!L) return;

    layer.poi.worldsDone = Geo.getPOIWorldsDone(poiId);
    layer.dot?.remove();
    layer.area?.remove();

    const color = WORLD_COLORS[world] || '#4a8a2e';
    layer.area = makePoiArea(L, layer.poi, color);
    layer.area.addTo(_map);
    layer.dot = makePoiDot(L, layer.poi, _userPos, (p, d, info) => this._onTap(p, d, L, info));
    layer.dot.addTo(_map);

    glowPoi(layer.poi, world, this._container);
  },

  recenter(pos) {
    if (_map && pos) _map.panTo([pos.lat, pos.lon], { animate: true });
  },

  // Called by the router when leaving the map screen. KEEP-ALIVE: we pause (stop the
  // GPS watch, park the map host in a hidden holder) instead of tearing the map down,
  // so coming back is instant and never reloads.
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
      holder.appendChild(_mapHost);   // survives the screen container being wiped
    }
    // _map, _mapHost, _allPois, _userPos, heading & destination all stay warm.
  },

  // Full teardown — only for profile switch / logout, not normal navigation.
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
    _poiLayers = []; _userMarker = null; _activePoi = null; _allPois = []; _userPos = null;
  },

  getActivePOI() { return _activePoi; },
  getAllPOI()    { return _allPois; },

  filterByWorld(world) {
    if (!_map) return;
    _poiLayers.forEach(({ poi, dot, area }) => {
      if (!world) {
        const litUp = (poi.worldsDone || []).length > 0;
        dot.setStyle({ fillOpacity: litUp ? 0.85 : 0.45, opacity: 1 });
        area?.setStyle({ fillOpacity: 0.20, opacity: 0.40 });
      } else if (poi.bonusWorld === world) {
        dot.setStyle({ fillOpacity: 0.95, opacity: 1, weight: 3 });
        dot.bringToFront();
        area?.setStyle({ fillOpacity: 0.30, opacity: 0.55 });
      } else {
        dot.setStyle({ fillOpacity: 0.10, opacity: 0.22 });
        area?.setStyle({ fillOpacity: 0.04, opacity: 0.08 });
      }
    });
  }
};
