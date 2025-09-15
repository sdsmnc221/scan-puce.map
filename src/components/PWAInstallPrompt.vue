<template>
  <Transition name="slide-up">
    <div
      v-if="shouldShowPrompt"
      class="pwa-prompt fixed top-4 left-1/2 transform -translate-x-1/2 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 flex items-center space-x-4"
    >
      <div class="flex min-w-[72vw] items-center space-x-4">
        <div class="flex-1">
          <h3 class="font-semibold text-gray-900 dark:text-white">
            Installer l'application
          </h3>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            Accédez rapidement à Scan Puce depuis votre appareil
          </p>
        </div>
        <div class="flex flex-col gap-2">
          <button
            @click="handleClose"
            class="px-3 py-2 text-gray-600 border hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg transition-colors"
          >
            Fermer
          </button>
          <button
            @click="handleInstall"
            class="px-4 py-2 bg-yellow-500 hover:bg-amber-400 text-black rounded-lg transition-colors"
          >
            Installer
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from "vue";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const props = withDefaults(
  defineProps<{
    isPrompted: boolean;
    prompt: BeforeInstallPromptEvent | null;
  }>(),
  {
    isPrompted: false,
  }
);

const emits = defineEmits(["onCheckPWA", "installed", "dismissed"]);

const supportsPWA = ref(false);
const deferredPrompt = computed(() => props.prompt);
const isInstalled = ref(false);
const promptDismissed = ref(localStorage.getItem("pwaPromptState") === "true");

// Computed property to determine if we should show the prompt
const shouldShowPrompt = computed(() => {
  console.log(
    props.isPrompted,
    supportsPWA.value,
    deferredPrompt.value,
    isInstalled.value,
    promptDismissed.value
  );
  return props.isPrompted && supportsPWA.value && !isInstalled.value;
});

const checkPWASupport = () => {
  // Check if the browser supports service workers
  const supportsServiceWorker = "serviceWorker" in navigator;

  // Check if the app is not already installed
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone ||
    document.referrer.includes("android-app://");

  // Check if it's running on HTTPS (required for PWAs)
  const isHttps =
    window.location.protocol === "https:" ||
    window.location.hostname === "localhost";

  // Add manifest check
  const hasManifest = !!document.querySelector('link[rel="manifest"]');

  supportsPWA.value =
    supportsServiceWorker && !isStandalone && isHttps && hasManifest;

  console.log("PWA Support Check:", {
    supportsServiceWorker,
    isStandalone,
    isHttps,
    hasManifest,
    deferredPrompt: deferredPrompt.value !== null,
  });

  emits("onCheckPWA", { supportsPWA: supportsPWA.value });
};

const checkInstalled = () => {
  isInstalled.value = window.matchMedia("(display-mode: standalone)").matches;
  if (isInstalled.value) {
    console.log("App is already installed");
  }
};

const handleBeforeInstallPrompt = (e: Event) => {
  // Important: Prevent default to stop Chrome 76+ from automatically showing the prompt
  e.preventDefault();

  // Store the event for later use

  console.log("Capture d'événement beforeinstallprompt réussie");

  // Let the parent component know we can install
  supportsPWA.value = true;
  emits("onCheckPWA", { supportsPWA: supportsPWA.value });
};

const handleInstall = async () => {
  if (isInstalled.value) {
    alert("L'application a été installée sur votre appareil");
  }

  // if (!deferredPrompt.value) {
  //   console.error(
  //     "Installation impossible - pas d'événement prompt disponible"
  //   );
  //   alert(
  //     "Installation impossible. Veuillez utiliser l'option 'Ajouter à l'écran d'accueil' dans le menu de votre navigateur."
  //   );
  //   return;
  // }

  try {
    console.log("Déclenchement du prompt d'installation...");

    console.log({ deferredPrompt: deferredPrompt.value?.prompt });
    // Trigger the installation prompt
    await deferredPrompt.value?.prompt();

    // Wait for the user's choice
    const choiceResult = (await deferredPrompt.value?.userChoice) || {
      outcome: "",
    };
    console.log("Résultat du choix:", choiceResult.outcome);

    if (choiceResult.outcome === "accepted") {
      console.log("Utilisateur a accepté l'installation");
      //isInstalled.value = true;
      emits("installed");
    } else {
      console.log("Utilisateur a refusé l'installation");
      emits("dismissed");
    }
  } catch (error) {
    console.error("Erreur lors de l'installation:", error);
    alert(`Erreur lors de l'installation: ${JSON.stringify(error)}`);
  } finally {
    // Clear the deferred prompt variable since it can't be used again

    // Save state to localStorage to avoid showing prompt again
    localStorage.setItem("pwaPromptState", "true");
    promptDismissed.value = true;
  }
};

const handleClose = () => {
  console.log("Prompt d'installation fermé par l'utilisateur");
  localStorage.setItem("pwaPromptState", "true");
  promptDismissed.value = true;
  emits("dismissed");
};

// Add listener for app install
const handleAppInstalled = () => {
  console.log("Application installée avec succès");
  isInstalled.value = true;

  emits("installed");
};

// Add listener for display mode changes
const handleDisplayModeChange = (e: MediaQueryListEvent) => {
  isInstalled.value = e.matches;
  console.log("Mode d'affichage changé:", e.matches ? "standalone" : "browser");
};

onMounted(() => {
  // Add listeners
  window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

  window.addEventListener("appinstalled", handleAppInstalled);

  const mediaQuery = window.matchMedia("(display-mode: standalone)");
  mediaQuery.addEventListener("change", handleDisplayModeChange);

  // Initial checks
  checkPWASupport();
  checkInstalled();

  console.log(
    "Composant PWA Install monté, en attente d'événement beforeinstallprompt"
  );
});

onUnmounted(() => {
  // Remove listeners
  window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  window.removeEventListener("appinstalled", handleAppInstalled);

  const mediaQuery = window.matchMedia("(display-mode: standalone)");
  mediaQuery.removeEventListener("change", handleDisplayModeChange);
});
</script>

<style scoped>
.pwa-prompt {
  z-index: 100;
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s ease-out;
}

.slide-up-enter-from {
  transform: translateY(100%) translateX(-50%);
  opacity: 0;
}

.slide-up-leave-to {
  transform: translateY(100%) translateX(-50%);
  opacity: 0;
}
</style>
