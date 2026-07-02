/* public/sw.js */
// Bump this to force clients to fetch the latest assets
const CACHE = 'rjt-v28';

self.addEventListener('install', (event) => {
  // Take control immediately
  self.skipWaiting();
  
  // Pre-cache critical resources
  event.waitUntil(
    caches.open(CACHE).then(cache => {
      return cache.addAll([
        '/',
        '/dashboard',
        '/workouts/new',
        '/history'
      ]).catch(() => {
        // Ignore cache failures, they're not critical
      });
    })
  );
});

// Handle messages from client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Purge old caches
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k === CACHE ? null : caches.delete(k))));
    // Control all open tabs
    await self.clients.claim();
    // Tell pages a new SW is active (our app will reload)
    const clients = await self.clients.matchAll({ type: 'window' });
    for (const client of clients) {
      client.postMessage({ type: 'SW_UPDATED' });
    }
  })());
});

// Push notifications (reminders)
self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch (e) { payload = {}; }
  const title = payload.title || 'Red Jitsu';
  const options = {
    body: payload.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: payload.tag || 'rj-reminder',
    data: { url: payload.url || '/dashboard' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  // Only ever navigate to a same-origin path (defense against a crafted payload).
  let target = '/dashboard';
  try {
    const raw = (event.notification.data && event.notification.data.url) || '/dashboard';
    const u = new URL(raw, self.location.origin);
    if (u.origin === self.location.origin) target = u.pathname + u.search;
  } catch (e) { target = '/dashboard'; }
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clients) {
      if ('focus' in client) { client.navigate(target); return client.focus(); }
    }
    if (self.clients.openWindow) return self.clients.openWindow(target);
  })());
});

// Network-first for HTML, don't hijack Next.js chunks, cache-first for other files
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  const accept = req.headers.get('accept') || '';
  if (req.method !== 'GET') return;

  // Never intercept cross-origin requests (Supabase API calls, etc.) —
  // cache-first on those serves stale data after every write
  if (url.origin !== self.location.origin) return;

  // Let the browser handle Next's hashed assets completely (safer, no staleness)
  if (url.pathname.startsWith('/_next/')) return;

  // HTML/doc requests: network-first, fallback to cache if offline
  if (accept.includes('text/html')) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const copy = fresh.clone();
        const cache = await caches.open(CACHE);
        cache.put(req, copy);
        return fresh;
      } catch (err) {
        console.log('Network failed, trying cache:', err);
        const cached = await caches.match(req);
        if (cached) {
          return cached;
        }
        // Better offline fallback
        return new Response(`
          <!DOCTYPE html>
          <html>
            <head><title>Offline - Red Jitsu Training</title></head>
            <body style="font-family: sans-serif; text-align: center; padding: 50px;">
              <h1>You're offline</h1>
              <p>Please check your internet connection and try again.</p>
              <button onclick="window.location.reload()">Retry</button>
            </body>
          </html>
        `, { 
          status: 200, 
          headers: { 'Content-Type': 'text/html' }
        });
      }
    })());
    return;
  }

  // Static assets: cache-first, then update in background
  event.respondWith((async () => {
    const cached = await caches.match(req);
    const fetchAndUpdate = fetch(req).then(async (res) => {
      try {
        const copy = res.clone();
        const cache = await caches.open(CACHE);
        cache.put(req, copy);
      } catch {}
      return res;
    }).catch(() => cached);
    return cached || fetchAndUpdate;
  })());
});
