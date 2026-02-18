/* global clients */
const CACHE_NAME = 'posture-guard-v2';
const STATIC_CACHE = 'posture-guard-static-v2';
const DYNAMIC_CACHE = 'posture-guard-dynamic-v2';
const OFFLINE_FALLBACK = '/index.html';
const MAX_DYNAMIC_CACHE_ENTRIES = 40;
const SW_DEBUG = self.registration?.scope?.includes('localhost') || self.location?.hostname === 'localhost';

const SW_METRICS = {
  staticHits: 0,
  dynamicHits: 0,
  networkMisses: 0,
  fallbackHits: 0,
};

const cacheResult = (event, payload) => {
  if (!SW_DEBUG) return;
  console.debug(`[SW][${event}] ${payload}`);
};

const summarizeRequest = (request) => {
  const url = new URL(request.url);
  return `${request.method} ${url.origin}${url.pathname}`;
};

const track = (request, event) => {
  const entry = `${event}: ${summarizeRequest(request)}`;
  cacheResult(event, entry);
};

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

const MEDIAPIPE_URLS = [
  'cdn.jsdelivr.net',
  'storage.googleapis.com',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        cacheResult('install', 'Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .catch((err) => {
        console.warn('[SW] Static cache failed:', err);
      })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  const currentCaches = [STATIC_CACHE, DYNAMIC_CACHE];

  event.waitUntil(
    caches.keys().then((cacheNames) => Promise.all(
      cacheNames.map((cacheName) => {
        if (!currentCaches.includes(cacheName)) {
          console.log('[SW] Deleting old cache:', cacheName);
          return caches.delete(cacheName);
        }
        return Promise.resolve();
      })
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (MEDIAPIPE_URLS.some((domain) => url.hostname.includes(domain))) {
    event.respondWith(networkFirstWithCache(request, DYNAMIC_CACHE));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirstWithNetwork(request));
    return;
  }

  event.respondWith(networkFirst(request));
});

async function cacheFirstWithNetwork(request) {
  const cached = await caches.match(request);
  if (cached) {
    SW_METRICS.staticHits += 1;
    track(request, 'cache.hit');
    return cached;
  }

  try {
    SW_METRICS.networkMisses += 1;
    track(request, 'network.fetch');
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    if (request.mode === 'navigate' || request.destination === 'document') {
      SW_METRICS.fallbackHits += 1;
      track(request, 'offline.fallback');
      return caches.match(OFFLINE_FALLBACK);
    }
    track(request, `fetch.error:${error.message}`);
    throw error;
  }
}

async function networkFirstWithCache(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
      await trimCache(cacheName, MAX_DYNAMIC_CACHE_ENTRIES);
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      SW_METRICS.dynamicHits += 1;
      track(request, 'cache.hit');
      return cached;
    }
    if (request.mode === 'navigate') {
      SW_METRICS.fallbackHits += 1;
      track(request, 'offline.fallback');
      return caches.match(OFFLINE_FALLBACK);
    }
    track(request, `network.error:${error.message}`);
    throw error;
  }
}

async function networkFirst(request) {
  try {
    return await fetch(request);
  } catch (error) {
    const cached = await caches.match(request);
    if (cached) {
      SW_METRICS.dynamicHits += 1;
      track(request, 'cache.hit');
      return cached;
    }
    if (request.mode === 'navigate') {
      SW_METRICS.fallbackHits += 1;
      track(request, 'offline.fallback');
      return caches.match(OFFLINE_FALLBACK);
    }
    track(request, `network.error:${error.message}`);
    throw error;
  }
}

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) {
    return;
  }

  const removeCount = keys.length - maxEntries;
  const staleKeys = keys.slice(0, removeCount);
  if (staleKeys.length > 0) {
    console.debug('[SW] Trimming cache entries:', removeCount);
    await Promise.all(staleKeys.map((key) => cache.delete(key)));
  }
}

self.addEventListener('push', (event) => {
  const options = {
    body: 'Posture reminder: time to check your posture.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    tag: 'posture-reminder',
  };

  event.waitUntil(
    self.registration.showNotification('Posture Reminder', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/')
  );
});


