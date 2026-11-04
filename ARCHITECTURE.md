# Architecture

Sessionplan is a single-page Progressive Web App built with React and Vite.

## Overview

```
sessionplan/
├── data/             # Optional Dynamic-Link API (PHP)
│   ├── sessions.php  # Sessions endpoint
│   └── _shared/      # Modules loaded by the endpoint, not served directly
├── public/           # Static assets, PWA icons, locale files, content JSON
│   ├── data/         # Blog posts, landing pages, templates (JSON)
│   ├── locales/      # i18next translation files (de/en)
│   └── pwa/          # PWA icons and manifest assets
├── src/
│   ├── components/   # React components
│   │   ├── atoms/    # Small, reusable building blocks
│   │   ├── landingcontent/ # Content sections of landing pages
│   │   ├── layout/   # Layout components (header, footer)
│   │   ├── primitives/ # shadcn/ui wrapping components
│   │   ├── sections/ # Feature-specific section components
│   │   └── states/   # Top-level state components (planner, loading, error)
│   ├── contexts/     # React context providers
│   ├── hooks/        # Custom React hooks
│   ├── lib/          # Utility functions, API clients, config
│   ├── modules/      # Planner feature areas
│   │   ├── planner/  # Header, day tabs, live mode bar, dialogs, banners
│   │   ├── sidebar/  # Block types, persons, library, settings, AI import
│   │   └── timeline/ # Timeline rows and their controls
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
- **Days** — optional additional days of a multi-day plan
- **Items** — an ordered list of agenda entries. Each item is one of:
  - `block` — a single agenda point (title, duration, notes, material, facilitator)
  - `group` — a collapsible container with children (e.g., "Theory Block")
  - `breakout` — parallel sessions across configurable lanes
- **Block types** — custom categories with name and color
- **Persons** — facilitators with initials and color markers

### Multi-day Plans

A plan can span up to 14 days. The first day keeps using the regular `workshop` and `items` fields, so single-day plans, templates and links stay unchanged. The optional `days` array exists only with two or more days and holds the other days with their own title, description, date, start time, target duration and items.

Only `src/lib/workshop-days.ts` knows this layout. Everything else reads days through `getDays()` and `projectDay()`. The active day is mirrored into `?day=<n>` (1-based, omitted for day 1).

### Persistence

Data is stored using multiple layers:
1. **localStorage** (`sp:*` namespace) — the session history is the auto-save and also holds the block library and templates
2. **URL hash** — LZ-string compressed snapshot of a plan, created when sharing a link
3. **Dynamic Links** (optional) — encrypted plans stored by the sessions API behind a stable link

### Dynamic Links

The browser encrypts a Dynamic Link's content before upload. The server stores only the encrypted envelope, the cleartext title, technical metadata and a hash of the write capability. The encryption key and the capability stay in the URL fragment.

`data/sessions.php` keeps one JSON file per session outside the webroot, applies rate limits and capacity counters, and uses optimistic versioning so conflicting edits are detected in the browser. Without the API, the planner keeps working locally.

### Export

Plans can be exported as JSON for re-import, as CSV (`src/lib/workshop-csv.ts`) and through the print view as PDF. CSV files use UTF-8 with BOM and CRLF line endings, and multi-day plans list their days one below the other.

### Keyboard Shortcuts

`src/lib/keyboard-shortcuts.ts` describes every shortcut once. The help dialog, the Alt overlay, tooltips and `aria-keyshortcuts` read from it, and the key handling lives in `useKeyboardShortcuts`. A test fires each entry at that hook, so the two cannot drift apart. Character keys can be switched off in the settings.

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

The build produces static files in `dist/` that can be served by any static file server (Apache, nginx, Netlify, Vercel, etc.). Dynamic Links additionally need a PHP runtime for `data/sessions.php`; see the self-hosting section in the [README](./README.md).
