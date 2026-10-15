// ═══════════════════════════════════
//  GREAM — mapquiz.js  (otázka „Kde to je?“ – ťukni na mapu)
//  Mapa bez popisků (jen pevnina, voda, hranice), dlaždice přes náš server jako hlavní mapa.
//  Formát otázky: { action:"map_pin", scope:"world"|"europe"|"cz",
//                   check:{ type:"map_pin", lat, lon, km: <do kolika km je to „správně“> } }
//  Poloha hráče se tu vůbec nepoužívá – jen bod, na který ťukl.
// ═══════════════════════════════════
import { loadMapLibre, TILES_URL, ATTRIBUTION } from './mapview.js';
export { distanceKm, mapScore } from './validator.js';

const VIEW = {
  world:  { center: [15, 25],    zoom: 0.2, minZoom: 0,   maxZoom: 5 },
  europe: { center: [12, 51],    zoom: 2.4, minZoom: 1.5, maxZoom: 7 },
  cz:     { center: [15.5, 49.8], zoom: 5.4, minZoom: 4.5, maxZoom: 9 },
};

const QUIZ_STYLE = {
  version: 8,
  sources: { omt: { type: 'vector', tiles: [TILES_URL], maxzoom: 14, attribution: ATTRIBUTION } },
  layers: [
    { id: 'land', type: 'background', paint: { 'background-color': '#f3ead2' } },
    { id: 'wood', type: 'fill', source: 'omt', 'source-layer': 'landcover', filter: ['==', ['get', 'class'], 'wood'], paint: { 'fill-color': '#dfe8c4' } },
    { id: 'water', type: 'fill', source: 'omt', 'source-layer': 'water', paint: { 'fill-color': '#a9dcf1' } },
    { id: 'river', type: 'line', source: 'omt', 'source-layer': 'waterway', filter: ['==', ['get', 'class'], 'river'], paint: { 'line-color': '#8ccbe6', 'line-width': 1 } },
    { id: 'region', type: 'line', source: 'omt', 'source-layer': 'boundary', filter: ['all', ['==', ['get', 'admin_level'], 4], ['!=', ['get', 'maritime'], 1]], minzoom: 5,
      paint: { 'line-color': '#c9b994', 'line-width': 0.8, 'line-dasharray': [3, 2] } },
    { id: 'country', type: 'line', source: 'omt', 'source-layer': 'boundary', filter: ['all', ['==', ['get', 'admin_level'], 2], ['!=', ['get', 'maritime'], 1]],
      paint: { 'line-color': '#a08a5c', 'line-width': ['interpolate', ['linear'], ['zoom'], 0, 0.6, 6, 1.6] } },
  ],
};

const pinEl = (color, emoji) => {
  const el = document.createElement('div');
  el.style.cssText = `width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color};border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center`;
  el.innerHTML = `<span style="transform:rotate(45deg);font-size:14px">${emoji}</span>`;
  return el;
};

export const MapQuiz = {
  // Vykreslí mapu do containeru; onPick(lngLat) při každém ťuknutí. Vrací ovladač { reveal(target), destroy() }.
  async mount(container, scope, onPick) {
    const ml = await loadMapLibre();
    if (!document.getElementById('mapq-styles')) {
      const st = document.createElement('style'); st.id = 'mapq-styles';
      st.textContent = '.mapq-box .maplibregl-ctrl-attrib{font-size:9px;opacity:.6;background:rgba(255,255,255,.7)!important}.mapq-box .maplibregl-ctrl-attrib.maplibregl-compact-show{padding:2px 24px 2px 6px}';
      document.head.appendChild(st);
    }
    const v = VIEW[scope] || VIEW.world;
    const map = new ml.Map({
      container, style: QUIZ_STYLE, center: v.center, zoom: v.zoom, minZoom: v.minZoom, maxZoom: v.maxZoom,
      dragRotate: false, pitchWithRotate: false, touchPitch: false, renderWorldCopies: scope === 'world',
      attributionControl: false,
    });
    map.addControl(new ml.AttributionControl({ compact: true }));
    map.on('load', () => container.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show'));
    map.touchZoomRotate.disableRotation();
    map.keyboard.disable();
    let guess = null, guessMarker = null;
    map.on('click', (e) => {
      guess = { lat: e.lngLat.lat, lon: ((e.lngLat.lng + 540) % 360) - 180 };
      if (!guessMarker) guessMarker = new ml.Marker({ element: pinEl('#e8a33d', '❓'), anchor: 'bottom-left' }).setLngLat([guess.lon, guess.lat]).addTo(map);
      else guessMarker.setLngLat([guess.lon, guess.lat]);
      onPick?.(guess);
    });
    return {
      map,
      get guess() { return guess; },
      reveal(target) {
        new ml.Marker({ element: pinEl('#4a8a2e', '⭐'), anchor: 'bottom-left' }).setLngLat([target.lon, target.lat]).addTo(map);
        if (!guess) return;
        const line = { type: 'Feature', geometry: { type: 'LineString', coordinates: [[guess.lon, guess.lat], [target.lon, target.lat]] } };
        const add = () => {
          if (map.getSource('guessline')) return;
          map.addSource('guessline', { type: 'geojson', data: line });
          map.addLayer({ id: 'guessline', type: 'line', source: 'guessline', paint: { 'line-color': '#4a8a2e', 'line-width': 2, 'line-dasharray': [2, 2] } });
        };
        if (map.isStyleLoaded()) add(); else map.once('load', add);
        const b = new ml.LngLatBounds([guess.lon, guess.lat], [guess.lon, guess.lat]).extend([target.lon, target.lat]);
        try { map.fitBounds(b, { padding: 50, maxZoom: v.maxZoom - 1, duration: 700 }); } catch {}
      },
      destroy() { try { map.remove(); } catch {} },
    };
  },
};
