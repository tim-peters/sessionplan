/**
 * useKeyboardShortcuts — Global keyboard shortcuts for the planner.
 *
 * Role: Binds window-level keydown handlers for major planner actions
 *       (add block / group / breakout, block types 1-9, play mode,
 *       session close, focus session title/description, open date/start-time/
 *       share popovers). Skips when focus is inside an editable element
 *       (input, textarea, contenteditable) so text editing is never
 *       hijacked. Esc additionally blurs the current input (so the user
 *       can leave a field) and is skipped when any Radix dialog or popover
 *       is open so the user can dismiss those first.
 * Used by: WorkshopPlanner
 */
import { useEffect } from 'react';
import type { BlockType } from '@/types/workshop';
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
  onUndo: () => void;
  onRedo: () => void;
  enabled?: boolean;
}

const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (target.isContentEditable) return true;
  return false;
};

const isRadixOverlayOpen = (): boolean => {
  if (document.querySelector('[role="dialog"][data-state="open"]')) return true;
  if (document.querySelector('[data-radix-popper-content-wrapper]')) return true;
  return false;
};

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
  onUndo,
  onRedo,
  enabled = true,
}: KeyboardShortcutsOptions): void => {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Esc: blur current input, otherwise close session (unless a dialog/popover is open).
      if (event.key === 'Escape' && !event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey) {
        if (isEditableTarget(event.target)) {
          (event.target as HTMLElement).blur();
          event.preventDefault();
          return;
        }
        if (isRadixOverlayOpen()) return;
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

      // Meta/Ctrl/Alt combinations are reserved for browser shortcuts.
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      // Shift-modified keys (date / start-time / share popovers).
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
        return;
      }

      // Bare keys (no modifiers).
      if (key === 'n') {
        event.preventDefault();
        onAddBlock();
        return;
      }
      if (key === 'g') {
        event.preventDefault();
        onAddGroup();
        return;
      }
      if (key === 'b') {
        event.preventDefault();
        onAddBreakout();
        return;
      }
      if (key === ' ') {
        event.preventDefault();
        onTogglePlayMode();
        return;
      }
      if (key === 't') {
        event.preventDefault();
        onFocusSessionTitle();
        return;
      }
      if (key === 'd') {
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
    onUndo,
    onRedo,
  ]);
};
