/** donation-unit — the DONATIONS_ENABLED runtime gate fails closed. */
import { DonationsDisabledError } from './errors';
import { assertDonationsEnabled, isDonationsEnabled } from './flag';

describe('donation-unit: assertDonationsEnabled', () => {
  it('throws DonationsDisabledError when the flag is unset, empty, "false" or mistyped', () => {
    for (const value of [undefined, '', 'false', 'TRUE', 'yes', '1']) {
      expect(() => assertDonationsEnabled({ DONATIONS_ENABLED: value })).toThrow(
        DonationsDisabledError,
      );
      expect(isDonationsEnabled({ DONATIONS_ENABLED: value })).toBe(false);
    }
    expect(() => assertDonationsEnabled({})).toThrow('Donations are not available yet');
  });

  it("passes only when the flag is exactly 'true'", () => {
    expect(() => assertDonationsEnabled({ DONATIONS_ENABLED: 'true' })).not.toThrow();
    expect(isDonationsEnabled({ DONATIONS_ENABLED: 'true' })).toBe(true);
  });
});
