import { accessTtlSeconds } from './auth.service';

describe('accessTtlSeconds', () => {
  it('parses 15m', () => {
    expect(accessTtlSeconds('15m')).toBe(900);
  });
});
