import { describe, expect, it } from 'vitest';
import {
  filterPublishedBlogPosts,
  getBerlinDate,
  isBlogPostPublished,
  isValidIsoDate,
} from '@/lib/blog-publication';


describe('blog publication dates', () => {
  it('uses the Europe/Berlin calendar date around midnight', () => {
    expect(getBerlinDate(new Date('2026-08-29T21:59:59.999Z'))).toBe('2026-08-29');
    expect(getBerlinDate(new Date('2026-08-29T22:00:00.000Z'))).toBe('2026-08-30');
  });

  it('publishes on the date itself and hides future dates', () => {
    const now = new Date('2026-08-29T22:00:00.000Z');

    expect(isBlogPostPublished('2026-08-29', now)).toBe(true);
    expect(isBlogPostPublished('2026-08-30', now)).toBe(true);
    expect(isBlogPostPublished('2026-08-31', now)).toBe(false);
  });

  it('rejects malformed and impossible ISO dates', () => {
    expect(isValidIsoDate('2026-02-28')).toBe(true);
    expect(isValidIsoDate('2026-02-29')).toBe(false);
    expect(isValidIsoDate('2026-2-3')).toBe(false);
    expect(isValidIsoDate('not-a-date')).toBe(false);
    expect(isBlogPostPublished(undefined)).toBe(false);
  });

  it('filters a blog index without changing the source array', () => {
    const posts = [
      { slug: 'past', publishedDate: '2026-08-29' },
      { slug: 'today', publishedDate: '2026-08-30' },
      { slug: 'future', publishedDate: '2026-08-31' },
    ];

    expect(filterPublishedBlogPosts(posts, new Date('2026-08-29T22:00:00.000Z')))
      .toEqual(posts.slice(0, 2));
    expect(posts).toHaveLength(3);
  });
});
