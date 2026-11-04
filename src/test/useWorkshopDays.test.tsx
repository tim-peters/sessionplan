import { useEffect } from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, beforeEach, expect, it, vi } from 'vitest';
import { useWorkshop } from '@/hooks/useWorkshop';
import { encodeWorkshopToUrl } from '@/lib/workshopUrl';
import { getSessionHistory } from '@/lib/workshopLocalStorage';
import { getDays } from '@/lib/workshop-days';
import { clearAllStorage } from './test-helpers';
import { createEmptyWorkshop, WorkshopData, WorkshopPrefillData } from '@/types/workshop';

type Hook = ReturnType<typeof useWorkshop>;

function Probe({ onReady, prefillData }: { onReady: (hook: Hook) => void; prefillData?: WorkshopPrefillData }) {
  const hook = useWorkshop(prefillData);
  useEffect(() => onReady(hook), [hook, onReady]);
  return null;
}

const newBlock = (title: string) => ({
  type: 'block' as const,
  blockTypeId: null,
  title,
  duration: 20,
  notes: '',
  material: '',
});

const twoDayPlan = (): WorkshopData => ({
  ...createEmptyWorkshop(),
  workshop: { title: 'Retreat', description: '', date: '2026-10-12', startTime: '09:00' },
  items: [{ ...newBlock('First'), id: 'a' }],
  days: [{ id: 'day-1' }, { id: 'day-2', date: '2026-10-13', startTime: '10:00', items: [{ ...newBlock('Second'), id: 'b' }] }],
});

const emptyFirstDayPlan = (): WorkshopData => ({ ...twoDayPlan(), items: [] });

const renderProbe = () => {
  let hook!: Hook;
  render(
    <MemoryRouter initialEntries={['/']}>
      <Probe onReady={(next) => { hook = next; }} />
    </MemoryRouter>,
  );
  return () => hook;
};

