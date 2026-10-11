/**
 * FormattedTextField — formatting toolbar UX behavior tests.
 *
 * Covers the spec requirements that aren't unit-testable in isolation:
 *  - Toolbar visibility: focused && (hasSelection || activeFormatKind).
 *    A collapsed caret INSIDE a formatted run keeps the toolbar visible
 *    with the matching button pressed (toggle-off via click or Cmd+B/I/K).
 *  - Toolbar hides on selection collapse to a plain-text caret, on blur,
 *    or when focus leaves the field.
 *  - Bold click wraps ONLY the selection (paragraph regression); when the
 *    caret/selection sits in an active bold region, Bold toggles it off
 *    instead of re-wrapping.
 *  - Toolbar root's pointerdown/mousedown handlers call preventDefault so
 *    the textarea keeps focus in real browsers (jsdom doesn't simulate
 *    focus stealing on click, but we verify the handler is wired).
 *  - With document.execCommand stubbed, Bold uses the native insertText
 *    path and the caller does NOT call onChange twice (native undo
 *    integration contract).
 *  - `initialSelection` opens the field with the given range already
 *    selected (selection carried from a formatted preview click).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent, createEvent, act } from '@testing-library/react';
import { FormattedTextField } from '@/components/atoms/FormattedTextField';

/** Minimal stateful harness so onChange can update the value via React. */
const Harness = ({
  initialValue = '',
  onChange,
}: {
  initialValue?: string;
  onChange?: (v: string) => void;
}) => {
  const [value, setValue] = useState(initialValue);
  return (
    <FormattedTextField
      value={value}
      onChange={(v) => {
        onChange?.(v);
        setValue(v);
      }}
    />
  );
};

/** Flush pending setTimeout(0) callbacks (selection-state refresh after
 *  wrapSelection / handleChange). Without this, React commits that happen
 *  outside the event handler can fire act() warnings. */
const flushMacrotasks = async () => {
  await act(async () => {
    await new Promise<void>((r) => setTimeout(r, 0));
  });
};

/** Flush the pending requestAnimationFrame (initialCaretPoint /
 *  initialSelection caret+selection placement) and the deferred
 *  setTimeout(0) selection-state refresh behind it. */
const flushFrameAndMacrotasks = async () => {
  await act(async () => {
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    await new Promise<void>((r) => setTimeout(r, 0));
  });
};

/** Replace the textarea's underlying value (simulates React committing
 *  the onChange update) and flush the deferred setTimeout that
 *  removeFormatting / wrapSelection schedule for selection restore. */
const replaceValueAndFlush = async (textarea: HTMLTextAreaElement, value: string) => {
  textarea.value = value;
  await flushMacrotasks();
};

describe('FormattedTextField — toolbar visibility', () => {
  it('does not render the toolbar when focused but the selection is collapsed', () => {
    render(<FormattedTextField value="hello world" onChange={() => {}} />);
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    act(() => textarea.focus());
    expect(textarea.selectionStart).toBe(textarea.selectionEnd);
    expect(screen.queryByTitle(/Fett/)).toBeNull();
    expect(screen.queryByTitle(/Kursiv/)).toBeNull();
  });

  it('renders the toolbar after a non-collapsed selection is committed (mouseUp)', () => {
    render(<FormattedTextField value="hello world" onChange={() => {}} />);
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    act(() => textarea.focus());
    textarea.setSelectionRange(0, 5);
    fireEvent.mouseUp(textarea);
    expect(screen.getByTitle(/Fett/)).toBeTruthy();
    expect(screen.getByTitle(/Kursiv/)).toBeTruthy();
    expect(screen.getByTitle(/Link/)).toBeTruthy();
  });

  it('hides the toolbar when the selection collapses back to a caret', () => {
    render(<FormattedTextField value="hello world" onChange={() => {}} />);
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    act(() => textarea.focus());
    textarea.setSelectionRange(0, 5);
    fireEvent.mouseUp(textarea);
    expect(screen.queryByTitle(/Fett/)).toBeTruthy();

    textarea.setSelectionRange(2, 2);
    fireEvent.mouseUp(textarea);
    expect(screen.queryByTitle(/Fett/)).toBeNull();
  });

  it('hides the toolbar when the textarea loses focus (blur)', () => {
    render(<FormattedTextField value="hello world" onChange={() => {}} />);
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    act(() => textarea.focus());
    textarea.setSelectionRange(0, 5);
    fireEvent.mouseUp(textarea);
    expect(screen.queryByTitle(/Fett/)).toBeTruthy();

    fireEvent.blur(textarea);
    expect(screen.queryByTitle(/Fett/)).toBeNull();
  });
});

