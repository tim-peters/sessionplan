/**
 * WorkshopDescription — session description edit-mode behavior.
 *
 * The description previously used a bare shadcn Textarea without any
 * formatting support. It now renders FormattedTextField so editing gets the
 * same formatting toolbar / live formatting preview as the timeline blocks.
 *
 * Covers:
 *  - Clicking the display text opens an editor containing a textarea tagged
 *    with data-session-description (the global "D" keyboard shortcut and
 *    focusSessionElement rely on this attribute).
 *  - The editor is autofocused.
 *  - Selecting text shows the formatting toolbar; Bold wraps ONLY the
 *    selection and reports the new value through onUpdate.
 *  - Blur closes the editor again.
 */
import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { WorkshopDescription } from '@/modules/timeline/WorkshopDescription';

/** Flush rAF (initialCaretPoint caret placement) + setTimeout(0)
 *  (deferred selection-state reads) scheduled outside event handlers. */
const flushTimers = async () => {
  await act(async () => {
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    await new Promise<void>((r) => setTimeout(r, 0));
  });
};

const Harness = ({ initialValue, onUpdate }: { initialValue: string; onUpdate?: (v: string) => void }) => {
  const [value, setValue] = useState(initialValue);
  return (
    <WorkshopDescription
      description={value}
      onUpdate={(v) => {
        onUpdate?.(v);
        setValue(v);
      }}
    />
  );
};

describe('WorkshopDescription edit mode', () => {
  it('opens an autofocused editor with the data-session-description hook on the textarea', async () => {
    render(<WorkshopDescription description="hello world" onUpdate={() => {}} />);
    const trigger = document.querySelector('[data-session-description]') as HTMLButtonElement;
    expect(trigger).toBeTruthy();
    expect(trigger.tagName).toBe('BUTTON');

    fireEvent.click(trigger);
    await flushTimers();

    const textarea = document.querySelector('[data-session-description]') as HTMLTextAreaElement;
    expect(textarea).toBeTruthy();
    expect(textarea.tagName).toBe('TEXTAREA');
    expect(textarea.value).toBe('hello world');
    expect(document.activeElement).toBe(textarea);
  });

  it('shows the formatting toolbar on selection and Bold wraps only the selection', async () => {
    const onUpdate = vi.fn();
    render(<Harness initialValue="hello world" onUpdate={onUpdate} />);
    fireEvent.click(document.querySelector('[data-session-description]') as HTMLButtonElement);
    await flushTimers();

    const textarea = document.querySelector('[data-session-description]') as HTMLTextAreaElement;
    textarea.setSelectionRange(0, 5);
    fireEvent.mouseUp(textarea);
    expect(screen.queryByTitle(/Fett/)).toBeTruthy();

    fireEvent.click(screen.getByTitle(/Fett/) as HTMLButtonElement);

    // Fallback path in jsdom (no execCommand): the new text is reported
    // through onChange → onUpdate exactly once.
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith('*hello* world');

    await flushTimers();
  });

  it('closes the editor on blur and returns to the display text', async () => {
    render(<WorkshopDescription description="hello world" onUpdate={() => {}} />);
    fireEvent.click(document.querySelector('[data-session-description]') as HTMLButtonElement);
    await flushTimers();

    const textarea = document.querySelector('[data-session-description]') as HTMLTextAreaElement;
    expect(textarea.tagName).toBe('TEXTAREA');

    fireEvent.blur(textarea);
    const trigger = document.querySelector('[data-session-description]') as HTMLButtonElement;
    expect(trigger.tagName).toBe('BUTTON');
    expect(trigger.textContent).toContain('hello world');
  });
});
