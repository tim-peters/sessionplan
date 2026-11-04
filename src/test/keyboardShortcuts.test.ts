import { fireEvent, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { SHORTCUTS, type ShortcutId } from '@/lib/keyboard-shortcuts';


const options = () => ({
  blockTypes: [],
  onAddBlock: vi.fn(), onAddGroup: vi.fn(), onAddBreakout: vi.fn(),
  onAddBlockOfType: vi.fn(), onTogglePlayMode: vi.fn(), onCloseSession: vi.fn(),
  onFocusSessionTitle: vi.fn(), onFocusSessionDescription: vi.fn(),
  onOpenStartTime: vi.fn(), onOpenDate: vi.fn(), onOpenShare: vi.fn(),
  dayIds: ['d1', 'd2'], onSelectDay: vi.fn(), onAddDay: vi.fn(),
  onUndo: vi.fn(), onRedo: vi.fn(), onShowHelp: vi.fn(),
});

type Options = ReturnType<typeof options>;
const blockType = { id: 'input', name: 'Input', color: '#000' };

/** How each registered shortcut is pressed and what it must call. The Record
 *  type makes a new registry entry fail to compile until it is covered here. */
const REGISTRY_CASES: Record<Exclude<ShortcutId, 'showHints'>, [KeyboardEventInit, keyof Options]> = {
  addBlock: [{ key: 'n', code: 'KeyN' }, 'onAddBlock'],
  addGroup: [{ key: 'g', code: 'KeyG' }, 'onAddGroup'],
  addBreakout: [{ key: 'b', code: 'KeyB' }, 'onAddBreakout'],
  addBlockOfType: [{ key: '1', code: 'Digit1' }, 'onAddBlockOfType'],
  focusTitle: [{ key: 't', code: 'KeyT' }, 'onFocusSessionTitle'],
  focusDescription: [{ key: 'd', code: 'KeyD' }, 'onFocusSessionDescription'],
  openDate: [{ key: 'D', code: 'KeyD', shiftKey: true }, 'onOpenDate'],
  openStartTime: [{ key: 'S', code: 'KeyS', shiftKey: true }, 'onOpenStartTime'],
  openShare: [{ key: 'C', code: 'KeyC', shiftKey: true }, 'onOpenShare'],
  togglePlayMode: [{ key: ' ', code: 'Space' }, 'onTogglePlayMode'],
  closeSession: [{ key: 'Escape', code: 'Escape' }, 'onCloseSession'],
  selectDay: [{ key: '!', code: 'Digit1', shiftKey: true }, 'onSelectDay'],
  addDay: [{ key: 'T', code: 'KeyT', shiftKey: true }, 'onAddDay'],
  undo: [{ key: 'z', code: 'KeyZ', ctrlKey: true }, 'onUndo'],
  redo: [{ key: 'z', code: 'KeyZ', ctrlKey: true, shiftKey: true }, 'onRedo'],
  showHelp: [{ key: '?', code: 'Minus', shiftKey: true }, 'onShowHelp'],
};

describe('shortcut registry', () => {
  it.each(Object.entries(REGISTRY_CASES))('%s fires what the help dialog promises', (_id, [init, callback]) => {
    const callbacks = { ...options(), blockTypes: [blockType] };
    renderHook(() => useKeyboardShortcuts(callbacks));
    fireEvent.keyDown(window, init);
    expect(callbacks[callback]).toHaveBeenCalledOnce();
  });

  it('covers every entry except the Alt overlay, which has its own hook', () => {
    const covered = Object.keys(REGISTRY_CASES);
    expect(SHORTCUTS.map((shortcut) => shortcut.id).filter((id) => !covered.includes(id))).toEqual(['showHints']);
  });
});

describe('tooltips do not take the keyboard', () => {
  const addPopper = (html: string) => {
    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-radix-popper-content-wrapper', '');
    wrapper.innerHTML = html;
    document.body.append(wrapper);
    return wrapper;
  };

  it('keeps shortcuts working while a tooltip is open', () => {
    const callbacks = options();
    renderHook(() => useKeyboardShortcuts(callbacks));
    const tooltip = addPopper('<div><span role="tooltip">Hint</span></div>');
    fireEvent.keyDown(window, { key: 'n', code: 'KeyN' });
    expect(callbacks.onAddBlock).toHaveBeenCalledOnce();
    tooltip.remove();
  });

  it('still yields to a menu', () => {
    const callbacks = options();
    renderHook(() => useKeyboardShortcuts(callbacks));
    const menu = addPopper('<div role="menu"></div>');
    fireEvent.keyDown(window, { key: 'n', code: 'KeyN' });
    expect(callbacks.onAddBlock).not.toHaveBeenCalled();
    menu.remove();
  });
});

describe('Alt chords', () => {
  const alt = (init: KeyboardEventInit) => ({ ...init, altKey: true });

  it('are ignored while the overlay is hidden', () => {
    const callbacks = { ...options(), isAltChordActive: () => false };
    renderHook(() => useKeyboardShortcuts(callbacks));
    fireEvent.keyDown(window, alt({ key: 'n', code: 'KeyN' }));
    expect(callbacks.onAddBlock).not.toHaveBeenCalled();
  });

  it('fire the shown key while the overlay is up', () => {
    const callbacks = { ...options(), blockTypes: [blockType], isAltChordActive: () => true };
    renderHook(() => useKeyboardShortcuts(callbacks));
    expect(fireEvent.keyDown(window, alt({ key: 'n', code: 'KeyN' }))).toBe(false);
    fireEvent.keyDown(window, alt({ key: '1', code: 'Digit1' }));
    expect(callbacks.onAddBlock).toHaveBeenCalledOnce();
    expect(callbacks.onAddBlockOfType).toHaveBeenCalledWith('input');
  });

  it('read the physical key when Option turns the letter into a symbol', () => {
    const callbacks = { ...options(), isAltChordActive: () => true };
    renderHook(() => useKeyboardShortcuts(callbacks));
    fireEvent.keyDown(window, alt({ key: 'Dead', code: 'KeyN' }));
    fireEvent.keyDown(window, alt({ key: '©', code: 'KeyG' }));
    expect(callbacks.onAddBlock).toHaveBeenCalledOnce();
    expect(callbacks.onAddGroup).toHaveBeenCalledOnce();
  });

  it.each([
    ['Space', { key: ' ', code: 'Space' }, 'onTogglePlayMode'],
    ['Option+Space', { key: ' ', code: 'Space' }, 'onTogglePlayMode'],
    ['Esc', { key: 'Escape', code: 'Escape' }, 'onCloseSession'],
    ['Shift', { key: 'S', code: 'KeyS', shiftKey: true }, 'onOpenStartTime'],
  ] as const)('leave %s to the operating system', (_name, init, callback) => {
    const callbacks = { ...options(), isAltChordActive: () => true };
    renderHook(() => useKeyboardShortcuts(callbacks));
    fireEvent.keyDown(window, alt(init));
    expect(callbacks[callback]).not.toHaveBeenCalled();
  });
});

describe('with character keys switched off', () => {
  it('ignores single keys and Shift combinations', () => {
    const callbacks = { ...options(), characterKeysEnabled: false };
    renderHook(() => useKeyboardShortcuts(callbacks));
    fireEvent.keyDown(window, { key: 'n', code: 'KeyN' });
    fireEvent.keyDown(window, { key: ' ', code: 'Space' });
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    fireEvent.keyDown(window, { key: '?', code: 'Minus', shiftKey: true });
    fireEvent.keyDown(window, { key: 'C', code: 'KeyC', shiftKey: true });
    expect(callbacks.onAddBlock).not.toHaveBeenCalled();
    expect(callbacks.onTogglePlayMode).not.toHaveBeenCalled();
    expect(callbacks.onCloseSession).not.toHaveBeenCalled();
    expect(callbacks.onShowHelp).not.toHaveBeenCalled();
    expect(callbacks.onOpenShare).not.toHaveBeenCalled();
  });

  it('keeps undo, redo and leaving a text field', () => {
    const callbacks = { ...options(), characterKeysEnabled: false };
    renderHook(() => useKeyboardShortcuts(callbacks));
    fireEvent.keyDown(window, { key: 'z', code: 'KeyZ', metaKey: true });
    fireEvent.keyDown(window, { key: 'z', code: 'KeyZ', metaKey: true, shiftKey: true });
    expect(callbacks.onUndo).toHaveBeenCalledOnce();
    expect(callbacks.onRedo).toHaveBeenCalledOnce();

    const input = document.createElement('input');
    document.body.append(input);
    input.focus();
    fireEvent.keyDown(input, { key: 'Escape', code: 'Escape' });
    expect(document.activeElement).not.toBe(input);
    input.remove();
  });
});

describe('Space belongs to the focused control', () => {
  it.each(['button', 'a', 'radio', 'button-role'])('does not start Live Mode from %s', (kind) => {
    const callbacks = options();
    renderHook(() => useKeyboardShortcuts(callbacks));
    const control = document.createElement(kind === 'a' ? 'a' : kind === 'button' ? 'button' : 'div');
    if (kind === 'a') control.setAttribute('href', '/');
    if (kind === 'radio' || kind === 'button-role') control.setAttribute('role', kind === 'radio' ? 'radio' : 'button');
    document.body.append(control);
    expect(fireEvent.keyDown(control, { key: ' ', code: 'Space' })).toBe(true);
    expect(callbacks.onTogglePlayMode).not.toHaveBeenCalled();
    control.remove();
  });

  it('keeps the global Space shortcut on the planner background', () => {
    const callbacks = options();
    renderHook(() => useKeyboardShortcuts(callbacks));
    expect(fireEvent.keyDown(window, { key: ' ', code: 'Space' })).toBe(false);
    expect(callbacks.onTogglePlayMode).toHaveBeenCalledOnce();
  });

  it('respects keys already handled by another control or drag sensor', () => {
    const callbacks = options();
    renderHook(() => useKeyboardShortcuts(callbacks));
    const event = new KeyboardEvent('keydown', { key: ' ', code: 'Space', cancelable: true });
    event.preventDefault();
    window.dispatchEvent(event);
    expect(callbacks.onTogglePlayMode).not.toHaveBeenCalled();
  });
});

describe('day shortcuts', () => {
  const pressShiftDigit = (digit: number, target: Element | Window = window, key = String(digit)) =>
    fireEvent.keyDown(target, { key, code: `Digit${digit}`, shiftKey: true });

  it('Shift+digit selects the day at that position', () => {
    const callbacks = options();
    renderHook(() => useKeyboardShortcuts(callbacks));
    expect(pressShiftDigit(2)).toBe(false);
    expect(callbacks.onSelectDay).toHaveBeenCalledWith('d2');
  });

  it('goes by the physical key, whatever character the layout produces', () => {
    const callbacks = options();
    renderHook(() => useKeyboardShortcuts(callbacks));
    pressShiftDigit(1, window, '!');
    expect(callbacks.onSelectDay).toHaveBeenCalledWith('d1');
  });

  it('ignores a day that does not exist', () => {
    const callbacks = options();
    renderHook(() => useKeyboardShortcuts(callbacks));
    expect(pressShiftDigit(3)).toBe(true);
    expect(callbacks.onSelectDay).not.toHaveBeenCalled();
  });

  it('does not add a block of that type instead', () => {
    const callbacks = { ...options(), blockTypes: [{ id: 'input', name: 'Input', color: '#000' }, { id: 'x', name: 'X', color: '#000' }] };
    renderHook(() => useKeyboardShortcuts(callbacks));
    pressShiftDigit(2);
    expect(callbacks.onAddBlockOfType).not.toHaveBeenCalled();
  });

  it('Shift+T adds a day, T still focuses the title', () => {
    const callbacks = options();
    renderHook(() => useKeyboardShortcuts(callbacks));
    fireEvent.keyDown(window, { key: 'T', code: 'KeyT', shiftKey: true });
    expect(callbacks.onAddDay).toHaveBeenCalledOnce();
    expect(callbacks.onFocusSessionTitle).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { key: 't', code: 'KeyT' });
    expect(callbacks.onAddDay).toHaveBeenCalledOnce();
    expect(callbacks.onFocusSessionTitle).toHaveBeenCalledOnce();
  });

  it('stays out of text fields', () => {
    const callbacks = options();
    renderHook(() => useKeyboardShortcuts(callbacks));
    const input = document.createElement('input');
    document.body.append(input);
    pressShiftDigit(2, input);
    fireEvent.keyDown(input, { key: 'T', code: 'KeyT', shiftKey: true });
    expect(callbacks.onSelectDay).not.toHaveBeenCalled();
    expect(callbacks.onAddDay).not.toHaveBeenCalled();
    input.remove();
  });
});
