/** @file playModeTimeline — Flattens the workshop item tree into time-indexed FlatBlocks. */
import { WorkshopItem } from '@/types/workshop';

export interface FlatBlock {
  id: string;
  title: string;
  startMin: number;
  endMin: number;
  parentId?: string;
  type: 'block' | 'group' | 'breakout';
}

/** Converts an "HH:MM" string to absolute minutes. */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Flattens the workshop timeline into a list of FlatBlocks with absolute start/end times
 * in minutes from the session start.
 *
 * - Groups: the group itself gets its full span; children are added sequentially within it.
 * - Breakouts: the breakout gets its full span; all children share that same span
 *   (they run in parallel and are tracked as a unit).
 * - Regular blocks: added as-is.
 * - fixedStartTime: when an item has a fixedStartTime, the running offset is snapped to
 *   that absolute time (relative to sessionStartMinutes). sessionStartMinutes must be
 *   provided for fixedStartTime to take effect.
 */
export function flattenTimeline(items: WorkshopItem[], offsetMin = 0, sessionStartMinutes?: number): FlatBlock[] {
  const result: FlatBlock[] = [];
  let offset = offsetMin;

  for (const item of items) {
    // Snap to fixed start time if set
    if (item.fixedStartTime && sessionStartMinutes !== undefined) {
      offset = timeToMinutes(item.fixedStartTime) - sessionStartMinutes;
    }

    const startMin = offset;

    if (item.type === 'group') {
      const groupDuration = item.children
        ? item.children.reduce((sum, c) => sum + c.duration, 0)
        : 0;
      const endMin = startMin + groupDuration;

      result.push({ id: item.id, title: item.title, startMin, endMin, type: 'group' });

      if (item.children) {
        let childOffset = startMin;
        for (const child of item.children) {
          // Snap child to fixed start time if set
          if (child.fixedStartTime && sessionStartMinutes !== undefined) {
            childOffset = timeToMinutes(child.fixedStartTime) - sessionStartMinutes;
          }
          const childStart = childOffset;
          const childEnd = childOffset + child.duration;
          result.push({
            id: child.id,
            title: child.title,
            startMin: childStart,
            endMin: childEnd,
            parentId: item.id,
            type: child.type,
          });
          if (child.type === 'breakout' && child.children) {
            const laneOffsets: Record<number, number> = {};
            for (const grandchild of child.children) {
              const lane = grandchild.laneIndex ?? 0;
              let laneStart = laneOffsets[lane] ?? childStart;
              if (grandchild.fixedStartTime && sessionStartMinutes !== undefined) {
                laneStart = timeToMinutes(grandchild.fixedStartTime) - sessionStartMinutes;
              }
              result.push({
                id: grandchild.id,
                title: grandchild.title,
                startMin: laneStart,
                endMin: laneStart + grandchild.duration,
                parentId: child.id,
                type: grandchild.type,
              });
              laneOffsets[lane] = laneStart + grandchild.duration;
            }
          }
          childOffset = childEnd;
        }
      }

      offset = endMin;
    } else if (item.type === 'breakout') {
      const endMin = startMin + item.duration;
      result.push({ id: item.id, title: item.title, startMin, endMin, type: 'breakout' });

      if (item.children) {
        const laneOffsets: Record<number, number> = {};
        for (const child of item.children) {
          const lane = child.laneIndex ?? 0;
          let laneStart = laneOffsets[lane] ?? startMin;
          if (child.fixedStartTime && sessionStartMinutes !== undefined) {
            laneStart = timeToMinutes(child.fixedStartTime) - sessionStartMinutes;
          }
          result.push({
            id: child.id,
            title: child.title,
            startMin: laneStart,
            endMin: laneStart + child.duration,
            parentId: item.id,
            type: child.type,
          });
          laneOffsets[lane] = laneStart + child.duration;
        }
      }

      offset = endMin;
    } else {
      const endMin = startMin + item.duration;
      result.push({ id: item.id, title: item.title, startMin, endMin, type: 'block' });
      offset = endMin;
    }
  }

  return result;
}
