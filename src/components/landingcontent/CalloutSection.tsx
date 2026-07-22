import { getSeoIcon } from '@/lib/seoIcons';
import type { SeoCalloutSection } from '@/types/landingPage';

interface CalloutSectionProps {
  section: SeoCalloutSection;
}

// Each tint has light + dark variants. The inner icon plate uses `bg-card`
// (the design-system surface token) so it works in both modes. Anchor links
// inherit the tint's text color via [&_a]:text-*.
const tintClasses: Record<NonNullable<SeoCalloutSection['tint']>, string> = {
  info: [
    'bg-blue-50 border-blue-200 text-blue-950',
    'dark:bg-blue-950/40 dark:border-blue-800/60 dark:text-blue-100',
    '[&_a]:text-blue-700 dark:[&_a]:text-blue-300',
    '[&_a:hover]:underline',
  ].join(' '),
  default: [
    'bg-card text-foreground',
    'border-border border',
    'dark:bg-card',
    '[&_a]:text-primary',
    '[&_a:hover]:underline',
  ].join(' '),
  muted: [
    'bg-muted text-foreground',
    'dark:bg-muted/20',
    '[&_a]:text-primary',
    '[&_a:hover]:underline',
  ].join(' '),
};

export const CalloutSection = ({ section }: CalloutSectionProps) => {
  const tint = section.tint ?? 'default';
  const cls = tintClasses[tint];
  const items = section.items ?? [];
  const Icon = section.icon ? getSeoIcon(section.icon) : null;

  return (
    <section className="py-6 md:py-8">
      <div className="-mx-4 sm:mx-auto max-w-4xl sm:px-6">
        <div className={`rounded-xl p-4 py-6 sm:p-6 md:p-8 shadow-sm ${cls}`}>
          {(Icon || section.title) && (
            <div className="flex items-start gap-4">
              {Icon && (
                <span
                  aria-hidden="true"
                  className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-card text-current shadow-sm"
                >
                  <Icon className="h-5 w-5" />
                </span>
              )}
              {section.title && (
                <h2 className="text-xl md:text-2xl font-bold tracking-tight">
                  {section.title}
                </h2>
              )}
            </div>
          )}
          {section.content && (
            <div
              className="mt-3 text-base leading-7 [&_a]:underline-offset-4 [&_ul]:my-4 [&_ul]:list-disc [&_ul]:space-y-3 [&_ul]:pl-5 [&_li]:leading-7 [&_p]:my-4"
              dangerouslySetInnerHTML={{ __html: section.content }}
            />
          )}
          {items.length > 0 && (
            <ul role="list" className="mt-5 space-y-3">
              {items.map((item, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="mt-2 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-current opacity-60"
                  />
                  <div>
                    {item.title && (
                      <p className="font-semibold">{item.title}</p>
                    )}
                    {item.description && (
                      <p
                        className="mt-0.5 text-sm leading-6 [&_a]:underline-offset-4"
                        dangerouslySetInnerHTML={{ __html: item.description }}
                      />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
};
