/**
 * workshop-days — Pure helpers for multi-day plans.
 *
 * Role: Single place that knows how days are stored in WorkshopData. The root
 *       day keeps using the regular `items` / `workshop` fields so that every
 *       single-day plan, template and link stays byte-identical; additional
 *       days live in the optional `days` array (see WorkshopDay). Everything
 *       else in the app reads days through `getDays()` / `projectDay()`.
 * Used by: useWorkshop, useActiveDay, useLiveDay, WorkshopPlanner, history stats
 */
import { MAX_DAYS, WorkshopData, WorkshopDay, WorkshopItem, WorkshopMetadata, generateId } from '@/types/workshop';
import { calculateEffectiveDuration } from '@/lib/workshopUtils';
import type { TFunction } from 'i18next';

/** Stored ID of the root day when a plan becomes multi-day. */
export const ROOT_DAY_ID = 'day-1';

export interface ResolvedDay {
  id: string;
  title?: string;
  description: string;
  date: string | null;
  startTime: string | null;
  targetDuration?: number;
  durationLocked?: boolean;
  items: WorkshopItem[];
}

export type DayMetaUpdates = Partial<Pick<ResolvedDay, 'title' | 'description' | 'date' | 'startTime' | 'targetDuration' | 'durationLocked'>>;

/** Metadata fields that belong to a day; the rest (e.g. the title) stays plan-wide. */
const DAY_METADATA_KEYS = new Set(['description', 'date', 'startTime', 'targetDuration', 'durationLocked']);

/** Display label of a day: its title, or "Day n". */
export const getDayLabel = (days: ResolvedDay[], dayId: string | null, t: TFunction): string => {
  const index = Math.max(0, days.findIndex((day) => day.id === dayId));
  return days[index]?.title || t('days.label', { index: index + 1 });
};

/** Short display date of a day, e.g. "Mo., 12.10."; null without a valid date. */
export const formatShortDate = (date: string | null, locale: string): string | null => {
  if (!date) return null;
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString(locale, { weekday: 'short', day: '2-digit', month: '2-digit' });
};

export const isMultiDay = (data: WorkshopData): boolean => (data.days?.length ?? 0) > 1;

export const getDays = (data: WorkshopData): ResolvedDay[] => {
  const stored = isMultiDay(data) ? data.days! : [];
  const root: ResolvedDay = {
    id: stored[0]?.id ?? ROOT_DAY_ID,
    title: stored[0]?.title,
    description: data.workshop.description,
    date: data.workshop.date,
    startTime: data.workshop.startTime,
    targetDuration: data.workshop.targetDuration,
    durationLocked: data.workshop.durationLocked,
    items: data.items,
  };
  return [
    root,
    ...stored.slice(1).map((day) => ({
      id: day.id,
      title: day.title,
      description: day.description ?? '',
      date: day.date ?? null,
      startTime: day.startTime ?? null,
      targetDuration: day.targetDuration,
      durationLocked: day.durationLocked,
      items: day.items ?? [],
    })),
  ];
};

const withoutUndefined = <T extends object>(value: T): T =>
  Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;

const withDayMetadata = (metadata: WorkshopMetadata, day: ResolvedDay): WorkshopMetadata =>
  withoutUndefined({
    ...metadata,
    description: day.description,
    date: day.date,
    startTime: day.startTime,
    targetDuration: day.targetDuration,
    durationLocked: day.durationLocked,
  });

const toStoredDay = (day: ResolvedDay): WorkshopDay =>
  withoutUndefined({
    id: day.id,
    title: day.title || undefined,
    description: day.description || undefined,
    date: day.date,
    startTime: day.startTime,
    targetDuration: day.targetDuration,
    durationLocked: day.durationLocked,
    items: day.items,
  });

/** Writes resolved days back. A single remaining day collapses to the plain format. */
const setDays = (data: WorkshopData, days: ResolvedDay[]): WorkshopData => {
  if (days.length === 0) return data;
  const [root, ...rest] = days;
  const { days: _previous, ...base } = data;
  const next: WorkshopData = {
    ...base,
    workshop: withDayMetadata(data.workshop, root),
    items: root.items,
  };
  if (rest.length === 0) return next;
  return {
    ...next,
    days: [withoutUndefined({ id: root.id, title: root.title || undefined }), ...rest.map(toStoredDay)],
  };
};

const getDayIndex = (data: WorkshopData, dayId: string | null | undefined): number => {
  if (!dayId) return 0;
  const index = getDays(data).findIndex((day) => day.id === dayId);
  return index === -1 ? 0 : index;
};

