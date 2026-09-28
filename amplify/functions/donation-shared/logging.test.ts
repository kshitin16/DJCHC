/** donation-unit — the structured logger emits one JSON line per call and never throws. */
import { jest } from '@jest/globals';
import { createLogger, describeError, silentLogger } from './logging';

describe('donation-unit: logging', () => {
  const spies = {
    log: jest.spyOn(console, 'log').mockImplementation(() => {}),
    warn: jest.spyOn(console, 'warn').mockImplementation(() => {}),
    error: jest.spyOn(console, 'error').mockImplementation(() => {}),
  };
  afterEach(() => Object.values(spies).forEach((s) => s.mockClear()));
  afterAll(() => Object.values(spies).forEach((s) => s.mockRestore()));

  it('writes INFO/WARN/ERROR as single JSON lines carrying component, message and fields', () => {
    const logger = createLogger('donation-test');
    logger.info('hello', { donationId: 'don-1' });
    logger.warn('careful');
    logger.error('boom', { code: 7 });

    const info = JSON.parse(spies.log.mock.calls[0][0] as string);
    expect(info).toMatchObject({
      level: 'INFO',
      component: 'donation-test',
      message: 'hello',
      donationId: 'don-1',
    });
    expect(typeof info.timestamp).toBe('string');
    expect(JSON.parse(spies.warn.mock.calls[0][0] as string)).toMatchObject({
      level: 'WARN',
      message: 'careful',
    });
    expect(JSON.parse(spies.error.mock.calls[0][0] as string)).toMatchObject({
      level: 'ERROR',
      code: 7,
    });
  });

  it('describeError yields a name/message pair for Errors and non-Errors alike', () => {
    const typed = new Error('nope');
    typed.name = 'CustomError';
    expect(describeError(typed)).toEqual({ name: 'CustomError', message: 'nope' });
    expect(describeError('string failure')).toEqual({
      name: 'UnknownError',
      message: 'string failure',
    });
  });

  it('silentLogger records nothing', () => {
    silentLogger.info('x');
    silentLogger.warn('x');
    silentLogger.error('x');
    expect(spies.log).not.toHaveBeenCalled();
    expect(spies.warn).not.toHaveBeenCalled();
    expect(spies.error).not.toHaveBeenCalled();
  });
});
