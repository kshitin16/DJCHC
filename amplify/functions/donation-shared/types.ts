/**
 * donation-unit (U4) — shared domain types for the three donation Lambdas.
 *
 * This file is imported by Lambda code AND by `amplify/data/resource.ts`, so it
 * must stay free of `@aws-amplify/backend` and CDK imports: the schema pulls
 * its enum lists and index names from here, and the Lambdas validate against
 * the very same constants (one source of truth for Contract 5's enums).
 *
 * BR5.1 (project.md Forbidden): nothing here — and nothing in the aggregator
 * adapter's types — has a field that could hold a card number, CVV or UPI PIN.
 * The only payment-related values the backend ever holds are aggregator-issued
 * references (`aggregatorTransactionId`, `processedPaymentId`).
 */

/** Contract 5 enum values, verbatim (the schema is built from these). */
export const DONATION_TYPES = ['ONE_TIME', 'RECURRING'] as const;
export const DONATION_FREQUENCIES = ['MONTHLY', 'QUARTERLY', 'YEARLY'] as const;
export const DONATION_STATUSES = [
  'INITIATED',
  'PENDING',
  'SUCCEEDED',
  'FAILED',
  'CANCELLED',
] as const;

export type DonationType = (typeof DONATION_TYPES)[number];
export type DonationFrequency = (typeof DONATION_FREQUENCIES)[number];
export type DonationStatus = (typeof DONATION_STATUSES)[number];

/** Secondary index names declared on the `Donation` model (`amplify/data/resource.ts`). */
export const DONATION_STATUS_INDEX = 'statusIndex';
export const DONATION_DONOR_INDEX = 'donorIndex';

/**
 * The `Donation` item as stored in DynamoDB — entities.md's attributes plus the
 * internal idempotency marker `processedPaymentId` (security-design.md, NFR5.2)
 * and Amplify Data's `updatedAt` timestamp.
 */
export interface DonationRecord {
  id: string;
  donorGoogleId: string;
  amount: number;
  donationType: DonationType;
  frequency?: DonationFrequency;
  status: DonationStatus;
  aggregatorTransactionId?: string;
  createdAt: string;
  updatedAt: string;
  cancelledAt?: string;
  /** Internal, persistence-layer only — never returned by Contract 5. */
  processedPaymentId?: string;
}

/** Contract 5's public `Donation` type: the record minus internal attributes. */
export type Donation = Omit<DonationRecord, 'processedPaymentId' | 'updatedAt'>;

/** Contract 5's `DonationInitiation` — a checkout hand-off, not a completed Donation. */
export interface DonationInitiation {
  donationId: string;
  checkoutUrl: string;
  checkoutReference: string;
}

/** Strip the attributes Contract 5 never exposes. */
export function toPublicDonation(record: DonationRecord): Donation {
  const publicFields: Donation & Partial<Pick<DonationRecord, 'processedPaymentId' | 'updatedAt'>> =
    { ...record };
  delete publicFields.processedPaymentId;
  delete publicFields.updatedAt;
  return publicFields;
}
