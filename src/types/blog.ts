import { type Locale } from '@/lib/i18n';

export interface BlogPost {
  slug: string;
  title: string;
  metaTitle?: string;
  /**
   * Alternate URLs for other language versions of this post.
   * Keys are locale codes; values are the absolute path for that locale.
   * Example: { de: '/blog/mein-artikel', en: '/en/blog/my-article' }
   */
  alternates?: Partial<Record<Locale, string>>;
  metaDescription: string;
  ogImage?: string; // Optional Open Graph image URL (relative or absolute)
  publishedDate: string; // ISO date string
  lastModified?: string; // ISO date string
  author: {
    name: string;
    url?: string;
  };
  tags?: string[];
  excerpt: string; // Short summary for listing
  content: string; // HTML content
  structuredData?: Record<string, unknown>; // Optional custom structured data (JSON-LD schema.org)
}

export interface BlogIndex {
  posts: Array<{
    slug: string;
    title: string;
    excerpt: string;
    publishedDate: string;
    tags?: string[];
  }>;
}
