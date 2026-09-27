// PflegeBox — Service Worker (Network-First für die eigene App-Shell, Cache nur als Offline-Fallback;
// AERIS-Muster). Die Version kommt als Query-Parameter aus <meta name="app-version"> (js/update.js):
// neue Version ⇒ neue SW-URL ⇒ neuer Cache; alte Caches werden im activate-Event entfernt.
// @ts-check
'use strict';

const sw = /** @type {ServiceWorkerGlobalScope} */ (/** @type {unknown} */ (self));

const VERSION = new URL(sw.location.href).searchParams.get('v') || 'dev';
const CACHE = 'pflegebox-' + VERSION;
const APP_SHELL = [
  './',
  './index.html',
  './app.css',
  './manifest.json',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './js/app.js',
  './js/bestellung-pdf.js',
  './js/crypto.js',
  './js/csv.js',
  './js/dialoge.js',
  './js/einstellungen.js',
  './js/gate.js',
  './js/model.js',
  './js/pdf.js',
  './js/signatur.js',
  './js/store.js',
  './js/tabelle.js',
  './js/teilen.js',
  './js/update.js'
];

sw.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(APP_SHELL.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => sw.skipWaiting())
  );
});

sw.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('pflegebox-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => sw.clients.claim())
  );
});

sw.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== sw.location.origin) return;
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && res.type === 'basic' && !new URL(req.url).search) {
          const kopie = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, kopie));
        }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true })
        .then((treffer) => treffer || (req.mode === 'navigate' ? caches.match('./index.html') : undefined))
        .then((antwort) => antwort || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })))
  );
});
