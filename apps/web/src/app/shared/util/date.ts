const formatters = new Map<string, Intl.DateTimeFormat>();

/**
 * Formats an ISO timestamp as a short date and time, for example "24.10.2026, 14:05" (uk-UA).
 * Uses `Intl` directly: `DatePipe` would pull the locale date formatting of `@angular/common`
 * into the initial bundle.
 */
export function formatDateTime(iso: string, locale = 'uk-UA'): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  let formatter = formatters.get(locale);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' });
    formatters.set(locale, formatter);
  }
  return formatter.format(date);
}
