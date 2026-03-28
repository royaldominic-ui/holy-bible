// ══════════════════════════════════════════════════════
//  Holy Bible PWA — Enhanced Service Worker v2
//  Powered by Cybernate247
//  Features: Offline, Push Notifications, Background Sync
// ══════════════════════════════════════════════════════

const CACHE_NAME = 'holy-bible-v2';

const CACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-180.png',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Crimson+Text:ital,wght@0,400;0,600;1,400;1,600&family=Cinzel:wght@400;600;700&family=Lora:ital,wght@0,400;0,600;1,400&display=swap'
];

const DAILY_VERSES = [
  {text:"For God so loved the world, that he gave his only begotten Son", ref:"John 3:16"},
  {text:"I can do all things through Christ which strengtheneth me", ref:"Philippians 4:13"},
  {text:"The Lord is my shepherd; I shall not want", ref:"Psalm 23:1"},
  {text:"Trust in the LORD with all thine heart", ref:"Proverbs 3:5"},
  {text:"Be strong and courageous. Do not be afraid", ref:"Joshua 1:9"},
  {text:"The LORD bless thee, and keep thee", ref:"Numbers 6:24"},
  {text:"Thy word is a lamp unto my feet, and a light unto my path", ref:"Psalm 119:105"},
  {text:"Come unto me, all ye that labour and are heavy laden", ref:"Matthew 11:28"},
  {text:"Fear thou not; for I am with thee", ref:"Isaiah 41:10"},
  {text:"And we know that all things work together for good", ref:"Romans 8:28"},
  {text:"The joy of the LORD is your strength", ref:"Nehemiah 8:10"},
  {text:"Cast all your anxiety on him because he cares for you", ref:"1 Peter 5:7"},
  {text:"Be still, and know that I am God", ref:"Psalm 46:10"},
  {text:"Love is patient, love is kind", ref:"1 Corinthians 13:4"},
];

function getDailyVerse() {
  const d = new Date();
  const idx = (d.getFullYear() * 366 + d.getMonth() * 31 + d.getDate()) % DAILY_VERSES.length;
  return DAILY_VERSES[idx];
}

// ── Install ───────────────────────────────────────────
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return Promise.allSettled(
        CACHE_URLS.map(function(url) {
          return cache.add(url).catch(function() {
            console.log('[SW] Could not cache:', url);
          });
        })
      );
    }).then(function() {
      return self.skipWaiting();
    })
  );
});

// ── Activate ──────────────────────────────────────────
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(name) {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// ── Fetch ─────────────────────────────────────────────
self.addEventListener('fetch', function(event) {
  const url = event.request.url;

  // Bible API + audio — network first, cache fallback
  if (url.includes('bible-api.com') || url.includes('audio.esv.org')) {
    event.respondWith(
      fetch(event.request)
        .then(function(response) {
          if (response && response.status === 200) {
            const cloned = response.clone();
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(event.request, cloned);
            });
          }
          return response;
        })
        .catch(function() {
          return caches.match(event.request).then(function(cached) {
            if (cached) return cached;
            return new Response(
              JSON.stringify({ error: 'You are offline. Previously read chapters are available.' }),
              { headers: { 'Content-Type': 'application/json' } }
            );
          });
        })
    );
    return;
  }

  // Google Fonts — network first, cache fallback
  if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
    event.respondWith(
      fetch(event.request)
        .then(function(response) {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, cloned);
          });
          return response;
        })
        .catch(function() {
          return caches.match(event.request);
        })
    );
    return;
  }

  // App shell — cache first, network fallback
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) return cached;
      return fetch(event.request).then(function(response) {
        if (response && response.status === 200) {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, cloned);
          });
        }
        return response;
      });
    })
  );
});

// ── Push Notifications ────────────────────────────────
self.addEventListener('push', function(event) {
  let data = { title: '✝️ Holy Bible', body: 'Your daily verse is ready!' };

  if (event.data) {
    try { data = event.data.json(); } catch(e) { data.body = event.data.text(); }
  } else {
    const verse = getDailyVerse();
    data = {
      title: '✝️ Holy Bible — Verse of the Day',
      body: '"' + verse.text + '" — ' + verse.ref,
    };
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      tag: 'holy-bible-daily',
      requireInteraction: false,
      vibrate: [200, 100, 200],
      actions: [
        { action: 'open', title: '📖 Read Now' },
        { action: 'dismiss', title: 'Dismiss' }
      ]
    })
  );
});

// ── Notification Click ────────────────────────────────
self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  if (event.action === 'dismiss') return;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (let client of clientList) {
        if (client.url.includes('holy-bible') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('./');
      }
    })
  );
});

// ── Background Sync ───────────────────────────────────
self.addEventListener('sync', function(event) {
  if (event.tag === 'daily-verse-sync') {
    event.waitUntil(
      self.registration.showNotification('✝️ Holy Bible — Good Morning!', {
        body: (function() {
          const v = getDailyVerse();
          return '"' + v.text + '" — ' + v.ref;
        })(),
        icon: './icons/icon-192.png',
        badge: './icons/icon-192.png',
        tag: 'holy-bible-daily',
        vibrate: [200, 100, 200],
      })
    );
  }
});

// ── Periodic Background Sync ──────────────────────────
self.addEventListener('periodicsync', function(event) {
  if (event.tag === 'daily-verse') {
    event.waitUntil(
      self.registration.showNotification('✝️ Verse of the Day', {
        body: (function() {
          const v = getDailyVerse();
          return '"' + v.text + '" — ' + v.ref;
        })(),
        icon: './icons/icon-192.png',
        badge: './icons/icon-192.png',
        tag: 'holy-bible-daily',
      })
    );
  }
});
