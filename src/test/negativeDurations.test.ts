import { describe, expect, it } from 'vitest';
import { WorkshopData } from '@/types/workshop';
import { parseWorkshopJson } from '@/lib/workshopLocalStorage';
import { decodeWorkshopFromUrl, encodeWorkshopToUrl } from '@/lib/workshopUrl';
import { parseDuration, withoutNegativeDurations } from '@/lib/workshopUtils';
import { makeBlock, makeBreakout, makeGroup, makeWorkshop } from './test-helpers';

describe('parseDuration', () => {
  it.each([
    ['25', 25],
    ['0', 0],
    ['-5', 0],
    ['', 0],
    ['abc', 0],
  ])('reads %j as %i', (input, expected) => {
    expect(parseDuration(input)).toBe(expected);
  });
});

describe('withoutNegativeDurations', () => {
  it('returns a plan without negative durations unchanged', () => {
    const data = makeWorkshop({ items: [makeBlock({ duration: 0 }), makeBlock({ id: 'b2', duration: 10 })] });

    expect(withoutNegativeDurations(data)).toBe(data);
  });

  it('clamps blocks, locked groups and locked breakouts to 0', () => {
    const data = makeWorkshop({
      items: [
        makeBlock({ id: 'block', duration: -5 }),
        makeGroup([], { id: 'group', duration: -10, durationLocked: true }),
        makeBreakout([], { id: 'breakout', duration: -15, durationLocked: true }),
      ],
    });

    expect(withoutNegativeDurations(data).items.map((item) => item.duration)).toEqual([0, 0, 0]);
  });

  it('recalculates unlocked containers from their repaired children', () => {
    const data = makeWorkshop({
      items: [
        makeGroup(
          [makeBlock({ id: 'negative', duration: -20 }), makeBlock({ id: 'positive', duration: 15 })],
          { id: 'group', duration: -5 },
        ),
      ],
    });

    const [group] = withoutNegativeDurations(data).items;
    expect(group.children?.map((child) => child.duration)).toEqual([0, 15]);
    expect(group.duration).toBe(15);
  });

  it('keeps the planned duration of a locked container with a repaired child', () => {
    const data = makeWorkshop({
      items: [makeGroup([makeBlock({ duration: -20 })], { id: 'group', duration: 45, durationLocked: true })],
    });

    expect(withoutNegativeDurations(data).items[0].duration).toBe(45);
  });

  it('repairs additional days', () => {
    const data = makeWorkshop({
      items: [makeBlock({ id: 'first', duration: 10 })],
      days: [
        { id: 'day-1' },
        { id: 'day-2', items: [makeBlock({ id: 'second', duration: -30 })] },
      ],
    } as Partial<WorkshopData>);

    const repaired = withoutNegativeDurations(data);
    expect(repaired.items[0].duration).toBe(10);
    expect(repaired.days?.[1].items?.[0].duration).toBe(0);
  });

  it('clamps the target duration of the plan and of additional days', () => {
    const base = makeWorkshop();
    const data = makeWorkshop({
      workshop: { ...base.workshop, targetDuration: -60, durationLocked: true },
      days: [{ id: 'day-1' }, { id: 'day-2', targetDuration: -30, durationLocked: true }],
    } as Partial<WorkshopData>);

    const repaired = withoutNegativeDurations(data);
    expect(repaired.workshop.targetDuration).toBe(0);
    expect(repaired.days?.[1].targetDuration).toBe(0);
  });

  it('returns a plan with valid target durations unchanged', () => {
    const base = makeWorkshop();
    const data = makeWorkshop({
      workshop: { ...base.workshop, targetDuration: 90 },
      days: [{ id: 'day-1' }, { id: 'day-2', targetDuration: 0 }],
    } as Partial<WorkshopData>);

    expect(withoutNegativeDurations(data)).toBe(data);
  });
});

describe('loading plans with negative durations', () => {
  const plan = makeWorkshop({ items: [makeBlock({ duration: -5 })] });

  it('repairs a share link', () => {
    expect(decodeWorkshopFromUrl(encodeWorkshopToUrl(plan))?.items[0].duration).toBe(0);
  });

  it('repairs an imported JSON file', () => {
    expect(parseWorkshopJson(JSON.stringify(plan)).items[0].duration).toBe(0);
  });

  it('leaves the link of a valid plan byte-identical', () => {
    const valid = makeWorkshop({ items: [makeBlock({ duration: 0 })] });
    const encoded = encodeWorkshopToUrl(valid);

    expect(encodeWorkshopToUrl(decodeWorkshopFromUrl(encoded)!)).toBe(encoded);
  });
});
