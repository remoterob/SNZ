self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', async () => {
  const keys = await caches.keys()
  await Promise.all(keys.map(k => caches.delete(k)))
  await self.clients.claim()
  const clients = await self.clients.matchAll({ type: 'window' })
  await self.registration.unregister()
  for (const client of clients) {
    try { client.navigate(client.url) } catch {}
  }
})
