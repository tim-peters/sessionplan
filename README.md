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

`.public-export.json` records the source commit and SHA-256 of each exported
file. A `working-tree-preview` source is for review only; published exports
should come from a committed release revision.
