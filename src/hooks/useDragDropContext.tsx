/**
 * useDragDropContext / DragDropProvider — Shared drag-and-drop state context.
 *
 * Role: Passes drag state (activeId, activeData, activeParentId, dropIndicator)
 *       down the WorkshopPlanner tree without prop-drilling. Memoized to avoid
 *       unnecessary re-renders in deep timeline children.
 * Used by: WorkshopPlanner (provider), BlockCard, GroupCard, BreakoutCard (consumers)
 */
import { createContext, useContext, useMemo, ReactNode } from 'react';
import type { ActiveData, DropIndicator } from '@/types/dnd';

export interface DragDropContextValue {
  activeId: string | null;
  activeData: ActiveData | undefined;
  activeParentId: string | null;
  dropIndicator: DropIndicator | null;
}

const DragDropContext = createContext<DragDropContextValue | null>(null);

export const useDragDropContext = () => {
  const context = useContext(DragDropContext);
  if (!context) {
    throw new Error('useDragDropContext must be used within DragDropProvider');
  }
  return context;
};

export const DragDropProvider = ({
  children,
  value,
}: {
  children: ReactNode;
  value: DragDropContextValue;
}) => {
  const memoizedValue = useMemo(
    () => value,
    [
      value.activeId,
      value.activeData,
      value.activeParentId,
      value.dropIndicator,
    ],
  );
  return (
    <DragDropContext.Provider value={memoizedValue}>
      {children}
    </DragDropContext.Provider>
  );
};
