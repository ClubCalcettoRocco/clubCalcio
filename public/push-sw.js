/* Gestione delle notifiche Web Push nel service worker PWA generato da Workbox. */
self.addEventListener('push', event => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = { body: event.data?.text() || '' }
  }

  const title = payload.title || 'Calcetto Club'
  const options = {
    body: payload.body || 'Hai un nuovo aggiornamento.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: payload.tag || 'calcetto-club',
    data: { url: payload.url || '/' }
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    for (const client of windows) {
      if (new URL(client.url).origin !== self.location.origin) continue
      if ('navigate' in client) await client.navigate(target)
      return client.focus()
    }
    return self.clients.openWindow(target)
  })())
})
