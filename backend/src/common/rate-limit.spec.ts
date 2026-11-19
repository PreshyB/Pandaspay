import { FixedWindowLimiter } from './rate-limit';

describe('FixedWindowLimiter', () => {
  it('allows up to the limit, then says how long to wait', () => {
    const l = new FixedWindowLimiter();
    for (let i = 0; i < 3; i++) expect(l.hit('a', 3, 60_000, 1_000)).toBe(0);
    expect(l.hit('a', 3, 60_000, 1_000)).toBeGreaterThan(0);
  });

  it('counts each key separately', () => {
    const l = new FixedWindowLimiter();
    l.hit('a', 1, 60_000, 0);
    expect(l.hit('a', 1, 60_000, 0)).toBeGreaterThan(0);
    expect(l.hit('b', 1, 60_000, 0)).toBe(0);
  });

  it('starts a fresh window once the old one ends', () => {
    const l = new FixedWindowLimiter();
    l.hit('a', 1, 1_000, 0);
    expect(l.hit('a', 1, 1_000, 500)).toBeGreaterThan(0);
    expect(l.hit('a', 1, 1_000, 1_500)).toBe(0);
  });
});
