/**
 * LibraryContext — Global provider for the block library and workshop templates.
 *
 * Role: Loads block library and saved templates from localStorage once on app
 *       start (avoiding race conditions across components). Exposes refresh
 *       callbacks for post-mutation reloads. Consumed via useLibrary().
 * Used by: App.tsx (provider), WorkshopPlanner sidebar sections (consumer)
 */
import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { getBlockLibrary, getTemplates, BlockTemplate, WorkshopTemplate } from '../lib/workshopStorage';

interface LibraryContextValue {
  // Data
  blocks: BlockTemplate[];
  templates: WorkshopTemplate[];
  
  // Loading states
  isLoadingBlocks: boolean;
  isLoadingTemplates: boolean;
  isLoading: boolean; // true if either is loading
  
  // Refresh functions
  refreshBlocks: () => Promise<void>;
  refreshTemplates: () => Promise<void>;
  refreshAll: () => Promise<void>;
}

const LibraryContext = createContext<LibraryContextValue | undefined>(undefined);

/**
 * Provider für Workshop Library und Templates
 * Lädt Daten beim App-Start um Race Conditions zu vermeiden
 * und bietet globalen Zugriff auf Library-Daten
 */
export function LibraryProvider({ children }: { children: ReactNode }) {
  const [blocks, setBlocks] = useState<BlockTemplate[]>([]);
  const [templates, setTemplates] = useState<WorkshopTemplate[]>([]);
  const [isLoadingBlocks, setIsLoadingBlocks] = useState(true);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);

  // Load blocks
  const loadBlocks = useCallback(async () => {
    setIsLoadingBlocks(true);
    try {
      const data = await getBlockLibrary();
      setBlocks(data);
    } catch (error) {
      console.error('Failed to load block library:', error);
      setBlocks([]);
    } finally {
      setIsLoadingBlocks(false);
    }
  }, []);

  // Load templates
  const loadTemplates = useCallback(async () => {
    setIsLoadingTemplates(true);
    try {
      const data = await getTemplates();
      setTemplates(data);
    } catch (error) {
      console.error('Failed to load templates:', error);
      setTemplates([]);
    } finally {
      setIsLoadingTemplates(false);
    }
  }, []);

  // Initial load on mount
  useEffect(() => {
    loadBlocks();
    loadTemplates();
  }, [loadBlocks, loadTemplates]);

  const refreshBlocks = useCallback(async () => {
    await loadBlocks();
  }, [loadBlocks]);

  const refreshTemplates = useCallback(async () => {
    await loadTemplates();
  }, [loadTemplates]);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadBlocks(), loadTemplates()]);
  }, [loadBlocks, loadTemplates]);

  const value: LibraryContextValue = {
    blocks,
    templates,
    isLoadingBlocks,
    isLoadingTemplates,
    isLoading: isLoadingBlocks || isLoadingTemplates,
    refreshBlocks,
    refreshTemplates,
    refreshAll,
  };

  return (
    <LibraryContext.Provider value={value}>
      {children}
    </LibraryContext.Provider>
  );
}

/**
 * Hook zum Zugriff auf Library Context
 * Wirft Fehler wenn außerhalb von LibraryProvider verwendet
 */
export function useLibrary(): LibraryContextValue {
  const context = useContext(LibraryContext);
  
  if (context === undefined) {
    throw new Error('useLibrary must be used within a LibraryProvider');
  }
  
  return context;
}
