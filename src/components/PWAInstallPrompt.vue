<template>
  <Transition name="slide-up">
    <div
      v-if="supportsPWA && (!isInstalled || isPrompted)"
      class="pwa-prompt fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 flex items-center space-x-4"
    >
      <div class="flex-1">
        <h3 class="font-semibold text-gray-900 dark:text-white">
          Installer l'application
        </h3>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          Accédez rapidement à Scan Puce depuis votre appareil
        </p>
      </div>
      <div class="flex space-x-2">
        <button
          @click="handleInstall"
          class="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg transition-colors"
        >
          Installer
        </button>
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

const checkInstalled = () => {
  if (window.matchMedia("(display-mode: standalone)").matches) {
    isInstalled.value = true;
  }
};

const handleBeforeInstallPrompt = (e: Event) => {
  // Prevent Chrome 67 and earlier from automatically showing the prompt
  e.preventDefault();
  // Stash the event so it can be triggered later
  promptInstall.value = e as BeforeInstallPromptEvent;
  supportsPWA.value = true;
};

const handleInstall = async () => {
  if (!promptInstall.value) {
    return;
  }

  try {
    // Show the prompt
    await promptInstall.value.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await promptInstall.value.userChoice;

    // Optionally, send analytics event with outcome
    console.log(`User response to the install prompt: ${outcome}`);

    if (outcome === "accepted") {
      isInstalled.value = true;
    }

    isPrompted.value = true;
  } catch (error) {
    console.error("Error during installation:", error);
  } finally {
    // Clear the saved prompt since it can't be used again
    promptInstall.value = null;
    supportsPWA.value = false;
  }
};

onMounted(() => {
  // Add event listeners
  window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  window
    .matchMedia("(display-mode: standalone)")
    .addEventListener("change", checkInstalled);

  // Initial check
  checkInstalled();
});

onUnmounted(() => {
  // Clean up event listeners
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
