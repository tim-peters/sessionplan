/** @file playModeDisplay — Resolves the current and next block for the live mode bar. */
import { FlatBlock } from './playModeTimeline';

export interface CurrentDisplay {
  current: FlatBlock | null;
  next: FlatBlock | null;
  label: string | null;
  prevLabel: string | null;
  nextLabel: string | null;
}

/** Builds a display label for a set of parallel blocks (used for breakout children). */
function breakoutChildLabel(parentTitle: string, children: FlatBlock[]): string {
  const titles = children.map((c) => c.title);
  const uniqueTitles = [...new Set(titles)];
  if (uniqueTitles.length === 1 && children.length > 1) {
    return `${parentTitle} → ${uniqueTitles[0]} ×${children.length}`;
  } else if (uniqueTitles.length === 1) {
    return `${parentTitle} → ${uniqueTitles[0]}`;
  }
  return `${parentTitle} → ${uniqueTitles.join(' / ')}`;
}

/**
 * Resolves the current and next display items for the PlayModeBar.
 *
 * - For groups/breakouts: drills into the active child(ren) for "current".
 * - "next" shows the next child within the group/breakout if one exists;
 *   only when the last child is running does it fall back to the next top-level item.
 */
export function resolveCurrentDisplay(
  flatBlocks: FlatBlock[],
  elapsed: number,
): CurrentDisplay {
  const topLevel = flatBlocks.filter((fb) => !fb.parentId);
  const activeTopLevel =
    topLevel.find((fb) => fb.startMin <= elapsed && elapsed < fb.endMin) ?? null;

  if (!activeTopLevel) {
    const nextTopLevel = topLevel.find((fb) => fb.startMin > elapsed) ?? null;
    const lastPastTopLevel = [...topLevel].reverse().find((fb) => fb.endMin <= elapsed) ?? null;
    return {
      current: null,
      next: nextTopLevel,
      label: null,
      prevLabel: lastPastTopLevel?.title ?? null,
      nextLabel: nextTopLevel?.title ?? null,
    };
  }

  const activeTopLevelIdx = topLevel.indexOf(activeTopLevel);
  const nextTopLevel = topLevel[activeTopLevelIdx + 1] ?? null;
  const prevTopLevel = topLevel[activeTopLevelIdx - 1] ?? null;

  // Drill into groups: sequential children
  if (activeTopLevel.type === 'group') {
    const children = flatBlocks
      .filter((fb) => fb.parentId === activeTopLevel.id)
      .sort((a, b) => a.startMin - b.startMin);
    const activeIdx = children.findIndex(
      (fb) => fb.startMin <= elapsed && elapsed < fb.endMin,
    );
    if (activeIdx >= 0) {
      const activeChild = children[activeIdx];
      const prevChild = children[activeIdx - 1] ?? null;
      const nextChild = children[activeIdx + 1] ?? null;

      // If the active child is a breakout, drill further into its lane children
      if (activeChild.type === 'breakout') {
        const breakoutChildren = flatBlocks.filter((fb) => fb.parentId === activeChild.id);
        const activeBreakoutChildren = breakoutChildren.filter(
          (fb) => fb.startMin <= elapsed && elapsed < fb.endMin,
        );
        if (activeBreakoutChildren.length > 0) {
          const label = breakoutChildLabel(activeChild.title, activeBreakoutChildren);
          const pastBreakoutChildren = breakoutChildren.filter((fb) => fb.endMin <= elapsed);
          const prevBreakoutChildren = pastBreakoutChildren.length > 0
            ? (() => { const maxEnd = Math.max(...pastBreakoutChildren.map(fb => fb.endMin)); return pastBreakoutChildren.filter(fb => fb.endMin === maxEnd); })()
            : null;
          const futureBreakoutChildren = breakoutChildren.filter((fb) => fb.startMin > elapsed);
          if (futureBreakoutChildren.length > 0) {
            const nextStartMin = Math.min(...futureBreakoutChildren.map((fb) => fb.startMin));
            const nextBreakoutChildren = futureBreakoutChildren.filter((fb) => fb.startMin === nextStartMin);
            return {
              current: activeBreakoutChildren[0],
              next: nextBreakoutChildren[0],
              label,
              prevLabel: prevBreakoutChildren
                ? breakoutChildLabel(activeChild.title, prevBreakoutChildren)
                : (prevChild ? `${activeTopLevel.title} → ${prevChild.title}` : (prevTopLevel?.title ?? null)),
              nextLabel: breakoutChildLabel(activeChild.title, nextBreakoutChildren),
            };
          }
          // Last blocks in breakout → fall back to next group child or next top-level
          return {
            current: activeBreakoutChildren[0],
            next: nextChild ?? nextTopLevel,
            label,
            prevLabel: prevBreakoutChildren
              ? breakoutChildLabel(activeChild.title, prevBreakoutChildren)
              : (prevChild ? `${activeTopLevel.title} → ${prevChild.title}` : (prevTopLevel?.title ?? null)),
            nextLabel: nextChild
              ? `${activeTopLevel.title} → ${nextChild.title}`
              : (nextTopLevel?.title ?? null),
          };
        }
      }

      const label = `${activeTopLevel.title} → ${activeChild.title}`;
      if (nextChild) {
        return {
          current: activeChild,
          next: nextChild,
          label,
          prevLabel: prevChild ? `${activeTopLevel.title} → ${prevChild.title}` : (prevTopLevel?.title ?? null),
          nextLabel: `${activeTopLevel.title} → ${nextChild.title}`,
        };
      }
      return {
        current: activeChild,
        next: nextTopLevel,
        label,
        prevLabel: prevChild ? `${activeTopLevel.title} → ${prevChild.title}` : (prevTopLevel?.title ?? null),
        nextLabel: nextTopLevel?.title ?? null,
      };
    }
  }

  // Drill into breakouts: parallel lanes, each lane is sequential
  if (activeTopLevel.type === 'breakout') {
    const children = flatBlocks.filter((fb) => fb.parentId === activeTopLevel.id);
    const activeChildren = children.filter(
      (fb) => fb.startMin <= elapsed && elapsed < fb.endMin,
    );
    if (activeChildren.length > 0) {
      const label = breakoutChildLabel(activeTopLevel.title, activeChildren);
      const pastChildren = children.filter((fb) => fb.endMin <= elapsed);
      const prevChildren = pastChildren.length > 0
        ? (() => { const maxEnd = Math.max(...pastChildren.map(fb => fb.endMin)); return pastChildren.filter(fb => fb.endMin === maxEnd); })()
        : null;
      const futureChildren = children.filter((fb) => fb.startMin > elapsed);
      if (futureChildren.length > 0) {
        const nextStartMin = Math.min(...futureChildren.map((fb) => fb.startMin));
        const nextChildren = futureChildren.filter((fb) => fb.startMin === nextStartMin);
        return {
          current: activeChildren[0],
          next: nextChildren[0],
          label,
          prevLabel: prevChildren ? breakoutChildLabel(activeTopLevel.title, prevChildren) : (prevTopLevel?.title ?? null),
          nextLabel: breakoutChildLabel(activeTopLevel.title, nextChildren),
        };
      }
      return {
        current: activeChildren[0],
        next: nextTopLevel,
        label,
        prevLabel: prevChildren ? breakoutChildLabel(activeTopLevel.title, prevChildren) : (prevTopLevel?.title ?? null),
        nextLabel: nextTopLevel?.title ?? null,
      };
    }
  }

  // Plain block (no children)
  return {
    current: activeTopLevel,
    next: nextTopLevel,
    label: activeTopLevel.title,
    prevLabel: prevTopLevel?.title ?? null,
    nextLabel: nextTopLevel?.title ?? null,
  };
}
