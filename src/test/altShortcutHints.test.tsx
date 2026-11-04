import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ALT_HOLD_MS, useAltShortcutHints } from '@/hooks/useAltShortcutHints';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { KeyboardShortcutHints } from '@/components/sections/KeyboardShortcutHints';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const pressAlt = (init: KeyboardEventInit = {}, target: Element | Window = window) =>
  fireEvent.keyDown(target, { key: 'Alt', code: 'AltLeft', altKey: true, ...init });
const hold = (ms = ALT_HOLD_MS) => act(() => { vi.advanceTimersByTime(ms); });

describe('useAltShortcutHints', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('appears only after holding Alt', () => {
    const { result } = renderHook(() => useAltShortcutHints(true));
    pressAlt();
    hold(ALT_HOLD_MS - 1);
    expect(result.current.visible).toBe(false);
    hold(1);
    expect(result.current.visible).toBe(true);
  });

  it('disappears on release and swallows that release', () => {
    const { result } = renderHook(() => useAltShortcutHints(true));
    pressAlt();
    hold();
    expect(fireEvent.keyUp(window, { key: 'Alt', code: 'AltLeft' })).toBe(false);
    expect(result.current.visible).toBe(false);
  });

  it('leaves a quick tap to the browser', () => {
    renderHook(() => useAltShortcutHints(true));
    pressAlt();
    expect(fireEvent.keyUp(window, { key: 'Alt', code: 'AltLeft' })).toBe(true);
  });

  it('does not restart on key repeat', () => {
    const { result } = renderHook(() => useAltShortcutHints(true));
    pressAlt();
    hold(ALT_HOLD_MS - 100);
    pressAlt({ repeat: true });
    hold(100);
    expect(result.current.visible).toBe(true);
  });

  it('never appears when another key follows, as in Alt+Tab or Option+L', () => {
    const { result } = renderHook(() => useAltShortcutHints(true));
    pressAlt();
    fireEvent.keyDown(window, { key: 'Tab', code: 'Tab', altKey: true });
    hold();
    expect(result.current.visible).toBe(false);
  });

  it.each([
    ['VoiceOver (Ctrl+Option)', { ctrlKey: true }],
    ['Cmd+Option', { metaKey: true }],
    ['Alt+Shift', { shiftKey: true }],
  ])('stays away from %s', (_name, modifiers) => {
    const { result } = renderHook(() => useAltShortcutHints(true));
    pressAlt(modifiers);
    hold();
    expect(result.current.visible).toBe(false);
  });

  it('ignores AltGr', () => {
    const { result } = renderHook(() => useAltShortcutHints(true));
    fireEvent.keyDown(window, { key: 'AltGraph', code: 'AltRight' });
    hold();
    expect(result.current.visible).toBe(false);
  });

  it('stays out of text fields', () => {
    const { result } = renderHook(() => useAltShortcutHints(true));
    const input = document.createElement('input');
    document.body.append(input);
    pressAlt({}, input);
    hold();
    expect(result.current.visible).toBe(false);
    input.remove();
  });

  it('does not appear while a dialog is open', () => {
    const { result } = renderHook(() => useAltShortcutHints(true));
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('data-state', 'open');
    document.body.append(dialog);
    pressAlt();
    hold();
    expect(result.current.visible).toBe(false);
    dialog.remove();
  });

  it.each([
    ['the window loses focus', () => fireEvent.blur(window)],
    ['the pointer goes down', () => fireEvent.pointerDown(window)],
  ])('resets when %s, since Alt+Tab never delivers the keyup', (_name, leave) => {
    const { result } = renderHook(() => useAltShortcutHints(true));
    pressAlt();
    hold();
    act(() => { leave(); });
    expect(result.current.visible).toBe(false);
  });

  it('does nothing while disabled', () => {
    const { result } = renderHook(() => useAltShortcutHints(false));
    pressAlt();
    hold();
    expect(result.current.visible).toBe(false);
  });

  it('lets Alt+key act on the shown key once, then hides', () => {
    const onAddBlock = vi.fn();
    const { result } = renderHook(() => {
      const hints = useAltShortcutHints(true);
      useKeyboardShortcuts({
        blockTypes: [], onAddBlock, onAddGroup: vi.fn(), onAddBreakout: vi.fn(), onAddBlockOfType: vi.fn(),
        onTogglePlayMode: vi.fn(), onCloseSession: vi.fn(), onFocusSessionTitle: vi.fn(),
        onFocusSessionDescription: vi.fn(), onOpenStartTime: vi.fn(), onOpenDate: vi.fn(), onOpenShare: vi.fn(),
        dayIds: [], onSelectDay: vi.fn(), onAddDay: vi.fn(), onUndo: vi.fn(), onRedo: vi.fn(), onShowHelp: vi.fn(),
        isAltChordActive: hints.isAltChordActive,
      });
      return hints;
    });
    pressAlt();
    hold();
    fireEvent.keyDown(window, { key: 'n', code: 'KeyN', altKey: true });
    hold(0);
    expect(onAddBlock).toHaveBeenCalledOnce();
    expect(result.current.visible).toBe(false);

    fireEvent.keyDown(window, { key: 'n', code: 'KeyN', altKey: true });
    expect(onAddBlock).toHaveBeenCalledOnce();
  });
});