/** Returns a valid day ID, falling back to the root day. */
export const resolveDayId = (data: WorkshopData, dayId: string | null | undefined): string =>
  getDays(data)[getDayIndex(data, dayId)].id;

export const getDay = (data: WorkshopData, dayId: string | null | undefined): ResolvedDay =>
  getDays(data)[getDayIndex(data, dayId)];

/**
 * Returns one day as a regular single-day WorkshopData. For single-day plans
 * this is the input object itself, so existing consumers see no difference.
 */
export const projectDay = (data: WorkshopData, dayId: string | null | undefined): WorkshopData => {
  if (!isMultiDay(data)) return data;
  const day = getDay(data, dayId);
  const { days: _days, ...base } = data;
  return { ...base, workshop: withDayMetadata(data.workshop, day), items: day.items };
};

export const updateDayItems = (
  data: WorkshopData,
  dayId: string | null | undefined,
  updater: (items: WorkshopItem[]) => WorkshopItem[],
): WorkshopData => {
  const index = getDayIndex(data, dayId);
  if (index === 0) return { ...data, items: updater(data.items) };
  return {
    ...data,
    days: data.days!.map((day, i) => (i === index ? { ...day, items: updater(day.items ?? []) } : day)),
  };
};

export const updateDayMeta = (
  data: WorkshopData,
  dayId: string | null | undefined,
  updates: DayMetaUpdates,
): WorkshopData => {
  const index = getDayIndex(data, dayId);
  if (index === 0 && !isMultiDay(data)) {
    const { title: _title, ...metadata } = updates;
    return { ...data, workshop: { ...data.workshop, ...metadata } };
  }
  const days = getDays(data);
  days[index] = { ...days[index], ...updates };
  return setDays(data, days);
};

/** Applies workshop metadata: day-scoped fields to the given day, the rest to the plan. */
export const updatePlanMetadata = (
  data: WorkshopData,
  dayId: string | null | undefined,
  updates: Partial<WorkshopMetadata>,
): WorkshopData => {
  const entries = Object.entries(updates);
  const planUpdates = Object.fromEntries(entries.filter(([key]) => !DAY_METADATA_KEYS.has(key)));
  const dayUpdates = Object.fromEntries(entries.filter(([key]) => DAY_METADATA_KEYS.has(key))) as DayMetaUpdates;
  return updateDayMeta({ ...data, workshop: { ...data.workshop, ...planUpdates } }, dayId, dayUpdates);
};

/** Adds one calendar day to an ISO date (YYYY-MM-DD). */
export const nextDate = (date: string | null | undefined): string | null => {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const [y, m, d] = date.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return next.toISOString().slice(0, 10);
};

const cloneWithNewIds = (items: WorkshopItem[]): WorkshopItem[] =>
  items.map((item) => ({
    ...item,
    id: generateId(),
    children: item.children ? cloneWithNewIds(item.children) : item.children,
  }));

const insertDayAfter = (
  data: WorkshopData,
  afterIndex: number,
  build: (previous: ResolvedDay) => ResolvedDay,
): { data: WorkshopData; dayId: string } | null => {
  const days = getDays(data);
  if (days.length >= MAX_DAYS) return null;
  const index = Math.min(Math.max(afterIndex, 0), days.length - 1);
  const day = build(days[index]);
  days.splice(index + 1, 0, day);
  return { data: setDays(data, days), dayId: day.id };
};

/** Appends an empty day after `afterDayId` (default: the last day). */
export const addDay = (
  data: WorkshopData,
  afterDayId?: string | null,
): { data: WorkshopData; dayId: string } | null => {
  const afterIndex = afterDayId ? getDayIndex(data, afterDayId) : getDays(data).length - 1;
  // The following day is the natural date, unless it is already taken.
  const days = getDays(data);
  const usedDates = new Set(days.map((day) => day.date).filter(Boolean));
  return insertDayAfter(data, afterIndex, (previous) => {
    const candidate = nextDate(previous.date);
    return {
      id: generateId(),
      description: '',
      date: candidate && !usedDates.has(candidate) ? candidate : null,
      startTime: previous.startTime,
      items: [],
    };
  });
};

export const duplicateDay = (
  data: WorkshopData,
  dayId: string,
): { data: WorkshopData; dayId: string } | null =>
  insertDayAfter(data, getDayIndex(data, dayId), (source) => ({
    ...source,
    id: generateId(),
    date: nextDate(source.date),
    items: cloneWithNewIds(source.items),
  }));

