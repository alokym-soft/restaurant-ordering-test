const formatter = new Intl.DateTimeFormat('en-US', { dateStyle: 'short', timeStyle: 'short' });

/**
 * Formats an ISO timestamp as a short en-US date and time, for example "10/24/26, 2:05 PM".
 * Uses `Intl` directly: `DatePipe` would pull the locale date formatting of `@angular/common`
 * into the initial bundle.
 */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : formatter.format(date);
}