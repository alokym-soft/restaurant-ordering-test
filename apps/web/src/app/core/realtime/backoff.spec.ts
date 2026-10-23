import { DEFAULT_BACKOFF, fullJitterDelay } from './backoff';

describe('fullJitterDelay', () => {
  it('grows exponentially from the base', () => {
    const max = () => 0.999_999;
    expect(fullJitterDelay(0, max)).toBe(499);
    expect(fullJitterDelay(1, max)).toBe(999);
    expect(fullJitterDelay(2, max)).toBe(1_999);
  });

  it('is capped', () => {
    expect(fullJitterDelay(20, () => 0.999_999)).toBe(DEFAULT_BACKOFF.capMs - 1);
  });

  it('can be zero (full jitter)', () => {
    expect(fullJitterDelay(5, () => 0)).toBe(0);
  });
});