describe('KeyboardShortcutHints', () => {
  const rect = (left: number, top: number, width: number, height: number) =>
    ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) }) as DOMRect;

  const addTarget = (attrs: Record<string, string>, box: DOMRect, tag = 'button') => {
    const element = document.createElement(tag);
    Object.entries(attrs).forEach(([name, value]) => element.setAttribute(name, value));
    element.getBoundingClientRect = () => box;
    document.body.append(element);
    return element;
  };

  afterEach(() => {
    document.querySelectorAll('[data-shortcut]').forEach((element) => element.remove());
    // jsdom has no elementFromPoint; each test installs one.
    Reflect.deleteProperty(document, 'elementFromPoint');
  });

  const hintLabels = () =>
    Array.from(document.querySelectorAll('[data-shortcut-hint]')).map((hint) => hint.textContent);

  it('draws a keycap for each reachable control, with its digit', () => {
    const share = addTarget({ 'data-shortcut': 'openShare' }, rect(100, 10, 32, 32));
    const type = addTarget({ 'data-shortcut': 'addBlockOfType', 'data-shortcut-digit': '3' }, rect(0, 100, 150, 32));
    document.elementFromPoint = (x) => (x < 100 ? type : share);
    render(<KeyboardShortcutHints />);
    expect(hintLabels()).toEqual(['⇧C', '3']);
  });

  it('skips buttons faded out until hover', () => {
    const faded = addTarget({ 'data-shortcut': 'addDay' }, rect(0, 0, 32, 32));
    faded.checkVisibility = () => false;
    document.elementFromPoint = () => faded;
    render(<KeyboardShortcutHints />);
    expect(hintLabels()).toEqual([]);
  });

  it('skips disabled, collapsed and covered controls', () => {
    const covered = addTarget({ 'data-shortcut': 'addGroup' }, rect(0, 0, 40, 40));
    addTarget({ 'data-shortcut': 'togglePlayMode', disabled: '' }, rect(50, 0, 40, 40));
    addTarget({ 'data-shortcut': 'openDate' }, rect(0, 0, 0, 0));
    document.elementFromPoint = () => document.body;
    render(<KeyboardShortcutHints />);
    expect(hintLabels()).toEqual([]);
    expect(covered.isConnected).toBe(true);
  });

  it('accepts a hit on a child of the control', () => {
    const button = addTarget({ 'data-shortcut': 'addGroup' }, rect(0, 0, 40, 40));
    const icon = document.createElement('svg');
    button.append(icon);
    document.elementFromPoint = () => icon;
    render(<KeyboardShortcutHints />);
    expect(hintLabels()).toEqual(['G']);
  });

  const hintFor = (label: string) => document.querySelector<HTMLElement>(`[data-shortcut-hint="${label}"]`)!;

  it('draws every keycap alike, inverted against the page', () => {
    const group = addTarget({ 'data-shortcut': 'addGroup' }, rect(0, 0, 40, 40));
    const share = addTarget({ 'data-shortcut': 'openShare' }, rect(100, 0, 40, 40));
    document.elementFromPoint = (x) => (x < 100 ? group : share);
    render(<KeyboardShortcutHints />);
    [hintFor('G'), hintFor('⇧C')].forEach((hint) => {
      expect(hint.className).toContain('bg-foreground');
      expect(hint.className).toContain('text-background');
    });
  });

  it('shows no explanatory text', () => {
    const group = addTarget({ 'data-shortcut': 'addGroup' }, rect(0, 0, 40, 40));
    document.elementFromPoint = () => group;
    render(<KeyboardShortcutHints />);
    expect(hintFor('G').parentElement?.textContent).toBe('G');
  });

  it('is hidden from assistive technology', () => {
    const group = addTarget({ 'data-shortcut': 'addGroup' }, rect(0, 0, 40, 40));
    document.elementFromPoint = () => group;
    render(<KeyboardShortcutHints />);
    expect(screen.getByText('G').closest('[aria-hidden="true"]')).toBeTruthy();
  });

  it('hangs a marked target\'s keycap to the left of it', () => {
    const description = addTarget({ 'data-shortcut': 'focusDescription', 'data-shortcut-outside': '' }, rect(100, 50, 500, 30));
    document.elementFromPoint = () => description;
    render(<KeyboardShortcutHints />);
    expect(hintFor('D').style.left).toBe('96px');
    expect(hintFor('D').style.top).toBe('65px');
    expect(hintFor('D').className).toContain('-translate-x-full');
  });

  it('puts keycaps of header buttons on one line along the lower edge', () => {
    const addBar = (bottom: number, target: HTMLElement) => {
      const bar = document.createElement('div');
      bar.setAttribute('data-shortcut-bar', '');
      bar.getBoundingClientRect = () => rect(0, 8, 800, bottom - 8);
      document.body.append(bar);
      bar.append(target);
      return bar;
    };
    const date = addTarget({ 'data-shortcut': 'openDate' }, rect(100, 14, 28, 28));
    const share = addTarget({ 'data-shortcut': 'openShare' }, rect(300, 12, 40, 36));
    const title = addTarget({ 'data-shortcut': 'focusTitle' }, rect(400, 12, 300, 36));
    const bars = [addBar(54, date), addBar(50, share), addBar(50, title)];
    document.elementFromPoint = (x) => (x < 200 ? date : x < 400 ? share : title);
    render(<KeyboardShortcutHints />);
    expect(hintFor('⇧D').style.left).toBe('114px');
    expect(hintFor('⇧D').style.top).toBe('54px');
    expect(hintFor('⇧C').style.top).toBe('54px');
    expect(hintFor('T').style.top).toBe('54px');
    bars.forEach((bar) => bar.remove());
  });

  it('keeps a keycap hanging left of its target on screen', () => {
    const wide = addTarget({ 'data-shortcut': 'focusDescription', 'data-shortcut-outside': '' }, rect(0, 50, 500, 30));
    document.elementFromPoint = () => wide;
    render(<KeyboardShortcutHints />);
    expect(hintFor('D').style.left).toBe('32px');
  });

  it('moves keycaps on one line apart when their labels are wider than the buttons', () => {
    const bar = document.createElement('div');
    bar.setAttribute('data-shortcut-bar', '');
    bar.getBoundingClientRect = () => rect(0, 8, 800, 46);
    document.body.append(bar);
    const undo = addTarget({ 'data-shortcut': 'undo' }, rect(100, 12, 40, 36));
    const play = addTarget({ 'data-shortcut': 'togglePlayMode' }, rect(140, 12, 40, 36));
    bar.append(undo, play);
    document.elementFromPoint = (x) => (x < 140 ? undo : play);
    render(<KeyboardShortcutHints />);
    const undoHint = document.querySelector<HTMLElement>('[data-shortcut-hint$="Z"]')!;
    const distance = parseInt(hintFor('Space').style.left, 10) - parseInt(undoHint.style.left, 10);
    expect(undoHint.style.left).toBe('120px');
    expect(distance).toBeGreaterThanOrEqual(((undoHint.textContent!.length * 8 + 16) + (5 * 8 + 16)) / 2);
    bar.remove();
  });

  it('shortens Space so it does not run into the undo keycap', () => {
    const play = addTarget({ 'data-shortcut': 'togglePlayMode' }, rect(0, 0, 40, 36));
    document.elementFromPoint = () => play;
    render(<KeyboardShortcutHints />);
    expect(hintLabels()).toEqual(['Space']);
  });
});
