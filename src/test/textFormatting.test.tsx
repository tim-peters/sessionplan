import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import {
  parseFormatting,
  autoLinkUrls,
  tokenizeFormatting,
  findFormatRegions,
  findActiveRegions,
  findActiveRegionOfKind,
  mapRenderedRangeToRaw,
  expandToWordRun,
} from '@/lib/textFormatting';
import {
  wrapSelection,
  insertLink,
  removeFormatting,
} from '@/lib/textFormattingActions';

describe('parseFormatting', () => {
  it('returns plain text when no formatting is present', () => {
    const result = parseFormatting('hello world');
    expect(result).toHaveLength(1);
    const { container } = render(<>{result}</>);
    expect(container.textContent).toBe('hello world');
  });

  it('renders *bold* as <strong>', () => {
    const { container } = render(<>{parseFormatting('a *bold* word')}</>);
    const strong = container.querySelector('strong');
    expect(strong).not.toBeNull();
    expect(strong?.textContent).toBe('bold');
    expect(container.textContent).toBe('a bold word');
  });

  it('renders _italic_ as <em>', () => {
    const { container } = render(<>{parseFormatting('an _italic_ word')}</>);
    const em = container.querySelector('em');
    expect(em).not.toBeNull();
    expect(em?.textContent).toBe('italic');
  });

  it('renders [text](url) as an anchor with target=_blank', () => {
    const { container } = render(<>{parseFormatting('see [docs](https://example.com) here')}</>);
    const a = container.querySelector('a');
    expect(a).not.toBeNull();
    expect(a?.getAttribute('href')).toBe('https://example.com');
    expect(a?.getAttribute('target')).toBe('_blank');
    expect(a?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(a?.textContent).toBe('docs');
  });

  it('does not render unsafe link protocols as anchors', () => {
    const { container } = render(<>{parseFormatting('[click](javascript:alert(1))')}</>);
    expect(container.querySelector('a')).toBeNull();
    expect(container.textContent).toBe('[click](javascript:alert(1))');
  });

  it('handles mixed formatting in a single string', () => {
    const { container } = render(
      <>{parseFormatting('*bold* and _italic_ and [link](https://x.test)')}</>,
    );
    expect(container.querySelector('strong')?.textContent).toBe('bold');
    expect(container.querySelector('em')?.textContent).toBe('italic');
    expect(container.querySelector('a')?.textContent).toBe('link');
  });
});

describe('autoLinkUrls', () => {
  it('wraps bare URLs in markdown link syntax', () => {
    expect(autoLinkUrls('visit https://example.com today')).toBe(
      'visit [https://example.com](https://example.com) today',
    );
  });

  it('does not re-wrap URLs that are already markdown links', () => {
    const input = '[click here](https://example.com)';
    expect(autoLinkUrls(input)).toBe(input);
  });

  it('preserves trailing punctuation outside the link', () => {
    const result = autoLinkUrls('see https://example.com.');
    expect(result).toBe('see [https://example.com](https://example.com).');
  });

  it('leaves text without URLs unchanged', () => {
    expect(autoLinkUrls('plain text only')).toBe('plain text only');
  });
});

// ── textFormattingActions ──────────────────────────────────────────────────

/** Create a textarea with the given value attached to the document so
 *  selection/focus state behaves like in a real DOM. */
const makeTextarea = (value: string): HTMLTextAreaElement => {
  const ta = document.createElement('textarea');
  ta.value = value;
  document.body.appendChild(ta);
  return ta;
};

const flushTimers = async () => {
  // Wait one macrotask so any setTimeout(0) callbacks scheduled earlier
  // in the test fire. We can't switch to vi.useFakeTimers() here because
  // the real setTimeout was already scheduled before this helper runs —
  // switching to fake timers wouldn't migrate it.
  await new Promise<void>((r) => setTimeout(r, 0));
};

describe('wrapSelection — fallback path (no execCommand in jsdom)', () => {
  it('wraps the selection with the given marker and returns the new text for callers to forward to onChange', () => {
    const ta = makeTextarea('hello world');
    ta.setSelectionRange(0, 5);
    const result = wrapSelection(ta, '*');
    expect(typeof result).toBe('string');
    expect(result).toBe('*hello* world');
  });

  it('inserts an empty marker pair at the caret when nothing is selected', () => {
    const ta = makeTextarea('hello');
    ta.setSelectionRange(2, 2);
    const result = wrapSelection(ta, '_');
    expect(result).toBe('he__llo');
  });

  it('restores selection around the wrapped text after the deferred setTimeout fires', async () => {
    const ta = makeTextarea('hello world');
    ta.setSelectionRange(0, 5);
    wrapSelection(ta, '*');
    // Selection has not been restored yet (still the original range).
    expect(ta.selectionStart).toBe(0);
    expect(ta.selectionEnd).toBe(5);
    await flushTimers();
    // After the setTimeout: caret sits just inside the opening marker and
    // extends through the original selected text.
    expect(ta.selectionStart).toBe(1);
    expect(ta.selectionEnd).toBe(6);
  });

  it('restores a collapsed caret between the markers when nothing was selected', async () => {
    const ta = makeTextarea('hello');
    ta.setSelectionRange(2, 2);
    wrapSelection(ta, '*');
    await flushTimers();
    // Caret sits between the two markers: start (2) + marker.length (1) = 3.
    expect(ta.selectionStart).toBe(3);
    expect(ta.selectionEnd).toBe(3);
  });

  it('leaves text outside the selection untouched (regression: no paragraph-wide change)', () => {
    const ta = makeTextarea('hello world');
    ta.setSelectionRange(0, 5);
    const result = wrapSelection(ta, '*');
    expect(result).toBe('*hello* world');
    // Surrounding text is exactly preserved.
    expect(result?.endsWith(' world')).toBe(true);
    expect(result?.startsWith('*hello*')).toBe(true);
  });
});

describe('wrapSelection — native path (execCommand stub)', () => {
  let execCommandSpy: ReturnType<typeof vi.fn>;
  // execCommand was removed from the lib.dom type; declare it locally so we
  // can install / restore the spy without `any` leaking out of the test.
  type ExecCommandFn = (commandId: string, showUI?: boolean, value?: string) => boolean;
  let origExecCommand: ExecCommandFn | undefined;

  beforeEach(() => {
    execCommandSpy = vi.fn(() => true);
    origExecCommand = (document as Document & { execCommand?: ExecCommandFn }).execCommand;
    (document as Document & { execCommand?: ExecCommandFn }).execCommand = execCommandSpy;
  });

  afterEach(() => {
    (document as Document & { execCommand?: ExecCommandFn }).execCommand = origExecCommand as ExecCommandFn;
  });

  it('calls document.execCommand with ("insertText", false, wrapped) and returns null', () => {
    const ta = makeTextarea('hello world');
    ta.setSelectionRange(0, 5);
    const result = wrapSelection(ta, '*');
    expect(execCommandSpy).toHaveBeenCalledWith('insertText', false, '*hello*');
    expect(result).toBeNull();
  });

  it('restores the selection around the inner text synchronously (no setTimeout needed)', () => {
    const ta = makeTextarea('hello world');
    ta.setSelectionRange(0, 5);
    wrapSelection(ta, '*');
    expect(ta.selectionStart).toBe(1);
    expect(ta.selectionEnd).toBe(6);
  });

  it('collapses the caret between the markers when nothing was selected', () => {
    const ta = makeTextarea('hello');
    ta.setSelectionRange(2, 2);
    const result = wrapSelection(ta, '*');
    expect(execCommandSpy).toHaveBeenCalledWith('insertText', false, '**');
    expect(result).toBeNull();
    expect(ta.selectionStart).toBe(3);
    expect(ta.selectionEnd).toBe(3);
  });

  it('falls back when execCommand returns false (e.g. an editor disabled it)', async () => {
    execCommandSpy.mockReturnValue(false);
    const ta = makeTextarea('hello world');
    ta.setSelectionRange(0, 5);
    const result = wrapSelection(ta, '*');
    expect(result).toBe('*hello* world');
    await flushTimers();
    expect(ta.selectionStart).toBe(1);
    expect(ta.selectionEnd).toBe(6);
  });
});

describe('insertLink — fallback path', () => {
  it('wraps the selection in [text](url) and returns the new text', () => {
    const ta = makeTextarea('see docs here');
    ta.setSelectionRange(4, 8);
    const result = insertLink(ta, 'https://example.com');
    expect(result).toBe('see [docs](https://example.com) here');
  });

  it('returns the unchanged textarea.value when nothing is selected (no-op signal for callers)', () => {
    const ta = makeTextarea('hello');
    ta.setSelectionRange(2, 2);
    const result = insertLink(ta, 'https://example.com');
    // The contract: caller can compare to the original value and skip
    // onChange. We make this explicit by returning textarea.value.
    expect(result).toBe('hello');
    expect(result).toBe(ta.value);
  });

it('aims the caret just past the closing paren (after the deferred setTimeout)', async () => {
    const ta = makeTextarea('see docs here');
    ta.setSelectionRange(4, 8);
    insertLink(ta, 'https://example.com');
    // Simulate the React onChange cycle that grows the controlled value
    // before the deferred setTimeout fires — without this the deferred
    // setSelectionRange would clamp to the original value.length instead
    // of landing at the intended caret position.
    ta.value = 'see [docs](https://example.com) here';
    await flushTimers();
    // Caret position: start (4) + selectedText.length (4) + url.length (19) + 4
    const expectedCaret = 4 + 4 + 19 + 4;
    expect(ta.selectionStart).toBe(expectedCaret);
    expect(ta.selectionStart).toBe(ta.selectionEnd);
  });
});

describe('insertLink — native path (execCommand stub)', () => {
  let execCommandSpy: ReturnType<typeof vi.fn>;
  type ExecCommandFn = (commandId: string, showUI?: boolean, value?: string) => boolean;
  let origExecCommand: ExecCommandFn | undefined;

  beforeEach(() => {
    execCommandSpy = vi.fn(() => true);
    origExecCommand = (document as Document & { execCommand?: ExecCommandFn }).execCommand;
    (document as Document & { execCommand?: ExecCommandFn }).execCommand = execCommandSpy;
  });

  afterEach(() => {
    (document as Document & { execCommand?: ExecCommandFn }).execCommand = origExecCommand as ExecCommandFn;
  });

  it('calls document.execCommand with ("insertText", false, "[text](url)") and returns null', () => {
    const ta = makeTextarea('see docs here');
    ta.setSelectionRange(4, 8);
    const result = insertLink(ta, 'https://example.com');
    expect(execCommandSpy).toHaveBeenCalledWith('insertText', false, '[docs](https://example.com)');
    expect(result).toBeNull();
  });

  it('aims the caret just past the closing paren (verified via setSelectionRange spy)', () => {
    const ta = makeTextarea('see docs here');
    ta.setSelectionRange(4, 8);
    // jsdom's execCommand stub does not actually insert text into the
    // textarea, so setSelectionRange(31, 31) would clamp to value.length.
    // Spy on setSelectionRange to verify the intended caret position
    // without depending on the stub's side effects.
    const setRangeSpy = vi.spyOn(ta, 'setSelectionRange');
    insertLink(ta, 'https://example.com');
    // Caret position: start (4) + selectedText.length (4) + url.length (19) + 4
    const expectedCaret = 4 + 4 + 19 + 4;
    expect(setRangeSpy).toHaveBeenCalledWith(expectedCaret, expectedCaret);
    setRangeSpy.mockRestore();
  });

  it('still returns the no-op textarea.value when nothing is selected, regardless of execCommand', () => {
    const ta = makeTextarea('hello');
    ta.setSelectionRange(2, 2);
    const result = insertLink(ta, 'https://example.com');
    // No execCommand call, no input event needed.
    expect(execCommandSpy).not.toHaveBeenCalled();
    expect(result).toBe('hello');
  });
});

// ── Selection-mapping helpers ──────────────────────────────────────────────

describe('findFormatRegions', () => {
  it('returns a single bold region with content offsets one in from the markers', () => {
    const regions = findFormatRegions('*hello*');
    expect(regions).toHaveLength(1);
    expect(regions[0]).toEqual({
      kind: 'bold',
      regionStart: 0,
      contentStart: 1,
      contentEnd: 6,
      regionEnd: 7,
      content: 'hello',
    });
  });

  it('returns a single italic region with the same offset shape as bold', () => {
    const regions = findFormatRegions('_hello_');
    expect(regions).toHaveLength(1);
    expect(regions[0]).toMatchObject({
      kind: 'italic',
      regionStart: 0,
      contentStart: 1,
      contentEnd: 6,
      regionEnd: 7,
      content: 'hello',
    });
  });

  it('returns a single link region with the URL on the regionEnd side', () => {
    const regions = findFormatRegions('[hello](https://x.test)');
    expect(regions).toHaveLength(1);
    // `[hello](https://x.test)` is 23 chars: [ + hello + ]( + https://x.test + )
    expect(regions[0]).toEqual({
      kind: 'link',
      regionStart: 0,
      contentStart: 1,
      contentEnd: 6,
      regionEnd: 23,
      content: 'hello',
    });
  });

  it('returns multiple regions when several kinds are interleaved', () => {
    const regions = findFormatRegions('*a* b _c_ [d](https://x.test)');
    expect(regions.map((r) => r.kind)).toEqual(['bold', 'italic', 'link']);
    expect(regions.map((r) => r.content)).toEqual(['a', 'c', 'd']);
  });

  it('produces no region for an invalid-URL link (mirrors parseFormatting which renders it raw)', () => {
    expect(findFormatRegions('[click](javascript:alert(1))')).toHaveLength(0);
    expect(findFormatRegions('[click](not-a-url)')).toHaveLength(0);
  });

  it('returns an empty array for plain text without formatting', () => {
    expect(findFormatRegions('hello world')).toHaveLength(0);
  });
});

describe('findActiveRegions', () => {
  it('returns the bold region for a collapsed caret inside the content range (edges included)', () => {
    const text = '*hello* world';
    expect(findActiveRegions(text, 1, 1).map((r) => r.kind)).toEqual(['bold']);
    expect(findActiveRegions(text, 3, 3).map((r) => r.kind)).toEqual(['bold']);
    expect(findActiveRegions(text, 6, 6).map((r) => r.kind)).toEqual(['bold']);
  });

  it('returns [] for a collapsed caret sitting before the opening marker or after the closing marker', () => {
    const text = '*hello* world';
    expect(findActiveRegions(text, 0, 0)).toEqual([]);
    expect(findActiveRegions(text, 7, 7)).toEqual([]);
    expect(findActiveRegions(text, 8, 8)).toEqual([]);
  });

  it('returns the italic region for a caret inside _hello_', () => {
    expect(findActiveRegions('_hello_ world', 3, 3).map((r) => r.kind)).toEqual(['italic']);
  });

  it('returns the link region for a caret inside link text', () => {
    const text = '[hello](https://x.test) world';
    expect(findActiveRegions(text, 3, 3).map((r) => r.kind)).toEqual(['link']);
  });

  it('returns both nested kinds for a collapsed caret inside * _hello_ * content', () => {
    // text `*_hello_*` has bold 0..9 with content 1..8 and italic 1..8 with content 2..7.
    // Caret 4 is inside BOTH content ranges.
    expect(findActiveRegions('*_hello_*', 4, 4).map((r) => r.kind)).toEqual(['bold', 'italic']);
  });

  it('returns only the outer region when the caret sits outside the inner content', () => {
    // Caret 1 is at the inner italic opening — outside italic's content range (2..7)
    // but inside bold's content range (1..8). Only bold is active.
    expect(findActiveRegions('*_hello_*', 1, 1).map((r) => r.kind)).toEqual(['bold']);
  });

  it('is active for a non-collapsed selection that exactly spans the region with syntax', () => {
    expect(findActiveRegions('*hello* world', 0, 7).map((r) => r.kind)).toEqual(['bold']);
  });

  it('is active for a non-collapsed selection that exactly spans the content only', () => {
    expect(findActiveRegions('*hello* world', 1, 6).map((r) => r.kind)).toEqual(['bold']);
  });

  it('returns [] for a partial overlap inside a formatted region (gate fails)', () => {
    const text = '*hello* world';
    expect(findActiveRegions(text, 2, 4)).toEqual([]);
    expect(findActiveRegions(text, 0, 5)).toEqual([]);
    expect(findActiveRegions(text, 2, 7)).toEqual([]);
  });

  it('returns [] when the selection sits outside any formatted region', () => {
    const text = 'hello *bold* world';
    expect(findActiveRegions(text, 0, 5)).toEqual([]);
    expect(findActiveRegions(text, 12, 17)).toEqual([]);
  });

  it('returns [] for an invalid-URL link (no region exists, so no active format)', () => {
    expect(findActiveRegions('[click](javascript:alert(1))', 3, 3)).toEqual([]);
  });

  it('returns the chain when a selection exactly spans the outer region of a nested run', () => {
    // bold 0..9 contains italic 1..8; selecting the whole bold region
    // gates on bold (syntax-exact) and returns both layers.
    expect(findActiveRegions('*_hello_*', 0, 9).map((r) => r.kind)).toEqual(['bold', 'italic']);
  });

  it('returns the inner + containing outer when the selection exactly spans the inner region', () => {
    // italic 1..8 content-exact → italic itself, and bold 0..9 contains it.
    expect(findActiveRegions('*_hello_*', 1, 8).map((r) => r.kind)).toEqual(['bold', 'italic']);
    expect(findActiveRegions('*_hello_*', 2, 7).map((r) => r.kind)).toEqual(['bold', 'italic']);
  });

  it('returns [] for adjacent regions like *a**b* (no region exactly spans the whole string)', () => {
    // Two bold regions: 0..3 and 3..6. A selection 0..6 exactly spans
    // neither (gate fails) — partial selection falls back to wrap.
    expect(findActiveRegions('*a**b*', 0, 6)).toEqual([]);
    expect(findActiveRegions('*a**b*', 1, 2).map((r) => r.kind)).toEqual(['bold']);
  });
});

describe('findActiveRegionOfKind', () => {
  it('returns the matching region in a single-level run', () => {
    const region = findActiveRegionOfKind('*hello* world', 3, 3, 'bold');
    expect(region?.kind).toBe('bold');
  });

  it('returns null when the kind is not active', () => {
    expect(findActiveRegionOfKind('*hello* world', 3, 3, 'italic')).toBeNull();
    expect(findActiveRegionOfKind('*hello* world', 3, 3, 'link')).toBeNull();
  });

  it('returns the bold region in a nested run (caret inside both bold and italic content)', () => {
    expect(findActiveRegionOfKind('*_hello_*', 4, 4, 'bold')?.kind).toBe('bold');
  });

  it('returns null for a kind whose region is present but the selection is not exactly spanned', () => {
    // Partial selection inside `*a**b*` — both bold regions fail the gate.
    expect(findActiveRegionOfKind('*a**b*', 0, 6, 'bold')).toBeNull();
  });
});

describe('mapRenderedRangeToRaw', () => {
  it('maps plain text 1:1', () => {
    expect(mapRenderedRangeToRaw('hello world', 0, 5)).toEqual({ start: 0, end: 5 });
    expect(mapRenderedRangeToRaw('hello world', 6, 11)).toEqual({ start: 6, end: 11 });
  });

  it('snaps outward to the full bold region when the rendered range sits inside *bold*', () => {
    // rendered 0..5 covers just the "hello" inside "*hello*" (markers are 0 rendered width)
    const result = mapRenderedRangeToRaw('*hello* world', 0, 5);
    expect(result).toEqual({ start: 0, end: 7 });
  });

  it('snaps across a plain→bold boundary to cover the full bold region on the inside side', () => {
    // rendered 0..7 spans plain "hello " (rendered offset 0..6) and the bold
    // content starting at rendered 6; the end at rendered 7 is inside the
    // bold content and snaps to the closing marker.
    const result = mapRenderedRangeToRaw('hello *bold*', 0, 7);
    // "*bold*" sits at raw 6..12, so the snapped end is 12.
    expect(result).toEqual({ start: 0, end: 12 });
  });

  it('snaps a start at the boundary into the bold region including the opening marker', () => {
    const result = mapRenderedRangeToRaw('hello *bold*', 6, 11);
    // Start at rendered 6 is the first char of bold content → snap to regionStart 6.
    // End at rendered 11 is past the rendered text (length 10) → clamp to value.length 12.
    expect(result).toEqual({ start: 6, end: 12 });
  });

  it('snaps a range inside link-text to include the full [text](url) region', () => {
    // rendered 0..5 covers "hello" inside "[hello](https://x.test)" (markers
    // and URL have zero rendered width); snapping extends to the closing ")".
    const result = mapRenderedRangeToRaw('[hello](https://x.test) world', 0, 5);
    // Region is 0..23 in raw space.
    expect(result).toEqual({ start: 0, end: 23 });
  });

  it('handles a mixed string *a* b _c_ with simple per-segment mappings', () => {
    // rendered 0..1 = "a" (bold content) → snap to full bold region
    expect(mapRenderedRangeToRaw('*a* b _c_', 0, 1)).toEqual({ start: 0, end: 3 });
    // rendered 1..4 = " b " (plain) → 1:1 in raw space
    expect(mapRenderedRangeToRaw('*a* b _c_', 1, 4)).toEqual({ start: 3, end: 6 });
    // rendered 4..5 = "c" (italic content) → snap to full italic region
    expect(mapRenderedRangeToRaw('*a* b _c_', 4, 5)).toEqual({ start: 6, end: 9 });
  });

  it('treats an invalid-URL link as plain text (raw offsets equal rendered offsets)', () => {
    // "[click](javascript:alert(1))" renders as plain text; raw == rendered.
    const text = '[click](javascript:alert(1))';
    expect(mapRenderedRangeToRaw(text, 0, text.length)).toEqual({ start: 0, end: text.length });
  });

  it('clamps offsets to the value bounds', () => {
    expect(mapRenderedRangeToRaw('hello', -5, 100)).toEqual({ start: 0, end: 5 });
  });
});

describe('expandToWordRun', () => {
  it('expands a plain word around a position inside it', () => {
    expect(expandToWordRun('hello world', 3)).toEqual({ start: 0, end: 5 });
  });

  it('expands to include the surrounding * markers when the position is inside *bold*', () => {
    expect(expandToWordRun('*hello*', 3)).toEqual({ start: 0, end: 7 });
  });

  it('expands to the whole [text](url) syntax when the position is inside link text', () => {
    expect(expandToWordRun('[text](url)', 3)).toEqual({ start: 0, end: 11 });
  });

  it('returns a collapsed range when the position is on whitespace with no adjacent word char', () => {
    // Two leading spaces, position 1 sits between them — both neighbours
    // are whitespace so there is no word to expand into.
    expect(expandToWordRun('   hello', 1)).toEqual({ start: 1, end: 1 });
  });

  it('returns a collapsed range at position 0 on whitespace-only text', () => {
    expect(expandToWordRun('   ', 1)).toEqual({ start: 1, end: 1 });
  });
});

// ── removeFormatting ───────────────────────────────────────────────────────

describe('removeFormatting — fallback path', () => {
  it('removes the bold markers and returns the new text', () => {
    const ta = makeTextarea('*hello* world');
    ta.setSelectionRange(1, 6);
    const region = findActiveRegionOfKind(ta.value, 1, 6, 'bold')!;
    const result = removeFormatting(ta, region);
    expect(result).toBe('hello world');
  });

  it('removes italic markers', () => {
    const ta = makeTextarea('an _italic_ word');
    // Caret at 4 sits inside "_italic_" (contentStart=3, contentEnd=10)
    ta.setSelectionRange(4, 4);
    const region = findActiveRegionOfKind(ta.value, 4, 4, 'italic')!;
    expect(region.kind).toBe('italic');
    const result = removeFormatting(ta, region);
    expect(result).toBe('an italic word');
  });

  it('removes the full [text](url) region when the caret sits inside link text', () => {
    const ta = makeTextarea('[hello](https://x.test) world');
    ta.setSelectionRange(3, 3);
    const region = findActiveRegionOfKind(ta.value, 3, 3, 'link')!;
    expect(region.kind).toBe('link');
    const result = removeFormatting(ta, region);
    expect(result).toBe('hello world');
  });

  it('restores the caret inside the surviving content after a deferred setTimeout (collapsed)', async () => {
    const ta = makeTextarea('*hello* world');
    ta.setSelectionRange(3, 3); // inside "*hello*" between "l" and "l"
    const region = findActiveRegionOfKind(ta.value, 3, 3, 'bold')!;
    removeFormatting(ta, region);
    // Immediately after removeFormatting, the function re-asserted the
    // selection to the full region (0, 7) so the execCommand / fallback
    // operates on the right characters. Simulate React's onChange committing
    // the new value before the timer fires.
    expect(ta.selectionStart).toBe(0);
    expect(ta.selectionEnd).toBe(7);
    ta.value = 'hello world';
    await flushTimers();
    // caret was 3, contentStart was 1, so the relative offset is 2 → 2 in the
    // new value (the surviving "hello" sits at the same positions).
    expect(ta.selectionStart).toBe(2);
    expect(ta.selectionStart).toBe(ta.selectionEnd);
  });

  it('restores a content-only selection after a deferred setTimeout (non-collapsed)', async () => {
    const ta = makeTextarea('*hello* world');
    ta.setSelectionRange(0, 7); // whole bold region
    const region = findActiveRegionOfKind(ta.value, 0, 7, 'bold')!;
    removeFormatting(ta, region);
    ta.value = 'hello world';
    await flushTimers();
    // The content "hello" stays selected in the new text.
    expect(ta.selectionStart).toBe(0);
    expect(ta.selectionEnd).toBe(5);
  });

  it('removes the outer bold and maps a strictly-inside selection (nested case)', async () => {
    // `*a_b_*` has bold 0..6 with content `a_b_` and italic 2..5 with
    // content `b`. A selection on just the italic region (2..5) is
    // contained by the bold region, so removing the bold leaves `_b_`.
    const ta = makeTextarea('*a_b_*');
    ta.setSelectionRange(2, 5); // the italic region (with syntax)
    const region = findActiveRegionOfKind(ta.value, 2, 5, 'bold')!;
    expect(region.kind).toBe('bold');
    const result = removeFormatting(ta, region);
    // Removed the bold markers, kept the content `a_b_` literally.
    expect(result).toBe('a_b_');
    // Simulate React committing the new value, then flush the deferred
    // setTimeout: the selection is mapped into the surviving content so
    // it preserves the user's intent (the `_b_` part).
    ta.value = 'a_b_';
    await flushTimers();
    expect(ta.selectionStart).toBe(1);
    expect(ta.selectionEnd).toBe(4);
  });
});

describe('removeFormatting — native path (execCommand stub)', () => {
  let execCommandSpy: ReturnType<typeof vi.fn>;
  type ExecCommandFn = (commandId: string, showUI?: boolean, value?: string) => boolean;
  let origExecCommand: ExecCommandFn | undefined;

  beforeEach(() => {
    execCommandSpy = vi.fn(() => true);
    origExecCommand = (document as Document & { execCommand?: ExecCommandFn }).execCommand;
    (document as Document & { execCommand?: ExecCommandFn }).execCommand = execCommandSpy;
  });

  afterEach(() => {
    (document as Document & { execCommand?: ExecCommandFn }).execCommand = origExecCommand as ExecCommandFn;
  });

  it('calls execCommand with ("insertText", false, region.content) and returns null', () => {
    const ta = makeTextarea('*hello* world');
    ta.setSelectionRange(0, 7);
    const region = findActiveRegionOfKind(ta.value, 0, 7, 'bold')!;
    const result = removeFormatting(ta, region);
    expect(execCommandSpy).toHaveBeenCalledWith('insertText', false, 'hello');
    expect(result).toBeNull();
  });

  it('collapses the caret inside the surviving content (collapsed case)', () => {
    const ta = makeTextarea('*hello* world');
    ta.setSelectionRange(3, 3);
    const region = findActiveRegionOfKind(ta.value, 3, 3, 'bold')!;
    const setRangeSpy = vi.spyOn(ta, 'setSelectionRange');
    removeFormatting(ta, region);
    // caret was 3, contentStart 1 → relative 2; new caret lands at
    // regionStart (0) + 2 = 2.
    expect(setRangeSpy).toHaveBeenCalledWith(2, 2);
    setRangeSpy.mockRestore();
  });

  it('selects the surviving content (non-collapsed case)', () => {
    const ta = makeTextarea('*hello* world');
    ta.setSelectionRange(0, 7);
    const region = findActiveRegionOfKind(ta.value, 0, 7, 'bold')!;
    const setRangeSpy = vi.spyOn(ta, 'setSelectionRange');
    removeFormatting(ta, region);
    expect(setRangeSpy).toHaveBeenCalledWith(0, 5);
    setRangeSpy.mockRestore();
  });
});

// ── Nested formatting ──────────────────────────────────────────────────────

describe('parseFormatting — nested rendering', () => {
  it('renders italic inside bold: *a_b_c* → <strong> containing text + <em>', () => {
    const { container } = render(<>{parseFormatting('*a_b_c*')}</>);
    const strong = container.querySelector('strong');
    expect(strong).not.toBeNull();
    const em = strong?.querySelector('em');
    expect(em).not.toBeNull();
    expect(em?.textContent).toBe('b');
    // DOM textContent concatenates the strong's children: 'a' + 'b' (em) + 'c'.
    expect(container.textContent).toBe('abc');
  });

  it('renders bold inside italic: _a*b*c_ → <em> containing text + <strong>', () => {
    const { container } = render(<>{parseFormatting('_a*b*c_')}</>);
    const em = container.querySelector('em');
    expect(em).not.toBeNull();
    const strong = em?.querySelector('strong');
    expect(strong).not.toBeNull();
    expect(strong?.textContent).toBe('b');
    expect(container.textContent).toBe('abc');
  });

  it('renders link inside bold: *[l](https://x.test)* → <strong> containing <a>', () => {
    const { container } = render(<>{parseFormatting('*[l](https://x.test)*')}</>);
    const strong = container.querySelector('strong');
    expect(strong).not.toBeNull();
    const a = strong?.querySelector('a');
    expect(a).not.toBeNull();
    expect(a?.getAttribute('href')).toBe('https://x.test');
    expect(a?.textContent).toBe('l');
  });

  it('renders bold inside link text: [a*b*c](https://x.test)', () => {
    const { container } = render(<>{parseFormatting('[a*b*c](https://x.test)')}</>);
    const a = container.querySelector('a');
    expect(a).not.toBeNull();
    const strong = a?.querySelector('strong');
    expect(strong).not.toBeNull();
    expect(strong?.textContent).toBe('b');
  });

  it('non-nested outputs remain unchanged', () => {
    // The existing parseFormatting tests cover all non-nested shapes; this
    // is a smoke check that nested impl didn't regress them.
    const { container } = render(<>{parseFormatting('*bold* and _italic_ and [link](https://x.test)')}</>);
    expect(container.querySelector('strong')?.textContent).toBe('bold');
    expect(container.querySelector('em')?.textContent).toBe('italic');
    expect(container.querySelector('a')?.textContent).toBe('link');
  });
});

describe('tokenizeFormatting — nesting', () => {
  it('concatenating token.text reproduces the input for *a_b_c*', () => {
    expect(tokenizeFormatting('*a_b_c*').map((t) => t.text).join('')).toBe('*a_b_c*');
  });

  it('concatenating token.text reproduces the input for *[t](https://x.test)*', () => {
    expect(tokenizeFormatting('*[t](https://x.test)*').map((t) => t.text).join('')).toBe('*[t](https://x.test)*');
  });

  it('concatenating token.text reproduces the input for _a*b*c_', () => {
    expect(tokenizeFormatting('_a*b*c_').map((t) => t.text).join('')).toBe('_a*b*c_');
  });

  it('non-nested token stream is unchanged: *hello* → marker/bold/marker', () => {
    const tokens = tokenizeFormatting('*hello*');
    expect(tokens).toEqual([
      { kind: 'marker', text: '*' },
      { kind: 'bold', text: 'hello' },
      { kind: 'marker', text: '*' },
    ]);
  });

  it('italic token inside bold carries styles: [\'bold\']', () => {
    // `_b_` inside `*a_b_*` → italic with enclosing = ['bold'].
    const tokens = tokenizeFormatting('*a_b_*');
    const italic = tokens.find((t) => t.kind === 'italic');
    expect(italic).toEqual({ kind: 'italic', text: 'b', styles: ['bold'] });
  });

  it('an invalid-URL link nested inside bold stays raw but keeps the enclosing styles', () => {
    // parseFormatting renders the raw link text INSIDE the <strong>, so the
    // backdrop must style it bold too (regression: it used to drop styles).
    const tokens = tokenizeFormatting('*[x](javascript:alert)*');
    const raw = tokens.find((t) => t.kind === 'plain' && t.text.startsWith('[x]'));
    expect(raw).toEqual({ kind: 'plain', text: '[x](javascript:alert)', styles: ['bold'] });
  });

  it('plain tokens inside bold carry styles: [\'bold\']', () => {
    // `a` and `c_` inside `*a_b_c_*` → plain with enclosing = ['bold'].
    // The lazy `_b_` match consumes the first italic pair; the trailing
    // `c_` has no closing underscore and stays literal (inside bold).
    const tokens = tokenizeFormatting('*a_b_c_*');
    const plains = tokens.filter((t) => t.kind === 'plain');
    expect(plains).toHaveLength(2);
    expect(plains[0]).toMatchObject({ kind: 'plain', text: 'a', styles: ['bold'] });
    expect(plains[1]).toMatchObject({ kind: 'plain', text: 'c_', styles: ['bold'] });
  });

  it('marker and link-url tokens have NO styles field even inside enclosing', () => {
    // `[b](https://x.test)` inside `*[b](https://x.test)*` — markers and
    // link-url are always bare so the backdrop drift is minimal.
    const tokens = tokenizeFormatting('*[b](https://x.test)*');
    const structural = tokens.filter((t) => t.kind === 'marker' || t.kind === 'link-url');
    expect(structural.every((t) => !('styles' in t) || t.styles === undefined)).toBe(true);
  });

  it('top-level non-nested tokens have NO styles field', () => {
    const tokens = tokenizeFormatting('*hello*');
    expect(tokens.every((t) => !('styles' in t) || t.styles === undefined)).toBe(true);
  });
});

describe('findFormatRegions — nested', () => {
  it('returns outer + inner regions for * _hello_ * in pre-order', () => {
    const regions = findFormatRegions('*_hello_*');
    expect(regions.map((r) => r.kind)).toEqual(['bold', 'italic']);
    expect(regions[0]).toMatchObject({
      kind: 'bold',
      regionStart: 0,
      contentStart: 1,
      contentEnd: 8,
      regionEnd: 9,
      content: '_hello_',
    });
    expect(regions[1]).toMatchObject({
      kind: 'italic',
      regionStart: 1,
      contentStart: 2,
      contentEnd: 7,
      regionEnd: 8,
      content: 'hello',
    });
  });

  it('returns outer + inner regions for *[t](https://x.test)*', () => {
    const regions = findFormatRegions('*[t](https://x.test)*');
    expect(regions.map((r) => r.kind)).toEqual(['bold', 'link']);
    // The link match starts at raw offset 1 (right after the bold's `*`).
    expect(regions[1]).toMatchObject({
      kind: 'link',
      regionStart: 1,
      content: 't',
      regionEnd: 20,
    });
  });
});

describe('mapRenderedRangeToRaw — nested content snaps to the outermost region', () => {
  it('a partial selection inside * _hello_ * content snaps to the bold region', () => {
    // Rendered text is just "hello" (5 chars). A 2..4 rendered range
    // sits inside that content. The outermost enclosing region is bold
    // (0..9), so it snaps to (0, 9).
    expect(mapRenderedRangeToRaw('*_hello_*', 2, 4)).toEqual({ start: 0, end: 9 });
  });

  it('a collapsed render inside * _hello_ * also snaps to the bold region', () => {
    expect(mapRenderedRangeToRaw('*_hello_*', 2, 2)).toEqual({ start: 0, end: 9 });
  });

  it('top-level behavior is unchanged: *hello* rendered 0..5 → raw 0..7', () => {
    expect(mapRenderedRangeToRaw('*hello*', 0, 5)).toEqual({ start: 0, end: 7 });
  });
});
