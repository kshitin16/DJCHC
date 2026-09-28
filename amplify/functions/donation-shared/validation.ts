/**
 * donation-unit (U4) — input validation for `initiateDonation` (Initiate
 * Donation workflow, steps 1–2). Runs BEFORE any Donation record is created.
 *
 * - BR5.2: the amount must be a positive, finite number; there is no minimum
 *   or maximum threshold (entities.md: the 0.01 floor is "greater than zero",
 *   not a donation minimum).
 * - BR5.3: `frequency` is required iff `donationType` is RECURRING, and must
 *   be absent for ONE_TIME.
 *
 * Pure function, typed result — no throwing, so the handler decides how to
 * surface a rejection.
 */
import {
  DONATION_FREQUENCIES,
  DONATION_TYPES,
  type DonationFrequency,
  type DonationType,
} from './types';

export interface InitiationInput {
  amount: unknown;
  donationType: unknown;
  frequency?: unknown;
}

export interface ValidInitiation {
  amount: number;
  donationType: DonationType;
  frequency?: DonationFrequency;
}

export type ValidationResult =
  { ok: true; value: ValidInitiation } | { ok: false; rule: 'BR5.2' | 'BR5.3'; message: string };

function isDonationType(value: unknown): value is DonationType {
  return typeof value === 'string' && (DONATION_TYPES as readonly string[]).includes(value);
}

function isDonationFrequency(value: unknown): value is DonationFrequency {
  return typeof value === 'string' && (DONATION_FREQUENCIES as readonly string[]).includes(value);
}

export function validateInitiation(input: InitiationInput): ValidationResult {
  const { amount, donationType, frequency } = input;

  // BR5.2 — positive, finite amount. NaN/Infinity are rejected explicitly:
  // `NaN > 0` is false, but `Infinity > 0` is true and must not slip through.
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    return { ok: false, rule: 'BR5.2', message: 'Donation amount must be greater than zero' };
  }

  if (!isDonationType(donationType)) {
    return {
      ok: false,
      rule: 'BR5.3',
      message: `Donation type must be one of ${DONATION_TYPES.join(', ')}`,
    };
  }

  // BR5.3 — frequency iff RECURRING.
  const hasFrequency = frequency !== undefined && frequency !== null;
  if (donationType === 'RECURRING') {
    if (!hasFrequency || !isDonationFrequency(frequency)) {
      return {
        ok: false,
        rule: 'BR5.3',
        message: `A recurring donation needs a frequency (${DONATION_FREQUENCIES.join(', ')})`,
      };
    }
    return { ok: true, value: { amount, donationType, frequency } };
  }

  if (hasFrequency) {
    return {
      ok: false,
      rule: 'BR5.3',
      message: 'A one-time donation must not specify a frequency',
    };
  }
  return { ok: true, value: { amount, donationType } };
}
