import { formatDateTime } from './date';

describe('formatDateTime', () => {
  it('formats as a short en-US date and time', () => {
    // Midday UTC keeps the calendar date the same in every time zone from UTC-11 to UTC+11.
    expect(formatDateTime('2026-10-24T12:00:00.000Z')).toMatch(/^10\/24\/26, \d{1,2}:\d{2}\s?[AP]M$/);
  });

  it('returns an empty string for an invalid timestamp', () => {
    expect(formatDateTime('not a date')).toBe('');
  });
});