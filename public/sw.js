/* Docked web app v1. Only the public offline shell is cached. Never cache pages,
   API responses, authenticated RSC payloads, cards or member media. */
const CACHE = "docked-public-offline-fantasy-cleanup-v2";
const OFFLINE = "/brand/docked/offline.html";
self.addEventListener("install", (event) =>
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(OFFLINE))),
);
self.addEventListener("activate", (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key.startsWith("docked-public-offline-") && key !== CACHE,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  ),
);
self.addEventListener("message", (event) => {
  if (event.data?.type === "ACTIVATE_UPDATE") void self.skipWaiting();
});
self.addEventListener("fetch", (event) => {
  if (
    event.request.method !== "GET" ||
    event.request.mode !== "navigate" ||
    new URL(event.request.url).origin !== self.location.origin
  )
    return;
  event.respondWith(
    fetch(event.request).catch(
      async () => (await caches.match(OFFLINE)) || Response.error(),
    ),
  );
});

// Stable sale IDs suppress redelivery after a worker retry. Never cache receipts.
function rememberPush(id) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("docked-push-receipts", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("seen");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result,
        tx = db.transaction("seen", "readwrite"),
        store = tx.objectStore("seen"),
        check = store.get(id);
      let fresh = false;
      check.onsuccess = () => {
        if (!check.result) {
          fresh = true;
          store.put(Date.now(), id);
        }
      };
      tx.oncomplete = () => {
        db.close();
        resolve(fresh);
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    };
  });
}
self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      const data = event.data?.json();
      if (!data || typeof data.id !== "string" || typeof data.body !== "string")
        return;
      const href = new URL(data.href || "/notifications", self.location.origin);
      if (
        href.origin !== self.location.origin ||
        href.pathname !== "/fantasy/market"
      )
        return;
      if (!(await rememberPush(data.id))) return;
      await self.registration.showNotification("Card sold", {
        body: data.body,
        tag: `docked-sale-${data.id}`,
        renotify: false,
        data: { href: href.href },
      });
    })(),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const href = event.notification.data?.href || "/notifications";
  event.waitUntil(self.clients.openWindow(href));
});
