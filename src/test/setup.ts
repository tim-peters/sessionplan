import "@testing-library/jest-dom";
import { beforeEach } from "vitest";

// Vite injects this global at build time; in the test environment we provide a
// fixed string for deterministic tests.
declare global {
  var __APP_BUILD__: string;
}
globalThis.__APP_BUILD__ ??= "test";

// jsdom doesn't provide localStorage / sessionStorage unless Node is started
// with --localstorage-file. Polyfill an in-memory implementation so the app's
// localStorage-backed features work under test.
type Store = Record<string, string>;
const memoryStore = (): Storage => {
  let store: Store = {};
  return {
    get length() {
      return Object.keys(store).length;
    },
    clear() {
      store = {};
    },
    getItem(key: string) {
      return key in store ? store[key] : null;
    },
    key(index: number) {
      return Object.keys(store)[index] ?? null;
    },
    removeItem(key: string) {
      delete store[key];
    },
    setItem(key: string, value: string) {
      store[key] = String(value);
    },
  };
};

if (typeof globalThis.localStorage === "undefined") {
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: memoryStore() });
}
if (typeof globalThis.sessionStorage === "undefined") {
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: memoryStore() });
}

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// Auto-reset storage between every test so each test starts with a clean slate.
beforeEach(() => {
  if (typeof localStorage !== "undefined") localStorage.clear();
  if (typeof sessionStorage !== "undefined") sessionStorage.clear();
});
