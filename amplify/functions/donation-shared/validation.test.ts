/** donation-unit — BR5.2 / BR5.3 validation tests (pure function, no I/O). */
import { validateInitiation } from './validation';

describe('donation-unit: validateInitiation', () => {
  it('accepts a positive amount for a ONE_TIME donation with no frequency (BR5.2, BR5.3)', () => {
    const result = validateInitiation({ amount: 101, donationType: 'ONE_TIME' });
    expect(result).toEqual({ ok: true, value: { amount: 101, donationType: 'ONE_TIME' } });
  });

  it('accepts any positive amount — no minimum threshold, fractional values included (BR5.2)', () => {
    expect(validateInitiation({ amount: 0.01, donationType: 'ONE_TIME' }).ok).toBe(true);
    expect(validateInitiation({ amount: 1_000_000, donationType: 'ONE_TIME' }).ok).toBe(true);
  });

  it('rejects a zero amount (BR5.2)', () => {
    const result = validateInitiation({ amount: 0, donationType: 'ONE_TIME' });
    expect(result).toMatchObject({ ok: false, rule: 'BR5.2' });
  });

  it('rejects a negative amount (BR5.2)', () => {
    expect(validateInitiation({ amount: -5, donationType: 'ONE_TIME' })).toMatchObject({
      ok: false,
      rule: 'BR5.2',
    });
  });

  it('rejects NaN, Infinity and non-numeric amounts (BR5.2)', () => {
    for (const amount of [Number.NaN, Number.POSITIVE_INFINITY, '100', null, undefined]) {
      expect(validateInitiation({ amount, donationType: 'ONE_TIME' })).toMatchObject({
        ok: false,
        rule: 'BR5.2',
      });
    }
  });

  it('rejects RECURRING without a frequency, and with an unknown frequency (BR5.3)', () => {
    expect(validateInitiation({ amount: 50, donationType: 'RECURRING' })).toMatchObject({
      ok: false,
      rule: 'BR5.3',
    });
    expect(
      validateInitiation({ amount: 50, donationType: 'RECURRING', frequency: 'WEEKLY' }),
    ).toMatchObject({ ok: false, rule: 'BR5.3' });
    expect(
      validateInitiation({ amount: 50, donationType: 'RECURRING', frequency: 'QUARTERLY' }),
    ).toEqual({
      ok: true,
      value: { amount: 50, donationType: 'RECURRING', frequency: 'QUARTERLY' },
    });
  });

  it('rejects ONE_TIME with a frequency, and an unknown donation type (BR5.3)', () => {
    expect(
      validateInitiation({ amount: 50, donationType: 'ONE_TIME', frequency: 'MONTHLY' }),
    ).toMatchObject({ ok: false, rule: 'BR5.3' });
    expect(validateInitiation({ amount: 50, donationType: 'WEEKLY_TITHE' })).toMatchObject({
      ok: false,
      rule: 'BR5.3',
    });
  });
});
