/**
 * KeyboardShortcutsDialog — Lists every keyboard shortcut and switches them on or off.
 *
 * Used by: WorkshopPlanner (opened from the settings panel or with "?")
 */
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/primitives/dialog';
import { Switch } from '@/components/primitives/switch';
import { Kbd } from '@/components/atoms/Kbd';
import {
  updateKeyboardShortcutsEnabled,
  useKeyboardShortcutsEnabled,
} from '@/hooks/useKeyboardShortcutsEnabled';
import { getAltKeyLabel, getShortcutKeyLabels, SHORTCUT_GROUPS, SHORTCUTS } from '@/lib/keyboard-shortcuts';
import { cn } from '@/lib/utils';

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const KeyboardShortcutsDialog = ({ open, onOpenChange }: KeyboardShortcutsDialogProps) => {
  const { t } = useTranslation('common');
  const enabled = useKeyboardShortcutsEnabled();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('shortcuts.title')}</DialogTitle>
          <DialogDescription>{t('shortcuts.description')}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
          {SHORTCUT_GROUPS.map((group) => (
            <section key={group} aria-labelledby={`shortcut-group-${group}`}>
              <h3 id={`shortcut-group-${group}`} className="mb-1.5 text-sm font-semibold">
                {t(`shortcuts.groups.${group}`)}
              </h3>
              <dl className="space-y-1">
                {SHORTCUTS.filter((shortcut) => shortcut.group === group).map((shortcut) => (
                  <div
                    key={shortcut.id}
                    data-shortcut-row={shortcut.id}
                    className={cn(
                      'flex items-center justify-between gap-3 text-sm',
                      !enabled && !shortcut.alwaysActive && 'opacity-50',
                    )}
                  >
                    <dt>{t(`shortcuts.actions.${shortcut.id}`)}</dt>
                    <dd className="flex shrink-0 items-center gap-0.5">
                      {getShortcutKeyLabels(shortcut.id, t).map((key, index) => (
                        <Fragment key={index}>
                          {index > 0 && <span className="text-xs text-muted-foreground">+</span>}
                          <Kbd>{key}</Kbd>
                        </Fragment>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>

        <p className="text-sm text-muted-foreground">{t('shortcuts.altTip', { key: getAltKeyLabel() })}</p>

        <div className="flex items-start justify-between gap-4 border-t pt-4">
          <label htmlFor="keyboard-shortcuts-toggle" className="cursor-pointer text-sm">
            <span className="font-medium">{t('shortcuts.enabled')}</span>
            <span className="mt-0.5 block text-muted-foreground">{t('shortcuts.enabledHint')}</span>
          </label>
          <Switch
            id="keyboard-shortcuts-toggle"
            checked={enabled}
            onCheckedChange={updateKeyboardShortcutsEnabled}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
