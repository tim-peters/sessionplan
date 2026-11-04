import { describe, it, expect } from 'vitest';
import { createEmptyWorkshop, MAX_DAYS, WorkshopData, WorkshopItem } from '@/types/workshop';
import {
  addDay,
  duplicateDay,
  findChangedDayId,
  findDayForDate,
  findDayIdOfItem,
  findScheduledDay,
  getDayParamValue,
  getDays,
  getPlanStats,
  hasAnyItems,
  isMultiDay,
  moveDay,
  nextDate,
  projectDay,
  removeDay,
  resolveDayParam,
  ROOT_DAY_ID,
  updateDayItems,
  updatePlanMetadata,
  updateDayMeta,
} from '@/lib/workshop-days';
import { decodeWorkshopFromUrl, encodeWorkshopToUrl } from '@/lib/workshopUrl';

const block = (id: string, duration = 30): WorkshopItem => ({
  id,
  type: 'block',
  blockTypeId: null,
  title: id,
  duration,
  notes: '',
  material: '',
});

const singleDay = (): WorkshopData => ({
  ...createEmptyWorkshop(),
  workshop: {
    title: 'Retreat',
    description: '',
    date: '2026-10-12',
    startTime: '09:00',
    lastModified: '2026-10-01T00:00:00.000Z',
  },
  items: [block('a'), block('b')],
});

const threeDays = (): WorkshopData => {
  let data = singleDay();
  data = addDay(data)!.data;
  data = addDay(data)!.data;
  const [, second, third] = getDays(data);
  data = updateDayItems(data, second.id, () => [block('c', 60)]);
  data = updateDayItems(data, third.id, () => [block('d', 45)]);
  return data;
};

