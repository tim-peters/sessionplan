import { useState, useCallback } from 'react';

type SectionKey = 'blockTypes' | 'persons' | 'library' | 'templates' | 'settings';

interface UseSidebarSectionsOptions {
  onLibraryOpen: () => void;
  onTemplatesOpen: () => void;
}

/**
 * Manages the expanded/collapsed state of sidebar sections.
 * Triggers data refresh callbacks when library or templates sections are opened.
 */
export const useSidebarSections = ({
  onLibraryOpen,
  onTemplatesOpen,
}: UseSidebarSectionsOptions) => {
  const [expandedSections, setExpandedSections] = useState<Record<SectionKey, boolean>>({
    blockTypes: true,
    persons: false,
    library: false,
    templates: false,
    settings: false,
  });

  const toggleSection = useCallback((section: SectionKey) => {
    setExpandedSections(prev => {
      const next = { ...prev, [section]: !prev[section] };
      if (section === 'library' && next.library) onLibraryOpen();
      if (section === 'templates' && next.templates) onTemplatesOpen();
      return next;
    });
  }, [onLibraryOpen, onTemplatesOpen]);

  const openSection = useCallback((section: SectionKey) => {
    setExpandedSections(prev => ({ ...prev, [section]: true }));
    if (section === 'library') onLibraryOpen();
    if (section === 'templates') onTemplatesOpen();
  }, [onLibraryOpen, onTemplatesOpen]);

  const closeSection = useCallback((section: SectionKey) => {
    setExpandedSections(prev => ({ ...prev, [section]: false }));
  }, []);

  return { expandedSections, toggleSection, openSection, closeSection };
};
