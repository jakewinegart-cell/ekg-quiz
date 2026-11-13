const C = 'ekg-quiz-v1';
const FILES = ['./', 'index.html', 'style.css', 'synth.js', 'rhythms.js', 'app.js', 'icon.svg', 'manifest.webmanifest'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(C).then((c) => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== C).map((k) => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', (e) => { e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request))); });
