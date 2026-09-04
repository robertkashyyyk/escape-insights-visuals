/* Escape Grids service worker — owner-side push notifications.
 * Reusable infrastructure: handles `push` (show the notification) and
 * `notificationclick` (focus an existing tab and deep-link, else open a new one).
 * No fetch/caching here on purpose — this is push only, not offline. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) { data = {}; }
  const title = data.title || "New booking";
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    // tag = booking id so repeated pushes for one booking collapse rather than stack
    tag: data.tag || undefined,
    data: { url: data.url || "/owner" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/owner";
  event.waitUntil((async () => {
    const clientsList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of clientsList) {
      // Focus the first app window and deep-link it to the booking.
      try {
        await client.focus();
        if ("navigate" in client) await client.navigate(url);
        return;
      } catch (_) { /* fall through to open a new window */ }
    }
    if (self.clients.openWindow) await self.clients.openWindow(url);
  })());
});
