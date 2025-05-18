<template>
  <Transition name="slide-up">
    <div
      v-if="supportsPWA && isPrompted"
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
import { ref, onMounted, onUnmounted, watch } from "vue";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

withDefaults(defineProps<{ isPrompted: boolean }>(), {
  isPrompted: false,
});

const emits = defineEmits(["onCheckPWA"]);

const supportsPWA = ref(false);
const promptInstall = ref<BeforeInstallPromptEvent | null>(null);
const isInstalled = ref(false);
const deferredPrompt = ref<BeforeInstallPromptEvent | null>(null);

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

  console.log({
    supportsServiceWorker,
    isStandalone,
    isHttps,
    hasManifest,
    promptInstall: promptInstall.value,
  });
};

const checkInstalled = () => {
  if (window.matchMedia("(display-mode: standalone)").matches) {
    isInstalled.value = true;
  }
};

const handleBeforeInstallPrompt = (e: Event) => {
  e.preventDefault();
  deferredPrompt.value = e as BeforeInstallPromptEvent;
  promptInstall.value = deferredPrompt.value;
  supportsPWA.value = true;
  localStorage.setItem("deferrerPrompt", "true");
};

const handleInstall = async () => {
  if (!deferredPrompt.value) {
    console.log("No installation prompt available");
    return;
  }

  try {
    console.log("Triggering installation prompt");
    // Show the install prompt
    await deferredPrompt.value.prompt();

    // Wait for the user to respond to the prompt
    const choiceResult = await deferredPrompt.value.userChoice;
    console.log("User choice:", choiceResult.outcome);

    if (choiceResult.outcome === "accepted") {
      console.log("User accepted the install prompt");
      isInstalled.value = true;
    } else {
      console.log("User dismissed the install prompt");
    }
  } catch (error) {
    console.error("Installation error:", error);
  } finally {
    // Clear the deferred prompt
    deferredPrompt.value = null;
    promptInstall.value = null;
    supportsPWA.value = false;
    localStorage.setItem("pwaPromptState", "true");
  }
};

const handleClose = () => {
  localStorage.setItem("pwaPromptState", "true");
};

onMounted(() => {
  window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

  checkPWASupport();
  checkInstalled();
});

onUnmounted(() => {
  window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  window
    .matchMedia("(display-mode: standalone)")
    .removeEventListener("change", checkInstalled);
});

watch(
  () => supportsPWA.value,
  () => {
    emits("onCheckPWA", { supportsPWA: supportsPWA.value });
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
