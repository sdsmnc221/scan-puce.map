// Fichier : src/registerServiceWorker.js

export function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log(
            "Service Worker enregistré avec succès:",
            registration.scope
          );
        })
        .catch((error) => {
          console.error("Échec de l'enregistrement du Service Worker:", error);
        });
    });
  } else {
    console.warn(
      "Les Service Workers ne sont pas pris en charge par ce navigateur"
    );
  }
}

// Vérifier si la PWA est installable (à utiliser dans votre composant App)
export function checkPWAInstallable(callback: any) {
  let deferredPrompt: any | null = null;

  // Écouteur pour l'événement beforeinstallprompt
  window.addEventListener("beforeinstallprompt", (e) => {
    // Empêcher Chrome d'afficher automatiquement le prompt
    e.preventDefault();

    // Stocker l'événement pour l'utiliser plus tard
    deferredPrompt = e;

    // Informer l'appelant que l'app est installable
    if (callback) callback(true);

    console.log("L'application est installable");
  });

  // Fonction pour déclencher le prompt d'installation
  const promptInstall = async () => {
    if (!deferredPrompt) {
      console.log("Aucun événement d'installation disponible");
      return false;
    }

    // Afficher le prompt d'installation
    deferredPrompt.prompt();

    // Attendre la réponse de l'utilisateur
    const choiceResult = await deferredPrompt.userChoice;

    // Réinitialiser l'événement
    deferredPrompt = null;

    // Renvoyer true si l'utilisateur a accepté
    return choiceResult.outcome === "accepted";
  };

  // Vérifier si l'app est déjà installée
  const isAppInstalled = () => {
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true
    );
  };

  return {
    promptInstall,
    isAppInstalled,
  };
}
