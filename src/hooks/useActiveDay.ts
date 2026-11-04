/**
 * useActiveDay — The day of a multi-day plan that is currently shown.
 *
 * Role: UI state next to the plan. Opens a freshly loaded plan with the day from
 *       `?day=` or the day dated today, and mirrors the selection into `?day=`.
 *       `activeDayRef` serves mutations that must not wait for the next render.
 * Used by: useWorkshop
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { WorkshopData } from '@/types/workshop';
import { getDayParamFromUrl, setDayParamInUrl } from '@/lib/workshopUrl';
import {
  findChangedDayId,
  findDayForDate,
  getDayParamValue,
  hasAnyItems,
  isMultiDay,
  resolveDayId,
  resolveDayParam,
} from '@/lib/workshop-days';

export function useActiveDay(plan: WorkshopData, isPlanLoading: boolean) {
  // Null means the first day.
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const activeDayId = resolveDayId(plan, selectedDayId);
  const activeDayRef = useRef(activeDayId);
  activeDayRef.current = activeDayId;
  // True until the day selection for a freshly loaded plan has been resolved.
  const selectionPendingRef = useRef(true);

  const setActiveDay = useCallback((dayId: string) => {
    selectionPendingRef.current = false;
    // Not resolved against the plan: a day added just now is not rendered yet.
    activeDayRef.current = dayId;
    setSelectedDayId(dayId);
  }, []);

  /** Call whenever a whole plan is replaced. */
  const resetDaySelection = useCallback(() => {
    selectionPendingRef.current = true;
    setSelectedDayId(null);
  }, []);

  /** Shows the day an undo or redo changes. */
  const showChangedDay = useCallback((before: WorkshopData, after: WorkshopData) => {
    if (!isMultiDay(after)) return;
    const changed = findChangedDayId(before, after);
    if (changed && changed !== activeDayRef.current) setActiveDay(changed);
  }, [setActiveDay]);

  // Resolve the day a freshly loaded plan opens with: `?day=` first, then
  // the day dated today. Waits until the plan (e.g. a Dynamic Link) has loaded.
  useEffect(() => {
    if (!selectionPendingRef.current) return;
    if (!hasAnyItems(plan) || isPlanLoading) return;
    selectionPendingRef.current = false;
    const requested = resolveDayParam(plan, getDayParamFromUrl());
    const target = requested ?? (isMultiDay(plan) ? findDayForDate(plan, new Date()) : null);
    activeDayRef.current = resolveDayId(plan, target);
    setSelectedDayId(target);
  }, [plan, isPlanLoading]);

  // Mirror the active day into `?day=` so the address bar opens the same day.
  useEffect(() => {
    if (selectionPendingRef.current) return;
    // The ref: right after the day selection resolved, this render's activeDayId is still the old day.
    setDayParamInUrl(getDayParamValue(plan, activeDayRef.current));
  }, [plan, activeDayId]);

  return { activeDayId, activeDayRef, setActiveDay, resetDaySelection, showChangedDay };
}
