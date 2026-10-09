/**
 * domUtils — Browser/DOM environment utilities.
 *
 * Role: Provides helper functions that inspect the runtime environment
 *       (e.g. touch device detection) for conditional behaviour in drag & drop
 *       and other pointer-interaction code.
 */

/**
 * DOM utility functions
 */

/**
 * Checks if the device is a touch device
 */
export const isTouchDevice = (): boolean => {
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    (navigator as any).msMaxTouchPoints > 0
  );
};

/**
 * Scrolls the last block/group/breakout card into view.
 * Only runs on touch devices so desktop is unaffected.
 */
export const scrollToLastBlock = (delay = 150): void => {
  if (!isTouchDevice()) return;

  setTimeout(() => {
    const inputs = document.querySelectorAll('[data-block-title-input]');
    const last = inputs[inputs.length - 1] as HTMLElement | undefined;
    last?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, delay);
};

/**
 * Focuses and selects the last block title input after a short delay
 * Used after creating new blocks/groups/breakouts
 * Skips focusing on touch devices to prevent unwanted keyboard popups
 */
export const focusLastBlockTitleInput = (delay = 100): void => {
  // Don't focus on touch devices
  if (isTouchDevice()) {
    return;
  }

  setTimeout(() => {
    const inputs = document.querySelectorAll('[data-block-title-input]');
    const lastInput = inputs[inputs.length - 1] as HTMLInputElement;
    if (lastInput) {
      lastInput.focus();
      lastInput.select();
    }
  }, delay);
};

/**
 * Focuses and selects a specific block title input by item id, after a short delay.
 * Used after creating a sibling via the Enter key, where the newly created item's
 * title input must be the one that receives focus (not the last input in DOM order,
 * which may not match the new sibling if items exist after the reference).
 * Skips focusing on touch devices to prevent unwanted keyboard popups.
 */
export const focusBlockTitleInput = (itemId: string, delay = 100): void => {
  if (isTouchDevice()) {
    return;
  }

  setTimeout(() => {
    const input = document.querySelector(
      `[data-block-title-input][data-block-id="${itemId}"]`
    ) as HTMLInputElement | null;
    if (input) {
      input.focus();
      input.select();
    }
  }, delay);
};

/**
 * Focuses and selects the first input matching the given `data-*` attribute selector.
 * Used by the global keyboard shortcuts (T) to focus the session title input
 * without lifting refs from the header component.
 * Skips focusing on touch devices to prevent unwanted keyboard popups.
 */
export const focusSessionInput = (dataAttribute: string, delay = 0): void => {
  if (isTouchDevice()) {
    return;
  }

  setTimeout(() => {
    const input = document.querySelector(`[${dataAttribute}]`) as HTMLInputElement | null;
    if (input) {
      input.focus();
      input.select();
    }
  }, delay);
};

/**
 * Focuses or opens the element matching the given `data-*` attribute selector.
 * For `<input>` / `<textarea>`: focuses (and selects if input). For other elements
 * (e.g. a `<button>` that opens an editor on click): clicks the element, then
 * waits a tick and focuses the same-selector element that is now in the DOM
 * (e.g. the textarea that replaced the button).
 * Used by the global keyboard shortcut `D` to open / focus the session
 * description editor without lifting refs.
 * Skips focusing on touch devices to prevent unwanted keyboard popups.
 */
export const focusSessionElement = (dataAttribute: string): void => {
  if (isTouchDevice()) {
    return;
  }

  const el = document.querySelector<HTMLElement>(`[${dataAttribute}]`);
  if (!el) return;

  if (el instanceof HTMLTextAreaElement) {
    el.focus();
    return;
  }
  if (el instanceof HTMLInputElement) {
    el.focus();
    el.select();
    return;
  }

  el.click();
  setTimeout(() => {
    const next = document.querySelector<HTMLTextAreaElement | HTMLInputElement>(
      `[${dataAttribute}]`
    );
    if (next instanceof HTMLTextAreaElement) {
      next.focus();
    } else if (next instanceof HTMLInputElement) {
      next.focus();
      next.select();
    }
  }, 50);
};

/** True if the current pointer is a coarse (touch) pointer — used by the
 *  formatting toolbar to flip its placement below the selection line so it
 *  doesn't cover the native iOS/Android selection callout. Guarded for SSR
 *  and browsers without `matchMedia`. */
export const isCoarsePointer = (): boolean => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  try {
    return window.matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
};

/** True if the current platform is macOS. Prefers the modern User-Agent
 *  Client Hints API (`navigator.userAgentData.platform`) and falls back to
 *  the deprecated `navigator.platform`. Both surfaces return "macOS" or
 *  "MacIntel" on macOS, and the downstream check is a MAC substring match
 *  (case-insensitive), so the two paths are behavior-identical. */
export const isMacPlatform = (): boolean => {
  const uaData = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData;
  const platform = uaData?.platform ?? navigator.platform;
  return platform.toUpperCase().includes('MAC');
};
