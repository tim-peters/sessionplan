/**
 * BreakoutCard sameInAllBreakouts toggle — regression test.
 *
 * After splitting BreakoutCard.tsx into BreakoutCard + breakout/ sub-components,
 * `SameInAllLanesView` referenced `onAddChild` in its JSX but the prop was
 * missing from both the interface and the destructure (and the parent
 * BreakoutCard never passed it). When the user toggled "all rooms equal",
 * the conditional `{onAddChild && ...}` threw `ReferenceError: onAddChild
 * is not defined`.
 *
 * This test verifies:
 *   1. SameInAllLanesView does not throw on render
 *   2. The "Add block" button calls onAddChild when clicked
 *   3. Toggling from sameInAllBreakouts=false → true does not throw
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { HelmetProvider } from 'react-helmet-async';
import { DndContext } from '@dnd-kit/core';
import { LocaleProvider } from '@/contexts/LocaleContext';
import { LibraryProvider } from '@/contexts/LibraryContext';
import { DragDropProvider } from '@/hooks/useDragDropContext';
import { BreakoutCard } from '@/components/sections/BreakoutCard';
import { WorkshopItem } from '@/types/workshop';

const makeBreakout = (overrides: Partial<WorkshopItem> = {}): WorkshopItem => ({
  id: 'B1',
  type: 'breakout',
  blockTypeId: null,
  title: 'Test Breakout',
  duration: 30,
  notes: '',
  material: '',
  children: [],
  parallel: true,
  lanes: 2,
  sameInAllBreakouts: false,
  ...overrides,
});

const makeBlock = (id: string, laneIndex: number): WorkshopItem => ({
  id,
  type: 'block',
  blockTypeId: null,
  title: `Block ${id}`,
  duration: 10,
  notes: '',
  material: '',
  laneIndex,
});

function wrap(node: React.ReactNode) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <HelmetProvider>
        <MemoryRouter>
          <LocaleProvider>
            <LibraryProvider>
              <DndContext>
                <DragDropProvider
                  value={{
                    activeId: null,
                    activeData: undefined,
                    activeParentId: null,
                    dropIndicator: null,
                  }}
                >
                  {node}
                </DragDropProvider>
              </DndContext>
            </LibraryProvider>
          </LocaleProvider>
        </MemoryRouter>
      </HelmetProvider>
    </QueryClientProvider>,
  );
}

const baseHandlers = {
  onUpdate: () => {},
  onDelete: () => {},
  onDuplicate: () => {},
  onSaveToLibrary: () => {},
  onEditDetails: () => {},
};

describe('BreakoutCard sameInAllBreakouts toggle — onAddChild fix', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // The breakout title is rendered inside a <BlockTitleInput> — its value
  // sits in an <input value="...">, not as text content. We query the input
  // by its data-block-id attribute.
  const findBreakoutTitleInput = () =>
    document.querySelector('input[data-block-id="B1"]') as HTMLInputElement | null;

  it('renders SameInAllLanesView with sameInAllBreakouts=true and 0 children without throwing', () => {
    const breakout = makeBreakout({ sameInAllBreakouts: true, children: [] });
    const onAddChild = vi.fn();
    wrap(
      <BreakoutCard
        item={breakout}
        blockTypes={[]}
        persons={[]}
        timeDisplay={null}
        onAddChild={onAddChild}
        {...baseHandlers}
      />,
    );
    // If SameInAllLanesView is rendering, the breakout title input is in the DOM.
    const titleInput = findBreakoutTitleInput();
    expect(titleInput).toBeTruthy();
    expect(titleInput?.value).toBe('Test Breakout');
  });

  it('renders SameInAllLanesView with sameInAllBreakouts=true and children in lane 0', () => {
    const breakout = makeBreakout({
      sameInAllBreakouts: true,
      lanes: 2,
      children: [makeBlock('A', 0), makeBlock('B', 0)],
    });
    const onAddChild = vi.fn();
    wrap(
      <BreakoutCard
        item={breakout}
        blockTypes={[]}
        persons={[]}
        timeDisplay="10:00"
        onAddChild={onAddChild}
        {...baseHandlers}
      />,
    );
    // Both blocks (in lane 0) should render — query the title inputs
    const blockA = document.querySelector('input[data-block-id="A"]') as HTMLInputElement | null;
    const blockB = document.querySelector('input[data-block-id="B"]') as HTMLInputElement | null;
    expect(blockA?.value).toBe('Block A');
    expect(blockB?.value).toBe('Block B');
  });

  it('toggling from sameInAllBreakouts=false to true does not throw', () => {
    const onAddChild = vi.fn();
    // Use a state-driven harness so we can re-render SameInAllLanesView
    // *inside* the same provider tree (not via React Testing Library's
    // top-level rerender, which would lose the DragDropProvider).
    const { useState } = require('react');
    const Harness = () => {
      const [enabled, setEnabled] = useState(false);
      const breakout = makeBreakout({
        sameInAllBreakouts: enabled,
        lanes: 2,
        children: [makeBlock('A', 0), makeBlock('B', 1)],
      });
      return (
        <>
          <button data-testid="toggle" onClick={() => setEnabled((v: boolean) => !v)}>
            toggle
          </button>
          <BreakoutCard
            item={breakout}
            blockTypes={[]}
            persons={[]}
            timeDisplay="10:00"
            onAddChild={onAddChild}
            {...baseHandlers}
          />
        </>
      );
    };
    wrap(<Harness />);
    // First render with sameInAllBreakouts=false → no error
    expect(findBreakoutTitleInput()).toBeTruthy();
    // Toggle to sameInAllBreakouts=true → must not throw
    fireEvent.click(screen.getByTestId('toggle'));
    // Breakout is still rendered
    expect(findBreakoutTitleInput()).toBeTruthy();
  });

  it('the "Add block" button (when no children) calls onAddChild with type="block", laneIndex=0', () => {
    const breakout = makeBreakout({ sameInAllBreakouts: true, children: [] });
    const onAddChild = vi.fn();
    wrap(
      <BreakoutCard
        item={breakout}
        blockTypes={[]}
        persons={[]}
        timeDisplay={null}
        onAddChild={onAddChild}
        {...baseHandlers}
      />,
    );
    // The Add block button should be visible because children.length === 0
    // and !isLg (test env uses jsdom which reports false for matchMedia).
    // The button's accessible name is the i18n key (no translations loaded in tests).
    const button = screen.getByRole('button', { name: /block\.addBlock|add block/i });
    fireEvent.click(button);
    expect(onAddChild).toHaveBeenCalledWith('block', 0);
  });
});
