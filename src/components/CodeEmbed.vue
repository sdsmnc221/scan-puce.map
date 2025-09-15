<!-- CodeEmbed.vue -->
<template>
  <div class="wrapper">
    <!-- Code Section -->
    <div class="code-container">
      <button
        class="copy-button"
        @click="copyCode"
        :class="{ copied: isCopied }"
      >
        {{ buttonText }}
      </button>
      <pre><code v-html="formattedCode"></code></pre>
    </div>

    <!-- Preview Section -->
    <div class="preview-container">
      <div class="preview-header">
        <h3 class="preview-title">Aperçu</h3>
        <button
          class="preview-toggle"
          @click="isPreviewVisible = !isPreviewVisible"
        >
          {{ isPreviewVisible ? "Afficher" : "Cacher" }} l'aperçu
        </button>
      </div>

      <div v-show="isPreviewVisible" class="preview-content">
        <div
          v-html="props.code.replace('600px', '100%')"
          class="preview-frame"
        ></div>
      </div>
    </div>
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
const isPreviewVisible = ref(true);

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
.wrapper {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  overflow: hidden;
  margin: 16px 0;
  display: flex;
  flex-direction: column;
  height: 90vh;
  overflow: hidden;
}

.code-container {
  position: relative;
  background: #f5f5f5;
  padding: 16px;
}

pre {
  margin: 0;
  white-space: pre-wrap;
  word-wrap: break-word;
  max-height: 400px;
  overflow-y: auto;
  text-align: left;
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
  background: #fac142;
  color: black;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.copy-button:hover {
  filter: brightness(1.2);
}

.copy-button.copied {
  filter: brightness(0.8);
}

.preview-container {
  border-top: 1px solid #e0e0e0;
  display: flex;
  flex-direction: column;
  flex: 1;
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #fafafa;
}

.preview-title {
  margin: 0;
  font-size: 16px;
  color: #333;
}

.preview-toggle {
  padding: 6px 12px;
  background: #f0f0f0;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.preview-toggle:hover {
  background: #e0e0e0;
}

.preview-content {
  padding: 16px;
  background: white;
  flex: 1;
}

.preview-frame {
  width: 100%;
  height: 100%;
  border: 1px solid #eee;
  border-radius: 4px;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .code-container {
    background: #1e1e1e;
  }

  code {
    color: #d4d4d4;
  }

  .preview-header {
    background: #2d2d2d;
  }

  .preview-title {
    color: #fff;
  }

  .preview-toggle {
    background: #383838;
    border-color: #404040;
    color: #fff;
  }

  .preview-toggle:hover {
    background: #404040;
  }

  .preview-content {
    background: #1e1e1e;
  }

  .preview-frame {
    border-color: #333;
  }
}
</style>
