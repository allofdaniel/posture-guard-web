/* global clients */
const CACHE_NAME = 'posture-guard-v2';
const STATIC_CACHE = 'posture-guard-static-v2';
const DYNAMIC_CACHE = 'posture-guard-dynamic-v2';

// 정적 리소스 (앱 셸)
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg'
];

// MediaPipe 리소스 (네트워크 우선, 캐시 폴백)
const MEDIAPIPE_URLS = [
  'cdn.jsdelivr.net',
  'storage.googleapis.com'
];

// Install event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .catch((err) => {
        console.warn('[SW] Static cache failed:', err);
      })
  );
  self.skipWaiting();
});

// Activate event - 이전 캐시 정리
self.addEventListener('activate', (event) => {
  const currentCaches = [STATIC_CACHE, DYNAMIC_CACHE];

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!currentCaches.includes(cacheName)) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - 전략별 캐싱
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // MediaPipe 리소스: 네트워크 우선, 캐시 폴백
  if (MEDIAPIPE_URLS.some(domain => url.hostname.includes(domain))) {
    event.respondWith(networkFirstWithCache(request, DYNAMIC_CACHE));
    return;
  }

  // 같은 오리진의 정적 리소스: 캐시 우선, 네트워크 폴백
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirstWithNetwork(request));
    return;
  }

  // 기타: 네트워크 우선
  event.respondWith(networkFirst(request));
});

// 캐시 우선, 네트워크 폴백
async function cacheFirstWithNetwork(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    // 오프라인 폴백
    if (request.destination === 'document') {
      return caches.match('/index.html');
    }
    throw error;
  }
}

// 네트워크 우선, 캐시 폴백
async function networkFirstWithCache(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    throw error;
  }
}

// 네트워크 우선
async function networkFirst(request) {
  try {
    return await fetch(request);
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    throw error;
  }
}

// 푸시 알림 (향후 확장용)
self.addEventListener('push', (event) => {
  const options = {
    body: '자세를 확인해주세요!',
    icon: '/icon.svg',
    badge: '/icon.svg',
    vibrate: [200, 100, 200],
    tag: 'posture-reminder'
  };

  event.waitUntil(
    self.registration.showNotification('자세 교정 알리미', options)
  );
});

// 알림 클릭
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/')
  );
});
