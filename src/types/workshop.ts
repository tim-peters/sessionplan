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

export interface WorkshopData {
  version: string;
  workshop: WorkshopMetadata;
  blockTypes: BlockType[];
  persons: Person[];
  items: WorkshopItem[];
}

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
    title: 'Neuer Workshop',
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
