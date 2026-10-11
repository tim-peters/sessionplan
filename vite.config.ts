import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { pathToFileURL } from "node:url";
import { VitePWA } from "vite-plugin-pwa";

// Standalone static pages under public/<slug>/index.html (e.g. /enterprise) are
// served correctly by Apache's directory-index rewrite in production, but Vite's
// dev server has no such resolution and falls through to the SPA's index.html.
// This rewrites the request before Vite's own middlewares run so `bun dev`
// matches production behavior for these pages.
const STANDALONE_STATIC_PAGES = ["enterprise", "en/enterprise"];

function standaloneStaticPages(): Plugin {
  const rewrite = (req: { url?: string }, _res: unknown, next: () => void) => {
    const url = req.url?.split("?")[0];
    const match = STANDALONE_STATIC_PAGES.find((slug) => url === `/${slug}` || url === `/${slug}/`);
    if (match) req.url = `/${match}/index.html`;
    next();
  };
  return {
    name: "standalone-static-pages",
    // Dev server (`bun dev` / `vite`)
    configureServer(server) {
      server.middlewares.use(rewrite);
    },
    // `vite preview` — serves the built dist/ folder, uses a separate hook
    configurePreviewServer(server) {
      server.middlewares.use(rewrite);
    },
  };
}

let appBuild = 0;
try {
  const raw = fs.readFileSync(path.resolve(__dirname, "src/build-info.json"), "utf-8");
  appBuild = JSON.parse(raw).build ?? 0;
} catch { /* build-info.json not available (dev mode) */ }

// Mirror the backend/ PHP runtime into dist/ right after the bundle is
// written. The script is dynamically imported: vite.config.ts is also
// consumed by the public-export build (config/public-export/manifest.json
// copies it) and the public export has no backend/manifest.json nor the
// scripts/ directory. A static import would break the public build.
function backendMirrorPlugin(): Plugin {
  return {
    name: "sessionplan-backend-mirror",
    apply: "build",
    async closeBundle() {
      const repoRoot = __dirname;
      if (!fs.existsSync(path.join(repoRoot, "backend/manifest.json"))) return;
      const script = path.join(repoRoot, "scripts/assemble-backend.mjs");
      if (!fs.existsSync(script)) {
        // A public build has no backend/manifest.json and returns above; a
        // private build with a manifest but without the assembly script would
        // otherwise produce a PHP-less dist/ with exit 0.
        throw new Error("backend/manifest.json exists but scripts/assemble-backend.mjs is missing; cannot mirror the PHP backend.");
      }
      const { runBackendAssembleFor } = await import(
        pathToFileURL(script).href
      );
      runBackendAssembleFor(repoRoot);
    },
  };
}

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
    proxy: {
      // Only PHP endpoints use the optional PHP backend; everything else is
      // static content served by Vite. Operator-only endpoint groups are
      // proxied by a private source region.
      '^/(?:data/.*|mcp|sitemap|bot-tracker)\\.php(?:\\?|$)': {
        target: 'http://localhost:8081',
        changeOrigin: true,
      },
    },
  },
  preview: {
    // No proxy during preview/prerender — static JSON files are served directly
    // from dist/ without needing the PHP backend.
    proxy: {},
  },
  plugins: [
    standaloneStaticPages(),
    backendMirrorPlugin(),
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
        // Every route in this app (blog posts, templates, landing pages, legal
        // pages, ...) has its own server-rendered/prerendered HTML — there is no
        // generic "SPA shell" content for them to fall back to. The enterprise-page
        // incident above (denylist entries) showed the failure mode concretely: a
        // navigation not covered by an exception got served the cached homepage
        // shell instead of that route's own HTML, and React Router rendered
        // NotFound until the SW updated. Rather than denylisting routes one at a
        // time (and re-discovering this bug for every future page type), restrict
        // navigateFallback to an ALLOWLIST of the only routes that are legitimately
        // shell-only: the DE and EN homepages. Everything else always goes to the
        // network (or its own precache entry), so a repeat visitor's browser never
        // substitutes route-specific content with the generic shell.
        navigateFallbackAllowlist: [/^\/$/, /^\/en\/?$/],
        navigateFallbackDenylist: [
          /^\/data\//,
          /^\/(?:llms\.txt|import-schema\.md)$/,
          /^\/enterprise\/?$/,
          /^\/en\/enterprise\/?$/,
        ],
        globPatterns: [
          // HTML is intentionally NOT globbed with **/ here: prerendering emits
          // one index.html per route (100+ files for blog/templates/landing
          // pages), and precaching all of them on install competes for bandwidth
          // with the page's own LCP request on first load. Only the root shell
          // (the one HTML file navigateFallback can ever serve, per the allowlist
          // above) needs to be precached; every other route's HTML is fetched
          // fresh from the network as it's visited.
          "index.html",
          "**/*.{js,css,ico,png,svg,webp,woff,woff2}",
          "**/*.{md,txt}",
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
