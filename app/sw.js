/* Primeiro Milhão — service worker: abre o app sem internet.
   Mude VERSAO a cada publicação para os aparelhos pegarem a versão nova. */
const VERSAO = 'pm-v3';
const ARQUIVOS = ['./', './index.html', './manifest.webmanifest', './fonts/montserrat-latin.woff2', './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSAO).then(c => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSAO).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Planilha (Apps Script) e cotações nunca passam pelo cache.
  if (url.hostname.endsWith('script.google.com') || url.hostname.endsWith('googleusercontent.com')) return;
  // Fontes do Google: guarda na primeira vez para funcionar offline depois.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(VERSAO).then(c => c.match(req).then(h => h || fetch(req).then(r => { c.put(req, r.clone()); return r; }).catch(() => h))));
    return;
  }
  if (url.origin !== location.origin) return;
  // Páginas: rede primeiro (pega atualização), cache se estiver offline.
  e.respondWith(fetch(req).then(r => { const cp = r.clone(); caches.open(VERSAO).then(c => c.put(req, cp)); return r; }).catch(() => caches.match(req).then(h => h || caches.match('./index.html'))));
});
