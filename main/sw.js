// Bump on every deploy that changes anything this worker serves. A changed
// worker file is what makes the browser install it and show the update bar.
const CACHE = "stage-connect-v5";

const ASSETS = [
  "/",
  "/index.html",
  "/css/theme.css",
  "/style.css",
  "/js/icons.js",
  "/js/ui.js",
  "/js/theme.js",
  "/js/sw-update.js",
  "/script.js",
  "/SCL-main.png",
  "/favicon.ico",
  "/manifest.json"
];

// No skipWaiting here and no clients.claim in activate: a new worker waits
// until somebody presses Reload in the update bar.
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))
      )
    )
  );
});

self.addEventListener("message", (event) => {
  const type = typeof event.data === "string" ? event.data : event.data?.type;

  // The only place either of these is ever called.
  if (type === "skip-waiting") {
    event.waitUntil(self.skipWaiting().then(() => self.clients.claim()));
  }
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetched = fetch(event.request).then((response) => {
        const clone = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, clone));
        return response;
      }).catch(() => cached);
      return cached || fetched;
    })
  );
});
