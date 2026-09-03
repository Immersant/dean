import { decodeSectionEpoch } from '@/core/session-sections/decodeSectionEpoch';

describe('decodeSectionEpoch', () => {
  it('returns non-negative integers unchanged', () => {
    expect(decodeSectionEpoch(0)).toBe(0);
    expect(decodeSectionEpoch(3)).toBe(3);
  });

  it.each([
    undefined,
    null,
    '1',
    1.5,
    -1,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    {},
  ])('fails closed to 0 for %p', value => {
    expect(decodeSectionEpoch(value)).toBe(0);
  });
});
