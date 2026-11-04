import { filterPublishedBlogPosts } from './blog-publication.js';

/**
 * Blog posts shown in listings. The Vite dev server (MODE 'development') also
 * lists scheduled posts so upcoming content can be reviewed locally; tests and
 * production builds keep the publication-date filter.
 */
export const filterVisibleBlogPosts = <T extends { publishedDate?: string }>(posts: T[]): T[] =>
  import.meta.env.MODE === 'development' ? posts : filterPublishedBlogPosts(posts);
