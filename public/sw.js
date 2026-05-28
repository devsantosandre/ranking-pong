const SYNC_DB_NAME = "rankingpong-sync";
const SYNC_DB_VERSION = 1;
const SYNC_STORE = "pending-matches";
const REGISTER_MATCH_SYNC_TAG = "register-match";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

function openSyncDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SYNC_DB_NAME, SYNC_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SYNC_STORE)) {
        db.createObjectStore(SYNC_STORE, { keyPath: "requestId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function runSyncTx(mode, fn) {
  return openSyncDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(SYNC_STORE, mode);
        const store = tx.objectStore(SYNC_STORE);
        const request = fn(store);
        request.onsuccess = () => {
          resolve(request.result);
          db.close();
        };
        request.onerror = () => {
          reject(request.error);
          db.close();
        };
      })
  );
}

function getAllPending() {
  return runSyncTx("readonly", (store) => store.getAll());
}

function deletePending(requestId) {
  return runSyncTx("readwrite", (store) => store.delete(requestId));
}

async function flushPendingMatches() {
  let pending = [];
  try {
    pending = await getAllPending();
  } catch (error) {
    console.error("sw_sync_read_failed", error);
    return;
  }

  for (const payload of pending) {
    try {
      const response = await fetch("/api/matches/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          playerId: payload.playerId,
          opponentId: payload.opponentId,
          outcome: payload.outcome,
          requestId: payload.requestId,
        }),
      });

      if (response.ok) {
        await deletePending(payload.requestId);
        continue;
      }

      // 4xx: erro de negócio — não adianta retentar
      if (response.status >= 400 && response.status < 500) {
        await deletePending(payload.requestId);
        continue;
      }

      // 5xx: deixa na fila — browser tentará novamente depois
      throw new Error(`server_error_${response.status}`);
    } catch (error) {
      // Erro de rede ou 5xx: propaga para que o sync seja retentado
      throw error;
    }
  }
}

self.addEventListener("sync", (event) => {
  if (event.tag === REGISTER_MATCH_SYNC_TAG) {
    event.waitUntil(flushPendingMatches());
  }
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "flush-pending-matches") {
    event.waitUntil(flushPendingMatches().catch(() => undefined));
  }
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
