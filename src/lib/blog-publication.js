/**
 * Publication-date helpers shared by the browser and Node-based build scripts.
 * Blog dates are date-only values and become public at midnight in Berlin.
 */

export const BLOG_PUBLICATION_TIME_ZONE = 'Europe/Berlin';

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export const isValidIsoDate = (value) => {
  if (typeof value !== 'string') return false;

  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) return false;

  const [, year, month, day] = match;
  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));

  return parsed.getUTCFullYear() === Number(year)
    && parsed.getUTCMonth() === Number(month) - 1
    && parsed.getUTCDate() === Number(day);
};

export const getBerlinDate = (now = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: BLOG_PUBLICATION_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
};

export const isBlogPostPublished = (publishedDate, now = new Date()) => (
  isValidIsoDate(publishedDate) && publishedDate <= getBerlinDate(now)
);

export const filterPublishedBlogPosts = (posts, now = new Date()) => (
  posts.filter((post) => isBlogPostPublished(post?.publishedDate, now))
);
