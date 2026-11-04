/**
 * useShortcutLabels — Tooltip text and DOM attributes for shortcut-bearing controls.
 *
 * Role: `withHint` appends the key to a tooltip; `hintAttrs` marks the element
 *       for the Alt overlay and assistive technology. Both stay silent while the
 *       shortcut is switched off, so the UI never advertises a dead key.
 * Used by: every control that has a keyboard shortcut
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useKeyboardShortcutsEnabled } from '@/hooks/useKeyboardShortcutsEnabled';
import { formatShortcut, getAriaKeyShortcuts, getShortcut, type ShortcutId } from '@/lib/keyboard-shortcuts';

export const useShortcutLabels = () => {
  const { t } = useTranslation('common');
  const enabled = useKeyboardShortcutsEnabled();

  return useMemo(() => {
    const isActive = (id: ShortcutId) => enabled || Boolean(getShortcut(id).alwaysActive);
    return {
      withHint: (label: string, id: ShortcutId, digit?: number): string =>
        isActive(id) ? `${label} (${formatShortcut(id, t, digit)})` : label,
      hintAttrs: (id: ShortcutId, digit?: number) =>
        isActive(id)
          ? {
              'data-shortcut': id,
              'data-shortcut-digit': digit,
              'aria-keyshortcuts': getAriaKeyShortcuts(id, digit),
            }
          : {},
    };
  }, [enabled, t]);
};
