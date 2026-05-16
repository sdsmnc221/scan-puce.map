// Fichier : public/sw.js

// Nom du cache
const CACHE_NAME = "scan-puce-cache-v1";

// Liste des ressources à mettre en cache
const urlsToCache = [
  "/",
  "/index.html",
  "/favicon/manifest.json",
  "/favicon/android-chrome-192x192.png",
  "/favicon/android-chrome-512x512.png",
  // Ajoutez vos autres ressources importantes (CSS, JS, images) ici
];

// Installation du service worker
self.addEventListener("install", (event) => {
  self.skipWaiting(); // activate immediately without waiting for old SW to die
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("Cache ouvert");
      return cache.addAll(urlsToCache);
    })
  );
});

// Stratégie de cache : Network First avec fallback sur le cache
// Les routes /api/ sont toujours récupérées depuis le réseau, jamais mises en cache
self.addEventListener("fetch", (event) => {
  if (event.request.url.includes("/api/")) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Mise en cache de la nouvelle réponse
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Si la requête réseau échoue, utiliser le cache
        return caches.match(event.request);
      })
  );
});

// Nettoyage des anciens caches lors de l'activation
self.addEventListener("activate", (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    clients.claim().then(() => // take control of all open pages immediately
      caches.keys().then((cacheNames) =>
        Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheWhitelist.indexOf(cacheName) === -1) {
              return caches.delete(cacheName);
            }
          })
        )
      )
    )
  );
});
