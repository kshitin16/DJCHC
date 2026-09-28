/**
 * donation-unit (U4) — minimal structured (JSON) logging for the donation
 * Lambdas. One line per operation boundary; never log secrets, signatures,
 * raw webhook bodies or donor identifiers beyond the Donation id.
 */
export type LogLevel = 'INFO' | 'WARN' | 'ERROR';

export interface Logger {
  info(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  error(message: string, fields?: Record<string, unknown>): void;
}

function write(
  level: LogLevel,
  component: string,
  message: string,
  fields?: Record<string, unknown>,
) {
  const line = JSON.stringify({
    level,
    component,
    message,
    ...fields,
    timestamp: new Date().toISOString(),
  });
  if (level === 'ERROR') console.error(line);
  else if (level === 'WARN') console.warn(line);
  else console.log(line);
}

export function createLogger(component: string): Logger {
  return {
    info: (message, fields) => write('INFO', component, message, fields),
    warn: (message, fields) => write('WARN', component, message, fields),
    error: (message, fields) => write('ERROR', component, message, fields),
  };
}

/** A logger that records nothing — for tests. */
export const silentLogger: Logger = { info: () => {}, warn: () => {}, error: () => {} };

/** Safe, PII-free description of an unknown thrown value. */
export function describeError(error: unknown): { name: string; message: string } {
  if (error instanceof Error) return { name: error.name, message: error.message };
  return { name: 'UnknownError', message: String(error) };
}
