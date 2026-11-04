/**
 * keyboard-shortcuts — Registry of the planner's keyboard shortcuts.
 *
 * Role: Single description of every shortcut for the help dialog, the Alt
 *       overlay, tooltips and `aria-keyshortcuts`. The key handling itself
 *       lives in useKeyboardShortcuts; keyboardShortcuts.test.ts fires every
 *       entry at that hook so the two cannot drift apart.
 */
import { isMacPlatform } from '@/lib/domUtils';

export type ShortcutId =
  | 'addBlock'
  | 'addGroup'
  | 'addBreakout'
  | 'addBlockOfType'
  | 'focusTitle'
  | 'focusDescription'
  | 'openStartTime'
  | 'openDate'
  | 'openShare'
  | 'togglePlayMode'
  | 'closeSession'
  | 'selectDay'
  | 'addDay'
  | 'undo'
  | 'redo'
  | 'showHelp'
  | 'showHints';

export type ShortcutGroup = 'create' | 'session' | 'days' | 'editing' | 'help';

export interface ShortcutDefinition {
  id: ShortcutId;
  group: ShortcutGroup;
  /** Key tokens in press order. `DIGIT` stands for the digits 1-9. */
  keys: readonly string[];
  /** Not a character-key shortcut, so it survives the "shortcuts off" setting. */
  alwaysActive?: boolean;
}

const DIGIT = 'DIGIT';

export const SHORTCUTS: readonly ShortcutDefinition[] = [
  { id: 'addBlock', group: 'create', keys: ['N'] },
  { id: 'addGroup', group: 'create', keys: ['G'] },
  { id: 'addBreakout', group: 'create', keys: ['B'] },
  { id: 'addBlockOfType', group: 'create', keys: [DIGIT] },
  { id: 'focusTitle', group: 'session', keys: ['T'] },
  { id: 'focusDescription', group: 'session', keys: ['D'] },
  { id: 'openDate', group: 'session', keys: ['Shift', 'D'] },
  { id: 'openStartTime', group: 'session', keys: ['Shift', 'S'] },
  { id: 'openShare', group: 'session', keys: ['Shift', 'C'] },
  { id: 'togglePlayMode', group: 'session', keys: ['Space'] },
  { id: 'closeSession', group: 'session', keys: ['Esc'] },
  { id: 'selectDay', group: 'days', keys: ['Shift', DIGIT] },
  { id: 'addDay', group: 'days', keys: ['Shift', 'T'] },
  { id: 'undo', group: 'editing', keys: ['Mod', 'Z'], alwaysActive: true },
  { id: 'redo', group: 'editing', keys: ['Mod', 'Shift', 'Z'], alwaysActive: true },
  { id: 'showHelp', group: 'help', keys: ['?'] },
  { id: 'showHints', group: 'help', keys: ['Alt'] },
];

export const SHORTCUT_GROUPS: readonly ShortcutGroup[] = ['create', 'session', 'days', 'editing', 'help'];

const byId = new Map(SHORTCUTS.map((shortcut) => [shortcut.id, shortcut]));

export const getShortcut = (id: ShortcutId): ShortcutDefinition => byId.get(id)!;

type Translate = (key: string) => string;

/** The Alt key as people know it on this platform. */
export const getAltKeyLabel = (): string => (isMacPlatform() ? '⌥ Option' : 'Alt');

/** Keys as shown to people. Without `digit`, the digit token reads "1–9". */
export const getShortcutKeyLabels = (id: ShortcutId, t: Translate, digit?: number): string[] =>
  getShortcut(id).keys.map((key) => {
    if (key === DIGIT) return digit === undefined ? '1–9' : String(digit);
    if (key === 'Mod') return isMacPlatform() ? '⌘' : 'Ctrl';
    if (key === 'Space') return t('shortcuts.keys.space');
    if (key === 'Alt') return getAltKeyLabel();
    return key;
  });

export const formatShortcut = (id: ShortcutId, t: Translate, digit?: number): string =>
  getShortcutKeyLabels(id, t, digit).join('+');

/** Tight form for the overlay, where neighbouring icon buttons leave little room.
 *  "Leertaste" would run into the undo keycap, so Space keeps its short name. */
export const formatShortcutCompact = (id: ShortcutId, t: Translate, digit?: number): string =>
  getShortcut(id).keys.includes('Space')
    ? 'Space'
    : formatShortcut(id, t, digit).replace('Shift+', '⇧').replace('⌘+', '⌘');

/** Value for `aria-keyshortcuts`. */
export const getAriaKeyShortcuts = (id: ShortcutId, digit?: number): string =>
  getShortcut(id).keys.map((key) => {
    if (key === DIGIT) return String(digit ?? 1);
    if (key === 'Mod') return isMacPlatform() ? 'Meta' : 'Control';
    if (key === 'Esc') return 'Escape';
    return key;
  }).join('+');

/** True when the event's target takes typed text, so shortcuts must not fire. */
export const isEditableTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return target.isContentEditable;
};

/** True while a dialog, popover or menu owns the keyboard. Tooltips share the
 *  popper wrapper but only describe what is under the pointer, so they don't count. */
export const isRadixOverlayOpen = (): boolean => {
  if (document.querySelector('[role="dialog"][data-state="open"]')) return true;
  return Array.from(document.querySelectorAll('[data-radix-popper-content-wrapper]'))
    .some((wrapper) => !wrapper.querySelector('[role="tooltip"]'));
};
