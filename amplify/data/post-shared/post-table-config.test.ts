/**
 * feed-unit — pins the Post table's Streams commitment (Contract 8,
 * security-design.md): `NEW_AND_OLD_IMAGES`, never the `NEW_IMAGE` default.
 */
import { StreamViewType } from 'aws-cdk-lib/aws-dynamodb';
import { postStreamViewType, postStreamViewTypeCdk } from './post-table-config';

describe('feed-unit: Post table Streams configuration (Contract 8)', () => {
  it('commits to NEW_AND_OLD_IMAGES so PostDeleted can be detected from a MODIFY record', () => {
    expect(postStreamViewType).toBe('NEW_AND_OLD_IMAGES');
    expect(postStreamViewTypeCdk).toBe(StreamViewType.NEW_AND_OLD_IMAGES);
    expect(String(postStreamViewTypeCdk)).toBe(postStreamViewType);
  });
});
