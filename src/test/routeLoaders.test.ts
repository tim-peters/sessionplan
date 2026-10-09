import { describe, it, expect, vi } from 'vitest';
import {
  blogArticleLoader,
  blogIndexLoader,
  homePageLoader,
  templateArticleLoader,
  templatesIndexLoader,
  landingPageLoader,
  landingPagesLoader,
} from '@/lib/routeLoaders';
import { mockFetchResponse, mockFetchJsonResponse } from './test-helpers';

const fakeRequest = (path: string): Request => new Request(`http://localhost${path}`);

const jsonResponse = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (k: string) => (k.toLowerCase() === 'content-type' ? 'application/json' : null) },
  text: async () => JSON.stringify(body),
  json: async () => body,
});

describe('blogArticleLoader', () => {
  it('fetches the blog post from the locale-aware path', async () => {
    const post = { slug: 'x', title: 'X', content: '<p>hi</p>', metaDescription: '', publishedDate: '', author: { name: 'A' }, excerpt: '' };
    const fetchMock = mockFetchJsonResponse(post);
    const result = await blogArticleLoader({
      params: { slug: 'x' },
      request: fakeRequest('/blog/x'),
    } as never);
    expect(result).toEqual(post);
    expect(fetchMock).toHaveBeenCalledWith('/data/blog/x.json');
  });

  it('uses the /en/ path for English requests', async () => {
    const fetchMock = mockFetchJsonResponse({ slug: 'x', title: 'X' });
    await blogArticleLoader({
      params: { slug: 'x' },
      request: fakeRequest('/en/blog/x'),
    } as never);
    expect(fetchMock).toHaveBeenCalledWith('/data/blog/en/x.json');
  });

  it('throws 400 when the slug is missing', async () => {
    await expect(
      blogArticleLoader({ params: {}, request: fakeRequest('/blog/') } as never),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('throws 404 when the server returns 404', async () => {
    mockFetchResponse({ status: 404, body: {} });
    await expect(
      blogArticleLoader({ params: { slug: 'x' }, request: fakeRequest('/blog/x') } as never),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('prefers the git commit date from /data/lastmodified.json when newer than lastModified', async () => {
    const post = {
      slug: 'x', title: 'X', content: '<p>hi</p>', metaDescription: '',
      publishedDate: '2026-08-20', lastModified: '2026-08-25',
      author: { name: 'A' }, excerpt: '',
    };
    const map = { 'blog/x.json': '2026-08-30' };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(post))
      .mockResolvedValueOnce(jsonResponse(map));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await blogArticleLoader({
      params: { slug: 'x' },
      request: fakeRequest('/blog/x'),
    } as never);

    expect(result.lastModified).toBe('2026-08-30');
    expect(fetchMock).toHaveBeenCalledWith('/data/blog/x.json');
    expect(fetchMock).toHaveBeenCalledWith('/data/lastmodified.json');
    // Best-effort blog hub lookup adds a third fetch (posts index for the
    // category → hub resolution; the hubs index fetch itself fails silently
    // on the exhausted mock).
    expect(fetchMock).toHaveBeenCalledWith('/data/blog/index.json');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('looks up the EN path key (blog/en/<slug>.json) in lastmodified.json', async () => {
    const post = {
      slug: 'x', title: 'X', content: '', metaDescription: '',
      publishedDate: '2026-08-20',
      author: { name: 'A' }, excerpt: '',
    };
    const map = { 'blog/en/x.json': '2026-08-30' };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(post))
      .mockResolvedValueOnce(jsonResponse(map));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await blogArticleLoader({
      params: { slug: 'x' },
      request: fakeRequest('/en/blog/x'),
    } as never);

    expect(result.lastModified).toBe('2026-08-30');
    expect(fetchMock).toHaveBeenCalledWith('/data/blog/en/x.json');
    expect(fetchMock).toHaveBeenCalledWith('/data/lastmodified.json');
  });

  it('keeps post.lastModified as authored when the map has no entry for the post', async () => {
    const post = {
      slug: 'x', title: 'X', content: '', metaDescription: '',
      publishedDate: '2026-08-20', lastModified: '2026-08-25',
      author: { name: 'A' }, excerpt: '',
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(post))
      .mockResolvedValueOnce(jsonResponse({}));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await blogArticleLoader({
      params: { slug: 'x' },
      request: fakeRequest('/blog/x'),
    } as never);

    expect(result.lastModified).toBe('2026-08-25');
  });

  it('falls back to publishedDate when the merged date would sort before it', async () => {
    const post = {
      slug: 'x', title: 'X', content: '', metaDescription: '',
      publishedDate: '2026-09-01', lastModified: '2026-08-25',
      author: { name: 'A' }, excerpt: '',
    };
    const map = { 'blog/x.json': '2026-08-20' };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(post))
      .mockResolvedValueOnce(jsonResponse(map));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await blogArticleLoader({
      params: { slug: 'x' },
      request: fakeRequest('/blog/x'),
    } as never);

    expect(result.lastModified).toBe('2026-09-01');
  });

  it('tolerates a non-map payload for /data/lastmodified.json without overriding', async () => {
    const post = {
      slug: 'x', title: 'X', content: '', metaDescription: '',
      publishedDate: '2026-08-20', lastModified: '2026-08-25',
      author: { name: 'A' }, excerpt: '',
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(post))
      .mockResolvedValueOnce(jsonResponse({ not: 'a date map' }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await blogArticleLoader({
      params: { slug: 'x' },
      request: fakeRequest('/blog/x'),
    } as never);

    expect(result.lastModified).toBe('2026-08-25');
  });
});

describe('blogIndexLoader', () => {
  it('fetches /data/blog/index.json for DE', async () => {
    const fetchMock = mockFetchJsonResponse({ posts: [] });
    await blogIndexLoader({ request: fakeRequest('/blog') } as never);
    expect(fetchMock).toHaveBeenCalledWith('/data/blog/index.json');
  });

  it('fetches /data/blog/en/index.json for EN', async () => {
    const fetchMock = mockFetchJsonResponse({ posts: [] });
    await blogIndexLoader({ request: fakeRequest('/en/blog') } as never);
    expect(fetchMock).toHaveBeenCalledWith('/data/blog/en/index.json');
  });

  it('returns only posts whose Berlin publication date has been reached', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-25T22:00:00.000Z'));

    try {
      mockFetchJsonResponse({
        posts: [
          { slug: 'past', title: 'Past', excerpt: '', publishedDate: '2026-08-25' },
          { slug: 'today', title: 'Today', excerpt: '', publishedDate: '2026-08-26' },
          { slug: 'future', title: 'Future', excerpt: '', publishedDate: '2026-08-27' },
          { slug: 'invalid', title: 'Invalid', excerpt: '', publishedDate: '2026-02-30' },
        ],
      });

      const result = await blogIndexLoader({ request: fakeRequest('/blog') } as never);
      expect(result.posts.map((post) => post.slug)).toEqual(['past', 'today']);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('homePageLoader', () => {
  it('fetches /data/landing/home.json', async () => {
    const fetchMock = mockFetchJsonResponse({ slug: 'home', title: 'Home' });
    await homePageLoader({ request: fakeRequest('/') } as never);
    expect(fetchMock).toHaveBeenCalledWith('/data/landing/home.json');
  });
});

describe('templateArticleLoader', () => {
  it('fetches a template and resolves its fallback landing page', async () => {
    const tmpl = { slug: 'tmpl', type: 'template', fallbackSlug: 'home' };
    const fb = { slug: 'home', title: 'Home' };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        text: async () => JSON.stringify(tmpl),
        json: async () => tmpl,
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        text: async () => JSON.stringify(fb),
        json: async () => fb,
      });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await templateArticleLoader({
      params: { slug: 'tmpl' },
      request: fakeRequest('/templates/tmpl'),
    } as never);
    expect(result).toMatchObject({ ...tmpl, emptyStateFallback: fb });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('skips the fallback lookup when fallbackSlug === slug', async () => {
    const tmpl = { slug: 'home', type: 'template', fallbackSlug: 'home' };
    const fetchMock = mockFetchJsonResponse(tmpl);
    const result = await templateArticleLoader({
      params: { slug: 'home' },
      request: fakeRequest('/templates/home'),
    } as never);
    expect(result).toEqual(tmpl);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('templatesIndexLoader', () => {
  it('fetches the templates index and the hubs index', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        text: async () => JSON.stringify({ templates: [{ slug: 'a', title: 'A', excerpt: '' }] }),
        json: async () => ({ templates: [{ slug: 'a', title: 'A', excerpt: '' }] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        text: async () => JSON.stringify({ hubs: [{ slug: 'retrospektive', title: 'Retros', description: '' }] }),
        json: async () => ({ hubs: [{ slug: 'retrospektive', title: 'Retros', description: '' }] }),
      });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await templatesIndexLoader({ request: fakeRequest('/templates') } as never);

    expect(fetchMock).toHaveBeenCalledWith('/data/templates/index.json');
    expect(fetchMock).toHaveBeenCalledWith('/data/templates/hubs/index.json');
    expect(result).toEqual({
      templates: [{ slug: 'a', title: 'A', excerpt: '' }],
      hubs: [{ slug: 'retrospektive', title: 'Retros', description: '' }],
    });
  });
});

describe('landingPageLoader', () => {
  it('fetches a landing page by slug', async () => {
    const fetchMock = mockFetchJsonResponse({ slug: 'workshop', title: 'Workshop' });
    await landingPageLoader({ params: { slug: 'workshop' }, request: fakeRequest('/workshop') } as never);
    expect(fetchMock).toHaveBeenCalledWith('/data/landing/workshop.json');
  });

  it('throws 400 when the slug is missing', async () => {
    await expect(
      landingPageLoader({ params: {}, request: fakeRequest('/') } as never),
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe('landingPagesLoader', () => {
  it('returns the index immediately and a pages promise (defer shape)', async () => {
    const index = { landingPages: ['a', 'b'] };
    const pageA = { slug: 'a', title: 'A' };
    const pageB = { slug: 'b', title: 'B' };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        text: async () => JSON.stringify(index),
        json: async () => index,
      })
      // Hubs index is fetched in parallel with the index (best-effort).
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        text: async () => JSON.stringify({ hubs: [] }),
        json: async () => ({ hubs: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        text: async () => JSON.stringify(pageA),
        json: async () => pageA,
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        text: async () => JSON.stringify(pageB),
        json: async () => pageB,
      });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const deferred = await landingPagesLoader({ request: fakeRequest('/landing-pages') } as never);
    // defer() returns a DeferredData; individual keys are awaited from .data
    const data = await deferred.data;
    expect(data.index).toEqual(index);
    expect(await data.pages).toEqual([pageA, pageB]);
  });
});

describe('non-JSON content-type handling', () => {
  it('throws a client exception when the response is HTML (e.g. SPA fallback)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'text/html' },
      text: async () => '<html></html>',
      json: async () => ({}),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await expect(
      blogIndexLoader({ request: fakeRequest('/blog') } as never),
    ).rejects.toThrow('Expected JSON');
  });
});

describe('sanitizeJsonNewlines (via loaders) — multi-line HTML content', () => {
  it('parses JSON where a string value spans multiple physical lines', async () => {
    const multiLineJson =
      '{\n  "slug": "x",\n  "content": "<p>line 1\nline 2\nline 3</p>",\n  "title": "X",\n  "metaDescription": "",\n  "publishedDate": "",\n  "author": {"name":"A"},\n  "excerpt": ""\n}';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      text: async () => multiLineJson,
      json: async () => JSON.parse(multiLineJson.replace(/\n/g, '\\n')),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await blogArticleLoader({
      params: { slug: 'x' },
      request: fakeRequest('/blog/x'),
    } as never);
    expect(result.content).toContain('line 1');
    expect(result.content).toContain('line 3');
  });
});

describe('fetchJsonOrThrow retries transient failures (runtime resilience)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('retries a network failure and succeeds on the second attempt', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(jsonResponse({ slug: 'home', title: 'Home' }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const promise = homePageLoader({ request: fakeRequest('/') } as never);
    await vi.advanceTimersByTimeAsync(250);

    await expect(promise).resolves.toEqual({ slug: 'home', title: 'Home' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries a 503 and succeeds on the second attempt', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        headers: { get: () => null },
        text: async () => '',
        json: async () => ({}),
      })
      .mockResolvedValueOnce(jsonResponse({ slug: 'home', title: 'Home' }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const promise = homePageLoader({ request: fakeRequest('/') } as never);
    await vi.advanceTimersByTimeAsync(250);

    await expect(promise).resolves.toEqual({ slug: 'home', title: 'Home' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry a 404 (definitive)', async () => {
    const fetchMock = mockFetchResponse({ status: 404, body: {} });
    await expect(
      homePageLoader({ request: fakeRequest('/') } as never),
    ).rejects.toMatchObject({ status: 404 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not retry a non-JSON content type (deterministic)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'text/html' },
      text: async () => '<html></html>',
      json: async () => ({}),
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(
      homePageLoader({ request: fakeRequest('/') } as never),
    ).rejects.toThrow('Expected JSON');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('gives up after the retry budget and throws the last error', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const promise = homePageLoader({ request: fakeRequest('/') } as never);
    // Attach the rejection handler before advancing timers so Node doesn't
    // flag the rejection as "handled asynchronously".
    const assertion = expect(promise).rejects.toThrow('Failed to fetch');
    await vi.advanceTimersByTimeAsync(250 + 500);

    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
