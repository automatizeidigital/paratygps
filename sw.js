const CACHE = 'paratygps-shell-v9';
const SHELL = ['./', './index.html', './login.html', './access.html', './admin.html', './access.js', './admin.js', './access.css', './login.css', './login.js', './auth-config.js', './auth-core.js', './app-auth.js', './app.js', './vendor/supabase-2.117.2.js', './leaflet.css', './leaflet.js', './route.js', './history.js', './nautical.js', './map-display.js', './charts/1633/manifest.json', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('paratygps-shell-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (u.origin !== self.location.origin || e.request.method !== 'GET') return;
  if (e.request.mode === 'navigate') {
    const name = u.pathname.split('/').pop();
    const page = ['login.html', 'access.html', 'admin.html'].includes(name) ? './' + name : './index.html';
    e.respondWith(fetch(e.request).catch(() => caches.open(CACHE).then(c => c.match(page))));
    return;
  }
  e.respondWith(caches.match(e.request).then(v => v || fetch(e.request)));
});
