import fs from 'fs';
import path from 'path';
import pino from 'pino';

const LOG_DIR = process.env.LOG_DIR ?? path.join(process.cwd(), 'logs');
try {
  fs.mkdirSync(LOG_DIR, { recursive: true });
} catch {
  void 0;
}

const logFile = path.join(LOG_DIR, 'app.log');
const level = (process.env.LOG_LEVEL as string) ?? 'info';

// Optionally enable console pretty output in non-production or when explicitly requested
let fileLogger: pino.Logger;
let consoleLogger: pino.Logger | null = null;
const wantConsole = process.env.LOG_TO_CONSOLE === 'true' || process.env.NODE_ENV !== 'production';
if (wantConsole) {
  try {
    // When developers prefer console pretty output, avoid creating a file
    // destination (sonic-boom) which can produce flush issues during exit in
    // certain environments. Use a console-only logger in this case.
    const transport = pino.transport({ target: 'pino-pretty', options: { colorize: true } });
    consoleLogger = pino({ level }, transport);
    fileLogger = pino({ level });
  } catch {
    // fallback to a very small console wrapper if transport creation fails
    consoleLogger = pino({ level });
    fileLogger = pino({ level });
  }
} else {
  // file logger destination (use async destination to avoid sync flush errors on exit)
  const fileDest = pino.destination({ dest: logFile, sync: false });
  fileLogger = pino({ level }, fileDest);
}

// Proxy logger that forwards calls to both fileLogger and optional consoleLogger
/* eslint-disable @typescript-eslint/no-explicit-any */
const loggerProxy = new Proxy(fileLogger, {
  get(target, prop) {
    const key = String(prop);
    const value = (target as unknown as Record<string, unknown>)[key];
    if (typeof value === 'function') {
      return (...args: unknown[]) => {
        try {
          // call original file logger method
          (value as any).apply(target, args as any);
        } catch {
          void 0;
        }
        const cfn = (consoleLogger as unknown as Record<string, unknown> | null)?.[key];
        if (cfn && typeof cfn === 'function') {
          try {
            (cfn as any).apply(consoleLogger, args as any);
          } catch {
            void 0;
          }
        }
      };
    }
    return value as any;
  },
});
/* eslint-enable @typescript-eslint/no-explicit-any */

export default loggerProxy as pino.Logger;