describe('workshop-days', () => {
  it('treats plans without days as a single root day', () => {
    const data = singleDay();
    expect(isMultiDay(data)).toBe(false);
    const days = getDays(data);
    expect(days).toHaveLength(1);
    expect(days[0]).toMatchObject({ id: ROOT_DAY_ID, date: '2026-10-12', startTime: '09:00' });
    expect(days[0].items).toBe(data.items);
  });

  it('returns single-day plans unchanged from projectDay', () => {
    const data = singleDay();
    expect(projectDay(data, null)).toBe(data);
    expect(projectDay(data, 'unknown')).toBe(data);
  });

  it('keeps single-day updates in the regular fields', () => {
    const data = singleDay();
    const next = updateDayItems(data, null, (items) => [...items, block('c')]);
    expect(next.days).toBeUndefined();
    expect(next.items.map((i) => i.id)).toEqual(['a', 'b', 'c']);
    const meta = updateDayMeta(data, null, { startTime: '10:00' });
    expect(meta.days).toBeUndefined();
    expect(meta.workshop.startTime).toBe('10:00');
  });

  it('keeps an existing snapshot byte-identical', () => {
    const data = singleDay();
    const encoded = encodeWorkshopToUrl(data);
    const roundTrip = projectDay(updateDayItems(decodeWorkshopFromUrl(encoded)!, null, (items) => items), null);
    expect(encodeWorkshopToUrl(roundTrip)).toBe(encoded);
  });

  it('adds a day with the next date and the same start time', () => {
    const result = addDay(singleDay())!;
    const days = getDays(result.data);
    expect(days).toHaveLength(2);
    expect(result.data.days![0]).toEqual({ id: ROOT_DAY_ID });
    expect(days[1]).toMatchObject({ id: result.dayId, date: '2026-10-13', startTime: '09:00', items: [] });
    // Root day stays in the original fields
    expect(result.data.items.map((i) => i.id)).toEqual(['a', 'b']);
  });

  it('projects later days as regular plans', () => {
    const data = threeDays();
    const [, second] = getDays(data);
    const view = projectDay(data, second.id);
    expect(view.days).toBeUndefined();
    expect(view.items.map((i) => i.id)).toEqual(['c']);
    expect(view.workshop.date).toBe('2026-10-13');
    expect(view.workshop.title).toBe('Retreat');
  });

  it('routes metadata to the selected day only', () => {
    const data = threeDays();
    const [, second] = getDays(data);
    const next = updateDayMeta(data, second.id, { startTime: '13:00', title: 'Deep Dive', description: 'Arbeitstag' });
    expect(next.workshop.startTime).toBe('09:00');
    expect(next.workshop.description).toBe('');
    expect(getDays(next)[1]).toMatchObject({ startTime: '13:00', title: 'Deep Dive', description: 'Arbeitstag' });
    expect(next.days![1].description).toBe('Arbeitstag');
    expect(projectDay(next, second.id).workshop.description).toBe('Arbeitstag');
  });

  it('keeps the first day description in workshop.description', () => {
    const data = updateDayMeta(threeDays(), ROOT_DAY_ID, { description: 'Ankommen' });
    expect(data.workshop.description).toBe('Ankommen');
    expect(data.days![0]).not.toHaveProperty('description');
    // Empty descriptions of later days are not stored
    expect(data.days![1]).not.toHaveProperty('description');
    const moved = moveDay(updateDayMeta(data, getDays(data)[1].id, { description: 'Zweiter' }), getDays(data)[1].id, 0);
    expect(moved.workshop.description).toBe('Zweiter');
    expect(getDays(moved)[1].description).toBe('Ankommen');
  });

  it('promotes the next day when the first day is removed', () => {
    const data = threeDays();
    const next = removeDay(data, ROOT_DAY_ID);
    const days = getDays(next);
    expect(days).toHaveLength(2);
    expect(next.items.map((i) => i.id)).toEqual(['c']);
    expect(next.workshop.date).toBe('2026-10-13');
    expect(next.days![0]).not.toHaveProperty('items');
  });

  it('collapses to the plain format when one day remains', () => {
    const data = addDay(singleDay())!;
    const next = removeDay(data.data, data.dayId);
    expect(next.days).toBeUndefined();
    expect(next.items.map((i) => i.id)).toEqual(['a', 'b']);
    expect(removeDay(next, ROOT_DAY_ID)).toBe(next);
  });

  it('moves a day to the front by swapping the root fields', () => {
    const data = threeDays();
    const third = getDays(data)[2];
    const next = moveDay(data, third.id, 0);
    expect(next.items.map((i) => i.id)).toEqual(['d']);
    expect(getDays(next).map((d) => d.items[0].id)).toEqual(['d', 'a', 'c']);
    expect(next.days![0].id).toBe(third.id);
  });

  it('duplicates a day with fresh item IDs', () => {
    const data = threeDays();
    const result = duplicateDay(data, ROOT_DAY_ID)!;
    const days = getDays(result.data);
    expect(days).toHaveLength(4);
    expect(days[1].items.map((i) => i.title)).toEqual(['a', 'b']);
    expect(days[1].items.map((i) => i.id)).not.toContain('a');
    expect(days[1].date).toBe('2026-10-13');
  });

  it('stops at the maximum number of days', () => {
    let data = singleDay();
    for (let i = 1; i < MAX_DAYS; i++) data = addDay(data)!.data;
    expect(getDays(data)).toHaveLength(MAX_DAYS);
    expect(addDay(data)).toBeNull();
  });

  it('finds the day of an item and counts all days', () => {
    const data = threeDays();
    expect(findDayIdOfItem(data, 'c')).toBe(getDays(data)[1].id);
    expect(findDayIdOfItem(data, 'missing')).toBeNull();
    expect(getPlanStats(data)).toEqual({ itemCount: 4, totalDuration: 165, dayCount: 3 });
    expect(getPlanStats(singleDay())).toEqual({ itemCount: 2, totalDuration: 60 });
  });

  it('clears a former day count when stats are spread over an older history entry', () => {
    const entry = { title: 'Retreat', ...getPlanStats(threeDays()) };
    expect({ ...entry, ...getPlanStats(singleDay()) }.dayCount).toBeUndefined();
  });

  it('routes metadata to the plan and the given day', () => {
    const data = threeDays();
    const secondId = getDays(data)[1].id;
    const next = updatePlanMetadata(data, secondId, { title: 'Neu', startTime: '13:00' });

    expect(next.workshop.title).toBe('Neu');
    expect(next.workshop.startTime).toBe(data.workshop.startTime);
    expect(getDays(next)[1].startTime).toBe('13:00');
  });

  it('applies all metadata to the plan itself when it has one day', () => {
    const next = updatePlanMetadata(singleDay(), null, { title: 'Neu', startTime: '13:00' });

    expect(next.workshop).toMatchObject({ title: 'Neu', startTime: '13:00' });
    expect(next.days).toBeUndefined();
  });

  it('hasAnyItems tolerates what a link may decode to', () => {
    expect(hasAnyItems(null)).toBe(false);
    expect(hasAnyItems(undefined)).toBe(false);
    expect(hasAnyItems({ items: [block('a')] } as unknown as WorkshopData)).toBe(true);
    expect(hasAnyItems({ items: [] } as unknown as WorkshopData)).toBe(false);
    expect(hasAnyItems({ items: undefined } as unknown as WorkshopData)).toBe(false);
  });

  it('keeps plans with an empty first day persistable', () => {
    const data = updateDayItems(threeDays(), ROOT_DAY_ID, () => []);
    expect(hasAnyItems(data)).toBe(true);
  });

  it('reports the day changed between two versions', () => {
    const data = threeDays();
    const third = getDays(data)[2];
    const next = updateDayItems(data, third.id, (items) => [...items, block('e')]);
    expect(findChangedDayId(data, next)).toBe(third.id);
    expect(findChangedDayId(data, data)).toBeNull();
    expect(findChangedDayId(data, updateDayMeta(data, third.id, { targetDuration: 90 }))).toBe(third.id);
  });

  it('resolves ?day= values', () => {
    const data = threeDays();
    const days = getDays(data);
    expect(resolveDayParam(data, '2')).toBe(days[1].id);
    expect(resolveDayParam(data, '9')).toBeNull();
    expect(resolveDayParam(data, days[2].id)).toBe(days[2].id);
    expect(resolveDayParam(data, 'today', new Date(2026, 9, 14, 8))).toBe(days[2].id);
    expect(resolveDayParam(data, null)).toBeNull();
    expect(getDayParamValue(data, days[1].id)).toBe('2');
    expect(getDayParamValue(data, ROOT_DAY_ID)).toBeNull();
    expect(getDayParamValue(singleDay(), null)).toBeNull();
  });

  it('finds today and the scheduled day', () => {
    const data = threeDays();
    const days = getDays(data);
    expect(findDayForDate(data, new Date(2026, 9, 13, 7))).toBe(days[1].id);
    expect(findScheduledDay(data, new Date(2026, 9, 13, 9, 30))).toBe(days[1].id);
    expect(findScheduledDay(data, new Date(2026, 9, 13, 11))).toBeNull();
  });

  it('adds one calendar day across month borders', () => {
    expect(nextDate('2026-10-31')).toBe('2026-11-01');
    expect(nextDate('2026-12-31')).toBe('2027-01-01');
    expect(nextDate(null)).toBeNull();
  });
});
