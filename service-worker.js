// coroom 서비스워커 — 앱 셸(HTML/CSS/JS/아이콘)을 캐싱해서
// 오프라인일 때도 마지막으로 본 화면이 그대로 뜨도록 한다.
// Supabase API 요청은 캐싱하지 않고 항상 네트워크로 보낸다.

const CACHE_NAME = 'coroom-cache-v1';

const APP_SHELL = [
  '/',
  '/index.html',
  '/reservations.html',
  '/manifest.webmanifest',
  '/css/style.css',
  '/js/supabaseClient.js',
  '/js/utils.js',
  '/js/dashboard.js',
  '/js/reservations.js',
  '/js/pwa.js',
  '/icons/coroom-favicon-32.png',
  '/icons/coroom-favicon-192.png',
  '/icons/coroom-icon-180.png',
  '/icons/coroom-icon-512.png',
  '/icons/coroom-icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

function isSameOrigin(url) {
  return new URL(url).origin === self.location.origin;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET' || !isSameOrigin(request.url)) {
    return; // 다른 출처(Supabase API 등)는 캐싱하지 않고 네트워크로 그대로 보낸다.
  }

  if (request.mode === 'navigate') {
    // 페이지 이동: 온라인이면 최신 페이지, 오프라인이면 캐시된 마지막 화면을 보여준다.
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/index.html'))),
    );
    return;
  }

  // 정적 자산: 캐시를 우선 사용하고, 백그라운드에서 최신 버전으로 갱신한다.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});
