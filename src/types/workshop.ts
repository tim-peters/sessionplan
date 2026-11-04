export interface BlockType {
  id: string;
  name: string;
  color: string;
}

export interface Person {
  id: string;
  name: string;
  color: string;
}

export interface WorkshopItem {
  id: string;
  type: 'block' | 'group' | 'breakout';
  blockTypeId: string | null;
  title: string;
  duration: number;
  durationLocked?: boolean; // For groups: if true, duration is not auto-updated
  fixedStartTime?: string; // Optional fixed absolute start time "HH:MM". If set, block starts at this clock time.
  notes: string;
  material: string;
  personIds?: string[]; // IDs of assigned persons
  lanePersons?: Record<number, string[]>; // For breakouts: persons per lane/room
  children?: WorkshopItem[];
  parallel?: boolean;
  lanes?: number; // For breakout: number of parallel lanes/rooms
  sameInAllBreakouts?: boolean; // For breakout: if true, same content in all lanes
  laneIndex?: number; // For blocks in breakouts: which lane/room they belong to (0-based)
}

export interface WorkshopMetadata {
  title: string;
  description: string;
  date: string | null;
  startTime: string | null;
  targetDuration?: number; // Target duration in minutes
  durationLocked?: boolean; // If true, target duration is set
  lastModified?: string;
}

/**
 * One day of a multi-day plan. `days[0]` describes the root day: it carries
 * only `id` and `title`, while its items, description, date, start time and
 * target live in the regular `items` / `workshop` fields. `days[1..]` carry their own values.
 * Only `src/lib/workshop-days.ts` should rely on this convention.
 */
export interface WorkshopDay {
  id: string;
  title?: string;
  description?: string;
  date?: string | null;
  startTime?: string | null;
  targetDuration?: number;
  durationLocked?: boolean;
  items?: WorkshopItem[];
}

export interface WorkshopData {
  version: string;
  workshop: WorkshopMetadata;
  blockTypes: BlockType[];
  persons: Person[];
  items: WorkshopItem[];
  /** Optional; absent or a single entry means a regular single-day plan. */
  days?: WorkshopDay[];
}

export interface WorkshopPrefillData {
  workshopTitle?: string;
  workshopDescription?: string;
  date?: string | null;
  startTime?: string | null;
  targetDuration?: number;
  durationLocked?: boolean;
  blockTypes?: BlockType[];
  persons?: Person[];
  items?: WorkshopItem[];
  /** Same layout as `WorkshopData.days`: the fields above are the first day. */
  days?: WorkshopDay[];
}

export const DEFAULT_WORKSHOP_TITLE = 'Neuer Workshop';

export const MAX_DAYS = 14;

export const DEFAULT_BLOCK_TYPES: BlockType[] = [
  { id: 'input', name: '🎤 Vortrag/Input', color: '#2C8DFE' },
  { id: 'activity', name: '🏃 Übung/Aktivität', color: '#7CF4D9' },
  { id: 'discussion', name: '💬 Diskussion', color: '#A855F7' },
  { id: 'break', name: '☕ Pause', color: '#6B7280' },
  { id: 'energizer', name: '⚡ Energizer', color: '#F97316' },
];

export const DEFAULT_PERSONS: Person[] = [];

export const createEmptyWorkshop = (): WorkshopData => ({
  version: '1.0',
  workshop: {
    title: DEFAULT_WORKSHOP_TITLE,
    description: '',
    date: null,
    startTime: null,
    lastModified: new Date().toISOString(),
  },
  blockTypes: [...DEFAULT_BLOCK_TYPES],
  persons: [...DEFAULT_PERSONS],
  items: [],
});

export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
};
