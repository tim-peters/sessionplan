/**
 * useScheduledDay — ID of the day of a multi-day plan whose scheduled window
 * (date + start time + duration) contains the current time.
 *
 * Role: Lets Live Mode follow the running day instead of the visible tab.
 *       Ticks only for multi-day plans and re-renders only when the day changes;
 *       single-day plans always return null.
 * Used by: useLiveDay
 */
import { useEffect, useState } from 'react';
import { WorkshopData } from '@/types/workshop';
import { findScheduledDay, isMultiDay } from '@/lib/workshop-days';
import { PLAY_MODE_TICK_MS } from '@/lib/timing';

const currentDayId = (plan: WorkshopData): string | null =>
  isMultiDay(plan) ? findScheduledDay(plan, new Date()) : null;

export function useScheduledDay(plan: WorkshopData): string | null {
  const [dayId, setDayId] = useState(() => currentDayId(plan));

  useEffect(() => {
    setDayId(currentDayId(plan));
    if (!isMultiDay(plan)) return;
    const interval = setInterval(() => setDayId(currentDayId(plan)), PLAY_MODE_TICK_MS);
    return () => clearInterval(interval);
  }, [plan]);

  return dayId;
}
