/**
 * useAltShortcutHints — Shows the shortcut overlay while Alt/Option is held.
 *
 * Role: Holding Alt alone for a moment reveals the hints; a quick Alt+Tab or
 *       typing @ with Option never gets that far, because any other key cancels.
 *       `isAltChordActive` lets useKeyboardShortcuts accept Alt+key while the
 *       hints are up, since the hints invite exactly that key press.
 * Used by: WorkshopPlanner
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { isEditableTarget, isRadixOverlayOpen } from '@/lib/keyboard-shortcuts';
export const ALT_HOLD_MS = 400;

export const useAltShortcutHints = (enabled: boolean) => {
  const [visible, setVisible] = useState(false);
  const visibleRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    let holdTimer: ReturnType<typeof setTimeout> | undefined;
    // Set once the overlay appeared during this press, to also swallow the
    // Alt release that would otherwise focus the browser menu on Windows.
    let shownDuringPress = false;

    const setShown = (shown: boolean) => {
      visibleRef.current = shown;
      setVisible(shown);
    };

    const cancelHold = () => {
      clearTimeout(holdTimer);
      holdTimer = undefined;
    };

    const reset = () => {
      cancelHold();
      shownDuringPress = false;
      setShown(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Alt') {
        cancelHold();
        // Deferred: useKeyboardShortcuts handles this same event and must still
        // see the overlay as visible, whichever listener runs first.
        if (visibleRef.current) setTimeout(() => setShown(false), 0);
        return;
      }
      if (event.repeat || holdTimer !== undefined) return;
      // Alone only: Ctrl+Option is VoiceOver, and AltGr reports as "AltGraph"
      // or, on some systems, with Ctrl set.
      if (event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (isEditableTarget(event.target) || isRadixOverlayOpen()) return;

      holdTimer = setTimeout(() => {
        holdTimer = undefined;
        if (isEditableTarget(document.activeElement) || isRadixOverlayOpen()) return;
        shownDuringPress = true;
        setShown(true);
      }, ALT_HOLD_MS);
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.key !== 'Alt') return;
      if (shownDuringPress) event.preventDefault();
      reset();
    };

    // Alt+Tab away never delivers the keyup.
    const handleVisibilityChange = () => {
      if (document.hidden) reset();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', reset);
    window.addEventListener('pointerdown', reset);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', reset);
      window.removeEventListener('pointerdown', reset);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      reset();
    };
  }, [enabled]);

  const isAltChordActive = useCallback(() => visibleRef.current, []);

  return { visible, isAltChordActive };
};
