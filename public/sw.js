// SNZ Hub Service Worker v3
const CACHE_NAME = 'snz-hub-v3'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // Wipe all old caches
    const keys = await caches.keys()
    await Promise.all(keys.map(k => caches.delete(k)))
    // Take control of all open tabs
    await self.clients.claim()
    // Force every open window to reload so they escape the old broken SW
    const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' })
    for (const client of clients) {
      try { client.navigate(client.url) } catch {}
    }
  })())
})

// Pass-through fetch — no caching, no undefined-response bug
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return
  if (event.request.url.includes('supabase.co')) return
  if (event.request.url.includes('stripe.com')) return
  if (event.request.url.includes('.netlify/functions')) return
  event.respondWith(fetch(event.request).catch(() => Response.error()))
})
