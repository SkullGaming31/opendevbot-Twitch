import fs from 'fs';
import path from 'path';
import pino from 'pino';

const LOG_DIR = process.env.LOG_DIR ?? path.join(process.cwd(), 'logs');
try {
  fs.mkdirSync(LOG_DIR, { recursive: true });
} catch (e) {
  // ignore
}

const logFile = path.join(LOG_DIR, 'app.log');
const level = (process.env.LOG_LEVEL as any) ?? 'info';

// file logger destination
const fileDest = pino.destination(logFile);
const fileLogger = pino({ level }, fileDest);

// Optionally enable console pretty output in non-production or when explicitly requested
let consoleLogger: pino.Logger | null = null;
const wantConsole = process.env.LOG_TO_CONSOLE === 'true' || process.env.NODE_ENV !== 'production';
if (wantConsole) {
  try {
    // Use pino transport with pino-pretty if available for developer-friendly output
    // This will log to stdout.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const transport = pino.transport({ target: 'pino-pretty', options: { colorize: true } });
    consoleLogger = pino({ level }, transport);
  } catch (err) {
    // fallback to a very small console wrapper if transport creation fails
    consoleLogger = pino({ level });
  }
}

// Proxy logger that forwards calls to both fileLogger and optional consoleLogger
const loggerProxy: any = new Proxy(fileLogger, {
  get(target, prop) {
    const orig = (target as any)[prop];
    if (typeof orig === 'function') {
      return (...args: any[]) => {
        try {
          (target as any)[prop](...args);
        } catch {}
        if (consoleLogger && typeof (consoleLogger as any)[prop] === 'function') {
          try {
            (consoleLogger as any)[prop](...args);
          } catch {}
        }
      };
    }
    return orig;
  },
});

export default loggerProxy as pino.Logger;
