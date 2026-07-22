import type { SeoProseSection } from '@/types/landingPage';

interface ProseSectionProps {
  section: SeoProseSection;
}

export const ProseSection = ({ section }: ProseSectionProps) => (
  <section className="py-16 md:py-20">
    <div className="mx-auto max-w-3xl sm:px-6">
      <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
        {section.title}
      </h2>
      <div
        className="mt-6 md:mt-8 text-base md:text-lg text-muted-foreground [&_h3]:mt-10 [&_h3]:mb-3 [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:text-foreground [&_h3:first-child]:mt-0 [&_p]:mb-6 [&_p]:leading-7 [&_ul]:mb-6 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-6 [&_ul]:leading-7 [&_.list-checkmark]:list-['✓_'] [&_li]:leading-7 [&_strong]:font-semibold [&_strong]:text-foreground [&_a]:text-primary [&_a]:underline-offset-4 [&_a:hover]:underline"
        dangerouslySetInnerHTML={{ __html: section.content }}
      />
    </div>
  </section>
);
