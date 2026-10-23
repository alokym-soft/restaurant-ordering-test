import { CURRENCY, type Minor } from '@restaurant/contracts';

/**
 * Money helpers. All amounts are integers in minor units (kopiyky); there is no float arithmetic.
 * Conversion to major units happens only in `formatMoney`, for display.
 */

export function isMinor(value: unknown): value is Minor {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

function assertMinor(value: number, name = 'amount'): void {
  if (!Number.isSafeInteger(value)) throw new RangeError(`${name} must be an integer in minor units`);
}

export function addMoney(...amounts: Minor[]): Minor {
  return amounts.reduce((total, amount) => {
    assertMinor(amount);
    return total + amount;
  }, 0);
}

export function subtractMoney(a: Minor, b: Minor): Minor {
  assertMinor(a);
  assertMinor(b);
  return a - b;
}

/** Unit price times an integer quantity. */
export function multiplyMoney(unit: Minor, quantity: number): Minor {
  assertMinor(unit, 'unit');
  if (!Number.isSafeInteger(quantity)) throw new RangeError('quantity must be an integer');
  return unit * quantity;
}

export function clampMoney(value: Minor, min: Minor, max: Minor): Minor {
  assertMinor(value);
  return Math.min(Math.max(value, min), max);
}

/**
 * Parses user input in major units ("12", "12.5", "12,50") into minor units without floats.
 * Returns `null` for anything that is not a non-negative amount with at most two decimals.
 */
export function parseMoney(input: string): Minor | null {
  const match = /^\s*(\d{1,9})(?:[.,](\d{1,2}))?\s*$/.exec(input);
  if (!match) return null;
  const [, whole = '0', fraction = ''] = match;
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

/** Minor units as a plain decimal string for inputs, for example 1250 → "12.50". */
export function toMajorString(value: Minor): string {
  assertMinor(value);
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  return `${sign}${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

const formatters = new Map<string, Intl.NumberFormat>();

/** Formats minor units for display, for example 1250 → "12,50 ₴" (uk-UA). */
export function formatMoney(value: Minor, locale = 'uk-UA'): string {
  assertMinor(value);
  let formatter = formatters.get(locale);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: CURRENCY,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    formatters.set(locale, formatter);
  }
  // Display only: the division result is never used for arithmetic.
  return formatter.format(value / 100);
}
