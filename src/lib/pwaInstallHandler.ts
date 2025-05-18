// Créez un nouveau fichier: src/pwaInstallHandler.js

// Variable globale pour stocker l'événement
let deferredPromptEvent: any = null;

// Flag indiquant si l'app est installable
let isAppInstallable = false;

// Écouteurs d'événements globaux
if (typeof window !== "undefined") {
  // Capturer l'événement beforeinstallprompt
  window.addEventListener("beforeinstallprompt", (e) => {
    // Empêcher l'affichage automatique du prompt
    e.preventDefault();

    // Stocker l'événement pour utilisation ultérieure
    console.log(e);
    deferredPromptEvent = e;
    isAppInstallable = true;

    console.log("✅ Événement beforeinstallprompt capturé au niveau global!");

    // Déclencher un événement personnalisé pour que les composants puissent réagir
    window.dispatchEvent(
      new CustomEvent("pwaInstallable", {
        detail: { installable: true },
      })
    );
  });

  // Écouter l'installation réussie
  window.addEventListener("appinstalled", () => {
    console.log("✅ Application installée avec succès!");
    deferredPromptEvent = null;
    isAppInstallable = false;

    // Déclencher un événement personnalisé
    window.dispatchEvent(new CustomEvent("pwaInstalled"));
  });
}

// Fonction pour vérifier si l'application est installable
export function isPWAInstallable() {
  return isAppInstallable && deferredPromptEvent !== null;
}

// Fonction pour déclencher l'installation
export async function promptPWAInstall() {
  if (!deferredPromptEvent) {
    console.error("Impossible d'installer: pas d'événement prompt disponible");
    return {
      outcome: "unavailable",
      error: "Pas d'événement d'installation disponible",
    };
  }

  try {
    // Déclencher le prompt
    await deferredPromptEvent.prompt();

    // Attendre le choix de l'utilisateur
    const choiceResult = await deferredPromptEvent.userChoice;

    // Réinitialiser l'événement (ne peut être utilisé qu'une fois)
    deferredPromptEvent = null;
    isAppInstallable = false;

    return {
      outcome: choiceResult.outcome,
    };
  } catch (error) {
    return {
      outcome: "error",
      error,
    };
  }
}

// Fonction pour vérifier si l'app est déjà installée
export function isPWAInstalled() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator && window.navigator.standalone === true)
  );
}
