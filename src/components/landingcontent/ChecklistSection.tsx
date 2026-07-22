import { Check } from 'lucide-react';
import type { SeoChecklistSection } from '@/types/landingPage';

interface ChecklistSectionProps {
  section: SeoChecklistSection;
}

export const ChecklistSection = ({ section }: ChecklistSectionProps) => {
  const items = section.items ?? [];
  return (
    <section className="bg-muted/30 py-16 md:py-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
          {section.title}
        </h2>
        {items.length === 0 ? null : (
          <ul role="list" className="mt-8 grid gap-5 md:grid-cols-2 md:gap-x-8 md:gap-y-6">
            {items.map((item) => (
              <li key={item.label} className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="mt-1 inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
                >
                  <Check className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-base md:text-lg font-semibold text-foreground">{item.label}</p>
                  {item.description && (
                    <p
                      className="mt-1 text-sm md:text-base text-muted-foreground [&_a]:text-primary [&_a]:underline-offset-4 [&_a:hover]:underline"
                      dangerouslySetInnerHTML={{ __html: item.description }}
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};
