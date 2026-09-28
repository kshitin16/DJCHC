/**
 * pdf-library-unit — pins the pre-signed URL lifetimes NFR-SEC.1.1 fixes
 * (15-minute upload, 1-hour download). A change here is a security change
 * (security-design.md "Process controls": self-review before merging).
 */
import { DOWNLOAD_URL_EXPIRES_SECONDS, UPLOAD_URL_EXPIRES_SECONDS } from './constants';

describe('pdf-library-unit: pre-signed URL lifetimes (NFR-SEC.1.1)', () => {
  it('issues 15-minute upload URLs and 1-hour download URLs', () => {
    expect(UPLOAD_URL_EXPIRES_SECONDS).toBe(900);
    expect(DOWNLOAD_URL_EXPIRES_SECONDS).toBe(3600);
  });
});
