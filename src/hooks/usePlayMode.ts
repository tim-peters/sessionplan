/**
 * usePlayMode — Live Mode state: tracks the active block during a running session.
 *
 * Role: Runtime companion to useWorkshop. Reads WorkshopData but manages its own
 *       timer (ticks every 5 s). Auto-activates when the scheduled start time is
 *       reached; supports manual start/stop with a guard that prevents auto-restart
 *       after explicit stop.
 * Used by: WorkshopPlanner (live bar rendering + timeline highlighting)
 */
import { useState, useEffect, useMemo } from 'react';
import { WorkshopData } from '@/types/workshop';
import {
  flattenTimeline,
  computePlayStates,
  resolveCurrentDisplay,
  PlayState,
  CurrentDisplay,
} from '@/lib/playModeUtils';
import { PLAY_MODE_TICK_MS } from '@/lib/timing';

export interface PlayModeState {
  isActive: boolean;
  canActivate: boolean;
  currentDisplay: CurrentDisplay | null;
  blockPlayStates: Map<string, PlayState>;
  elapsedInCurrentBlock: number;
  currentBlockEffectiveDuration: number;
  activate: () => void;
  deactivate: () => void;
}

export function usePlayMode(workshop: WorkshopData, totalDuration: number): PlayModeState {
  const [now, setNow] = useState(() => new Date());
  // When the user manually pressed "Live", we record the timestamp so that
  // elapsed is calculated from that moment (not from the scheduled sessionStart).
  const [manualStartedAt, setManualStartedAt] = useState<Date | null>(null);
  // Set to true when the user explicitly presses Stop — prevents auto re-activation.
  const [manuallyStopped, setManuallyStopped] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), PLAY_MODE_TICK_MS);
    return () => clearInterval(interval);
  }, []);

  const sessionStart = useMemo(() => {
    const { date, startTime } = workshop.workshop;
    if (!date || !startTime) return null;
    return new Date(`${date}T${startTime}`);
  }, [workshop.workshop.date, workshop.workshop.startTime]);

  // Can always activate manually (even without a date set).
  const canActivate = true;

  // Elapsed from scheduled session start (for auto mode)
  const autoElapsedMinutes = useMemo(() => {
    if (!sessionStart) return -Infinity;
    return (now.getTime() - sessionStart.getTime()) / 60000;
  }, [now, sessionStart]);

  // Auto-activate when we're within the session's scheduled time window
  const isAutoActive = useMemo(() => {
    if (!sessionStart || totalDuration === 0) return false;
    return autoElapsedMinutes >= 0 && autoElapsedMinutes <= totalDuration;
  }, [sessionStart, autoElapsedMinutes, totalDuration]);

  // Active when:
  //  - manually started (overrides everything), OR
  //  - auto condition is met AND the user hasn't manually stopped it
  const isActive =
    manualStartedAt !== null || (!manuallyStopped && isAutoActive);

  // Effective elapsed minutes:
  //  - Manual mode: from the moment the button was pressed
  //  - Auto mode: from the scheduled session start
  const elapsedMinutes = useMemo(() => {
    if (manualStartedAt !== null) {
      return Math.max(0, (now.getTime() - manualStartedAt.getTime()) / 60000);
    }
    return Math.max(0, autoElapsedMinutes);
  }, [manualStartedAt, now, autoElapsedMinutes]);

  const flatBlocks = useMemo(() => {
    const { startTime } = workshop.workshop;
    const sessionStartMinutes = startTime
      ? (() => { const [h, m] = startTime.split(':').map(Number); return h * 60 + m; })()
      : undefined;
    return flattenTimeline(workshop.items, 0, sessionStartMinutes);
  }, [workshop.items, workshop.workshop]);

  const blockPlayStates = useMemo((): Map<string, PlayState> => {
    if (!isActive) return new Map();
    return computePlayStates(flatBlocks, elapsedMinutes);
  }, [isActive, flatBlocks, elapsedMinutes]);

  const currentDisplay = useMemo((): CurrentDisplay | null => {
    if (!isActive) return null;
    return resolveCurrentDisplay(flatBlocks, elapsedMinutes);
  }, [isActive, flatBlocks, elapsedMinutes]);

  const { elapsedInCurrentBlock, currentBlockEffectiveDuration } = useMemo(() => {
    if (!currentDisplay?.current) {
      return { elapsedInCurrentBlock: 0, currentBlockEffectiveDuration: 1 };
    }
    const { current } = currentDisplay;
    return {
      elapsedInCurrentBlock: Math.max(0, elapsedMinutes - current.startMin),
      currentBlockEffectiveDuration: Math.max(1, current.endMin - current.startMin),
    };
  }, [currentDisplay, elapsedMinutes]);

  return {
    isActive,
    canActivate,
    currentDisplay,
    blockPlayStates,
    elapsedInCurrentBlock,
    currentBlockEffectiveDuration,
    activate: () => {
      // Start immediately from now, independent of scheduled time
      setManualStartedAt(new Date());
      setManuallyStopped(false);
    },
    deactivate: () => {
      setManualStartedAt(null);
      setManuallyStopped(true);
    },
  };
}
