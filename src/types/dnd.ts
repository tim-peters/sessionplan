import type { BlockType, WorkshopItem } from './workshop';

export type ActiveData =
  | { type: 'blocktype'; blockType: BlockType }
  | { type: 'library'; item: WorkshopItem }
  | { type: 'new-block' }
  | { type: 'new-group' }
  | { type: 'new-breakout' }
  | { type: 'breakout-lane'; parentId: string; laneIndex: number };

export interface DropIndicator {
  overId: string;
  position: 'before' | 'after';
}
