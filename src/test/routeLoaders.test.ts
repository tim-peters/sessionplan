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
  it('fetches the templates index', async () => {
    const fetchMock = mockFetchJsonResponse({ templates: [] });
    await templatesIndexLoader({ request: fakeRequest('/templates') } as never);
    expect(fetchMock).toHaveBeenCalledWith('/data/templates/index.json');
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
  it('throws 404 when the response is HTML (e.g. SPA fallback)', async () => {
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
    ).rejects.toMatchObject({ status: 404 });
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
