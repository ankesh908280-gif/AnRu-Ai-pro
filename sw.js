// sw.js - Service Worker for Offline PWA Support
const CACHE_NAME = 'jarvis-ai-v3.0';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './audio_sfx.js',
    './visualizer.js',
    './brain.js',
    './speech.js',
    './app.js',
    './manifest.json',
    './favicon.png',
    './icon-192.png',
    './icon-512.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        }).then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    
    // Always pass external AI & API calls directly to live network
    const url = event.request.url;
    if (url.includes('puter.com') ||
        url.includes('wikipedia.org') ||
        url.includes('googleapis.com') ||
        url.includes('pollinations.ai')) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                fetch(event.request).then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, networkResponse);
                        });
                    }
                }).catch(() => {});
                return cachedResponse;
            }

            return fetch(event.request).catch(() => {
                if (event.request.mode === 'navigate') {
                    return caches.match('./index.html');
                }
            });
        })
    );
});
