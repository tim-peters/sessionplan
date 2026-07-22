import { describe, it, expect } from 'vitest';
import { formatDate } from '@/lib/formatDate';

describe('formatDate', () => {
  it('formats an ISO date string as a long German date', () => {
    expect(formatDate('2024-03-15')).toMatch(/15\. März 2024/);
  });

  it('formats a date with single-digit day', () => {
    expect(formatDate('2024-01-05')).toMatch(/5\. Januar 2024/);
  });

  it('handles an ISO datetime string by ignoring the time', () => {
    // Use a midday UTC time so the displayed date is the same in any timezone.
    expect(formatDate('2024-06-15T12:00:00Z')).toMatch(/15\. Juni 2024/);
  });
});
