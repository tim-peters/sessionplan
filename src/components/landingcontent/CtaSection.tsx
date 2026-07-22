import { Plus } from 'lucide-react';
import { Button } from '@/components/primitives/button';
import type { SeoCtaSection } from '@/types/landingPage';

interface CtaSectionProps {
  section: SeoCtaSection;
  onAddBlock: () => void;
}

export const CtaSection = ({ section, onAddBlock }: CtaSectionProps) => (
  <section className="bg-primary text-primary-foreground -mx-6 sm:mx-auto py-20 md:py-28">
    <div className="mx-auto max-w-3xl px-6 sm:px-6 text-center">
      <h2 className="text-3xl md:text-5xl font-bold tracking-tight">{section.title}</h2>
      {section.content && (
        <p
          className="mx-auto mt-4 max-w-2xl text-base md:text-lg opacity-90 [&_a]:underline [&_a:hover]:opacity-80"
          dangerouslySetInnerHTML={{ __html: section.content }}
        />
      )}
      <div className="mt-8 flex justify-center">
        <Button
          type="button"
          size="lg"
          onClick={onAddBlock}
          data-add-block="true"
          className="gap-2 bg-primary-foreground text-primary hover:bg-primary-foreground/90"
        >
          <Plus className="h-4 w-4" />
          {section.buttonText}
        </Button>
      </div>
      {section.buttonNote && (
        <p
          className="mt-4 text-xs opacity-80 [&_a]:underline [&_a:hover]:opacity-80"
          dangerouslySetInnerHTML={{ __html: section.buttonNote }}
        />
      )}
    </div>
  </section>
);
