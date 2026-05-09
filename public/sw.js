const VERSION = 'face-publisher-v3';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-maskable.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((c) => c.addAll(APP_SHELL).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

function isNavigation(req) {
  if (req.mode === 'navigate') return true;
  const accept = req.headers.get('accept') || '';
  return accept.includes('text/html');
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Network-first for navigations (HTML) — guarantees the user sees the latest
  // app shell after a deploy. Falls back to cached shell when offline.
  if (isNavigation(req)) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(VERSION).then((c) => c.put(req, clone));
          }
          return res;
        })
        .catch(() =>
          caches.match(req).then((cached) => cached || caches.match('./index.html'))
        )
    );
    return;
  }

  // Stale-while-revalidate for everything else (hashed JS/CSS, icons, etc.)
  event.respondWith(
    caches.match(req).then((cached) => {
      const networked = fetch(req)
        .then((res) => {
          if (res && res.ok && res.type === 'basic') {
            const clone = res.clone();
            caches.open(VERSION).then((c) => c.put(req, clone));
          }
          return res;
        })
        .catch(() => cached);
      return cached || networked;
    })
  );
});
