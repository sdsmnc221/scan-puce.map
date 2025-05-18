// Service Worker optimisé

// Nom du cache
const CACHE_NAME = "scan-puce-cache-v1";

// Liste des ressources à mettre en cache immédiatement
const CORE_ASSETS = [
  "/",
  "/index.html",
  "/favicon/site.webmanifest",
  "/favicon/android-chrome-192x192.png",
  "/favicon/android-chrome-512x512.png",
  // Ajoutez vos CSS/JS principaux
];

// Installation du service worker
self.addEventListener("install", (event) => {
  console.log("🔧 Service Worker en cours d'installation...");

  // Force l'activation immédiate sans attendre la fermeture des onglets
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("📦 Mise en cache des ressources principales");
      return cache.addAll(CORE_ASSETS);
    })
  );
});

// Activation du service worker
self.addEventListener("activate", (event) => {
  console.log("🚀 Service Worker activé!");

  // Prendre le contrôle immédiatement de toutes les pages
  event.waitUntil(clients.claim());

  // Supprimer les anciens caches
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log("🗑️ Suppression de l'ancien cache:", cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Interception des requêtes réseau
self.addEventListener("fetch", (event) => {
  // Ignorer les requêtes non GET
  if (event.request.method !== "GET") return;

  // Ignorer les requêtes vers d'autres domaines
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;

  // Stratégie: Cache First, puis réseau avec mise à jour du cache
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Si trouvé dans le cache, utiliser la version en cache
      if (cachedResponse) {
        // En parallèle, mettre à jour le cache (sans bloquer)
        fetch(event.request)
          .then((response) => {
            // Vérifier que la réponse est valide
            if (response && response.status === 200) {
              const responseToCache = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseToCache);
              });
            }
          })
          .catch(() => {
            // Erreur de fetch, on ne fait rien
          });

        return cachedResponse;
      }

      // Si pas dans le cache, essayer le réseau
      return fetch(event.request)
        .then((response) => {
          // Si la réponse n'est pas valide, retourner une erreur
          if (!response || response.status !== 200) {
            return response;
          }

          // Mettre en cache la nouvelle réponse
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return response;
        })
        .catch(() => {
          // En cas d'erreur réseau, renvoyer une page hors-ligne si c'est une page HTML
          if (event.request.headers.get("accept").includes("text/html")) {
            return caches.match("/offline.html");
          }

          // Sinon échec
          return new Response("Ressource non disponible hors ligne", {
            status: 503,
            statusText: "Service Unavailable",
          });
        });
    })
  );
});

// Messagerie avec la page principale
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Log pour confirmer que le SW est bien chargé
console.log("📱 Service Worker chargé!");
