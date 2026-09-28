/**
 * donation-unit — tests for the `Donation` model and Contract 5 operations in
 * the shared Amplify Data schema.
 *
 * `@aws-amplify/backend` is NOT mocked and nothing is synthesized: the tests
 * read the exported schema definition object and the GraphQL SDL that
 * `schema.transform()` derives from it — the same SDL AppSync will be given.
 */
import {
  DONATION_DONOR_INDEX,
  DONATION_FREQUENCIES,
  DONATION_STATUSES,
  DONATION_STATUS_INDEX,
  DONATION_TYPES,
  schema,
} from './resource';
import { DONATIONS_ENABLED } from '../donations-flag';

type EnumLike = { values: readonly string[] };
type IndexLike = { data: { partitionKey: string; sortKeys: readonly string[]; indexName: string } };
type ModelLike = {
  data: {
    fields: Record<string, unknown>;
    secondaryIndexes: readonly IndexLike[];
  };
};
type OperationLike = { data: { arguments: Record<string, unknown> | null; typeName: string } };
type CustomTypeLike = { data: { fields: Record<string, unknown> } };

const types = schema.data.types as Record<string, unknown>;
const sdl = schema.transform().schema;

describe('donation-unit: Donation schema (Contract 5, entities.md)', () => {
  it('declares the three enums with Contract 5 values, verbatim', () => {
    expect((types.DonationType as EnumLike).values).toEqual(['ONE_TIME', 'RECURRING']);
    expect((types.DonationFrequency as EnumLike).values).toEqual([
      'MONTHLY',
      'QUARTERLY',
      'YEARLY',
    ]);
    expect((types.DonationStatus as EnumLike).values).toEqual([
      'INITIATED',
      'PENDING',
      'SUCCEEDED',
      'FAILED',
      'CANCELLED',
    ]);
    // The exported constants the Lambdas validate against are the same lists.
    expect([...DONATION_TYPES]).toEqual((types.DonationType as EnumLike).values);
    expect([...DONATION_FREQUENCIES]).toEqual((types.DonationFrequency as EnumLike).values);
    expect([...DONATION_STATUSES]).toEqual((types.DonationStatus as EnumLike).values);
  });

  it('declares every entities.md field plus the internal processedPaymentId, and nothing that could hold raw payment details (BR5.1)', () => {
    const fields = Object.keys((types.Donation as ModelLike).data.fields);
    expect(fields.sort()).toEqual(
      [
        'donorGoogleId',
        'amount',
        'donationType',
        'frequency',
        'status',
        'aggregatorTransactionId',
        'createdAt',
        'cancelledAt',
        'processedPaymentId',
      ].sort(),
    );
    expect(sdl).toContain('donorGoogleId: String!');
    expect(sdl).toContain('amount: Float!');
    expect(sdl).toContain('donationType: DonationType!');
    expect(sdl).toContain('frequency: DonationFrequency\n');
    expect(sdl).toContain('status: DonationStatus!');
    expect(sdl).toContain('createdAt: AWSDateTime!');
    expect(sdl).toContain('cancelledAt: AWSDateTime\n');
    expect(fields.join(' ')).not.toMatch(/card|cvv|pin|upi|pan\b/i);
  });

  it('declares statusIndex and donorIndex, both sorted by createdAt', () => {
    const indexes = (types.Donation as ModelLike).data.secondaryIndexes.map((i) => i.data);
    expect(indexes).toEqual([
      expect.objectContaining({
        partitionKey: 'status',
        sortKeys: ['createdAt'],
        indexName: DONATION_STATUS_INDEX,
      }),
      expect.objectContaining({
        partitionKey: 'donorGoogleId',
        sortKeys: ['createdAt'],
        indexName: DONATION_DONOR_INDEX,
      }),
    ]);
    expect(DONATION_STATUS_INDEX).toBe('statusIndex');
    expect(DONATION_DONOR_INDEX).toBe('donorIndex');
  });

  it('grants owners (donorGoogleId matched on the JWT sub claim) READ only — no model-API writes', () => {
    const authDirective = sdl.match(/type Donation @model @auth\(rules: \[(.*)\]\)/)?.[1] ?? '';
    expect(authDirective).toContain('allow: owner');
    expect(authDirective).toContain('ownerField: "donorGoogleId"');
    expect(authDirective).toContain('identityClaim: "sub"');
    expect(authDirective).toContain('operations: [read]');
    expect(authDirective).not.toMatch(
      /create|update|delete|allow: private|allow: public|allow: groups/,
    );
  });

  it('exposes the three Contract 5 custom operations with the contract argument names, all authenticated-only and Lambda-handled', () => {
    expect(Object.keys((types.initiateDonation as OperationLike).data.arguments ?? {})).toEqual([
      'amount',
      'donationType',
      'frequency',
    ]);
    expect(Object.keys((types.cancelDonation as OperationLike).data.arguments ?? {})).toEqual([
      'id',
    ]);
    expect(Object.keys((types.myDonations as OperationLike).data.arguments ?? {})).toEqual([]);
    expect((types.initiateDonation as OperationLike).data.typeName).toBe('Mutation');
    expect((types.cancelDonation as OperationLike).data.typeName).toBe('Mutation');
    expect((types.myDonations as OperationLike).data.typeName).toBe('Query');

    expect(sdl).toContain(
      'initiateDonation(amount: Float!, donationType: DonationType!, frequency: DonationFrequency): DonationInitiation! @function(',
    );
    expect(sdl).toContain('cancelDonation(id: ID!): Donation! @function(');
    expect(sdl).toContain('myDonations: [Donation!]! @function(');
    for (const op of ['initiateDonation', 'cancelDonation', 'myDonations']) {
      const line = sdl.split('\n').find((l) => l.trim().startsWith(op)) ?? '';
      expect(line).toContain('@auth(rules: [{allow: private}])');
    }
  });

  it('defines DonationInitiation with exactly the three contract fields', () => {
    expect(Object.keys((types.DonationInitiation as CustomTypeLike).data.fields)).toEqual([
      'donationId',
      'checkoutUrl',
      'checkoutReference',
    ]);
    expect(sdl).toContain('donationId: ID!');
    expect(sdl).toContain('checkoutUrl: AWSURL!');
    expect(sdl).toContain('checkoutReference: String!');
  });

  it('ships with the donations release gate OFF (FR5.4 — later release)', () => {
    expect(DONATIONS_ENABLED).toBe(false);
  });
});
