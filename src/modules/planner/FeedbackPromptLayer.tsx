/**
 * FeedbackPromptLayer — Renders the optional in-app feedback prompt.
 *
 * Two variants:
 *   - "card"   → small bottom-right Card with two buttons (auto-dismiss 12s)
 *   - "dialog" → compact centered Dialog with 5-star rating + optional
 *                textarea, honeypot input, send/jetzt-nicht buttons
 *
 * Strings come from `public/locales/{de,en}/common.json` via the
 * `feedback.*` namespace (use the `feedback.give` key elsewhere too, e.g.
 * the settings-panel entry).
 *
 * After a successful send the layer swaps to a brief "Danke" state and
 * auto-closes. On failure it keeps the text and shows a retry hint.
 */
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Star, X } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/primitives/card';
import { Button } from '@/components/primitives/button';
import { Textarea } from '@/components/primitives/textarea';
import { Input } from '@/components/primitives/input';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/primitives/drawer';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/primitives/dialog';
import type { FeedbackVariant } from '@/hooks/useFeedbackPrompt';
import type { FeedbackPromptControls } from '@/hooks/useFeedbackPrompt';
import { useIsMobile } from '@/hooks/use-mobile';

interface FeedbackPromptLayerProps {
  variant: FeedbackVariant;
  cardCountdownMs: number;
  onOpenDialogFromCard: () => void;
  controls: FeedbackPromptControls;
}

const RATING_VALUES: number[] = [1, 2, 3, 4, 5];

