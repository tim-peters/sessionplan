import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DayControls } from '@/modules/planner/DayControls';
import { DayBoxes } from '@/modules/planner/DayBoxes';
import { DayStrip } from '@/modules/planner/DayStrip';
import { WorkshopHeader } from '@/modules/planner/WorkshopHeader';
import type { ResolvedDay } from '@/lib/workshop-days';

const day = (id: string, title: string): ResolvedDay => ({
  id,
  title,
  description: '',
  date: null,
  startTime: null,
  items: [],
});

const days = [day('a', 'Kick-off'), day('b', 'Deep Dive'), day('c', 'Wrap-up')];

const renderWith = (
  Layout: typeof DayBoxes,
  props: Partial<Parameters<typeof DayBoxes>[0]> = {},
) => {
  const onSelect = vi.fn();
  render(
    <Layout
      days={days}
      activeDayId="b"
      liveDayId={null}
      dateLocale="de-DE"
      onSelect={onSelect}
      onAdd={() => null}
      onDuplicate={() => null}
      onRemove={() => {}}
      onMove={() => {}}
      onUpdate={() => {}}
      {...props}
    />,
  );
  return { onSelect };
};
const renderBoxes = (props: Partial<Parameters<typeof DayBoxes>[0]> = {}) => renderWith(DayBoxes, props);
const renderStrip = (props: Partial<Parameters<typeof DayStrip>[0]> = {}) => renderWith(DayStrip, props);

const baseProps = () => ({
  days,
  activeDayId: 'b',
  liveDayId: null,
  dateLocale: 'de-DE',
  onSelect: () => {},
  onAdd: () => null,
  onDuplicate: () => null,
  onRemove: () => {},
  onMove: () => {},
  onUpdate: () => {},
});

const dayButton = (title: string) => screen.getByRole('button', { name: new RegExp(title) });
const boxOf = (title: string) => dayButton(title).parentElement as HTMLElement;
const menuOf = (box: HTMLElement) => within(box).queryAllByRole('button', { name: 'days.options' });
const metadata = { title: 'Retreat', description: '', date: null, startTime: null };

describe('DayTabs', () => {
  it('boxes give every day a menu and only the active day the controls', () => {
    renderBoxes({ activeControls: <input aria-label="controls" /> });

    expect(within(screen.getByRole('group')).getAllByRole('button', { name: /Kick-off|Deep Dive|Wrap-up/ })).toHaveLength(3);
    for (const title of ['Kick-off', 'Deep Dive', 'Wrap-up']) expect(menuOf(boxOf(title))).toHaveLength(1);
    expect(within(boxOf('Deep Dive')).getByLabelText('controls')).toBeTruthy();
    expect(within(boxOf('Kick-off')).queryByLabelText('controls')).toBeNull();
  });

  it('the mobile strip keeps the menu on the active day', () => {
    renderStrip();

    expect(menuOf(boxOf('Deep Dive'))).toHaveLength(1);
    expect(menuOf(boxOf('Kick-off'))).toHaveLength(0);
  });

  it('keeps the focus ring inside the clipping day box', () => {
    renderBoxes();

    expect(boxOf('Deep Dive').className).toContain('overflow-hidden');
    expect(dayButton('Deep Dive').className).toContain('focus-visible:-outline-offset-2');
  });

  it('marks only the shown day as current', () => {
    renderBoxes();

    expect(dayButton('Deep Dive').getAttribute('aria-current')).toBe('true');
    expect(dayButton('Kick-off').getAttribute('aria-current')).toBeNull();
    expect(screen.queryByRole('tablist')).toBeNull();
  });

  it('Home and End jump to the first and last day, arrows wrap around', () => {
    const { onSelect } = renderBoxes({ activeDayId: 'c' });

    fireEvent.keyDown(dayButton('Wrap-up'), { key: 'Home' });
    expect(onSelect).toHaveBeenLastCalledWith('a');
    fireEvent.keyDown(dayButton('Wrap-up'), { key: 'End' });
    expect(onSelect).toHaveBeenLastCalledWith('c');
    fireEvent.keyDown(dayButton('Wrap-up'), { key: 'ArrowRight' });
    expect(onSelect).toHaveBeenLastCalledWith('a');
  });

  it('asks before deleting a day with blocks, not an empty one', async () => {
    const onRemove = vi.fn();
    const filled = { ...day('b', 'Deep Dive'), items: [{ id: 'x', type: 'block' as const, blockTypeId: null, title: 'X', duration: 5, notes: '', material: '' }] };
    renderStrip({ days: [days[0], filled, days[2]], onRemove });

    fireEvent.keyDown(screen.getByRole('button', { name: 'days.options' }), { key: 'Enter' });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'days.delete' }));
    expect(onRemove).not.toHaveBeenCalled();

    fireEvent.click(await screen.findByRole('button', { name: 'days.deleteConfirmAction' }));
    expect(onRemove).toHaveBeenCalledWith('b');
  });

  it('arrow keys switch days on a day button but not inside the controls', () => {
    const { onSelect } = renderBoxes({ activeControls: <input aria-label="controls" /> });

    fireEvent.keyDown(screen.getByLabelText('controls'), { key: 'ArrowRight' });
    expect(onSelect).not.toHaveBeenCalled();

    fireEvent.keyDown(dayButton('Deep Dive'), { key: 'ArrowRight' });
    expect(onSelect).toHaveBeenCalledWith('c');
  });
});

