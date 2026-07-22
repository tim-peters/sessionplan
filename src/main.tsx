import { createRoot, hydrateRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { ThemeProvider } from "next-themes";
import App from "./App.tsx";
import "./index.css";
import "./lib/i18n"; // Initialise i18next before anything renders
import { isPrerendering } from "./lib/prerender";
import { migrateStorageKeys, KEYS } from "./lib/workshopLocalStorage";

// Migrate legacy localStorage keys to the `sp:` namespace before rendering.
migrateStorageKeys();

if (!isPrerendering()) {
	registerSW({ immediate: true });
}

const rootElement = document.getElementById("root")!;
const app = (
	<ThemeProvider
		attribute="class"
		defaultTheme="light" // Can later be set to "system" to respect the user's OS preference
		enableSystem
		storageKey={KEYS.theme}
		disableTransitionOnChange
		metaThemeColor={{ light: "#ffffff", dark: "#0f172a" }}
	>
		<App />
	</ThemeProvider>
);

// Hydrate only when there is server-rendered content inside #root (prerender
// build). Otherwise use createRoot to avoid hydration errors from next-themes'
// ThemeScript <script> element — React's first render produces it but the empty
// DOM doesn't have it, triggering a mismatch that cascades into a full client
// re-render and can cause content duplication.
if (rootElement.children.length > 0) {
	hydrateRoot(rootElement, app);
} else {
	createRoot(rootElement).render(app);
}
