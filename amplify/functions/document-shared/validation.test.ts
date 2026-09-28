/**
 * pdf-library-unit — validation tests (BR6.1, BR6.2, key shape and the
 * `parseS3Key` boundary check). Pure functions: no I/O.
 */
import { DocumentValidationError } from './errors';
import {
  buildS3Key,
  isPdfContentType,
  parseS3Key,
  validateCategory,
  validateTitle,
} from './validation';

const UUID = '6f1a2b3c-4d5e-4f60-8a71-92b3c4d5e6f7';

describe('pdf-library-unit: validation', () => {
  it('accepts each of the three fixed categories and rejects anything else (BR6.1)', () => {
    expect(validateCategory('DAILY_POOJAN')).toBe('DAILY_POOJAN');
    expect(validateCategory('VARIOUS_VIDHAANS')).toBe('VARIOUS_VIDHAANS');
    expect(validateCategory('BHAKTAMAR')).toBe('BHAKTAMAR');
    for (const bad of ['daily_poojan', 'SERMONS', '', undefined, null, 42]) {
      expect(() => validateCategory(bad)).toThrow(DocumentValidationError);
    }
  });

  it('rejects an empty, blank, missing or over-long title and trims an accepted one', () => {
    expect(validateTitle('  Bhaktamar Stotra ')).toBe('Bhaktamar Stotra');
    expect(validateTitle('x'.repeat(200))).toHaveLength(200);
    for (const bad of ['', '   ', undefined, null, 7, 'x'.repeat(201)]) {
      expect(() => validateTitle(bad)).toThrow(DocumentValidationError);
    }
  });

  it('recognizes a PDF content type case-insensitively, with or without parameters (BR6.2)', () => {
    expect(isPdfContentType('application/pdf')).toBe(true);
    expect(isPdfContentType('Application/PDF')).toBe(true);
    expect(isPdfContentType('application/pdf; charset=binary')).toBe(true);
  });

  it('rejects any non-PDF or missing content type (BR6.2)', () => {
    expect(isPdfContentType('application/octet-stream')).toBe(false);
    expect(isPdfContentType('image/jpeg')).toBe(false);
    expect(isPdfContentType('application/pdfx')).toBe(false);
    expect(isPdfContentType('')).toBe(false);
    expect(isPdfContentType(undefined)).toBe(false);
  });

  it('builds keys as documents/<CATEGORY>/<uuid>.pdf and parses them back', () => {
    const key = buildS3Key('VARIOUS_VIDHAANS', UUID);
    expect(key).toBe(`documents/VARIOUS_VIDHAANS/${UUID}.pdf`);
    expect(parseS3Key(key)).toEqual({ category: 'VARIOUS_VIDHAANS', id: UUID });
    expect(parseS3Key(`documents/BHAKTAMAR/${UUID.toUpperCase()}.pdf`)).toEqual({
      category: 'BHAKTAMAR',
      id: UUID.toUpperCase(),
    });
  });

  it('parseS3Key rejects path traversal and any key outside the documents/ prefix', () => {
    for (const bad of [
      `documents/BHAKTAMAR/../../${UUID}.pdf`,
      `documents/BHAKTAMAR/..\\${UUID}.pdf`,
      `/documents/BHAKTAMAR/${UUID}.pdf`,
      `Documents/BHAKTAMAR/${UUID}.pdf`,
      `public/BHAKTAMAR/${UUID}.pdf`,
      `BHAKTAMAR/${UUID}.pdf`,
      `documents/BHAKTAMAR/extra/${UUID}.pdf`,
      `documents//${UUID}.pdf`,
      '',
      undefined,
      null,
    ]) {
      expect(() => parseS3Key(bad)).toThrow(DocumentValidationError);
    }
  });

  it('parseS3Key rejects an unknown category, a non-UUID name or a non-.pdf extension', () => {
    for (const bad of [
      `documents/SERMONS/${UUID}.pdf`,
      `documents/bhaktamar/${UUID}.pdf`,
      `documents/BHAKTAMAR/${UUID}.exe`,
      `documents/BHAKTAMAR/${UUID}`,
      'documents/BHAKTAMAR/not-a-uuid.pdf',
      'documents/BHAKTAMAR/.pdf',
    ]) {
      expect(() => parseS3Key(bad)).toThrow('not issued by createDocumentUploadUrl');
    }
  });
});
