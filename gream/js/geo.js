// ═══════════════════════════════════
//  GREAM — geo.js  v2
//  Single Overpass fetch → all POI, world bonus by place type
// ═══════════════════════════════════

const KEY_HOME      = 'gream_home_pin';
const KEY_LAST_POS  = 'gream_last_pos';
const KEY_POI_CACHE = 'gream_poi_cache_v3';
const KEY_POI_DONE  = 'gream_poi_done';
const POI_CACHE_TTL = 12 * 60 * 60 * 1000; // 12h localStorage cache

// In-memory session cache — instant hit when user opens map twice in same session
let _sessionPoiCache = null; // { key, data, t }

const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter'
];

const FETCH_TAGS = [
  // Nature
  'leisure=park', 'leisure=garden', 'leisure=nature_reserve', 'leisure=playground',
  'natural=tree', 'natural=spring', 'natural=peak', 'natural=wood', 'natural=water',
  // World/History
  'historic=monument', 'historic=memorial', 'historic=castle', 'historic=ruins',
  'historic=wayside_cross', 'historic=boundary_stone',
  'amenity=place_of_worship', 'tourism=attraction', 'tourism=viewpoint',
  // Logic/Knowledge
  'amenity=library', 'tourism=museum', 'amenity=planetarium',
  'amenity=school', 'amenity=university', 'amenity=post_office',
  'information=board', 'information=map',
  // Arts/Culture
  'tourism=artwork', 'tourism=gallery', 'amenity=theatre', 'amenity=arts_centre',
  'amenity=cinema', 'amenity=music_venue',
  // Language/Communication
  'amenity=fountain', 'tourism=information', 'amenity=clock',
  'amenity=telephone', 'man_made=tower',
  // Feelings/Social
  'amenity=bench', 'amenity=social_centre', 'amenity=community_centre',
  'amenity=cafe', 'leisure=sports_centre', 'amenity=hospital',
];

export const WORLD_BONUS = {
  nature:   ['park', 'garden', 'nature_reserve', 'tree', 'spring', 'wood', 'peak', 'playground', 'water'],
  world:    ['monument', 'memorial', 'castle', 'ruins', 'place_of_worship', 'attraction', 'viewpoint', 'wayside_cross', 'boundary_stone'],
  logic:    ['museum', 'planetarium', 'library', 'school', 'university', 'post_office', 'board', 'map'],
  arts:     ['artwork', 'theatre', 'arts_centre', 'gallery', 'cinema', 'music_venue'],
  language: ['fountain', 'information', 'clock', 'telephone', 'tower', 'library'],
  feelings: ['playground', 'garden', 'bench', 'social_centre', 'community_centre', 'memorial', 'cafe', 'sports_centre', 'hospital'],
};

export const WORLD_COLORS = {
  nature:   '#4a8a2e', language: '#5a4a8a', logic: '#2d7abf',
  feelings: '#d46d94', arts:     '#c87030', world: '#a8743c'
};

export const WORLD_EMOJIS = {
  nature: '🌿', language: '📖', logic: '🧩', feelings: '💛', arts: '🎨', world: '🌍'
};

