<!-- CodeEmbed.vue -->
<template>
  <div class="code-container">
    <button class="copy-button" @click="copyCode" :class="{ copied: isCopied }">
      {{ buttonText }}
    </button>
    <pre><code v-html="formattedCode"></code></pre>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";

interface Props {
  code: string;
  language?: string;
}

const props = withDefaults(defineProps<Props>(), {
  language: "",
});

const isCopied = ref(false);
const buttonText = ref("Copy");

const formattedCode = computed(() => {
  return props.code.replace(/</g, "&lt;").replace(/>/g, "&gt;");
});

const copyCode = async () => {
  try {
    await navigator.clipboard.writeText(props.code);
    isCopied.value = true;
    buttonText.value = "Copied!";

    setTimeout(() => {
      isCopied.value = false;
      buttonText.value = "Copy";
    }, 2000);
  } catch (err) {
    console.error("Failed to copy code:", err);
    buttonText.value = "Failed to copy";

    setTimeout(() => {
      buttonText.value = "Copy";
    }, 2000);
  }
};
</script>

<style scoped>
.code-container {
  position: relative;
  background: #f5f5f5;
  border-radius: 4px;
  padding: 16px;
  margin: 16px 0;
}

pre {
  margin: 0;
  white-space: pre-wrap;
  word-wrap: break-word;
  max-height: 400px;
  text-align: left;
  overflow-y: auto;
}

code {
  font-family: "Monaco", "Menlo", "Consolas", monospace;
  font-size: 14px;
  line-height: 1.5;
}

.copy-button {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 6px 12px;
  background: #4caf50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.copy-button:hover {
  background: #45a049;
}

.copy-button.copied {
  background: #2196f3;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .code-container {
    background: #1e1e1e;
  }

  code {
    color: #d4d4d4;
  }
}
</style>
