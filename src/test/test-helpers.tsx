/**
 * Shared test helpers: storage reset, fetch stubbing, location hashing,
 * router wrapper, and WorkshopData fixture builders.
 */
import { vi } from 'vitest';
import { ReactNode } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import { LibraryProvider } from '@/contexts/LibraryContext';
import {
  WorkshopData,
  WorkshopItem,
  createEmptyWorkshop,
  generateId,
} from '@/types/workshop';

// ── Storage reset ──────────────────────────────────────────────────────────────

export const clearAllStorage = (): void => {
  if (typeof localStorage !== 'undefined') localStorage.clear();
  if (typeof sessionStorage !== 'undefined') sessionStorage.clear();
};

// ── History / location helpers ────────────────────────────────────────────────

export interface HistorySpy {
  push: ReturnType<typeof vi.fn>;
  replace: ReturnType<typeof vi.fn>;
  install: () => void;
  uninstall: () => void;
}

export const installHistorySpy = (): HistorySpy => {
  const push = vi.fn();
  const replace = vi.fn();
  const originalPush = window.history.pushState.bind(window.history);
  const originalReplace = window.history.replaceState.bind(window.history);

  window.history.pushState = ((...args: Parameters<typeof originalPush>) => {
    push(...args);
    return originalPush(...args);
  }) as typeof window.history.pushState;

  window.history.replaceState = ((...args: Parameters<typeof originalReplace>) => {
    replace(...args);
    return originalReplace(...args);
  }) as typeof window.history.replaceState;

  return {
    push,
    replace,
    install: () => {},
    uninstall: () => {
      window.history.pushState = originalPush;
      window.history.replaceState = originalReplace;
    },
  };
};

export const setHash = (hash: string): void => {
  if (hash.startsWith('#')) {
    window.history.replaceState(null, '', `${window.location.pathname}${hash}`);
  } else {
    window.history.replaceState(null, '', `${window.location.pathname}#${hash}`);
  }
};

export const setSearch = (search: string): void => {
  const q = search.startsWith('?') ? search : `?${search}`;
  window.history.replaceState(null, '', `${window.location.pathname}${q}`);
};

// ── Clipboard mock ────────────────────────────────────────────────────────────

export const installClipboardMock = (impl?: (text: string) => Promise<void>) => {
  const writeText = vi.fn(impl ?? (async () => {}));
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText },
  });
  return writeText;
};

// ── Fetch mock ────────────────────────────────────────────────────────────────

export interface FetchMockOptions {
  body?: unknown;
  status?: number;
  contentType?: string;
}

export const mockFetchResponse = (opts: FetchMockOptions = {}): ReturnType<typeof vi.fn> => {
  const status = opts.status ?? 200;
  const contentType = opts.contentType ?? 'application/json';
  const body = opts.body !== undefined ? JSON.stringify(opts.body) : '';
  const fetchMock = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (k: string) => (k.toLowerCase() === 'content-type' ? contentType : null) },
    text: async () => body,
    json: async () => JSON.parse(body),
  });
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
};

export const mockFetchJsonResponse = (body: unknown, status = 200): ReturnType<typeof vi.fn> =>
  mockFetchResponse({ body, status });

export const installFetchStub = (): ReturnType<typeof vi.fn> => {
  const fetchMock = vi.fn().mockRejectedValue(new Error('fetch not stubbed'));
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
};

// ── WorkshopData fixtures ─────────────────────────────────────────────────────

export const makeBlock = (overrides: Partial<WorkshopItem> = {}): WorkshopItem => ({
  id: generateId(),
  type: 'block',
  blockTypeId: null,
  title: 'Test Block',
  duration: 15,
  notes: '',
  material: '',
  ...overrides,
});

export const makeGroup = (children: WorkshopItem[] = [], overrides: Partial<WorkshopItem> = {}): WorkshopItem => ({
  id: generateId(),
  type: 'group',
  blockTypeId: null,
  title: 'Test Group',
  duration: children.reduce((s, c) => s + c.duration, 0),
  notes: '',
  material: '',
  children,
  durationLocked: false,
  ...overrides,
});

export const makeBreakout = (children: WorkshopItem[] = [], overrides: Partial<WorkshopItem> = {}): WorkshopItem => ({
  id: generateId(),
  type: 'breakout',
  blockTypeId: null,
  title: 'Test Breakout',
  duration: 30,
  notes: '',
  material: '',
  children,
  parallel: true,
  lanes: 2,
  sameInAllBreakouts: false,
  ...overrides,
});

export const makeWorkshop = (overrides: Partial<WorkshopData> = {}): WorkshopData => {
  const base = createEmptyWorkshop();
  return {
    ...base,
    ...overrides,
    workshop: { ...base.workshop, ...(overrides.workshop ?? {}) },
    blockTypes: overrides.blockTypes ?? base.blockTypes,
    persons: overrides.persons ?? base.persons,
    items: overrides.items ?? base.items,
  };
};

// ── Router / provider wrapper for integration tests ──────────────────────────

export interface WrapperOptions extends Omit<RenderOptions, 'wrapper'> {
  initialEntries?: string[];
  path?: string;
  withLibrary?: boolean;
}

export const renderWithProviders = (
  ui: ReactNode,
  { initialEntries, path, withLibrary = true, ...options }: WrapperOptions = {}
) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const entry = path ?? initialEntries?.[0] ?? '/';
  const router = initialEntries ?? [entry];

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <HelmetProvider>
        {withLibrary ? (
          <LibraryProvider>
            <MemoryRouter initialEntries={router}>{children}</MemoryRouter>
          </LibraryProvider>
        ) : (
          <MemoryRouter initialEntries={router}>{children}</MemoryRouter>
        )}
      </HelmetProvider>
    </QueryClientProvider>
  );

  return render(ui, { wrapper: Wrapper, ...options });
};

// ── Misc ──────────────────────────────────────────────────────────────────────

export const flushPromises = () => new Promise((r) => setTimeout(r, 0));
export const advanceTimersAndFlush = (ms: number) =>
  new Promise<void>((r) => {
    vi.useFakeTimers();
    vi.advanceTimersByTime(ms);
    vi.useRealTimers();
    queueMicrotask(r);
  });
