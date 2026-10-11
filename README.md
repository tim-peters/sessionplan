# Sessionplan

**Sessionplan** is a free, browser-based Progressive Web App for visually planning workshops, trainings, meetings, and events using an interactive timeline.

[→ Try it live at sessionplan.de](https://sessionplan.de)

## Features

- **Visual timeline** — Drag & drop blocks to build your agenda
- **Automatic time calculation** — Start times and durations update instantly
- **Live mode** — Follow your plan in real-time during sessions
- **Block types & templates** — Custom categories, default library, reusable templates
- **Grouping & breakouts** — Parallel sessions, configurable lanes, per-lane facilitators
- **Share & export** — Snapshot links, JSON export/import, print-ready PDF
- **Offline-first** — Works fully offline after first load (PWA)
- **No registration** — All data stays in your browser by default

## Tech Stack

- **Vite** · **TypeScript** · **React 18** · **Tailwind CSS** · **shadcn/ui**
- **react-router-dom** · **react-i18next** · **@dnd-kit** · **Vitest**

## Getting Started

```bash
git clone <repository-url>
cd sessionplan
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) (or the port Vite assigns) in your browser.

## Self-Hosting

Sessionplan is a static web app. Install dependencies, build it and serve the
generated files from any static web server. Plans remain in the browser and can
be shared as URL links or exported as JSON.

### Dynamic-Link sessions API (optional)

The public distribution ships a single PHP API at `data/sessions.php` plus the
`_shared` modules it needs. The API is **strictly server-blind** — every
Dynamic Link is encrypted in the browser before upload; the server stores only
the encrypted envelope, the title, technical metadata and a hash of the write
capability, never the encryption key. There is no recovery-key escrow and no
server-side analytics or event logging integration in this build.

Self-hosters who want persistent Dynamic Links need a PHP runtime that can
serve the `data/` directory:

1. Deploy the `data/` directory so PHP can execute `data/sessions.php` (the
   shared modules under `data/_shared/` are loaded by the endpoint).
2. Set `SP_SESSIONS_DIR` on the PHP process to a path **outside the webroot**
   (e.g. `/var/lib/sessionplan/sessions`). The directory must be writable by
   the PHP process; the API persists one JSON file per session there.
3. Optionally set `SP_ALLOWED_ORIGIN` to a single extra origin (exact match) if
   the planner is served from a staging or alternative hostname.
4. Block direct web access to `data/_shared/` (e.g. via your Apache/Nginx
   config) — the shared modules are required by `data/sessions.php` but are
   not meant to be served as standalone URLs.

Additional optional environment variables (both default to safe values and
can be left unset for direct-internet deployments):

- `SP_PUBLIC_BASE_URL` — overrides the base URL used when reconstructing a
  tracked dynamic-link URL for analytics. Defaults to `https://sessionplan.de`.
- `SP_TRUSTED_CLIENT_IP_HEADER` — when set to a safe header name
  (e.g. `CF-Connecting-IP`, `X-Real-IP`), the rate-limit + per-IP capacity
  counters use that header's value instead of `REMOTE_ADDR`. Only enable
  this when a trusted front-end proxy sits in front of the API.

A reference Apache configuration is provided in `public/.htaccess`. Without
the PHP runtime, the planner continues to work locally and shares plans via
URL fragments or JSON export.

### Local development with the API (`npm run dev:full`)

To work on the planner together with the sessions API locally:

1. Run `npm run dev:full` — starts the Vite dev server (port 8080) and the
   PHP built-in server for the API (port 8081) side by side.
2. Point the frontend at the API with `VITE_SESSIONS_API=http://localhost:8081/data/sessions.php`
   (see `.env.example`; the planner falls back to the same-origin `data/sessions.php`
   path in a same-origin deployment, which the Vite dev server cannot serve).
3. CORS: `dev:api` sets `SP_ENV=development`, which additionally allows
   `localhost`/`127.0.0.1` origins (any port). For a non-localhost staging
   check, set `SP_ALLOWED_ORIGIN` instead.
4. Storage: sessions default to `sessions_data/` in the repository root
   (gitignored). Point `SP_SESSIONS_DIR` at a directory outside any served
   document root for anything beyond local experiments.

Run the two servers separately with `npm run dev` and `npm run dev:api` if
you prefer individual terminals (PHP ≥ 7.4 required).

## License

Sessionplan is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.

The AGPL ensures that modifications distributed as a network service must also be open-sourced, protecting the project from commercial forks while allowing free self-hosting.

See [LICENSE](./LICENSE) for the full text.

## Contributing

Bug reports and pull requests are welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md) for details.

## Security

See [SECURITY.md](./SECURITY.md) for reporting vulnerabilities.

## Public distribution

This repository contains the frontend application and neutral sample content.
It has no analytics integration, operator-specific contact details, legal pages
or server implementation. Static sample content in `public/data/` is independent
of production content.

`.public-export.json` lists the files generated in this export and carries a
content-derived `publicRevision` marker plus a `generated` date. It identifies
the distribution without exposing private commit references or per-file hashes.
A `working-tree-preview` source is for review only; published exports should
come from a committed release revision.
