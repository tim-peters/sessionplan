import type { ComponentType } from "react";

/**
 * Chunk-load recovery for deploys.
 *
 * Deployments delete old content-hashed JS chunks (assets/index-<hash>.js).
 * A tab that was opened before a deploy still runs the old bundle and lazy-loads
 * route chunks by their old hashed filename — which no longer exists after the
 * deploy → "Failed to fetch dynamically imported module" → broken navigation.
 *
 * Recovery: detect the chunk-load failure and reload the page once. After the
 * reload the browser fetches the current HTML, which references the current
 * chunks. A sessionStorage guard with a short time window prevents an infinite
 * reload loop (e.g. if the network is down and the reload itself fails to load
 * a chunk); in that case the error is rethrown and the existing ErrorBoundary
 * takes over.
 */

const RELOAD_FLAG = "sp:chunk-reload";
const RELOAD_WINDOW_MS = 10_000;

/** True if the error looks like a failed dynamic import of a hashed chunk. */
export function recoverFromChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  const message = error instanceof Error ? error.message : String(error);
  return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ViteError/i.test(
    message,
  );
}

/**
 * Handle a suspected chunk-load error: reload the page once (guarded), or
 * rethrow if we already reloaded recently. Returns true if a reload was
 * triggered (callers should then return a never-resolving promise so React
 * Router doesn't render anything after the reload has been scheduled).
 */
export function handleChunkLoadError(error: unknown): boolean {
  if (!recoverFromChunkLoadError(error)) return false;

  let lastReload = 0;
  try {
    lastReload = Number(sessionStorage.getItem(RELOAD_FLAG) ?? 0);
  } catch {
    /* sessionStorage unavailable — treat as no prior reload */
  }

  if (lastReload && Date.now() - lastReload < RELOAD_WINDOW_MS) {
    // Already reloaded moments ago — reloading again would loop. Let the
    // ErrorBoundary show the error instead.
    throw error;
  }

  try {
    sessionStorage.setItem(RELOAD_FLAG, String(Date.now()));
  } catch {
    /* ignore — reload without guard is still better than a broken page */
  }
  window.location.reload();
  return true;
}

/**
 * React Router `lazy` wrapper with chunk-load recovery. Use as:
 *   lazy: lazyPage(() => import("./pages/Index"))
 *
 * React Router expects a route-property subset (e.g. `{ Component }`) — it does
 * NOT map a module's `default` export automatically, so we do the mapping here.
 */
export function lazyPage(
  loader: () => Promise<{ default: ComponentType<Record<string, unknown>> }>,
): () => Promise<{ Component: ComponentType<Record<string, unknown>> }> {
  return async () => {
    try {
      const module = await loader();
      // Successful load — clear a stale guard flag from a previous failure.
      try {
        sessionStorage.removeItem(RELOAD_FLAG);
      } catch {
        /* ignore */
      }
      return { Component: module.default };
    } catch (error) {
      if (handleChunkLoadError(error)) {
        // Reload scheduled — never resolve so nothing renders meanwhile.
        return new Promise<{ Component: ComponentType<Record<string, unknown>> }>(() => {});
      }
      throw error;
    }
  };
}
