import type { SeoStatsSection } from '@/types/landingPage';

interface StatsSectionProps {
  section: SeoStatsSection;
}

const gridCols = (count: number) => {
  if (count <= 2) return 'sm:grid-cols-2';
  if (count === 3) return 'sm:grid-cols-3';
  return 'sm:grid-cols-2 lg:grid-cols-4';
};

export const StatsSection = ({ section }: StatsSectionProps) => {
  const items = section.items ?? [];
  return (
    <section className="py-12 md:py-16">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        {section.title && (
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground text-center">
            {section.title}
          </h2>
        )}
        {section.content && (
          <p
            className="mx-auto mt-3 max-w-2xl text-center text-base text-muted-foreground [&_code]:rounded [&_code]:bg-muted/50 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-sm"
            dangerouslySetInnerHTML={{ __html: section.content }}
          />
        )}
        {items.length > 0 && (
          <dl
            className={`mt-10 grid grid-cols-1 gap-6 md:gap-8 ${gridCols(items.length)}`}
          >
            {items.map((item, idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-primary/20 bg-card p-6 text-center shadow-sm"
              >
                <dt className="text-3xl md:text-4xl font-bold tracking-tight text-primary">
                  {item.value}
                </dt>
                <dd className="mt-2 text-sm md:text-base font-semibold text-foreground">
                  {item.label}
                </dd>
                {item.description && (
                  <p
                    className="mt-1 text-sm text-muted-foreground [&_code]:rounded [&_code]:bg-muted/50 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-sm"
                    dangerouslySetInnerHTML={{ __html: item.description }}
                  />
                )}
              </div>
            ))}
          </dl>
        )}
      </div>
    </section>
  );
};