describe('DayTabs when the boxes do not fit', () => {
  // Every box 100 wide: three of them need 100 * 3 + 2 gaps of 8 + 40 for the add button = 356.
  // The day list button makes its box 24 wider.
  const setSpace = (space: number) => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(space);
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
      if (this.hasAttribute('data-day-list')) return 24;
      return this.querySelector('[data-day-list]') ? 124 : 100;
    });
  };
  const dayList = () => screen.queryByRole('button', { name: 'days.switch' });
  const addButton = () => screen.queryByRole('button', { name: 'days.add' });

  afterEach(() => vi.restoreAllMocks());

  it('shows all boxes with the add button while they fit', () => {
    setSpace(356);
    renderBoxes();

    expect(dayList()).toBeNull();
    expect(addButton()).not.toBeNull();
    expect(boxOf('Kick-off').className).not.toContain('invisible');
  });

  it('keeps only the active box and gives it the day list when they do not fit', () => {
    setSpace(355);
    renderBoxes();

    expect(within(boxOf('Deep Dive')).getByRole('button', { name: 'days.switch' })).toBeTruthy();
    expect(boxOf('Deep Dive').className).not.toContain('invisible');
    expect(boxOf('Kick-off').className).toContain('invisible');
    expect(boxOf('Wrap-up').className).toContain('invisible');
    expect(addButton()).toBeNull();
  });

  it('shows all boxes again once there is room, without counting the day list button', () => {
    setSpace(355);
    const { rerender } = render(<DayBoxes {...baseProps()} />);
    expect(dayList()).not.toBeNull();

    // Exactly at the limit it stays collapsed, so rounded widths cannot make it flip.
    rerender(<DayBoxes {...baseProps()} />);
    expect(dayList()).not.toBeNull();

    vi.restoreAllMocks();
    setSpace(358);
    rerender(<DayBoxes {...baseProps()} />);
    expect(dayList()).toBeNull();
  });

  it('treats a hidden layout as fitting', () => {
    setSpace(0);
    renderBoxes();
    expect(dayList()).toBeNull();
  });

  it('keeps the mobile strip as it is', () => {
    setSpace(10);
    renderStrip();
    expect(dayList()).toBeNull();
    expect(addButton()).not.toBeNull();
  });

  it('hides the list while the title is edited', () => {
    setSpace(10);
    renderBoxes();
    fireEvent.click(dayButton('Deep Dive'));
    expect(dayList()).toBeNull();
  });

  const openList = () => {
    fireEvent.keyDown(dayList()!, { key: 'Enter' });
    return waitFor(() => screen.getAllByRole('menuitem'));
  };

  it('lists all days and switches to the picked one', async () => {
    setSpace(10);
    const { onSelect } = renderBoxes();

    const items = await openList();
    expect(items.slice(0, 3).map((item) => item.textContent)).toEqual(['Kick-off', 'Deep Dive', 'Wrap-up']);

    fireEvent.click(items[2]);
    expect(onSelect).toHaveBeenCalledWith('c');
  });

  it('does not select the active day again', async () => {
    setSpace(10);
    const { onSelect } = renderBoxes();

    const items = await openList();
    fireEvent.click(items[1]);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('offers adding a day in the list', async () => {
    setSpace(10);
    const onAdd = vi.fn(() => null);
    renderBoxes({ onAdd });

    const items = await openList();
    expect(items[3].textContent).toBe('days.add');
    fireEvent.click(items[3]);
    expect(onAdd).toHaveBeenCalledOnce();
  });
});

