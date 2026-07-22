import type { SeoSection as SeoSectionType } from '@/types/landingPage';
import { CalloutSection } from './CalloutSection';
import { ChecklistSection } from './ChecklistSection';
import { CtaSection } from './CtaSection';
import { FaqSection } from './FaqSection';
import { FeaturesSection } from './FeaturesSection';
import { ProseSection } from './ProseSection';
import { StatsSection } from './StatsSection';
import { StepsSection } from './StepsSection';

interface SeoSectionProps {
  section: SeoSectionType;
  onAddBlock: () => void;
}

export const SeoSection = ({ section, onAddBlock }: SeoSectionProps) => {
  if (section.type === 'features') {
    return <FeaturesSection section={section} />;
  }
  if (section.type === 'faq') {
    return <FaqSection section={section} />;
  }
  if (section.type === 'checklist') {
    return <ChecklistSection section={section} />;
  }
  if (section.type === 'steps') {
    return <StepsSection section={section} />;
  }
  if (section.type === 'cta') {
    return <CtaSection section={section} onAddBlock={onAddBlock} />;
  }
  if (section.type === 'callout') {
    return <CalloutSection section={section} />;
  }
  if (section.type === 'stats') {
    return <StatsSection section={section} />;
  }
  return <ProseSection section={section} />;
};
