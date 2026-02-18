self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Required guard for only-if-cached requests.
  if (request.cache === "only-if-cached" && request.mode !== "same-origin") {
    return;
  }

  event.respondWith(fetch(request));
});

self.addEventListener("push", (event) => {
  const defaultPayload = {
    title: "Smash Pong App",
    body: "Você tem uma pendência para confirmar.",
    url: "/partidas",
    icon: "/icon-512.png",
    badge: "/badge-72.png",
    tag: "pending-match",
    data: {},
  };

  let payload = defaultPayload;

  try {
    const incomingPayload = event.data ? event.data.json() : {};
    payload = {
      ...defaultPayload,
      ...(incomingPayload || {}),
      data: {
        ...defaultPayload.data,
        ...(incomingPayload?.data || {}),
      },
    };
  } catch {
    // fallback para payload padrão
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon,
      badge: payload.badge,
      tag: payload.tag,
      data: {
        url: payload.url,
        ...(payload.data || {}),
      },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification?.data?.url || "/partidas";
  const absoluteUrl = new URL(targetUrl, self.location.origin).toString();

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url === absoluteUrl && "focus" in client) {
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(absoluteUrl);
      }

      return undefined;
    })
  );
});
