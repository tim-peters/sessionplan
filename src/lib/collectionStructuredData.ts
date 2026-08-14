import { type Locale } from '@/lib/i18n';

const SITE_URL = 'https://sessionplan.de';

export interface CollectionSchemaItem {
  url: string;
  name: string;
  description?: string;
  datePublished?: string;
  itemType?: string;
}

interface CollectionSchemaOptions {
  url: string;
  name: string;
  description: string;
  locale: Locale;
  items: CollectionSchemaItem[];
}

/** Builds schema for index pages whose visible content is an ordered collection. */
export const createCollectionPageSchema = ({
  url,
  name,
  description,
  locale,
  items,
}: CollectionSchemaOptions) => ({
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  '@id': `${url}#collection`,
  url,
  name,
  description,
  inLanguage: locale,
  isPartOf: {
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    url: SITE_URL,
    name: 'Sessionplan',
  },
  mainEntity: {
    '@type': 'ItemList',
    itemListOrder: 'https://schema.org/ItemListOrderAscending',
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        ...(item.itemType ? { '@type': item.itemType } : {}),
        '@id': item.url,
        url: item.url,
        name: item.name,
        ...(item.description ? { description: item.description } : {}),
        ...(item.datePublished ? { datePublished: item.datePublished } : {}),
      },
    })),
  },
});
