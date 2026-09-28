/**
 * reminder-unit — pins the fixed values the schema, `backend.ts` and the
 * Lambdas share (BR7.2, BR7.3, R-04 index names, schedule-name builders).
 */
import {
  DEVICE_TOKEN_OWNER_INDEX,
  FIRE_HOUR_IST,
  IST_OFFSET_MINUTES,
  REMINDER_OWNER_INDEX,
  REMINDER_POST_INDEX,
  SNOOZE_HOUR_IST,
  clearScheduleName,
  fireScheduleName,
} from './constants';

describe('reminder-unit: constants', () => {
  it('pins the IST fire hours (BR7.2, BR7.3), the R-04 index names and the schedule-name builders', () => {
    expect(FIRE_HOUR_IST).toBe(9);
    expect(SNOOZE_HOUR_IST).toBe(21);
    expect(IST_OFFSET_MINUTES).toBe(330);
    expect(REMINDER_POST_INDEX).toBe('postIdIndex');
    expect(REMINDER_OWNER_INDEX).toBe('ownerIndex');
    expect(DEVICE_TOKEN_OWNER_INDEX).toBe('ownerIndex');
    expect(fireScheduleName('abc-123')).toBe('fire-abc-123');
    expect(clearScheduleName('abc-123')).toBe('clear-abc-123');
  });
});