describe('FormattedTextField — toolbar interactions', () => {
  it('clicking Bold with a selection wraps ONLY the selection and leaves surrounding text untouched', () => {
    const onChange = vi.fn();
    render(<Harness initialValue="hello world" onChange={onChange} />);
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    act(() => textarea.focus());
    textarea.setSelectionRange(0, 5);
    fireEvent.mouseUp(textarea);

    const boldButton = screen.getByTitle(/Fett/) as HTMLButtonElement;
    fireEvent.click(boldButton);

    // Fallback path (jsdom has no execCommand): wrapSelection returns the
    // new text, the caller passes it to onChange exactly once.
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('*hello* world');

    // Surrounding text is preserved (paragraph regression).
    const [[newValue]] = onChange.mock.calls as [[string]];
    expect(newValue.endsWith(' world')).toBe(true);
    expect(newValue.startsWith('*hello*')).toBe(true);

    // Focus stays on the textarea (jsdom doesn't simulate focus stealing
    // on click, so this passes regardless of preventDefault — but the
    // pointerdown/mousedown handler test below proves the handler is wired
    // for real browsers).
    expect(document.activeElement).toBe(textarea);
  });

  it('calls preventDefault on pointerdown and mousedown of the toolbar root to keep textarea focus', () => {
    render(<FormattedTextField value="hello world" onChange={() => {}} />);
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    act(() => textarea.focus());
    textarea.setSelectionRange(0, 5);
    fireEvent.mouseUp(textarea);

    const boldButton = screen.getByTitle(/Fett/) as HTMLButtonElement;
    const toolbarRoot = boldButton.parentElement as HTMLElement;
    expect(toolbarRoot).toBeTruthy();
    expect(toolbarRoot).not.toBe(textarea);

    // Dispatch each event ourselves and assert the handler invoked
    // preventDefault on it. RTL's fireEvent returns the result of
    // element.dispatchEvent (false if defaultPrevented).
    const pointerEvent = createEvent.pointerDown(toolbarRoot);
    expect(fireEvent(toolbarRoot, pointerEvent)).toBe(false);
    expect(pointerEvent.defaultPrevented).toBe(true);

    const mouseEvent = createEvent.mouseDown(toolbarRoot);
    expect(fireEvent(toolbarRoot, mouseEvent)).toBe(false);
    expect(mouseEvent.defaultPrevented).toBe(true);

    // Focus is still on the textarea after both events.
    expect(document.activeElement).toBe(textarea);
  });

  it('renders editing text in foreground color, even when mounted inside muted containers', () => {
    // Notes/material previews sit in `text-muted-foreground` wrappers; while
    // a field is being edited its text must read as regular foreground text.
    const { container } = render(<FormattedTextField value="hello world" onChange={() => {}} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('text-foreground');
  });

  it('styles backdrop bold metrics-neutrally so the caret stays aligned with the visible text', () => {
    // The transparent textarea draws caret + selection from its own
    // regular-weight layout. If the backdrop used a real font-weight, its
    // glyphs would be wider and the visible caret would drift away from the
    // visible text (reported for bold+italic runs). Bold must therefore use
    // the paint-only faux-bold stroke, never a font-weight class.
    const { container } = render(<FormattedTextField value="*hello* world" onChange={() => {}} />);
    const backdrop = container.querySelector('div[aria-hidden]') as HTMLElement;
    expect(backdrop).toBeTruthy();

    const boldSpan = [...backdrop.querySelectorAll('span')].find((s) => s.textContent === 'hello');
    expect(boldSpan).toBeTruthy();
    expect(boldSpan!.className).toContain('formatting-faux-bold');

    // No backdrop span may carry a metric-changing font-weight class.
    for (const span of [...backdrop.querySelectorAll('span')]) {
      expect(span.className).not.toContain('font-bold');
    }
  });

  it('portals the toolbar to document.body with position:fixed so overflow:hidden ancestors cannot clip it', () => {
    render(<FormattedTextField value="hello world" onChange={() => {}} />);
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    act(() => textarea.focus());
    textarea.setSelectionRange(0, 5);
    fireEvent.mouseUp(textarea);

    const boldButton = screen.getByTitle(/Fett/) as HTMLButtonElement;
    const toolbarRoot = boldButton.parentElement as HTMLElement;

    // The toolbar must NOT live inside the field's DOM subtree — otherwise
    // overflow:hidden ancestors (workshop header card, title wrappers)
    // would clip it, especially after a below-flip on single-line fields.
    expect(textarea.parentElement?.contains(toolbarRoot)).toBe(false);
    expect(toolbarRoot.parentElement).toBe(document.body);

    // Fixed positioning keeps it viewport-anchored and immune to ancestor
    // clipping/scrolling (the class applies position:fixed via Tailwind).
    expect(toolbarRoot.className).toContain('fixed');
    expect(toolbarRoot.className).not.toContain('absolute');
  });

  it('with execCommand stubbed true, Bold uses the native insertText path and does not double-invoke onChange', async () => {
    type ExecCommandFn = (commandId: string, showUI?: boolean, value?: string) => boolean;
    const execCommandSpy = vi.fn(() => true);
    const origExec = (document as Document & { execCommand?: ExecCommandFn }).execCommand;
    (document as Document & { execCommand?: ExecCommandFn }).execCommand = execCommandSpy;

    try {
      const onChange = vi.fn();
      render(<Harness initialValue="hello world" onChange={onChange} />);
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      act(() => textarea.focus());
      textarea.setSelectionRange(0, 5);
      fireEvent.mouseUp(textarea);

      const boldButton = screen.getByTitle(/Fett/) as HTMLButtonElement;
      fireEvent.click(boldButton);

      // Native undo path: execCommand('insertText', …) carries the wrapped
      // text. This is what enters the browser's native undo history.
      expect(execCommandSpy).toHaveBeenCalledWith('insertText', false, '*hello*');

      // Caller contract: wrapSelection returns null on the native path so
      // the caller MUST NOT call onChange again. In a real browser React's
      // onChange fires once from the input event; in jsdom the stubbed
      // execCommand doesn't fire the event, so onChange runs 0 times. Either
      // way it must not run twice — that's the regression we're guarding.
      expect(onChange.mock.calls.length).toBeLessThanOrEqual(1);

      // Flush any pending post-click timers so we exit cleanly without
      // an act() warning.
      await flushMacrotasks();
    } finally {
      // jsdom starts without execCommand, so delete the property we
      // installed if there was no original to restore.
      if (origExec === undefined) {
        delete (document as Document & { execCommand?: ExecCommandFn }).execCommand;
      } else {
        (document as Document & { execCommand?: ExecCommandFn }).execCommand = origExec;
      }
    }
  });
});

// ── Active format / toggle-off ─────────────────────────────────────────────

/** Render a controlled field, focus it, place the caret, fire mouseUp so
 *  the toolbar refreshes. Returns the textarea and the bold button. */
const setupCaretInside = (initialValue: string, caret: number) => {
  render(<Harness initialValue={initialValue} />);
  const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
  act(() => textarea.focus());
  textarea.setSelectionRange(caret, caret);
  fireEvent.mouseUp(textarea);
  const boldButton = screen.queryByTitle(/Fett/) as HTMLButtonElement | null;
  return { textarea, boldButton };
};

describe('FormattedTextField — toolbar active state (caret inside formatted run)', () => {
  it('shows the toolbar with the bold button pressed when the caret sits inside *hello* world', () => {
    const { textarea, boldButton } = setupCaretInside('*hello* world', 3);
    expect(textarea.selectionStart).toBe(textarea.selectionEnd);
    expect(boldButton).toBeTruthy();
    expect(boldButton.getAttribute('aria-pressed')).toBe('true');
    // The other two buttons stay inactive.
    expect(screen.getByTitle(/Kursiv/).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByTitle(/Link/).getAttribute('aria-pressed')).toBe('false');
  });

  it('shows the italic button pressed when the caret sits inside _hello_ world', () => {
    const { boldButton } = setupCaretInside('_hello_ world', 3);
    const italicButton = screen.getByTitle(/Kursiv/) as HTMLButtonElement;
    expect(italicButton.getAttribute('aria-pressed')).toBe('true');
    expect(boldButton.getAttribute('aria-pressed')).toBe('false');
  });

  it('shows the link button pressed AND enabled when the caret sits inside link text', () => {
    setupCaretInside('[hello](https://x.test) world', 3);
    const linkButton = screen.getByTitle(/Link/) as HTMLButtonElement;
    expect(linkButton.getAttribute('aria-pressed')).toBe('true');
    // Caret inside link → link button is enabled (it can toggle the link off).
    expect(linkButton.disabled).toBe(false);
  });

  it('hides the toolbar again when the caret moves out of the formatted run to plain text', () => {
    const { textarea } = setupCaretInside('*hello* world', 3);
    expect(screen.queryByTitle(/Fett/)).toBeTruthy();

    // Move the caret into the plain trailing word.
    textarea.setSelectionRange(9, 9);
    fireEvent.mouseUp(textarea);
    expect(screen.queryByTitle(/Fett/)).toBeNull();
  });

  // ── Nested formatting (bold + italic chain) ──────────────────────────────

  it('presses BOTH bold and italic when the caret sits inside nested *_hello_* content', () => {
    setupCaretInside('*_hello_* world', 4); // inside "hello"
    expect(screen.getByTitle(/Fett/).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTitle(/Kursiv/).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTitle(/Link/).getAttribute('aria-pressed')).toBe('false');
  });

  it('presses only bold when the caret sits between the bold and italic markers', () => {
    // *_hello_*: raw 1 sits after the bold `*` but before the italic `_`.
    setupCaretInside('*_hello_* world', 1);
    expect(screen.getByTitle(/Fett/).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTitle(/Kursiv/).getAttribute('aria-pressed')).toBe('false');
  });

  it('clicking italic in a nested chain removes only the italic layer', async () => {
    const onChange = vi.fn();
    render(<Harness initialValue="*_hello_* world" onChange={onChange} />);
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    act(() => textarea.focus());
    textarea.setSelectionRange(4, 4);
    fireEvent.mouseUp(textarea);

    fireEvent.click(screen.getByTitle(/Kursiv/));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('*hello* world');
  });

  it('clicking bold in a nested chain removes only the bold layer', async () => {
    const onChange = vi.fn();
    render(<Harness initialValue="*_hello_* world" onChange={onChange} />);
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    act(() => textarea.focus());
    textarea.setSelectionRange(4, 4);
    fireEvent.mouseUp(textarea);

    fireEvent.click(screen.getByTitle(/Fett/));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('_hello_ world');
  });

  it('applying italic to a partial selection inside bold nests the syntax (renders correctly)', async () => {
    // The user's original complaint: part of a bold run made italic. The
    // recursive tokenizer renders `*h_ell_o*` as bold(h, o) + bold-italic(ell).
    const onChange = vi.fn();
    render(<Harness initialValue="*hello* world" onChange={onChange} />);
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    act(() => textarea.focus());
    textarea.setSelectionRange(2, 5); // "ell" inside the bold content
    fireEvent.mouseUp(textarea);

    // Nothing is active for a partial selection — all buttons unpressed.
    expect(screen.getByTitle(/Fett/).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByTitle(/Kursiv/).getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(screen.getByTitle(/Kursiv/));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('*h_ell_o* world');
  });

  it('clicking the active bold button removes the bold markers (toggle off, collapsed caret)', async () => {
    const onChange = vi.fn();
    render(<Harness initialValue="*hello* world" onChange={onChange} />);
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    act(() => textarea.focus());
    textarea.setSelectionRange(3, 3);
    fireEvent.mouseUp(textarea);

    const boldButton = screen.getByTitle(/Fett/) as HTMLButtonElement;
    expect(boldButton.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(boldButton);

    // Fallback path: removeFormatting returns the new text once.
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('hello world');

    // After flushing the deferred setTimeout, the caret lands inside the
    // surviving content at the same relative offset (was 3, contentStart 1,
    // so the new offset is 2).
    await replaceValueAndFlush(textarea, 'hello world');
    expect(textarea.selectionStart).toBe(2);
    expect(textarea.selectionStart).toBe(textarea.selectionEnd);
  });

  it('clicking the active link button removes the link syntax (toggle off, collapsed caret)', () => {
    const onChange = vi.fn();
    render(<Harness initialValue="[hello](https://x.test) world" onChange={onChange} />);
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    act(() => textarea.focus());
    textarea.setSelectionRange(3, 3);
    fireEvent.mouseUp(textarea);

    const linkButton = screen.getByTitle(/Link/) as HTMLButtonElement;
    expect(linkButton.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(linkButton);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('hello world');
  });

  it('a non-collapsed selection that exactly spans the full bold region is active and removes on click', async () => {
    const onChange = vi.fn();
    render(<Harness initialValue="*hello* world" onChange={onChange} />);
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    act(() => textarea.focus());
    textarea.setSelectionRange(0, 7); // exactly the bold region with syntax
    fireEvent.mouseUp(textarea);

    const boldButton = screen.getByTitle(/Fett/) as HTMLButtonElement;
    expect(boldButton.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(boldButton);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('hello world');

    // After flushing: the surviving content "hello" stays selected (so the
    // user can toggle the formatting back on with another click), and the
    // bold button is no longer pressed.
    await replaceValueAndFlush(textarea, 'hello world');
    expect(textarea.selectionStart).toBe(0);
    expect(textarea.selectionEnd).toBe(5);
    expect(screen.getByTitle(/Fett/).getAttribute('aria-pressed')).toBe('false');
  });

  it('a partial selection inside a formatted run is NOT active (toolbar buttons stay unpressed, click still wraps)', () => {
    const onChange = vi.fn();
    render(<Harness initialValue="*hello* world" onChange={onChange} />);
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    act(() => textarea.focus());
    // Partial overlap inside the bold region: covers only "ell".
    textarea.setSelectionRange(2, 5);
    fireEvent.mouseUp(textarea);

    const boldButton = screen.getByTitle(/Fett/) as HTMLButtonElement;
    expect(boldButton.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(boldButton);
    // The wrap fallback wraps only the partial selection (same as plain-text
    // wrap behavior). The selection covers "ell" (indexes 2–5), so the new
    // text nests the wrap around "ell" while the original markers survive:
    // `*h` + `*ell*` + `o* world`.
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('*h*ell*o* world');
  });
});

// ── initialSelection prop ──────────────────────────────────────────────────

describe('FormattedTextField — initialSelection prop', () => {
  it('opens with the given range selected and the toolbar visible after the rAF + macrotask flush', async () => {
    render(<FormattedTextField value="hello world" onChange={() => {}} initialSelection={{ start: 0, end: 5 }} />);
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    act(() => textarea.focus());

    // The selection takes effect inside an rAF, then the deferred
    // scheduleSelectionStateUpdate fires in a macrotask. Both must run
    // before the toolbar reads "focused && hasSelection".
    await flushFrameAndMacrotasks();

    expect(textarea.selectionStart).toBe(0);
    expect(textarea.selectionEnd).toBe(5);
    expect(screen.getByTitle(/Fett/)).toBeTruthy();
  });
});

// ── Double-click emulation (preview → editor transition) ───────────────────

describe('FormattedTextField — double-click word selection emulation', () => {
  /** Render with an opening click point (as the preview click would pass),
   *  focus, and simulate the browser's mousedown caret placement for the
   *  second click by setting the caret explicitly (jsdom doesn't place it). */
  const setupOpenedAtPoint = async (value: string, caret: number) => {
    render(<FormattedTextField value={value} onChange={() => {}} initialCaretPoint={{ x: 100, y: 100 }} />);
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    act(() => textarea.focus());
    await flushFrameAndMacrotasks();
    textarea.setSelectionRange(caret, caret);
    return textarea;
  };

  it('a quick second click near the opening point selects the containing word run', async () => {
    const textarea = await setupOpenedAtPoint('Hallo Welt Test', 8); // inside "Welt"
    fireEvent.click(textarea, { clientX: 100, clientY: 100 });
    await flushMacrotasks();

    expect(textarea.selectionStart).toBe(6);
    expect(textarea.selectionEnd).toBe(10);
    // The word selection makes the toolbar visible.
    expect(screen.getByTitle(/Fett/)).toBeTruthy();
  });

  it('a second click far from the opening point does NOT expand to a word (caret reposition)', async () => {
    const textarea = await setupOpenedAtPoint('Hallo Welt Test', 8);
    fireEvent.click(textarea, { clientX: 500, clientY: 500 });
    await flushMacrotasks();

    expect(textarea.selectionStart).toBe(8);
    expect(textarea.selectionStart).toBe(textarea.selectionEnd);
    expect(screen.queryByTitle(/Fett/)).toBeNull();
  });

  it('a second click after the double-click window does NOT expand to a word', async () => {
    const nowSpy = vi.spyOn(performance, 'now');
    try {
      let fakeNow = 1000;
      nowSpy.mockImplementation(() => fakeNow);
      const textarea = await setupOpenedAtPoint('Hallo Welt Test', 8);
      fakeNow += 600; // beyond DBLCLICK_MS
      fireEvent.click(textarea, { clientX: 100, clientY: 100 });
      await flushMacrotasks();

      expect(textarea.selectionStart).toBe(8);
      expect(textarea.selectionStart).toBe(textarea.selectionEnd);
      expect(screen.queryByTitle(/Fett/)).toBeNull();
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('a pending opening rAF does not clobber the emulated word selection (fast second click)', async () => {
    render(<FormattedTextField value="Hallo Welt Test" onChange={() => {}} initialCaretPoint={{ x: 100, y: 100 }} />);
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    act(() => textarea.focus());
    // Second click arrives BEFORE the opening rAF ran (automation-speed
    // double-click). The browser's mousedown already placed the caret —
    // simulated here by setting it explicitly.
    textarea.setSelectionRange(8, 8);
    fireEvent.click(textarea, { clientX: 100, clientY: 100 });
    // NOW the opening rAF fires — it must not reset the caret to the
    // opening point.
    await flushFrameAndMacrotasks();

    expect(textarea.selectionStart).toBe(6);
    expect(textarea.selectionEnd).toBe(10);
    expect(screen.getByTitle(/Fett/)).toBeTruthy();
  });
});
