import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { VitePWA } from "vite-plugin-pwa";

let appBuild = 0;
try {
  const raw = fs.readFileSync(path.resolve(__dirname, "src/build-info.json"), "utf-8");
  appBuild = JSON.parse(raw).build ?? 0;
} catch { /* build-info.json not available (dev mode) */ }

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    __APP_BUILD__: appBuild,
  },
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    proxy: {},
  },
  preview: {
    // No proxy during preview/prerender — static JSON files are served directly
    // from dist/ without needing the PHP backend.
    proxy: {},
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: null,
      includeAssets: ["favicon.ico", "apple-touch-icon-180x180.png"],
      manifest: {
        name: "Sessionplan – Workshop Agenda Planer",
        short_name: "Sessionplan",
        description: "Kostenloser Browser-basierter Workshop-Planer mit Drag & Drop, Vorlagen und Live-Modus.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        theme_color: "#ffffff",
        background_color: "#ffffff",
        lang: "de",
        "icons": [
          { "src": "/pwa/icon-192.png",          "sizes": "192x192", "type": "image/png", "purpose": "any" },
          { "src": "/pwa/icon-512.png",          "sizes": "512x512", "type": "image/png", "purpose": "any" },
          { "src": "/pwa/icon-maskable-192.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable" },
          { "src": "/pwa/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
        ]
      },
      workbox: {
        clientsClaim: true,
        skipWaiting: true,
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/data\//],
        globPatterns: [
          "**/*.{js,css,html,ico,png,svg,webp,woff,woff2}",
          "locales/**/*.json",
          "data/defaultLibrary*.json",
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes("node_modules/react-dom") || id.includes("node_modules/react/") || id.includes("node_modules/scheduler")) {
            return "vendor-react";
          }
          if (id.includes("node_modules/react-router-dom") || id.includes("node_modules/@remix-run") || id.includes("node_modules/react-router/")) {
            return "vendor-router";
          }
          if (id.includes("node_modules/@dnd-kit")) {
            return "vendor-dnd-kit";
          }
          if (id.includes("node_modules/@radix-ui")) {
            return "vendor-radix";
          }
          if (id.includes("node_modules/lucide-react")) {
            return "vendor-lucide";
          }
        },
      },
    },
  },
}));
