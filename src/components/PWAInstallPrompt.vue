// Modifiez votre composant PWAInstallPrompt.vue pour utiliser le gestionnaire
global

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
import { ref, onMounted, onUnmounted, computed, watch } from "vue";
import {
  isPWAInstallable,
  promptPWAInstall,
  isPWAInstalled,
} from "../lib/pwaInstallHandler";

const props = withDefaults(defineProps<{ isPrompted: boolean }>(), {
  isPrompted: false,
});

const emits = defineEmits(["onCheckPWA", "installed", "dismissed"]);

const installable = isPWAInstallable();
const supportsPWA = ref(installable);
const isInstalled = ref(isPWAInstalled());
const promptDismissed = ref(localStorage.getItem("pwaPromptState") === "true");

// Computed property to determine if we should show the prompt
const shouldShowPrompt = computed(() => {
  const canShow =
    props.isPrompted &&
    supportsPWA.value &&
    !isInstalled.value &&
    !promptDismissed.value;
  console.log("shouldShowPrompt:", {
    isPrompted: props.isPrompted,
    supportsPWA: supportsPWA.value,
    isInstalled: isInstalled.value,
    promptDismissed: promptDismissed.value,
    canShow,
  });
  return canShow;
});

const checkPWASupport = () => {
  // Check if PWA is installable using our global handler
  const installable = isPWAInstallable();
  supportsPWA.value = installable;

  // Check installed state
  isInstalled.value = isPWAInstalled();

  console.log("PWA Status Check:", {
    supportsPWA: supportsPWA.value,
    isInstalled: isInstalled.value,
  });

  // Notify parent component
  emits("onCheckPWA", { supportsPWA: supportsPWA.value });
};

const handleInstall = async () => {
  if (isInstalled.value) {
    alert("L'application est déjà installée sur votre appareil");
    return;
  }

  try {
    console.log("Déclenchement du prompt d'installation...");

    // Use our global handler for installation
    const result = await promptPWAInstall();

    if (result.outcome === "accepted") {
      console.log("Utilisateur a accepté l'installation");
      isInstalled.value = true;
      emits("installed");
    } else if (result.outcome === "unavailable") {
      console.log("Installation non disponible");
      alert(
        "Installation impossible. Veuillez utiliser l'option 'Ajouter à l'écran d'accueil' dans le menu de votre navigateur."
      );
    } else {
      console.log("Utilisateur a refusé l'installation");
      emits("dismissed");
    }
  } catch (error) {
    console.error("Erreur lors de l'installation:", error);
  } finally {
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

// Handler for the custom pwaInstallable event
const handlePWAInstallable = () => {
  console.log("Événement pwaInstallable reçu");
  supportsPWA.value = true;
  emits("onCheckPWA", { supportsPWA: true });
};

// Handler for the custom pwaInstalled event
const handlePWAInstalled = () => {
  console.log("Événement pwaInstalled reçu");
  isInstalled.value = true;
  emits("installed");
};

onMounted(() => {
  // Listen for custom events from our global handler
  window.addEventListener("pwaInstallable", handlePWAInstallable);
  window.addEventListener("pwaInstalled", handlePWAInstalled);

  // Listen for display mode changes
  const mediaQuery = window.matchMedia("(display-mode: standalone)");
  mediaQuery.addEventListener("change", (e) => {
    isInstalled.value = e.matches;
  });

  // Initial checks
  checkPWASupport();

  // Re-check on visibility change
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      checkPWASupport();
    }
  });

  console.log("Composant PWA Install monté");
});

onUnmounted(() => {
  // Clean up event listeners
  window.removeEventListener("pwaInstallable", handlePWAInstallable);
  window.removeEventListener("pwaInstalled", handlePWAInstalled);

  const mediaQuery = window.matchMedia("(display-mode: standalone)");
  mediaQuery.removeEventListener("change", (e) => {
    isInstalled.value = e.matches;
  });

  document.removeEventListener("visibilitychange", checkPWASupport);
});

// Watch for prop changes
watch(
  () => props.isPrompted,
  (newValue) => {
    console.log("isPrompted changed:", newValue);
    if (newValue) {
      // Re-check PWA status when prompt is requested
      checkPWASupport();
    }
  }
);
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
