import type { SeoStepsSection } from '@/types/landingPage';

interface StepsSectionProps {
  section: SeoStepsSection;
}

export const StepsSection = ({ section }: StepsSectionProps) => (
  <section className="py-16 md:py-24">
    <div className="mx-auto max-w-3xl sm:px-6">
      <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
        {section.title}
      </h2>
      <ol className="mt-10 ml-4 space-y-8 border-l-2 border-border pl-8">
        {(section.items ?? []).map((item, idx) => (
          <li key={item.title} className="relative">
            <span
              aria-hidden="true"
              className="absolute -left-[3.1rem] flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground ring-4 ring-background"
            >
              {idx + 1}
            </span>
            <h3 className="text-lg md:text-xl font-semibold text-foreground">{item.title}</h3>
            <p className="mt-2 text-sm md:text-base leading-6 text-muted-foreground">
              {item.description}
            </p>
          </li>
        ))}
      </ol>
    </div>
  </section>
);
