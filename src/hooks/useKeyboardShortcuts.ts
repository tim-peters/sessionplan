/**
 * useKeyboardShortcuts — Global keyboard shortcuts for the planner.
 *
 * Role: Binds window-level keydown handlers for major planner actions
 *       (add block / group / breakout, block types 1-9, play mode,
 *       session close, focus session title/description, open date/start-time/
 *       share popovers, switch to day 1-9, add a day). Skips when focus is inside an editable element
 *       (input, textarea, contenteditable) so text editing is never
 *       hijacked. Esc additionally blurs the current input (so the user
 *       can leave a field) and is skipped when any Radix dialog or popover
 *       is open so the user can dismiss those first. Shortcuts are described
 *       for people in lib/keyboard-shortcuts; a new one belongs in both places.
 * Used by: WorkshopPlanner
 */
import { useEffect } from 'react';
import type { BlockType } from '@/types/workshop';
import { isEditableTarget, isRadixOverlayOpen } from '@/lib/keyboard-shortcuts';

export interface KeyboardShortcutsOptions {
  blockTypes: BlockType[];
  onAddBlock: () => void;
  onAddGroup: () => void;
  onAddBreakout: () => void;
  onAddBlockOfType: (blockTypeId: string) => void;
  onTogglePlayMode: () => void;
  onCloseSession: () => void;
  onFocusSessionTitle: () => void;
  onFocusSessionDescription: () => void;
  onOpenStartTime: () => void;
  onOpenDate: () => void;
  onOpenShare: () => void;
  /** Day IDs of the plan in display order; Shift+1-9 selects by position. */
  dayIds: string[];
  onSelectDay: (dayId: string) => void;
  onAddDay: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onShowHelp: () => void;
  /** True while the Alt overlay is up, which makes Alt+key act like the bare key. */
  isAltChordActive?: () => boolean;
  /** The user's setting: false leaves only undo/redo and leaving a text field. */
  characterKeysEnabled?: boolean;
  enabled?: boolean;
}

/** The letter of an Alt chord. Option on a Mac turns N into a dead key or a
 *  symbol, so that falls back to the physical key. */
const getAltChordKey = (event: KeyboardEvent, key: string): string =>
  /^[a-z]$/.test(key) ? key : event.code.replace(/^Key/, '').toLowerCase();

export const useKeyboardShortcuts = ({
  blockTypes,
  onAddBlock,
  onAddGroup,
  onAddBreakout,
  onAddBlockOfType,
  onTogglePlayMode,
  onCloseSession,
  onFocusSessionTitle,
  onFocusSessionDescription,
  onOpenStartTime,
  onOpenDate,
  onOpenShare,
  dayIds,
  onSelectDay,
  onAddDay,
  onUndo,
  onRedo,
  onShowHelp,
  isAltChordActive,
  characterKeysEnabled = true,
  enabled = true,
}: KeyboardShortcutsOptions): void => {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // A control or the drag sensor may already own this key.
      if (event.defaultPrevented) return;
      // Esc: blur current input, otherwise close session (unless a dialog/popover is open).
      if (event.key === 'Escape' && !event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey) {
        if (isEditableTarget(event.target)) {
          (event.target as HTMLElement).blur();
          event.preventDefault();
          return;
        }
        if (!characterKeysEnabled || isRadixOverlayOpen()) return;
        event.preventDefault();
        onCloseSession();
        return;
      }

      // All other shortcuts are blocked when an input/textarea is focused
      // or any Radix dialog/popover is open. (Enter and Backspace are
      // handled inline on the title inputs and are unaffected by this guard.)
      if (isEditableTarget(event.target)) return;
      if (isRadixOverlayOpen()) return;

      const key = event.key.toLowerCase();

      const isRedoShortcut = (key === 'z' && event.shiftKey) || key === 'y';
      if (isRedoShortcut && (event.metaKey || event.ctrlKey) && !event.altKey) {
        event.preventDefault();
        onRedo();
        return;
      }

      if (key === 'z' && (event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey) {
        event.preventDefault();
        onUndo();
        return;
      }

      if (!characterKeysEnabled) return;

      // Meta/Ctrl/Alt combinations are reserved for browser shortcuts, except
      // Alt+key while the Alt overlay shows that very key. Shift, Space and Esc
      // stay out: Alt+Shift, Alt+Space and Alt+Esc belong to Windows.
      const isAltChord = event.altKey && !event.metaKey && !event.ctrlKey && !event.shiftKey
        && Boolean(isAltChordActive?.());
      if ((event.metaKey || event.ctrlKey || event.altKey) && !isAltChord) return;

      // By character: "?" sits on a different key in every layout.
      if (event.key === '?') {
        event.preventDefault();
        onShowHelp();
        return;
      }

      // Shift-modified keys (date / start-time / share popovers, days).
      if (event.shiftKey) {
        if (key === 's') {
          event.preventDefault();
          onOpenStartTime();
          return;
        }
        if (key === 'd') {
          event.preventDefault();
          onOpenDate();
          return;
        }
        if (key === 'c') {
          event.preventDefault();
          onOpenShare();
          return;
        }
        if (key === 't') {
          event.preventDefault();
          onAddDay();
          return;
        }
        // By physical key: the character of Shift+digit depends on the keyboard layout.
        const dayNumber = /^Digit([1-9])$/.exec(event.code)?.[1];
        const dayId = dayNumber ? dayIds[Number(dayNumber) - 1] : undefined;
        if (dayId) {
          event.preventDefault();
          onSelectDay(dayId);
        }
        return;
      }

      // Bare keys (no modifiers).
      const bareKey = isAltChord ? getAltChordKey(event, key) : key;
      if (bareKey === 'n') {
        event.preventDefault();
        onAddBlock();
        return;
      }
      if (bareKey === 'g') {
        event.preventDefault();
        onAddGroup();
        return;
      }
      if (bareKey === 'b') {
        event.preventDefault();
        onAddBreakout();
        return;
      }
      if (bareKey === ' ') {
        // Space activates the focused control (or scrolls a focused link).
        // It must not toggle Live Mode while selecting a color, clicking a
        // button, or operating a keyboard drag handle.
        if (event.target instanceof Element && event.target.closest(
          'button, a[href], [role="button"], [role="radio"], [role="checkbox"], [role="switch"], [role="tab"], [role="slider"]',
        )) return;
        event.preventDefault();
        onTogglePlayMode();
        return;
      }
      if (bareKey === 't') {
        event.preventDefault();
        onFocusSessionTitle();
        return;
      }
      if (bareKey === 'd') {
        event.preventDefault();
        onFocusSessionDescription();
        return;
      }

      // Digit 1-9 → nth block type in the sidebar's display order.
      if (event.code.startsWith('Digit') && event.code.length === 6) {
        const digit = Number(event.code.slice(5));
        if (Number.isInteger(digit) && digit >= 1 && digit <= 9) {
          const blockType = blockTypes[digit - 1];
          if (blockType) {
            event.preventDefault();
            onAddBlockOfType(blockType.id);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    enabled,
    blockTypes,
    onAddBlock,
    onAddGroup,
    onAddBreakout,
    onAddBlockOfType,
    onTogglePlayMode,
    onCloseSession,
    onFocusSessionTitle,
    onFocusSessionDescription,
    onOpenStartTime,
    onOpenDate,
    onOpenShare,
    dayIds,
    onSelectDay,
    onAddDay,
    onUndo,
    onRedo,
    onShowHelp,
    isAltChordActive,
    characterKeysEnabled,
  ]);
};
