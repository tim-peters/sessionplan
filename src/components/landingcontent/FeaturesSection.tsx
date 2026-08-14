import { getSeoIcon } from '@/lib/seoIcons';
import type { SeoFeaturesSection } from '@/types/landingPage';

interface FeaturesSectionProps {
  section: SeoFeaturesSection;
}

const gridCols = (columns?: 1 | 2 | 3) => {
  if (columns === 1) return '';
  if (columns === 2) return 'sm:grid-cols-2';
  // columns === 3 and the (legacy) undefined case both fall back to 3 cols.
  return 'sm:grid-cols-2 lg:grid-cols-3';
};

const tintSectionClasses: Record<NonNullable<SeoFeaturesSection['tint']>, string> = {
  info: 'bg-blue-50 text-blue-950 dark:bg-blue-950/40 dark:text-blue-100',
  default: 'bg-muted/40 text-foreground dark:bg-muted/20',
  muted: 'bg-muted/20 text-foreground dark:bg-muted/30',
};

export const FeaturesSection = ({ section }: FeaturesSectionProps) => {
  const tint = section.tint;
  // Section background depends on tint. The grid column count is controlled
  // exclusively by `columns` — never by `tint`.
  const sectionClass = tint
    ? `-mx-6 px-6 py-16 md:py-24 ${tintSectionClasses[tint]}`
    : '-mx-6 px-6 bg-muted/30 py-16 md:py-24';
  const gridClass = gridCols(section.columns);

  return (
    <section className={sectionClass}>
      <div className="mx-auto max-w-5xl sm:px-6">
        {section.title && (
          <div className="max-w-3xl">
            <h2 className="text-3xl md:text-4xl tracking-tight text-foreground">
              {section.title}
            </h2>
            {section.content && (
              <p
                className={`mt-4 text-base md:text-lg ${tint ? 'opacity-90 text-inherit' : 'text-muted-foreground'}`}
                dangerouslySetInnerHTML={{ __html: section.content }}
              />
            )}
          </div>
        )}
        <ul
          role="list"
          className={`mt-10 md:mt-14 grid grid-cols-1 gap-5 md:gap-6 ${gridClass}`}
        >
          {(section.items ?? []).map((item) => {
            const Icon = item.icon ? getSeoIcon(item.icon) : null;
            return (
              <li
                key={item.title}
                className="rounded-2xl bg-card p-6 [&_p]:my-2 [&_li]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2" 
              >
                {Icon && (
                  <span
                    aria-hidden="true"
                    className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                )}
                <h3 className="mt-5 text-lg font-semibold text-foreground">{item.title}</h3>
                {item.description && (
                  <p
                    className="mt-2 text-sm md:text-base leading-6 text-muted-foreground [&_a]:text-primary [&_a]:underline-offset-4 [&_a:hover]:underline"
                    dangerouslySetInnerHTML={{ __html: item.description }}
                  />
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
};
