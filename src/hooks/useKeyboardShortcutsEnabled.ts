/**
 * useKeyboardShortcutsEnabled — Reactive read of the "keyboard shortcuts" setting.
 *
 * Role: Character-key shortcuts must be switchable off (WCAG 2.1.4). The value
 *       is read by the planner and by every button that names its shortcut in a
 *       tooltip, hence a small store instead of prop drilling.
 * Used by: WorkshopPlanner, KeyboardShortcutsDialog, useShortcutLabels
 */
import { useSyncExternalStore } from 'react';
import { getKeyboardShortcutsEnabled, setKeyboardShortcutsEnabled } from '@/lib/workshopLocalStorage';
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Re-reads the stored value, e.g. after all preferences were cleared. */
export const refreshKeyboardShortcutsEnabled = (): void => {
  listeners.forEach((listener) => listener());
};

export const updateKeyboardShortcutsEnabled = (value: boolean): void => {
  setKeyboardShortcutsEnabled(value);
  refreshKeyboardShortcutsEnabled();
};

export const useKeyboardShortcutsEnabled = (): boolean =>
  useSyncExternalStore(subscribe, getKeyboardShortcutsEnabled);
