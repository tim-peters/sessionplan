import { BlockType, Person, WorkshopItem } from './workshop';
import { type Locale } from '@/lib/i18n';

export interface SeoProseSection {
  type?: 'prose';
  title: string;
  content: string; // HTML content
}

export interface SeoFeaturesSection {
  type: 'features';
  title?: string;
  content?: string;
  /** How many columns to lay the items out in (1–3). Independent of `tint`. */
  columns?: 1 | 2 | 3;
  tint?: 'info' | 'default' | 'muted';
  items: Array<{
    icon?: string;
    title: string;
    description?: string;
  }>;
}

export interface SeoFaqSection {
  type: 'faq';
  title: string;
  content?: string;
  items: Array<{
    question: string;
    answer: string; // HTML content
  }>;
}

export interface SeoChecklistSection {
  type: 'checklist';
  title: string;
  items: Array<{
    label: string;
    description?: string;
  }>;
}

export interface SeoStepsSection {
  type: 'steps';
  title: string;
  items: Array<{
    title: string;
    description: string;
  }>;
}

export interface SeoCtaSection {
  type: 'cta';
  title: string;
  content?: string;
  buttonText: string;
  buttonNote?: string;
}

export interface SeoCalloutSection {
  type: 'callout';
  title?: string;
  content?: string;
  icon?: string;
  tint?: 'info' | 'default'| 'muted';
  items?: Array<{
    title?: string;
    description?: string;
  }>;
}

export interface SeoStat {
  value: string;
  label: string;
  description?: string;
}

export interface SeoStatsSection {
  type: 'stats';
  title?: string;
  content?: string;
  items: SeoStat[];
}

export type SeoSection =
  | SeoProseSection
  | SeoFeaturesSection
  | SeoFaqSection
  | SeoChecklistSection
  | SeoStepsSection
  | SeoCtaSection
  | SeoCalloutSection
  | SeoStatsSection;

export interface LandingPageContent {
  // Type: 'landing-page' (default) or 'template'
  // Templates are not shown in the landing pages overview
  type?: 'landing-page' | 'template';

  // Optional fallback landing page slug used for template empty-state SEO content
  fallbackSlug?: string;

  // Loader-resolved fallback content for template empty states
  emptyStateFallback?: LandingPageContent;
  
  /**
   * Alternate URLs for other language versions of this page.
   * Keys are locale codes; values are the absolute path (no domain) for that locale.
   * Example: { de: '/workshop-ablauf-planen', en: '/en/workshop-planning' }
   */
  alternates?: Partial<Record<Locale, string>>;

  // SEO & Meta
  slug: string;
  title: string; // Page title / H1
  metaTitle?: string; // Optional different meta title
  metaDescription: string;
  ogImage?: string; // Optional Open Graph image URL (relative or absolute)
  
  // Hero Section
  heroTitle: string;
  heroDescription: string;
  ctaText?: string; // Default: "Session erstellen"
  exampleSlug?: string; // Slug of an example template landing page (without leading /) rendered as 'Beispiel anzeigen' button
  
  // SEO Text Content - Flexible Sections
  // Each section declares its type; 'prose' is the default and keeps
  // backwards-compatible HTML content rendering.
  seoContent?: {
    sections: SeoSection[];
  };
  
  // Pre-filled Workshop Data (optional)
  // Can be used for both landing pages (basic prefill) and templates (full workshop)
  prefillData?: {
    workshopTitle?: string;
    workshopDescription?: string;
    date?: string | null;
    startTime?: string | null;
    targetDuration?: number;
    durationLocked?: boolean;
    blockTypes?: BlockType[];
    persons?: Person[];
    items?: WorkshopItem[];
  };
  
  // Structured Data (optional override)
  // Should be valid JSON-LD structured data (schema.org)
  structuredData?: Record<string, unknown>;
}
