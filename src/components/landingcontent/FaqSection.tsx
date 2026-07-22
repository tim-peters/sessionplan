import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/primitives/accordion';
import type { SeoFaqSection } from '@/types/landingPage';

interface FaqSectionProps {
  section: SeoFaqSection;
}

export const FaqSection = ({ section }: FaqSectionProps) => {
  const items = section.items ?? [];
  return (
    <section className="py-16 md:py-24">
      <div className="mx-auto max-w-3xl sm:px-6">
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
          {section.title}
        </h2>
        {items.length === 0 ? null : (
          <Accordion type="single" collapsible className="mt-8 w-full border-t border-border">
            {items.map((item) => (
              <AccordionItem key={item.question} value={item.question} className="md:py-1 border-b border-border">
                <AccordionTrigger className="text-left text-base md:text-lg font-medium text-foreground">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="text-sm md:text-base leading-7 text-muted-foreground [&_a]:text-primary [&_a]:underline-offset-4 [&_a:hover]:underline">
                  <div dangerouslySetInnerHTML={{ __html: item.answer }} />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
        {section.content && (
          <p
            className="mt-6 text-base md:text-lg text-muted-foreground [&_a]:text-primary [&_a]:underline-offset-4 [&_a:hover]:underline"
            dangerouslySetInnerHTML={{ __html: section.content }}
          />
        )}
      </div>
    </section>
  );
};
