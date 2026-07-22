# Architecture

Sessionplan is a single-page Progressive Web App built with React and Vite.

## Overview

```
sessionplan/
├── public/           # Static assets, PWA icons, locale files, content JSON
│   ├── data/         # Blog posts, landing pages, templates (JSON)
│   │   └── sessions/ # Session snapshots (gitignored)
│   ├── locales/      # i18next translation files (de/en)
│   └── pwa/          # PWA icons and manifest assets
├── src/
│   ├── components/   # React components
│   │   ├── atoms/    # Small, reusable building blocks
│   │   ├── layout/   # Layout components (header, footer, timeline)
│   │   ├── primitives/ # shadcn/ui wrapping components
│   │   ├── sections/ # Feature-specific section components
│   │   ├── sidebar/  # Sidebar panels (block types, persons, library)
│   │   └── states/   # Top-level state components (planner, loading, error)
│   ├── contexts/     # React context providers
│   ├── hooks/        # Custom React hooks
│   ├── lib/          # Utility functions, API clients, config
│   ├── pages/        # Route-level page components
│   ├── test/         # Vitest test files
│   └── types/        # TypeScript type definitions
├── index.html        # Vite entry HTML
├── vite.config.ts    # Vite + PWA configuration
└── tailwind.config.ts
```

## Key Concepts

### Workshop Data Model

A workshop plan consists of:
- **Workshop metadata** — title, description, start time, date
- **Items** — an ordered list of agenda entries. Each item is one of:
  - `block` — a single agenda point (title, duration, notes, material, facilitator)
  - `group` — a collapsible container with children (e.g., "Theory Block")
  - `breakout` — parallel sessions across configurable lanes
- **Block types** — custom categories with name and color
- **Persons** — facilitators with initials and color markers

### Persistence

Data is stored using multiple layers:
1. **localStorage** (`sp:*` namespace) — primary local storage with auto-save
2. **URL hash** — LZ-string compressed snapshot of the current plan (shareable via link)
3. **Server sync** — optional, via `VITE_SESSIONS_API` endpoint (Dynamic Link)

Auto-save is debounced and writes to both localStorage and the URL hash on every change.

### Dynamic Link API

The optional `/data/sessions.php` endpoint is proprietary and therefor not included. 

### Routing

Routes are defined with `react-router-dom`'s `createBrowserRouter`. Both German (`/`) and English (`/en/`) routes exist for:
- Home (`/`, `/en`)
- Blog listing and articles (`/blog`, `/blog/:slug`, `/en/blog`, `/en/blog/:slug`)
- Templates (`/templates`, `/templates/:slug`, `/en/templates`, `/en/templates/:slug`)
- Landing pages (`/landing-pages`, `/:slug`, `/en/landing-pages`, `/en/:slug`)

Content for blog, templates, and landing pages is loaded from JSON files in `public/data/`.

### PWA

The app registers a Service Worker via `vite-plugin-pwa` for offline support. The manifest declares `display: standalone` and includes maskable icons for installability on Android and iOS (via `apple-touch-icon`).

## Build

```bash
npm run build     # Production build → dist/
npm run preview   # Preview production build locally
```

The build produces static files in `dist/` that can be served by any static file server (Apache, nginx, Netlify, Vercel, etc.).
