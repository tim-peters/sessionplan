/**
 * playModeUtils — Barrel re-export for Live Mode computation modules.
 *
 * Actual implementation is split into playModeTimeline.ts, playModeState.ts,
 * and playModeDisplay.ts.
 */
export { flattenTimeline, type FlatBlock } from './playModeTimeline';
export { computePlayStates, type PlayState } from './playModeState';
export { resolveCurrentDisplay, type CurrentDisplay } from './playModeDisplay';
