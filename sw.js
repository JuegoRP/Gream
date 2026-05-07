// ═══════════════════════════════════
//  GREAM — sw.js  v3
//  Strategy: network-first for app code (always fresh)
//            cache-first for media (audio, images, leaflet, OSM tiles)
// ═══════════════════════════════════

const VERSION = 'gream-v8';
const STATIC_CACHE = `${VERSION}-static`;
const TILES_CACHE  = `gream-tiles-v1`;
const LEAFLET_CACHE = `gream-leaflet-v1`;

// ─── On install: pre-cache only known-stable files ───
const STATIC_ASSETS = [
  'index.html',
  'manifest.json',
  'css/base.css',
  'css/layout.css',
  'css/components.css',
  'css/themes.css',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(STATIC_CACHE)
      .then(c => c.addAll(STATIC_ASSETS).catch(err => console.warn('SW install partial:', err)))
      .then(() => self.skipWaiting())
  );
});

// ─── On activate: clean old version caches ───
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== STATIC_CACHE && k !== TILES_CACHE && k !== LEAFLET_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// ─── On fetch: choose strategy by URL ───
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // External: Overpass = bypass (live data)
  if (url.hostname.includes('overpass')) return;

  // External: Leaflet from CDN — cache-first
  if (url.hostname === 'unpkg.com' && url.pathname.includes('leaflet')) {
    e.respondWith(cacheFirst(e.request, LEAFLET_CACHE));
    return;
  }

  // External: OSM map tiles — cache-first
  if (url.hostname.includes('tile.openstreetmap.org')) {
    e.respondWith(cacheFirst(e.request, TILES_CACHE));
    return;
  }

  // External: Google Fonts — cache-first
  if (url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    e.respondWith(cacheFirst(e.request, STATIC_CACHE));
    return;
  }

  // Local: JS modules / screens / json → network-first (always fresh code)
  if (url.pathname.match(/\.(js|json)$/) || url.pathname.startsWith('/screens/')) {
    e.respondWith(networkFirst(e.request));
    return;
  }

  // Local: images, audio, css → cache-first
  if (url.pathname.match(/\.(png|jpg|jpeg|svg|webp|gif|wav|mp3|css)$/)) {
    e.respondWith(cacheFirst(e.request, STATIC_CACHE));
    return;
  }

  // Default: network-first
  e.respondWith(networkFirst(e.request));
});

// ─── Strategies ───
async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res.ok && res.type !== 'opaque') {
      cache.put(req, res.clone()).catch(() => {});
    }
    return res;
  } catch {
    return new Response('', { status: 504 });
  }
}

async function networkFirst(req) {
  try {
    const res = await fetch(req);
    // Cache successful responses for offline fallback
    if (res.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(req, res.clone()).catch(() => {});
    }
    return res;
  } catch {
    const cached = await caches.match(req);
    return cached || new Response('Offline', { status: 504 });
  }
}
