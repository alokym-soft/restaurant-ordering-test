import {
  CURRENCY_SYMBOL,
  addMoney,
  clampMoney,
  formatMoney,
  isMinor,
  multiplyMoney,
  parseMoney,
  subtractMoney,
  toMajorString,
} from './money';

describe('money', () => {
  it('adds, subtracts and multiplies integers exactly', () => {
    expect(addMoney(10, 20, 30)).toBe(60);
    expect(addMoney()).toBe(0);
    expect(subtractMoney(100, 30)).toBe(70);
    expect(multiplyMoney(1999, 3)).toBe(5997);
    // 0.1 + 0.2 style errors cannot happen with minor units
    expect(addMoney(10, 20)).toBe(30);
  });

  it('rejects non-integer amounts and quantities', () => {
    expect(() => addMoney(1.5)).toThrow(RangeError);
    expect(() => multiplyMoney(100, 1.5)).toThrow(RangeError);
    expect(isMinor(100)).toBe(true);
    expect(isMinor(1.1)).toBe(false);
    expect(isMinor('1')).toBe(false);
  });

  it('clamps', () => {
    expect(clampMoney(500, 0, 300)).toBe(300);
    expect(clampMoney(-5, 0, 300)).toBe(0);
    expect(clampMoney(120, 0, 300)).toBe(120);
  });

  it('parses user input without floats', () => {
    expect(parseMoney('12')).toBe(1200);
    expect(parseMoney('12.5')).toBe(1250);
    expect(parseMoney('12.05')).toBe(1205);
    expect(parseMoney('12,05')).toBeNull(); // '.' is the only decimal separator
    expect(parseMoney(' 0.99 ')).toBe(99);
    expect(parseMoney('19.999')).toBeNull();
    expect(parseMoney('-1')).toBeNull();
    expect(parseMoney('abc')).toBeNull();
    expect(parseMoney('')).toBeNull();
  });

  it('converts to a major-unit string for inputs', () => {
    expect(toMajorString(1250)).toBe('12.50');
    expect(toMajorString(5)).toBe('0.05');
    expect(toMajorString(-1205)).toBe('-12.05');
  });

  it('formats as US dollars', () => {
    expect(formatMoney(123456)).toBe('$1,234.56');
    expect(formatMoney(5)).toBe('$0.05');
    expect(CURRENCY_SYMBOL).toBe('$');
  });
});
