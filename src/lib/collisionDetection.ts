/**
 * collisionDetection — Custom dnd-kit collision detection for the timeline.
 *
 * Role: Distinguishes between sidebar drags (new blocks dropped onto the timeline)
 *       and timeline-item drags (reordering), applying different hit-test priority
 *       rules for each. Replaces the default dnd-kit strategy.
 * Used by: WorkshopPlanner (DndContext collisionDetection prop)
 */
import { pointerWithin, closestCenter, CollisionDetection } from '@dnd-kit/core';
import type { Active, ClientRect, Collision, DroppableContainer } from '@dnd-kit/core';
import { WorkshopItem } from '@/types/workshop';
import { findParentId } from '@/lib/workshopUtils';

type CollisionArgs = {
  active: Active;
  collisionRect: ClientRect;
  droppableRects: Map<string, ClientRect>;
  droppableContainers: DroppableContainer[];
  pointerCoordinates: { x: number; y: number } | null;
};

/**
 * Custom collision detection for drag and drop
 * Handles both sidebar drags and timeline item drags with different priority levels
 */
export const createCustomCollisionDetection = (workshopItems: WorkshopItem[], activeParentId: string | null): CollisionDetection => {
  return (args: CollisionArgs) => {
    const { active } = args;
    
    // Check if we're dragging from sidebar or add buttons
    const isSidebarDrag = active.data.current?.type === 'blocktype' ||
                          active.data.current?.type === 'library' ||
                          active.data.current?.type === 'new-block' ||
                          active.data.current?.type === 'new-group' ||
                          active.data.current?.type === 'new-breakout';
    
    if (isSidebarDrag) {
      return handleSidebarDrag(args);
    }
    
    // For timeline item drags
    return handleTimelineDrag(args, workshopItems, activeParentId);
  };
};

/**
 * Handles collision detection for sidebar drags
 */
const handleSidebarDrag = (args: CollisionArgs) => {
  const pointerCollisions = pointerWithin(args);
  const closestCenterCollisions = closestCenter(args);
  
  if (pointerCollisions.length > 0) {
    // Check for top drop zone first
    const topDropZone = pointerCollisions.find((collision: Collision) => 
      collision.id === 'drop-zone-top'
    );
    if (topDropZone) return [topDropZone];
    
    // Check for bottom drop zone
    const bottomDropZone = pointerCollisions.find((collision: Collision) => 
      collision.id === 'drop-zone-bottom'
    );
    if (bottomDropZone) return [bottomDropZone];
    
    // Check for breakout lane drop zones
    const breakoutLaneDropZone = pointerCollisions.find((collision: Collision) => 
      typeof collision.id === 'string' && collision.id.includes('-lane-')
    );
    if (breakoutLaneDropZone) return [breakoutLaneDropZone];
    
    // Check for container drop zones
    const containerDropZone = pointerCollisions.find((collision: Collision) => 
      typeof collision.id === 'string' && collision.id.startsWith('container-')
    );
    if (containerDropZone) return [containerDropZone];
  }
  
  // Also allow dropping between top-level items
  const itemCollisions = closestCenterCollisions.filter((collision: Collision) => {
    if (typeof collision.id !== 'string') return false;
    
    // Skip drop zones, container zones, and lane zones
    if (collision.id.startsWith('container-') || 
        collision.id.includes('-lane-') ||
        collision.id === 'drop-zone-top' || 
        collision.id === 'drop-zone-bottom') {
      return false;
    }
    
    return true;
  });
  
  return itemCollisions.length > 0 ? itemCollisions : closestCenterCollisions;
};

/**
 * Handles collision detection for timeline item drags
 */
const handleTimelineDrag = (args: CollisionArgs, workshopItems: WorkshopItem[], activeParentId: string | null) => {
  const pointerCollisions = pointerWithin(args);
  
  // PRIORITY 1: Check for explicit drop zones first
  
  // Breakout lane drop zones - highest priority for cross-lane drops
  const breakoutLaneDropZone = pointerCollisions.find((collision: Collision) => 
    typeof collision.id === 'string' && collision.id.includes('-lane-')
  );
  if (breakoutLaneDropZone) {
    return [breakoutLaneDropZone];
  }
  
  // Container drop zones
  const containerDropZone = pointerCollisions.find((collision: Collision) => 
    typeof collision.id === 'string' && collision.id.startsWith('container-')
  );
  if (containerDropZone) {
    return [containerDropZone];
  }
  
  // Top/bottom drop zones
  const topDropZone = pointerCollisions.find((collision: Collision) => 
    collision.id === 'drop-zone-top'
  );
  if (topDropZone) return [topDropZone];
  
  const bottomDropZone = pointerCollisions.find((collision: Collision) => 
    collision.id === 'drop-zone-bottom'
  );
  if (bottomDropZone) return [bottomDropZone];
  
  // PRIORITY 2: Get all closest center collisions
  const closestCenterCollisions = closestCenter(args);
  
  // Filter for item collisions (not drop zones)
  const itemCollisions = closestCenterCollisions.filter((collision: Collision) => {
    if (typeof collision.id !== 'string') return false;
    
    // Skip drop zones and container zones
    if (collision.id.startsWith('container-') || 
        collision.id.includes('-lane-') ||
        collision.id === 'drop-zone-top' || 
        collision.id === 'drop-zone-bottom') {
      return false;
    }
    
    return true;
  });
  
  // PRIORITY 3: Check for same-level vs cross-level collisions
  const sameLevelCollisions = itemCollisions.filter((collision: Collision) => {
    const targetParentId = findParentId(workshopItems, collision.id);
    return targetParentId === activeParentId;
  });
  
  const crossLevelCollisions = itemCollisions.filter((collision: Collision) => {
    const targetParentId = findParentId(workshopItems, collision.id);
    return targetParentId !== activeParentId;
  });
  
  // Prefer same-level for smooth sorting
  if (sameLevelCollisions.length > 0) {
    // If cross-level collision is significantly closer, prefer that
    if (crossLevelCollisions.length > 0 && 
        crossLevelCollisions[0].data.value < sameLevelCollisions[0].data.value * 0.8) {
      return crossLevelCollisions;
    }
    return sameLevelCollisions;
  }
  
  // Return cross-level or all collisions as fallback
  return crossLevelCollisions.length > 0 ? crossLevelCollisions : closestCenterCollisions;
};