export const Geo = {
  supported() { return 'geolocation' in navigator; },

  async getPosition(highAccuracy = true) {
    return new Promise((resolve, reject) => {
      if (!this.supported()) return reject(new Error('no-geolocation'));
      navigator.geolocation.getCurrentPosition(
        pos => {
          const p = { lat: pos.coords.latitude, lon: pos.coords.longitude, acc: pos.coords.accuracy, t: Date.now() };
          try { localStorage.setItem(KEY_LAST_POS, JSON.stringify(p)); } catch {}
          resolve(p);
        },
        err => reject(err),
        { enableHighAccuracy: highAccuracy, timeout: 12000, maximumAge: 30000 }
      );
    });
  },

  lastPosition() {
    try { return JSON.parse(localStorage.getItem(KEY_LAST_POS) || 'null'); } catch { return null; }
  },

  watchPosition(onUpdate, onError) {
    if (!this.supported()) { onError?.(new Error('no-geolocation')); return null; }
    return navigator.geolocation.watchPosition(
      pos => {
        const p = { lat: pos.coords.latitude, lon: pos.coords.longitude, acc: pos.coords.accuracy, t: Date.now() };
        try { localStorage.setItem(KEY_LAST_POS, JSON.stringify(p)); } catch {}
        onUpdate(p);
      },
      err => onError?.(err),
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
  },

  clearWatch(id) { if (id != null) navigator.geolocation.clearWatch(id); },

  distance(a, b) {
    if (!a || !b) return Infinity;
    const R = 6371000;
    const toRad = d => d * Math.PI / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLon = toRad(b.lon - a.lon);
    const x = Math.sin(dLat/2)**2 + Math.sin(dLon/2)**2 * Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat));
    return 2 * R * Math.asin(Math.sqrt(x));
  },

  setHome(pos) { try { localStorage.setItem(KEY_HOME, JSON.stringify(pos)); } catch {} },
  getHome() { try { return JSON.parse(localStorage.getItem(KEY_HOME) || 'null'); } catch { return null; } },
  clearHome() { try { localStorage.removeItem(KEY_HOME); } catch {} },

  async fetchAllPOI(center, radiusMeters = 1500) {
    if (!center) return [];

    const cacheKey = `${center.lat.toFixed(3)}_${center.lon.toFixed(3)}_${radiusMeters}`;

    // 1. In-memory session cache — instant hit, no JSON parsing
    if (_sessionPoiCache && _sessionPoiCache.key === cacheKey &&
        Date.now() - _sessionPoiCache.t < POI_CACHE_TTL) {
      return this._mergeDoneState(_sessionPoiCache.data);
    }

    // 2. localStorage cache
    try {
      const raw = localStorage.getItem(KEY_POI_CACHE);
      if (raw) {
        const cache = JSON.parse(raw);
        if (cache.key === cacheKey && Date.now() - cache.t < POI_CACHE_TTL) {
          _sessionPoiCache = { key: cacheKey, data: cache.data, t: cache.t };
          return this._mergeDoneState(cache.data);
        }
      }
    } catch {}

    const parts = FETCH_TAGS.map(tag => {
      const [k, v] = tag.split('=');
      return `node["${k}"="${v}"](around:${radiusMeters},${center.lat},${center.lon});\n  way["${k}"="${v}"](around:${radiusMeters},${center.lat},${center.lon});`;
    }).join('\n  ');

    const query = `[out:json][timeout:30];\n(\n  ${parts}\n);\nout center 40;`;

    for (const url of OVERPASS_URLS) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          body: 'data=' + encodeURIComponent(query),
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        if (!res.ok) continue;
        const json = await res.json();

        const items = (json.elements || []).map(el => {
          const lat = el.lat ?? el.center?.lat;
          const lon = el.lon ?? el.center?.lon;
          if (!lat || !lon) return null;
          const tags = el.tags || {};
          const kind = this._kindFromTags(tags);
          return { id: String(el.id), lat, lon, kind, bonusWorld: this._bonusWorld(kind) };
        }).filter(Boolean);

        items.forEach(p => p._dist = this.distance(center, p));
        items.sort((a, b) => a._dist - b._dist);
        const top = this._deduplicatePOI(items, 25).slice(0, 40);

        try {
          localStorage.setItem(KEY_POI_CACHE, JSON.stringify({ key: cacheKey, t: Date.now(), data: top }));
          _sessionPoiCache = { key: cacheKey, data: top, t: Date.now() };
        } catch {}
        return this._mergeDoneState(top);
      } catch { /* try next */ }
    }
    return [];
  },

  _mergeDoneState(pois) {
    let done = {};
    try { done = JSON.parse(localStorage.getItem(KEY_POI_DONE) || '{}'); } catch {}
    return pois.map(p => ({ ...p, worldsDone: (done[p.id] || []).map(e => e.world) }));
  },

  markPOIDone(poiId, world) {
    try {
      const done = JSON.parse(localStorage.getItem(KEY_POI_DONE) || '{}');
      if (!done[poiId]) done[poiId] = [];
      const today = new Date().toDateString();
      const alreadyToday = done[poiId].some(e => e.world === world && new Date(e.ts).toDateString() === today);
      if (!alreadyToday) done[poiId].push({ world, ts: Date.now() });
      localStorage.setItem(KEY_POI_DONE, JSON.stringify(done));
    } catch {}
  },

  getPOIWorldsDone(poiId) {
    try { return (JSON.parse(localStorage.getItem(KEY_POI_DONE) || '{}')[poiId] || []).map(e => e.world); } catch { return []; }
  },

  async checkAtPOI(poi, requiredMeters = 80) {
    const pos = await this.getPosition().catch(() => this.lastPosition());
    if (!pos) return { atPOI: true };
    const dist = this.distance(pos, poi);
    return { atPOI: dist <= requiredMeters, dist: Math.round(dist), pos };
  },

  async checkOutdoor(age) {
    const pos = await this.getPosition().catch(() => null);
    if (!pos) return { outside: false, error: 'no-position' };
    const home = this.getHome();
    if (!home) return { outside: true, pos };
    const dist = this.distance(home, pos);
    const rule = ({ '4-6': { min: 50, max: 500 }, '7-9': { min: 30, max: 5000 } }[age]) || { min: 30, max: Infinity };
    return { outside: dist >= rule.min && dist <= rule.max, distFromHome: Math.round(dist), pos, rule };
  },

  async tagWithLocation(proof) {
    const last = this.lastPosition();
    return { value: proof, geo: last ? { lat: last.lat, lon: last.lon, t: Date.now() } : null };
  },

  // Legacy compat
  markPOIColored(poi) { if (poi?.id) this.markPOIDone(poi.id, poi.world || 'nature'); },
  getPOIColorAge(poi)  { return this.getPOIWorldsDone(poi?.id || '').length > 0 ? 0 : 1; },
  async fetchPOI(world, center, radius) { return this.fetchAllPOI(center, radius); },

  // ─── Invalidate cached position if device has moved more than thresholdMeters ───
  invalidateIfMoved(thresholdMeters = 500) {
    try {
      const last = this.lastPosition();
      if (!last) return;
      navigator.geolocation.getCurrentPosition(pos => {
        const current = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        const dist = this.distance(last, current);
        if (dist > thresholdMeters) {
          // Clear cached home so outdoor check is fresh
          try { sessionStorage.removeItem('gream_pos_cache'); } catch {}
        }
      }, () => {}, { maximumAge: 0, timeout: 5000, enableHighAccuracy: false });
    } catch {}
  },

  _deduplicatePOI(sorted, minDist) {
    const out = [];
    for (const p of sorted) {
      if (!out.some(o => this.distance(o, p) < minDist)) out.push(p);
    }
    return out;
  },

  _bonusWorld(kind) {
    for (const [world, kinds] of Object.entries(WORLD_BONUS)) {
      if (kinds.includes(kind)) return world;
    }
    return null;
  },

  _kindFromTags(tags) {
    if (tags.leisure === 'park' || tags.leisure === 'garden') return 'park';
    if (tags.leisure === 'nature_reserve') return 'nature_reserve';
    if (tags.leisure === 'playground') return 'playground';
    if (tags.natural === 'tree') return 'tree';
    if (tags.natural === 'spring') return 'spring';
    if (tags.natural === 'peak') return 'peak';
    if (tags.natural === 'wood') return 'wood';
    if (tags.natural === 'water') return 'water';
    if (tags.historic === 'castle') return 'castle';
    if (tags.historic === 'monument') return 'monument';
    if (tags.historic === 'memorial') return 'memorial';
    if (tags.historic === 'ruins') return 'ruins';
    if (tags.historic === 'wayside_cross') return 'wayside_cross';
    if (tags.historic === 'boundary_stone') return 'boundary_stone';
    if (tags.amenity === 'place_of_worship') return 'place_of_worship';
    if (tags.amenity === 'library') return 'library';
    if (tags.amenity === 'theatre') return 'theatre';
    if (tags.amenity === 'arts_centre') return 'arts_centre';
    if (tags.amenity === 'planetarium') return 'planetarium';
    if (tags.amenity === 'cinema') return 'cinema';
    if (tags.amenity === 'music_venue') return 'music_venue';
    if (tags.amenity === 'school') return 'school';
    if (tags.amenity === 'university') return 'university';
    if (tags.amenity === 'post_office') return 'post_office';
    if (tags.amenity === 'fountain') return 'fountain';
    if (tags.amenity === 'clock') return 'clock';
    if (tags.amenity === 'telephone') return 'telephone';
    if (tags.amenity === 'cafe') return 'cafe';
    if (tags.amenity === 'hospital') return 'hospital';
    if (tags.amenity === 'sports_centre') return 'sports_centre';
    if (tags.tourism === 'museum') return 'museum';
    if (tags.tourism === 'artwork') return 'artwork';
    if (tags.tourism === 'gallery') return 'gallery';
    if (tags.tourism === 'viewpoint') return 'viewpoint';
    if (tags.tourism === 'attraction') return 'attraction';
    if (tags.tourism === 'information') return 'information';
    if (tags.information === 'board') return 'board';
    if (tags.information === 'map') return 'map';
    if (tags.man_made === 'tower') return 'tower';
    if (tags.amenity === 'bench') return 'bench';
    if (tags.amenity === 'social_centre' || tags.amenity === 'community_centre') return 'social_centre';
    return 'poi';
  }
};
