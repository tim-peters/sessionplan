import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Hook that manages a "copied" boolean state with an auto-reset timer.
 * Returns [ copied, trigger, reset ] where `trigger()` sets copied=true for
 * `timeout` ms and `reset()` clears it immediately. Cleans up the timeout on unmount.
 */
export function useCopiedState(timeout = 3000): [boolean, () => void, () => void] {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const trigger = useCallback(() => {
    setCopied(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopied(false), timeout);
  }, [timeout]);

  const reset = useCallback(() => {
    clearTimeout(timerRef.current);
    setCopied(false);
  }, []);

  return [copied, trigger, reset];
}
