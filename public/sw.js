// Service worker de BKLN Marketplace. Por ahora solo notificaciones push (ARQUITECTURA §5.3);
// la caché sin conexión y la app instalable llegan en la fase 2.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }
  const url = data.url || "/mensajes";

  event.waitUntil(
    (async () => {
      // Si ya estás viendo esa conversación, no hace falta avisar.
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const viewing = windows.some(
        (client) => client.focused && new URL(client.url).pathname === url,
      );
      if (viewing) return;

      await self.registration.showNotification(data.title || "BKLN Marketplace", {
        body: data.body || "",
        icon: "/icons/icon-192.png",
        badge: "/icons/badge-96.png",
        tag: data.tag,
        renotify: Boolean(data.tag),
        data: { url },
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/mensajes";

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin) {
          await client.focus();
          if ("navigate" in client) await client.navigate(url);
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
