import { createRoot } from "react-dom/client";
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
		defaultTheme="system" // Can later be set to "system" to respect the user's OS preference
		enableSystem
		storageKey={KEYS.theme}
		disableTransitionOnChange
		metaThemeColor={{ light: "#ffffff", dark: "#0f172a" }}
	>
		<App />
	</ThemeProvider>
);

// Static prerendered pages contain resolved route content, but the browser may
// still be loading the corresponding lazy route when startup begins. Hydrating
// would then compare that content with Suspense's loading fallback. The static
// HTML remains available for SEO; createRoot safely replaces it once the app is
// ready without triggering hydration mismatches.
createRoot(rootElement).render(app);
