import { createApp } from "vue";
import "./assets/index.css";
import App from "./App.vue";
import "./registerServiceWorker";

// IMPORTANT: Ajoutez ce code AVANT la création de l'application Vue
// Capture précoce de l'événement beforeinstallprompt
let deferredPrompt = null;

if (typeof window !== "undefined") {
  console.log("aa");
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

window.addEventListener("beforeinstallprompt", (e) => {
  console.log(e);

  // Empêcher Chrome d'afficher automatiquement le prompt
  e.preventDefault();

  // Stocker l'événement pour l'utiliser plus tard
  deferredPrompt = e;

  console.log(
    "🔵 Événement beforeinstallprompt capturé AVANT initialisation de Vue!"
  );
});

// Rendre l'événement deferredPrompt disponible globalement
// (uniquement pour le débogage)
window.deferredPromptDebug = deferredPrompt;

createApp(App).mount("#app");

// Facultatif: enregistrez le service worker
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
}
