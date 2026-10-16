// ═══════════════════════════════════
//  GREAM — sw.js  v3
//  Strategy: network-first for app code + CSS, vždy s ověřením na serveru (cache:'no-cache' → 304, levné)
//            cache-first for media (audio, images, fonts, MapLibre, map tiles); po nové verzi se média
//            stahují znovu s ověřením, takže opravený obrázek nezůstane viset ze staré mezipaměti prohlížeče.
//  2026-10-16: dřív CSS cache-first + přednačtení z HTTP mezipaměti → po aktualizaci se ukazoval starý vzhled/obrázky.
// ═══════════════════════════════════

const VERSION = 'gream-v29';
const STATIC_CACHE = `${VERSION}-static`;
const TILES_CACHE  = `gream-tiles-v2`;   // vektorové dlaždice z 3rstudio.eu/api/gream/tiles

// ─── On install: pre-cache only known-stable files ───
const STATIC_ASSETS = [
  'index.html',
  'manifest.json',
  'css/base.css',
  'css/layout.css',
  'css/components.css',
  'css/themes.css',
  'css/fonts.css',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(STATIC_CACHE)
      .then(c => c.addAll(STATIC_ASSETS.map(u => new Request(u, { cache: 'reload' }))).catch(err => console.warn('SW install partial:', err)))
      .then(() => self.skipWaiting())
  );
});

// ─── On activate: clean old version caches ───
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== STATIC_CACHE && k !== TILES_CACHE)
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

  // Vlastní server: místa v okolí = vždy živě (POST se sem stejně nedostane); dlaždice mapy = cache-first
  if (url.hostname === '3rstudio.eu' && url.pathname.startsWith('/api/gream/tiles/')) {
    e.respondWith(cacheFirst(e.request, TILES_CACHE));
    return;
  }
  if (url.hostname !== self.location.hostname) return;   // nic jiného cizího aplikace nenačítá

  // Local: JS modules / screens / json / CSS / HTML → network-first (always fresh code)
  if (url.pathname.match(/\.(js|json|css|html)$/) || url.pathname.includes('/screens/')) {
    e.respondWith(networkFirst(e.request));
    return;
  }

  // Local: images, audio, fonts → cache-first
  if (url.pathname.match(/\.(png|jpg|jpeg|svg|webp|gif|wav|mp3|ogg|woff2)$/)) {
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
    const res = await fetch(req, { cache: 'no-cache' });   // první stažení v této verzi vždy ověřit na serveru
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
    const res = await fetch(req, { cache: 'no-cache' });
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
