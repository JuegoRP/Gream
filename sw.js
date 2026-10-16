// ═══════════════════════════════════
//  GREAM — sw.js  v3
//  Strategie (2026-10-16): vše vlastní cache-first v rámci VERZE (rychlé načítání), první stažení vždy s ověřením
//  na serveru (cache:'no-cache'), takže nová verze nepřevezme staré soubory z HTTP mezipaměti prohlížeče.
//  Navigace (index.html) network-first. PŘI KAŽDÉ ZMĚNĚ APLIKACE ZVÝŠIT VERSION.
// ═══════════════════════════════════

const VERSION = 'gream-v46';
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
  'img/logo/gream-logo.png',
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

  // Vlastní soubory: z mezipaměti této verze (rychlý start bez desítek dotazů na server); co v ní ještě není,
  // stáhne se s ověřením a uloží. Nová verze (VERSION) = nová mezipaměť → po aktualizaci vše čerstvé.
  // Výjimka: index.html / navigace – network-first, aby se nová verze SW vůbec dozvěděla.
  if (e.request.mode === 'navigate') { e.respondWith(networkFirst(e.request)); return; }
  e.respondWith(cacheFirst(e.request, STATIC_CACHE));
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
