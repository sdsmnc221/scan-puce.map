<template>
  <Transition name="slide-up">
    <div
      v-if="supportsPWA && !isPrompted"
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
import { ref, onMounted, onUnmounted } from "vue";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const supportsPWA = ref(false);
const promptInstall = ref<BeforeInstallPromptEvent | null>(null);
const isInstalled = ref(false);
const isPrompted = ref(false);

// Try to get stored prompt state from localStorage
onMounted(() => {
  const storedPromptState = localStorage.getItem("pwaPromptState");
  if (storedPromptState) {
    isPrompted.value = JSON.parse(storedPromptState);
  }
});

const checkInstalled = () => {
  if (window.matchMedia("(display-mode: standalone)").matches) {
    isInstalled.value = true;
  }
};

const handleBeforeInstallPrompt = (e: Event) => {
  e.preventDefault();
  promptInstall.value = e as BeforeInstallPromptEvent;
  supportsPWA.value = true;
};

const handleInstall = async () => {
  if (!promptInstall.value) return;

  try {
    await promptInstall.value.prompt();
    const { outcome } = await promptInstall.value.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);

    if (outcome === "accepted") {
      isInstalled.value = true;
    }
  } catch (error) {
    console.error("Error during installation:", error);
  } finally {
    // Mark as prompted regardless of the outcome
    isPrompted.value = true;
    localStorage.setItem("pwaPromptState", "true");
    promptInstall.value = null;
    supportsPWA.value = false;
  }
};

const handleClose = () => {
  isPrompted.value = true;
  localStorage.setItem("pwaPromptState", "true");
};

onMounted(() => {
  window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  window
    .matchMedia("(display-mode: standalone)")
    .addEventListener("change", checkInstalled);
  checkInstalled();
});

onUnmounted(() => {
  window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  window
    .matchMedia("(display-mode: standalone)")
    .removeEventListener("change", checkInstalled);
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
