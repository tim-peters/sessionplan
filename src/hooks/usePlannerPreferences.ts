/**
 * usePlannerPreferences — The planner's persisted UI preferences as React state.
 */
import { useState } from 'react';
import {
  getDefaultPrefs,
  getPlayModeSounds,
  getShowFullPreviewText,
  getSidebarCollapsed,
  getTimeVisualizationStrip,
  hasSidebarPreference,
  setPlayModeSounds as persistPlayModeSounds,
  setShowFullPreviewText as persistShowFullPreviewText,
  setSidebarCollapsed as persistSidebarCollapsed,
  setTimeVisualizationStrip as persistTimeVisualizationStrip,
} from '@/lib/workshopLocalStorage';

interface PlannerPreferences {
  sidebarCollapsed: boolean;
  showFullPreviewText: boolean;
  playModeSounds: boolean;
  timeVisualizationStrip: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  /** Expands the sidebar for a first block, unless the user chose a state. Not persisted. */
  expandSidebarByDefault: () => void;
  setShowFullPreviewText: (value: boolean) => void;
  setPlayModeSounds: (value: boolean) => void;
  setTimeVisualizationStrip: (value: boolean) => void;
  /** Back to the defaults, for after the stored preferences were cleared. */
  resetToDefaults: () => void;
}

export const usePlannerPreferences = (): PlannerPreferences => {
  const [sidebarCollapsed, setSidebarCollapsedState] = useState(getSidebarCollapsed);
  const [showFullPreviewText, setShowFullPreviewTextState] = useState(getShowFullPreviewText);
  const [playModeSounds, setPlayModeSoundsState] = useState(getPlayModeSounds);
  const [timeVisualizationStrip, setTimeVisualizationStripState] = useState(getTimeVisualizationStrip);

  return {
    sidebarCollapsed,
    showFullPreviewText,
    playModeSounds,
    timeVisualizationStrip,
    setSidebarCollapsed: (collapsed) => {
      setSidebarCollapsedState(collapsed);
      persistSidebarCollapsed(collapsed);
    },
    expandSidebarByDefault: () => {
      if (!hasSidebarPreference()) setSidebarCollapsedState(false);
    },
    setShowFullPreviewText: (value) => {
      setShowFullPreviewTextState(value);
      persistShowFullPreviewText(value);
    },
    setPlayModeSounds: (value) => {
      setPlayModeSoundsState(value);
      persistPlayModeSounds(value);
    },
    setTimeVisualizationStrip: (value) => {
      setTimeVisualizationStripState(value);
      persistTimeVisualizationStrip(value);
    },
    resetToDefaults: () => {
      const defaults = getDefaultPrefs();
      setSidebarCollapsedState(defaults.sidebarCollapsed);
      setShowFullPreviewTextState(defaults.showFullPreviewText);
      setPlayModeSoundsState(defaults.playModeSounds);
      setTimeVisualizationStripState(defaults.timeVisualizationStrip);
    },
  };
};
