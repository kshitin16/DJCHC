/**
 * feed-unit — the `Post` table's DynamoDB Streams commitment (Contract 8).
 *
 * `security-design.md` ("Contract 8 event integrity"): the stream MUST carry
 * `NEW_AND_OLD_IMAGES`, not the `NEW_IMAGE` default. reminder-unit's Contract 8
 * handler detects `PostDeleted` by seeing `deletedAt` transition from absent to
 * a timestamp inside a MODIFY record — a diff that only exists when the OLD
 * image travels alongside the NEW one. Pinned here, outside the
 * coverage-excluded `backend.ts`, so a test can assert it.
 */
import { StreamViewType } from 'aws-cdk-lib/aws-dynamodb';

export const postStreamViewType = 'NEW_AND_OLD_IMAGES' as const;

/** The CDK enum member `backend.ts` hands to the table wrapper. */
export const postStreamViewTypeCdk: StreamViewType = StreamViewType.NEW_AND_OLD_IMAGES;
