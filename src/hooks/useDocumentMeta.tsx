/**
 * DocumentMeta — Manages all <head> meta tags for a route.
 *
 * Role: Centralises <title>, description, canonical, Open Graph, Twitter Cards,
 *       hreflang alternate links, og:locale, and JSON-LD structured data.
 *       Every page component uses this instead of setting tags directly.
 *       Canonical base URL is always sessionplan.de.
 * Used by: All pages (Index, LandingPage, Blog, BlogArticle, Templates, TemplateArticle…)
 */
import { Helmet } from 'react-helmet-async';
import {
  META_CONFIG,
  MetaOptions,
  getCanonicalUrl,
  formatTitle,
  getAbsoluteImageUrl,
  buildHreflangLinks,
  getOgLocale,
  getOgLocaleAlternates,
} from '@/lib/metaConfig';

/**
 * Component for managing all document meta tags in one place.
 * Handles title, description, canonical, Open Graph, Twitter Cards,
 * hreflang, og:locale, and JSON-LD.
 *
 * @example
 * ```tsx
 * <DocumentMeta
 *   title="My Page"
 *   description="Page description"
 *   canonicalPath="/my-page"
 *   locale="de"
 *   alternates={{ en: '/en/my-page' }}
 * />
 * ```
 */
export const DocumentMeta = ({
  title,
  description = META_CONFIG.defaultDescription,
  canonicalPath = '/',
  locale = 'de',
  alternates,
  ogImage,
  ogType = 'website',
  article,
  twitterCard = 'summary_large_image',
  robots,
  noindex = false,
  structuredData,
  additionalMeta = [],
}: MetaOptions) => {
  const formattedTitle = formatTitle(title);
  const canonicalUrl = getCanonicalUrl(canonicalPath);
  const imageUrl = getAbsoluteImageUrl(ogImage);
  const robotsContent = noindex ? 'noindex,nofollow' : (robots || 'index,follow');
  const hreflangLinks = buildHreflangLinks(locale, canonicalPath, alternates);
  const ogLocale = getOgLocale(locale);
  const ogLocaleAlternates = getOgLocaleAlternates(locale);

  return (
    <Helmet>
      {/* HTML lang attribute */}
      <html lang={locale} />

      {/* Basic Meta Tags */}
      <title>{formattedTitle}</title>
      <meta name="description" content={description} />
      <meta name="robots" content={robotsContent} />
      <link rel="canonical" href={canonicalUrl} />

      {/* Hreflang alternate links (SEO: signals language versions to search engines) */}
      {hreflangLinks.map(({ hreflang, href }) => (
        <link key={hreflang} rel="alternate" hreflang={hreflang} href={href} />
      ))}

      {/* Open Graph Tags */}
      <meta property="og:locale" content={ogLocale} />
      {ogLocaleAlternates.map((alt) => (
        <meta key={alt} property="og:locale:alternate" content={alt} />
      ))}
      <meta property="og:title" content={formattedTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:type" content={ogType} />
      <meta property="og:site_name" content={META_CONFIG.siteName} />
      {imageUrl && <meta property="og:image" content={imageUrl} />}
      {imageUrl && <meta property="og:image:alt" content={formattedTitle} />}

      {/* Article-specific Open Graph tags */}
      {ogType === 'article' && article?.publishedTime && (
        <meta property="article:published_time" content={article.publishedTime} />
      )}
      {ogType === 'article' && article?.modifiedTime && (
        <meta property="article:modified_time" content={article.modifiedTime} />
      )}
      {ogType === 'article' && article?.author && (
        <meta property="article:author" content={article.author} />
      )}
      {ogType === 'article' && article?.tags?.map((tag) => (
        <meta key={tag} property="article:tag" content={tag} />
      ))}

      {/* Twitter Card Tags */}
      <meta name="twitter:card" content={twitterCard} />
      <meta name="twitter:title" content={formattedTitle} />
      <meta name="twitter:description" content={description} />
      {imageUrl && <meta name="twitter:image" content={imageUrl} />}

      {/* Additional Meta Tags */}
      {additionalMeta.map((meta, index) => (
        <meta
          key={index}
          {...(meta.name && { name: meta.name })}
          {...(meta.property && { property: meta.property })}
          content={meta.content}
        />
      ))}

      {/* JSON-LD Structured Data */}
      {structuredData && (
        <script type="application/ld+json">
          {JSON.stringify(
            Array.isArray(structuredData) ? structuredData : [structuredData],
            null,
            2
          )}
        </script>
      )}
    </Helmet>
  );
};
