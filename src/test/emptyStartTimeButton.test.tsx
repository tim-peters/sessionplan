/**
 * Empty start time button — replaces the "+ Start time" nudge left of the
 * session description.
 *
 * While the plan or active day has no start time, an unfilled grey time badge
 * (`--:--`) sits next to the description. A click opens the start time flyout
 * of the day controls; once a time is set, the badge is gone.
 */
import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DayControls } from '@/modules/planner/DayControls';
import { WorkshopDescription } from '@/modules/timeline/WorkshopDescription';
import type { WorkshopMetadata } from '@/types/workshop';

const emptyButton = () => document.querySelector<HTMLElement>('[data-empty-start-time]');

describe('empty start time button', () => {
  it('shows next to the description while there is no start time', () => {
    render(<WorkshopDescription description="Beschreibung" startTime={null} />);

    expect(emptyButton()?.textContent).toBe('--:--');
  });

  it('calls back on click', () => {
    const onAddStartTimeClick = vi.fn();
    render(<WorkshopDescription description="" startTime={null} onAddStartTimeClick={onAddStartTimeClick} />);

    fireEvent.click(emptyButton()!);

    expect(onAddStartTimeClick).toHaveBeenCalledTimes(1);
  });

  it('is named for assistive technology, grey and left out of print', () => {
    render(<WorkshopDescription description="" startTime={null} />);

    const button = emptyButton()!;
    expect(button.getAttribute('aria-label')).toBeTruthy();
    expect(button.className).toContain('time-badge');
    expect(button.className).toContain('print:hidden');
    expect(button.className).not.toContain('text-primary-text');
  });

  it('stays away once a start time is set', () => {
    render(<WorkshopDescription description="Beschreibung" startTime="09:00" />);

    expect(emptyButton()).toBeNull();
  });

  it('sits beside the date of a plan without start time', () => {
    render(<WorkshopDescription description="" date="2026-11-04" startTime={null} />);

    expect(emptyButton()).not.toBeNull();
    expect(screen.getByText(/2026/)).toBeTruthy();
  });

  it('shares one centred row with the date on phones, without the tall touch size', () => {
    render(<WorkshopDescription description="" date="2026-11-04" startTime={null} />);

    const button = emptyButton()!;
    const row = button.parentElement!;
    expect(row).toBe(screen.getByText(/2026/).parentElement);
    expect(row.className).toContain('flex-row');
    expect(row.className).toContain('items-center');
    expect(button.className).toContain('[@media(pointer:coarse)]:!min-h-6');
  });
});

describe('empty start time button with the day controls', () => {
  /** The wiring of WorkshopPlanner: one flyout state, controls and description of the active day. */
  const Harness = () => {
    const [starts, setStarts] = useState<Record<string, string | null>>({ a: null, b: null });
    const [activeDay, setActiveDay] = useState('a');
    const [open, setOpen] = useState(false);
    const startTime = starts[activeDay];
    return (
      <>
        <button onClick={() => setActiveDay('b')}>switch day</button>
        <DayControls
          metadata={{ title: activeDay, date: null, startTime, description: '' } as WorkshopMetadata}
          totalDuration={15}
          onUpdate={(updates) => {
            if ('startTime' in updates) {
              setStarts((current) => ({ ...current, [activeDay]: updates.startTime ?? null }));
            }
          }}
          startTimePopoverOpen={open}
          onStartTimePopoverOpenChange={setOpen}
        />
        <WorkshopDescription
          description=""
          startTime={startTime}
          onAddStartTimeClick={() => setOpen(true)}
        />
      </>
    );
  };

  it('sets the start time of the active day through the flyout', async () => {
    render(<Harness />);

    fireEvent.click(emptyButton()!);
    const input = await waitFor(() => {
      const found = document.querySelector<HTMLInputElement>('input[type="time"]');
      expect(found).not.toBeNull();
      return found!;
    });
    fireEvent.change(input, { target: { value: '09:00' } });

    expect(emptyButton()).toBeNull();

    // The other day keeps its own, still missing start time.
    fireEvent.keyDown(input, { key: 'Escape' });
    fireEvent.click(screen.getByText('switch day'));
    expect(emptyButton()).not.toBeNull();
  });
});
