/**
 * Hub — generic content-hub interface used by template / blog / landing hub pages.
 *
 * A hub groups related content (templates in a category, blog posts on a topic,
 * a curated set of landing pages) under one hub URL with its own SEO meta,
 * structured data, and filterable card grid.
 *
 * Locale-specific fields: hubs are locale-scoped content (hubs index is loaded
 * per-locale), so the slug is whatever the current locale uses
 * (e.g. "retrospektive" in DE / "retrospective" in EN). Use `alternates` to
 * link to the counterpart path in other locales.
 */
import { type Locale } from '@/lib/i18n';

export interface Hub {
  /** URL slug for the hub (locale-specific, e.g. "retrospektive" or "retrospective"). */
  slug: string;
  /** Visible H1 / title. */
  title: string;
  /** Short label for filter chips and navigation (falls back to `title`). */
  shortLabel?: string;
  /** Optional subtitle shown beneath the H1. */
  subtitle?: string;
  /** Meta description for SEO. */
  description: string;
  /** Optional intro paragraph shown above the card grid. */
  intro?: string;
  /**
   * Locale-specific counterpart paths, e.g.
   *   { en: '/en/templates/retrospective' } (when current locale is DE)
   *   { de: '/templates/retrospektive' }     (when current locale is EN)
   */
  alternates?: Partial<Record<Locale, string>>;
  /**
   * Explicit list of member slugs (landing-style hubs only). Templates/blog
   * hubs derive their membership via filter rules; landing-style hubs list
   * the exact member slugs to include.
   */
  slugs?: string[];
}