describe('useWorkshop with multiple days', () => {
  beforeEach(() => {
    clearAllStorage();
    window.history.replaceState(null, '', '/');
  });

  it('adds a day and routes new items and metadata to the active day', () => {
    const hook = renderProbe();
    act(() => { hook().addItem(newBlock('Day one')); });
    act(() => { hook().addDay(); });

    expect(hook().days).toHaveLength(2);
    expect(hook().activeDayId).toBe(hook().days[1].id);
    expect(hook().dayWorkshop.items).toHaveLength(0);

    act(() => { hook().addItem(newBlock('Day two')); });
    act(() => { hook().updateMetadata({ startTime: '13:00', title: 'Retreat', description: 'Tag zwei' }); });

    const days = getDays(hook().workshop);
    expect(days[0].items.map((i) => i.title)).toEqual(['Day one']);
    expect(days[1].items.map((i) => i.title)).toEqual(['Day two']);
    expect(hook().workshop.workshop.startTime).toBeNull();
    expect(days[1].startTime).toBe('13:00');
    expect(days[1].description).toBe('Tag zwei');
    expect(hook().workshop.workshop.description).toBe('');
    expect(hook().dayWorkshop.workshop.description).toBe('Tag zwei');
    expect(hook().workshop.workshop.title).toBe('Retreat');
  });

  it('routes a block added in the same batch to the day just added', () => {
    const hook = renderProbe();
    act(() => { hook().addItem(newBlock('Day one')); });
    act(() => {
      hook().addDay();
      hook().addItem(newBlock('Day two'));
    });

    const days = getDays(hook().workshop);
    expect(days[0].items.map((i) => i.title)).toEqual(['Day one']);
    expect(days[1].items.map((i) => i.title)).toEqual(['Day two']);
  });

  it('shows the affected day after undo', () => {
    const hook = renderProbe();
    act(() => { hook().addItem(newBlock('Day one')); });
    act(() => { hook().addDay(); });
    act(() => { hook().addItem(newBlock('Day two')); });
    act(() => { hook().setActiveDay(hook().days[0].id); });

    act(() => { hook().undo(); });
    expect(hook().activeDayId).toBe(hook().days[1].id);
    expect(hook().dayWorkshop.items).toHaveLength(0);
  });

  it('opens the day requested by ?day= and mirrors the selection into the URL', async () => {
    window.history.replaceState(null, '', `/?day=2#data=${encodeWorkshopToUrl(twoDayPlan())}`);
    const hook = renderProbe();

    await waitFor(() => expect(hook().activeDayId).toBe('day-2'));
    expect(hook().dayWorkshop.items.map((i) => i.title)).toEqual(['Second']);
    expect(hook().dayWorkshop.workshop.startTime).toBe('10:00');

    act(() => { hook().setActiveDay('day-1'); });
    await waitFor(() => expect(window.location.search).toBe(''));
    act(() => { hook().setActiveDay('day-2'); });
    await waitFor(() => expect(window.location.search).toBe('?day=2'));
  });

  it('never drops ?day= from the URL while opening a day', async () => {
    window.history.replaceState(null, '', `/?day=2#data=${encodeWorkshopToUrl(twoDayPlan())}`);
    const replaceState = vi.spyOn(window.history, 'replaceState');
    const hook = renderProbe();
    await waitFor(() => expect(hook().activeDayId).toBe('day-2'));

    const urls = replaceState.mock.calls.map(([, , url]) => url).filter(Boolean).map(String);
    replaceState.mockRestore();
    expect(urls.filter((url) => !url.startsWith('#') && !url.includes('day=2'))).toEqual([]);
  });

  it('updates an item on another day without switching the view', () => {
    window.history.replaceState(null, '', `/#data=${encodeWorkshopToUrl(twoDayPlan())}`);
    const hook = renderProbe();

    act(() => { hook().updateItem('b', { duration: 25 }); });
    expect(hook().activeDayId).toBe('day-1');
    expect(getDays(hook().workshop)[1].items[0].duration).toBe(25);
  });

  it('collapses back to a single-day plan when a day is removed', () => {
    window.history.replaceState(null, '', `/#data=${encodeWorkshopToUrl(twoDayPlan())}`);
    const hook = renderProbe();

    act(() => { hook().removeDay('day-2'); });
    expect(hook().workshop.days).toBeUndefined();
    expect(hook().workshop.items.map((i) => i.title)).toEqual(['First']);
  });

  it('keeps a plan with an empty first day in the session history, counting all days', async () => {
    window.history.replaceState(null, '', `/#data=${encodeWorkshopToUrl(emptyFirstDayPlan())}`);
    renderProbe();

    await waitFor(() => expect(getSessionHistory()).toHaveLength(1), { timeout: 2000 });
    expect(getSessionHistory()[0]).toMatchObject({ title: 'Retreat', itemCount: 1, totalDuration: 20, dayCount: 2 });
  });

  it('saves a plan with an empty first day before another plan replaces it', () => {
    window.history.replaceState(null, '', `/#data=${encodeWorkshopToUrl(emptyFirstDayPlan())}`);
    const hook = renderProbe();

    act(() => { hook().loadWorkshop(createEmptyWorkshop()); });
    expect(getSessionHistory()[0]).toMatchObject({ title: 'Retreat', dayCount: 2 });
  });

  it('resolves the day again when browser navigation changes the plan', async () => {
    window.history.replaceState(null, '', `/?day=2#data=${encodeWorkshopToUrl(twoDayPlan())}`);
    const hook = renderProbe();
    await waitFor(() => expect(hook().activeDayId).toBe('day-2'));

    const other = { ...twoDayPlan(), workshop: { ...twoDayPlan().workshop, title: 'Other' } };
    window.history.pushState(null, '', `/#data=${encodeWorkshopToUrl(other)}`);
    act(() => { window.dispatchEvent(new PopStateEvent('popstate')); });
    await waitFor(() => expect(hook().workshop.workshop.title).toBe('Other'));
    expect(hook().activeDayId).toBe('day-1');

    window.history.replaceState(null, '', `/?day=2#data=${encodeWorkshopToUrl(twoDayPlan())}`);
    act(() => { window.dispatchEvent(new PopStateEvent('popstate')); });
    await waitFor(() => expect(hook().workshop.workshop.title).toBe('Retreat'));
    await waitFor(() => expect(hook().activeDayId).toBe('day-2'));
    expect(window.location.search).toBe('?day=2');
  });

  describe('from a template', () => {
    const template: WorkshopPrefillData = {
      workshopTitle: 'Hackathon',
      startTime: '18:00',
      items: [{ ...newBlock('Kick-off'), id: 'a' }],
      days: [
        { id: 'day-1', title: 'Kick-off' },
        { id: 'day-2', title: 'Prototyping', startTime: '09:00', items: [{ ...newBlock('Build'), id: 'b' }] },
      ],
    };
    const renderTemplate = () => {
      let hook!: Hook;
      render(
        <MemoryRouter initialEntries={['/templates/hackathon']}>
          <Probe prefillData={template} onReady={(next) => { hook = next; }} />
        </MemoryRouter>,
      );
      return () => hook;
    };

    it('loads every day', () => {
      const hook = renderTemplate();
      expect(getDays(hook().workshop).map((day) => day.title)).toEqual(['Kick-off', 'Prototyping']);
      expect(hook().dayWorkshop.items.map((item) => item.id)).toEqual(['a']);
    });

    it('opens the day named by the URL', async () => {
      window.history.replaceState(null, '', '/templates/hackathon?day=2');
      const hook = renderTemplate();
      await waitFor(() => expect(hook().activeDayId).toBe('day-2'));
      expect(hook().dayWorkshop.items.map((item) => item.id)).toEqual(['b']);
      expect(hook().dayWorkshop.workshop.startTime).toBe('09:00');
    });
  });
});
