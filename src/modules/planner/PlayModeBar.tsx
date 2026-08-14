import { useEffect, useState } from 'react';
import { Radio, ClockPlus, X, ChevronRight, Bell, BellOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/primitives/button';
import { cn } from '@/lib/utils';

interface PlayModeBarProps {
  label: string | null;
  prevLabel: string | null;
  nextLabel: string | null;
  elapsedInCurrentBlock: number;
  currentBlockDuration: number;
  soundPulse: number;
  onExtendBlock: () => void;
  soundsEnabled: boolean;
  onToggleSounds: () => void;
  onDeactivate: () => void;
}

export const PlayModeBar = ({
  label,
  prevLabel,
  nextLabel,
  elapsedInCurrentBlock,
  currentBlockDuration,
  soundPulse,
  onExtendBlock,
  soundsEnabled,
  onToggleSounds,
  onDeactivate,
}: PlayModeBarProps) => {
  const { t } = useTranslation('common');
  const remaining = Math.max(0, currentBlockDuration - elapsedInCurrentBlock);
  const progress =
    currentBlockDuration > 0
      ? Math.min(1, elapsedInCurrentBlock / currentBlockDuration)
      : 0;
  // Bar grows from 0% to 100% as the block progresses
  const progressWidth = `${Math.round(progress * 100)}%`;

  const isSessionEnded = label === null;
  const [isSoundPulsing, setIsSoundPulsing] = useState(false);
  const soundPulseClass = isSoundPulsing ? 'bg-primary/20 text-primary' : '';

  useEffect(() => {
    if (soundPulse === 0) return;

    setIsSoundPulsing(true);
    const timeout = window.setTimeout(() => setIsSoundPulsing(false), 300);
    return () => window.clearTimeout(timeout);
  }, [soundPulse]);

  return (
    <div className="sm:m-4 sm:mt-3 bg-[color-mix(in_srgb,color-mix(in_srgb,hsl(var(--primary))_10%,hsl(var(--background))_90%)_95%,transparent)] backdrop-blur supports-[backdrop-filter]:bg-[color-mix(in_srgb,color-mix(in_srgb,hsl(var(--primary))_30%,hsl(var(--background))_70%)_30%,transparent)] sm:border sm:rounded-lg print:hidden">
      {/* Countdown progress bar */}
      <div className="flex items-center gap-1 sm:gap-2 px-0 pt-0">
        {/* Left line — filled (primary), only when there's a previous block */}
        {prevLabel !== null ? (
          <div className='h-1.5 w-2 sm:w-5 lg:w-14 rounded-r bg-muted-foreground/40' />
        ) : 
          <div className="w-2 sm:w-5 lg:w-14" />}
        {/* Center bar */}
        <div className={cn(
          'w-32 flex-1 h-1.5 rounded-full overflow-hidden shrink-0',
          isSessionEnded ? 'bg-muted-foreground/40' : 'bg-primary/15',
          )}
          >
          <div
            className='h-full rounded-full transition-all duration-5000 ease-linear bg-primary'
            style={{ width: progressWidth }}
          />
        </div>
        {/* Right line — unfilled, only when there's a next block */}
        {nextLabel !== null ? (
          <div className="h-1.5 w-2 sm:w-5 lg:w-14 rounded-l bg-primary/15" />
        ) : 
          <div className="w-2 sm:w-5 lg:w-14" />}
      </div>

      {/* Content row */}
      <div className="mx-auto px-4 sm:px-8 lg:px-20 py-2 flex items-center gap-3 min-h-[40px]">
        {/* Current + next block info */}
        <div className="flex-1 min-w-0 flex items-center gap-2">
          {isSessionEnded ? (
            <span className="text-sm font-medium text-muted-foreground">{t('playMode.sessionEnded')}</span>
          ) : (
            <>
              <span className="text-sm font-semibold truncate">{label}</span>
              <span className="flex items-center gap-1 text-xs text-primary shrink-0 tabular-nums">
                {/* Live indicator */}
                <div
                  className={cn(
                    'flex items-center justify-center w-5 h-5 rounded-full shrink-0',
                    isSessionEnded ? 'bg-muted' : 'bg-primary/10  animate-pulse',
                  )}
                >
                  <Radio
                    className={cn(
                      'h-2.5 w-2.5',
                      isSessionEnded ? 'text-muted-foreground' : 'text-primary',
                    )}
                  />
                </div>
                <span className="hidden sm:inline">{t('playMode.remaining')}</span> {Math.round(remaining)} Min.
              </span>
            </>
          )}

          {nextLabel && (
            <>
              <ChevronRight className="h-3.5 w-3.5 text-foreground shrink-0" />
              <span className="text-xs text-foreground truncate hidden sm:inline">{t('playMode.next')}</span>
              <span className="text-xs text-foreground truncate">
                {nextLabel}
              </span>
            </>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleSounds}
            className={cn("group h-7 w-7 transition-bg transition-colors", soundPulseClass)}
            title={t(soundsEnabled ? 'playMode.disableSounds' : 'playMode.enableSounds')}
            aria-label={t(soundsEnabled ? 'playMode.disableSounds' : 'playMode.enableSounds')}
            aria-pressed={soundsEnabled}
          >
            {soundsEnabled ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
          </Button>
          {!isSessionEnded && (
            <Button
              variant="outline"
              size="sm"
              onClick={onExtendBlock}
              className="h-7 text-xs px-2 gap-1 text-foreground"
              title={t('playMode.extend5Min')}
            >
              <ClockPlus className="h-3 w-3" />
              5 <span className="hidden sm:inline">Min.</span>
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onDeactivate}
            className="h-7 w-7"
            title={t('playMode.stop')}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
};