describe('DayTabs title', () => {
  const titleInput = () => screen.queryByRole('textbox', { name: 'days.rename' }) as HTMLInputElement | null;

  it('a click on the selected day edits its title and Enter saves it', () => {
    const onUpdate = vi.fn();
    const { onSelect } = renderBoxes({ onUpdate });

    fireEvent.click(dayButton('Deep Dive'));
    expect(onSelect).not.toHaveBeenCalled();
    expect(titleInput()?.value).toBe('Deep Dive');

    fireEvent.change(titleInput()!, { target: { value: 'Vertiefung' } });
    fireEvent.keyDown(titleInput()!, { key: 'Enter' });
    expect(onUpdate).toHaveBeenCalledWith('b', { title: 'Vertiefung' });
    expect(titleInput()).toBeNull();
  });

  it('Escape discards the edit', () => {
    const onUpdate = vi.fn();
    renderBoxes({ onUpdate });

    fireEvent.click(dayButton('Deep Dive'));
    fireEvent.change(titleInput()!, { target: { value: 'Vertiefung' } });
    fireEvent.keyDown(titleInput()!, { key: 'Escape' });
    expect(onUpdate).not.toHaveBeenCalled();
    expect(titleInput()).toBeNull();
  });

  it('a click on another day only selects it', () => {
    const { onSelect } = renderBoxes();

    fireEvent.click(dayButton('Kick-off'));
    expect(onSelect).toHaveBeenCalledWith('a');
    expect(titleInput()).toBeNull();
  });
});

describe('DayControls', () => {
  const trigger = (container: HTMLElement) => container.querySelector('[data-date-trigger]') as HTMLElement;
  const renderControls = (props: Partial<Parameters<typeof DayControls>[0]> = {}) =>
    render(<DayControls metadata={metadata} totalDuration={30} onUpdate={() => {}} {...props} />).container;

  it('shows foreground icons in the day box', () => {
    expect(trigger(renderControls({ strongIcons: true })).className).toContain('text-foreground');
  });

  it('keeps muted icons elsewhere', () => {
    expect(trigger(renderControls()).className).toContain('text-muted-foreground');
  });

  it('keeps the highlight of a set date', () => {
    const container = renderControls({ strongIcons: true, metadata: { ...metadata, date: '2026-11-10' } });
    expect(trigger(container).className).toContain('text-primary-text');
  });
});

describe('WorkshopHeader', () => {
  const renderHeader = (props: Partial<Parameters<typeof WorkshopHeader>[0]> = {}) =>
    render(
      <WorkshopHeader metadata={metadata} totalDuration={30} onUpdate={() => {}} onMenuClick={() => {}} asHeading {...props} />,
    );

  it('holds only the title in title-only mode', () => {
    const { container } = renderHeader({ titleOnly: true });

    expect(container.querySelector('[data-session-title-input]')).not.toBeNull();
    expect(container.querySelector('[data-date-trigger]')).toBeNull();
    expect(container.querySelector('[data-start-time-trigger]')).toBeNull();
  });

  it('names the active day for print and frees the width of the title', () => {
    const { container } = renderHeader({ titleOnly: true, printDayLabel: 'Samstag' });

    expect(screen.getByText(/Samstag/).className).toContain('print:inline');
    expect(container.querySelector('header')?.className).toContain('print:max-w-none');
    expect(container.querySelector('h1')?.textContent).not.toContain('Samstag');
  });

  it('prints no day name for a single-day plan', () => {
    renderHeader();
    expect(screen.queryByText(/^· /)).toBeNull();
  });

  it('keeps the controls otherwise', () => {
    const { container } = renderHeader();

    expect(container.querySelector('[data-date-trigger]')).not.toBeNull();
    expect(container.querySelector('[data-start-time-trigger]')).not.toBeNull();
  });

  it('offers a further day next to the open date popover', async () => {
    const onAddDay = vi.fn();
    const { container } = renderHeader({ onAddDay });
    const inHeaderRow = () => container.querySelectorAll('[data-date-trigger] ~ button:not([data-start-time-trigger])');
    const inPopover = () => document.querySelector('[data-radix-popper-content-wrapper] button') as HTMLButtonElement | null;

    expect(inPopover()).toBeNull();
    expect(inHeaderRow()).toHaveLength(0);

    fireEvent.click(container.querySelector('[data-date-trigger]') as HTMLElement);
    const button = await waitFor(() => {
      expect(inPopover()).not.toBeNull();
      return inPopover()!;
    });
    expect(button.textContent).toBe('');
    expect(button.getAttribute('aria-label')).toBeTruthy();

    fireEvent.click(button);
    expect(onAddDay).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(inPopover()).toBeNull());
  });

  it('offers a further day next to the header', () => {
    const onAddDay = vi.fn();
    const { container } = renderHeader({ onAddDay });

    const button = container.querySelector('header + div button') as HTMLButtonElement;
    expect(button.textContent).toBe('');
    expect(button.getAttribute('aria-label')).toBeTruthy();
    fireEvent.click(button);
    expect(onAddDay).toHaveBeenCalledTimes(1);
  });
});
