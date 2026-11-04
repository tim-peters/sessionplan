import { fireEvent, render, renderHook, screen } from '@testing-library/react';
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { KeyboardShortcutsDialog } from '@/components/sections/KeyboardShortcutsDialog';
import { refreshKeyboardShortcutsEnabled, updateKeyboardShortcutsEnabled } from '@/hooks/useKeyboardShortcutsEnabled';
import { useShortcutLabels } from '@/hooks/useShortcutLabels';
import { SHORTCUT_GROUPS, SHORTCUTS } from '@/lib/keyboard-shortcuts';
import { getKeyboardShortcutsEnabled } from '@/lib/workshopLocalStorage';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

beforeEach(() => {
  localStorage.clear();
  refreshKeyboardShortcutsEnabled();
});

describe('KeyboardShortcutsDialog', () => {
  it('lists every shortcut', () => {
    render(<KeyboardShortcutsDialog open onOpenChange={() => {}} />);
    SHORTCUTS.forEach((shortcut) => {
      expect(screen.getByText(`shortcuts.actions.${shortcut.id}`)).toBeTruthy();
    });
  });

  it('switches shortcuts off, dims them and remembers it', () => {
    render(<KeyboardShortcutsDialog open onOpenChange={() => {}} />);
    const row = (id: string) => document.querySelector(`[data-shortcut-row="${id}"]`)!;
    expect(row('addBlock').className).not.toContain('opacity-50');

    fireEvent.click(screen.getByRole('switch'));

    expect(row('addBlock').className).toContain('opacity-50');
    expect(row('undo').className).not.toContain('opacity-50');
    expect(getKeyboardShortcutsEnabled()).toBe(false);
  });
});

describe('useShortcutLabels', () => {
  it('names the key in tooltips and marks the element', () => {
    const { result } = renderHook(() => useShortcutLabels());
    expect(result.current.withHint('Share', 'openShare')).toBe('Share (Shift+C)');
    expect(result.current.withHint('Day 2', 'selectDay', 2)).toBe('Day 2 (Shift+2)');
    expect(result.current.hintAttrs('openShare')).toMatchObject({
      'data-shortcut': 'openShare',
      'aria-keyshortcuts': 'Shift+C',
    });
    expect(result.current.hintAttrs('closeSession')['aria-keyshortcuts']).toBe('Escape');
  });

  it('stops advertising keys that are switched off, except undo', () => {
    const { result } = renderHook(() => useShortcutLabels());
    act(() => updateKeyboardShortcutsEnabled(false));
    expect(result.current.withHint('Share', 'openShare')).toBe('Share');
    expect(result.current.hintAttrs('openShare')).toEqual({});
    expect(result.current.withHint('Undo', 'undo')).toContain('Z)');
  });
});

describe('translations', () => {
  it.each(['de', 'en'])('%s names every shortcut and group', (language) => {
    const { shortcuts } = JSON.parse(readFileSync(`public/locales/${language}/common.json`, 'utf8'));
    SHORTCUTS.forEach((shortcut) => expect(shortcuts.actions[shortcut.id]).toBeTruthy());
    SHORTCUT_GROUPS.forEach((group) => expect(shortcuts.groups[group]).toBeTruthy());
  });
});
