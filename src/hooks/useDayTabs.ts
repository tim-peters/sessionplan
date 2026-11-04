/**
 * useDayTabs — Interaction state shared by the day tab layouts: renaming,
 * keyboard navigation, focus after a switch and confirming a deletion.
 *
 * Used by: DayStrip, DayBoxes
 */
import { KeyboardEvent, useEffect, useRef, useState } from 'react';
import type { DayMetaUpdates, ResolvedDay } from '@/lib/workshop-days';

interface UseDayTabsOptions {
  days: ResolvedDay[];
  activeDayId: string;
  onSelect: (dayId: string) => void;
  onRemove: (dayId: string) => void;
  onUpdate: (dayId: string, updates: DayMetaUpdates) => void;
}

export function useDayTabs({ days, activeDayId, onSelect, onRemove, onUpdate }: UseDayTabsOptions) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const dayButtons = useRef(new Map<string, HTMLButtonElement>());
  const focusActiveDayRef = useRef(false);

  useEffect(() => {
    // The whole day, not just its button: the menu and controls sit next to it.
    dayButtons.current.get(activeDayId)?.parentElement?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    // A collapsed box was not focusable, and the menu's button moved along with the active box.
    if (focusActiveDayRef.current) dayButtons.current.get(activeDayId)?.focus();
    focusActiveDayRef.current = false;
  }, [activeDayId]);

  const startRename = (day: ResolvedDay) => {
    setRenamingId(day.id);
    setRenameValue(day.title ?? '');
  };

  const commitRename = () => {
    if (renamingId) {
      const current = days.find((day) => day.id === renamingId);
      const title = renameValue.trim();
      if (current && (current.title ?? '') !== title) onUpdate(renamingId, { title });
    }
    setRenamingId(null);
  };

  /** Switches to a day and keeps the keyboard focus on it. */
  const selectWithFocus = (dayId: string) => {
    focusActiveDayRef.current = true;
    onSelect(dayId);
    dayButtons.current.get(dayId)?.focus();
  };

  const handleDayKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const targets: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: days.length - 1,
    };
    const target = targets[event.key];
    if (target === undefined) return;
    event.preventDefault();
    selectWithFocus(days[(target + days.length) % days.length].id);
  };

  /** A click on the shown day edits its title, on any other day it switches. */
  const handleDayClick = (day: ResolvedDay) => {
    if (day.id === activeDayId) startRename(day);
    else onSelect(day.id);
  };

  const registerDayButton = (dayId: string) => (node: HTMLButtonElement | null) => {
    if (node) dayButtons.current.set(dayId, node);
    else dayButtons.current.delete(dayId);
  };

  /** A day with blocks asks first; an empty one has nothing to lose. */
  const requestRemove = (day: ResolvedDay) => {
    if (day.items.length > 0) setConfirmDeleteId(day.id);
    else onRemove(day.id);
  };

  return {
    renamingId,
    renameValue,
    setRenameValue,
    startRename,
    commitRename,
    cancelRename: () => setRenamingId(null),
    selectWithFocus,
    /** For the next day switch that does not start from a day button. */
    focusActiveDayNext: () => { focusActiveDayRef.current = true; },
    handleDayKeyDown,
    handleDayClick,
    registerDayButton,
    requestRemove,
    confirmDay: days.find((day) => day.id === confirmDeleteId) ?? null,
    closeDeleteDialog: () => setConfirmDeleteId(null),
  };
}
