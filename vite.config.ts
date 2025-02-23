import { defineConfig } from "vite";

import { fileURLToPath, URL } from "node:url";

import autoprefixer from "autoprefixer";
import tailwind from "tailwindcss";
import vue from "@vitejs/plugin-vue";
import dsv from "@rollup/plugin-dsv";

// https://vite.dev/config/
export default defineConfig({
  css: {
    postcss: {
      plugins: [tailwind(), autoprefixer()],
    },
  },
  plugins: [vue(), dsv()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
