/**
 * usePlayMode — Live Mode state: tracks the active block during a running session.
 *
 * Role: Runtime companion to useWorkshop. Reads WorkshopData but manages its own
 *       timer (ticks every 5 s). Auto-activates when the scheduled start time is
 *       reached; supports manual start/stop with a guard that keeps a stopped
 *       scheduled window off, while a later window starts again.
 * Used by: WorkshopPlanner (live bar rendering + timeline highlighting)
 */
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { WorkshopData } from '@/types/workshop';
import { timeToMinutes } from '@/lib/clock-time';
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
  currentDisplay: CurrentDisplay | null;
  blockPlayStates: Map<string, PlayState>;
  /** Minutes elapsed since the live session started (clamped to ≥ 0).
   *  Always defined when `isActive` is true; meaningless otherwise. */
  elapsedMinutes: number;
  elapsedInCurrentBlock: number;
  currentBlockEffectiveDuration: number;
  soundPulse: number;
  activate: () => void;
  deactivate: () => void;
}

export function usePlayMode(
  workshop: WorkshopData,
  totalDuration: number,
  soundsEnabled = true,
): PlayModeState {
  const [now, setNow] = useState(() => new Date());
  // When the user manually pressed "Live", we record the timestamp so that
  // elapsed is calculated from that moment (not from the scheduled sessionStart).
  const [manualStartedAt, setManualStartedAt] = useState<Date | null>(null);
  // Start of the scheduled window the user explicitly stopped — prevents its auto re-activation.
  const [stoppedWindow, setStoppedWindow] = useState<number | null>(null);
  const [soundPulse, setSoundPulse] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), PLAY_MODE_TICK_MS);
    return () => clearInterval(interval);
  }, []);

  const { date, startTime } = workshop.workshop;

  const sessionStart = useMemo(() => {
    if (!date || !startTime) return null;
    return new Date(`${date}T${startTime}`);
  }, [date, startTime]);

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

  const scheduledWindow = isAutoActive ? sessionStart?.getTime() ?? null : null;

  // Active when:
  //  - manually started (overrides everything), OR
  //  - auto condition is met AND the user hasn't manually stopped this window
  const isActive =
    manualStartedAt !== null || (isAutoActive && stoppedWindow !== scheduledWindow);

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
    const sessionStartMinutes = startTime ? timeToMinutes(startTime) : undefined;
    return flattenTimeline(workshop.items, 0, sessionStartMinutes);
  }, [workshop.items, startTime]);

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

  const activate = useCallback(() => {
    // Start immediately from now, independent of scheduled time
    setManualStartedAt(new Date());
    setStoppedWindow(null);
  }, []);

  const deactivate = useCallback(() => {
    setManualStartedAt(null);
    setStoppedWindow(scheduledWindow);
  }, [scheduledWindow]);

  const previousAudioState = useRef<{
    isActive: boolean;
    currentBlockId: string | null;
  }>({ isActive: false, currentBlockId: null });
  const soundsEnabledRef = useRef(soundsEnabled);
  soundsEnabledRef.current = soundsEnabled;

  useEffect(() => {
    const previous = previousAudioState.current;
    const currentBlockId = currentDisplay?.current?.id ?? null;
    previousAudioState.current = { isActive, currentBlockId };

    if (!soundsEnabled) return;

    let sound: string | null = null;
    // Play Mode has just started.
    if (isActive && !previous.isActive) {
      sound = '/assets/ding.mp3';
    // The current block has ended without another block to switch to.
    } else if (isActive && currentBlockId === null && previous.currentBlockId !== null) {
      sound = '/assets/success.mp3';
    // The current block's time is up and Play Mode switches to the next block.
    } else if (
      isActive &&
      currentBlockId !== null &&
      previous.currentBlockId !== null &&
      currentBlockId !== previous.currentBlockId
    ) {
      sound = '/assets/dingdong.mp3';
    // The automatically running session has reached its total duration.
    } else if (!isActive && previous.isActive && elapsedMinutes >= totalDuration) {
      sound = '/assets/success.mp3';
    }

    if (!sound) return;

    const audio = new Audio(sound);
    void audio
      .play()
      .then(() => {
        if (soundsEnabledRef.current) {
          setSoundPulse((pulse) => pulse + 1);
        }
      })
      .catch(() => {
        // Browsers may block playback when Play Mode starts automatically.
      });
  }, [currentDisplay, elapsedMinutes, isActive, soundsEnabled, totalDuration]);

  return {
    isActive,
    currentDisplay,
    blockPlayStates,
    // Surface the total elapsed minutes (clamped) so consumers like the time-
    // visualization strip can show a "current position" marker even when no
    // specific block is active (e.g. between blocks during a fixedStartTime gap).
    elapsedMinutes: isActive ? Math.max(0, elapsedMinutes) : 0,
    elapsedInCurrentBlock,
    currentBlockEffectiveDuration,
    soundPulse,
    activate,
    deactivate,
  };
}
