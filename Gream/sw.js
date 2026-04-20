const CACHE = 'gream-v1';
const ASSETS = [
  '/', '/index.html',
  '/css/base.css', '/css/layout.css', '/css/components.css',
  '/js/app.js', '/js/i18n.js', '/js/data.js', '/js/profiles.js',
  '/js/badges.js', '/js/challenge.js', '/js/camera.js',
  '/js/speech.js', '/js/stats.js', '/js/router.js',
  '/screens/onboarding.html', '/screens/profiles.html',
  '/screens/map.html', '/screens/challenge.html',
  '/screens/profile-edit.html', '/screens/badges.html',
  '/screens/settings.html', '/screens/stats.html',
  '/screens/draw.html', '/screens/step-done.html',
  '/screens/badge-earned.html',
  'https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).catch(() => cached))
  );
});
