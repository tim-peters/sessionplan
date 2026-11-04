/**
 * usePlannerShortcuts — Connects the planner's keyboard shortcuts and the Alt
 * overlay to their actions.
 */
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useAltShortcutHints } from '@/hooks/useAltShortcutHints';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useKeyboardShortcutsEnabled } from '@/hooks/useKeyboardShortcutsEnabled';
import { focusSessionElement, focusSessionInput } from '@/lib/domUtils';
import { createNewBlock, createNewBreakout, createNewGroup } from '@/lib/workshopUtils';
import { MAX_DAYS, type BlockType, type WorkshopItem } from '@/types/workshop';

const focusSessionTitle = () => focusSessionInput('data-session-title-input');
const focusSessionDescription = () => focusSessionElement('data-session-description');
const clickTrigger = (selector: string) => document.querySelector<HTMLElement>(selector)?.click();
const openDatePicker = () => clickTrigger('[data-date-trigger]');
const openSharePopover = () => clickTrigger('[data-share-trigger]');

interface UsePlannerShortcutsArgs {
  blockTypes: BlockType[];
  dayIds: string[];
  planHasItems: boolean;
  isAvailable: boolean;
  isPlayModeActive: boolean;
  activatePlayMode: () => void;
  deactivatePlayMode: () => void;
  addItem: (item: Omit<WorkshopItem, 'id'>) => void;
  addBlockOfType: (blockTypeId: string) => void;
  addDay: () => string | null;
  selectDay: (dayId: string) => void;
  closeSession: () => void;
  openStartTime: () => void;
  undo: () => void;
  redo: () => void;
}

interface PlannerShortcuts {
  addBlock: () => void;
  shortcutsHelpOpen: boolean;
  setShortcutsHelpOpen: (open: boolean) => void;
  showShortcutsHelpFromSettings: () => void;
  altHintsVisible: boolean;
}

export const usePlannerShortcuts = ({
  blockTypes,
  dayIds,
  planHasItems,
  isAvailable,
  isPlayModeActive,
  activatePlayMode,
  deactivatePlayMode,
  addItem,
  addBlockOfType,
  addDay,
  selectDay,
  closeSession,
  openStartTime,
  undo,
  redo,
}: UsePlannerShortcutsArgs): PlannerShortcuts => {
  const { t } = useTranslation('common');
  const [shortcutsHelpOpen, setShortcutsHelpOpen] = useState(false);
  const keyboardShortcutsEnabled = useKeyboardShortcutsEnabled();
  const altHints = useAltShortcutHints(isAvailable && keyboardShortcutsEnabled);

  // Add a generic (untyped) item to the end of the root timeline.
  const addBlock = useCallback(() => {
    addItem(createNewBlock(t));
  }, [addItem, t]);

  const addGroup = useCallback(() => {
    addItem(createNewGroup(t));
  }, [addItem, t]);

  const addBreakout = useCallback(() => {
    addItem(createNewBreakout(t));
  }, [addItem, t]);

  const togglePlayMode = useCallback(() => {
    if (isPlayModeActive) {
      deactivatePlayMode();
    } else {
      activatePlayMode();
    }
  }, [isPlayModeActive, activatePlayMode, deactivatePlayMode]);

  const addDayIfPossible = useCallback(() => {
    // Same as the buttons: a further day is only offered once the plan has content.
    if (!planHasItems) return;
    if (!addDay()) toast.error(t('days.maxReached', { count: MAX_DAYS }));
  }, [planHasItems, addDay, t]);

  const showHelp = useCallback((source: 'Settings' | 'Key') => {
    setShortcutsHelpOpen(true);
  }, []);
  const showHelpFromKey = useCallback(() => showHelp('Key'), [showHelp]);

  useKeyboardShortcuts({
    blockTypes,
    onAddBlock: addBlock,
    onAddGroup: addGroup,
    onAddBreakout: addBreakout,
    onAddBlockOfType: addBlockOfType,
    onTogglePlayMode: togglePlayMode,
    onCloseSession: closeSession,
    onFocusSessionTitle: focusSessionTitle,
    onFocusSessionDescription: focusSessionDescription,
    onOpenStartTime: openStartTime,
    onOpenDate: openDatePicker,
    onOpenShare: openSharePopover,
    dayIds,
    onSelectDay: selectDay,
    onAddDay: addDayIfPossible,
    onUndo: undo,
    onRedo: redo,
    onShowHelp: showHelpFromKey,
    isAltChordActive: altHints.isAltChordActive,
    characterKeysEnabled: keyboardShortcutsEnabled,
    enabled: isAvailable,
  });

  return {
    addBlock,
    shortcutsHelpOpen,
    setShortcutsHelpOpen,
    showShortcutsHelpFromSettings: () => showHelp('Settings'),
    altHintsVisible: altHints.visible,
  };
};
