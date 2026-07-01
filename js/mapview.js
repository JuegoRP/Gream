// ═══════════════════════════════════
//  GREAM — mapview.js  v3
//  - Fixed user marker (single 256x256 sprite, no sheet slicing)
//  - Organic colored blob area around visited POIs
//  - Proximity check: POI only tappable within PROXIMITY_M metres
//  - Dots highlight green when user is close
// ═══════════════════════════════════

import { Geo, WORLD_COLORS, WORLD_EMOJIS, WORLD_BONUS } from './geo.js';

const TILE_URL    = 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png';
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

  if (gream && gream.stage >= 2 && gream.archetype) {
    const stage  = Math.min(gream.stage, 4);
    const src    = `img/greamici/${gream.archetype}_${stage}.png`;
    const world  = (window._greamArchetypes?.[gream.archetype]?.primaryWorld) || 'nature';
    const ring   = COLORS[world] || '#4a8a2e';

    return L.divIcon({
      html: `<div style="position:relative;width:48px;height:48px">
        <div style="position:absolute;inset:-10px;background:${ring}1a;border-radius:50%;animation:greamPulse 2.2s ease-in-out infinite"></div>
        <div style="position:absolute;inset:0;border-radius:50%;border:2.5px solid ${ring};background:white;box-shadow:0 2px 12px rgba(0,0,0,0.22);overflow:hidden;display:flex;align-items:center;justify-content:center">
          <img src="${src}" style="width:42px;height:42px;object-fit:contain;image-rendering:auto"
               onerror="this.replaceWith(Object.assign(document.createElement('span'),{textContent:'🌱',style:'font-size:22px'}))">
        </div>
      </div>`,
      className: '',
      iconSize:   [48, 48],
      iconAnchor: [24, 24]
    });
  }

  return L.divIcon({
    html: `<div style="position:relative;width:28px;height:28px">
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
function makePoiArea(L, poi, color) {
  const { lat, lon } = poi;
  const POINTS = 16;
  const BASE_R = 0.00048; // ~55m base radius
  const JITTER = 0.6;

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
    color,
    fillColor: color,
    fillOpacity: 0.20,
    weight: 1.5,
    opacity: 0.40,
    interactive: false,
    smoothFactor: 1.5,
  });
}

// ─── POI dot marker ───
function makePoiDot(L, poi, userPos, onTap) {
  const worldsDone = poi.worldsDone || [];
  const litUp      = worldsDone.length > 0;
  const nearby     = userPos ? distM(userPos, { lat: poi.lat, lon: poi.lon }) <= PROXIMITY_M : false;

  let fill, fillOp, stroke, sw, r;
  if (litUp) {
    const lastWorld = worldsDone[worldsDone.length - 1];
    fill   = WORLD_COLORS[lastWorld] || WORLD_COLORS[poi.bonusWorld] || '#4a8a2e';
    fillOp = 0.85;
    stroke = fill;
    sw     = 2;
    r      = 9;
  } else if (nearby) {
    fill   = '#5a9a3e';
    fillOp = 0.85;
    stroke = '#2a6a1e';
    sw     = 2;
    r      = 16;
  } else {
    fill   = '#bbb';
    fillOp = 0.45;
    stroke = '#999';
    sw     = 1;
    r      = 6;
  }

  const dot = L.circleMarker([poi.lat, poi.lon], {
    radius: r, fillColor: fill, fillOpacity: fillOp,
    color: stroke, weight: sw,
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

export const MapView = {
  _container: null,

  async open(containerId, center, opts = {}) {
    const L = await loadLeaflet();
    const container = document.getElementById(containerId);
    if (!container) return;
    this._container = container;

    if (_map) { _map.remove(); _map = null; }
    _poiLayers.forEach(({ dot, area }) => { dot?.remove(); area?.remove(); });
    _poiLayers = [];
    _userPos = { lat: center.lat, lon: center.lon };

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
      `;
      document.head.appendChild(s);
    }

    _map = L.map(container, {
      center: [center.lat, center.lon],
      zoom: opts.zoom || 16,
      zoomControl: false, scrollWheelZoom: true, doubleClickZoom: true,
      touchZoom: true, boxZoom: false, keyboard: false,
      attributionControl: true, dragging: true,
    });

    L.tileLayer(TILE_URL, { attribution: TILE_ATTR, subdomains: 'abcd', maxZoom: 19 }).addTo(_map);

    _onPoiTap = opts.onPoiTap || null;
    _allPois  = [];

    this._loadPOI(L, center, opts);

    _userMarker = L.marker([center.lat, center.lon], {
      icon: makeUserMarker(L, opts.gream || null),
      zIndexOffset: 1000
    }).addTo(_map);

    let _following = true;
    _map.on('dragstart', () => { _following = false; });

    if (_watchId != null) Geo.clearWatch(_watchId);
    _watchId = Geo.watchPosition(pos => {
      if (!_map || !_userMarker) return;
      _userPos = { lat: pos.lat, lon: pos.lon };
      _userMarker.setLatLng([pos.lat, pos.lon]);
      if (_following) _map.panTo([pos.lat, pos.lon], { animate: true, duration: 0.8, easeLinearity: 0.5 });
      this._refreshDotStyles(L);
    }, () => {});

    return _map;
  },

  async _loadPOI(L, center, opts) {
    try {
      const pois = await Geo.fetchAllPOI(center, opts.radius || 1500);
      _allPois = pois;
      if (!_map) return;

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
        _poiLayers.push({ poi, dot, area });
      });

      opts.onPoisLoaded?.(pois);
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

  destroy() {
    if (_watchId != null) { Geo.clearWatch(_watchId); _watchId = null; }
    if (_map) { _map.remove(); _map = null; }
    _poiLayers.forEach(({ dot, area }) => { dot?.remove(); area?.remove(); });
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
