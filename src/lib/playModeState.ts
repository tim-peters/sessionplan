/** @file playModeState — Computes past/current/future play state for each block. */
import { FlatBlock } from './playModeTimeline';

export type PlayState = 'past' | 'current' | 'future';

/**
 * Returns a Map<id, PlayState> for all blocks based on elapsed minutes.
 */
export function computePlayStates(
  flatBlocks: FlatBlock[],
  elapsed: number,
): Map<string, PlayState> {
  const map = new Map<string, PlayState>();
  for (const fb of flatBlocks) {
    if (fb.endMin <= elapsed) {
      map.set(fb.id, 'past');
    } else if (fb.startMin <= elapsed && elapsed < fb.endMin) {
      map.set(fb.id, 'current');
    } else {
      map.set(fb.id, 'future');
    }
  }
  return map;
}
