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
git clone https://github.com/tim-peters/sessionplan.git
cd sessionplan
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) (or the port Vite assigns) in your browser.

## Self-Hosting

Sessionplan is fully functional without a backend — all data is stored locally in the browser. An optional backend enables the **Dynamic Link** feature for real-time sync between multiple users.

### Dynamic Link (optional backend)

To enable the Dynamic Link feature, deploy a PHP backend that implements the `/data/sessions.php` REST API (see the [API reference](#dynamic-link-api)). Then set the endpoint URL:

```env
# .env
VITE_SESSIONS_API=https://your-server.example.com/data/sessions.php
```

If `VITE_SESSIONS_API` is not set, the Dynamic Link toggle is still available in the UI but all requests will fail gracefully — the planner continues to work fully locally.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the API contract.

## License

Sessionplan is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.

The AGPL ensures that modifications distributed as a network service must also be open-sourced, protecting the project from commercial forks while allowing free self-hosting.

See [LICENSE](./LICENSE) for the full text.

## Contributing

Bug reports and pull requests are welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md) for details.

## Security

See [SECURITY.md](./SECURITY.md) for reporting vulnerabilities.