export const FeedbackPromptLayer = ({
  variant,
  cardCountdownMs,
  onOpenDialogFromCard,
  controls,
}: FeedbackPromptLayerProps) => {
  const { t } = useTranslation('common');
  if (variant === 'hidden') return null;

  if (variant === 'card') {
    return (
      <Card
        role="status"
        aria-live="polite"
        className="fixed bottom-4 right-4 z-40 max-w-xs shadow-lg print:hidden"
      >
        <CardContent className="space-y-3 p-4">
          <p className="text-sm leading-snug">
            {t('feedback.cardText')}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={onOpenDialogFromCard}
              data-testid="feedback-card-open"
            >
              {t('feedback.give')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => controls.onDismiss('later')}
            >
              {t('feedback.later')}
            </Button>
            {cardCountdownMs > 0 && (
              <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                {Math.ceil(cardCountdownMs / 1000)}s
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return <FeedbackDialog controls={controls} />;
};

// ── Dialog variant ─────────────────────────────────────────────────────────

interface FeedbackDialogProps {
  controls: FeedbackPromptControls;
}

type DialogPhase = 'compose' | 'sending' | 'sent' | 'error';

const FeedbackDialog = ({ controls }: FeedbackDialogProps) => {
  const { t } = useTranslation('common');
  const [phase, setPhase] = useState<DialogPhase>('compose');
  const [rating, setRating] = useState<number>(0);
  const [text, setText] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [website, setWebsite] = useState<string>(''); // honeypot
  const formRef = useRef<HTMLFormElement>(null);

  // Reset state when the dialog is remounted. Keying on a parent-driven
  // prop would be cleaner but keeps the layer stateless; this effect is
  // enough for the only transition we care about.
  useEffect(() => {
    setPhase('compose');
    setRating(0);
    setText('');
    setEmail('');
    setWebsite('');
  }, []);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (rating < 1 || rating > 5) return;
    setPhase('sending');
    try {
      await controls.onSubmit(rating, text, website, email);
      // Toast lives in the view layer so the pure state machine / hook stay
      // side-effect free. The in-dialog "Danke" state remains for the user's
      // eye-line while the toast serves the same role after auto-close and
      // for the card-promoted path (where the dialog may close before the
      // user looks back).
      toast.success(t('feedback.sentToast'));
      setPhase('sent');
      // Auto-close after a brief "Danke" pause. We go through the hook's
      // `closeAfterSent` control so the dismiss-vs-sent semantics stay in
      // one place. If the user dismisses sooner (Esc / X / overlay) the
      // `onOpenChange` branch below also closes cleanly without a lock.
      setTimeout(() => {
        controls.closeAfterSent();
      }, 1800);
    } catch {
      // The dialog already renders `feedback.error` inline (set below);
      // the toast surfaces the same message for users who click away
      // before noticing the inline alert.
      toast.error(t('feedback.errorToast'));
      setPhase('error');
    }
  };

  const isMobile = useIsMobile();

  // Radix (Dialog) and Vaul (Drawer) both call onOpenChange(false) — on
  // Esc / overlay click / swipe-down / our explicit close. For 'sent' the
  // user is just acknowledging the "Danke" — close cleanly. For
  // 'compose' / 'error' treat as abandoned (the user effectively pressed
  // "Jetzt nicht").
  const handleOpenChange = (open: boolean): void => {
    if (open) return;
    if (phase === 'sent') {
      controls.closeAfterSent();
      return;
    }
    if (phase === 'compose' || phase === 'error') {
      controls.onMenuAbandoned();
    }
  };

  // Surface-aware heading primitives: Radix's DialogTitle/Description
  // require the DialogContent parent, so the Drawer surface must use the
  // Vaul equivalents for the same accessibility contract.
  const Heading = isMobile
    ? { Header: DrawerHeader, Title: DrawerTitle, Description: DrawerDescription, Footer: DrawerFooter }
    : { Header: DialogHeader, Title: DialogTitle, Description: DialogDescription, Footer: DialogFooter };

  const body = phase === 'sent' ? (
    <Heading.Header>
      <Heading.Title>{t('feedback.thanks')}</Heading.Title>
    </Heading.Header>
  ) : (
    <form ref={formRef} onSubmit={onSubmit} aria-busy={phase === 'sending'} className="space-y-4">
      <Heading.Header>
        <Heading.Title>{t('feedback.promptTitle')}</Heading.Title>
        <Heading.Description className="mr-4">
          {t('feedback.promptDescription')}
        </Heading.Description>
      </Heading.Header>

      <div className="space-y-4 mx-4 md:mx-0">
        <div className="flex items-center gap-1" role="radiogroup" aria-label={t('feedback.satisfaction')}>
          {RATING_VALUES.map((value) => (
            <Button variant="plain" size="none"
              key={value}
              type="button"
              role="radio"
              aria-checked={rating === value}
              aria-label={t('feedback.starsOf', { value })}
              onClick={() => {
                setRating(value);
              }}
              className="rounded p-1 hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Star
                className={
                  value <= rating
                    ? 'h-6 w-6 fill-amber-700 text-amber-700 dark:fill-amber-300 dark:text-amber-300'
                    : 'h-6 w-6 text-muted-foreground'
                }
              />
            </Button>
          ))}
        </div>

        <Textarea
          value={text}
          onChange={(event) => setText(event.target.value.slice(0, 2000))}
          placeholder={t('feedback.textPlaceholder')}
          maxLength={2000}
          aria-label={t('feedback.textLabel')}
        />

        {/* Optional reply address. Sending it is the user's explicit
            decision (typed into a labeled field); the server seals it
            with the operator key before it touches disk. Without it the
            submission stays fully anonymous. */}
        <div className="space-y-1">
          <Input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value.trimStart().slice(0, 254))}
            placeholder={t('feedback.emailPlaceholder')}
            maxLength={254}
            aria-label={t('feedback.emailLabel')}
            aria-describedby="feedback-email-hint"
            autoComplete="off"
            className="text-sm"
          />
          <p className="text-xs text-muted-foreground" id="feedback-email-hint">
            {t('feedback.emailHint')}
          </p>
        </div>

        {phase === 'error' && (
          <p className="text-sm text-destructive-text" role="alert">
            {t('feedback.error')}
          </p>
        )}

        {/* Honeypot — hidden from humans, picked up by bots. CSS-hidden so
            screen readers and tab-order skip it. */}
        <div className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden" aria-hidden>
          <label htmlFor="feedback-website">{t('feedback.website')}</label>
          <input
            id="feedback-website"
            type="text"
            name="website"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
            autoComplete="off"
            tabIndex={-1}
          />
        </div>
      </div>

      <Heading.Footer className="gap-2 sm:space-x-0 flex-col-reverse sm:flex-row">
        <Button
          type="button"
          variant="ghost"
          onClick={() => controls.onDismiss('close')}
          disabled={phase === 'sending'}
        >
          <X className="h-4 w-4" />
          {t('feedback.notNow')}
        </Button>
        <Button
          type="submit"
          disabled={rating < 1 || phase === 'sending'}
        >
          {t('feedback.submit')}
        </Button>
      </Heading.Footer>
    </form>
  );

  // Mobile: bottom drawer (Vaul) instead of a centered popup — the bottom
  // sheet matches the app's native mobile pattern (see BlockEditDialog).
  if (isMobile) {
    return (
      <Drawer open onOpenChange={handleOpenChange}>
        <DrawerContent
          className="max-h-[92dvh] overflow-y-auto"
          // No focus steal on open, same as the desktop dialog.
          onOpenAutoFocus={(event) => event.preventDefault()}
          data-testid="feedback-dialog"
        >
          {body}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-sm"
        // Don't steal focus on open — the user might be on a non-keyboard
        // device and a surprise focus jump is jarring.
        onOpenAutoFocus={(event) => event.preventDefault()}
        data-testid="feedback-dialog"
      >
        {body}
      </DialogContent>
    </Dialog>
  );
};