export const removeDay = (data: WorkshopData, dayId: string): WorkshopData => {
  const days = getDays(data);
  if (days.length <= 1) return data;
  return setDays(data, days.filter((day) => day.id !== dayId));
};

export const moveDay = (data: WorkshopData, dayId: string, toIndex: number): WorkshopData => {
  const days = getDays(data);
  const from = days.findIndex((day) => day.id === dayId);
  if (from === -1) return data;
  const target = Math.min(Math.max(toIndex, 0), days.length - 1);
  if (from === target) return data;
  const [day] = days.splice(from, 1);
  days.splice(target, 0, day);
  return setDays(data, days);
};

const containsItem = (items: WorkshopItem[], id: string): boolean =>
  items.some((item) => item.id === id || (item.children ? containsItem(item.children, id) : false));

/** ID of the day containing the item (at any depth), or null. */
export const findDayIdOfItem = (data: WorkshopData, itemId: string): string | null =>
  getDays(data).find((day) => containsItem(day.items, itemId))?.id ?? null;

/**
 * First day whose items or settings differ between two versions of a plan,
 * used to show the affected day after undo/redo.
 */
export const findChangedDayId = (before: WorkshopData, after: WorkshopData): string | null => {
  const a = getDays(before);
  const b = getDays(after);
  for (const day of b) {
    const previous = a.find((candidate) => candidate.id === day.id);
    if (
      !previous ||
      previous.items !== day.items ||
      previous.date !== day.date ||
      previous.startTime !== day.startTime ||
      previous.title !== day.title ||
      previous.description !== day.description ||
      previous.targetDuration !== day.targetDuration ||
      previous.durationLocked !== day.durationLocked
    ) {
      return day.id;
    }
  }
  return null;
};

/** Top-level items of all days, in day order. */
export const getAllItems = (data: WorkshopData): WorkshopItem[] =>
  getDays(data).flatMap((day) => day.items);

/**
 * Whether a plan has content on any day. Tolerates what a link may decode to,
 * so unlike `getDays()` it also accepts a missing plan or unreadable fields.
 */
export const hasAnyItems = (data: WorkshopData | null | undefined): data is WorkshopData => {
  if (!data || !Array.isArray(data.items)) return false;
  return data.items.length > 0 || (isMultiDay(data) && data.days!.some((day) => (day.items?.length ?? 0) > 0));
};

/** Item count and duration for the session history, across all days. */
export const getPlanStats = (data: WorkshopData): { itemCount: number; totalDuration: number; dayCount: number | undefined } => {
  const items = getAllItems(data);
  const days = getDays(data);
  return {
    itemCount: items.length,
    totalDuration: items.reduce((sum, item) => sum + (item.duration ?? 0), 0),
    // Always set: spread over an older history entry, it must clear a former day count.
    dayCount: days.length > 1 ? days.length : undefined,
  };
};

/** Local calendar date of `now` as YYYY-MM-DD. */
const toLocalIsoDate = (now: Date): string => {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

export const findDayForDate = (data: WorkshopData, now: Date): string | null => {
  const today = toLocalIsoDate(now);
  return getDays(data).find((day) => day.date === today)?.id ?? null;
};

/** Day whose scheduled window (date + start time + duration) contains `now`. */
export const findScheduledDay = (data: WorkshopData, now: Date): string | null => {
  for (const day of getDays(data)) {
    if (!day.date || !day.startTime || day.items.length === 0) continue;
    const start = new Date(`${day.date}T${day.startTime}`).getTime();
    if (Number.isNaN(start)) continue;
    const elapsed = (now.getTime() - start) / 60000;
    if (elapsed >= 0 && elapsed <= calculateEffectiveDuration(day.items, day.startTime)) return day.id;
  }
  return null;
};

const TODAY_DAY_PARAM = 'today';

/**
 * Resolves the `?day=` URL value: a 1-based index, `today` (the day dated
 * today) or a stored day ID. Returns null when nothing matches.
 */
export const resolveDayParam = (data: WorkshopData, value: string | null, now = new Date()): string | null => {
  if (!value) return null;
  const days = getDays(data);
  if (value === TODAY_DAY_PARAM) return findDayForDate(data, now);
  if (/^\d+$/.test(value)) return days[Number(value) - 1]?.id ?? null;
  return days.find((day) => day.id === value)?.id ?? null;
};

/** The `?day=` value for a day: its 1-based index, or null for the first day. */
export const getDayParamValue = (data: WorkshopData, dayId: string | null | undefined): string | null => {
  const index = getDayIndex(data, dayId);
  return isMultiDay(data) && index > 0 ? String(index + 1) : null;
};
